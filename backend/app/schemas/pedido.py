"""
Schemas de Pedido.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


# ==================== DETALLE PEDIDO ====================

class DetallePedidoBase(BaseModel):
    """Schema base de detalle de pedido."""
    servicio_id: Optional[str] = None
    descripcion: str = Field(..., min_length=1, max_length=255)
    cantidad: Decimal = Field(..., gt=0)
    unidad: str = "unidad"
    precio_unitario: Decimal = Field(..., ge=0)
    descuento_porcentaje: Optional[Decimal] = Field(default=0, ge=0, le=100)
    notas: Optional[str] = None


class DetallePedidoCreate(DetallePedidoBase):
    """Schema para crear detalle."""
    pass


class DetallePedidoResponse(DetallePedidoBase):
    """Schema de respuesta de detalle."""
    id: str
    subtotal: Decimal

    class Config:
        from_attributes = True


# ==================== PEDIDO ====================

class PedidoBase(BaseModel):
    """Schema base de pedido."""
    cliente_id: str
    fecha_pedido: date
    fecha_retiro: Optional[date] = None
    fecha_entrega_estimada: Optional[date] = None
    tipo_entrega: str = "retiro_local"
    direccion_entrega: Optional[str] = None
    horario_entrega: Optional[str] = None
    descuento_porcentaje: Optional[Decimal] = Field(default=0, ge=0, le=100)
    notas: Optional[str] = None
    notas_internas: Optional[str] = None
    observaciones_entrega: Optional[str] = None


class PedidoCreate(PedidoBase):
    """Schema para crear pedido."""
    detalles: List[DetallePedidoCreate] = []


class PedidoUpdate(BaseModel):
    """Schema para actualizar pedido."""
    fecha_retiro: Optional[date] = None
    fecha_entrega_estimada: Optional[date] = None
    tipo_entrega: Optional[str] = None
    direccion_entrega: Optional[str] = None
    horario_entrega: Optional[str] = None
    descuento_porcentaje: Optional[Decimal] = Field(default=None, ge=0, le=100)
    notas: Optional[str] = None
    notas_internas: Optional[str] = None
    observaciones_entrega: Optional[str] = None


class PedidoResponse(PedidoBase):
    """Schema de respuesta de pedido."""
    id: str
    numero: str
    estado: str
    fecha_entrega_real: Optional[date] = None
    fecha_facturacion: Optional[date] = None
    subtotal: Decimal
    descuento_monto: Optional[Decimal] = None
    iva: Decimal
    total: Decimal
    saldo_pendiente: Decimal
    factura_numero: Optional[str] = None
    factura_tipo: Optional[str] = None
    creado_por_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Relaciones
    detalles: List[DetallePedidoResponse] = []

    # Calculados
    cliente_nombre: Optional[str] = None
    creado_por_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class PedidoList(BaseModel):
    """Schema simplificado para listados."""
    id: str
    numero: str
    cliente_id: str
    cliente_nombre: Optional[str] = None
    estado: str
    fecha_pedido: date
    fecha_entrega_estimada: Optional[date] = None
    total: Decimal
    saldo_pendiente: Decimal
    tipo_entrega: str

    class Config:
        from_attributes = True


class CambiarEstadoPedidoRequest(BaseModel):
    """Request para cambiar estado del pedido."""
    estado: str
    observaciones: Optional[str] = None


# ==================== TIPOS Y CONSTANTES ====================

ESTADOS_PEDIDO = [
    {"value": "borrador", "label": "Borrador", "color": "gray"},
    {"value": "confirmado", "label": "Confirmado", "color": "blue"},
    {"value": "en_proceso", "label": "En Proceso", "color": "yellow"},
    {"value": "listo", "label": "Listo", "color": "green"},
    {"value": "entregado", "label": "Entregado", "color": "purple"},
    {"value": "facturado", "label": "Facturado", "color": "teal"},
    {"value": "cancelado", "label": "Cancelado", "color": "red"},
]

TIPOS_ENTREGA = [
    {"value": "retiro_local", "label": "Retiro en Local"},
    {"value": "delivery", "label": "Delivery"},
    {"value": "envio", "label": "Envío"},
]
