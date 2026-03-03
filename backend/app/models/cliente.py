"""
Modelo de Cliente.
"""

from enum import Enum
from sqlalchemy import Column, String, Boolean, Numeric, Text, Date, Integer
from sqlalchemy.orm import relationship

from app.db.base_class import Base, BaseModelMixin


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

    # Datos básicos
    razon_social = Column(String(200), nullable=False)
    nombre_fantasia = Column(String(200), nullable=True)

    # Datos fiscales
    cuit = Column(String(13), nullable=True, unique=True)  # XX-XXXXXXXX-X
    condicion_iva = Column(String(30), nullable=False, default=CondicionIVA.CONSUMIDOR_FINAL.value)

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
    pedidos = relationship("Pedido", back_populates="cliente", lazy="dynamic")
    movimientos_cuenta = relationship("MovimientoCuentaCorriente", back_populates="cliente", lazy="dynamic")
    lotes = relationship("LoteProduccion", back_populates="cliente", lazy="dynamic")

    def __repr__(self) -> str:
        return f"<Cliente {self.codigo}: {self.razon_social}>"

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
