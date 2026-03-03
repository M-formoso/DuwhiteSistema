"""
Modelo de Categoría de Insumo.
"""

from sqlalchemy import Boolean, Column, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.db.base import Base
from app.models.base import TimestampMixin


class CategoriaInsumo(Base, TimestampMixin):
    """
    Categoría de insumos/materiales.

    Categorías predefinidas:
    - Productos químicos de lavado
    - Productos de limpieza especial
    - Envases y embalaje
    - Repuestos de maquinaria
    - Materiales de consumo
    - Combustible / Energía
    - Otros
    """

    __tablename__ = "categorias_insumo"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    nombre = Column(String(100), nullable=False, unique=True)
    descripcion = Column(Text, nullable=True)
    orden = Column(Integer, default=0)
    activo = Column(Boolean, default=True, nullable=False)

    # Relaciones
    insumos = relationship("Insumo", back_populates="categoria", lazy="dynamic")

    def __repr__(self) -> str:
        return f"<CategoriaInsumo {self.nombre}>"
