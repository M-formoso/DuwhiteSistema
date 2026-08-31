"""
Schemas de Cliente.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr


# ==================== CLIENTE ====================

class ClienteBase(BaseModel):
    """Schema base de cliente. Los datos fiscales viven en TitularFiscal."""
    tipo: str = "particular"
    razon_social: str = Field(..., min_length=2, max_length=200)
    nombre_fantasia: Optional[str] = None
    titular_fiscal_id: Optional[str] = None
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None
    celular: Optional[str] = None
    contacto_nombre: Optional[str] = None
    contacto_cargo: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    provincia: str = "Córdoba"
    codigo_postal: Optional[str] = None
    descuento_general: Optional[Decimal] = Field(default=0, ge=0, le=100)
    limite_credito: Optional[Decimal] = None
    dias_credito: Optional[int] = Field(default=0, ge=0)
    dia_retiro_preferido: Optional[str] = None
    horario_retiro_preferido: Optional[str] = None
    requiere_factura: bool = False
    enviar_notificaciones: bool = True
    notas: Optional[str] = None
    notas_internas: Optional[str] = None


class ClienteCreate(ClienteBase):
    """Schema para crear cliente."""
    pass


class ClienteUpdate(BaseModel):
    """Schema para actualizar cliente."""
    tipo: Optional[str] = None
    razon_social: Optional[str] = Field(None, min_length=2, max_length=200)
    nombre_fantasia: Optional[str] = None
    titular_fiscal_id: Optional[str] = None
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None
    celular: Optional[str] = None
    contacto_nombre: Optional[str] = None
    contacto_cargo: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    provincia: Optional[str] = None
    codigo_postal: Optional[str] = None
    lista_precios_id: Optional[str] = None
    descuento_general: Optional[Decimal] = Field(default=None, ge=0, le=100)
    limite_credito: Optional[Decimal] = None
    dias_credito: Optional[int] = Field(default=None, ge=0)
    dia_retiro_preferido: Optional[str] = None
    horario_retiro_preferido: Optional[str] = None
    requiere_factura: Optional[bool] = None
    enviar_notificaciones: Optional[bool] = None
    notas: Optional[str] = None
    notas_internas: Optional[str] = None
    activo: Optional[bool] = None


class ClienteResponse(ClienteBase):
    """Schema de respuesta de cliente."""
    id: str
    codigo: str
    lista_precios_id: Optional[str] = None
    saldo_cuenta_corriente: Decimal
    fecha_alta: Optional[date] = None
    fecha_ultima_compra: Optional[date] = None
    activo: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Datos fiscales delegados al titular (properties del modelo)
    cuit: Optional[str] = None
    condicion_iva: str = "consumidor_final"

    # Calculados
    nombre_display: str
    tiene_deuda: bool
    supera_limite_credito: bool

    class Config:
        from_attributes = True


class ClienteList(BaseModel):
    """Schema simplificado para listados."""
    id: str
    codigo: str
    tipo: str
    razon_social: str
    nombre_fantasia: Optional[str] = None
    cuit: Optional[str] = None  # delegado al titular vía property
    email: Optional[str] = None
    telefono: Optional[str] = None
    ciudad: Optional[str] = None
    saldo_cuenta_corriente: Decimal
    activo: bool
    tiene_deuda: bool
    titular_fiscal_id: Optional[str] = None

    class Config:
        from_attributes = True


class ClienteSelect(BaseModel):
    """Schema para selectores/dropdowns."""
    id: str
    codigo: str
    nombre: str  # nombre_display
    cuit: Optional[str] = None  # delegado al titular vía property
    lista_precios_id: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== TIPOS Y CONSTANTES ====================

TIPOS_CLIENTE = [
    {"value": "particular", "label": "Particular"},
    {"value": "empresa", "label": "Empresa"},
    {"value": "hotel", "label": "Hotel"},
    {"value": "restaurante", "label": "Restaurante"},
    {"value": "hospital", "label": "Hospital"},
    {"value": "gimnasio", "label": "Gimnasio"},
    {"value": "otro", "label": "Otro"},
]

CONDICIONES_IVA = [
    {"value": "responsable_inscripto", "label": "Responsable Inscripto"},
    {"value": "monotributo", "label": "Monotributo"},
    {"value": "exento", "label": "Exento"},
    {"value": "consumidor_final", "label": "Consumidor Final"},
    {"value": "no_responsable", "label": "No Responsable"},
]
