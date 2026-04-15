"""
Schemas de Etapa de Producción.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class EtapaProduccionBase(BaseModel):
    """Base schema para etapa de producción."""
    codigo: str = Field(..., min_length=1, max_length=20)
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = None
    orden: int = Field(default=0, ge=0)
    color: str = Field(default="#00BCD4", pattern=r'^#[0-9A-Fa-f]{6}$')
    es_inicial: bool = False
    es_final: bool = False
    requiere_peso: bool = False
    requiere_maquina: bool = False
    tiempo_estimado_minutos: Optional[int] = Field(None, ge=0)
    activo: bool = True
    # Campos de bifurcación
    permite_bifurcacion: bool = False
    etapa_destino_principal_id: Optional[UUID] = None
    etapa_destino_alternativa_id: Optional[UUID] = None


class EtapaProduccionCreate(EtapaProduccionBase):
    """Schema para crear etapa."""
    pass


class EtapaProduccionUpdate(BaseModel):
    """Schema para actualizar etapa."""
    codigo: Optional[str] = Field(None, min_length=1, max_length=20)
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = None
    orden: Optional[int] = Field(None, ge=0)
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    es_inicial: Optional[bool] = None
    es_final: Optional[bool] = None
    requiere_peso: Optional[bool] = None
    requiere_maquina: Optional[bool] = None
    tiempo_estimado_minutos: Optional[int] = Field(None, ge=0)
    activo: Optional[bool] = None
    # Campos de bifurcación
    permite_bifurcacion: Optional[bool] = None
    etapa_destino_principal_id: Optional[UUID] = None
    etapa_destino_alternativa_id: Optional[UUID] = None


class EtapaProduccionInDB(EtapaProduccionBase):
    """Schema de etapa en BD."""
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EtapaProduccionResponse(EtapaProduccionInDB):
    """Schema de respuesta de etapa."""
    cantidad_lotes_activos: Optional[int] = None
    # Nombres de etapas destino (para UI)
    etapa_destino_principal_nombre: Optional[str] = None
    etapa_destino_alternativa_nombre: Optional[str] = None


class EtapaProduccionList(BaseModel):
    """Schema para lista simplificada."""
    id: UUID
    codigo: str
    nombre: str
    color: str
    orden: int
    tiempo_estimado_minutos: Optional[int] = None

    class Config:
        from_attributes = True
