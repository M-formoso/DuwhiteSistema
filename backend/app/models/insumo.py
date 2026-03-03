"""
Modelo de Insumo (Stock).
"""

from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Column, Date, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.db.base import Base
from app.models.base import BaseModelMixin


class Insumo(Base, BaseModelMixin):
    """
    Insumo/material del inventario.

    Representa productos químicos, materiales de consumo,
    repuestos y otros insumos necesarios para la operación.
    """

    __tablename__ = "insumos"

    # Identificación
    codigo = Column(String(50), unique=True, nullable=False, index=True)
    codigo_barras = Column(String(100), nullable=True)
    nombre = Column(String(255), nullable=False, index=True)

    # Categorización
    categoria_id = Column(
        UUID(as_uuid=True),
        ForeignKey("categorias_insumo.id"),
        nullable=True,
    )
    subcategoria = Column(String(100), nullable=True)

    # Unidad de medida
    unidad = Column(String(20), nullable=False)  # litros, kg, unidades, metros

    # Stock
    stock_actual = Column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    stock_minimo = Column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    stock_maximo = Column(Numeric(12, 2), nullable=True)

    # Precios
    precio_unitario_costo = Column(Numeric(12, 2), nullable=True)  # Último precio compra
    precio_promedio_ponderado = Column(Numeric(12, 2), nullable=True)

    # Proveedor habitual
    proveedor_habitual_id = Column(
        UUID(as_uuid=True),
        ForeignKey("proveedores.id"),
        nullable=True,
    )

    # Ubicación y vencimiento
    ubicacion_deposito = Column(String(100), nullable=True)
    fecha_vencimiento = Column(Date, nullable=True)

    # Media
    foto = Column(String(500), nullable=True)

    # Notas
    notas = Column(Text, nullable=True)

    # Relaciones
    categoria = relationship("CategoriaInsumo", back_populates="insumos")
    proveedor_habitual = relationship("Proveedor", back_populates="insumos_habituales")
    movimientos = relationship("MovimientoStock", back_populates="insumo", lazy="dynamic")
    productos_proveedor = relationship("ProductoProveedor", back_populates="insumo")

    def __repr__(self) -> str:
        return f"<Insumo {self.codigo}: {self.nombre}>"

    @property
    def stock_bajo(self) -> bool:
        """Indica si el stock está por debajo del mínimo."""
        return self.stock_actual <= self.stock_minimo

    @property
    def sin_stock(self) -> bool:
        """Indica si no hay stock."""
        return self.stock_actual <= 0

    @property
    def sobrestock(self) -> bool:
        """Indica si hay sobrestock (stock > máximo)."""
        if self.stock_maximo is None:
            return False
        return self.stock_actual > self.stock_maximo

    @property
    def proximo_a_vencer(self) -> bool:
        """Indica si vence en los próximos 30 días."""
        if self.fecha_vencimiento is None:
            return False
        from datetime import timedelta
        return self.fecha_vencimiento <= date.today() + timedelta(days=30)

    @property
    def valor_stock(self) -> Decimal:
        """Calcula el valor total del stock."""
        precio = self.precio_promedio_ponderado or self.precio_unitario_costo or Decimal("0")
        return self.stock_actual * precio
