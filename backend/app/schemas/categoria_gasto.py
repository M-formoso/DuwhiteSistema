"""Schemas de CategoriaGasto."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CategoriaGastoCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)


class CategoriaGastoUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    activo: Optional[bool] = None


class CategoriaGastoResponse(BaseModel):
    id: str
    nombre: str
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True
