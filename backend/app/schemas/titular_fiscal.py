"""Schemas de TitularFiscal."""

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


CUIT_PATTERN = r"^\d{2}-\d{8}-\d{1}$"


def _validar_cuit(v: str) -> str:
    if not re.match(CUIT_PATTERN, v):
        raise ValueError("CUIT debe tener formato XX-XXXXXXXX-X")
    return v


class TitularFiscalBase(BaseModel):
    cuit: str = Field(..., min_length=13, max_length=13)
    razon_social_fiscal: str = Field(..., min_length=2, max_length=200)
    condicion_iva: str = "responsable_inscripto"
    direccion_fiscal: Optional[str] = None
    ciudad_fiscal: Optional[str] = None
    provincia_fiscal: str = "Córdoba"
    codigo_postal_fiscal: Optional[str] = None
    notas: Optional[str] = None

    @field_validator("cuit")
    @classmethod
    def validar_cuit(cls, v: str) -> str:
        return _validar_cuit(v)


class TitularFiscalCreate(TitularFiscalBase):
    pass


class TitularFiscalUpdate(BaseModel):
    cuit: Optional[str] = None
    razon_social_fiscal: Optional[str] = Field(None, min_length=2, max_length=200)
    condicion_iva: Optional[str] = None
    direccion_fiscal: Optional[str] = None
    ciudad_fiscal: Optional[str] = None
    provincia_fiscal: Optional[str] = None
    codigo_postal_fiscal: Optional[str] = None
    notas: Optional[str] = None
    activo: Optional[bool] = None

    @field_validator("cuit")
    @classmethod
    def validar_cuit(cls, v: Optional[str]) -> Optional[str]:
        return _validar_cuit(v) if v else v


class TitularFiscalResponse(TitularFiscalBase):
    id: str
    activo: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    cantidad_clientes: int = 0

    class Config:
        from_attributes = True


class TitularFiscalSelect(BaseModel):
    """Para dropdowns."""
    id: str
    cuit: str
    razon_social_fiscal: str
    condicion_iva: str

    class Config:
        from_attributes = True
