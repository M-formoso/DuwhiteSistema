"""
Schemas de Remito.
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field


# ==================== DETALLE REMITO ====================

class DetalleRemitoBase(BaseModel):
    """Campos base de detalle de remito."""
    producto_id: UUID
    cantidad: int = Field(..., ge=1)
    precio_unitario: Decimal = Field(..., ge=0)
    descripcion: Optional[str] = Field(None, max_length=255)


class DetalleRemitoCreate(DetalleRemitoBase):
    """Schema para crear detalle de remito."""
    pass


class DetalleRemitoResponse(BaseModel):
    """Schema de respuesta de detalle de remito."""
    id: UUID
    remito_id: UUID
    producto_id: UUID
    producto_codigo: str
    producto_nombre: str
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal
    descripcion: Optional[str] = None
    pendiente_relevado: bool = False
    cantidad_relevado: Optional[int] = None

    class Config:
        from_attributes = True


# ==================== REMITO ====================

class RemitoBase(BaseModel):
    """Campos base de remito."""
    lote_id: UUID
    cliente_id: UUID
    fecha_emision: date = Field(default_factory=date.today)
    notas: Optional[str] = None


class RemitoCreate(RemitoBase):
    """Schema para crear remito."""
    detalles: List[DetalleRemitoCreate] = Field(..., min_length=1)


class RemitoUpdate(BaseModel):
    """Schema para actualizar remito."""
    notas: Optional[str] = None
    notas_entrega: Optional[str] = None


class RemitoResponse(BaseModel):
    """Schema de respuesta de remito."""
    id: UUID
    numero: str
    lote_id: UUID
    lote_numero: str
    cliente_id: UUID
    cliente_nombre: str
    tipo: str  # normal, parcial, complementario
    estado: str  # borrador, emitido, entregado, anulado
    fecha_emision: date
    fecha_entrega: Optional[datetime] = None
    peso_total_kg: Optional[Decimal] = None
    subtotal: Decimal
    descuento: Decimal
    total: Decimal
    remito_padre_id: Optional[UUID] = None
    remito_padre_numero: Optional[str] = None
    movimiento_cc_id: Optional[UUID] = None
    emitido_por_nombre: Optional[str] = None
    entregado_por_nombre: Optional[str] = None
    notas: Optional[str] = None
    notas_entrega: Optional[str] = None
    activo: bool
    created_at: datetime
    # Detalles
    detalles: List[DetalleRemitoResponse] = []
    # Remitos complementarios
    tiene_complemento: bool = False
    remitos_complementarios: List["RemitoListResponse"] = []

    class Config:
        from_attributes = True


class RemitoListResponse(BaseModel):
    """Schema para lista de remitos."""
    id: UUID
    numero: str
    lote_numero: str
    cliente_nombre: str
    tipo: str
    estado: str
    fecha_emision: date
    total: Decimal
    tiene_complemento: bool = False

    class Config:
        from_attributes = True


# ==================== ACCIONES DE REMITO ====================

class EmitirRemitoRequest(BaseModel):
    """Request para emitir remito (genera cargo en CC)."""
    pass  # Por ahora sin campos adicionales


class EntregarRemitoRequest(BaseModel):
    """Request para marcar remito como entregado."""
    notas_entrega: Optional[str] = None
    fecha_entrega: Optional[datetime] = None


class AnularRemitoRequest(BaseModel):
    """Request para anular remito."""
    motivo: str = Field(..., min_length=10, description="Motivo de anulación")


class EmitirRemitoResponse(BaseModel):
    """Response de emitir remito."""
    remito_id: UUID
    remito_numero: str
    movimiento_cc_id: UUID
    total: Decimal
    mensaje: str


# ==================== GENERAR REMITO DESDE LOTE ====================

class GenerarRemitoRequest(BaseModel):
    """Request para generar remito desde la etapa de conteo."""
    detalles: List[DetalleRemitoCreate] = Field(..., min_length=1)
    peso_total_kg: Optional[Decimal] = Field(None, ge=0)
    notas: Optional[str] = None
    # Para relevado
    items_relevado: Optional[List[dict]] = Field(None, description="Items a relavar: [{producto_id, cantidad}]")


class GenerarRemitoResponse(BaseModel):
    """Response de generar remito."""
    remito_id: UUID
    remito_numero: str
    tipo: str
    total: Decimal
    movimiento_cc_id: UUID
    lote_estado: str
    # Si se generó relevado
    lote_relevado_id: Optional[UUID] = None
    lote_relevado_numero: Optional[str] = None
    mensaje: str


# ==================== CONSTANTES ====================

TIPOS_REMITO = [
    {"value": "normal", "label": "Normal"},
    {"value": "parcial", "label": "Parcial"},
    {"value": "complementario", "label": "Complementario"},
]

ESTADOS_REMITO = [
    {"value": "borrador", "label": "Borrador", "color": "#6B7280"},
    {"value": "emitido", "label": "Emitido", "color": "#3B82F6"},
    {"value": "entregado", "label": "Entregado", "color": "#22C55E"},
    {"value": "anulado", "label": "Anulado", "color": "#EF4444"},
]
