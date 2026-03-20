"""
Modelo de Cuenta Corriente y Movimientos.
"""

from enum import Enum
from sqlalchemy import Column, String, Numeric, Text, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base import Base
from app.models.base import BaseModelMixin


class TipoMovimientoCC(str, Enum):
    """Tipos de movimiento en cuenta corriente."""
    CARGO = "cargo"  # Aumenta deuda (factura, nota de débito)
    PAGO = "pago"  # Disminuye deuda (pago, nota de crédito)
    AJUSTE = "ajuste"  # Ajuste manual


class EstadoFacturacion(str, Enum):
    """Estado de facturación del movimiento."""
    SIN_FACTURAR = "sin_facturar"  # No facturado aún
    FACTURA_A = "factura_a"  # Facturado tipo A (Resp. Inscripto)
    FACTURA_B = "factura_b"  # Facturado tipo B (CF, Monotributo)
    FACTURA_C = "factura_c"  # Facturado tipo C
    TICKET = "ticket"  # Ticket/Comprobante simple


class MedioPago(str, Enum):
    """Medios de pago."""
    EFECTIVO = "efectivo"
    TRANSFERENCIA = "transferencia"
    TARJETA_DEBITO = "tarjeta_debito"
    TARJETA_CREDITO = "tarjeta_credito"
    CHEQUE = "cheque"
    MERCADO_PAGO = "mercado_pago"
    CUENTA_CORRIENTE = "cuenta_corriente"
    OTRO = "otro"


class MovimientoCuentaCorriente(Base, BaseModelMixin):
    """
    Modelo de Movimiento de Cuenta Corriente.
    Registra todos los movimientos de la cuenta corriente de un cliente.
    """
    __tablename__ = "movimientos_cuenta_corriente"

    # Cliente
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=False)

    # Tipo y concepto
    tipo = Column(String(20), nullable=False)  # cargo, pago, ajuste
    concepto = Column(String(255), nullable=False)

    # Referencias
    pedido_id = Column(UUID(as_uuid=True), ForeignKey("pedidos.id"), nullable=True)
    lote_id = Column(UUID(as_uuid=True), ForeignKey("lotes.id"), nullable=True)  # Lote de producción asociado
    factura_numero = Column(String(30), nullable=True)
    recibo_numero = Column(String(30), nullable=True)

    # Estado de facturación
    estado_facturacion = Column(String(20), default="sin_facturar")  # sin_facturar, factura_a, factura_b, ticket

    # Montos
    monto = Column(Numeric(12, 2), nullable=False)
    saldo_anterior = Column(Numeric(12, 2), nullable=False)
    saldo_posterior = Column(Numeric(12, 2), nullable=False)

    # Pago (si aplica)
    medio_pago = Column(String(30), nullable=True)
    referencia_pago = Column(String(100), nullable=True)  # Nro transferencia, cheque, etc.

    # Fechas
    fecha_movimiento = Column(Date, nullable=False)
    fecha_vencimiento = Column(Date, nullable=True)

    # Control
    registrado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)

    # Observaciones
    notas = Column(Text, nullable=True)

    # Relaciones
    cliente = relationship("Cliente", back_populates="movimientos_cuenta")
    pedido = relationship("Pedido", foreign_keys=[pedido_id])
    lote = relationship("Lote", foreign_keys=[lote_id])
    registrado_por = relationship("Usuario", foreign_keys=[registrado_por_id])

    def __repr__(self) -> str:
        return f"<MovimientoCC {self.tipo}: ${self.monto}>"


class Recibo(Base, BaseModelMixin):
    """
    Modelo de Recibo de Pago.
    Comprobante de pago emitido al cliente.
    """
    __tablename__ = "recibos"

    # Identificación
    numero = Column(String(20), unique=True, nullable=False, index=True)

    # Cliente
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=False)

    # Fecha
    fecha = Column(Date, nullable=False)

    # Monto
    monto_total = Column(Numeric(12, 2), nullable=False)

    # Medio de pago
    medio_pago = Column(String(30), nullable=False)
    referencia_pago = Column(String(100), nullable=True)

    # Control
    emitido_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)

    # Estado
    anulado = Column(String(1), default="N")  # N = No, S = Sí
    fecha_anulacion = Column(DateTime, nullable=True)
    motivo_anulacion = Column(Text, nullable=True)

    # Observaciones
    notas = Column(Text, nullable=True)

    # Relaciones
    cliente = relationship("Cliente")
    emitido_por = relationship("Usuario", foreign_keys=[emitido_por_id])
    detalles = relationship("DetalleRecibo", back_populates="recibo", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Recibo {self.numero}>"


class DetalleRecibo(Base):
    """
    Detalle de recibo - facturas/cargos que cubre el pago.
    """
    __tablename__ = "detalles_recibo"

    id = Column(UUID(as_uuid=True), primary_key=True)

    # Recibo
    recibo_id = Column(UUID(as_uuid=True), ForeignKey("recibos.id"), nullable=False)

    # Factura/Cargo que se paga
    movimiento_id = Column(UUID(as_uuid=True), ForeignKey("movimientos_cuenta_corriente.id"), nullable=True)
    pedido_id = Column(UUID(as_uuid=True), ForeignKey("pedidos.id"), nullable=True)

    # Descripción
    descripcion = Column(String(255), nullable=False)

    # Monto
    monto = Column(Numeric(12, 2), nullable=False)

    # Relaciones
    recibo = relationship("Recibo", back_populates="detalles")
    movimiento = relationship("MovimientoCuentaCorriente", foreign_keys=[movimiento_id])
    pedido = relationship("Pedido", foreign_keys=[pedido_id])

    def __repr__(self) -> str:
        return f"<DetalleRecibo {self.descripcion}: ${self.monto}>"
