"""
Schemas de Producto de Lavado.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field


# ==================== PRODUCTO LAVADO ====================

class ProductoLavadoBase(BaseModel):
    """Campos base de producto de lavado."""
    codigo: str = Field(..., max_length=20, description="Código único del producto")
    nombre: str = Field(..., max_length=100, description="Nombre del producto")
    descripcion: Optional[str] = None
    categoria: str = Field(..., description="toallas, ropa_cama, manteleria, alfombras, cortinas, otros")
    peso_promedio_kg: Optional[Decimal] = Field(None, ge=0, description="Peso promedio en kg")


class ProductoLavadoCreate(ProductoLavadoBase):
    """Schema para crear producto de lavado."""
    pass


class ProductoLavadoUpdate(BaseModel):
    """Schema para actualizar producto de lavado."""
    codigo: Optional[str] = Field(None, max_length=20)
    nombre: Optional[str] = Field(None, max_length=100)
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    peso_promedio_kg: Optional[Decimal] = Field(None, ge=0)
    activo: Optional[bool] = None


class ProductoLavadoInDB(ProductoLavadoBase):
    """Schema de producto en DB."""
    id: UUID
    activo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductoLavadoResponse(ProductoLavadoBase):
    """Schema de respuesta de producto."""
    id: UUID
    activo: bool

    class Config:
        from_attributes = True


class ProductoLavadoListResponse(BaseModel):
    """Schema para lista de productos."""
    id: UUID
    codigo: str
    nombre: str
    categoria: str
    peso_promedio_kg: Optional[Decimal] = None
    activo: bool

    class Config:
        from_attributes = True


# ==================== PRECIO PRODUCTO LAVADO ====================

class PrecioProductoLavadoBase(BaseModel):
    """Campos base de precio de producto."""
    lista_precios_id: UUID
    producto_id: UUID
    precio_unitario: Decimal = Field(..., ge=0, description="Precio unitario")


class PrecioProductoLavadoCreate(PrecioProductoLavadoBase):
    """Schema para crear precio."""
    pass


class PrecioProductoLavadoUpdate(BaseModel):
    """Schema para actualizar precio."""
    precio_unitario: Optional[Decimal] = Field(None, ge=0)
    activo: Optional[bool] = None


class PrecioProductoLavadoResponse(BaseModel):
    """Schema de respuesta de precio."""
    id: UUID
    lista_precios_id: UUID
    producto_id: UUID
    producto_codigo: Optional[str] = None
    producto_nombre: Optional[str] = None
    precio_unitario: Decimal
    activo: bool

    class Config:
        from_attributes = True


# ==================== PARA CONTEO Y FINALIZACIÓN ====================

class ProductoConteoItem(BaseModel):
    """Item de producto para el formulario de conteo."""
    producto_id: UUID
    producto_codigo: str
    producto_nombre: str
    categoria: str
    precio_unitario: Decimal
    cantidad: int = Field(0, ge=0, description="Cantidad contada")
    subtotal: Decimal = Field(0, ge=0)
    relavar: bool = Field(False, description="Marcar para relavar")
    cantidad_relavar: int = Field(0, ge=0, description="Cantidad a relavar")


class ConteoFinalizacionRequest(BaseModel):
    """Request para finalizar con conteo."""
    items: List[ProductoConteoItem] = Field(..., min_length=1)
    notas: Optional[str] = None
    generar_relevado: bool = Field(False, description="Si hay items a relavar, crear lote de relevado")


class ConteoFinalizacionResponse(BaseModel):
    """Response de finalización con conteo."""
    lote_id: UUID
    lote_numero: str
    remito_id: UUID
    remito_numero: str
    total: Decimal
    movimiento_cc_id: UUID
    # Si se generó relevado
    lote_relevado_id: Optional[UUID] = None
    lote_relevado_numero: Optional[str] = None
    items_relevado: int = 0


# ==================== CONSTANTES ====================

CATEGORIAS_PRODUCTO_LAVADO = [
    {"value": "toallas", "label": "Toallas"},
    {"value": "ropa_cama", "label": "Ropa de Cama"},
    {"value": "manteleria", "label": "Mantelería"},
    {"value": "alfombras", "label": "Alfombras"},
    {"value": "cortinas", "label": "Cortinas"},
    {"value": "otros", "label": "Otros"},
]
