"""
Modelo de Titular Fiscal.

Representa la persona jurídica/física que factura ante AFIP. Un titular
puede tener varios `Cliente` operativos (ej: distintos hoteles del mismo
grupo empresarial). El CUIT vive acá; el Cliente perdió esa columna.
"""

from sqlalchemy import Column, String
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.base import BaseModelMixin
from app.models.cliente import CondicionIVA  # se reutiliza el enum


class TitularFiscal(Base, BaseModelMixin):
    __tablename__ = "titulares_fiscales"

    cuit = Column(String(13), nullable=False, unique=True, index=True)
    razon_social_fiscal = Column(String(200), nullable=False)
    condicion_iva = Column(
        String(30),
        nullable=False,
        default=CondicionIVA.RESPONSABLE_INSCRIPTO.value,
    )

    # Domicilio fiscal (distinto de la dirección operativa del cliente)
    direccion_fiscal = Column(String(255), nullable=True)
    ciudad_fiscal = Column(String(100), nullable=True)
    provincia_fiscal = Column(String(100), nullable=True, default="Córdoba")
    codigo_postal_fiscal = Column(String(10), nullable=True)

    notas = Column(String(500), nullable=True)

    clientes = relationship("Cliente", back_populates="titular_fiscal", lazy="dynamic")

    def __repr__(self) -> str:
        return f"<TitularFiscal {self.cuit}: {self.razon_social_fiscal}>"
