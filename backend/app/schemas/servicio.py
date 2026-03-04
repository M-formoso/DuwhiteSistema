"""
Schemas de Servicio.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field


class TipoServicioEnum:
    """Tipos de servicio disponibles."""
    LAVADO_NORMAL = "lavado_normal"
    LAVADO_DELICADO = "lavado_delicado"
    LAVADO_INDUSTRIAL = "lavado_industrial"
    LAVADO_SECO = "lavado_seco"
    PLANCHADO = "planchado"
    TINTORERIA = "tintoreria"
    DESMANCHADO = "desmanchado"
    ALMIDONADO = "almidonado"


class UnidadCobroEnum:
    """Unidades de cobro."""
    KILOGRAMO = "kg"
    PRENDA = "prenda"
    UNIDAD = "unidad"
    DOCENA = "docena"
    METRO = "metro"


# --- Servicio ---

class ServicioBase(BaseModel):
    """Base schema para servicio."""
    codigo: str = Field(..., min_length=1, max_length=20)
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = None
    tipo: str = Field(default=TipoServicioEnum.LAVADO_NORMAL, max_length=30)
    categoria: Optional[str] = Field(None, max_length=50)
    unidad_cobro: str = Field(default=UnidadCobroEnum.KILOGRAMO, max_length=20)
    precio_base: Decimal = Field(..., ge=0)
    tiempo_estimado_minutos: Optional[int] = Field(None, ge=0)
    mostrar_en_web: bool = False
    orden: int = 0
    notas: Optional[str] = None


class ServicioCreate(ServicioBase):
    """Schema para crear servicio."""
    pass


class ServicioUpdate(BaseModel):
    """Schema para actualizar servicio."""
    codigo: Optional[str] = Field(None, min_length=1, max_length=20)
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = None
    tipo: Optional[str] = Field(None, max_length=30)
    categoria: Optional[str] = Field(None, max_length=50)
    unidad_cobro: Optional[str] = Field(None, max_length=20)
    precio_base: Optional[Decimal] = Field(None, ge=0)
    tiempo_estimado_minutos: Optional[int] = Field(None, ge=0)
    activo: Optional[bool] = None
    mostrar_en_web: Optional[bool] = None
    orden: Optional[int] = None
    notas: Optional[str] = None


class ServicioInDB(ServicioBase):
    """Schema de servicio en BD."""
    id: UUID
    activo: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ServicioResponse(ServicioInDB):
    """Schema de respuesta de servicio."""
    pass


class ServicioList(BaseModel):
    """Schema para lista simplificada de servicios."""
    id: UUID
    codigo: str
    nombre: str
    tipo: str
    unidad_cobro: str
    precio_base: Decimal
    activo: bool

    class Config:
        from_attributes = True


# --- Lista de Precios ---

class ListaPreciosBase(BaseModel):
    """Base schema para lista de precios."""
    codigo: str = Field(..., min_length=1, max_length=20)
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = None
    es_lista_base: bool = False
    lista_base_id: Optional[UUID] = None
    porcentaje_modificador: Optional[Decimal] = Field(None, ge=-100, le=1000)
    fecha_vigencia_desde: Optional[str] = None
    fecha_vigencia_hasta: Optional[str] = None
    notas: Optional[str] = None


class ListaPreciosCreate(ListaPreciosBase):
    """Schema para crear lista de precios."""
    pass


class ListaPreciosUpdate(BaseModel):
    """Schema para actualizar lista de precios."""
    codigo: Optional[str] = Field(None, min_length=1, max_length=20)
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = None
    es_lista_base: Optional[bool] = None
    lista_base_id: Optional[UUID] = None
    porcentaje_modificador: Optional[Decimal] = Field(None, ge=-100, le=1000)
    fecha_vigencia_desde: Optional[str] = None
    fecha_vigencia_hasta: Optional[str] = None
    activa: Optional[bool] = None
    notas: Optional[str] = None


class ListaPreciosInDB(ListaPreciosBase):
    """Schema de lista de precios en BD."""
    id: UUID
    activa: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ListaPreciosResponse(ListaPreciosInDB):
    """Schema de respuesta de lista de precios."""
    lista_base_nombre: Optional[str] = None
    cantidad_items: int = 0


class ListaPreciosList(BaseModel):
    """Schema para lista simplificada."""
    id: UUID
    codigo: str
    nombre: str
    es_lista_base: bool
    activa: bool
    cantidad_items: int = 0

    class Config:
        from_attributes = True


# --- Item Lista de Precios ---

class ItemListaPreciosBase(BaseModel):
    """Base schema para item de lista de precios."""
    lista_id: UUID
    servicio_id: UUID
    precio: Decimal = Field(..., ge=0)
    precio_minimo: Optional[Decimal] = Field(None, ge=0)
    cantidad_minima: Optional[Decimal] = Field(None, ge=0)
    fecha_vigencia_desde: Optional[str] = None
    fecha_vigencia_hasta: Optional[str] = None


class ItemListaPreciosCreate(BaseModel):
    """Schema para crear item de lista de precios."""
    servicio_id: UUID
    precio: Decimal = Field(..., ge=0)
    precio_minimo: Optional[Decimal] = Field(None, ge=0)
    cantidad_minima: Optional[Decimal] = Field(None, ge=0)
    fecha_vigencia_desde: Optional[str] = None
    fecha_vigencia_hasta: Optional[str] = None


class ItemListaPreciosUpdate(BaseModel):
    """Schema para actualizar item de lista de precios."""
    precio: Optional[Decimal] = Field(None, ge=0)
    precio_minimo: Optional[Decimal] = Field(None, ge=0)
    cantidad_minima: Optional[Decimal] = Field(None, ge=0)
    fecha_vigencia_desde: Optional[str] = None
    fecha_vigencia_hasta: Optional[str] = None
    activo: Optional[bool] = None


class ItemListaPreciosInDB(ItemListaPreciosBase):
    """Schema de item en BD."""
    id: UUID
    activo: bool = True

    class Config:
        from_attributes = True


class ItemListaPreciosResponse(ItemListaPreciosInDB):
    """Schema de respuesta de item."""
    servicio_codigo: Optional[str] = None
    servicio_nombre: Optional[str] = None
    servicio_unidad_cobro: Optional[str] = None


# --- Response con items ---

class ListaPreciosConItems(ListaPreciosResponse):
    """Lista de precios con sus items."""
    items: List[ItemListaPreciosResponse] = []


# --- Tipos disponibles ---

class TipoServicioInfo(BaseModel):
    """Info de tipo de servicio."""
    value: str
    label: str


class UnidadCobroInfo(BaseModel):
    """Info de unidad de cobro."""
    value: str
    label: str
