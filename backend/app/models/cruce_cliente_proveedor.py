"""
Modelo para Cruces Consolidados Cliente-Proveedor.
"""

from decimal import Decimal
from sqlalchemy import Column, String, Numeric, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base
from app.models.base import BaseModelMixin


class EntidadConsolidada(Base, BaseModelMixin):
    """
    Entidad que puede ser tanto cliente como proveedor.
    Permite visualizar saldo neto consolidado.
    Se sincroniza automáticamente basándose en CUIT coincidente.
    """
    __tablename__ = "entidades_consolidadas"

    # Identificación fiscal única
    cuit = Column(String(13), unique=True, nullable=False, index=True)
    razon_social = Column(String(255), nullable=False)

    # Referencias a cliente y/o proveedor
    cliente_id = Column(UUID(as_uuid=True), nullable=True, unique=True)
    proveedor_id = Column(UUID(as_uuid=True), nullable=True, unique=True)

    # Indicadores
    es_cliente = Column(Boolean, default=False)
    es_proveedor = Column(Boolean, default=False)

    # Saldos consolidados (calculados, actualizados por servicios)
    saldo_como_cliente = Column(Numeric(14, 2), default=0)   # Lo que nos deben (positivo = a favor nuestro)
    saldo_como_proveedor = Column(Numeric(14, 2), default=0)  # Lo que debemos (positivo = debemos)
    saldo_neto = Column(Numeric(14, 2), default=0)  # Positivo = nos deben, Negativo = debemos

    # Notas
    notas = Column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<EntidadConsolidada {self.cuit}: {self.razon_social}>"

    def actualizar_saldo_neto(self) -> None:
        """Actualiza el saldo neto basado en los saldos parciales."""
        self.saldo_neto = self.saldo_como_cliente - self.saldo_como_proveedor

    @property
    def es_cruzada(self) -> bool:
        """Indica si la entidad es tanto cliente como proveedor."""
        return self.es_cliente and self.es_proveedor

    @property
    def tipo_saldo(self) -> str:
        """Indica el tipo de saldo: 'a_favor', 'en_contra', 'neutro'."""
        if self.saldo_neto > 0:
            return "a_favor"  # Nos deben
        elif self.saldo_neto < 0:
            return "en_contra"  # Debemos
        return "neutro"
