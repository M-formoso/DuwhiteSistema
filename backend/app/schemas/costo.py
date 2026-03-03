"""
Schemas de Costos para DUWHITE ERP
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID


# ==================== ENUMS ====================

class TipoCosto:
    FIJO = "fijo"
    VARIABLE = "variable"
    SEMIVARIABLE = "semivariable"


class CategoriaCosto:
    MANO_OBRA = "mano_obra"
    INSUMOS = "insumos"
    ENERGIA = "energia"
    ALQUILER = "alquiler"
    MANTENIMIENTO = "mantenimiento"
    TRANSPORTE = "transporte"
    ADMINISTRATIVO = "administrativo"
    IMPUESTOS = "impuestos"
    DEPRECIACION = "depreciacion"
    OTROS = "otros"


# ==================== COSTO FIJO ====================

class CostoFijoBase(BaseModel):
    """Schema base de costo fijo"""
    nombre: str = Field(..., min_length=2, max_length=100)
    descripcion: Optional[str] = None
    categoria: str = Field(default=CategoriaCosto.OTROS)
    monto_mensual: Decimal = Field(..., gt=0)
    fecha_inicio: date
    fecha_fin: Optional[date] = None
    dias_mes: int = Field(default=30, ge=1, le=31)
    notas: Optional[str] = None


class CostoFijoCreate(CostoFijoBase):
    """Schema para crear costo fijo"""
    pass


class CostoFijoUpdate(BaseModel):
    """Schema para actualizar costo fijo"""
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    monto_mensual: Optional[Decimal] = Field(None, gt=0)
    fecha_fin: Optional[date] = None
    dias_mes: Optional[int] = Field(None, ge=1, le=31)
    notas: Optional[str] = None


class CostoFijoResponse(BaseModel):
    """Schema de respuesta de costo fijo"""
    id: UUID
    nombre: str
    descripcion: Optional[str]
    categoria: str
    monto_mensual: Decimal
    fecha_inicio: date
    fecha_fin: Optional[date]
    dias_mes: int
    notas: Optional[str]
    is_active: bool
    created_at: datetime

    # Campos calculados
    costo_diario: Optional[Decimal] = None
    vigente: Optional[bool] = None

    class Config:
        from_attributes = True


# ==================== COSTO VARIABLE ====================

class CostoVariableBase(BaseModel):
    """Schema base de costo variable"""
    nombre: str = Field(..., min_length=2, max_length=100)
    descripcion: Optional[str] = None
    categoria: str = Field(default=CategoriaCosto.INSUMOS)
    costo_por_unidad: Decimal = Field(..., gt=0)
    unidad_medida: str = Field(..., max_length=20)
    consumo_por_kg: Optional[Decimal] = Field(None, ge=0)
    insumo_id: Optional[UUID] = None
    notas: Optional[str] = None


class CostoVariableCreate(CostoVariableBase):
    """Schema para crear costo variable"""
    pass


class CostoVariableUpdate(BaseModel):
    """Schema para actualizar costo variable"""
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    costo_por_unidad: Optional[Decimal] = Field(None, gt=0)
    unidad_medida: Optional[str] = Field(None, max_length=20)
    consumo_por_kg: Optional[Decimal] = Field(None, ge=0)
    insumo_id: Optional[UUID] = None
    notas: Optional[str] = None


class CostoVariableResponse(BaseModel):
    """Schema de respuesta de costo variable"""
    id: UUID
    nombre: str
    descripcion: Optional[str]
    categoria: str
    costo_por_unidad: Decimal
    unidad_medida: str
    consumo_por_kg: Optional[Decimal]
    insumo_id: Optional[UUID]
    notas: Optional[str]
    is_active: bool
    created_at: datetime

    # Campos calculados
    insumo_nombre: Optional[str] = None
    costo_por_kg: Optional[Decimal] = None  # costo_por_unidad * consumo_por_kg

    class Config:
        from_attributes = True


# ==================== TARIFA SERVICIO ====================

class TarifaServicioBase(BaseModel):
    """Schema base de tarifa de servicio"""
    servicio_id: UUID
    costo_mano_obra: Decimal = Field(default=Decimal("0"), ge=0)
    costo_insumos: Decimal = Field(default=Decimal("0"), ge=0)
    costo_energia: Decimal = Field(default=Decimal("0"), ge=0)
    costo_otros: Decimal = Field(default=Decimal("0"), ge=0)
    precio_sugerido: Optional[Decimal] = Field(None, ge=0)
    margen_objetivo: Optional[Decimal] = Field(None, ge=0, le=100)
    tiempo_proceso: Optional[int] = Field(None, ge=0)
    fecha_vigencia: date
    notas: Optional[str] = None


class TarifaServicioCreate(TarifaServicioBase):
    """Schema para crear tarifa de servicio"""
    pass


class TarifaServicioUpdate(BaseModel):
    """Schema para actualizar tarifa de servicio"""
    costo_mano_obra: Optional[Decimal] = Field(None, ge=0)
    costo_insumos: Optional[Decimal] = Field(None, ge=0)
    costo_energia: Optional[Decimal] = Field(None, ge=0)
    costo_otros: Optional[Decimal] = Field(None, ge=0)
    precio_sugerido: Optional[Decimal] = Field(None, ge=0)
    margen_objetivo: Optional[Decimal] = Field(None, ge=0, le=100)
    tiempo_proceso: Optional[int] = Field(None, ge=0)
    notas: Optional[str] = None


class TarifaServicioResponse(BaseModel):
    """Schema de respuesta de tarifa de servicio"""
    id: UUID
    servicio_id: UUID
    costo_mano_obra: Decimal
    costo_insumos: Decimal
    costo_energia: Decimal
    costo_otros: Decimal
    costo_total: Decimal
    precio_sugerido: Optional[Decimal]
    margen_objetivo: Optional[Decimal]
    tiempo_proceso: Optional[int]
    fecha_vigencia: date
    notas: Optional[str]
    created_at: datetime

    # Campos calculados
    servicio_nombre: Optional[str] = None
    margen_real: Optional[Decimal] = None

    class Config:
        from_attributes = True


# ==================== ANALISIS COSTO LOTE ====================

class AnalisisCostoLoteCreate(BaseModel):
    """Schema para crear análisis de costo de lote"""
    lote_id: UUID
    costo_insumos: Decimal = Field(default=Decimal("0"), ge=0)
    costo_mano_obra: Decimal = Field(default=Decimal("0"), ge=0)
    costo_energia: Decimal = Field(default=Decimal("0"), ge=0)
    costo_fijos_prorrateado: Decimal = Field(default=Decimal("0"), ge=0)
    costo_otros: Decimal = Field(default=Decimal("0"), ge=0)
    kg_procesados: Optional[Decimal] = Field(None, ge=0)
    ingreso_total: Optional[Decimal] = Field(None, ge=0)
    costo_estimado: Optional[Decimal] = Field(None, ge=0)
    notas: Optional[str] = None


class AnalisisCostoLoteResponse(BaseModel):
    """Schema de respuesta de análisis de costo de lote"""
    id: UUID
    lote_id: UUID
    costo_insumos: Decimal
    costo_mano_obra: Decimal
    costo_energia: Decimal
    costo_fijos_prorrateado: Decimal
    costo_otros: Decimal
    costo_total: Decimal
    kg_procesados: Optional[Decimal]
    costo_por_kg: Optional[Decimal]
    ingreso_total: Optional[Decimal]
    margen_bruto: Optional[Decimal]
    margen_porcentaje: Optional[Decimal]
    costo_estimado: Optional[Decimal]
    variacion: Optional[Decimal]
    notas: Optional[str]
    created_at: datetime

    # Campos relacionados
    lote_codigo: Optional[str] = None
    cliente_nombre: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== PARAMETRO COSTO ====================

class ParametroCostoCreate(BaseModel):
    """Schema para crear parámetro de costo"""
    clave: str = Field(..., min_length=2, max_length=50)
    valor: str = Field(..., max_length=100)
    descripcion: Optional[str] = None
    tipo_dato: str = Field(default="decimal", max_length=20)
    categoria: Optional[str] = Field(None, max_length=50)


class ParametroCostoUpdate(BaseModel):
    """Schema para actualizar parámetro de costo"""
    valor: str = Field(..., max_length=100)
    descripcion: Optional[str] = None


class ParametroCostoResponse(BaseModel):
    """Schema de respuesta de parámetro de costo"""
    id: UUID
    clave: str
    valor: str
    descripcion: Optional[str]
    tipo_dato: str
    categoria: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== RESUMEN DE COSTOS ====================

class ResumenCostosMes(BaseModel):
    """Resumen de costos del mes"""
    periodo_mes: int
    periodo_anio: int

    # Costos fijos
    total_costos_fijos: Decimal
    costos_fijos_por_categoria: dict[str, Decimal]

    # Costos variables
    total_costos_variables: Decimal
    costos_variables_por_categoria: dict[str, Decimal]

    # Producción
    total_kg_procesados: Decimal
    costo_promedio_por_kg: Decimal

    # Comparación
    total_ingresos: Decimal
    margen_bruto: Decimal
    margen_porcentaje: Decimal


class RentabilidadServicio(BaseModel):
    """Rentabilidad por servicio"""
    servicio_id: UUID
    servicio_nombre: str
    cantidad_procesada: Decimal
    unidad: str
    costo_total: Decimal
    ingreso_total: Decimal
    margen_bruto: Decimal
    margen_porcentaje: Decimal
    costo_promedio_unidad: Decimal
    precio_promedio_unidad: Decimal


class RentabilidadCliente(BaseModel):
    """Rentabilidad por cliente"""
    cliente_id: UUID
    cliente_nombre: str
    cantidad_pedidos: int
    kg_procesados: Decimal
    costo_total: Decimal
    ingreso_total: Decimal
    margen_bruto: Decimal
    margen_porcentaje: Decimal


# ==================== CONSTANTES ====================

CATEGORIAS_COSTO = [
    {"value": "mano_obra", "label": "Mano de Obra"},
    {"value": "insumos", "label": "Insumos"},
    {"value": "energia", "label": "Energía"},
    {"value": "alquiler", "label": "Alquiler"},
    {"value": "mantenimiento", "label": "Mantenimiento"},
    {"value": "transporte", "label": "Transporte"},
    {"value": "administrativo", "label": "Administrativo"},
    {"value": "impuestos", "label": "Impuestos"},
    {"value": "depreciacion", "label": "Depreciación"},
    {"value": "otros", "label": "Otros"},
]

UNIDADES_MEDIDA_COSTO = [
    {"value": "kg", "label": "Kilogramo"},
    {"value": "litro", "label": "Litro"},
    {"value": "unidad", "label": "Unidad"},
    {"value": "kwh", "label": "kWh"},
    {"value": "m3", "label": "Metro cúbico"},
    {"value": "hora", "label": "Hora"},
]
