"""
Schemas de Finanzas (Caja, Movimientos, Cuentas Bancarias).
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


# ==================== CAJA ====================

class CajaBase(BaseModel):
    """Schema base de caja."""
    saldo_inicial: Decimal = Field(..., ge=0)
    observaciones_apertura: Optional[str] = None


class AbrirCajaRequest(CajaBase):
    """Request para abrir caja."""
    pass


class CerrarCajaRequest(BaseModel):
    """Request para cerrar caja."""
    saldo_real: Decimal = Field(..., ge=0)
    observaciones_cierre: Optional[str] = None


class CajaResponse(BaseModel):
    """Schema de respuesta de caja."""
    id: str
    numero: int
    fecha: date
    estado: str
    saldo_inicial: Decimal
    total_ingresos: Decimal
    total_egresos: Decimal
    saldo_final: Optional[Decimal] = None
    saldo_real: Optional[Decimal] = None
    diferencia: Optional[Decimal] = None
    abierta_por_id: str
    fecha_apertura: datetime
    cerrada_por_id: Optional[str] = None
    fecha_cierre: Optional[datetime] = None
    observaciones_apertura: Optional[str] = None
    observaciones_cierre: Optional[str] = None
    created_at: datetime

    # Calculados
    saldo_calculado: float
    abierta_por_nombre: Optional[str] = None
    cerrada_por_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class CajaList(BaseModel):
    """Schema simplificado para listados."""
    id: str
    numero: int
    fecha: date
    estado: str
    saldo_inicial: Decimal
    total_ingresos: Decimal
    total_egresos: Decimal
    saldo_final: Optional[Decimal] = None
    diferencia: Optional[Decimal] = None

    class Config:
        from_attributes = True


# ==================== MOVIMIENTO CAJA ====================

class MovimientoCajaBase(BaseModel):
    """Schema base de movimiento de caja."""
    tipo: str  # ingreso, egreso
    categoria: str
    concepto: str = Field(..., min_length=1, max_length=255)
    descripcion: Optional[str] = None
    monto: Decimal = Field(..., gt=0)
    medio_pago: str = "efectivo"
    referencia: Optional[str] = None


class MovimientoCajaCreate(MovimientoCajaBase):
    """Request para crear movimiento de caja."""
    cliente_id: Optional[str] = None
    proveedor_id: Optional[str] = None
    pedido_id: Optional[str] = None


class MovimientoCajaResponse(MovimientoCajaBase):
    """Schema de respuesta de movimiento."""
    id: str
    caja_id: str
    cliente_id: Optional[str] = None
    proveedor_id: Optional[str] = None
    pedido_id: Optional[str] = None
    recibo_id: Optional[str] = None
    registrado_por_id: str
    anulado: bool
    fecha_anulacion: Optional[datetime] = None
    motivo_anulacion: Optional[str] = None
    created_at: datetime

    # Calculados
    cliente_nombre: Optional[str] = None
    proveedor_nombre: Optional[str] = None
    registrado_por_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class AnularMovimientoRequest(BaseModel):
    """Request para anular movimiento."""
    motivo: str = Field(..., min_length=10)


# ==================== CUENTA BANCARIA ====================

class CuentaBancariaBase(BaseModel):
    """Schema base de cuenta bancaria."""
    nombre: str = Field(..., min_length=1, max_length=100)
    banco: str = Field(..., min_length=1, max_length=100)
    tipo_cuenta: str
    numero_cuenta: str = Field(..., min_length=1, max_length=50)
    cbu: Optional[str] = Field(None, min_length=22, max_length=22)
    alias: Optional[str] = None
    titular: str = Field(..., min_length=1, max_length=200)
    cuit_titular: Optional[str] = None
    notas: Optional[str] = None


class CuentaBancariaCreate(CuentaBancariaBase):
    """Request para crear cuenta bancaria."""
    saldo_actual: Decimal = Field(default=0, ge=0)
    es_principal: bool = False


class CuentaBancariaUpdate(BaseModel):
    """Request para actualizar cuenta bancaria."""
    nombre: Optional[str] = None
    alias: Optional[str] = None
    es_principal: Optional[bool] = None
    activa: Optional[bool] = None
    notas: Optional[str] = None


class CuentaBancariaResponse(CuentaBancariaBase):
    """Schema de respuesta de cuenta bancaria."""
    id: str
    saldo_actual: Decimal
    saldo_disponible: Optional[Decimal] = None
    activa: bool
    es_principal: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== MOVIMIENTO BANCARIO ====================

class MovimientoBancarioCreate(BaseModel):
    """Request para crear movimiento bancario."""
    cuenta_id: str
    tipo: str
    concepto: str = Field(..., min_length=1, max_length=255)
    descripcion: Optional[str] = None
    monto: Decimal = Field(..., gt=0)
    fecha_movimiento: date
    fecha_valor: Optional[date] = None
    numero_comprobante: Optional[str] = None
    referencia_externa: Optional[str] = None
    cliente_id: Optional[str] = None
    proveedor_id: Optional[str] = None


class MovimientoBancarioResponse(BaseModel):
    """Schema de respuesta de movimiento bancario."""
    id: str
    cuenta_id: str
    tipo: str
    concepto: str
    descripcion: Optional[str] = None
    monto: Decimal
    saldo_anterior: Decimal
    saldo_posterior: Decimal
    fecha_movimiento: date
    fecha_valor: Optional[date] = None
    numero_comprobante: Optional[str] = None
    referencia_externa: Optional[str] = None
    cliente_id: Optional[str] = None
    proveedor_id: Optional[str] = None
    conciliado: bool
    fecha_conciliacion: Optional[datetime] = None
    registrado_por_id: str
    created_at: datetime

    # Calculados
    cuenta_nombre: Optional[str] = None
    cliente_nombre: Optional[str] = None
    proveedor_nombre: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== RESUMEN FINANCIERO ====================

class ResumenCajaDiario(BaseModel):
    """Resumen diario de caja."""
    fecha: date
    caja_numero: Optional[int] = None
    estado: Optional[str] = None
    saldo_inicial: Decimal
    total_ingresos: Decimal
    total_egresos: Decimal
    saldo_actual: Decimal
    cantidad_movimientos: int


class ResumenFinanciero(BaseModel):
    """Resumen financiero general."""
    # Caja
    caja_actual: Optional[ResumenCajaDiario] = None

    # Totales del período
    total_ingresos_periodo: Decimal
    total_egresos_periodo: Decimal
    balance_periodo: Decimal

    # Por categoría
    ingresos_por_categoria: dict
    egresos_por_categoria: dict

    # Cuentas bancarias
    total_en_bancos: Decimal


# ==================== CONSTANTES ====================

CATEGORIAS_INGRESO = [
    {"value": "venta", "label": "Venta"},
    {"value": "cobro_cliente", "label": "Cobro a Cliente"},
    {"value": "otro_ingreso", "label": "Otro Ingreso"},
]

CATEGORIAS_EGRESO = [
    {"value": "pago_proveedor", "label": "Pago a Proveedor"},
    {"value": "pago_empleado", "label": "Pago a Empleado"},
    {"value": "gasto_operativo", "label": "Gasto Operativo"},
    {"value": "compra_insumos", "label": "Compra de Insumos"},
    {"value": "servicio", "label": "Servicio (Luz, Agua, Gas)"},
    {"value": "impuesto", "label": "Impuesto"},
    {"value": "retiro", "label": "Retiro"},
    {"value": "otro_egreso", "label": "Otro Egreso"},
]

TIPOS_CUENTA_BANCARIA = [
    {"value": "caja_ahorro", "label": "Caja de Ahorro"},
    {"value": "cuenta_corriente", "label": "Cuenta Corriente"},
]

TIPOS_MOVIMIENTO_BANCO = [
    {"value": "deposito", "label": "Depósito"},
    {"value": "extraccion", "label": "Extracción"},
    {"value": "transferencia_entrada", "label": "Transferencia Recibida"},
    {"value": "transferencia_salida", "label": "Transferencia Enviada"},
    {"value": "debito_automatico", "label": "Débito Automático"},
    {"value": "credito", "label": "Crédito"},
    {"value": "comision", "label": "Comisión Bancaria"},
    {"value": "cheque_emitido", "label": "Cheque Emitido"},
    {"value": "cheque_depositado", "label": "Cheque Depositado"},
]
