"""
Schemas comunes compartidos entre módulos.
"""

from typing import Generic, List, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, Field

# TypeVar para respuestas genéricas
T = TypeVar("T")


class MessageResponse(BaseModel):
    """Respuesta simple con mensaje."""

    message: str


class PaginatedResponse(BaseModel, Generic[T]):
    """Respuesta paginada genérica."""

    items: List[T]
    total: int
    skip: int
    limit: int

    @property
    def pages(self) -> int:
        """Calcula el número total de páginas."""
        if self.limit == 0:
            return 0
        return (self.total + self.limit - 1) // self.limit

    @property
    def has_next(self) -> bool:
        """Indica si hay más páginas."""
        return self.skip + self.limit < self.total

    @property
    def has_prev(self) -> bool:
        """Indica si hay páginas anteriores."""
        return self.skip > 0


class PaginationParams(BaseModel):
    """Parámetros de paginación."""

    skip: int = Field(default=0, ge=0, description="Registros a omitir")
    limit: int = Field(default=20, ge=1, le=100, description="Límite de registros")


class FilterParams(BaseModel):
    """Parámetros de filtrado comunes."""

    search: Optional[str] = Field(default=None, description="Búsqueda por texto")
    activo: Optional[bool] = Field(default=None, description="Filtrar por estado activo")
    order_by: Optional[str] = Field(default="created_at", description="Campo para ordenar")
    order_dir: Optional[str] = Field(default="desc", description="Dirección: asc o desc")


class IDResponse(BaseModel):
    """Respuesta con solo ID."""

    id: UUID
