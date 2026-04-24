"""
Schemas de Factura (Factura A/B + Notas de Crédito/Débito).
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

from app.schemas import parse_date_without_timezone


# ==================== DETALLE FACTURA ====================


class FacturaDetalleBase(BaseModel):
    descripcion: str = Field(..., min_length=1, max_length=500)
    cantidad: Decimal = Field(..., gt=0)
    unidad_medida: str = "unidad"
    precio_unitario_neto: Decimal = Field(..., ge=0)
    descuento_porcentaje: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    iva_porcentaje: Decimal = Field(default=Decimal("21"), ge=0, le=100)
    detalle_pedido_id: Optional[str] = None
    producto_lavado_id: Optional[str] = None


class FacturaDetalleCreate(FacturaDetalleBase):
    pass


class FacturaDetalleResponse(FacturaDetalleBase):
    id: str
    subtotal_neto: Decimal
    iva_monto: Decimal
    total_linea: Decimal

    class Config:
        from_attributes = True


# ==================== FACTURA ====================


class FacturaCreateDesdePedido(BaseModel):
    """Crear factura (borrador) a partir de un pedido."""

    pedido_id: str
    fecha_emision: Optional[date] = None  # Default: hoy
    concepto_afip: str = "2"  # Servicios
    fecha_servicio_desde: Optional[date] = None
    fecha_servicio_hasta: Optional[date] = None
    fecha_vencimiento_pago: Optional[date] = None
    condicion_venta: str = "cuenta_corriente"
    observaciones: Optional[str] = None

    @field_validator(
        "fecha_emision",
        "fecha_servicio_desde",
        "fecha_servicio_hasta",
        "fecha_vencimiento_pago",
        mode="before",
    )
    @classmethod
    def validate_date(cls, v):
        return parse_date_without_timezone(v)


class FacturaCreateManual(BaseModel):
    """Crear factura manual (sin pedido)."""

    cliente_id: str
    fecha_emision: Optional[date] = None
    concepto_afip: str = "2"
    fecha_servicio_desde: Optional[date] = None
    fecha_servicio_hasta: Optional[date] = None
    fecha_vencimiento_pago: Optional[date] = None
    condicion_venta: str = "cuenta_corriente"
    observaciones: Optional[str] = None
    detalles: List[FacturaDetalleCreate] = Field(..., min_length=1)

    @field_validator(
        "fecha_emision",
        "fecha_servicio_desde",
        "fecha_servicio_hasta",
        "fecha_vencimiento_pago",
        mode="before",
    )
    @classmethod
    def validate_date(cls, v):
        return parse_date_without_timezone(v)


class NotaCreditoItem(BaseModel):
    """Ítem de NC a creditar (línea de factura original)."""

    detalle_id: Optional[str] = None  # Si se refiere a línea específica
    descripcion: str
    cantidad: Decimal = Field(..., gt=0)
    precio_unitario_neto: Decimal = Field(..., ge=0)
    iva_porcentaje: Decimal = Field(default=Decimal("21"), ge=0, le=100)


class NotaCreditoCreate(BaseModel):
    """Crear Nota de Crédito asociada a una factura."""

    motivo: str = Field(..., min_length=3, max_length=500)
    fecha_emision: Optional[date] = None
    # Si se pasa "total=True" se credita por el total de la factura original.
    total: bool = False
    detalles: Optional[List[NotaCreditoItem]] = None
    observaciones: Optional[str] = None

    @field_validator("fecha_emision", mode="before")
    @classmethod
    def validate_date(cls, v):
        return parse_date_without_timezone(v)


class NotaDebitoCreate(BaseModel):
    """Crear Nota de Débito asociada a una factura."""

    motivo: str = Field(..., min_length=3, max_length=500)
    fecha_emision: Optional[date] = None
    detalles: List[FacturaDetalleCreate] = Field(..., min_length=1)
    observaciones: Optional[str] = None

    @field_validator("fecha_emision", mode="before")
    @classmethod
    def validate_date(cls, v):
        return parse_date_without_timezone(v)


class EmitirFacturaResponse(BaseModel):
    """Respuesta de emisión contra AFIP."""

    id: str
    estado: str
    cae: Optional[str] = None
    cae_vencimiento: Optional[date] = None
    numero_completo: Optional[str] = None
    resultado: Optional[str] = None  # A | R | P
    observaciones: Optional[str] = None
    errores: Optional[str] = None


class RegistrarCobroRequest(BaseModel):
    """Registrar un cobro sobre una factura."""

    monto: Decimal = Field(..., gt=0)
    fecha_cobro: Optional[date] = None
    medio_pago: str = "efectivo"  # efectivo, transferencia, cheque, etc.
    referencia_pago: Optional[str] = Field(default=None, max_length=100)
    observaciones: Optional[str] = None

    @field_validator("fecha_cobro", mode="before")
    @classmethod
    def validate_date(cls, v):
        return parse_date_without_timezone(v)


class RegistrarCobroResponse(BaseModel):
    factura_id: str
    estado_pago: str
    monto_pagado: Decimal
    monto_adeudado: Decimal
    movimiento_cuenta_corriente_id: str


class FacturaResponse(BaseModel):
    """Respuesta detallada de factura."""

    id: str
    tipo: str
    letra: str
    punto_venta: int
    numero_comprobante: Optional[int] = None
    numero_completo: Optional[str] = None

    estado_pago: str = "sin_cobrar"
    monto_pagado: Decimal = Decimal("0")
    fecha_ultimo_cobro: Optional[date] = None

    cliente_id: str
    cliente_razon_social_snap: str
    cliente_cuit_snap: Optional[str] = None
    cliente_documento_tipo_snap: Optional[str] = None
    cliente_documento_nro_snap: Optional[str] = None
    cliente_condicion_iva_snap: str
    cliente_domicilio_snap: Optional[str] = None

    pedido_id: Optional[str] = None
    factura_original_id: Optional[str] = None

    fecha_emision: date
    fecha_servicio_desde: Optional[date] = None
    fecha_servicio_hasta: Optional[date] = None
    fecha_vencimiento_pago: Optional[date] = None

    concepto_afip: str
    condicion_venta: str

    subtotal: Decimal
    descuento_monto: Decimal
    neto_gravado_21: Decimal
    neto_gravado_105: Decimal
    neto_no_gravado: Decimal
    iva_21: Decimal
    iva_105: Decimal
    percepciones: Decimal
    total: Decimal

    estado: str
    cae: Optional[str] = None
    cae_vencimiento: Optional[date] = None
    afip_resultado: Optional[str] = None
    afip_observaciones: Optional[str] = None
    afip_errores: Optional[str] = None
    emitido_at: Optional[datetime] = None

    anulada_por_nc_id: Optional[str] = None
    observaciones: Optional[str] = None
    motivo: Optional[str] = None

    movimiento_cuenta_corriente_id: Optional[str] = None
    creado_por_id: str
    emitido_por_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    detalles: List[FacturaDetalleResponse] = []

    class Config:
        from_attributes = True


class FacturaListItem(BaseModel):
    """Ítem simplificado para listados."""

    id: str
    tipo: str
    letra: str
    punto_venta: int
    numero_completo: Optional[str] = None
    cliente_id: str
    cliente_razon_social_snap: str
    fecha_emision: date
    total: Decimal
    estado: str
    estado_pago: str = "sin_cobrar"
    monto_pagado: Decimal = Decimal("0")
    cae: Optional[str] = None

    class Config:
        from_attributes = True


class FacturaFiltros(BaseModel):
    """Filtros para listado de facturas."""

    cliente_id: Optional[str] = None
    tipo: Optional[str] = None  # factura_a, factura_b, nota_credito_a, etc.
    estado: Optional[str] = None
    estado_pago: Optional[str] = None  # sin_cobrar, parcial, pagada
    fecha_desde: Optional[date] = None
    fecha_hasta: Optional[date] = None
    numero: Optional[str] = None
    page: int = 1
    page_size: int = 20


# ==================== PEDIDOS PENDIENTES DE FACTURAR ====================


class PedidoPendienteFacturar(BaseModel):
    """Fila de la cola de pedidos listos para facturar."""

    id: str
    numero: str
    estado: str
    cliente_id: str
    cliente_razon_social: str
    cliente_condicion_iva: str
    tipo_comprobante_sugerido: str  # "factura_a" | "factura_b"
    fecha_pedido: date
    fecha_entrega_real: Optional[date] = None
    total: Decimal

    class Config:
        from_attributes = True


class FacturarMasivoRequest(BaseModel):
    pedido_ids: List[str] = Field(..., min_length=1)


class FacturarMasivoResponse(BaseModel):
    creadas: List[str]
    errores: List[dict]


# ==================== CONSTANTES ====================

TIPOS_COMPROBANTE = [
    {"value": "factura_a", "label": "Factura A", "letra": "A"},
    {"value": "factura_b", "label": "Factura B", "letra": "B"},
    {"value": "nota_credito_a", "label": "Nota de Crédito A", "letra": "A"},
    {"value": "nota_credito_b", "label": "Nota de Crédito B", "letra": "B"},
    {"value": "nota_debito_a", "label": "Nota de Débito A", "letra": "A"},
    {"value": "nota_debito_b", "label": "Nota de Débito B", "letra": "B"},
]

ESTADOS_FACTURA = [
    {"value": "borrador", "label": "Borrador", "color": "gray"},
    {"value": "autorizada", "label": "Autorizada", "color": "green"},
    {"value": "rechazada", "label": "Rechazada", "color": "red"},
    {"value": "anulada", "label": "Anulada", "color": "orange"},
]

ESTADOS_PAGO = [
    {"value": "sin_cobrar", "label": "Impaga", "color": "red"},
    {"value": "parcial", "label": "Parcial", "color": "amber"},
    {"value": "pagada", "label": "Pagada", "color": "green"},
    {"value": "no_aplica", "label": "N/A", "color": "gray"},
]
