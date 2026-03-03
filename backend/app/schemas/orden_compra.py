"""
Schemas de Orden de Compra.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.orden_compra import EstadoOrdenCompra


class OrdenCompraDetalleBase(BaseModel):
    """Base schema para detalle de orden de compra."""
    insumo_id: UUID
    producto_proveedor_id: Optional[UUID] = None
    descripcion: Optional[str] = Field(None, max_length=500)
    cantidad: Decimal = Field(..., gt=0)
    unidad: str = Field(..., max_length=20)
    precio_unitario: Decimal = Field(..., ge=0)
    descuento_porcentaje: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    notas: Optional[str] = None


class OrdenCompraDetalleCreate(OrdenCompraDetalleBase):
    """Schema para crear detalle."""
    pass


class OrdenCompraDetalleUpdate(BaseModel):
    """Schema para actualizar detalle."""
    cantidad: Optional[Decimal] = Field(None, gt=0)
    precio_unitario: Optional[Decimal] = Field(None, ge=0)
    descuento_porcentaje: Optional[Decimal] = Field(None, ge=0, le=100)
    notas: Optional[str] = None


class OrdenCompraDetalleInDB(OrdenCompraDetalleBase):
    """Schema de detalle en BD."""
    id: UUID
    orden_compra_id: UUID
    subtotal: Decimal
    cantidad_recibida: Decimal = Decimal("0")
    numero_linea: int
    created_at: datetime

    class Config:
        from_attributes = True


class OrdenCompraDetalleResponse(OrdenCompraDetalleInDB):
    """Schema de respuesta de detalle."""
    insumo_codigo: Optional[str] = None
    insumo_nombre: Optional[str] = None
    cantidad_pendiente: Decimal = Decimal("0")
    completamente_recibido: bool = False


class OrdenCompraBase(BaseModel):
    """Base schema para orden de compra."""
    proveedor_id: UUID
    fecha_emision: date = Field(default_factory=date.today)
    fecha_entrega_estimada: Optional[date] = None
    descuento_porcentaje: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    moneda: str = Field(default="ARS", max_length=3)
    condicion_pago: Optional[str] = Field(None, max_length=100)
    plazo_pago_dias: Optional[int] = Field(None, ge=0)
    lugar_entrega: Optional[str] = Field(None, max_length=255)
    requiere_aprobacion: bool = False
    notas: Optional[str] = None
    notas_internas: Optional[str] = None


class OrdenCompraCreate(OrdenCompraBase):
    """Schema para crear orden de compra."""
    items: List[OrdenCompraDetalleCreate] = Field(..., min_length=1)


class OrdenCompraUpdate(BaseModel):
    """Schema para actualizar orden de compra."""
    fecha_entrega_estimada: Optional[date] = None
    descuento_porcentaje: Optional[Decimal] = Field(None, ge=0, le=100)
    condicion_pago: Optional[str] = Field(None, max_length=100)
    plazo_pago_dias: Optional[int] = Field(None, ge=0)
    lugar_entrega: Optional[str] = Field(None, max_length=255)
    notas: Optional[str] = None
    notas_internas: Optional[str] = None


class OrdenCompraInDB(OrdenCompraBase):
    """Schema de orden de compra en BD."""
    id: UUID
    numero: str
    estado: EstadoOrdenCompra
    subtotal: Decimal
    descuento_monto: Decimal
    iva: Decimal
    total: Decimal
    fecha_entrega_real: Optional[date] = None
    aprobada_por_id: Optional[UUID] = None
    fecha_aprobacion: Optional[datetime] = None
    creado_por_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool = True

    class Config:
        from_attributes = True


class OrdenCompraResponse(OrdenCompraInDB):
    """Schema de respuesta de orden de compra."""
    proveedor_nombre: Optional[str] = None
    creado_por_nombre: Optional[str] = None
    aprobada_por_nombre: Optional[str] = None
    items: List[OrdenCompraDetalleResponse] = []
    puede_editar: bool = True
    puede_aprobar: bool = False
    puede_cancelar: bool = True


class OrdenCompraList(BaseModel):
    """Schema para lista de órdenes."""
    id: UUID
    numero: str
    proveedor_id: UUID
    proveedor_nombre: Optional[str] = None
    estado: EstadoOrdenCompra
    fecha_emision: date
    total: Decimal
    moneda: str

    class Config:
        from_attributes = True


class AprobarOrdenRequest(BaseModel):
    """Schema para aprobar orden."""
    notas: Optional[str] = None


class CambiarEstadoRequest(BaseModel):
    """Schema para cambiar estado."""
    estado: EstadoOrdenCompra
    notas: Optional[str] = None


# Recepción de compra
class RecepcionCompraDetalleCreate(BaseModel):
    """Schema para crear detalle de recepción."""
    orden_detalle_id: UUID
    insumo_id: UUID
    cantidad_esperada: Decimal = Field(..., gt=0)
    cantidad_recibida: Decimal = Field(..., ge=0)
    cantidad_rechazada: Decimal = Field(default=Decimal("0"), ge=0)
    numero_lote: Optional[str] = Field(None, max_length=50)
    fecha_vencimiento: Optional[date] = None
    ubicacion: Optional[str] = Field(None, max_length=100)
    motivo_rechazo: Optional[str] = None


class RecepcionCompraCreate(BaseModel):
    """Schema para crear recepción."""
    orden_compra_id: UUID
    remito_numero: Optional[str] = Field(None, max_length=50)
    factura_numero: Optional[str] = Field(None, max_length=50)
    notas: Optional[str] = None
    items: List[RecepcionCompraDetalleCreate] = Field(..., min_length=1)


class RecepcionCompraResponse(BaseModel):
    """Schema de respuesta de recepción."""
    id: UUID
    orden_compra_id: UUID
    numero: str
    fecha_recepcion: datetime
    remito_numero: Optional[str] = None
    factura_numero: Optional[str] = None
    recibido_por_id: UUID
    recibido_por_nombre: Optional[str] = None
    estado: str
    notas: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
