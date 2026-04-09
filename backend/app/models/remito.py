"""
Modelo de Remito de entrega.
"""

from datetime import datetime, date
from decimal import Decimal
from enum import Enum

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.db.base import Base
from app.models.base import TimestampMixin


class EstadoRemito(str, Enum):
    """Estados de un remito."""
    BORRADOR = "borrador"
    EMITIDO = "emitido"
    ENTREGADO = "entregado"
    ANULADO = "anulado"


class TipoRemito(str, Enum):
    """Tipos de remito."""
    NORMAL = "normal"           # Remito completo
    PARCIAL = "parcial"         # Entrega parcial (hay relevado pendiente)
    COMPLEMENTARIO = "complementario"  # Complemento de un remito parcial


class Remito(Base, TimestampMixin):
    """
    Remito de entrega.

    Se genera automáticamente al finalizar la etapa de "Conteo y Finalización".
    Contiene el detalle de productos entregados, cantidades y precios.

    Tipos de remito:
    - NORMAL: Entrega completa del lote
    - PARCIAL: Entrega parcial cuando hay prendas a relavar
    - COMPLEMENTARIO: Se genera cuando termina el relevado

    Al emitir el remito, se crea automáticamente un cargo en la
    cuenta corriente del cliente.
    """

    __tablename__ = "remitos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Número de remito (autogenerado: REM-YYMMDD-XXXX)
    numero = Column(String(20), unique=True, nullable=False, index=True)

    # Lote de producción
    lote_id = Column(
        UUID(as_uuid=True),
        ForeignKey("lotes_produccion.id"),
        nullable=False,
        index=True
    )

    # Cliente
    cliente_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clientes.id"),
        nullable=False,
        index=True
    )

    # Tipo de remito
    tipo = Column(
        String(20),
        nullable=False,
        default=TipoRemito.NORMAL.value
    )

    # Estado
    estado = Column(
        String(20),
        nullable=False,
        default=EstadoRemito.BORRADOR.value,
        index=True
    )

    # Fechas
    fecha_emision = Column(Date, nullable=False, default=date.today)
    fecha_entrega = Column(DateTime, nullable=True)

    # Totales
    peso_total_kg = Column(Numeric(10, 2), nullable=True)
    subtotal = Column(Numeric(14, 2), nullable=False, default=0)
    descuento = Column(Numeric(14, 2), nullable=False, default=0)
    total = Column(Numeric(14, 2), nullable=False, default=0)

    # Referencia a remito padre (para remitos complementarios)
    remito_padre_id = Column(
        UUID(as_uuid=True),
        ForeignKey("remitos.id"),
        nullable=True
    )

    # Movimiento de cuenta corriente generado
    movimiento_cc_id = Column(
        UUID(as_uuid=True),
        ForeignKey("movimientos_cuenta_corriente.id"),
        nullable=True
    )

    # Usuario que emitió
    emitido_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=True
    )

    # Usuario que entregó
    entregado_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=True
    )

    # Notas
    notas = Column(Text, nullable=True)
    notas_entrega = Column(Text, nullable=True)

    # Datos de anulación
    fecha_anulacion = Column(DateTime, nullable=True)
    motivo_anulacion = Column(Text, nullable=True)
    anulado_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=True
    )

    # Estado del registro
    activo = Column(Boolean, default=True, nullable=False)

    # Relaciones
    lote = relationship("LoteProduccion", back_populates="remitos")
    cliente = relationship("Cliente", back_populates="remitos")
    remito_padre = relationship("Remito", remote_side=[id], back_populates="remitos_complementarios")
    remitos_complementarios = relationship("Remito", back_populates="remito_padre")
    movimiento_cc = relationship("MovimientoCuentaCorriente")
    emitido_por = relationship("Usuario", foreign_keys=[emitido_por_id])
    entregado_por = relationship("Usuario", foreign_keys=[entregado_por_id])
    anulado_por = relationship("Usuario", foreign_keys=[anulado_por_id])
    detalles = relationship(
        "DetalleRemito",
        back_populates="remito",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Remito {self.numero} ({self.estado})>"

    @property
    def es_parcial(self) -> bool:
        """Indica si es un remito de entrega parcial."""
        return self.tipo == TipoRemito.PARCIAL.value

    @property
    def es_complementario(self) -> bool:
        """Indica si es un remito complementario."""
        return self.tipo == TipoRemito.COMPLEMENTARIO.value

    @property
    def tiene_complemento(self) -> bool:
        """Indica si tiene remitos complementarios."""
        return len(self.remitos_complementarios) > 0


class DetalleRemito(Base, TimestampMixin):
    """
    Detalle de un remito.

    Cada línea representa un producto con su cantidad y precio.
    """

    __tablename__ = "detalles_remito"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Remito
    remito_id = Column(
        UUID(as_uuid=True),
        ForeignKey("remitos.id"),
        nullable=False,
        index=True
    )

    # Producto de lavado
    producto_id = Column(
        UUID(as_uuid=True),
        ForeignKey("productos_lavado.id"),
        nullable=False
    )

    # Cantidad
    cantidad = Column(Integer, nullable=False)

    # Precio unitario (al momento de la emisión)
    precio_unitario = Column(Numeric(12, 2), nullable=False)

    # Subtotal (cantidad × precio)
    subtotal = Column(Numeric(14, 2), nullable=False)

    # Descripción adicional (opcional)
    descripcion = Column(String(255), nullable=True)

    # Indica si este item está pendiente de relavar
    pendiente_relevado = Column(Boolean, default=False)
    cantidad_relevado = Column(Integer, nullable=True)  # Cantidad que se va a relavar

    # Relaciones
    remito = relationship("Remito", back_populates="detalles")
    producto = relationship("ProductoLavado", back_populates="detalles_remito")

    def __repr__(self) -> str:
        return f"<DetalleRemito {self.remito_id}: {self.cantidad}x {self.producto_id}>"
