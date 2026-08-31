"""
Endpoints de configuración del sistema (singleton).

- GET /configuracion → cualquier usuario autenticado (la UI y varios PDFs
  necesitan estos datos).
- PUT /configuracion → solo superadmin y administrador.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.usuario import Usuario
from app.schemas.configuracion import ConfiguracionResponse, ConfiguracionUpdate
from app.services import configuracion_service


router = APIRouter()


_ROLES_EDICION = {"superadmin", "administrador"}


@router.get("/", response_model=ConfiguracionResponse)
def obtener_configuracion(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Devuelve la configuración global (singleton)."""
    return configuracion_service.get_configuracion(db)


@router.put("/", response_model=ConfiguracionResponse)
def actualizar_configuracion(
    data: ConfiguracionUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Actualiza la configuración global. Solo admin/superadmin."""
    if current_user.rol not in _ROLES_EDICION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenés permisos para editar la configuración del sistema",
        )

    config = configuracion_service.get_configuracion(db)
    return configuracion_service.actualizar_configuracion(db, config, data)
