"""
Schemas de Categoría de Insumo.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CategoriaInsumoBase(BaseModel):
    """Base schema para categoría de insumo."""
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = None
    orden: int = Field(default=0, ge=0)
    activo: bool = True


class CategoriaInsumoCreate(CategoriaInsumoBase):
    """Schema para crear categoría."""
    pass


class CategoriaInsumoUpdate(BaseModel):
    """Schema para actualizar categoría."""
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = None
    orden: Optional[int] = Field(None, ge=0)
    activo: Optional[bool] = None


class CategoriaInsumoInDB(CategoriaInsumoBase):
    """Schema de categoría en BD."""
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CategoriaInsumoResponse(CategoriaInsumoInDB):
    """Schema de respuesta de categoría."""
    cantidad_insumos: Optional[int] = None


class CategoriaInsumoList(BaseModel):
    """Schema para lista simplificada (dropdowns)."""
    id: UUID
    nombre: str

    class Config:
        from_attributes = True
