"""
Schemas de Cuenta Corriente.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


# ==================== MOVIMIENTO CUENTA CORRIENTE ====================

class MovimientoCCBase(BaseModel):
    """Schema base de movimiento de cuenta corriente."""
    tipo: str  # cargo, pago, ajuste
    concepto: str = Field(..., min_length=1, max_length=255)
    monto: Decimal = Field(..., gt=0)
    fecha_movimiento: date
    fecha_vencimiento: Optional[date] = None
    medio_pago: Optional[str] = None
    referencia_pago: Optional[str] = None
    notas: Optional[str] = None


class MovimientoCCCreate(MovimientoCCBase):
    """Schema para crear movimiento."""
    cliente_id: str
    pedido_id: Optional[str] = None
    factura_numero: Optional[str] = None


class MovimientoCCResponse(MovimientoCCBase):
    """Schema de respuesta de movimiento."""
    id: str
    cliente_id: str
    pedido_id: Optional[str] = None
    factura_numero: Optional[str] = None
    recibo_numero: Optional[str] = None
    saldo_anterior: Decimal
    saldo_posterior: Decimal
    registrado_por_id: str
    created_at: datetime

    # Calculados
    registrado_por_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class MovimientoCCList(BaseModel):
    """Schema simplificado para listados."""
    id: str
    tipo: str
    concepto: str
    monto: Decimal
    fecha_movimiento: date
    saldo_posterior: Decimal
    factura_numero: Optional[str] = None
    recibo_numero: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== COBRANZA ====================

class RegistrarCobranzaRequest(BaseModel):
    """Request para registrar una cobranza/ingreso de un cliente."""
    monto: Decimal = Field(..., gt=0)
    fecha: date
    medio_pago: str
    concepto: Optional[str] = None  # Si no se provee, se genera automáticamente
    referencia_pago: Optional[str] = None
    notas: Optional[str] = None
    # Opcional: asociar a pedido o lote
    pedido_id: Optional[str] = None
    lote_id: Optional[str] = None
    # Estado de facturación
    estado_facturacion: str = "sin_facturar"  # sin_facturar, factura_a, factura_b, ticket
    factura_numero: Optional[str] = None  # Si ya está facturado


# ==================== PAGO (LEGACY - mantener compatibilidad) ====================

class RegistrarPagoRequest(BaseModel):
    """Request para registrar un pago."""
    cliente_id: str
    monto: Decimal = Field(..., gt=0)
    fecha: date
    medio_pago: str
    referencia_pago: Optional[str] = None
    notas: Optional[str] = None
    # Opcional: facturas/pedidos a los que aplicar el pago
    aplicar_a_pedidos: Optional[List[str]] = None
    # Nuevos campos opcionales
    pedido_id: Optional[str] = None
    lote_id: Optional[str] = None
    estado_facturacion: str = "sin_facturar"
    factura_numero: Optional[str] = None


class PagoResponse(BaseModel):
    """Respuesta de registro de pago."""
    recibo_numero: str
    monto: Decimal
    saldo_anterior: Decimal
    saldo_posterior: Decimal


# ==================== RECIBO ====================

class DetalleReciboResponse(BaseModel):
    """Schema de detalle de recibo."""
    id: str
    descripcion: str
    monto: Decimal
    pedido_id: Optional[str] = None

    class Config:
        from_attributes = True


class ReciboResponse(BaseModel):
    """Schema de respuesta de recibo."""
    id: str
    numero: str
    cliente_id: str
    fecha: date
    monto_total: Decimal
    medio_pago: str
    referencia_pago: Optional[str] = None
    anulado: str
    fecha_anulacion: Optional[datetime] = None
    motivo_anulacion: Optional[str] = None
    notas: Optional[str] = None
    created_at: datetime

    # Relaciones
    detalles: List[DetalleReciboResponse] = []

    # Calculados
    cliente_nombre: Optional[str] = None
    emitido_por_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class ReciboList(BaseModel):
    """Schema simplificado para listados."""
    id: str
    numero: str
    cliente_nombre: Optional[str] = None
    fecha: date
    monto_total: Decimal
    medio_pago: str
    anulado: str

    class Config:
        from_attributes = True


class AnularReciboRequest(BaseModel):
    """Request para anular recibo."""
    motivo: str = Field(..., min_length=10)


# ==================== ESTADO DE CUENTA ====================

class EstadoCuentaResponse(BaseModel):
    """Resumen del estado de cuenta de un cliente."""
    cliente_id: str
    cliente_nombre: str
    saldo_actual: Decimal
    limite_credito: Optional[Decimal] = None
    credito_disponible: Optional[Decimal] = None
    total_facturado_mes: Decimal
    total_pagado_mes: Decimal
    cantidad_facturas_pendientes: int
    factura_mas_antigua_dias: Optional[int] = None


# ==================== TIPOS Y CONSTANTES ====================

TIPOS_MOVIMIENTO_CC = [
    {"value": "cargo", "label": "Cargo"},
    {"value": "pago", "label": "Pago"},
    {"value": "ajuste", "label": "Ajuste"},
]

MEDIOS_PAGO = [
    {"value": "efectivo", "label": "Efectivo"},
    {"value": "transferencia", "label": "Transferencia Bancaria"},
    {"value": "tarjeta_debito", "label": "Tarjeta de Débito"},
    {"value": "tarjeta_credito", "label": "Tarjeta de Crédito"},
    {"value": "cheque", "label": "Cheque"},
    {"value": "mercado_pago", "label": "Mercado Pago"},
    {"value": "cuenta_corriente", "label": "Cuenta Corriente"},
    {"value": "otro", "label": "Otro"},
]

ESTADOS_FACTURACION = [
    {"value": "sin_facturar", "label": "Sin Facturar"},
    {"value": "factura_a", "label": "Factura A"},
    {"value": "factura_b", "label": "Factura B"},
    {"value": "factura_c", "label": "Factura C"},
    {"value": "ticket", "label": "Ticket"},
]
