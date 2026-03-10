"""
Modelo de Cuenta Corriente de Proveedores y Órdenes de Pago.
"""

from enum import Enum
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Column, String, Boolean, Numeric, Text, Date, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.db.base import Base
from app.models.base import BaseModelMixin, TimestampMixin


class TipoMovimientoCCProveedor(str, Enum):
    """Tipos de movimiento en cuenta corriente proveedor."""
    CARGO = "cargo"           # Aumenta deuda (factura, nota débito)
    PAGO = "pago"             # Disminuye deuda (pago, orden de pago)
    AJUSTE = "ajuste"         # Ajuste manual
    NOTA_CREDITO = "nota_credito"  # Nota de crédito


class EstadoOrdenPago(str, Enum):
    """Estados de una orden de pago (simplificado, sin aprobación)."""
    BORRADOR = "borrador"
    CONFIRMADA = "confirmada"
    PAGADA = "pagada"
    ANULADA = "anulada"


class MovimientoCuentaCorrienteProveedor(Base, BaseModelMixin):
    """
    Modelo de Movimiento de Cuenta Corriente de Proveedor.
    Espeja la estructura de MovimientoCuentaCorriente de clientes.
    """
    __tablename__ = "movimientos_cuenta_corriente_proveedor"

    # Proveedor
    proveedor_id = Column(UUID(as_uuid=True), ForeignKey("proveedores.id"), nullable=False, index=True)

    # Tipo y concepto
    tipo = Column(String(20), nullable=False)  # cargo, pago, ajuste, nota_credito
    concepto = Column(String(255), nullable=False)

    # Referencias a documentos
    orden_compra_id = Column(UUID(as_uuid=True), ForeignKey("ordenes_compra.id"), nullable=True)
    factura_numero = Column(String(30), nullable=True)
    factura_fecha = Column(Date, nullable=True)
    orden_pago_id = Column(UUID(as_uuid=True), ForeignKey("ordenes_pago.id"), nullable=True)
    recepcion_compra_id = Column(UUID(as_uuid=True), ForeignKey("recepciones_compra.id"), nullable=True)

    # Montos
    monto = Column(Numeric(14, 2), nullable=False)
    saldo_anterior = Column(Numeric(14, 2), nullable=False)
    saldo_posterior = Column(Numeric(14, 2), nullable=False)

    # Saldo pendiente de este comprobante (para imputación parcial)
    saldo_comprobante = Column(Numeric(14, 2), nullable=False, default=0)

    # Fechas
    fecha_movimiento = Column(Date, nullable=False)
    fecha_vencimiento = Column(Date, nullable=True)

    # Control
    registrado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)

    # Observaciones
    notas = Column(Text, nullable=True)

    # Relaciones
    proveedor = relationship("Proveedor", back_populates="movimientos_cuenta_proveedor")
    orden_compra = relationship("OrdenCompra", foreign_keys=[orden_compra_id])
    orden_pago = relationship("OrdenPago", back_populates="movimientos_generados", foreign_keys=[orden_pago_id])
    recepcion_compra = relationship("RecepcionCompra", foreign_keys=[recepcion_compra_id])
    registrado_por = relationship("Usuario", foreign_keys=[registrado_por_id])
    imputaciones = relationship(
        "ImputacionPagoProveedor",
        back_populates="movimiento_cargo",
        foreign_keys="ImputacionPagoProveedor.movimiento_cargo_id"
    )

    def __repr__(self) -> str:
        return f"<MovimientoCCProveedor {self.tipo}: ${self.monto}>"


