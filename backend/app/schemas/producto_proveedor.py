"""
Schemas de Producto de Proveedor.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ProductoProveedorBase(BaseModel):
    """Base schema para producto de proveedor."""
    proveedor_id: UUID
    insumo_id: UUID
    codigo_proveedor: Optional[str] = Field(None, max_length=100)
    nombre_proveedor: Optional[str] = Field(None, max_length=255)
    precio_unitario: Decimal = Field(..., ge=0)
    moneda: str = Field(default="ARS", max_length=3)
    precio_con_iva: bool = True
    unidad_compra: Optional[str] = Field(None, max_length=20)
    factor_conversion: Decimal = Field(default=Decimal("1"), gt=0)
    cantidad_minima: Optional[Decimal] = Field(None, ge=0)
    fecha_precio: date = Field(default_factory=date.today)
    fecha_vencimiento_precio: Optional[date] = None
    activo: bool = True
    es_preferido: bool = False
    notas: Optional[str] = None


class ProductoProveedorCreate(ProductoProveedorBase):
    """Schema para crear producto de proveedor."""
    pass


class ProductoProveedorUpdate(BaseModel):
    """Schema para actualizar producto de proveedor."""
    codigo_proveedor: Optional[str] = Field(None, max_length=100)
    nombre_proveedor: Optional[str] = Field(None, max_length=255)
    precio_unitario: Optional[Decimal] = Field(None, ge=0)
    moneda: Optional[str] = Field(None, max_length=3)
    precio_con_iva: Optional[bool] = None
    unidad_compra: Optional[str] = Field(None, max_length=20)
    factor_conversion: Optional[Decimal] = Field(None, gt=0)
    cantidad_minima: Optional[Decimal] = Field(None, ge=0)
    fecha_precio: Optional[date] = None
    fecha_vencimiento_precio: Optional[date] = None
    activo: Optional[bool] = None
    es_preferido: Optional[bool] = None
    notas: Optional[str] = None


class ProductoProveedorInDB(ProductoProveedorBase):
    """Schema de producto de proveedor en BD."""
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProductoProveedorResponse(ProductoProveedorInDB):
    """Schema de respuesta de producto de proveedor."""
    proveedor_nombre: Optional[str] = None
    insumo_codigo: Optional[str] = None
    insumo_nombre: Optional[str] = None
    precio_vigente: bool = True
    precio_sin_iva: Optional[Decimal] = None
    precio_por_unidad_stock: Optional[Decimal] = None


class ActualizarPrecioRequest(BaseModel):
    """Schema para actualizar precio de producto."""
    precio_unitario: Decimal = Field(..., ge=0)
    fecha_precio: date = Field(default_factory=date.today)
    fecha_vencimiento_precio: Optional[date] = None
    documento_referencia: Optional[str] = Field(None, max_length=100)
    notas: Optional[str] = None
