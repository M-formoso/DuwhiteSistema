"""
Modelo de Movimiento de Stock.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.db.base import Base
from app.models.base import TimestampMixin


class TipoMovimiento(str, Enum):
    """Tipos de movimiento de stock."""
    ENTRADA = "entrada"
    SALIDA = "salida"
    AJUSTE_POSITIVO = "ajuste_positivo"
    AJUSTE_NEGATIVO = "ajuste_negativo"
    TRANSFERENCIA = "transferencia"


class OrigenMovimiento(str, Enum):
    """Origen del movimiento."""
    COMPRA = "compra"
    PRODUCCION = "produccion"
    DEVOLUCION = "devolucion"
    AJUSTE_INVENTARIO = "ajuste_inventario"
    MERMA = "merma"
    VENCIMIENTO = "vencimiento"
    INICIAL = "inicial"


class MovimientoStock(Base, TimestampMixin):
    """
    Registro de movimientos de stock (entradas/salidas).

    Cada movimiento afecta el stock de un insumo y mantiene
    trazabilidad completa de quién, cuándo, por qué y cuánto.
    """

    __tablename__ = "movimientos_stock"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Insumo afectado
    insumo_id = Column(
        UUID(as_uuid=True),
        ForeignKey("insumos.id"),
        nullable=False,
        index=True,
    )

    # Tipo y origen
    tipo = Column(String(20), nullable=False, index=True)  # TipoMovimiento
    origen = Column(String(30), nullable=True)  # OrigenMovimiento

    # Cantidades
    cantidad = Column(Numeric(12, 2), nullable=False)
    stock_anterior = Column(Numeric(12, 2), nullable=False)
    stock_posterior = Column(Numeric(12, 2), nullable=False)

    # Precios (para valorización)
    precio_unitario = Column(Numeric(12, 2), nullable=True)
    costo_total = Column(Numeric(12, 2), nullable=True)

    # Referencia a documento origen
    documento_tipo = Column(String(50), nullable=True)  # orden_compra, produccion, etc.
    documento_id = Column(UUID(as_uuid=True), nullable=True)
    numero_documento = Column(String(50), nullable=True)

    # Proveedor (para entradas por compra)
    proveedor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("proveedores.id"),
        nullable=True,
    )

    # Usuario que realizó el movimiento
    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=False,
    )

    # Fecha efectiva del movimiento
    fecha_movimiento = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Lote y vencimiento (para trazabilidad)
    numero_lote = Column(String(50), nullable=True)
    fecha_vencimiento_lote = Column(DateTime, nullable=True)

    # Notas
    notas = Column(Text, nullable=True)

    # Relaciones
    insumo = relationship("Insumo", back_populates="movimientos")
    proveedor = relationship("Proveedor", back_populates="movimientos_stock")
    usuario = relationship("Usuario", back_populates="movimientos_stock")

    def __repr__(self) -> str:
        return f"<MovimientoStock {self.tipo}: {self.cantidad} de {self.insumo_id}>"

    @property
    def es_entrada(self) -> bool:
        """Indica si es un movimiento de entrada."""
        return self.tipo in [TipoMovimiento.ENTRADA.value, TipoMovimiento.AJUSTE_POSITIVO.value]

    @property
    def es_salida(self) -> bool:
        """Indica si es un movimiento de salida."""
        return self.tipo in [TipoMovimiento.SALIDA.value, TipoMovimiento.AJUSTE_NEGATIVO.value]
