"""
Endpoints de Usuarios.
CRUD de usuarios del sistema con gestión de permisos.
"""

from typing import Optional, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.deps import (
    get_client_ip,
    get_current_active_user,
    get_current_admin_or_superadmin,
    get_current_superadmin,
    get_db,
)
from app.models.usuario import Usuario, MODULOS_SISTEMA, PERMISOS_POR_ROL
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.usuario import (
    UsuarioCreate,
    UsuarioResponse,
    UsuarioUpdate,
    UsuarioListItem,
    UsuarioConCredenciales,
    UsuarioCreateForClient,
    ResetPasswordRequest,
    PermisosModulosResponse,
)
from app.services.usuario_service import usuario_service

router = APIRouter()


def usuario_to_list_item(usuario: Usuario) -> UsuarioListItem:
    """Convierte usuario a item de lista."""
    return UsuarioListItem(
        id=usuario.id,
        email=usuario.email,
        nombre=usuario.nombre,
        apellido=usuario.apellido,
        telefono=usuario.telefono,
        rol=usuario.rol,
        activo=usuario.activo,
        ultimo_acceso=usuario.ultimo_acceso,
        cliente_id=usuario.cliente_id,
        cliente_nombre=usuario.cliente.razon_social if usuario.cliente else None,
        tiene_password_visible=usuario.password_visible is not None,
        created_at=usuario.created_at,
    )


def usuario_to_response(usuario: Usuario) -> UsuarioResponse:
    """Convierte usuario a respuesta completa."""
    return UsuarioResponse(
        id=usuario.id,
        email=usuario.email,
        nombre=usuario.nombre,
        apellido=usuario.apellido,
        telefono=usuario.telefono,
        rol=usuario.rol,
        avatar=usuario.avatar,
        debe_cambiar_password=usuario.debe_cambiar_password,
        ultimo_acceso=usuario.ultimo_acceso,
        cliente_id=usuario.cliente_id,
        cliente_nombre=usuario.cliente.razon_social if usuario.cliente else None,
        permisos_modulos=usuario.permisos_modulos,
        permisos_efectivos=usuario.get_permisos(),
        activo=usuario.activo,
        created_at=usuario.created_at,
        updated_at=usuario.updated_at,
    )


def usuario_to_response_con_credenciales(usuario: Usuario) -> UsuarioConCredenciales:
    """Convierte usuario a respuesta con credenciales visibles."""
    return UsuarioConCredenciales(
        id=usuario.id,
        email=usuario.email,
        nombre=usuario.nombre,
        apellido=usuario.apellido,
        telefono=usuario.telefono,
        rol=usuario.rol,
        avatar=usuario.avatar,
        debe_cambiar_password=usuario.debe_cambiar_password,
        ultimo_acceso=usuario.ultimo_acceso,
        cliente_id=usuario.cliente_id,
        cliente_nombre=usuario.cliente.razon_social if usuario.cliente else None,
        permisos_modulos=usuario.permisos_modulos,
        permisos_efectivos=usuario.get_permisos(),
        activo=usuario.activo,
        created_at=usuario.created_at,
        updated_at=usuario.updated_at,
        password_visible=usuario.password_visible,
    )


@router.get(
    "",
    response_model=PaginatedResponse,
    summary="Listar usuarios",
    description="Obtiene una lista paginada de usuarios con filtros opcionales.",
)
async def listar_usuarios(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin_or_superadmin),
    skip: int = Query(0, ge=0, description="Registros a omitir"),
    limit: int = Query(20, ge=1, le=100, description="Límite de registros"),
    search: Optional[str] = Query(None, description="Búsqueda por nombre, apellido o email"),
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
    rol: Optional[str] = Query(None, description="Filtrar por rol"),
    solo_clientes: bool = Query(False, description="Solo usuarios de tipo cliente"),
):
    """
    Lista usuarios con paginación y filtros.

    Permisos requeridos: administrador o superadmin
    """
    usuarios, total = usuario_service.obtener_todos(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        activo=activo,
        rol=rol,
        solo_clientes=solo_clientes,
    )

    return PaginatedResponse(
        items=[usuario_to_list_item(u) for u in usuarios],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/modulos-permisos",
    response_model=PermisosModulosResponse,
    summary="Obtener módulos y permisos",
    description="Obtiene la lista de módulos disponibles y permisos por rol.",
)
async def obtener_modulos_permisos(
    current_user: Usuario = Depends(get_current_admin_or_superadmin),
):
    """
    Obtiene los módulos del sistema y los permisos predefinidos por rol.
    Útil para el formulario de creación/edición de usuarios.
    """
    return PermisosModulosResponse(
        modulos_disponibles=MODULOS_SISTEMA,
        permisos_por_rol=PERMISOS_POR_ROL,
    )


