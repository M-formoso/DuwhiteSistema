"""
Schemas de Órdenes de Pago.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


# ==================== DETALLE ORDEN PAGO ====================

class DetalleOrdenPagoCreate(BaseModel):
    """Item de factura a incluir en la OP."""
    movimiento_id: str
    monto_a_pagar: Decimal = Field(..., gt=0)
    descripcion: Optional[str] = None


class DetalleOrdenPagoResponse(BaseModel):
    """Schema de respuesta de detalle."""
    id: str
    movimiento_id: str
    descripcion: str
    monto_comprobante: Decimal
    monto_pendiente_antes: Decimal
    monto_a_pagar: Decimal
    numero_linea: int

    # Info del comprobante original
    factura_numero: Optional[str] = None
    fecha_vencimiento: Optional[date] = None

    class Config:
        from_attributes = True


# ==================== ORDEN DE PAGO ====================

class OrdenPagoBase(BaseModel):
    """Schema base de orden de pago."""
    proveedor_id: str
    fecha_emision: date
    fecha_pago_programada: Optional[date] = None
    concepto: Optional[str] = None
    notas: Optional[str] = None


class OrdenPagoCreate(OrdenPagoBase):
    """Schema para crear OP."""
    detalles: List[DetalleOrdenPagoCreate] = Field(..., min_length=1)
    # El monto_total se calcula de los detalles


class OrdenPagoUpdate(BaseModel):
    """Schema para actualizar OP (solo en borrador)."""
    fecha_pago_programada: Optional[date] = None
    concepto: Optional[str] = None
    notas: Optional[str] = None
    detalles: Optional[List[DetalleOrdenPagoCreate]] = None


class OrdenPagoResponse(OrdenPagoBase):
    """Schema de respuesta de OP."""
    id: str
    numero: str
    estado: str
    monto_total: Decimal
    monto_pagado: Decimal
    medio_pago: Optional[str] = None
    cuenta_bancaria_id: Optional[str] = None
    referencia_pago: Optional[str] = None

    # Control
    creado_por_id: str
    pagado_por_id: Optional[str] = None
    fecha_pago_real: Optional[date] = None

    # Anulación
    anulado: bool
    fecha_anulacion: Optional[datetime] = None
    motivo_anulacion: Optional[str] = None

    created_at: datetime

    # Detalles
    detalles: List[DetalleOrdenPagoResponse] = []

    # Calculados
    proveedor_nombre: Optional[str] = None
    proveedor_cuit: Optional[str] = None
    creado_por_nombre: Optional[str] = None
    pagado_por_nombre: Optional[str] = None
    cuenta_bancaria_nombre: Optional[str] = None

    # Propiedades calculadas
    puede_editar: bool = False
    puede_confirmar: bool = False
    puede_pagar: bool = False
    puede_anular: bool = False

    class Config:
        from_attributes = True


class OrdenPagoList(BaseModel):
    """Schema simplificado para listados."""
    id: str
    numero: str
    proveedor_id: str
    proveedor_nombre: Optional[str] = None
    fecha_emision: date
    fecha_pago_programada: Optional[date] = None
    estado: str
    monto_total: Decimal
    anulado: bool

    class Config:
        from_attributes = True


# ==================== ACCIONES ====================

class ConfirmarOrdenPagoRequest(BaseModel):
    """Request para confirmar OP."""
    notas: Optional[str] = None


class PagarOrdenPagoRequest(BaseModel):
    """Request para efectuar el pago."""
    fecha_pago: date
    medio_pago: str
    cuenta_bancaria_id: Optional[str] = None  # Requerido si no es efectivo
    referencia_pago: Optional[str] = None


class AnularOrdenPagoRequest(BaseModel):
    """Request para anular OP."""
    motivo: str = Field(..., min_length=10)


# ==================== CONSTANTES ====================

ESTADOS_ORDEN_PAGO = [
    {"value": "borrador", "label": "Borrador", "color": "gray"},
    {"value": "confirmada", "label": "Confirmada", "color": "blue"},
    {"value": "pagada", "label": "Pagada", "color": "green"},
    {"value": "anulada", "label": "Anulada", "color": "red"},
]

MEDIOS_PAGO = [
    {"value": "efectivo", "label": "Efectivo"},
    {"value": "transferencia", "label": "Transferencia Bancaria"},
    {"value": "cheque", "label": "Cheque"},
    {"value": "tarjeta_debito", "label": "Tarjeta de Débito"},
    {"value": "tarjeta_credito", "label": "Tarjeta de Crédito"},
    {"value": "mercadopago", "label": "MercadoPago"},
    {"value": "otro", "label": "Otro"},
]
