"""Endpoints del módulo de Recolección.

El repartidor (o quien tenga acceso al kiosko) inicia un retiro
identificándose con PIN, sin necesidad de loguearse formalmente.
"""

from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_permission
from app.models.usuario import Usuario
from app.schemas.recoleccion import (
    IniciarRecoleccionRequest,
    IniciarRecoleccionResponse,
    RecoleccionItem,
)
from app.services.recoleccion_service import RecoleccionService


router = APIRouter()


@router.post("/iniciar", response_model=IniciarRecoleccionResponse)
def iniciar_recoleccion(
    data: IniciarRecoleccionRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Valida el PIN del repartidor y crea el pedido en estado 'en camino'."""
    service = RecoleccionService(db)
    return service.iniciar_recoleccion(data, current_user.id)


@router.get("/del-dia", response_model=List[RecoleccionItem])
def listar_recolecciones_del_dia(
    fecha: Optional[date] = Query(None, description="Por defecto hoy"),
    repartidor_id: Optional[UUID] = Query(None, description="Filtrar por repartidor"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(
        require_permission(
            "superadmin",
            "administrador",
            "jefe_produccion",
            "operador",
            "comercial",
        )
    ),
):
    """Lista las recolecciones registradas en una fecha."""
    service = RecoleccionService(db)
    return service.listar_recolecciones_del_dia(fecha=fecha, repartidor_id=repartidor_id)
