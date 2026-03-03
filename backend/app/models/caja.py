"""
Modelo de Caja y Movimientos de Caja.
"""

from enum import Enum
from datetime import date, datetime
from sqlalchemy import Column, String, Boolean, Numeric, Text, Date, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base, BaseModelMixin


class EstadoCaja(str, Enum):
    """Estados de la caja."""
    ABIERTA = "abierta"
    CERRADA = "cerrada"


class TipoMovimientoCaja(str, Enum):
    """Tipos de movimiento de caja."""
    INGRESO = "ingreso"
    EGRESO = "egreso"


class CategoriaMovimiento(str, Enum):
    """Categorías de movimientos."""
    # Ingresos
    VENTA = "venta"
    COBRO_CLIENTE = "cobro_cliente"
    OTRO_INGRESO = "otro_ingreso"
    # Egresos
    PAGO_PROVEEDOR = "pago_proveedor"
    PAGO_EMPLEADO = "pago_empleado"
    GASTO_OPERATIVO = "gasto_operativo"
    COMPRA_INSUMOS = "compra_insumos"
    SERVICIO = "servicio"  # Luz, agua, gas, etc.
    IMPUESTO = "impuesto"
    RETIRO = "retiro"
    OTRO_EGRESO = "otro_egreso"


class Caja(Base, BaseModelMixin):
    """
    Modelo de Caja diaria.
    Representa una sesión de caja (apertura y cierre).
    """
    __tablename__ = "cajas"

    # Identificación
    numero = Column(Integer, unique=True, nullable=False, index=True)

    # Fecha
    fecha = Column(Date, nullable=False, index=True)

    # Estado
    estado = Column(String(20), nullable=False, default=EstadoCaja.ABIERTA.value)

    # Montos
    saldo_inicial = Column(Numeric(12, 2), nullable=False, default=0)
    total_ingresos = Column(Numeric(12, 2), nullable=False, default=0)
    total_egresos = Column(Numeric(12, 2), nullable=False, default=0)
    saldo_final = Column(Numeric(12, 2), nullable=True)  # Se calcula al cerrar
    saldo_real = Column(Numeric(12, 2), nullable=True)  # Conteo físico al cerrar
    diferencia = Column(Numeric(12, 2), nullable=True)  # saldo_real - saldo_final

    # Apertura
    abierta_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    fecha_apertura = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Cierre
    cerrada_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)
    fecha_cierre = Column(DateTime, nullable=True)

    # Observaciones
    observaciones_apertura = Column(Text, nullable=True)
    observaciones_cierre = Column(Text, nullable=True)

    # Relaciones
    abierta_por = relationship("Usuario", foreign_keys=[abierta_por_id])
    cerrada_por = relationship("Usuario", foreign_keys=[cerrada_por_id])
    movimientos = relationship("MovimientoCaja", back_populates="caja", lazy="dynamic")

    def __repr__(self) -> str:
        return f"<Caja {self.numero} - {self.fecha}>"

    @property
    def saldo_calculado(self) -> float:
        """Calcula el saldo actual de la caja."""
        return float(self.saldo_inicial) + float(self.total_ingresos) - float(self.total_egresos)

    def actualizar_totales(self) -> None:
        """Actualiza los totales basándose en los movimientos."""
        from sqlalchemy import func
        from decimal import Decimal

        ingresos = (
            self.movimientos
            .filter(MovimientoCaja.tipo == TipoMovimientoCaja.INGRESO.value)
            .filter(MovimientoCaja.anulado == False)
            .with_entities(func.sum(MovimientoCaja.monto))
            .scalar()
        ) or Decimal("0")

        egresos = (
            self.movimientos
            .filter(MovimientoCaja.tipo == TipoMovimientoCaja.EGRESO.value)
            .filter(MovimientoCaja.anulado == False)
            .with_entities(func.sum(MovimientoCaja.monto))
            .scalar()
        ) or Decimal("0")

        self.total_ingresos = ingresos
        self.total_egresos = egresos


class MovimientoCaja(Base, BaseModelMixin):
    """
    Modelo de Movimiento de Caja.
    Registra cada ingreso o egreso de la caja.
    """
    __tablename__ = "movimientos_caja"

    # Caja
    caja_id = Column(UUID(as_uuid=True), ForeignKey("cajas.id"), nullable=False)

    # Tipo y categoría
    tipo = Column(String(20), nullable=False)  # ingreso, egreso
    categoria = Column(String(30), nullable=False)

    # Descripción
    concepto = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=True)

    # Monto
    monto = Column(Numeric(12, 2), nullable=False)

    # Medio de pago
    medio_pago = Column(String(30), nullable=False, default="efectivo")
    referencia = Column(String(100), nullable=True)  # Nro. comprobante, factura, etc.

    # Referencias opcionales
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=True)
    proveedor_id = Column(UUID(as_uuid=True), ForeignKey("proveedores.id"), nullable=True)
    pedido_id = Column(UUID(as_uuid=True), ForeignKey("pedidos.id"), nullable=True)
    recibo_id = Column(UUID(as_uuid=True), ForeignKey("recibos.id"), nullable=True)

    # Control
    registrado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)

    # Estado
    anulado = Column(Boolean, default=False)
    fecha_anulacion = Column(DateTime, nullable=True)
    motivo_anulacion = Column(Text, nullable=True)
    anulado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)

    # Relaciones
    caja = relationship("Caja", back_populates="movimientos")
    cliente = relationship("Cliente", foreign_keys=[cliente_id])
    proveedor = relationship("Proveedor", foreign_keys=[proveedor_id])
    pedido = relationship("Pedido", foreign_keys=[pedido_id])
    recibo = relationship("Recibo", foreign_keys=[recibo_id])
    registrado_por = relationship("Usuario", foreign_keys=[registrado_por_id])
    anulado_por = relationship("Usuario", foreign_keys=[anulado_por_id])

    def __repr__(self) -> str:
        return f"<MovimientoCaja {self.tipo}: ${self.monto}>"


class GastoRecurrente(Base, BaseModelMixin):
    """
    Modelo para gastos recurrentes (servicios, alquileres, etc.).
    """
    __tablename__ = "gastos_recurrentes"

    # Identificación
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=True)

    # Categoría
    categoria = Column(String(30), nullable=False)

    # Monto
    monto_estimado = Column(Numeric(12, 2), nullable=False)

    # Frecuencia
    frecuencia = Column(String(20), nullable=False)  # mensual, bimestral, trimestral, anual
    dia_vencimiento = Column(Integer, nullable=True)  # Día del mes

    # Proveedor (opcional)
    proveedor_id = Column(UUID(as_uuid=True), ForeignKey("proveedores.id"), nullable=True)

    # Estado
    activo = Column(Boolean, default=True)

    # Fechas
    fecha_proximo_vencimiento = Column(Date, nullable=True)
    fecha_ultimo_pago = Column(Date, nullable=True)

    # Relaciones
    proveedor = relationship("Proveedor")

    def __repr__(self) -> str:
        return f"<GastoRecurrente {self.nombre}>"
