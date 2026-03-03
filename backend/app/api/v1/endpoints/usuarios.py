"""
Endpoints de Usuarios.
CRUD de usuarios del sistema.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.deps import (
    get_client_ip,
    get_current_active_user,
    get_current_admin_or_superadmin,
    get_db,
)
from app.core.permissions import verificar_permiso
from app.models.usuario import Usuario
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.usuario import UsuarioCreate, UsuarioResponse, UsuarioUpdate
from app.services.usuario_service import usuario_service

router = APIRouter()


@router.get(
    "/",
    response_model=PaginatedResponse[UsuarioResponse],
    summary="Listar usuarios",
    description="Obtiene una lista paginada de usuarios con filtros opcionales.",
)
async def listar_usuarios(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
    skip: int = Query(0, ge=0, description="Registros a omitir"),
    limit: int = Query(20, ge=1, le=100, description="Límite de registros"),
    search: Optional[str] = Query(None, description="Búsqueda por nombre, apellido o email"),
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    rol: Optional[str] = Query(None, description="Filtrar por rol"),
):
    """
    Lista usuarios con paginación y filtros.

    Permisos requeridos: usuarios.ver
    """
    verificar_permiso(current_user, "usuarios.ver")

    usuarios, total = usuario_service.obtener_todos(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        activo=activo,
        rol=rol,
    )

    return PaginatedResponse(
        items=[UsuarioResponse.model_validate(u) for u in usuarios],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{usuario_id}",
    response_model=UsuarioResponse,
    summary="Obtener usuario",
    description="Obtiene un usuario específico por su ID.",
)
async def obtener_usuario(
    usuario_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
):
    """
    Obtiene un usuario por ID.

    Permisos requeridos: usuarios.ver
    """
    verificar_permiso(current_user, "usuarios.ver")

    usuario = usuario_service.obtener_por_id(db, usuario_id)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    return UsuarioResponse.model_validate(usuario)


@router.post(
    "/",
    response_model=UsuarioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear usuario",
    description="Crea un nuevo usuario en el sistema.",
)
async def crear_usuario(
    data: UsuarioCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin_or_superadmin),
):
    """
    Crea un nuevo usuario.

    Permisos requeridos: usuarios.crear (admin o superadmin)

    Validaciones:
    - Email único
    - Password con requisitos de seguridad
    - Solo superadmin puede crear otros superadmins
    """
    verificar_permiso(current_user, "usuarios.crear")

    # Solo superadmin puede crear superadmins
    if data.rol == "superadmin" and current_user.rol != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un superadmin puede crear otro superadmin",
        )

    ip = get_client_ip(request)
    usuario = usuario_service.crear(
        db=db,
        data=data,
        creado_por=current_user.id,
        ip=ip,
    )

    return UsuarioResponse.model_validate(usuario)


@router.put(
    "/{usuario_id}",
    response_model=UsuarioResponse,
    summary="Actualizar usuario",
    description="Actualiza los datos de un usuario existente.",
)
async def actualizar_usuario(
    usuario_id: UUID,
    data: UsuarioUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin_or_superadmin),
):
    """
    Actualiza un usuario existente.

    Permisos requeridos: usuarios.editar (admin o superadmin)

    Validaciones:
    - Solo superadmin puede modificar superadmins
    - Email único si se cambia
    """
    verificar_permiso(current_user, "usuarios.editar")

    # Verificar que existe
    usuario_existente = usuario_service.obtener_por_id(db, usuario_id)
    if not usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    # Solo superadmin puede modificar superadmins
    if usuario_existente.rol == "superadmin" and current_user.rol != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un superadmin puede modificar otro superadmin",
        )

    # Solo superadmin puede asignar rol superadmin
    if data.rol == "superadmin" and current_user.rol != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un superadmin puede asignar el rol de superadmin",
        )

    ip = get_client_ip(request)
    usuario = usuario_service.actualizar(
        db=db,
        usuario_id=usuario_id,
        data=data,
        actualizado_por=current_user.id,
        ip=ip,
    )

    return UsuarioResponse.model_validate(usuario)


@router.delete(
    "/{usuario_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar usuario",
    description="Desactiva (soft delete) un usuario.",
)
async def eliminar_usuario(
    usuario_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin_or_superadmin),
):
    """
    Elimina (soft delete) un usuario.

    Permisos requeridos: usuarios.eliminar (admin o superadmin)

    Validaciones:
    - No se puede eliminar a uno mismo
    - Solo superadmin puede eliminar superadmins
    """
    verificar_permiso(current_user, "usuarios.eliminar")

    # No permitir eliminarse a sí mismo
    if usuario_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes eliminarte a ti mismo",
        )

    # Verificar que existe y permisos
    usuario_existente = usuario_service.obtener_por_id(db, usuario_id)
    if not usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    # Solo superadmin puede eliminar superadmins
    if usuario_existente.rol == "superadmin" and current_user.rol != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un superadmin puede eliminar otro superadmin",
        )

    ip = get_client_ip(request)
    usuario_service.eliminar(
        db=db,
        usuario_id=usuario_id,
        eliminado_por=current_user.id,
        ip=ip,
    )


@router.put(
    "/{usuario_id}/toggle-activo",
    response_model=UsuarioResponse,
    summary="Activar/Desactivar usuario",
    description="Cambia el estado activo de un usuario.",
)
async def toggle_activo_usuario(
    usuario_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin_or_superadmin),
):
    """
    Activa o desactiva un usuario.

    Permisos requeridos: usuarios.editar (admin o superadmin)
    """
    verificar_permiso(current_user, "usuarios.editar")

    # No permitir desactivarse a sí mismo
    if usuario_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivarte a ti mismo",
        )

    ip = get_client_ip(request)
    usuario = usuario_service.toggle_activo(
        db=db,
        usuario_id=usuario_id,
        actualizado_por=current_user.id,
        ip=ip,
    )

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    return UsuarioResponse.model_validate(usuario)
