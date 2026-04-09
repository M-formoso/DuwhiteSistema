"""
Modelo de Canasto/Carro de producción.
"""

from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.db.base import Base
from app.models.base import TimestampMixin


class EstadoCanasto(str, Enum):
    """Estados posibles de un canasto."""
    DISPONIBLE = "disponible"
    EN_USO = "en_uso"
    MANTENIMIENTO = "mantenimiento"
    FUERA_SERVICIO = "fuera_servicio"


class Canasto(Base, TimestampMixin):
    """
    Canasto/Carro de producción.

    DUWHITE tiene 50 carros numerados (1-50) que se usan
    para transportar la ropa entre las distintas etapas
    de producción (lavado, secado, planchado).

    Un lote puede usar múltiples canastos simultáneamente.
    Los canastos se liberan automáticamente al finalizar
    la etapa de planchado.
    """

    __tablename__ = "canastos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Identificación
    numero = Column(Integer, unique=True, nullable=False, index=True)  # 1-50
    codigo = Column(String(10), unique=True, nullable=False)  # C-01, C-02, etc.

    # Estado
    estado = Column(
        String(20),
        nullable=False,
        default=EstadoCanasto.DISPONIBLE.value,
        index=True
    )

    # Ubicación actual (opcional, para tracking físico)
    ubicacion = Column(String(100), nullable=True)

    # Notas
    notas = Column(Text, nullable=True)

    # Estado del registro
    activo = Column(Boolean, default=True, nullable=False)

    # Relaciones
    asignaciones = relationship(
        "LoteCanasto",
        back_populates="canasto",
        order_by="desc(LoteCanasto.fecha_asignacion)"
    )

    def __repr__(self) -> str:
        return f"<Canasto {self.codigo} ({self.estado})>"

    @property
    def esta_disponible(self) -> bool:
        """Indica si el canasto está disponible para usar."""
        return self.estado == EstadoCanasto.DISPONIBLE.value and self.activo

    @property
    def lote_actual(self):
        """Retorna el lote actualmente asignado, si existe."""
        for asignacion in self.asignaciones:
            if asignacion.fecha_liberacion is None and asignacion.activo:
                return asignacion.lote
        return None


class LoteCanasto(Base, TimestampMixin):
    """
    Relación muchos a muchos entre Lotes y Canastos.

    Un lote puede usar múltiples canastos durante su procesamiento,
    y un canasto puede ser reutilizado por diferentes lotes
    (pero solo uno a la vez).

    Se registra en qué etapa se asignó el canasto y cuándo se liberó.
    """

    __tablename__ = "lotes_canastos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Lote
    lote_id = Column(
        UUID(as_uuid=True),
        ForeignKey("lotes_produccion.id"),
        nullable=False,
        index=True
    )

    # Canasto
    canasto_id = Column(
        UUID(as_uuid=True),
        ForeignKey("canastos.id"),
        nullable=False,
        index=True
    )

    # Etapa donde se asignó
    etapa_id = Column(
        UUID(as_uuid=True),
        ForeignKey("etapas_produccion.id"),
        nullable=True
    )

    # Timestamps de asignación
    fecha_asignacion = Column(DateTime, nullable=False, default=datetime.utcnow)
    fecha_liberacion = Column(DateTime, nullable=True)  # NULL = aún asignado

    # Usuario que asignó
    asignado_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=True
    )

    # Usuario que liberó
    liberado_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=True
    )

    # Notas
    notas = Column(Text, nullable=True)

    # Estado del registro
    activo = Column(Boolean, default=True, nullable=False)

    # Relaciones
    lote = relationship("LoteProduccion", back_populates="canastos")
    canasto = relationship("Canasto", back_populates="asignaciones")
    etapa = relationship("EtapaProduccion")
    asignado_por = relationship("Usuario", foreign_keys=[asignado_por_id])
    liberado_por = relationship("Usuario", foreign_keys=[liberado_por_id])

    def __repr__(self) -> str:
        estado = "asignado" if self.fecha_liberacion is None else "liberado"
        return f"<LoteCanasto Lote:{self.lote_id} Canasto:{self.canasto_id} ({estado})>"

    @property
    def esta_activo(self) -> bool:
        """Indica si el canasto está actualmente asignado a este lote."""
        return self.fecha_liberacion is None and self.activo

    @property
    def duracion_minutos(self) -> int:
        """Duración de la asignación en minutos."""
        if not self.fecha_asignacion:
            return 0
        fin = self.fecha_liberacion or datetime.utcnow()
        delta = fin - self.fecha_asignacion
        return int(delta.total_seconds() / 60)
