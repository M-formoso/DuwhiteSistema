"""
Schemas de Cruces Consolidados Cliente-Proveedor.
"""

from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel


class EntidadConsolidadaResponse(BaseModel):
    """Schema de respuesta de entidad consolidada."""
    id: str
    cuit: str
    razon_social: str
    es_cliente: bool
    es_proveedor: bool
    cliente_id: Optional[str] = None
    proveedor_id: Optional[str] = None
    saldo_como_cliente: Decimal
    saldo_como_proveedor: Decimal
    saldo_neto: Decimal
    activo: bool

    # Calculados
    es_cruzada: bool = False
    tipo_saldo: str = "neutro"  # a_favor, en_contra, neutro

    class Config:
        from_attributes = True


class EntidadConsolidadaList(BaseModel):
    """Schema simplificado para listados."""
    id: str
    cuit: str
    razon_social: str
    es_cliente: bool
    es_proveedor: bool
    saldo_neto: Decimal
    tipo_saldo: str

    class Config:
        from_attributes = True


class SaldoConsolidadoDetalle(BaseModel):
    """Detalle de saldo consolidado con información de facturas."""
    entidad_id: str
    cuit: str
    razon_social: str

    # Saldos
    saldo_cliente: Decimal  # Lo que nos deben
    saldo_proveedor: Decimal  # Lo que debemos
    saldo_neto: Decimal  # Positivo = nos deben

    # Referencias
    cliente_id: Optional[str] = None
    proveedor_id: Optional[str] = None

    # Estadísticas
    cantidad_facturas_cliente: int = 0
    cantidad_facturas_proveedor: int = 0


class SincronizarEntidadesResponse(BaseModel):
    """Respuesta de sincronización de entidades."""
    entidades_creadas: int
    entidades_actualizadas: int
    total_procesadas: int
