"""
Cliente WSFEv1 (Facturación Electrónica AFIP).

Wrappers sobre el SOAP service de AFIP:
  - FECompUltimoAutorizado  → último número autorizado por (PtoVta, CbteTipo).
  - FECAESolicitar          → solicita CAE para un comprobante.
  - FEParamGetTiposIva      → alícuotas (opcional, diagnóstico).

No administra estado local — solo habla SOAP. La lógica de negocio
(``factura_service.emitir_factura``) es quien llama acá y decide qué guardar.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

import zeep
from zeep.transports import Transport

from app.core.config import settings
from app.integrations.afip.exceptions import AfipError, AfipRechazoError
from app.integrations.afip.types import (
    AlicuotaIva,
    ComprobanteAsociado,
    RespuestaCae,
    SolicitudCae,
)
from app.integrations.afip.wsaa import obtener_ticket_acceso

logger = logging.getLogger(__name__)


# ==================== HELPERS ====================


def _fecha_afip(d: Optional[date]) -> Optional[str]:
    """AFIP espera fechas como 'YYYYMMDD'."""
    if d is None:
        return None
    return d.strftime("%Y%m%d")


def _parse_fecha_afip(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y%m%d").date()
    except ValueError:
        return None


def _to_serializable(obj: Any) -> Any:
    """Convierte objetos Zeep a dicts serializables a JSON (para auditoría)."""
    if isinstance(obj, (str, int, float, bool, type(None))):
        return obj
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    if isinstance(obj, list):
        return [_to_serializable(i) for i in obj]
    if hasattr(obj, "__values__"):  # zeep CompoundValue
        return {k: _to_serializable(v) for k, v in obj.__values__.items()}
    if hasattr(obj, "__dict__"):
        return {k: _to_serializable(v) for k, v in vars(obj).items() if not k.startswith("_")}
    return str(obj)


# ==================== CLIENTE ====================


class WsfeClient:
    """Cliente stateful del WSFEv1 con cache del ticket de acceso."""

    def __init__(self):
        self.cuit = settings.EMPRESA_CUIT_NUMERICO
        self.wsdl_url = settings.AFIP_WSFEV1_URL
        self._client: Optional[zeep.Client] = None

    def _get_client(self) -> zeep.Client:
        if self._client is None:
            transport = Transport(timeout=30)
            self._client = zeep.Client(self.wsdl_url, transport=transport)
        return self._client

    def _auth(self) -> dict:
        ticket = obtener_ticket_acceso("wsfe")
        return {
            "Token": ticket.token,
            "Sign": ticket.sign,
            "Cuit": self.cuit,
        }

    # -------- FECompUltimoAutorizado --------

    def obtener_ultimo_comprobante(self, punto_venta: int, cbte_tipo: int) -> int:
        """
        Devuelve el último número autorizado. Si aún no hay, devuelve 0.
        """
        client = self._get_client()
        resp = client.service.FECompUltimoAutorizado(
            Auth=self._auth(),
            PtoVta=punto_venta,
            CbteTipo=cbte_tipo,
        )
        _check_errores(resp)
        return int(resp.CbteNro or 0)

    # -------- FECAESolicitar --------

    def solicitar_cae(self, solicitud: SolicitudCae) -> RespuestaCae:
        """
        Solicita CAE para un comprobante único. Sólo se envía un detalle (FECAEDetRequest)
        — no batch. Si AFIP rechaza, retorna RespuestaCae con ``resultado="R"``.
        """
        client = self._get_client()

        det = {
            "Concepto": solicitud.concepto,
            "DocTipo": solicitud.doc_tipo,
            "DocNro": solicitud.doc_nro,
            "CbteDesde": solicitud.cbte_desde,
            "CbteHasta": solicitud.cbte_hasta,
            "CbteFch": _fecha_afip(solicitud.cbte_fecha),
            "ImpTotal": float(solicitud.imp_total),
            "ImpTotConc": float(solicitud.imp_tot_conc),
            "ImpNeto": float(solicitud.imp_neto),
            "ImpOpEx": float(solicitud.imp_op_ex),
            "ImpTrib": float(solicitud.imp_trib),
            "ImpIVA": float(solicitud.imp_iva),
            "MonId": solicitud.moneda_id,
            "MonCotiz": float(solicitud.moneda_cotiz),
        }

        # Fechas servicio (concepto 2 o 3)
        if solicitud.concepto in (2, 3):
            det["FchServDesde"] = _fecha_afip(solicitud.fecha_servicio_desde)
            det["FchServHasta"] = _fecha_afip(solicitud.fecha_servicio_hasta)
            det["FchVtoPago"] = _fecha_afip(solicitud.fecha_vto_pago)

        # Condición IVA receptor (RG 5616/2024)
        if solicitud.condicion_iva_receptor_id is not None:
            det["CondicionIVAReceptorId"] = solicitud.condicion_iva_receptor_id

        # Alícuotas IVA
        if solicitud.alicuotas:
            det["Iva"] = {
                "AlicIva": [
                    {
                        "Id": a.id,
                        "BaseImp": float(a.base_imponible),
                        "Importe": float(a.importe),
                    }
                    for a in solicitud.alicuotas
                ]
            }

        # Comprobantes asociados (NC/ND)
        if solicitud.comprobantes_asociados:
            det["CbtesAsoc"] = {
                "CbteAsoc": [
                    {
                        "Tipo": c.tipo,
                        "PtoVta": c.punto_venta,
                        "Nro": c.numero,
                        **({"Cuit": c.cuit} if c.cuit else {}),
                    }
                    for c in solicitud.comprobantes_asociados
                ]
            }

        fecae_req = {
            "FeCabReq": {
                "CantReg": 1,
                "PtoVta": solicitud.punto_venta,
                "CbteTipo": solicitud.cbte_tipo,
            },
            "FeDetReq": {"FECAEDetRequest": [det]},
        }

        resp = client.service.FECAESolicitar(Auth=self._auth(), FeCAEReq=fecae_req)
        raw = _to_serializable(resp)
        _check_errores(resp)

        # Resultado y detalle
        cabecera = getattr(resp, "FeCabResp", None)
        resultado = getattr(cabecera, "Resultado", None) if cabecera else None

        detalles = getattr(getattr(resp, "FeDetResp", None), "FECAEDetResponse", []) or []
        if not isinstance(detalles, list):
            detalles = [detalles]
        det0 = detalles[0] if detalles else None

        cae = getattr(det0, "CAE", None) if det0 else None
        cae_vto = _parse_fecha_afip(getattr(det0, "CAEFchVto", None)) if det0 else None
        cbte_nro = int(getattr(det0, "CbteDesde", 0) or 0) if det0 else None

        observaciones = _extraer_observaciones(det0)
        errores = _extraer_errores(det0)

        return RespuestaCae(
            resultado=(resultado or "").upper(),
            cae=cae if cae else None,
            cae_vencimiento=cae_vto,
            numero_comprobante=cbte_nro,
            observaciones=observaciones,
            errores=errores,
            raw=raw,
        )


# ==================== HANDLERS DE RESPUESTA ====================


def _check_errores(resp: Any) -> None:
    """Lanza AfipError si la respuesta de AFIP trae bloque Errors."""
    errores_raw = getattr(resp, "Errors", None)
    if errores_raw is None:
        return
    items = getattr(errores_raw, "Err", None)
    if not items:
        return
    if not isinstance(items, list):
        items = [items]
    msgs = [f"[{getattr(e, 'Code', '?')}] {getattr(e, 'Msg', '')}" for e in items]
    raise AfipError("AFIP devolvió errores: " + " | ".join(msgs))


def _extraer_observaciones(det) -> list[dict]:
    if det is None:
        return []
    obs = getattr(det, "Observaciones", None)
    if obs is None:
        return []
    items = getattr(obs, "Obs", None) or []
    if not isinstance(items, list):
        items = [items]
    return [{"code": getattr(o, "Code", None), "msg": getattr(o, "Msg", None)} for o in items]


def _extraer_errores(det) -> list[dict]:
    if det is None:
        return []
    errs = getattr(det, "Observaciones", None)  # En rechazo AFIP pone el detalle acá también
    if errs is None:
        return []
    # Tomar sólo los que son realmente errores (códigos E*)
    return _extraer_observaciones(det)


# ==================== FUNCIONES DE MÓDULO (atajo) ====================


def obtener_ultimo_comprobante(punto_venta: int, cbte_tipo: int) -> int:
    return WsfeClient().obtener_ultimo_comprobante(punto_venta, cbte_tipo)


def solicitar_cae(solicitud: SolicitudCae) -> RespuestaCae:
    return WsfeClient().solicitar_cae(solicitud)
