"""
Diagnóstico de la integración con ARCA / AFIP.

Hace una serie de checks para que la persona técnica vea de un vistazo
si el módulo está bien configurado y conectado, sin tener que emitir
una factura de prueba.

Cada check devuelve:
  - id: identificador estable
  - titulo: texto humano
  - ok: bool
  - detalle: información extra (mensaje de error, valor encontrado, etc.)
  - critico: si es bloqueante para emitir (afecta el "estado general")
"""

from __future__ import annotations

import logging
import os
from datetime import date, datetime, timezone
from typing import List

from app.core.config import settings

logger = logging.getLogger(__name__)


# ==================== CHECKS INDIVIDUALES ====================


def _check_cuit_empresa() -> dict:
    cuit = settings.EMPRESA_CUIT
    placeholder = cuit in ("", "XX-XXXXXXXX-X", "XX-XXXXXXXXX-X")
    return {
        "id": "cuit_empresa",
        "titulo": "CUIT de la empresa",
        "ok": not placeholder,
        "detalle": (
            f"CUIT cargado: {cuit}"
            if not placeholder
            else "Está como placeholder. Setear EMPRESA_CUIT en Railway."
        ),
        "critico": True,
    }


def _check_punto_venta() -> dict:
    pv = settings.AFIP_PUNTO_VENTA
    return {
        "id": "punto_venta",
        "titulo": "Punto de venta configurado",
        "ok": pv > 0,
        "detalle": f"AFIP_PUNTO_VENTA={pv}",
        "critico": True,
    }


def _check_cert_existe() -> dict:
    path = settings.AFIP_CERT_PATH
    if not path:
        return {
            "id": "cert_existe",
            "titulo": "Certificado ARCA (.crt)",
            "ok": False,
            "detalle": "AFIP_CERT_PATH no configurado.",
            "critico": True,
        }
    existe = os.path.exists(path)
    return {
        "id": "cert_existe",
        "titulo": "Certificado ARCA (.crt)",
        "ok": existe,
        "detalle": f"{path} {'(encontrado)' if existe else '(no existe — subirlo como Secret File en Railway)'}",
        "critico": True,
    }


def _check_key_existe() -> dict:
    path = settings.AFIP_KEY_PATH
    if not path:
        return {
            "id": "key_existe",
            "titulo": "Clave privada (.key)",
            "ok": False,
            "detalle": "AFIP_KEY_PATH no configurado.",
            "critico": True,
        }
    existe = os.path.exists(path)
    return {
        "id": "key_existe",
        "titulo": "Clave privada (.key)",
        "ok": existe,
        "detalle": f"{path} {'(encontrada)' if existe else '(no existe — subirla como Secret File en Railway)'}",
        "critico": True,
    }


def _check_cert_valido() -> dict:
    """Verifica que el certificado se pueda parsear y mira su vencimiento."""
    path = settings.AFIP_CERT_PATH
    if not path or not os.path.exists(path):
        return {
            "id": "cert_valido",
            "titulo": "Certificado válido",
            "ok": False,
            "detalle": "No se puede validar — falta el archivo.",
            "critico": True,
        }
    try:
        from cryptography import x509
        from cryptography.hazmat.backends import default_backend

        with open(path, "rb") as f:
            cert = x509.load_pem_x509_certificate(f.read(), default_backend())

        ahora = datetime.now(timezone.utc)
        not_after = cert.not_valid_after_utc if hasattr(cert, "not_valid_after_utc") else cert.not_valid_after
        if not_after.tzinfo is None:
            not_after = not_after.replace(tzinfo=timezone.utc)

        dias_para_vencer = (not_after - ahora).days
        vencido = dias_para_vencer < 0
        por_vencer = 0 <= dias_para_vencer <= 30

        # Subject (extraer CUIT del serialNumber si está)
        subject_str = cert.subject.rfc4514_string()

        if vencido:
            return {
                "id": "cert_valido",
                "titulo": "Certificado válido",
                "ok": False,
                "detalle": f"Certificado VENCIDO el {not_after.date()}. Generar uno nuevo.",
                "critico": True,
            }
        if por_vencer:
            return {
                "id": "cert_valido",
                "titulo": "Certificado válido",
                "ok": True,
                "detalle": f"⚠️ Vence en {dias_para_vencer} días ({not_after.date()}). Subject: {subject_str}",
                "critico": False,
            }
        return {
            "id": "cert_valido",
            "titulo": "Certificado válido",
            "ok": True,
            "detalle": f"Vence {not_after.date()} (en {dias_para_vencer} días). Subject: {subject_str}",
            "critico": True,
        }
    except Exception as exc:
        return {
            "id": "cert_valido",
            "titulo": "Certificado válido",
            "ok": False,
            "detalle": f"No se pudo parsear: {exc}",
            "critico": True,
        }


