"""DTOs para request/response al WSFEv1."""

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import List, Optional


@dataclass
class AlicuotaIva:
    """Una alícuota de IVA dentro de un comprobante."""

    # Id alícuota AFIP: 3=0%, 4=10.5%, 5=21%, 6=27%, 8=5%, 9=2.5%
    id: int
    base_imponible: Decimal
    importe: Decimal


@dataclass
class ComprobanteAsociado:
    tipo: int      # CbteTipo
    punto_venta: int
    numero: int
    cuit: Optional[str] = None


@dataclass
class SolicitudCae:
    """Datos mínimos para pedir CAE (FECAESolicitar)."""

    cbte_tipo: int           # 1, 6, 3, 8, 2, 7
    punto_venta: int
    concepto: int            # 1 Productos, 2 Servicios, 3 Ambos
    doc_tipo: int            # 80 CUIT, 86 CUIL, 96 DNI, 99 Consumidor Final
    doc_nro: int             # 0 si DocTipo=99
    cbte_desde: int
    cbte_hasta: int
    cbte_fecha: date         # YYYYMMDD
    imp_total: Decimal
    imp_tot_conc: Decimal    # importe no gravado
    imp_neto: Decimal        # neto gravado
    imp_op_ex: Decimal       # importe exento
    imp_trib: Decimal        # tributos (percepciones)
    imp_iva: Decimal         # total de IVA
    moneda_id: str = "PES"
    moneda_cotiz: Decimal = Decimal("1")
    condicion_iva_receptor_id: Optional[int] = None  # RG 5616/2024

    # Solo si concepto es 2 o 3 (servicios)
    fecha_servicio_desde: Optional[date] = None
    fecha_servicio_hasta: Optional[date] = None
    fecha_vto_pago: Optional[date] = None

    alicuotas: List[AlicuotaIva] = field(default_factory=list)
    comprobantes_asociados: List[ComprobanteAsociado] = field(default_factory=list)


@dataclass
class RespuestaCae:
    """Respuesta procesada de FECAESolicitar."""

    resultado: str              # A, P, R
    cae: Optional[str]
    cae_vencimiento: Optional[date]
    numero_comprobante: Optional[int]
    observaciones: List[dict]
    errores: List[dict]
    raw: dict                   # Response cruda serializable
