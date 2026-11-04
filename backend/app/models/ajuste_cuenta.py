"""Historial de ajustes manuales al saldo de una cuenta.

Cada vez que la admin edita a mano el `saldo_actual` de una cuenta
(típicamente para corregir un desfase puntual sin cargar un movimiento
contable completo), queda una fila en esta tabla para que haya trazabilidad
de quién, cuándo y por qué. Los movimientos de tesorería normales NO
pasan por acá — eso ya se registra como MovimientoTesoreria.
"""

from sqlalchemy import Column, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.base import BaseModelMixin


class AjusteManualCuenta(Base, BaseModelMixin):
    __tablename__ = "ajustes_manuales_cuenta"

    cuenta_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cuentas_bancarias.id"),
        nullable=False,
        index=True,
    )
    saldo_anterior = Column(Numeric(14, 2), nullable=False)
    saldo_nuevo = Column(Numeric(14, 2), nullable=False)
    diff = Column(Numeric(14, 2), nullable=False)
    motivo = Column(Text, nullable=True)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)

    usuario = relationship("Usuario", foreign_keys=[usuario_id])

    def __repr__(self) -> str:  # pragma: no cover
        return f"<AjusteManualCuenta {self.cuenta_id}: {self.diff:+}>"
