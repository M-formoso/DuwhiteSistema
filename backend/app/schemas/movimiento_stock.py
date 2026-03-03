"""
Schemas de Movimiento de Stock.
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.movimiento_stock import TipoMovimiento, OrigenMovimiento


class MovimientoStockBase(BaseModel):
    """Base schema para movimiento de stock."""
    insumo_id: UUID
    tipo: TipoMovimiento
    origen: Optional[OrigenMovimiento] = None
    cantidad: Decimal = Field(..., gt=0)
    precio_unitario: Optional[Decimal] = Field(None, ge=0)
    documento_tipo: Optional[str] = Field(None, max_length=50)
    documento_id: Optional[UUID] = None
    numero_documento: Optional[str] = Field(None, max_length=50)
    proveedor_id: Optional[UUID] = None
    numero_lote: Optional[str] = Field(None, max_length=50)
    fecha_vencimiento_lote: Optional[datetime] = None
    notas: Optional[str] = None


class MovimientoStockCreate(MovimientoStockBase):
    """Schema para crear movimiento."""
    fecha_movimiento: Optional[datetime] = None


class MovimientoStockInDB(MovimientoStockBase):
    """Schema de movimiento en BD."""
    id: UUID
    stock_anterior: Decimal
    stock_posterior: Decimal
    costo_total: Optional[Decimal] = None
    usuario_id: UUID
    fecha_movimiento: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class MovimientoStockResponse(MovimientoStockInDB):
    """Schema de respuesta con datos relacionados."""
    insumo_codigo: Optional[str] = None
    insumo_nombre: Optional[str] = None
    proveedor_nombre: Optional[str] = None
    usuario_nombre: Optional[str] = None


class MovimientoStockFilter(BaseModel):
    """Schema para filtrar movimientos."""
    insumo_id: Optional[UUID] = None
    tipo: Optional[TipoMovimiento] = None
    origen: Optional[OrigenMovimiento] = None
    proveedor_id: Optional[UUID] = None
    usuario_id: Optional[UUID] = None
    fecha_desde: Optional[date] = None
    fecha_hasta: Optional[date] = None
    numero_documento: Optional[str] = None


class ResumenMovimientos(BaseModel):
    """Schema para resumen de movimientos."""
    total_entradas: Decimal = Decimal("0")
    total_salidas: Decimal = Decimal("0")
    valor_entradas: Decimal = Decimal("0")
    valor_salidas: Decimal = Decimal("0")
    cantidad_movimientos: int = 0
