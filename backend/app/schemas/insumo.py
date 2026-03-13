"""
Schemas de Insumo (Stock).
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class InsumoBase(BaseModel):
    """Base schema para insumo."""
    codigo: str = Field(..., min_length=1, max_length=50)
    codigo_barras: Optional[str] = Field(None, max_length=100)
    nombre: str = Field(..., min_length=1, max_length=255)
    categoria_id: Optional[UUID] = None
    subcategoria: Optional[str] = Field(None, max_length=100)
    unidad: str = Field(..., min_length=1, max_length=20)
    stock_actual: Decimal = Field(default=Decimal("0"), ge=0)
    stock_minimo: Decimal = Field(default=Decimal("0"), ge=0)
    stock_maximo: Optional[Decimal] = Field(None, ge=0)
    precio_unitario_sin_iva: Optional[Decimal] = Field(None, ge=0)
    precio_unitario_costo: Optional[Decimal] = Field(None, ge=0)
    precio_promedio_ponderado: Optional[Decimal] = Field(None, ge=0)
    proveedor_habitual_id: Optional[UUID] = None
    ubicacion_deposito: Optional[str] = Field(None, max_length=100)
    fecha_vencimiento: Optional[date] = None
    foto: Optional[str] = Field(None, max_length=500)
    notas: Optional[str] = None


class InsumoCreate(InsumoBase):
    """Schema para crear insumo."""
    pass


class InsumoUpdate(BaseModel):
    """Schema para actualizar insumo."""
    codigo: Optional[str] = Field(None, min_length=1, max_length=50)
    codigo_barras: Optional[str] = Field(None, max_length=100)
    nombre: Optional[str] = Field(None, min_length=1, max_length=255)
    categoria_id: Optional[UUID] = None
    subcategoria: Optional[str] = Field(None, max_length=100)
    unidad: Optional[str] = Field(None, min_length=1, max_length=20)
    stock_minimo: Optional[Decimal] = Field(None, ge=0)
    stock_maximo: Optional[Decimal] = Field(None, ge=0)
    precio_unitario_sin_iva: Optional[Decimal] = Field(None, ge=0)
    precio_unitario_costo: Optional[Decimal] = Field(None, ge=0)
    proveedor_habitual_id: Optional[UUID] = None
    ubicacion_deposito: Optional[str] = Field(None, max_length=100)
    fecha_vencimiento: Optional[date] = None
    foto: Optional[str] = Field(None, max_length=500)
    notas: Optional[str] = None


class InsumoInDB(InsumoBase):
    """Schema de insumo en BD."""
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool = True

    class Config:
        from_attributes = True


class InsumoResponse(InsumoInDB):
    """Schema de respuesta de insumo con propiedades calculadas."""
    categoria_nombre: Optional[str] = None
    proveedor_nombre: Optional[str] = None
    stock_bajo: bool = False
    sin_stock: bool = False
    sobrestock: bool = False
    proximo_a_vencer: bool = False
    valor_stock: Decimal = Decimal("0")


class InsumoList(BaseModel):
    """Schema para lista simplificada."""
    id: UUID
    codigo: str
    nombre: str
    unidad: str
    stock_actual: Decimal
    stock_minimo: Decimal
    stock_bajo: bool = False

    class Config:
        from_attributes = True


class InsumoAlerta(BaseModel):
    """Schema para alertas de stock."""
    id: UUID
    codigo: str
    nombre: str
    unidad: str
    stock_actual: Decimal
    stock_minimo: Decimal
    tipo_alerta: str  # stock_bajo, sin_stock, sobrestock, vencimiento
    mensaje: str

    class Config:
        from_attributes = True


class AjusteStockRequest(BaseModel):
    """Schema para ajuste manual de stock."""
    insumo_id: UUID
    cantidad: Decimal = Field(..., description="Cantidad positiva o negativa")
    motivo: str = Field(..., min_length=1, max_length=500)
    numero_lote: Optional[str] = None
    fecha_vencimiento: Optional[date] = None

    @field_validator('cantidad')
    @classmethod
    def cantidad_no_cero(cls, v: Decimal) -> Decimal:
        if v == 0:
            raise ValueError('La cantidad no puede ser cero')
        return v


class TransferenciaStockRequest(BaseModel):
    """Schema para transferencia entre ubicaciones."""
    insumo_id: UUID
    cantidad: Decimal = Field(..., gt=0)
    ubicacion_origen: str = Field(..., max_length=100)
    ubicacion_destino: str = Field(..., max_length=100)
    notas: Optional[str] = None
