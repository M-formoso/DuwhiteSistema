"""
Modelo de Máquina de Producción.
"""

from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.db.base import Base
from app.models.base import BaseModelMixin


class TipoMaquina(str):
    """Tipos de máquina."""
    LAVADORA = "lavadora"
    SECADORA = "secadora"
    PLANCHADORA = "planchadora"
    CENTRIFUGA = "centrifuga"
    CALANDRA = "calandra"
    DOBLADORA = "dobladora"
    OTRO = "otro"


class EstadoMaquina(str):
    """Estados de la máquina."""
    DISPONIBLE = "disponible"
    EN_USO = "en_uso"
    MANTENIMIENTO = "mantenimiento"
    FUERA_SERVICIO = "fuera_servicio"


class Maquina(Base, BaseModelMixin):
    """
    Máquina de producción (lavadora, secadora, etc.).
    """

    __tablename__ = "maquinas"

    # Identificación
    codigo = Column(String(20), unique=True, nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    tipo = Column(String(20), nullable=False)  # TipoMaquina

    # Especificaciones
    marca = Column(String(100), nullable=True)
    modelo = Column(String(100), nullable=True)
    numero_serie = Column(String(100), nullable=True)
    capacidad_kg = Column(Numeric(10, 2), nullable=True)

    # Estado
    estado = Column(String(20), default=EstadoMaquina.DISPONIBLE, nullable=False)

    # Ubicación
    ubicacion = Column(String(100), nullable=True)

    # Costos operativos
    costo_hora = Column(Numeric(10, 2), nullable=True)
    consumo_energia_kwh = Column(Numeric(10, 2), nullable=True)
    consumo_agua_litros = Column(Numeric(10, 2), nullable=True)

    # Mantenimiento
    fecha_ultimo_mantenimiento = Column(Date, nullable=True)
    fecha_proximo_mantenimiento = Column(Date, nullable=True)
    horas_uso_totales = Column(Integer, default=0)

    # Notas
    notas = Column(Text, nullable=True)

    # Relaciones
    lotes_etapa = relationship("LoteEtapa", back_populates="maquina")

    def __repr__(self) -> str:
        return f"<Maquina {self.codigo}: {self.nombre}>"

    @property
    def requiere_mantenimiento(self) -> bool:
        """Indica si requiere mantenimiento próximamente."""
        if not self.fecha_proximo_mantenimiento:
            return False
        return self.fecha_proximo_mantenimiento <= date.today()