def _check_wsaa() -> dict:
    """Intenta obtener un ticket WSAA (autenticación con ARCA)."""
    try:
        from app.integrations.afip.wsaa import obtener_ticket_acceso
    except ImportError as exc:
        return {
            "id": "wsaa",
            "titulo": "Autenticación WSAA",
            "ok": False,
            "detalle": f"Librerías AFIP no instaladas: {exc}",
            "critico": True,
        }

    try:
        ticket = obtener_ticket_acceso("wsfe")
        return {
            "id": "wsaa",
            "titulo": "Autenticación WSAA",
            "ok": True,
            "detalle": (
                f"Ticket WSAA obtenido. Vence "
                f"{ticket.expiration_time.isoformat(timespec='minutes')}"
            ),
            "critico": True,
        }
    except Exception as exc:
        return {
            "id": "wsaa",
            "titulo": "Autenticación WSAA",
            "ok": False,
            "detalle": str(exc),
            "critico": True,
        }


def _check_wsfev1_consulta() -> dict:
    """Llama FECompUltimoAutorizado para Factura A para validar WSFEv1."""
    try:
        from app.integrations.afip.wsfev1 import WsfeClient
    except ImportError as exc:
        return {
            "id": "wsfev1",
            "titulo": "Conexión WSFEv1 (último comprobante)",
            "ok": False,
            "detalle": f"No se pudo importar el cliente: {exc}",
            "critico": True,
        }

    try:
        client = WsfeClient()
        # CbteTipo 1 = Factura A. Si la empresa no emite A todavía,
        # devuelve 0 igualmente (no es error).
        ultimo = client.obtener_ultimo_comprobante(settings.AFIP_PUNTO_VENTA, 1)
        return {
            "id": "wsfev1",
            "titulo": "Conexión WSFEv1 (último comprobante)",
            "ok": True,
            "detalle": f"Último Factura A autorizada en PV {settings.AFIP_PUNTO_VENTA}: #{ultimo}",
            "critico": True,
        }
    except Exception as exc:
        return {
            "id": "wsfev1",
            "titulo": "Conexión WSFEv1 (último comprobante)",
            "ok": False,
            "detalle": str(exc),
            "critico": True,
        }


def _check_cbu() -> dict:
    cbu = (settings.EMPRESA_CBU or "").strip()
    if not cbu:
        return {
            "id": "cbu",
            "titulo": "CBU informada (régimen RG 1575/03)",
            "ok": False,
            "detalle": (
                "EMPRESA_CBU vacío. Si emitís Factura A bajo régimen 1575/03 "
                "es obligatorio — sin esto las Factura A salen sin CBU "
                "impresa y son inválidas."
            ),
            "critico": False,  # no bloquea WSFEv1 pero invalida fiscalmente las A
        }
    if len(cbu) != 22 or not cbu.isdigit():
        return {
            "id": "cbu",
            "titulo": "CBU informada",
            "ok": False,
            "detalle": f"CBU debe tener 22 dígitos, vino {len(cbu)} caracteres.",
            "critico": False,
        }
    return {
        "id": "cbu",
        "titulo": "CBU informada (régimen RG 1575/03)",
        "ok": True,
        "detalle": f"CBU: {cbu[:6]}…{cbu[-4:]} ({settings.EMPRESA_BANCO or 'banco no especificado'})",
        "critico": False,
    }


# ==================== ORQUESTADOR ====================


def diagnosticar_arca() -> dict:
    """
    Corre todos los checks y arma el reporte completo.
    Es defensivo: si un check explota lo capta y lo marca como ok=False.
    """
    checks_fns = [
        _check_cuit_empresa,
        _check_punto_venta,
        _check_cert_existe,
        _check_key_existe,
        _check_cert_valido,
        _check_wsaa,
        _check_wsfev1_consulta,
        _check_cbu,
    ]

    resultados: List[dict] = []
    for fn in checks_fns:
        try:
            resultados.append(fn())
        except Exception as exc:  # pragma: no cover
            logger.exception("Check %s explotó", fn.__name__)
            resultados.append({
                "id": fn.__name__,
                "titulo": fn.__name__,
                "ok": False,
                "detalle": f"Error inesperado: {exc}",
                "critico": True,
            })

    bloqueantes_fallando = [r for r in resultados if r["critico"] and not r["ok"]]
    avisos = [r for r in resultados if not r["critico"] and not r["ok"]]

    if bloqueantes_fallando:
        estado = "rojo"
        resumen = f"Faltan {len(bloqueantes_fallando)} requisitos críticos para emitir."
    elif avisos:
        estado = "amarillo"
        resumen = f"Se puede emitir, pero hay {len(avisos)} advertencias."
    else:
        estado = "verde"
        resumen = "Todo listo para emitir."

    return {
        "estado": estado,
        "resumen": resumen,
        "entorno": settings.AFIP_ENTORNO,
        "punto_venta": settings.AFIP_PUNTO_VENTA,
        "cuit_empresa": settings.EMPRESA_CUIT,
        "checks": resultados,
        "evaluado_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
