"""
Modelo de Producto de Proveedor.
"""

from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Column, Date, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.db.base import Base
from app.models.base import TimestampMixin


class ProductoProveedor(Base, TimestampMixin):
    """
    Catálogo de productos por proveedor.

    Relaciona insumos con proveedores, guardando código del proveedor,
    precio actual y condiciones específicas.
    """

    __tablename__ = "productos_proveedor"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Relaciones principales
    proveedor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("proveedores.id"),
        nullable=False,
        index=True,
    )
    insumo_id = Column(
        UUID(as_uuid=True),
        ForeignKey("insumos.id"),
        nullable=False,
        index=True,
    )

    # Código del producto en el catálogo del proveedor
    codigo_proveedor = Column(String(100), nullable=True)
    nombre_proveedor = Column(String(255), nullable=True)  # Nombre que usa el proveedor

    # Precios
    precio_unitario = Column(Numeric(12, 2), nullable=False)
    moneda = Column(String(3), default="ARS")  # ARS, USD
    precio_con_iva = Column(Boolean, default=True)

    # Unidad de compra (puede diferir de unidad de stock)
    unidad_compra = Column(String(20), nullable=True)  # Caja, Bidon, etc.
    factor_conversion = Column(Numeric(10, 4), default=Decimal("1"))  # Cuántas unidades de stock por unidad de compra

    # Cantidad mínima de compra
    cantidad_minima = Column(Numeric(10, 2), nullable=True)

    # Vigencia del precio
    fecha_precio = Column(Date, nullable=False, default=date.today)
    fecha_vencimiento_precio = Column(Date, nullable=True)

    # Estado
    activo = Column(Boolean, default=True, nullable=False)
    es_preferido = Column(Boolean, default=False)  # Proveedor preferido para este insumo

    # Notas
    notas = Column(Text, nullable=True)

    # Relaciones
    proveedor = relationship("Proveedor", back_populates="productos")
    insumo = relationship("Insumo", back_populates="productos_proveedor")
    historial_precios = relationship(
        "HistorialPreciosProveedor",
        back_populates="producto_proveedor",
        lazy="dynamic",
    )

    def __repr__(self) -> str:
        return f"<ProductoProveedor {self.proveedor_id}: {self.insumo_id}>"

    @property
    def precio_vigente(self) -> bool:
        """Indica si el precio está vigente."""
        if self.fecha_vencimiento_precio is None:
            return True
        return self.fecha_vencimiento_precio >= date.today()

    @property
    def precio_sin_iva(self) -> Decimal:
        """Calcula precio sin IVA (asumiendo 21%)."""
        if not self.precio_con_iva:
            return self.precio_unitario
        return self.precio_unitario / Decimal("1.21")

    @property
    def precio_por_unidad_stock(self) -> Decimal:
        """Precio por unidad de stock (aplicando factor de conversión)."""
        if self.factor_conversion and self.factor_conversion > 0:
            return self.precio_unitario / self.factor_conversion
        return self.precio_unitario
