"""
Modelo de Producto de Lavado (catálogo de prendas).
"""

from decimal import Decimal
from enum import Enum

from sqlalchemy import Boolean, Column, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.db.base import Base
from app.models.base import TimestampMixin


class CategoriaProductoLavado(str, Enum):
    """Categorías de productos de lavado."""
    TOALLAS = "toallas"
    ROPA_CAMA = "ropa_cama"
    MANTELERIA = "manteleria"
    ALFOMBRAS = "alfombras"
    CORTINAS = "cortinas"
    OTROS = "otros"


class ProductoLavado(Base, TimestampMixin):
    """
    Producto de lavado (catálogo de prendas).

    Define los tipos de prendas que se lavan en DUWHITE:
    - Toallas (chica, grande, toallón, etc.)
    - Ropa de cama (fundas, sábanas, frazadas, etc.)
    - Mantelería (manteles, servilletas, repasadores, etc.)
    - Alfombras
    - Cortinas
    - Otros (batas, ropa gastronómica, etc.)

    Este catálogo se usa en la etapa de "Conteo y Finalización"
    para convertir los kg procesados a unidades y calcular el precio.
    """

    __tablename__ = "productos_lavado"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Identificación
    codigo = Column(String(20), unique=True, nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=True)

    # Categoría
    categoria = Column(
        String(30),
        nullable=False,
        default=CategoriaProductoLavado.OTROS.value,
        index=True
    )

    # Peso promedio (para sugerencias/estimaciones)
    peso_promedio_kg = Column(Numeric(6, 3), nullable=True)

    # Estado
    activo = Column(Boolean, default=True, nullable=False)

    # Relaciones
    precios = relationship("PrecioProductoLavado", back_populates="producto")
    detalles_remito = relationship("DetalleRemito", back_populates="producto")

    def __repr__(self) -> str:
        return f"<ProductoLavado {self.codigo}: {self.nombre}>"


class PrecioProductoLavado(Base, TimestampMixin):
    """
    Precio de un producto de lavado en una lista de precios.

    Cada cliente tiene asignada una lista de precios,
    y esta tabla define el precio de cada producto en cada lista.
    """

    __tablename__ = "precios_productos_lavado"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Lista de precios
    lista_precios_id = Column(
        UUID(as_uuid=True),
        # ForeignKey("listas_precios.id"),  # Se agregará cuando exista la tabla
        nullable=False,
        index=True
    )

    # Producto
    producto_id = Column(
        UUID(as_uuid=True),
        # ForeignKey("productos_lavado.id"),  # Comentado para evitar circular import
        nullable=False,
        index=True
    )

    # Precio unitario
    precio_unitario = Column(Numeric(12, 2), nullable=False)

    # Estado
    activo = Column(Boolean, default=True, nullable=False)

    # Relaciones
    producto = relationship("ProductoLavado", back_populates="precios")

    def __repr__(self) -> str:
        return f"<PrecioProductoLavado Lista:{self.lista_precios_id} Producto:{self.producto_id} ${self.precio_unitario}>"
