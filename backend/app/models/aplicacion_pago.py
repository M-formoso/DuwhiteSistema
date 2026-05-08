"""
Modelo AplicacionPagoFactura.

Vincula pagos (movimientos de cuenta corriente tipo PAGO) con facturas
emitidas, permitiendo aplicaciones N:M:
  - Un pago puede cubrir varias facturas (compensación múltiple).
  - Una factura puede recibir varios pagos (cobranzas parciales).
  - Un pago puede quedar sin aplicar (anticipo / saldo a favor).

Invariantes:
  - SUM(aplicaciones por pago) <= movimiento_pago.monto.
  - SUM(aplicaciones por factura) <= factura.total.
  - factura.monto_pagado se mantiene == SUM(aplicaciones a esa factura).
"""

from sqlalchemy import Column, Numeric, Date, Text, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.base import BaseModelMixin


class AplicacionPagoFactura(Base, BaseModelMixin):
    """Aplicación de un pago a una factura específica."""

    __tablename__ = "aplicaciones_pago_factura"

    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas.id"), nullable=False, index=True)
    movimiento_pago_id = Column(
        UUID(as_uuid=True),
        ForeignKey("movimientos_cuenta_corriente.id"),
        nullable=False,
        index=True,
    )

    monto_aplicado = Column(Numeric(14, 2), nullable=False)
    fecha_aplicacion = Column(Date, nullable=False)

    notas = Column(Text, nullable=True)
    automatica = Column(Boolean, default=False, nullable=False)  # True si fue por FIFO automático

    registrado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)

    factura = relationship("Factura", foreign_keys=[factura_id])
    movimiento_pago = relationship("MovimientoCuentaCorriente", foreign_keys=[movimiento_pago_id])
    registrado_por = relationship("Usuario", foreign_keys=[registrado_por_id])

    __table_args__ = (
        UniqueConstraint("factura_id", "movimiento_pago_id", name="uq_aplicacion_factura_pago"),
    )

    def __repr__(self) -> str:
        return f"<AplicacionPagoFactura factura={self.factura_id} pago={self.movimiento_pago_id} monto={self.monto_aplicado}>"
