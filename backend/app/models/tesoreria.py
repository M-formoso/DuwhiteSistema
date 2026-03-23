"""
Modelos de Tesorería - Gestión de Cheques y Valores.
"""

from enum import Enum
from sqlalchemy import Column, String, Boolean, Numeric, Text, Date, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.base import BaseModelMixin


class TipoCheque(str, Enum):
    """Tipos de cheque."""
    FISICO = "fisico"
    ECHEQ = "echeq"


class OrigenCheque(str, Enum):
    """Origen del cheque."""
    RECIBIDO_CLIENTE = "recibido_cliente"
    RECIBIDO_PROVEEDOR = "recibido_proveedor"
    EMITIDO = "emitido"


class EstadoCheque(str, Enum):
    """Estados del cheque."""
    EN_CARTERA = "en_cartera"
    DEPOSITADO = "depositado"
    COBRADO = "cobrado"
    ENTREGADO = "entregado"  # Entregado a tercero como pago
    RECHAZADO = "rechazado"
    ANULADO = "anulado"


class TipoMovimientoTesoreria(str, Enum):
    """Tipos de movimiento de tesorería."""
    INGRESO_EFECTIVO = "ingreso_efectivo"
    INGRESO_TRANSFERENCIA = "ingreso_transferencia"
    INGRESO_CHEQUE = "ingreso_cheque"
    EGRESO_EFECTIVO = "egreso_efectivo"
    EGRESO_TRANSFERENCIA = "egreso_transferencia"
    EGRESO_CHEQUE = "egreso_cheque"
    DEPOSITO_CHEQUE = "deposito_cheque"
    COBRO_CHEQUE = "cobro_cheque"


class Cheque(Base, BaseModelMixin):
    """
    Modelo de Cheque.
    Registra cheques recibidos de clientes o emitidos.
    """
    __tablename__ = "cheques"

    # Identificación
    numero = Column(String(50), nullable=False, index=True)
    tipo = Column(String(20), nullable=False, default=TipoCheque.FISICO.value)
    origen = Column(String(30), nullable=False, default=OrigenCheque.RECIBIDO_CLIENTE.value)
    estado = Column(String(20), nullable=False, default=EstadoCheque.EN_CARTERA.value)

    # Datos del cheque
    monto = Column(Numeric(14, 2), nullable=False)
    fecha_emision = Column(Date, nullable=True)
    fecha_vencimiento = Column(Date, nullable=False)
    fecha_cobro = Column(Date, nullable=True)

    # Entidad bancaria (del cheque)
    banco_origen = Column(String(100), nullable=True)  # Banco que emite el cheque

    # A dónde se deposita/entrega
    cuenta_destino_id = Column(String(36), ForeignKey("cuentas_bancarias.id"), nullable=True)
    banco_destino = Column(String(100), nullable=True)  # Texto libre si no hay cuenta

    # Relaciones con entidades
    cliente_id = Column(String(36), ForeignKey("clientes.id"), nullable=True)
    proveedor_id = Column(String(36), ForeignKey("proveedores.id"), nullable=True)

    # Información adicional
    librador = Column(String(200), nullable=True)  # Quién firma/emite el cheque
    cuit_librador = Column(String(15), nullable=True)

    # Auditoría
    registrado_por_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    cobrado_por_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    fecha_registro = Column(DateTime, nullable=True)

    # Notas
    notas = Column(Text, nullable=True)
    motivo_rechazo = Column(Text, nullable=True)

    # Control
    activo = Column(Boolean, default=True)

    # Relaciones
    cliente = relationship("Cliente", foreign_keys=[cliente_id])
    proveedor = relationship("Proveedor", foreign_keys=[proveedor_id])
    cuenta_destino = relationship("CuentaBancaria", foreign_keys=[cuenta_destino_id])
    registrado_por = relationship("Usuario", foreign_keys=[registrado_por_id])
    cobrado_por = relationship("Usuario", foreign_keys=[cobrado_por_id])
    movimientos = relationship("MovimientoTesoreria", back_populates="cheque")

    def __repr__(self) -> str:
        return f"<Cheque {self.numero}: ${self.monto} - {self.estado}>"


