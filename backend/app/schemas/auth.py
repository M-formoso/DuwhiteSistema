"""
Schemas de Autenticación.
"""

from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.schemas.usuario import UsuarioResponse


class LoginRequest(BaseModel):
    """Schema para login."""

    email: EmailStr
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    """Schema de respuesta con tokens."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    """Respuesta completa de login."""

    user: UsuarioResponse
    tokens: TokenResponse


class RefreshTokenRequest(BaseModel):
    """Schema para refrescar token."""

    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    """Schema para solicitar reseteo de contraseña."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Schema para resetear contraseña con token."""

    token: str
    new_password: str = Field(..., min_length=8)


class TokenPayload(BaseModel):
    """Payload decodificado del token."""

    sub: str  # user_id
    exp: int  # expiration timestamp
    type: str  # 'access' o 'refresh'
