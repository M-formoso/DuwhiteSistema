"""
Dependencias de FastAPI.
Funciones para inyección de dependencias en endpoints.
"""

from typing import Generator, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.usuario import Usuario
from app.services.auth_service import auth_service

# Security scheme para JWT
security = HTTPBearer()


async def get_current_user(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Usuario:
    """
    Obtiene el usuario actual desde el token JWT.

    Uso:
        @router.get("/")
        async def endpoint(current_user: Usuario = Depends(get_current_user)):
            ...
    """
    return auth_service.obtener_usuario_actual(db, credentials.credentials)


async def get_current_active_user(
    current_user: Usuario = Depends(get_current_user),
) -> Usuario:
    """
    Obtiene el usuario actual verificando que esté activo.
    """
    if not current_user.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo",
        )
    return current_user


async def get_current_superadmin(
    current_user: Usuario = Depends(get_current_active_user),
) -> Usuario:
    """
    Verifica que el usuario actual sea superadmin.
    """
    if current_user.rol != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de superadmin",
        )
    return current_user


async def get_current_admin_or_superadmin(
    current_user: Usuario = Depends(get_current_active_user),
) -> Usuario:
    """
    Verifica que el usuario sea admin o superadmin.
    """
    if current_user.rol not in ["superadmin", "administrador"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de administrador o superadmin",
        )
    return current_user


def get_client_ip(request: Request) -> Optional[str]:
    """
    Obtiene la IP del cliente desde el request.
    Considera headers de proxy (X-Forwarded-For, X-Real-IP).
    """
    # Intentar obtener IP real desde headers de proxy
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For puede contener múltiples IPs, la primera es la del cliente
        return forwarded_for.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Fallback a la IP directa
    if request.client:
        return request.client.host

    return None
