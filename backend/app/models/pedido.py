"""
Modelo de Pedido y DetallePedido.
"""

from decimal import Decimal
from enum import Enum
from sqlalchemy import Column, String, Boolean, Numeric, Text, Date, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base
from app.models.base import BaseModelMixin


class EstadoPedido(str, Enum):
    """Estados del pedido."""
    BORRADOR = "borrador"
    CONFIRMADO = "confirmado"
    EN_PROCESO = "en_proceso"
    LISTO = "listo"
    ENTREGADO = "entregado"
    FACTURADO = "facturado"
    CANCELADO = "cancelado"


class TipoEntrega(str, Enum):
    """Tipo de entrega."""
    RETIRO_LOCAL = "retiro_local"
    DELIVERY = "delivery"
    ENVIO = "envio"


class Pedido(Base, BaseModelMixin):
    """
    Modelo de Pedido.
    Representa un pedido de servicio de un cliente.
    """
    __tablename__ = "pedidos"

    # Identificación
    numero = Column(String(20), unique=True, nullable=False, index=True)

    # Cliente
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=False)

    # Estado
    estado = Column(String(20), nullable=False, default=EstadoPedido.BORRADOR.value)

    # Fechas
    fecha_pedido = Column(Date, nullable=False)
    fecha_retiro = Column(Date, nullable=True)  # Fecha que se retiró del cliente
    fecha_entrega_estimada = Column(Date, nullable=True)
    fecha_entrega_real = Column(Date, nullable=True)
    fecha_facturacion = Column(Date, nullable=True)

    # Entrega
    tipo_entrega = Column(String(20), nullable=False, default=TipoEntrega.RETIRO_LOCAL.value)
    direccion_entrega = Column(String(255), nullable=True)
    horario_entrega = Column(String(50), nullable=True)

    # Totales
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    descuento_porcentaje = Column(Numeric(5, 2), nullable=True, default=0)
    descuento_monto = Column(Numeric(12, 2), nullable=True, default=0)
    iva = Column(Numeric(12, 2), nullable=False, default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)

    # Pago
    saldo_pendiente = Column(Numeric(12, 2), nullable=False, default=0)

    # Facturación
    factura_numero = Column(String(30), nullable=True)
    factura_tipo = Column(String(1), nullable=True)  # A, B, C

    # Control
    creado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)

    # Observaciones
    notas = Column(Text, nullable=True)
    notas_internas = Column(Text, nullable=True)
    observaciones_entrega = Column(Text, nullable=True)

    # Relaciones
    cliente = relationship("Cliente", back_populates="pedidos")
    creado_por = relationship("Usuario", foreign_keys=[creado_por_id])
    detalles = relationship("DetallePedido", back_populates="pedido", cascade="all, delete-orphan")
    lotes = relationship("LoteProduccion", back_populates="pedido", lazy="dynamic")

    def __repr__(self) -> str:
        return f"<Pedido {self.numero}>"

    def calcular_totales(self) -> None:
        """Calcula los totales del pedido basándose en sus detalles."""
        self.subtotal = sum(d.subtotal for d in self.detalles)

        # Aplicar descuento
        if self.descuento_porcentaje and self.descuento_porcentaje > 0:
            self.descuento_monto = self.subtotal * (self.descuento_porcentaje / 100)

        base_imponible = self.subtotal - (self.descuento_monto or 0)

        # Calcular IVA (21%)
        self.iva = base_imponible * Decimal("0.21")

        self.total = base_imponible + self.iva
        self.saldo_pendiente = self.total


class DetallePedido(Base):
    """
    Modelo de DetallePedido.
    Representa una línea de detalle de un pedido.
    """
    __tablename__ = "detalles_pedido"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Pedido
    pedido_id = Column(UUID(as_uuid=True), ForeignKey("pedidos.id"), nullable=False)

    # Servicio/Producto
    servicio_id = Column(UUID(as_uuid=True), nullable=True)  # FK a servicios si existe
    descripcion = Column(String(255), nullable=False)

    # Cantidades
    cantidad = Column(Numeric(10, 2), nullable=False, default=1)
    unidad = Column(String(20), nullable=False, default="unidad")  # kg, unidad, prenda

    # Precios
    precio_unitario = Column(Numeric(12, 2), nullable=False)
    descuento_porcentaje = Column(Numeric(5, 2), nullable=True, default=0)
    subtotal = Column(Numeric(12, 2), nullable=False)

    # Detalle adicional
    notas = Column(Text, nullable=True)

    # Relaciones
    pedido = relationship("Pedido", back_populates="detalles")

    def __repr__(self) -> str:
        return f"<DetallePedido {self.descripcion}>"

    def calcular_subtotal(self) -> None:
        """Calcula el subtotal de la línea."""
        base = self.cantidad * self.precio_unitario
        if self.descuento_porcentaje and self.descuento_porcentaje > 0:
            base = base * (1 - self.descuento_porcentaje / 100)
        self.subtotal = base
