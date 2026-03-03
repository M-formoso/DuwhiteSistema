"""
Modelo de Log de Actividad para auditoría.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class LogActividad(Base):
    """
    Registro de actividad para auditoría del sistema.
    Registra todas las acciones de los usuarios.
    """

    __tablename__ = "logs_actividad"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Usuario que realizó la acción
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)

    # Tipo de acción
    accion = Column(
        String(50),
        nullable=False,
        index=True,
    )  # 'crear', 'editar', 'eliminar', 'login', 'logout', 'ver'

    # Módulo afectado
    modulo = Column(
        String(50),
        nullable=False,
        index=True,
    )  # 'usuarios', 'stock', 'clientes', etc.

    # Entidad específica afectada
    entidad_tipo = Column(String(50), nullable=True)  # 'insumo', 'cliente', 'pedido'
    entidad_id = Column(UUID(as_uuid=True), nullable=True)

    # Datos de auditoría
    datos_anteriores = Column(JSONB, nullable=True)  # Estado antes del cambio
    datos_nuevos = Column(JSONB, nullable=True)  # Estado después del cambio
    descripcion = Column(Text, nullable=True)  # Descripción legible de la acción

    # Metadata
    ip = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)

    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relación
    usuario = relationship("Usuario", back_populates="logs")

    def __repr__(self) -> str:
        return f"<LogActividad {self.accion} en {self.modulo} por {self.usuario_id}>"
