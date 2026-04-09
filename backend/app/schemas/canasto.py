"""
Schemas de Canasto.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field


# ==================== CANASTO ====================

class CanastoBase(BaseModel):
    """Campos base de canasto."""
    numero: int = Field(..., ge=1, le=50, description="Número del canasto (1-50)")
    codigo: str = Field(..., max_length=10, description="Código del canasto (C-01, C-02, etc.)")
    ubicacion: Optional[str] = Field(None, max_length=100)
    notas: Optional[str] = None


class CanastoCreate(BaseModel):
    """Schema para crear canasto (normalmente no se usa, ya vienen precargados)."""
    numero: int = Field(..., ge=1, le=50)
    codigo: Optional[str] = None
    ubicacion: Optional[str] = None
    notas: Optional[str] = None


class CanastoUpdate(BaseModel):
    """Schema para actualizar canasto."""
    ubicacion: Optional[str] = Field(None, max_length=100)
    notas: Optional[str] = None
    estado: Optional[str] = Field(None, description="disponible, en_uso, mantenimiento, fuera_servicio")


class CanastoInDB(CanastoBase):
    """Schema de canasto en DB."""
    id: UUID
    estado: str
    activo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CanastoResponse(BaseModel):
    """Schema de respuesta de canasto."""
    id: UUID
    numero: int
    codigo: str
    estado: str
    ubicacion: Optional[str] = None
    notas: Optional[str] = None
    activo: bool
    # Info del lote actual si está en uso
    lote_actual_id: Optional[UUID] = None
    lote_actual_numero: Optional[str] = None
    cliente_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class CanastoListResponse(BaseModel):
    """Schema de lista de canastos."""
    id: UUID
    numero: int
    codigo: str
    estado: str
    lote_actual_numero: Optional[str] = None
    cliente_nombre: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== LOTE-CANASTO ====================

class LoteCanastoBase(BaseModel):
    """Campos base de asignación lote-canasto."""
    lote_id: UUID
    canasto_id: UUID
    etapa_id: Optional[UUID] = None
    notas: Optional[str] = None


class AsignarCanastosRequest(BaseModel):
    """Request para asignar canastos a un lote."""
    canasto_ids: List[UUID] = Field(..., min_length=1, description="IDs de canastos a asignar")
    etapa_id: Optional[UUID] = Field(None, description="Etapa donde se asignan")
    notas: Optional[str] = None


class LiberarCanastosRequest(BaseModel):
    """Request para liberar canastos de un lote."""
    canasto_ids: Optional[List[UUID]] = Field(None, description="IDs específicos a liberar (None = todos)")
    notas: Optional[str] = None


class LoteCanastoResponse(BaseModel):
    """Schema de respuesta de asignación lote-canasto."""
    id: UUID
    lote_id: UUID
    canasto_id: UUID
    canasto_numero: int
    canasto_codigo: str
    etapa_id: Optional[UUID] = None
    etapa_nombre: Optional[str] = None
    fecha_asignacion: datetime
    fecha_liberacion: Optional[datetime] = None
    asignado_por_nombre: Optional[str] = None
    liberado_por_nombre: Optional[str] = None
    duracion_minutos: int = 0
    esta_activo: bool = True
    notas: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== GRID DE CANASTOS ====================

class CanastoGridItem(BaseModel):
    """Item para el grid visual de canastos."""
    id: UUID
    numero: int
    codigo: str
    estado: str
    esta_disponible: bool
    lote_id: Optional[UUID] = None
    lote_numero: Optional[str] = None
    cliente_id: Optional[UUID] = None
    cliente_nombre: Optional[str] = None
    etapa_actual: Optional[str] = None
    tiempo_en_uso_minutos: Optional[int] = None


class CanastosGridResponse(BaseModel):
    """Respuesta del grid completo de canastos."""
    canastos: List[CanastoGridItem]
    resumen: dict  # disponibles, en_uso, mantenimiento, fuera_servicio


# ==================== CONSTANTES ====================

ESTADOS_CANASTO = [
    {"value": "disponible", "label": "Disponible", "color": "#22C55E"},
    {"value": "en_uso", "label": "En Uso", "color": "#F59E0B"},
    {"value": "mantenimiento", "label": "Mantenimiento", "color": "#F97316"},
    {"value": "fuera_servicio", "label": "Fuera de Servicio", "color": "#EF4444"},
]
