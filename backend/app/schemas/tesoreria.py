"""
Schemas de Tesorería.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field


# ==================== CHEQUE ====================

class ChequeCreate(BaseModel):
    """Schema para crear un cheque."""
    numero: str = Field(..., min_length=1, max_length=50)
    tipo: str = Field(default="fisico")  # fisico, echeq
    origen: str = Field(default="recibido_cliente")  # recibido_cliente, recibido_proveedor, emitido

    monto: Decimal = Field(..., gt=0)
    fecha_emision: Optional[date] = None
    fecha_vencimiento: date

    banco_origen: Optional[str] = Field(None, max_length=100)
    cuenta_destino_id: Optional[UUID] = None
    banco_destino: Optional[str] = Field(None, max_length=100)

    cliente_id: Optional[UUID] = None
    proveedor_id: Optional[UUID] = None

    librador: Optional[str] = Field(None, max_length=200)
    cuit_librador: Optional[str] = Field(None, max_length=15)

    notas: Optional[str] = None


class ChequeUpdate(BaseModel):
    """Schema para actualizar un cheque."""
    numero: Optional[str] = Field(None, min_length=1, max_length=50)
    tipo: Optional[str] = None
    estado: Optional[str] = None

    monto: Optional[Decimal] = Field(None, gt=0)
    fecha_emision: Optional[date] = None
    fecha_vencimiento: Optional[date] = None
    fecha_cobro: Optional[date] = None

    banco_origen: Optional[str] = Field(None, max_length=100)
    cuenta_destino_id: Optional[UUID] = None
    banco_destino: Optional[str] = Field(None, max_length=100)

    cliente_id: Optional[UUID] = None
    proveedor_id: Optional[UUID] = None

    librador: Optional[str] = Field(None, max_length=200)
    cuit_librador: Optional[str] = Field(None, max_length=15)

    notas: Optional[str] = None
    motivo_rechazo: Optional[str] = None


class ChequeResponse(BaseModel):
    """Schema de respuesta de cheque."""
    id: UUID
    numero: str
    tipo: str
    origen: str
    estado: str

    monto: Decimal
    fecha_emision: Optional[date]
    fecha_vencimiento: date
    fecha_cobro: Optional[date]

    banco_origen: Optional[str]
    cuenta_destino_id: Optional[UUID]
    banco_destino: Optional[str]

    cliente_id: Optional[UUID]
    proveedor_id: Optional[UUID]

    librador: Optional[str]
    cuit_librador: Optional[str]

    registrado_por_id: UUID
    cobrado_por_id: Optional[UUID]

    notas: Optional[str]
    motivo_rechazo: Optional[str]

    created_at: datetime
    activo: bool

    # Campos calculados
    cliente_nombre: Optional[str] = None
    proveedor_nombre: Optional[str] = None
    registrado_por_nombre: Optional[str] = None
    dias_para_vencimiento: Optional[int] = None

    class Config:
        from_attributes = True


class ChequeList(BaseModel):
    """Schema para listado de cheques."""
    id: UUID
    numero: str
    tipo: str
    origen: str
    estado: str
    monto: Decimal
    fecha_vencimiento: date
    fecha_cobro: Optional[date]
    banco_origen: Optional[str]
    banco_destino: Optional[str]
    cliente_nombre: Optional[str] = None
    proveedor_nombre: Optional[str] = None
    dias_para_vencimiento: Optional[int] = None

    class Config:
        from_attributes = True


class DepositarChequeRequest(BaseModel):
    """Schema para depositar un cheque."""
    cuenta_destino_id: UUID
    fecha_deposito: date = Field(default_factory=date.today)
    notas: Optional[str] = None


class CobrarChequeRequest(BaseModel):
    """Schema para marcar cheque como cobrado."""
    fecha_cobro: date = Field(default_factory=date.today)
    notas: Optional[str] = None


class RechazarChequeRequest(BaseModel):
    """Schema para rechazar un cheque."""
    motivo_rechazo: str = Field(..., min_length=3)
    fecha_rechazo: date = Field(default_factory=date.today)


class EntregarChequeRequest(BaseModel):
    """Schema para entregar cheque a tercero."""
    proveedor_id: Optional[UUID] = None
    concepto: str = Field(..., min_length=3)
    fecha_entrega: date = Field(default_factory=date.today)
    notas: Optional[str] = None


# ==================== MOVIMIENTO TESORERIA ====================

class MovimientoTesoreriaCreate(BaseModel):
    """Schema para crear movimiento de tesorería."""
    tipo: str  # ingreso_efectivo, ingreso_transferencia, etc.
    concepto: str = Field(..., min_length=3, max_length=200)
    descripcion: Optional[str] = None

    monto: Decimal = Field(..., gt=0)
    es_ingreso: bool = True
    fecha_movimiento: date
    fecha_valor: Optional[date] = None

    metodo_pago: str  # efectivo, transferencia, cheque

    # Si es transferencia
    banco_origen: Optional[str] = None
    banco_destino: Optional[str] = None
    cuenta_destino_id: Optional[UUID] = None
    numero_transferencia: Optional[str] = None

    # Si es cheque existente
    cheque_id: Optional[UUID] = None

    # Relaciones
    cliente_id: Optional[UUID] = None
    proveedor_id: Optional[UUID] = None

    notas: Optional[str] = None
    comprobante: Optional[str] = None


class MovimientoTesoreriaResponse(BaseModel):
    """Schema de respuesta de movimiento de tesorería."""
    id: UUID
    tipo: str
    concepto: str
    descripcion: Optional[str]

    monto: Decimal
    es_ingreso: bool
    fecha_movimiento: date
    fecha_valor: Optional[date]

    metodo_pago: str
    banco_origen: Optional[str]
    banco_destino: Optional[str]
    cuenta_destino_id: Optional[UUID]
    numero_transferencia: Optional[str]

    cheque_id: Optional[UUID]
    cliente_id: Optional[UUID]
    proveedor_id: Optional[UUID]

    registrado_por_id: UUID
    notas: Optional[str]
    comprobante: Optional[str]

    anulado: bool
    motivo_anulacion: Optional[str]

    created_at: datetime
    activo: bool

    # Campos calculados
    cliente_nombre: Optional[str] = None
    proveedor_nombre: Optional[str] = None
    registrado_por_nombre: Optional[str] = None
    cheque_numero: Optional[str] = None

    class Config:
        from_attributes = True


class MovimientoTesoreriaList(BaseModel):
    """Schema para listado de movimientos."""
    id: UUID
    tipo: str
    concepto: str
    monto: Decimal
    es_ingreso: bool
    fecha_movimiento: date
    metodo_pago: str
    cliente_nombre: Optional[str] = None
    proveedor_nombre: Optional[str] = None
    cheque_numero: Optional[str] = None
    anulado: bool

    class Config:
        from_attributes = True


class AnularMovimientoRequest(BaseModel):
    """Schema para anular movimiento."""
    motivo: str = Field(..., min_length=5)


# ==================== RESUMEN ====================

class ResumenTesoreria(BaseModel):
    """Resumen de tesorería."""
    # Cheques
    cheques_en_cartera: int
    total_cheques_cartera: Decimal
    cheques_proximos_vencer: int  # próximos 7 días
    total_proximos_vencer: Decimal
    cheques_vencidos: int
    total_vencidos: Decimal

    # Movimientos del período
    total_ingresos_efectivo: Decimal
    total_ingresos_transferencia: Decimal
    total_ingresos_cheque: Decimal
    total_egresos_efectivo: Decimal
    total_egresos_transferencia: Decimal
    total_egresos_cheque: Decimal

    # Saldo
    saldo_periodo: Decimal


# ==================== CONSTANTES ====================

from app.models.tesoreria import (
    TIPOS_CHEQUE,
    ORIGENES_CHEQUE,
    ESTADOS_CHEQUE,
    METODOS_PAGO_TESORERIA,
    BANCOS_ARGENTINA,
)
