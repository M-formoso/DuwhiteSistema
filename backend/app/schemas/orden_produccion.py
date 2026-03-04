"""
Schemas de Orden de Producción.
"""

from datetime import datetime, date
from typing import Optional, List
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field


# ==================== ORDEN DE PRODUCCIÓN ====================

class OrdenProduccionBase(BaseModel):
    """Base schema para orden de producción."""
    cliente_id: Optional[UUID] = None
    pedido_id: Optional[UUID] = None
    prioridad: str = Field(default="normal")
    fecha_programada_inicio: Optional[date] = None
    fecha_programada_fin: Optional[date] = None
    descripcion: Optional[str] = None
    instrucciones_especiales: Optional[str] = None
    cantidad_prendas_estimada: Optional[int] = None
    peso_estimado_kg: Optional[Decimal] = None
    responsable_id: Optional[UUID] = None
    notas_internas: Optional[str] = None
    notas_produccion: Optional[str] = None


class OrdenProduccionCreate(OrdenProduccionBase):
    """Schema para crear orden de producción."""
    lotes_ids: Optional[List[UUID]] = None  # IDs de lotes existentes a asociar


class OrdenProduccionUpdate(BaseModel):
    """Schema para actualizar orden de producción."""
    cliente_id: Optional[UUID] = None
    prioridad: Optional[str] = None
    fecha_programada_inicio: Optional[date] = None
    fecha_programada_fin: Optional[date] = None
    descripcion: Optional[str] = None
    instrucciones_especiales: Optional[str] = None
    cantidad_prendas_estimada: Optional[int] = None
    peso_estimado_kg: Optional[Decimal] = None
    responsable_id: Optional[UUID] = None
    notas_internas: Optional[str] = None
    notas_produccion: Optional[str] = None


class OrdenProduccionResponse(OrdenProduccionBase):
    """Schema de respuesta de orden de producción."""
    id: UUID
    numero: str
    estado: str
    fecha_emision: date
    fecha_inicio_real: Optional[datetime] = None
    fecha_fin_real: Optional[datetime] = None
    cantidad_prendas_real: Optional[int] = None
    peso_real_kg: Optional[Decimal] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    activo: bool = True

    # Campos calculados
    porcentaje_avance: Optional[int] = None
    esta_atrasada: Optional[bool] = None
    dias_restantes: Optional[int] = None
    cantidad_lotes: Optional[int] = None

    # Relaciones
    cliente_nombre: Optional[str] = None
    responsable_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class OrdenProduccionList(BaseModel):
    """Schema para lista de órdenes."""
    id: UUID
    numero: str
    estado: str
    prioridad: str
    cliente_nombre: Optional[str] = None
    fecha_programada_fin: Optional[date] = None
    porcentaje_avance: int = 0
    esta_atrasada: bool = False
    cantidad_lotes: int = 0

    class Config:
        from_attributes = True


# ==================== ASIGNACIÓN DE EMPLEADOS ====================

class AsignacionEmpleadoBase(BaseModel):
    """Base schema para asignación de empleado."""
    empleado_id: UUID
    etapa_id: Optional[UUID] = None
    fecha_asignacion: date = Field(default_factory=date.today)
    fecha_fin_asignacion: Optional[date] = None
    turno: Optional[str] = None
    horas_estimadas: Optional[Decimal] = None
    notas: Optional[str] = None


class AsignacionEmpleadoCreate(AsignacionEmpleadoBase):
    """Schema para crear asignación."""
    orden_id: UUID


class AsignacionEmpleadoUpdate(BaseModel):
    """Schema para actualizar asignación."""
    etapa_id: Optional[UUID] = None
    fecha_fin_asignacion: Optional[date] = None
    turno: Optional[str] = None
    horas_estimadas: Optional[Decimal] = None
    horas_trabajadas: Optional[Decimal] = None
    notas: Optional[str] = None
    activo: Optional[bool] = None


class AsignacionEmpleadoResponse(AsignacionEmpleadoBase):
    """Schema de respuesta de asignación."""
    id: UUID
    orden_id: UUID
    horas_trabajadas: Optional[Decimal] = None
    activo: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Relaciones
    empleado_nombre: Optional[str] = None
    etapa_nombre: Optional[str] = None
    orden_numero: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== INCIDENCIAS ====================

class IncidenciaBase(BaseModel):
    """Base schema para incidencia."""
    tipo: str
    severidad: str = Field(default="media")
    titulo: str = Field(..., min_length=1, max_length=255)
    descripcion: Optional[str] = None
    lote_id: Optional[UUID] = None
    etapa_id: Optional[UUID] = None


class IncidenciaCreate(IncidenciaBase):
    """Schema para crear incidencia."""
    orden_id: Optional[UUID] = None
    fotos: Optional[List[str]] = None  # Lista de rutas de fotos


class IncidenciaUpdate(BaseModel):
    """Schema para actualizar incidencia."""
    tipo: Optional[str] = None
    severidad: Optional[str] = None
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    estado: Optional[str] = None
    acciones_tomadas: Optional[str] = None
    tiempo_perdido_minutos: Optional[int] = None
    costo_estimado: Optional[Decimal] = None


class IncidenciaResolverRequest(BaseModel):
    """Request para resolver incidencia."""
    acciones_tomadas: str
    tiempo_perdido_minutos: Optional[int] = None
    costo_estimado: Optional[Decimal] = None


class IncidenciaResponse(IncidenciaBase):
    """Schema de respuesta de incidencia."""
    id: UUID
    orden_id: Optional[UUID] = None
    estado: str
    fecha_incidencia: datetime
    fecha_resolucion: Optional[datetime] = None
    acciones_tomadas: Optional[str] = None
    tiempo_perdido_minutos: Optional[int] = None
    costo_estimado: Optional[Decimal] = None
    fotos: Optional[List[str]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Relaciones
    orden_numero: Optional[str] = None
    lote_numero: Optional[str] = None
    etapa_nombre: Optional[str] = None
    reportado_por_nombre: Optional[str] = None
    resuelto_por_nombre: Optional[str] = None

    class Config:
        from_attributes = True
