"""
Servicio de Autenticación.
Maneja login, logout, tokens, y validación de usuarios.
"""

import logging
from datetime import datetime
from typing import Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.models.usuario import Usuario
from app.schemas.auth import LoginRequest, TokenResponse
from app.services.log_service import log_service


class AuthService:
    """Servicio de autenticación."""

    def autenticar_usuario(
        self,
        db: Session,
        email: str,
        password: str,
        ip: Optional[str] = None,
    ) -> Tuple[Usuario, TokenResponse]:
        """
        Autentica un usuario con email y contraseña.

        Args:
            db: Sesión de base de datos
            email: Email del usuario
            password: Contraseña en texto plano
            ip: IP del cliente (para logging)

        Returns:
            Tuple con el usuario y los tokens

        Raises:
            HTTPException 401: Credenciales inválidas
            HTTPException 403: Usuario inactivo
        """
        # Buscar usuario por email
        usuario = db.query(Usuario).filter(Usuario.email == email).first()

        if not usuario:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas",
            )

        # Verificar contraseña
        if not verify_password(password, usuario.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas",
            )

        # Verificar que el usuario esté activo
        if not usuario.activo:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuario desactivado. Contacta al administrador.",
            )

        # Actualizar último acceso
        usuario.actualizar_ultimo_acceso()
        db.commit()

        # Generar tokens
        tokens = self._generar_tokens(usuario)

        # Registrar login
        log_service.registrar(
            db=db,
            usuario_id=usuario.id,
            accion="login",
            modulo="auth",
            descripcion=f"Inicio de sesión exitoso",
            ip=ip,
        )

        return usuario, tokens

    def _generar_tokens(self, usuario: Usuario) -> TokenResponse:
        """Genera access y refresh tokens para un usuario."""
        token_data = {"sub": str(usuario.id)}

        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
        )

    def refrescar_token(
        self,
        db: Session,
        refresh_token: str,
    ) -> TokenResponse:
        """
        Genera nuevos tokens usando un refresh token válido.

        Args:
            db: Sesión de base de datos
            refresh_token: Token de refresh

        Returns:
            Nuevos tokens

        Raises:
            HTTPException 401: Token inválido o expirado
        """
        # Decodificar token
        payload = decode_token(refresh_token)

        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado",
            )

        # Verificar que sea un refresh token
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido",
            )

        # Obtener usuario
        user_id = payload.get("sub")
        usuario = db.query(Usuario).filter(Usuario.id == user_id).first()

        if not usuario or not usuario.activo:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario no encontrado o inactivo",
            )

        # Generar nuevos tokens
        return self._generar_tokens(usuario)

    def obtener_usuario_actual(
        self,
        db: Session,
        token: str,
    ) -> Usuario:
        """
        Obtiene el usuario actual desde un access token.

        Args:
            db: Sesión de base de datos
            token: Access token

        Returns:
            Usuario autenticado

        Raises:
            HTTPException 401: Token inválido o usuario no encontrado
        """
        # Decodificar token
        payload = decode_token(token)

        if not payload:
            logger.warning(f"Token inválido o expirado: {token[:20]}...")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado",
            )

        # Verificar que sea un access token
        if payload.get("type") != "access":
            logger.warning(f"Token no es access, tipo: {payload.get('type')}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido",
            )

        # Obtener usuario
        user_id = payload.get("sub")
        usuario = db.query(Usuario).filter(Usuario.id == user_id).first()

        if not usuario:
            logger.warning(f"Usuario no encontrado: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario no encontrado",
            )

        if not usuario.activo:
            logger.warning(f"Usuario inactivo: {usuario.email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuario desactivado",
            )

        return usuario

    def cambiar_password(
        self,
        db: Session,
        usuario: Usuario,
        password_actual: str,
        password_nuevo: str,
        ip: Optional[str] = None,
    ) -> None:
        """
        Cambia la contraseña de un usuario.

        Args:
            db: Sesión de base de datos
            usuario: Usuario que cambia su contraseña
            password_actual: Contraseña actual
            password_nuevo: Nueva contraseña
            ip: IP del cliente

        Raises:
            HTTPException 400: Contraseña actual incorrecta
        """
        # Verificar contraseña actual
        if not verify_password(password_actual, usuario.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contraseña actual incorrecta",
            )

        # Actualizar contraseña
        usuario.password_hash = get_password_hash(password_nuevo)
        usuario.debe_cambiar_password = False
        db.commit()

        # Registrar cambio
        log_service.registrar(
            db=db,
            usuario_id=usuario.id,
            accion="editar",
            modulo="auth",
            descripcion="Cambio de contraseña",
            ip=ip,
        )

    def logout(
        self,
        db: Session,
        usuario: Usuario,
        ip: Optional[str] = None,
    ) -> None:
        """
        Registra el logout del usuario.
        (En una implementación más completa, se invalidaría el token)
        """
        log_service.registrar(
            db=db,
            usuario_id=usuario.id,
            accion="logout",
            modulo="auth",
            descripcion="Cierre de sesión",
            ip=ip,
        )


# Instancia singleton del servicio
auth_service = AuthService()