class OrdenPago(Base, BaseModelMixin):
    """
    Orden de Pago a Proveedor.
    Comprobante formal de pago (sin flujo de aprobación).
    """
    __tablename__ = "ordenes_pago"

    # Identificación
    numero = Column(String(20), unique=True, nullable=False, index=True)  # OP-YYYY-XXXXX

    # Proveedor
    proveedor_id = Column(UUID(as_uuid=True), ForeignKey("proveedores.id"), nullable=False, index=True)

    # Fechas
    fecha_emision = Column(Date, nullable=False, default=date.today)
    fecha_pago_programada = Column(Date, nullable=True)
    fecha_pago_real = Column(Date, nullable=True)

    # Estado (simplificado)
    estado = Column(String(30), nullable=False, default=EstadoOrdenPago.BORRADOR.value, index=True)

    # Montos
    monto_total = Column(Numeric(14, 2), nullable=False)
    monto_pagado = Column(Numeric(14, 2), nullable=False, default=0)

    # Medio de pago
    medio_pago = Column(String(30), nullable=True)
    cuenta_bancaria_id = Column(UUID(as_uuid=True), ForeignKey("cuentas_bancarias.id"), nullable=True)
    referencia_pago = Column(String(100), nullable=True)  # Nro transferencia, cheque, etc.

    # Control de usuarios
    creado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    pagado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)

    # Anulación
    anulado = Column(Boolean, default=False)
    fecha_anulacion = Column(DateTime, nullable=True)
    anulado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)
    motivo_anulacion = Column(Text, nullable=True)

    # Observaciones
    concepto = Column(Text, nullable=True)
    notas = Column(Text, nullable=True)

    # Relaciones
    proveedor = relationship("Proveedor", back_populates="ordenes_pago")
    cuenta_bancaria = relationship("CuentaBancaria")
    creado_por = relationship("Usuario", foreign_keys=[creado_por_id])
    pagado_por = relationship("Usuario", foreign_keys=[pagado_por_id])
    anulado_por = relationship("Usuario", foreign_keys=[anulado_por_id])

    # Detalles de imputación
    detalles = relationship("DetalleOrdenPago", back_populates="orden_pago", cascade="all, delete-orphan")
    movimientos_generados = relationship(
        "MovimientoCuentaCorrienteProveedor",
        back_populates="orden_pago",
        foreign_keys="MovimientoCuentaCorrienteProveedor.orden_pago_id"
    )

    def __repr__(self) -> str:
        return f"<OrdenPago {self.numero}>"

    @property
    def puede_editar(self) -> bool:
        """Indica si puede editarse."""
        return self.estado == EstadoOrdenPago.BORRADOR.value and not self.anulado

    @property
    def puede_confirmar(self) -> bool:
        """Indica si puede confirmarse."""
        return self.estado == EstadoOrdenPago.BORRADOR.value and not self.anulado

    @property
    def puede_pagar(self) -> bool:
        """Indica si puede pagarse."""
        return self.estado == EstadoOrdenPago.CONFIRMADA.value and not self.anulado

    @property
    def puede_anular(self) -> bool:
        """Indica si puede anularse."""
        return self.estado != EstadoOrdenPago.PAGADA.value and not self.anulado


class DetalleOrdenPago(Base, TimestampMixin):
    """
    Detalle de orden de pago - facturas/comprobantes que cubre.
    Permite imputación parcial de facturas.
    """
    __tablename__ = "detalles_orden_pago"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Orden de pago
    orden_pago_id = Column(UUID(as_uuid=True), ForeignKey("ordenes_pago.id"), nullable=False, index=True)

    # Movimiento de CC que se paga (factura/cargo)
    movimiento_id = Column(UUID(as_uuid=True), ForeignKey("movimientos_cuenta_corriente_proveedor.id"), nullable=False)

    # Descripción
    descripcion = Column(String(255), nullable=False)

    # Montos
    monto_comprobante = Column(Numeric(14, 2), nullable=False)  # Monto original del comprobante
    monto_pendiente_antes = Column(Numeric(14, 2), nullable=False)  # Saldo pendiente antes de este pago
    monto_a_pagar = Column(Numeric(14, 2), nullable=False)  # Monto que cubre esta OP

    # Número de línea
    numero_linea = Column(Integer, default=1)

    # Relaciones
    orden_pago = relationship("OrdenPago", back_populates="detalles")
    movimiento = relationship("MovimientoCuentaCorrienteProveedor", foreign_keys=[movimiento_id])

    def __repr__(self) -> str:
        return f"<DetalleOP {self.descripcion}: ${self.monto_a_pagar}>"


class ImputacionPagoProveedor(Base, TimestampMixin):
    """
    Tabla de cruce para imputaciones N a M entre pagos y facturas.
    Permite que un pago cubra múltiples facturas y una factura sea cubierta por múltiples pagos.
    """
    __tablename__ = "imputaciones_pago_proveedor"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Movimiento de cargo (factura/débito)
    movimiento_cargo_id = Column(
        UUID(as_uuid=True),
        ForeignKey("movimientos_cuenta_corriente_proveedor.id"),
        nullable=False,
        index=True
    )

    # Orden de Pago que cubre este cargo
    orden_pago_id = Column(UUID(as_uuid=True), ForeignKey("ordenes_pago.id"), nullable=False, index=True)

    # Monto imputado
    monto_imputado = Column(Numeric(14, 2), nullable=False)

    # Fecha de imputación
    fecha_imputacion = Column(Date, nullable=False, default=date.today)

    # Usuario que realizó la imputación
    imputado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)

    # Relaciones
    movimiento_cargo = relationship(
        "MovimientoCuentaCorrienteProveedor",
        back_populates="imputaciones",
        foreign_keys=[movimiento_cargo_id]
    )
    orden_pago = relationship("OrdenPago")
    imputado_por = relationship("Usuario")

    def __repr__(self) -> str:
        return f"<ImputacionPago ${self.monto_imputado}>"
