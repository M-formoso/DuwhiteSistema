"""
Modelo de Proveedor.
"""

from sqlalchemy import Boolean, Column, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4
from decimal import Decimal

from app.db.base import Base
from app.models.base import BaseModelMixin


class Proveedor(Base, BaseModelMixin):
    """
    Proveedor de insumos/materiales.

    Gestiona la información de contacto, condiciones comerciales
    y relación con productos e historiales de precios.
    """

    __tablename__ = "proveedores"

    # Identificación
    razon_social = Column(String(255), nullable=False, index=True)
    nombre_fantasia = Column(String(255), nullable=True)
    cuit = Column(String(13), unique=True, nullable=False, index=True)  # XX-XXXXXXXX-X

    # Contacto
    direccion = Column(String(500), nullable=True)
    ciudad = Column(String(100), nullable=True)
    provincia = Column(String(100), default="Córdoba")
    codigo_postal = Column(String(10), nullable=True)
    telefono = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    sitio_web = Column(String(255), nullable=True)

    # Contacto principal
    contacto_nombre = Column(String(255), nullable=True)
    contacto_telefono = Column(String(50), nullable=True)
    contacto_email = Column(String(255), nullable=True)

    # Condiciones comerciales
    condicion_pago = Column(String(100), nullable=True)  # Contado, 30 días, etc.
    dias_entrega_estimados = Column(String(50), nullable=True)
    descuento_habitual = Column(String(50), nullable=True)

    # Categoría de productos
    rubro = Column(String(100), nullable=True)  # Químicos, Repuestos, etc.

    # Calificación (1-5 estrellas)
    calificacion = Column(Integer, nullable=True)  # 1 a 5

    # Estado
    activo = Column(Boolean, default=True, nullable=False)

    # Cuenta Corriente
    saldo_cuenta_corriente = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))

    # Notas
    notas = Column(Text, nullable=True)

    # Relaciones
    insumos_habituales = relationship("Insumo", back_populates="proveedor_habitual")
    productos = relationship("ProductoProveedor", back_populates="proveedor", lazy="dynamic")
    ordenes_compra = relationship("OrdenCompra", back_populates="proveedor", lazy="dynamic")
    movimientos_stock = relationship("MovimientoStock", back_populates="proveedor")
    movimientos_cuenta_proveedor = relationship(
        "MovimientoCuentaCorrienteProveedor",
        back_populates="proveedor",
        lazy="dynamic"
    )
    ordenes_pago = relationship("OrdenPago", back_populates="proveedor", lazy="dynamic")

    def __repr__(self) -> str:
        return f"<Proveedor {self.razon_social}>"

    @property
    def nombre_display(self) -> str:
        """Nombre para mostrar (fantasía o razón social)."""
        return self.nombre_fantasia or self.razon_social

    @property
    def cuit_formateado(self) -> str:
        """CUIT con formato XX-XXXXXXXX-X."""
        cuit = self.cuit.replace("-", "")
        if len(cuit) == 11:
            return f"{cuit[:2]}-{cuit[2:10]}-{cuit[10]}"
        return self.cuit

    @property
    def tiene_deuda(self) -> bool:
        """Indica si el proveedor tiene saldo pendiente (le debemos)."""
        return self.saldo_cuenta_corriente > 0
