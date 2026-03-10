"""
Schemas de Conciliación Bancaria.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


# ==================== ITEM CONCILIACIÓN ====================

class ItemConciliacionResponse(BaseModel):
    """Schema de item de conciliación."""
    id: str
    movimiento_bancario_id: str
    conciliado: bool
    fecha_conciliacion: Optional[datetime] = None
    referencia_extracto: Optional[str] = None
    notas: Optional[str] = None

    # Datos del movimiento bancario
    tipo_movimiento: Optional[str] = None
    concepto: Optional[str] = None
    monto: Optional[Decimal] = None
    fecha_movimiento: Optional[date] = None
    referencia_externa: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== CONCILIACIÓN BANCARIA ====================

class ConciliacionBancariaCreate(BaseModel):
    """Schema para iniciar conciliación."""
    cuenta_id: str
    fecha_desde: date
    fecha_hasta: date
    saldo_extracto_bancario: Optional[Decimal] = None


class ConciliacionBancariaResponse(BaseModel):
    """Schema de respuesta de conciliación."""
    id: str
    cuenta_id: str
    fecha_desde: date
    fecha_hasta: date
    estado: str
    saldo_extracto_bancario: Optional[Decimal] = None
    saldo_sistema: Optional[Decimal] = None
    diferencia: Optional[Decimal] = None
    cantidad_conciliados: int
    monto_conciliado: Decimal
    creado_por_id: str
    finalizado_por_id: Optional[str] = None
    fecha_finalizacion: Optional[datetime] = None
    notas: Optional[str] = None
    created_at: datetime

    # Items
    items: List[ItemConciliacionResponse] = []

    # Calculados
    cuenta_nombre: Optional[str] = None
    cuenta_banco: Optional[str] = None
    cantidad_pendientes: int = 0
    esta_finalizada: bool = False

    class Config:
        from_attributes = True


class ConciliacionBancariaList(BaseModel):
    """Schema simplificado para listados."""
    id: str
    cuenta_id: str
    cuenta_nombre: Optional[str] = None
    fecha_desde: date
    fecha_hasta: date
    estado: str
    cantidad_conciliados: int
    cantidad_pendientes: int
    diferencia: Optional[Decimal] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== ACCIONES ====================

class ConciliarMovimientoRequest(BaseModel):
    """Request para conciliar un movimiento."""
    movimiento_bancario_id: str
    referencia_extracto: Optional[str] = None
    notas: Optional[str] = None


class DesconciliarMovimientoRequest(BaseModel):
    """Request para desconciliar un movimiento."""
    movimiento_bancario_id: str


class ConciliarVariosRequest(BaseModel):
    """Request para conciliar varios movimientos a la vez."""
    movimientos: List[ConciliarMovimientoRequest]


class FinalizarConciliacionRequest(BaseModel):
    """Request para finalizar conciliación."""
    saldo_extracto_bancario: Decimal
    notas: Optional[str] = None


# ==================== MOVIMIENTOS SIN CONCILIAR ====================

class MovimientoSinConciliarResponse(BaseModel):
    """Movimiento bancario sin conciliar."""
    id: str
    cuenta_id: str
    tipo: str
    concepto: str
    monto: Decimal
    fecha_movimiento: date
    referencia_externa: Optional[str] = None
    numero_comprobante: Optional[str] = None
    cliente_nombre: Optional[str] = None
    proveedor_nombre: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== CONSTANTES ====================

ESTADOS_CONCILIACION = [
    {"value": "en_proceso", "label": "En Proceso", "color": "yellow"},
    {"value": "completada", "label": "Completada", "color": "green"},
]
