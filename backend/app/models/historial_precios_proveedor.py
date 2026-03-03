"""
Modelo de Historial de Precios de Proveedor.
"""

from datetime import date
from decimal import Decimal

from sqlalchemy import Column, Date, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.db.base import Base
from app.models.base import TimestampMixin


class HistorialPreciosProveedor(Base, TimestampMixin):
    """
    Historial de precios de productos por proveedor.

    Mantiene un registro de cambios de precios para análisis
    de tendencias y comparación.
    """

    __tablename__ = "historial_precios_proveedor"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Referencia al producto del proveedor
    producto_proveedor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("productos_proveedor.id"),
        nullable=False,
        index=True,
    )

    # Precios
    precio_anterior = Column(Numeric(12, 2), nullable=True)
    precio_nuevo = Column(Numeric(12, 2), nullable=False)
    moneda = Column(String(3), default="ARS")

    # Variación
    variacion_porcentual = Column(Numeric(8, 2), nullable=True)

    # Fecha del cambio
    fecha_cambio = Column(Date, nullable=False, default=date.today, index=True)

    # Documento de referencia (lista de precios, cotización)
    documento_referencia = Column(String(100), nullable=True)

    # Usuario que registró el cambio
    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=True,
    )

    # Notas
    notas = Column(Text, nullable=True)

    # Relaciones
    producto_proveedor = relationship("ProductoProveedor", back_populates="historial_precios")
    usuario = relationship("Usuario")

    def __repr__(self) -> str:
        return f"<HistorialPrecios {self.producto_proveedor_id}: {self.precio_nuevo}>"

    @staticmethod
    def calcular_variacion(precio_anterior: Decimal, precio_nuevo: Decimal) -> Decimal:
        """Calcula el porcentaje de variación entre dos precios."""
        if precio_anterior is None or precio_anterior == 0:
            return Decimal("0")
        return ((precio_nuevo - precio_anterior) / precio_anterior) * 100