class MovimientoTesoreria(Base, BaseModelMixin):
    """
    Modelo de Movimiento de Tesorería.
    Registra todos los ingresos y egresos con detalle del método de pago.
    """
    __tablename__ = "movimientos_tesoreria"

    # Tipo y concepto
    tipo = Column(String(30), nullable=False)
    concepto = Column(String(200), nullable=False)
    descripcion = Column(Text, nullable=True)

    # Monto
    monto = Column(Numeric(14, 2), nullable=False)
    es_ingreso = Column(Boolean, nullable=False, default=True)

    # Fecha
    fecha_movimiento = Column(Date, nullable=False)
    fecha_valor = Column(Date, nullable=True)  # Fecha efectiva (para cheques diferidos)

    # Método de pago detallado
    metodo_pago = Column(String(30), nullable=False)  # efectivo, transferencia, cheque

    # Si es transferencia
    banco_origen = Column(String(100), nullable=True)
    banco_destino = Column(String(100), nullable=True)
    cuenta_destino_id = Column(String(36), ForeignKey("cuentas_bancarias.id"), nullable=True)
    numero_transferencia = Column(String(100), nullable=True)

    # Si es cheque - referencia
    cheque_id = Column(String(36), ForeignKey("cheques.id"), nullable=True)

    # Relaciones con entidades
    cliente_id = Column(String(36), ForeignKey("clientes.id"), nullable=True)
    proveedor_id = Column(String(36), ForeignKey("proveedores.id"), nullable=True)

    # Auditoría
    registrado_por_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)

    # Notas
    notas = Column(Text, nullable=True)
    comprobante = Column(String(100), nullable=True)

    # Control
    anulado = Column(Boolean, default=False)
    motivo_anulacion = Column(Text, nullable=True)
    anulado_por_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    fecha_anulacion = Column(DateTime, nullable=True)
    activo = Column(Boolean, default=True)

    # Relaciones
    cliente = relationship("Cliente", foreign_keys=[cliente_id])
    proveedor = relationship("Proveedor", foreign_keys=[proveedor_id])
    cuenta_destino = relationship("CuentaBancaria", foreign_keys=[cuenta_destino_id])
    cheque = relationship("Cheque", back_populates="movimientos")
    registrado_por = relationship("Usuario", foreign_keys=[registrado_por_id])
    anulado_por = relationship("Usuario", foreign_keys=[anulado_por_id])

    def __repr__(self) -> str:
        tipo_str = "+" if self.es_ingreso else "-"
        return f"<MovimientoTesoreria {tipo_str}${self.monto}: {self.concepto}>"


# Constantes para frontend
TIPOS_CHEQUE = [
    {"value": "fisico", "label": "Cheque Físico"},
    {"value": "echeq", "label": "E-Cheq"},
]

ORIGENES_CHEQUE = [
    {"value": "recibido_cliente", "label": "Recibido de Cliente"},
    {"value": "recibido_proveedor", "label": "Recibido de Proveedor"},
    {"value": "emitido", "label": "Emitido por Nosotros"},
]

ESTADOS_CHEQUE = [
    {"value": "en_cartera", "label": "En Cartera"},
    {"value": "depositado", "label": "Depositado"},
    {"value": "cobrado", "label": "Cobrado"},
    {"value": "entregado", "label": "Entregado a Tercero"},
    {"value": "rechazado", "label": "Rechazado"},
    {"value": "anulado", "label": "Anulado"},
]

METODOS_PAGO_TESORERIA = [
    {"value": "efectivo", "label": "Efectivo"},
    {"value": "transferencia", "label": "Transferencia"},
    {"value": "cheque", "label": "Cheque"},
]

BANCOS_ARGENTINA = [
    {"value": "MACRO", "label": "Banco Macro"},
    {"value": "SANTANDER", "label": "Santander"},
    {"value": "GALICIA", "label": "Banco Galicia"},
    {"value": "BBVA", "label": "BBVA"},
    {"value": "HSBC", "label": "HSBC"},
    {"value": "ICBC", "label": "ICBC"},
    {"value": "CIUDAD", "label": "Banco Ciudad"},
    {"value": "NACION", "label": "Banco Nación"},
    {"value": "PROVINCIA", "label": "Banco Provincia"},
    {"value": "CREDICOOP", "label": "Credicoop"},
    {"value": "COMAFI", "label": "Comafi"},
    {"value": "SUPERVIELLE", "label": "Supervielle"},
    {"value": "PATAGONIA", "label": "Banco Patagonia"},
    {"value": "HIPOTECARIO", "label": "Banco Hipotecario"},
    {"value": "OTRO", "label": "Otro"},
]
