"""
Schemas de Actividad.
"""

from datetime import date, datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field


# Enums como strings
class PrioridadActividadEnum:
    BAJA = "baja"
    MEDIA = "media"
    ALTA = "alta"
    URGENTE = "urgente"


class EstadoActividadEnum:
    PENDIENTE = "pendiente"
    EN_PROGRESO = "en_progreso"
    COMPLETADA = "completada"
    CANCELADA = "cancelada"


class CategoriaActividadEnum:
    PRODUCCION = "produccion"
    MANTENIMIENTO = "mantenimiento"
    ADMINISTRATIVA = "administrativa"
    COMERCIAL = "comercial"
    OTRA = "otra"


# Schemas

class ActividadBase(BaseModel):
    """Base schema para actividad."""
    titulo: str = Field(..., min_length=1, max_length=200)
    descripcion: Optional[str] = None
    categoria: str = Field(default=CategoriaActividadEnum.OTRA, max_length=30)
    prioridad: str = Field(default=PrioridadActividadEnum.MEDIA, max_length=20)
    fecha_limite: Optional[date] = None
    etiquetas: Optional[List[str]] = []
    notas: Optional[str] = None


class ActividadCreate(ActividadBase):
    """Schema para crear actividad."""
    asignado_a_id: Optional[UUID] = None


class ActividadUpdate(BaseModel):
    """Schema para actualizar actividad."""
    titulo: Optional[str] = Field(None, min_length=1, max_length=200)
    descripcion: Optional[str] = None
    categoria: Optional[str] = Field(None, max_length=30)
    prioridad: Optional[str] = Field(None, max_length=20)
    estado: Optional[str] = Field(None, max_length=20)
    fecha_limite: Optional[date] = None
    asignado_a_id: Optional[UUID] = None
    etiquetas: Optional[List[str]] = None
    notas: Optional[str] = None


class ActividadCambiarEstado(BaseModel):
    """Schema para cambiar estado."""
    estado: str = Field(..., max_length=20)


class ActividadInDB(ActividadBase):
    """Schema de actividad en BD."""
    id: UUID
    estado: str
    fecha_completada: Optional[datetime] = None
    creado_por_id: UUID
    asignado_a_id: Optional[UUID] = None
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ActividadResponse(ActividadInDB):
    """Schema de respuesta de actividad."""
    creado_por_nombre: Optional[str] = None
    asignado_a_nombre: Optional[str] = None


class ActividadList(BaseModel):
    """Schema para lista de actividades."""
    id: UUID
    titulo: str
    descripcion: Optional[str] = None
    categoria: str
    prioridad: str
    estado: str
    fecha_limite: Optional[date] = None
    asignado_a_id: Optional[UUID] = None
    asignado_a_nombre: Optional[str] = None
    creado_por_id: UUID
    creado_por_nombre: Optional[str] = None
    etiquetas: List[str] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ActividadesPorEstado(BaseModel):
    """Actividades agrupadas por estado."""
    pendiente: List[ActividadList]
    en_progreso: List[ActividadList]
    completada: List[ActividadList]


class ResumenActividades(BaseModel):
    """Resumen de actividades."""
    total: int
    pendientes: int
    en_progreso: int
    completadas_hoy: int
    vencidas: int
    por_categoria: List[dict]
