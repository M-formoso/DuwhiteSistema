"""
Endpoints de Autenticación.
Login, logout, refresh token, cambio de contraseña.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.deps import get_client_ip, get_current_active_user, get_db
from app.models.usuario import Usuario
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    TokenResponse,
)
from app.schemas.common import MessageResponse
from app.schemas.usuario import CambiarPasswordRequest, UsuarioResponse
from app.services.auth_service import auth_service

router = APIRouter()


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Iniciar sesión",
    description="Autentica un usuario con email y contraseña. Retorna tokens JWT.",
)
async def login(
    data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Endpoint de login.

    - **email**: Email del usuario
    - **password**: Contraseña

    Retorna el usuario autenticado y tokens JWT (access + refresh).
    """
    ip = get_client_ip(request)
    usuario, tokens = auth_service.autenticar_usuario(
        db=db,
        email=data.email,
        password=data.password,
        ip=ip,
    )

    return LoginResponse(
        user=UsuarioResponse.model_validate(usuario),
        tokens=tokens,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refrescar token",
    description="Obtiene nuevos tokens usando un refresh token válido.",
)
async def refresh_token(
    data: RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    """
    Refresca los tokens JWT.

    - **refresh_token**: Token de refresh válido

    Retorna nuevos access y refresh tokens.
    """
    return auth_service.refrescar_token(db=db, refresh_token=data.refresh_token)


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Cerrar sesión",
    description="Registra el cierre de sesión del usuario.",
)
async def logout(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
):
    """
    Cierra la sesión del usuario actual.
    Registra el evento en el log de auditoría.
    """
    ip = get_client_ip(request)
    auth_service.logout(db=db, usuario=current_user, ip=ip)
    return MessageResponse(message="Sesión cerrada exitosamente")


@router.get(
    "/me",
    response_model=UsuarioResponse,
    summary="Usuario actual",
    description="Obtiene los datos del usuario autenticado.",
)
async def get_current_user_info(
    current_user: Usuario = Depends(get_current_active_user),
):
    """
    Retorna la información del usuario autenticado.
    """
    return UsuarioResponse.model_validate(current_user)


@router.put(
    "/change-password",
    response_model=MessageResponse,
    summary="Cambiar contraseña",
    description="Cambia la contraseña del usuario actual.",
)
async def change_password(
    data: CambiarPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
):
    """
    Cambia la contraseña del usuario actual.

    - **password_actual**: Contraseña actual
    - **password_nuevo**: Nueva contraseña (mínimo 8 caracteres, debe incluir mayúscula, minúscula y número)
    """
    ip = get_client_ip(request)
    auth_service.cambiar_password(
        db=db,
        usuario=current_user,
        password_actual=data.password_actual,
        password_nuevo=data.password_nuevo,
        ip=ip,
    )
    return MessageResponse(message="Contraseña actualizada exitosamente")
