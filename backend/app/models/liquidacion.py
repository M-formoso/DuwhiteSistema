"""
Modelo de Liquidación de Pedido.
"""

from decimal import Decimal
from enum import Enum
from sqlalchemy import Column, String, Boolean, Numeric, Text, Date, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base
from app.models.base import BaseModelMixin


class EstadoLiquidacion(str, Enum):
    """Estados de la liquidación."""
    BORRADOR = "borrador"
    CONFIRMADA = "confirmada"
    FACTURADA = "facturada"
    ANULADA = "anulada"


class LiquidacionPedido(Base, BaseModelMixin):
    """
    Modelo de Liquidación de Pedido.
    Representa el cálculo final del servicio prestado con cantidades reales.
    """
    __tablename__ = "liquidaciones_pedido"

    # Identificación
    numero = Column(String(20), unique=True, nullable=False, index=True)

    # Referencias
    pedido_id = Column(UUID(as_uuid=True), ForeignKey("pedidos.id"), nullable=False)
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=False)
    lista_precios_id = Column(UUID(as_uuid=True), ForeignKey("listas_precios.id"), nullable=True)

    # Totales
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    descuento_porcentaje = Column(Numeric(5, 2), nullable=True, default=0)
    descuento_monto = Column(Numeric(12, 2), nullable=True, default=0)
    iva_porcentaje = Column(Numeric(5, 2), nullable=True, default=21)
    iva_monto = Column(Numeric(12, 2), nullable=True, default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)

    # Estado
    estado = Column(String(20), nullable=False, default=EstadoLiquidacion.BORRADOR.value)

    # Fechas
    fecha_liquidacion = Column(Date, nullable=False)

    # Vinculación con cuenta corriente
    movimiento_cc_id = Column(UUID(as_uuid=True), ForeignKey("movimientos_cuenta_corriente.id"), nullable=True)

    # Control
    liquidado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    confirmado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)
    fecha_confirmacion = Column(DateTime, nullable=True)

    # Anulación
    anulado = Column(Boolean, default=False)
    anulado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)
    fecha_anulacion = Column(DateTime, nullable=True)
    motivo_anulacion = Column(Text, nullable=True)

    # Observaciones
    notas = Column(Text, nullable=True)

    # Relaciones
    pedido = relationship("Pedido", foreign_keys=[pedido_id])
    cliente = relationship("Cliente", foreign_keys=[cliente_id])
    lista_precios = relationship("ListaPrecios", foreign_keys=[lista_precios_id])
    movimiento_cc = relationship("MovimientoCuentaCorriente", foreign_keys=[movimiento_cc_id])
    liquidado_por = relationship("Usuario", foreign_keys=[liquidado_por_id])
    confirmado_por = relationship("Usuario", foreign_keys=[confirmado_por_id])
    anulado_por = relationship("Usuario", foreign_keys=[anulado_por_id])
    detalles = relationship("DetalleLiquidacion", back_populates="liquidacion", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<LiquidacionPedido {self.numero}>"

    def calcular_totales(self) -> None:
        """Calcula los totales de la liquidación basándose en sus detalles."""
        self.subtotal = sum(d.subtotal for d in self.detalles) if self.detalles else Decimal("0")

        # Aplicar descuento
        if self.descuento_porcentaje and self.descuento_porcentaje > 0:
            self.descuento_monto = self.subtotal * (self.descuento_porcentaje / 100)
        else:
            self.descuento_monto = Decimal("0")

        base_imponible = self.subtotal - (self.descuento_monto or Decimal("0"))

        # Calcular IVA
        if self.iva_porcentaje and self.iva_porcentaje > 0:
            self.iva_monto = base_imponible * (self.iva_porcentaje / 100)
        else:
            self.iva_monto = Decimal("0")

        self.total = base_imponible + (self.iva_monto or Decimal("0"))

    @property
    def puede_editar(self) -> bool:
        """Solo se puede editar si está en borrador."""
        return self.estado == EstadoLiquidacion.BORRADOR.value and not self.anulado

    @property
    def puede_confirmar(self) -> bool:
        """Solo se puede confirmar si está en borrador."""
        return self.estado == EstadoLiquidacion.BORRADOR.value and not self.anulado

    @property
    def puede_anular(self) -> bool:
        """Se puede anular si no está anulada."""
        return not self.anulado and self.estado != EstadoLiquidacion.ANULADA.value


class DetalleLiquidacion(Base):
    """
    Modelo de Detalle de Liquidación.
    Representa una línea de servicio liquidado.
    """
    __tablename__ = "detalles_liquidacion"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Liquidación
    liquidacion_id = Column(UUID(as_uuid=True), ForeignKey("liquidaciones_pedido.id", ondelete="CASCADE"), nullable=False)

    # Servicio
    servicio_id = Column(UUID(as_uuid=True), ForeignKey("servicios.id"), nullable=True)
    servicio_nombre = Column(String(100), nullable=False)
    descripcion = Column(String(255), nullable=True)

    # Cantidades
    cantidad = Column(Numeric(10, 2), nullable=False)
    unidad = Column(String(20), nullable=False, default="kg")

    # Precios
    precio_unitario = Column(Numeric(12, 2), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)

    # Referencia al lote (opcional)
    lote_id = Column(UUID(as_uuid=True), ForeignKey("lotes_produccion.id"), nullable=True)

    # Orden y notas
    numero_linea = Column(Integer, nullable=False, default=1)
    notas = Column(Text, nullable=True)

    # Relaciones
    liquidacion = relationship("LiquidacionPedido", back_populates="detalles")
    servicio = relationship("Servicio", foreign_keys=[servicio_id])
    lote = relationship("LoteProduccion", foreign_keys=[lote_id])

    def __repr__(self) -> str:
        return f"<DetalleLiquidacion {self.servicio_nombre}: {self.cantidad} {self.unidad}>"

    def calcular_subtotal(self) -> None:
        """Calcula el subtotal de la línea."""
        self.subtotal = self.cantidad * self.precio_unitario
