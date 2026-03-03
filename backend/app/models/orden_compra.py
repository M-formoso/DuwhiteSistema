"""
Modelos de Orden de Compra.
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.db.base import Base
from app.models.base import BaseModelMixin, TimestampMixin


class EstadoOrdenCompra(str, Enum):
    """Estados de una orden de compra."""
    BORRADOR = "borrador"
    PENDIENTE = "pendiente"
    APROBADA = "aprobada"
    ENVIADA = "enviada"
    PARCIAL = "parcial"  # Recepción parcial
    COMPLETADA = "completada"
    CANCELADA = "cancelada"


class OrdenCompra(Base, BaseModelMixin):
    """
    Orden de compra a proveedor.

    Gestiona el ciclo completo desde borrador hasta recepción,
    incluyendo aprobaciones y trazabilidad.
    """

    __tablename__ = "ordenes_compra"

    # Número de orden (autogenerado)
    numero = Column(String(20), unique=True, nullable=False, index=True)

    # Proveedor
    proveedor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("proveedores.id"),
        nullable=False,
        index=True,
    )

    # Estado
    estado = Column(String(20), nullable=False, default=EstadoOrdenCompra.BORRADOR.value, index=True)

    # Fechas
    fecha_emision = Column(Date, nullable=False, default=date.today)
    fecha_entrega_estimada = Column(Date, nullable=True)
    fecha_entrega_real = Column(Date, nullable=True)

    # Montos
    subtotal = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    descuento_porcentaje = Column(Numeric(5, 2), default=Decimal("0"))
    descuento_monto = Column(Numeric(14, 2), default=Decimal("0"))
    iva = Column(Numeric(14, 2), default=Decimal("0"))
    total = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    moneda = Column(String(3), default="ARS")

    # Condiciones
    condicion_pago = Column(String(100), nullable=True)
    plazo_pago_dias = Column(Integer, nullable=True)
    lugar_entrega = Column(String(255), nullable=True)

    # Aprobación
    requiere_aprobacion = Column(Boolean, default=False)
    aprobada_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=True,
    )
    fecha_aprobacion = Column(DateTime, nullable=True)

    # Usuario que creó
    creado_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=False,
    )

    # Notas
    notas = Column(Text, nullable=True)
    notas_internas = Column(Text, nullable=True)

    # Relaciones
    proveedor = relationship("Proveedor", back_populates="ordenes_compra")
    creado_por = relationship("Usuario", foreign_keys=[creado_por_id])
    aprobada_por = relationship("Usuario", foreign_keys=[aprobada_por_id])
    items = relationship(
        "OrdenCompraDetalle",
        back_populates="orden_compra",
        cascade="all, delete-orphan",
    )
    recepciones = relationship("RecepcionCompra", back_populates="orden_compra")

    def __repr__(self) -> str:
        return f"<OrdenCompra {self.numero}>"

    @property
    def puede_editar(self) -> bool:
        """Indica si la orden puede editarse."""
        return self.estado in [
            EstadoOrdenCompra.BORRADOR.value,
            EstadoOrdenCompra.PENDIENTE.value,
        ]

    @property
    def puede_aprobar(self) -> bool:
        """Indica si la orden puede aprobarse."""
        return self.estado == EstadoOrdenCompra.PENDIENTE.value

    @property
    def puede_cancelar(self) -> bool:
        """Indica si la orden puede cancelarse."""
        return self.estado not in [
            EstadoOrdenCompra.COMPLETADA.value,
            EstadoOrdenCompra.CANCELADA.value,
        ]

    def calcular_totales(self) -> None:
        """Recalcula subtotal, IVA y total."""
        self.subtotal = sum(item.subtotal for item in self.items)
        self.descuento_monto = self.subtotal * (self.descuento_porcentaje / 100)
        base_iva = self.subtotal - self.descuento_monto
        self.iva = base_iva * Decimal("0.21")  # IVA 21%
        self.total = base_iva + self.iva


class OrdenCompraDetalle(Base, TimestampMixin):
    """
    Detalle/línea de una orden de compra.
    """

    __tablename__ = "ordenes_compra_detalle"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Orden de compra
    orden_compra_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ordenes_compra.id"),
        nullable=False,
        index=True,
    )

    # Insumo
    insumo_id = Column(
        UUID(as_uuid=True),
        ForeignKey("insumos.id"),
        nullable=False,
    )

    # Producto del proveedor (opcional, para precios de catálogo)
    producto_proveedor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("productos_proveedor.id"),
        nullable=True,
    )

    # Descripción (puede diferir del nombre del insumo)
    descripcion = Column(String(500), nullable=True)

    # Cantidades
    cantidad = Column(Numeric(12, 2), nullable=False)
    unidad = Column(String(20), nullable=False)
    cantidad_recibida = Column(Numeric(12, 2), default=Decimal("0"))

    # Precios
    precio_unitario = Column(Numeric(12, 2), nullable=False)
    descuento_porcentaje = Column(Numeric(5, 2), default=Decimal("0"))
    subtotal = Column(Numeric(14, 2), nullable=False)

    # Número de línea (para ordenamiento)
    numero_linea = Column(Integer, nullable=False, default=1)

    # Notas
    notas = Column(Text, nullable=True)

    # Relaciones
    orden_compra = relationship("OrdenCompra", back_populates="items")
    insumo = relationship("Insumo")
    producto_proveedor = relationship("ProductoProveedor")

    def __repr__(self) -> str:
        return f"<OrdenCompraDetalle {self.orden_compra_id}: {self.cantidad} x {self.insumo_id}>"

    def calcular_subtotal(self) -> None:
        """Calcula el subtotal de la línea."""
        base = self.cantidad * self.precio_unitario
        descuento = base * (self.descuento_porcentaje / 100)
        self.subtotal = base - descuento

    @property
    def cantidad_pendiente(self) -> Decimal:
        """Cantidad pendiente de recibir."""
        return self.cantidad - (self.cantidad_recibida or Decimal("0"))

    @property
    def completamente_recibido(self) -> bool:
        """Indica si se recibió toda la cantidad."""
        return self.cantidad_pendiente <= 0


class RecepcionCompra(Base, TimestampMixin):
    """
    Recepción de mercadería de una orden de compra.
    """

    __tablename__ = "recepciones_compra"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Orden de compra
    orden_compra_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ordenes_compra.id"),
        nullable=False,
        index=True,
    )

    # Número de recepción
    numero = Column(String(20), unique=True, nullable=False)

    # Fecha
    fecha_recepcion = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Documento del proveedor
    remito_numero = Column(String(50), nullable=True)
    factura_numero = Column(String(50), nullable=True)

    # Usuario que recibió
    recibido_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=False,
    )

    # Estado
    estado = Column(String(20), default="completada")  # completada, con_diferencias

    # Notas
    notas = Column(Text, nullable=True)

    # Relaciones
    orden_compra = relationship("OrdenCompra", back_populates="recepciones")
    recibido_por = relationship("Usuario")
    items = relationship(
        "RecepcionCompraDetalle",
        back_populates="recepcion",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<RecepcionCompra {self.numero}>"


class RecepcionCompraDetalle(Base, TimestampMixin):
    """
    Detalle de recepción de mercadería.
    """

    __tablename__ = "recepciones_compra_detalle"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Recepción
    recepcion_id = Column(
        UUID(as_uuid=True),
        ForeignKey("recepciones_compra.id"),
        nullable=False,
    )

    # Detalle de orden original
    orden_detalle_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ordenes_compra_detalle.id"),
        nullable=False,
    )

    # Insumo
    insumo_id = Column(
        UUID(as_uuid=True),
        ForeignKey("insumos.id"),
        nullable=False,
    )

    # Cantidades
    cantidad_esperada = Column(Numeric(12, 2), nullable=False)
    cantidad_recibida = Column(Numeric(12, 2), nullable=False)
    cantidad_rechazada = Column(Numeric(12, 2), default=Decimal("0"))

    # Lote y vencimiento
    numero_lote = Column(String(50), nullable=True)
    fecha_vencimiento = Column(Date, nullable=True)

    # Ubicación de almacenamiento
    ubicacion = Column(String(100), nullable=True)

    # Motivo de rechazo (si aplica)
    motivo_rechazo = Column(Text, nullable=True)

    # Referencia al movimiento de stock generado
    movimiento_stock_id = Column(
        UUID(as_uuid=True),
        ForeignKey("movimientos_stock.id"),
        nullable=True,
    )

    # Relaciones
    recepcion = relationship("RecepcionCompra", back_populates="items")
    orden_detalle = relationship("OrdenCompraDetalle")
    insumo = relationship("Insumo")
    movimiento_stock = relationship("MovimientoStock")

    def __repr__(self) -> str:
        return f"<RecepcionDetalle {self.insumo_id}: {self.cantidad_recibida}>"

    @property
    def tiene_diferencia(self) -> bool:
        """Indica si hay diferencia entre esperado y recibido."""
        return self.cantidad_esperada != self.cantidad_recibida
