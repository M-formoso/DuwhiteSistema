"""
Schemas de Cuenta Corriente de Proveedores.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


# ==================== MOVIMIENTO CC PROVEEDOR ====================

class MovimientoCCProveedorBase(BaseModel):
    """Schema base de movimiento CC proveedor."""
    tipo: str  # cargo, pago, ajuste, nota_credito
    concepto: str = Field(..., min_length=1, max_length=255)
    monto: Decimal = Field(..., gt=0)
    fecha_movimiento: date
    fecha_vencimiento: Optional[date] = None
    factura_numero: Optional[str] = None
    factura_fecha: Optional[date] = None
    notas: Optional[str] = None


class MovimientoCCProveedorCreate(MovimientoCCProveedorBase):
    """Schema para crear movimiento."""
    proveedor_id: str
    orden_compra_id: Optional[str] = None
    recepcion_compra_id: Optional[str] = None


class MovimientoCCProveedorResponse(MovimientoCCProveedorBase):
    """Schema de respuesta de movimiento."""
    id: str
    proveedor_id: str
    orden_compra_id: Optional[str] = None
    orden_pago_id: Optional[str] = None
    recepcion_compra_id: Optional[str] = None
    saldo_anterior: Decimal
    saldo_posterior: Decimal
    saldo_comprobante: Decimal
    registrado_por_id: str
    created_at: datetime

    # Calculados
    proveedor_nombre: Optional[str] = None
    registrado_por_nombre: Optional[str] = None
    dias_vencimiento: Optional[int] = None  # Días desde vencimiento (positivo = vencido)

    class Config:
        from_attributes = True


class MovimientoCCProveedorList(BaseModel):
    """Schema simplificado para listados."""
    id: str
    tipo: str
    concepto: str
    monto: Decimal
    fecha_movimiento: date
    fecha_vencimiento: Optional[date] = None
    saldo_comprobante: Decimal
    saldo_posterior: Decimal
    factura_numero: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== REGISTRAR CARGO/PAGO ====================

class RegistrarCargoProveedorRequest(BaseModel):
    """Request para registrar un cargo (factura) al proveedor."""
    proveedor_id: str
    monto: Decimal = Field(..., gt=0)
    concepto: str = Field(..., min_length=1, max_length=255)
    fecha_movimiento: date
    factura_numero: Optional[str] = None
    factura_fecha: Optional[date] = None
    fecha_vencimiento: Optional[date] = None
    orden_compra_id: Optional[str] = None
    recepcion_compra_id: Optional[str] = None
    notas: Optional[str] = None


class RegistrarPagoProveedorRequest(BaseModel):
    """Request para registrar un pago directo a proveedor (sin orden de pago)."""
    proveedor_id: str
    monto: Decimal = Field(..., gt=0)
    concepto: str
    fecha_movimiento: date
    medio_pago: str
    referencia_pago: Optional[str] = None
    cuenta_bancaria_id: Optional[str] = None
    notas: Optional[str] = None
    # Opcional: comprobantes a los que aplicar el pago
    aplicar_a_comprobantes: Optional[List[str]] = None


# ==================== ESTADO DE CUENTA PROVEEDOR ====================

class EstadoCuentaProveedorResponse(BaseModel):
    """Resumen del estado de cuenta de un proveedor."""
    proveedor_id: str
    proveedor_nombre: str
    saldo_actual: Decimal  # Deuda total (lo que le debemos)
    total_facturado_mes: Decimal
    total_pagado_mes: Decimal
    cantidad_facturas_pendientes: int
    factura_mas_antigua_dias: Optional[int] = None

    # Desglose por antigüedad
    deuda_0_30_dias: Decimal
    deuda_30_60_dias: Decimal
    deuda_60_90_dias: Decimal
    deuda_mas_90_dias: Decimal


# ==================== VENCIMIENTOS ====================

class ComprobanteVencimiento(BaseModel):
    """Comprobante con info de vencimiento."""
    id: str
    proveedor_id: str
    proveedor_nombre: str
    tipo: str
    factura_numero: Optional[str] = None
    monto_original: Decimal
    saldo_pendiente: Decimal
    fecha_movimiento: date
    fecha_vencimiento: Optional[date] = None
    dias_vencimiento: int  # Positivo = vencido, Negativo = por vencer
    rango_antiguedad: str  # "0-30", "30-60", "60-90", "90+"


class AnalisisVencimientosResponse(BaseModel):
    """Análisis completo de vencimientos."""
    fecha_analisis: date

    # Totales
    total_deuda: Decimal
    total_por_vencer: Decimal
    total_vencido: Decimal

    # Por rango
    rango_0_30: Decimal
    rango_30_60: Decimal
    rango_60_90: Decimal
    rango_90_mas: Decimal

    # Detalle
    comprobantes: List[ComprobanteVencimiento] = []


# ==================== CONSTANTES ====================

TIPOS_MOVIMIENTO_CC_PROVEEDOR = [
    {"value": "cargo", "label": "Cargo (Factura)"},
    {"value": "pago", "label": "Pago"},
    {"value": "ajuste", "label": "Ajuste"},
    {"value": "nota_credito", "label": "Nota de Crédito"},
]
