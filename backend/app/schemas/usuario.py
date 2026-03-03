"""
Schemas de Usuario para validación y serialización.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class UsuarioBase(BaseModel):
    """Campos comunes de usuario."""

    email: EmailStr
    nombre: str = Field(..., min_length=2, max_length=100)
    apellido: str = Field(..., min_length=2, max_length=100)
    rol: str = Field(default="operador")

    @field_validator("rol")
    @classmethod
    def validar_rol(cls, v: str) -> str:
        roles_validos = [
            "superadmin",
            "administrador",
            "jefe_produccion",
            "operador",
            "comercial",
            "contador",
            "solo_lectura",
        ]
        if v not in roles_validos:
            raise ValueError(f"Rol inválido. Roles válidos: {roles_validos}")
        return v


class UsuarioCreate(UsuarioBase):
    """Schema para crear usuario."""

    password: str = Field(..., min_length=8, max_length=100)
    empleado_id: Optional[UUID] = None

    @field_validator("password")
    @classmethod
    def validar_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        if not any(c.isupper() for c in v):
            raise ValueError("La contraseña debe tener al menos una mayúscula")
        if not any(c.islower() for c in v):
            raise ValueError("La contraseña debe tener al menos una minúscula")
        if not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe tener al menos un número")
        return v


class UsuarioUpdate(BaseModel):
    """Schema para actualizar usuario."""

    email: Optional[EmailStr] = None
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=100)
    apellido: Optional[str] = Field(default=None, min_length=2, max_length=100)
    rol: Optional[str] = None
    avatar: Optional[str] = None
    empleado_id: Optional[UUID] = None
    activo: Optional[bool] = None

    @field_validator("rol")
    @classmethod
    def validar_rol(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        roles_validos = [
            "superadmin",
            "administrador",
            "jefe_produccion",
            "operador",
            "comercial",
            "contador",
            "solo_lectura",
        ]
        if v not in roles_validos:
            raise ValueError(f"Rol inválido. Roles válidos: {roles_validos}")
        return v


class UsuarioResponse(UsuarioBase):
    """Schema de respuesta de usuario."""

    id: UUID
    avatar: Optional[str] = None
    debe_cambiar_password: bool
    ultimo_acceso: Optional[datetime] = None
    empleado_id: Optional[UUID] = None
    activo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UsuarioSimple(BaseModel):
    """Schema simplificado de usuario (para listas, referencias)."""

    id: UUID
    email: str
    nombre: str
    apellido: str
    rol: str

    class Config:
        from_attributes = True

    @property
    def nombre_completo(self) -> str:
        return f"{self.nombre} {self.apellido}"


class CambiarPasswordRequest(BaseModel):
    """Schema para cambiar contraseña."""

    password_actual: str = Field(..., min_length=1)
    password_nuevo: str = Field(..., min_length=8)

    @field_validator("password_nuevo")
    @classmethod
    def validar_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        if not any(c.isupper() for c in v):
            raise ValueError("La contraseña debe tener al menos una mayúscula")
        if not any(c.islower() for c in v):
            raise ValueError("La contraseña debe tener al menos una minúscula")
        if not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe tener al menos un número")
        return v
