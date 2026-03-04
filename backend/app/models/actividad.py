"""
Modelo de Actividad/Tarea Interna.
"""

from enum import Enum
from sqlalchemy import Column, String, Boolean, Text, Date, DateTime, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base
from app.models.base import BaseModelMixin


class PrioridadActividad(str, Enum):
    """Prioridades de actividad."""
    BAJA = "baja"
    MEDIA = "media"
    ALTA = "alta"
    URGENTE = "urgente"


class EstadoActividad(str, Enum):
    """Estados de actividad."""
    PENDIENTE = "pendiente"
    EN_PROGRESO = "en_progreso"
    COMPLETADA = "completada"
    CANCELADA = "cancelada"


class CategoriaActividad(str, Enum):
    """Categorías de actividad."""
    PRODUCCION = "produccion"
    MANTENIMIENTO = "mantenimiento"
    ADMINISTRATIVA = "administrativa"
    COMERCIAL = "comercial"
    OTRA = "otra"


class Actividad(Base, BaseModelMixin):
    """
    Modelo de Actividad/Tarea Interna.
    Representa tareas que los usuarios deben completar.
    """
    __tablename__ = "actividades"

    # Contenido
    titulo = Column(String(200), nullable=False)
    descripcion = Column(Text, nullable=True)

    # Clasificación
    categoria = Column(
        String(30),
        nullable=False,
        default=CategoriaActividad.OTRA.value
    )
    prioridad = Column(
        String(20),
        nullable=False,
        default=PrioridadActividad.MEDIA.value
    )
    estado = Column(
        String(20),
        nullable=False,
        default=EstadoActividad.PENDIENTE.value
    )

    # Fechas
    fecha_limite = Column(Date, nullable=True)
    fecha_completada = Column(DateTime, nullable=True)

    # Usuarios
    creado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    asignado_a_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)

    # Etiquetas (array de strings)
    etiquetas = Column(ARRAY(String), nullable=True, default=[])

    # Notas adicionales
    notas = Column(Text, nullable=True)

    # Relaciones
    creado_por = relationship(
        "Usuario",
        foreign_keys=[creado_por_id],
        backref="actividades_creadas"
    )
    asignado_a = relationship(
        "Usuario",
        foreign_keys=[asignado_a_id],
        backref="actividades_asignadas"
    )

    def __repr__(self) -> str:
        return f"<Actividad {self.titulo[:30]}>"
