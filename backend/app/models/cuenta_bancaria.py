"""
Modelo de Cuenta Bancaria y Movimientos Bancarios.
"""

from enum import Enum
from datetime import date, datetime
from sqlalchemy import Column, String, Boolean, Numeric, Text, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base, BaseModelMixin


class TipoCuenta(str, Enum):
    """Tipos de cuenta bancaria."""
    CAJA_AHORRO = "caja_ahorro"
    CUENTA_CORRIENTE = "cuenta_corriente"


class TipoMovimientoBanco(str, Enum):
    """Tipos de movimiento bancario."""
    DEPOSITO = "deposito"
    EXTRACCION = "extraccion"
    TRANSFERENCIA_ENTRADA = "transferencia_entrada"
    TRANSFERENCIA_SALIDA = "transferencia_salida"
    DEBITO_AUTOMATICO = "debito_automatico"
    CREDITO = "credito"
    COMISION = "comision"
    INTERES = "interes"
    CHEQUE_EMITIDO = "cheque_emitido"
    CHEQUE_DEPOSITADO = "cheque_depositado"


class CuentaBancaria(Base, BaseModelMixin):
    """
    Modelo de Cuenta Bancaria.
    """
    __tablename__ = "cuentas_bancarias"

    # Identificación
    nombre = Column(String(100), nullable=False)  # Nombre identificador
    banco = Column(String(100), nullable=False)
    tipo_cuenta = Column(String(30), nullable=False)
    numero_cuenta = Column(String(50), nullable=False)
    cbu = Column(String(22), nullable=True, unique=True)
    alias = Column(String(50), nullable=True)

    # Titular
    titular = Column(String(200), nullable=False)
    cuit_titular = Column(String(13), nullable=True)

    # Saldo
    saldo_actual = Column(Numeric(14, 2), nullable=False, default=0)
    saldo_disponible = Column(Numeric(14, 2), nullable=True)

    # Estado
    activa = Column(Boolean, default=True)
    es_principal = Column(Boolean, default=False)

    # Notas
    notas = Column(Text, nullable=True)

    # Relaciones
    movimientos = relationship("MovimientoBancario", back_populates="cuenta", lazy="dynamic")

    def __repr__(self) -> str:
        return f"<CuentaBancaria {self.banco} - {self.numero_cuenta}>"


class MovimientoBancario(Base, BaseModelMixin):
    """
    Modelo de Movimiento Bancario.
    """
    __tablename__ = "movimientos_bancarios"

    # Cuenta
    cuenta_id = Column(UUID(as_uuid=True), ForeignKey("cuentas_bancarias.id"), nullable=False)

    # Tipo
    tipo = Column(String(30), nullable=False)

    # Descripción
    concepto = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=True)

    # Montos
    monto = Column(Numeric(14, 2), nullable=False)
    saldo_anterior = Column(Numeric(14, 2), nullable=False)
    saldo_posterior = Column(Numeric(14, 2), nullable=False)

    # Fecha
    fecha_movimiento = Column(Date, nullable=False)
    fecha_valor = Column(Date, nullable=True)  # Fecha valor del banco

    # Referencia
    numero_comprobante = Column(String(50), nullable=True)
    referencia_externa = Column(String(100), nullable=True)  # Ref. del banco

    # Referencias opcionales
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=True)
    proveedor_id = Column(UUID(as_uuid=True), ForeignKey("proveedores.id"), nullable=True)

    # Conciliación
    conciliado = Column(Boolean, default=False)
    fecha_conciliacion = Column(DateTime, nullable=True)

    # Control
    registrado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)

    # Relaciones
    cuenta = relationship("CuentaBancaria", back_populates="movimientos")
    cliente = relationship("Cliente", foreign_keys=[cliente_id])
    proveedor = relationship("Proveedor", foreign_keys=[proveedor_id])
    registrado_por = relationship("Usuario", foreign_keys=[registrado_por_id])

    def __repr__(self) -> str:
        return f"<MovimientoBancario {self.tipo}: ${self.monto}>"
