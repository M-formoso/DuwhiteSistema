"""
Schemas de Máquina.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class MaquinaBase(BaseModel):
    """Base schema para máquina."""
    codigo: str = Field(..., min_length=1, max_length=20)
    nombre: str = Field(..., min_length=1, max_length=100)
    tipo: str = Field(..., max_length=20)
    marca: Optional[str] = Field(None, max_length=100)
    modelo: Optional[str] = Field(None, max_length=100)
    numero_serie: Optional[str] = Field(None, max_length=100)
    capacidad_kg: Optional[Decimal] = Field(None, ge=0)
    estado: str = Field(default="disponible", max_length=20)
    ubicacion: Optional[str] = Field(None, max_length=100)
    costo_hora: Optional[Decimal] = Field(None, ge=0)
    consumo_energia_kwh: Optional[Decimal] = Field(None, ge=0)
    consumo_agua_litros: Optional[Decimal] = Field(None, ge=0)
    fecha_ultimo_mantenimiento: Optional[date] = None
    fecha_proximo_mantenimiento: Optional[date] = None
    horas_uso_totales: int = Field(default=0, ge=0)
    notas: Optional[str] = None


class MaquinaCreate(MaquinaBase):
    """Schema para crear máquina."""
    pass


class MaquinaUpdate(BaseModel):
    """Schema para actualizar máquina."""
    codigo: Optional[str] = Field(None, min_length=1, max_length=20)
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    tipo: Optional[str] = Field(None, max_length=20)
    marca: Optional[str] = Field(None, max_length=100)
    modelo: Optional[str] = Field(None, max_length=100)
    numero_serie: Optional[str] = Field(None, max_length=100)
    capacidad_kg: Optional[Decimal] = Field(None, ge=0)
    estado: Optional[str] = Field(None, max_length=20)
    ubicacion: Optional[str] = Field(None, max_length=100)
    costo_hora: Optional[Decimal] = Field(None, ge=0)
    consumo_energia_kwh: Optional[Decimal] = Field(None, ge=0)
    consumo_agua_litros: Optional[Decimal] = Field(None, ge=0)
    fecha_ultimo_mantenimiento: Optional[date] = None
    fecha_proximo_mantenimiento: Optional[date] = None
    horas_uso_totales: Optional[int] = Field(None, ge=0)
    notas: Optional[str] = None


class MaquinaInDB(MaquinaBase):
    """Schema de máquina en BD."""
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool = True

    class Config:
        from_attributes = True


class MaquinaResponse(MaquinaInDB):
    """Schema de respuesta de máquina."""
    requiere_mantenimiento: bool = False


class MaquinaList(BaseModel):
    """Schema para lista simplificada."""
    id: UUID
    codigo: str
    nombre: str
    tipo: str
    estado: str
    capacidad_kg: Optional[Decimal] = None

    class Config:
        from_attributes = True
