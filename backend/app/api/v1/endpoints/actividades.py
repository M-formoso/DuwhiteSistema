"""
Endpoints de Actividades/Tareas Internas.
"""

from datetime import date
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.usuario import Usuario
from app.services import actividad_service
from app.schemas.actividad import (
    ActividadCreate, ActividadUpdate, ActividadResponse, ActividadList,
    ActividadCambiarEstado, ActividadesPorEstado, ResumenActividades
)

router = APIRouter()


def actividad_to_response(actividad) -> dict:
    """Convierte una actividad a formato de respuesta."""
    return {
        "id": actividad.id,
        "titulo": actividad.titulo,
        "descripcion": actividad.descripcion,
        "categoria": actividad.categoria,
        "prioridad": actividad.prioridad,
        "estado": actividad.estado,
        "fecha_limite": actividad.fecha_limite,
        "fecha_completada": actividad.fecha_completada,
        "creado_por_id": actividad.creado_por_id,
        "creado_por_nombre": actividad.creado_por.nombre_completo if actividad.creado_por else None,
        "asignado_a_id": actividad.asignado_a_id,
        "asignado_a_nombre": actividad.asignado_a.nombre_completo if actividad.asignado_a else None,
        "etiquetas": actividad.etiquetas or [],
        "notas": actividad.notas,
        "is_active": actividad.is_active,
        "created_at": actividad.created_at,
        "updated_at": actividad.updated_at,
    }


@router.get("/", response_model=dict)
def listar_actividades(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    estado: Optional[str] = None,
    prioridad: Optional[str] = None,
    categoria: Optional[str] = None,
    asignado_a_id: Optional[UUID] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    mis_actividades: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista actividades con filtros y paginación."""
    # Si mis_actividades es True, filtrar por usuario actual
    user_filter = current_user.id if mis_actividades else None

    actividades = actividad_service.get_actividades(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        estado=estado,
        prioridad=prioridad,
        categoria=categoria,
        asignado_a_id=asignado_a_id or user_filter,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )

    total = actividad_service.count_actividades(
        db=db,
        search=search,
        estado=estado,
        prioridad=prioridad,
        categoria=categoria,
        asignado_a_id=asignado_a_id or user_filter,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )

    return {
        "items": [actividad_to_response(a) for a in actividades],
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/por-estado", response_model=ActividadesPorEstado)
def obtener_actividades_por_estado(
    mis_actividades: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene actividades agrupadas por estado."""
    user_id = current_user.id if mis_actividades else None
    resultado = actividad_service.get_actividades_por_estado(db, user_id)

    return {
        "pendiente": [actividad_to_response(a) for a in resultado['pendiente']],
        "en_progreso": [actividad_to_response(a) for a in resultado['en_progreso']],
        "completada": [actividad_to_response(a) for a in resultado['completada']]
    }


@router.get("/resumen", response_model=ResumenActividades)
def obtener_resumen(
    mis_actividades: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene resumen de actividades."""
    user_id = current_user.id if mis_actividades else None
    return actividad_service.get_resumen_actividades(db, user_id)


@router.get("/vencidas", response_model=List[ActividadList])
def obtener_vencidas(
    mis_actividades: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene actividades vencidas."""
    user_id = current_user.id if mis_actividades else None
    actividades = actividad_service.get_actividades_vencidas(db, user_id)
    return [actividad_to_response(a) for a in actividades]


@router.get("/proximas", response_model=List[ActividadList])
def obtener_proximas(
    dias: int = Query(7, ge=1, le=30),
    mis_actividades: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene actividades con fecha límite en los próximos X días."""
    user_id = current_user.id if mis_actividades else None
    actividades = actividad_service.get_actividades_proximas(db, dias, user_id)
    return [actividad_to_response(a) for a in actividades]


@router.get("/{actividad_id}", response_model=ActividadResponse)
def obtener_actividad(
    actividad_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene una actividad por ID."""
    actividad = actividad_service.get_actividad(db, actividad_id)
    if not actividad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Actividad no encontrada"
        )
    return actividad_to_response(actividad)


@router.post("/", response_model=ActividadResponse, status_code=status.HTTP_201_CREATED)
def crear_actividad(
    data: ActividadCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Crea una nueva actividad."""
    actividad = actividad_service.create_actividad(db, data, current_user.id)

    # Recargar con relaciones
    actividad = actividad_service.get_actividad(db, actividad.id)
    return actividad_to_response(actividad)


@router.put("/{actividad_id}", response_model=ActividadResponse)
def actualizar_actividad(
    actividad_id: UUID,
    data: ActividadUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Actualiza una actividad."""
    actividad = actividad_service.get_actividad(db, actividad_id)
    if not actividad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Actividad no encontrada"
        )

    actividad = actividad_service.update_actividad(db, actividad, data)

    # Recargar con relaciones
    actividad = actividad_service.get_actividad(db, actividad.id)
    return actividad_to_response(actividad)


@router.patch("/{actividad_id}/estado", response_model=ActividadResponse)
def cambiar_estado(
    actividad_id: UUID,
    data: ActividadCambiarEstado,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Cambia el estado de una actividad."""
    actividad = actividad_service.get_actividad(db, actividad_id)
    if not actividad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Actividad no encontrada"
        )

    # Validar estado
    estados_validos = ['pendiente', 'en_progreso', 'completada', 'cancelada']
    if data.estado not in estados_validos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Estado inválido. Valores permitidos: {', '.join(estados_validos)}"
        )

    actividad = actividad_service.cambiar_estado(db, actividad, data.estado)

    # Recargar con relaciones
    actividad = actividad_service.get_actividad(db, actividad.id)
    return actividad_to_response(actividad)


@router.delete("/{actividad_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_actividad(
    actividad_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Elimina (desactiva) una actividad."""
    actividad = actividad_service.get_actividad(db, actividad_id)
    if not actividad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Actividad no encontrada"
        )

    actividad_service.delete_actividad(db, actividad)
    return None
