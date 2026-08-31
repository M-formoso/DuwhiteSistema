"""
Schemas de configuración del sistema (singleton).
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ConfiguracionEmpresa(BaseModel):
    """Datos de la empresa (tab Empresa del panel de configuración)."""

    empresa_nombre: str = Field("", max_length=150)
    empresa_razon_social: str = Field("", max_length=200)
    empresa_cuit: str = Field("", max_length=20)
    empresa_condicion_iva: str = Field("Responsable Inscripto", max_length=50)
    empresa_direccion: str = Field("", max_length=200)
    empresa_localidad: str = Field("", max_length=100)
    empresa_provincia: str = Field("", max_length=100)
    empresa_codigo_postal: str = Field("", max_length=20)
    empresa_telefono: str = Field("", max_length=50)
    empresa_email: str = Field("", max_length=150)
    empresa_sitio_web: str = Field("", max_length=150)


class ConfiguracionResponse(ConfiguracionEmpresa):
    """Configuración completa con metadatos."""

    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConfiguracionUpdate(BaseModel):
    """Payload parcial para actualizar la configuración."""

    empresa_nombre: Optional[str] = Field(None, max_length=150)
    empresa_razon_social: Optional[str] = Field(None, max_length=200)
    empresa_cuit: Optional[str] = Field(None, max_length=20)
    empresa_direccion: Optional[str] = Field(None, max_length=200)
    empresa_localidad: Optional[str] = Field(None, max_length=100)
    empresa_provincia: Optional[str] = Field(None, max_length=100)
    empresa_codigo_postal: Optional[str] = Field(None, max_length=20)
    empresa_telefono: Optional[str] = Field(None, max_length=50)
    empresa_email: Optional[str] = Field(None, max_length=150)
    empresa_sitio_web: Optional[str] = Field(None, max_length=150)
    # empresa_condicion_iva queda read-only: cambiarlo desde la UI podría
    # romper la lógica fiscal (AFIP/ARCA asume Responsable Inscripto).
