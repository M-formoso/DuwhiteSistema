"""
Modelo de Cliente.
"""

from enum import Enum
from sqlalchemy import Column, String, Boolean, Numeric, Text, Date, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.base import BaseModelMixin


class TipoCliente(str, Enum):
    """Tipos de cliente."""
    PARTICULAR = "particular"
    EMPRESA = "empresa"
    HOTEL = "hotel"
    RESTAURANTE = "restaurante"
    HOSPITAL = "hospital"
    GIMNASIO = "gimnasio"
    OTRO = "otro"


class CondicionIVA(str, Enum):
    """Condiciones frente al IVA."""
    RESPONSABLE_INSCRIPTO = "responsable_inscripto"
    MONOTRIBUTO = "monotributo"
    EXENTO = "exento"
    CONSUMIDOR_FINAL = "consumidor_final"
    NO_RESPONSABLE = "no_responsable"


class Cliente(Base, BaseModelMixin):
    """
    Modelo de Cliente.
    Almacena información de clientes del lavadero.
    """
    __tablename__ = "clientes"

    # Identificación
    codigo = Column(String(20), unique=True, nullable=False, index=True)
    tipo = Column(String(20), nullable=False, default=TipoCliente.PARTICULAR.value)

    # Datos básicos (nombre operativo del cliente, ej: "Hotel Villa Paz")
    razon_social = Column(String(200), nullable=False)
    nombre_fantasia = Column(String(200), nullable=True)

    # Titular fiscal (CUIT + condición IVA + razón social fiscal viven en TitularFiscal)
    titular_fiscal_id = Column(
        UUID(as_uuid=True),
        ForeignKey("titulares_fiscales.id"),
        nullable=True,
        index=True,
    )

    # Contacto
    email = Column(String(255), nullable=True)
    telefono = Column(String(50), nullable=True)
    celular = Column(String(50), nullable=True)
    contacto_nombre = Column(String(100), nullable=True)  # Persona de contacto
    contacto_cargo = Column(String(100), nullable=True)

    # Dirección
    direccion = Column(String(255), nullable=True)
    ciudad = Column(String(100), nullable=True)
    provincia = Column(String(100), nullable=True, default="Córdoba")
    codigo_postal = Column(String(10), nullable=True)

    # Comercial
    lista_precios_id = Column(String(36), nullable=True)  # FK a lista de precios
    descuento_general = Column(Numeric(5, 2), nullable=True, default=0)  # % descuento
    limite_credito = Column(Numeric(12, 2), nullable=True)
    dias_credito = Column(Integer, nullable=True, default=0)  # Días de crédito

    # Estado de cuenta
    saldo_cuenta_corriente = Column(Numeric(12, 2), nullable=False, default=0)

    # Preferencias
    dia_retiro_preferido = Column(String(20), nullable=True)  # lunes, martes, etc.
    horario_retiro_preferido = Column(String(50), nullable=True)
    requiere_factura = Column(Boolean, default=False)
    enviar_notificaciones = Column(Boolean, default=True)

    # Fechas importantes
    fecha_alta = Column(Date, nullable=True)
    fecha_ultima_compra = Column(Date, nullable=True)

    # Notas
    notas = Column(Text, nullable=True)
    notas_internas = Column(Text, nullable=True)

    # Estado
    activo = Column(Boolean, default=True)

    # Relaciones
    titular_fiscal = relationship("TitularFiscal", back_populates="clientes")
    pedidos = relationship("Pedido", back_populates="cliente", lazy="dynamic")
    movimientos_cuenta = relationship("MovimientoCuentaCorriente", back_populates="cliente", lazy="dynamic")
    lotes = relationship("LoteProduccion", back_populates="cliente", lazy="dynamic")
    usuarios = relationship("Usuario", back_populates="cliente", foreign_keys="Usuario.cliente_id")
    remitos = relationship("Remito", back_populates="cliente", lazy="dynamic")

    def __repr__(self) -> str:
        return f"<Cliente {self.codigo}: {self.razon_social}>"

    @property
    def cuit(self):
        """Compat: el CUIT vive en el titular fiscal."""
        return self.titular_fiscal.cuit if self.titular_fiscal else None

    @property
    def condicion_iva(self) -> str:
        """Compat: la condición IVA vive en el titular fiscal.
        Sin titular, se asume Consumidor Final."""
        return (
            self.titular_fiscal.condicion_iva
            if self.titular_fiscal
            else CondicionIVA.CONSUMIDOR_FINAL.value
        )

    @property
    def nombre_display(self) -> str:
        """Retorna el nombre para mostrar."""
        return self.nombre_fantasia or self.razon_social

    @property
    def tiene_deuda(self) -> bool:
        """Indica si el cliente tiene deuda."""
        return self.saldo_cuenta_corriente > 0

    @property
    def supera_limite_credito(self) -> bool:
        """Indica si el cliente superó su límite de crédito."""
        if self.limite_credito is None:
            return False
        return self.saldo_cuenta_corriente > self.limite_credito
