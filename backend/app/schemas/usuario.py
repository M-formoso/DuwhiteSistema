"""
Schemas de Usuario para validación y serialización.
"""

from datetime import datetime
from typing import Optional, Dict
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


ROLES_VALIDOS = [
    "superadmin",
    "administrador",
    "jefe_produccion",
    "operador",
    "comercial",
    "contador",
    "solo_lectura",
    "cliente",
]


class UsuarioBase(BaseModel):
    """Campos comunes de usuario."""

    email: EmailStr
    nombre: str = Field(..., min_length=2, max_length=100)
    apellido: str = Field(..., min_length=2, max_length=100)
    rol: str = Field(default="operador")
    telefono: Optional[str] = Field(default=None, max_length=50)

    @field_validator("rol")
    @classmethod
    def validar_rol(cls, v: str) -> str:
        if v not in ROLES_VALIDOS:
            raise ValueError(f"Rol inválido. Roles válidos: {ROLES_VALIDOS}")
        return v


class UsuarioCreate(UsuarioBase):
    """Schema para crear usuario."""

    password: str = Field(..., min_length=8, max_length=100)
    empleado_id: Optional[UUID] = None
    cliente_id: Optional[UUID] = None
    permisos_modulos: Optional[Dict[str, bool]] = None
    guardar_password_visible: bool = False  # Si es True, guarda password en texto plano

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


class UsuarioCreateForClient(BaseModel):
    """Schema para crear usuario vinculado a un cliente."""

    cliente_id: UUID
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    nombre: Optional[str] = None  # Si no se provee, usa datos del cliente
    apellido: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validar_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v


class UsuarioUpdate(BaseModel):
    """Schema para actualizar usuario."""

    email: Optional[EmailStr] = None
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=100)
    apellido: Optional[str] = Field(default=None, min_length=2, max_length=100)
    telefono: Optional[str] = Field(default=None, max_length=50)
    rol: Optional[str] = None
    avatar: Optional[str] = None
    empleado_id: Optional[UUID] = None
    cliente_id: Optional[UUID] = None
    permisos_modulos: Optional[Dict[str, bool]] = None
    activo: Optional[bool] = None
    debe_cambiar_password: Optional[bool] = None

    @field_validator("rol")
    @classmethod
    def validar_rol(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if v not in ROLES_VALIDOS:
            raise ValueError(f"Rol inválido. Roles válidos: {ROLES_VALIDOS}")
        return v


class ResetPasswordRequest(BaseModel):
    """Schema para resetear contraseña de un usuario."""

    password_nuevo: str = Field(..., min_length=8)
    guardar_password_visible: bool = False


class UsuarioResponse(BaseModel):
    """Schema de respuesta de usuario."""

    id: UUID
    email: str
    nombre: str
    apellido: str
    telefono: Optional[str] = None
    rol: str
    avatar: Optional[str] = None
    debe_cambiar_password: bool
    ultimo_acceso: Optional[datetime] = None
    empleado_id: Optional[UUID] = None
    cliente_id: Optional[UUID] = None
    cliente_nombre: Optional[str] = None
    permisos_modulos: Optional[Dict[str, bool]] = None
    permisos_efectivos: Dict[str, bool] = {}
    activo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UsuarioConCredenciales(UsuarioResponse):
    """Schema de respuesta con credenciales visibles (para usuarios cliente)."""

    password_visible: Optional[str] = None


class UsuarioSimple(BaseModel):
    """Schema simplificado de usuario (para listas, referencias)."""

    id: UUID
    email: str
    nombre: str
    apellido: str
    rol: str
    activo: bool = True

    class Config:
        from_attributes = True

    @property
    def nombre_completo(self) -> str:
        return f"{self.nombre} {self.apellido}"


class UsuarioListItem(BaseModel):
    """Schema para lista de usuarios con info adicional."""

    id: UUID
    email: str
    nombre: str
    apellido: str
    telefono: Optional[str] = None
    rol: str
    activo: bool
    ultimo_acceso: Optional[datetime] = None
    cliente_id: Optional[UUID] = None
    cliente_nombre: Optional[str] = None
    tiene_password_visible: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


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


class PermisosModulosResponse(BaseModel):
    """Schema de respuesta con los módulos y permisos."""

    modulos_disponibles: list[str]
    permisos_por_rol: Dict[str, Dict[str, bool]]
