"""
Modelo para Conciliación Bancaria.
"""

from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Column, String, Numeric, Text, Date, DateTime, ForeignKey, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.db.base import Base
from app.models.base import BaseModelMixin, TimestampMixin


class EstadoConciliacion(str):
    """Estados de una sesión de conciliación."""
    EN_PROCESO = "en_proceso"
    COMPLETADA = "completada"


class ConciliacionBancaria(Base, BaseModelMixin):
    """
    Sesión de conciliación bancaria.
    Agrupa los movimientos bancarios de un período para conciliarlos con extracto.
    """
    __tablename__ = "conciliaciones_bancarias"

    # Cuenta bancaria
    cuenta_id = Column(UUID(as_uuid=True), ForeignKey("cuentas_bancarias.id"), nullable=False, index=True)

    # Período
    fecha_desde = Column(Date, nullable=False)
    fecha_hasta = Column(Date, nullable=False)

    # Estado
    estado = Column(String(20), nullable=False, default=EstadoConciliacion.EN_PROCESO)

    # Saldos
    saldo_extracto_bancario = Column(Numeric(14, 2), nullable=True)  # Saldo según extracto del banco
    saldo_sistema = Column(Numeric(14, 2), nullable=True)  # Saldo según sistema
    diferencia = Column(Numeric(14, 2), nullable=True)  # Diferencia a conciliar

    # Resumen de conciliación
    cantidad_conciliados = Column(Integer, default=0)
    monto_conciliado = Column(Numeric(14, 2), default=0)

    # Control
    creado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    finalizado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)
    fecha_finalizacion = Column(DateTime, nullable=True)

    # Notas
    notas = Column(Text, nullable=True)

    # Relaciones
    cuenta = relationship("CuentaBancaria")
    creado_por = relationship("Usuario", foreign_keys=[creado_por_id])
    finalizado_por = relationship("Usuario", foreign_keys=[finalizado_por_id])
    items = relationship("ItemConciliacion", back_populates="conciliacion", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Conciliacion {self.cuenta_id} {self.fecha_desde} - {self.fecha_hasta}>"

    @property
    def esta_finalizada(self) -> bool:
        """Indica si la conciliación está finalizada."""
        return self.estado == EstadoConciliacion.COMPLETADA

    @property
    def cantidad_pendientes(self) -> int:
        """Cantidad de items pendientes de conciliar."""
        if not self.items:
            return 0
        return len([item for item in self.items if not item.conciliado])


class ItemConciliacion(Base, TimestampMixin):
    """
    Item individual de conciliación.
    Vincula un movimiento bancario con la sesión de conciliación.
    """
    __tablename__ = "items_conciliacion"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Conciliación
    conciliacion_id = Column(UUID(as_uuid=True), ForeignKey("conciliaciones_bancarias.id"), nullable=False, index=True)

    # Movimiento bancario
    movimiento_bancario_id = Column(UUID(as_uuid=True), ForeignKey("movimientos_bancarios.id"), nullable=False)

    # Estado de conciliación
    conciliado = Column(Boolean, default=False)
    fecha_conciliacion = Column(DateTime, nullable=True)
    conciliado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)

    # Referencia de extracto (opcional, para matchear con extracto bancario)
    referencia_extracto = Column(String(100), nullable=True)

    # Notas
    notas = Column(Text, nullable=True)

    # Relaciones
    conciliacion = relationship("ConciliacionBancaria", back_populates="items")
    movimiento_bancario = relationship("MovimientoBancario")
    conciliado_por = relationship("Usuario")

    def __repr__(self) -> str:
        return f"<ItemConciliacion {self.movimiento_bancario_id} - {'OK' if self.conciliado else 'Pendiente'}>"
