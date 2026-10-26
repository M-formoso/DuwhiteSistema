"""Schemas para el módulo de Recolección (chico que retira la ropa)."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class IniciarRecoleccionRequest(BaseModel):
    cliente_id: UUID
    repartidor_id: UUID = Field(..., description="ID del usuario que valida con PIN como recolector")
    pin: str = Field(..., min_length=4, max_length=6)
    notas: Optional[str] = None
    # Opcional: vehículo de la flota (uuid local — ver /geotrackers/local).
    # Permite ver en el mapa qué pedido está yendo a recolectar cada auto.
    vehiculo_id: Optional[UUID] = Field(
        None, description="ID local del vehículo asignado a la recolección",
    )


class IniciarRecoleccionResponse(BaseModel):
    pedido_id: UUID
    numero: str
    cliente_id: UUID
    cliente_nombre: str
    repartidor_id: UUID
    repartidor_nombre: str
    hora_inicio_retiro: datetime
    mensaje: str


class RecoleccionItem(BaseModel):
    """Item del listado de recolecciones del día."""
    pedido_id: UUID
    numero: str
    cliente_id: UUID
    cliente_nombre: str
    direccion: Optional[str] = None
    hora_inicio_retiro: Optional[datetime] = None
    tiene_lote: bool
