"""
Schemas de Proveedor.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator
import re


class ProveedorBase(BaseModel):
    """Base schema para proveedor."""
    razon_social: str = Field(..., min_length=1, max_length=255)
    nombre_fantasia: Optional[str] = Field(None, max_length=255)
    cuit: str = Field(..., min_length=11, max_length=13)
    direccion: Optional[str] = Field(None, max_length=500)
    ciudad: Optional[str] = Field(None, max_length=100)
    provincia: str = Field(default="Córdoba", max_length=100)
    codigo_postal: Optional[str] = Field(None, max_length=10)
    telefono: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    sitio_web: Optional[str] = Field(None, max_length=255)
    contacto_nombre: Optional[str] = Field(None, max_length=255)
    contacto_telefono: Optional[str] = Field(None, max_length=50)
    contacto_email: Optional[EmailStr] = None
    condicion_pago: Optional[str] = Field(None, max_length=100)
    dias_entrega_estimados: Optional[str] = Field(None, max_length=50)
    descuento_habitual: Optional[str] = Field(None, max_length=50)
    rubro: Optional[str] = Field(None, max_length=100)
    activo: bool = True
    notas: Optional[str] = None

    @field_validator('cuit')
    @classmethod
    def validar_cuit(cls, v: str) -> str:
        # Limpiar el CUIT
        cuit_limpio = re.sub(r'\D', '', v)
        if len(cuit_limpio) != 11:
            raise ValueError('El CUIT debe tener 11 dígitos')
        return cuit_limpio

    @field_validator('email', 'contacto_email', mode='before')
    @classmethod
    def empty_str_to_none_email(cls, v):
        """Convierte strings vacíos a None para campos de email."""
        if v == '' or v is None:
            return None
        return v

    @field_validator('nombre_fantasia', 'direccion', 'ciudad', 'codigo_postal',
                     'telefono', 'sitio_web', 'contacto_nombre', 'contacto_telefono',
                     'condicion_pago', 'dias_entrega_estimados', 'descuento_habitual',
                     'rubro', 'notas', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        """Convierte strings vacíos a None para campos opcionales."""
        if v == '':
            return None
        return v


class ProveedorCreate(ProveedorBase):
    """Schema para crear proveedor."""
    pass


class ProveedorUpdate(BaseModel):
    """Schema para actualizar proveedor."""
    razon_social: Optional[str] = Field(None, min_length=1, max_length=255)
    nombre_fantasia: Optional[str] = Field(None, max_length=255)
    cuit: Optional[str] = Field(None, min_length=11, max_length=13)
    direccion: Optional[str] = Field(None, max_length=500)
    ciudad: Optional[str] = Field(None, max_length=100)
    provincia: Optional[str] = Field(None, max_length=100)
    codigo_postal: Optional[str] = Field(None, max_length=10)
    telefono: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    sitio_web: Optional[str] = Field(None, max_length=255)
    contacto_nombre: Optional[str] = Field(None, max_length=255)
    contacto_telefono: Optional[str] = Field(None, max_length=50)
    contacto_email: Optional[EmailStr] = None
    condicion_pago: Optional[str] = Field(None, max_length=100)
    dias_entrega_estimados: Optional[str] = Field(None, max_length=50)
    descuento_habitual: Optional[str] = Field(None, max_length=50)
    rubro: Optional[str] = Field(None, max_length=100)
    activo: Optional[bool] = None
    notas: Optional[str] = None

    @field_validator('cuit')
    @classmethod
    def validar_cuit(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        cuit_limpio = re.sub(r'\D', '', v)
        if len(cuit_limpio) != 11:
            raise ValueError('El CUIT debe tener 11 dígitos')
        return cuit_limpio

    @field_validator('email', 'contacto_email', mode='before')
    @classmethod
    def empty_str_to_none_email(cls, v):
        """Convierte strings vacíos a None para campos de email."""
        if v == '' or v is None:
            return None
        return v

    @field_validator('nombre_fantasia', 'direccion', 'ciudad', 'codigo_postal',
                     'telefono', 'sitio_web', 'contacto_nombre', 'contacto_telefono',
                     'condicion_pago', 'dias_entrega_estimados', 'descuento_habitual',
                     'rubro', 'notas', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        """Convierte strings vacíos a None para campos opcionales."""
        if v == '':
            return None
        return v


class ProveedorInDB(ProveedorBase):
    """Schema de proveedor en BD."""
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool = True

    class Config:
        from_attributes = True


class ProveedorResponse(ProveedorInDB):
    """Schema de respuesta de proveedor."""
    nombre_display: Optional[str] = None
    cuit_formateado: Optional[str] = None
    cantidad_productos: Optional[int] = None
    cantidad_ordenes: Optional[int] = None
    calificacion: Optional[int] = None


class ProveedorList(BaseModel):
    """Schema para lista simplificada (dropdowns)."""
    id: UUID
    razon_social: str
    nombre_fantasia: Optional[str] = None
    cuit: str

    class Config:
        from_attributes = True

    @property
    def nombre_display(self) -> str:
        return self.nombre_fantasia or self.razon_social