@router.get(
    "/por-cliente/{cliente_id}",
    response_model=list[UsuarioConCredenciales],
    summary="Usuarios de un cliente",
    description="Obtiene los usuarios vinculados a un cliente específico.",
)
async def obtener_usuarios_cliente(
    cliente_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin_or_superadmin),
):
    """
    Obtiene usuarios vinculados a un cliente.
    Incluye las credenciales visibles si están disponibles.
    """
    usuarios = usuario_service.obtener_por_cliente(db, cliente_id)
    return [usuario_to_response_con_credenciales(u) for u in usuarios]


@router.get(
    "/{usuario_id}",
    response_model=UsuarioResponse,
    summary="Obtener usuario",
    description="Obtiene un usuario específico por su ID.",
)
async def obtener_usuario(
    usuario_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin_or_superadmin),
):
    """
    Obtiene un usuario por ID.
    """
    usuario = usuario_service.obtener_por_id(db, usuario_id)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    return usuario_to_response(usuario)


@router.get(
    "/{usuario_id}/con-credenciales",
    response_model=UsuarioConCredenciales,
    summary="Obtener usuario con credenciales",
    description="Obtiene un usuario con su contraseña visible (si está disponible).",
)
async def obtener_usuario_con_credenciales(
    usuario_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_superadmin),
):
    """
    Obtiene un usuario con credenciales visibles.
    Solo disponible para superadmins.
    """
    usuario = usuario_service.obtener_por_id(db, usuario_id)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    return usuario_to_response_con_credenciales(usuario)


@router.post(
    "",
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

    Validaciones:
    - Email único
    - Password con requisitos de seguridad
    - Solo superadmin puede crear otros superadmins
    """
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

    return usuario_to_response(usuario)


@router.post(
    "/para-cliente",
    response_model=UsuarioConCredenciales,
    status_code=status.HTTP_201_CREATED,
    summary="Crear usuario para cliente",
    description="Crea un usuario vinculado a un cliente existente.",
)
async def crear_usuario_para_cliente(
    data: UsuarioCreateForClient,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin_or_superadmin),
):
    """
    Crea un usuario vinculado a un cliente.
    El usuario tendrá rol 'cliente' y permisos limitados.
    La contraseña se guarda visible para poder mostrársela al cliente.
    """
    ip = get_client_ip(request)
    usuario = usuario_service.crear_para_cliente(
        db=db,
        data=data,
        creado_por=current_user.id,
        ip=ip,
    )

    return usuario_to_response_con_credenciales(usuario)


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

    Validaciones:
    - Solo superadmin puede modificar superadmins
    - Email único si se cambia
    """
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

    return usuario_to_response(usuario)


@router.put(
    "/{usuario_id}/permisos",
    response_model=UsuarioResponse,
    summary="Actualizar permisos",
    description="Actualiza los permisos de módulos de un usuario.",
)
async def actualizar_permisos_usuario(
    usuario_id: UUID,
    permisos: Dict[str, bool],
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_superadmin),
):
    """
    Actualiza los permisos personalizados de un usuario.
    Solo disponible para superadmins.
    """
    ip = get_client_ip(request)
    usuario = usuario_service.actualizar_permisos(
        db=db,
        usuario_id=usuario_id,
        permisos=permisos,
        actualizado_por=current_user.id,
        ip=ip,
    )

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    return usuario_to_response(usuario)


@router.put(
    "/{usuario_id}/reset-password",
    response_model=UsuarioResponse,
    summary="Resetear contraseña",
    description="Resetea la contraseña de un usuario.",
)
async def resetear_password_usuario(
    usuario_id: UUID,
    data: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin_or_superadmin),
):
    """
    Resetea la contraseña de un usuario.
    Opcionalmente puede guardar la contraseña visible.
    """
    # Verificar permisos para superadmins
    usuario_existente = usuario_service.obtener_por_id(db, usuario_id)
    if not usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    if usuario_existente.rol == "superadmin" and current_user.rol != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un superadmin puede resetear la contraseña de otro superadmin",
        )

    ip = get_client_ip(request)
    usuario = usuario_service.resetear_password(
        db=db,
        usuario_id=usuario_id,
        data=data,
        reseteado_por=current_user.id,
        ip=ip,
    )

    return usuario_to_response(usuario)


@router.delete(
    "/{usuario_id}",
    response_model=MessageResponse,
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

    Validaciones:
    - No se puede eliminar a uno mismo
    - Solo superadmin puede eliminar superadmins
    """
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

    return MessageResponse(message="Usuario eliminado correctamente")


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
    """
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

    return usuario_to_response(usuario)
