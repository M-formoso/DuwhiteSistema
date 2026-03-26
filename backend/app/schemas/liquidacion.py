"""
Schemas Pydantic para Liquidación.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field


# ============= DetalleLiquidacion =============

class DetalleLiquidacionBase(BaseModel):
    """Schema base para detalle de liquidación."""
    servicio_id: Optional[UUID] = None
    servicio_nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = None
    cantidad: Decimal = Field(..., ge=0)
    unidad: str = Field(default="kg", max_length=20)
    precio_unitario: Decimal = Field(..., ge=0)
    lote_id: Optional[UUID] = None
    notas: Optional[str] = None


class DetalleLiquidacionCreate(DetalleLiquidacionBase):
    """Schema para crear detalle de liquidación."""
    pass


class DetalleLiquidacionUpdate(BaseModel):
    """Schema para actualizar detalle de liquidación."""
    servicio_id: Optional[UUID] = None
    servicio_nombre: Optional[str] = None
    descripcion: Optional[str] = None
    cantidad: Optional[Decimal] = None
    unidad: Optional[str] = None
    precio_unitario: Optional[Decimal] = None
    lote_id: Optional[UUID] = None
    notas: Optional[str] = None


class DetalleLiquidacion(DetalleLiquidacionBase):
    """Schema de respuesta para detalle de liquidación."""
    id: UUID
    liquidacion_id: UUID
    subtotal: Decimal
    numero_linea: int

    class Config:
        from_attributes = True


# ============= LiquidacionPedido =============

class LiquidacionBase(BaseModel):
    """Schema base para liquidación."""
    pedido_id: UUID
    cliente_id: UUID
    lista_precios_id: Optional[UUID] = None
    fecha_liquidacion: date
    descuento_porcentaje: Optional[Decimal] = Field(default=Decimal("0"), ge=0, le=100)
    iva_porcentaje: Optional[Decimal] = Field(default=Decimal("21"), ge=0, le=100)
    notas: Optional[str] = None


class LiquidacionCreate(LiquidacionBase):
    """Schema para crear liquidación."""
    detalles: List[DetalleLiquidacionCreate] = Field(..., min_length=1)


class LiquidacionUpdate(BaseModel):
    """Schema para actualizar liquidación."""
    lista_precios_id: Optional[UUID] = None
    fecha_liquidacion: Optional[date] = None
    descuento_porcentaje: Optional[Decimal] = None
    iva_porcentaje: Optional[Decimal] = None
    notas: Optional[str] = None
    detalles: Optional[List[DetalleLiquidacionCreate]] = None


class LiquidacionConfirmar(BaseModel):
    """Schema para confirmar liquidación."""
    notas: Optional[str] = None


class LiquidacionAnular(BaseModel):
    """Schema para anular liquidación."""
    motivo: str = Field(..., min_length=1, max_length=500)


class LiquidacionResponse(LiquidacionBase):
    """Schema de respuesta para liquidación."""
    id: UUID
    numero: str
    subtotal: Decimal
    descuento_monto: Optional[Decimal]
    iva_monto: Optional[Decimal]
    total: Decimal
    estado: str
    movimiento_cc_id: Optional[UUID]
    liquidado_por_id: UUID
    confirmado_por_id: Optional[UUID]
    fecha_confirmacion: Optional[datetime]
    anulado: bool
    anulado_por_id: Optional[UUID]
    fecha_anulacion: Optional[datetime]
    motivo_anulacion: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    activo: bool

    # Campos calculados
    puede_editar: bool
    puede_confirmar: bool
    puede_anular: bool

    class Config:
        from_attributes = True


class LiquidacionDetail(LiquidacionResponse):
    """Schema de respuesta con detalles completos."""
    detalles: List[DetalleLiquidacion] = []

    # Datos relacionados
    cliente_nombre: Optional[str] = None
    cliente_cuit: Optional[str] = None
    pedido_numero: Optional[str] = None
    lista_precios_nombre: Optional[str] = None
    liquidado_por_nombre: Optional[str] = None
    confirmado_por_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class LiquidacionList(BaseModel):
    """Schema para listado de liquidaciones."""
    id: UUID
    numero: str
    pedido_id: UUID
    pedido_numero: Optional[str] = None
    cliente_id: UUID
    cliente_nombre: Optional[str] = None
    fecha_liquidacion: date
    subtotal: Decimal
    total: Decimal
    estado: str
    anulado: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============= Schemas adicionales =============

class LiquidacionDesdeControl(BaseModel):
    """Schema para crear liquidación desde control de producción."""
    pedido_id: UUID
    lista_precios_id: Optional[UUID] = None
    descuento_porcentaje: Optional[Decimal] = Field(default=Decimal("0"), ge=0, le=100)
    detalles: List[DetalleLiquidacionCreate] = Field(..., min_length=1)
    notas: Optional[str] = None


class ServicioPrecio(BaseModel):
    """Schema para precio de servicio en una lista."""
    servicio_id: UUID
    servicio_codigo: str
    servicio_nombre: str
    unidad_cobro: str
    precio: Decimal
    precio_minimo: Optional[Decimal] = None


class ListaPreciosParaLiquidacion(BaseModel):
    """Schema con precios de una lista para liquidación."""
    lista_id: UUID
    lista_nombre: str
    servicios: List[ServicioPrecio] = []


class ResumenLiquidaciones(BaseModel):
    """Resumen de liquidaciones para dashboard."""
    total_borradores: int
    total_confirmadas: int
    total_facturadas: int
    total_anuladas: int
    monto_borradores: Decimal
    monto_confirmadas: Decimal
    monto_facturadas: Decimal
