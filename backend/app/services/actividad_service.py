"""
Servicio de Actividades/Tareas Internas.
"""

from datetime import date, datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session, joinedload

from app.models.actividad import Actividad, EstadoActividad, PrioridadActividad, CategoriaActividad
from app.models.usuario import Usuario
from app.schemas.actividad import ActividadCreate, ActividadUpdate


def get_actividad(db: Session, actividad_id: UUID) -> Optional[Actividad]:
    """Obtiene una actividad por ID."""
    return db.query(Actividad).options(
        joinedload(Actividad.creado_por),
        joinedload(Actividad.asignado_a)
    ).filter(
        Actividad.id == actividad_id,
        Actividad.is_active == True
    ).first()


def get_actividades(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    estado: Optional[str] = None,
    prioridad: Optional[str] = None,
    categoria: Optional[str] = None,
    asignado_a_id: Optional[UUID] = None,
    creado_por_id: Optional[UUID] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    incluir_completadas: bool = True
) -> List[Actividad]:
    """Lista actividades con filtros."""
    query = db.query(Actividad).options(
        joinedload(Actividad.creado_por),
        joinedload(Actividad.asignado_a)
    ).filter(Actividad.is_active == True)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Actividad.titulo.ilike(search_term),
                Actividad.descripcion.ilike(search_term)
            )
        )

    if estado:
        query = query.filter(Actividad.estado == estado)
    elif not incluir_completadas:
        query = query.filter(Actividad.estado != EstadoActividad.COMPLETADA.value)

    if prioridad:
        query = query.filter(Actividad.prioridad == prioridad)

    if categoria:
        query = query.filter(Actividad.categoria == categoria)

    if asignado_a_id:
        query = query.filter(Actividad.asignado_a_id == asignado_a_id)

    if creado_por_id:
        query = query.filter(Actividad.creado_por_id == creado_por_id)

    if fecha_desde:
        query = query.filter(Actividad.fecha_limite >= fecha_desde)

    if fecha_hasta:
        query = query.filter(Actividad.fecha_limite <= fecha_hasta)

    # Ordenar por prioridad (urgente primero) y fecha límite
    prioridad_orden = {
        'urgente': 1,
        'alta': 2,
        'media': 3,
        'baja': 4
    }

    return query.order_by(
        Actividad.fecha_limite.asc().nullslast(),
        Actividad.created_at.desc()
    ).offset(skip).limit(limit).all()


def count_actividades(
    db: Session,
    search: Optional[str] = None,
    estado: Optional[str] = None,
    prioridad: Optional[str] = None,
    categoria: Optional[str] = None,
    asignado_a_id: Optional[UUID] = None,
    creado_por_id: Optional[UUID] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    incluir_completadas: bool = True
) -> int:
    """Cuenta actividades con filtros."""
    query = db.query(func.count(Actividad.id)).filter(Actividad.is_active == True)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Actividad.titulo.ilike(search_term),
                Actividad.descripcion.ilike(search_term)
            )
        )

    if estado:
        query = query.filter(Actividad.estado == estado)
    elif not incluir_completadas:
        query = query.filter(Actividad.estado != EstadoActividad.COMPLETADA.value)

    if prioridad:
        query = query.filter(Actividad.prioridad == prioridad)

    if categoria:
        query = query.filter(Actividad.categoria == categoria)

    if asignado_a_id:
        query = query.filter(Actividad.asignado_a_id == asignado_a_id)

    if creado_por_id:
        query = query.filter(Actividad.creado_por_id == creado_por_id)

    if fecha_desde:
        query = query.filter(Actividad.fecha_limite >= fecha_desde)

    if fecha_hasta:
        query = query.filter(Actividad.fecha_limite <= fecha_hasta)

    return query.scalar()


def create_actividad(db: Session, data: ActividadCreate, creado_por_id: UUID) -> Actividad:
    """Crea una nueva actividad."""
    actividad = Actividad(
        titulo=data.titulo,
        descripcion=data.descripcion,
        categoria=data.categoria,
        prioridad=data.prioridad,
        estado=EstadoActividad.PENDIENTE.value,
        fecha_limite=data.fecha_limite,
        creado_por_id=creado_por_id,
        asignado_a_id=data.asignado_a_id,
        etiquetas=data.etiquetas or [],
        notas=data.notas,
        is_active=True
    )
    db.add(actividad)
    db.commit()
    db.refresh(actividad)
    return actividad


def update_actividad(db: Session, actividad: Actividad, data: ActividadUpdate) -> Actividad:
    """Actualiza una actividad."""
    update_data = data.model_dump(exclude_unset=True)

    # Si se cambia a completada, registrar fecha
    if 'estado' in update_data and update_data['estado'] == EstadoActividad.COMPLETADA.value:
        if actividad.estado != EstadoActividad.COMPLETADA.value:
            update_data['fecha_completada'] = datetime.now()
    elif 'estado' in update_data and update_data['estado'] != EstadoActividad.COMPLETADA.value:
        update_data['fecha_completada'] = None

    for field, value in update_data.items():
        setattr(actividad, field, value)

    db.commit()
    db.refresh(actividad)
    return actividad


def cambiar_estado(db: Session, actividad: Actividad, nuevo_estado: str) -> Actividad:
    """Cambia el estado de una actividad."""
    actividad.estado = nuevo_estado

    if nuevo_estado == EstadoActividad.COMPLETADA.value:
        actividad.fecha_completada = datetime.now()
    else:
        actividad.fecha_completada = None

    db.commit()
    db.refresh(actividad)
    return actividad


def delete_actividad(db: Session, actividad: Actividad) -> None:
    """Elimina (soft delete) una actividad."""
    actividad.is_active = False
    db.commit()


def get_actividades_por_estado(db: Session, usuario_id: Optional[UUID] = None) -> Dict[str, List[Actividad]]:
    """Obtiene actividades agrupadas por estado."""
    base_query = db.query(Actividad).options(
        joinedload(Actividad.creado_por),
        joinedload(Actividad.asignado_a)
    ).filter(Actividad.is_active == True)

    if usuario_id:
        base_query = base_query.filter(
            or_(
                Actividad.creado_por_id == usuario_id,
                Actividad.asignado_a_id == usuario_id
            )
        )

    pendientes = base_query.filter(
        Actividad.estado == EstadoActividad.PENDIENTE.value
    ).order_by(Actividad.fecha_limite.asc().nullslast()).all()

    en_progreso = base_query.filter(
        Actividad.estado == EstadoActividad.EN_PROGRESO.value
    ).order_by(Actividad.fecha_limite.asc().nullslast()).all()

    completadas = base_query.filter(
        Actividad.estado == EstadoActividad.COMPLETADA.value
    ).order_by(Actividad.fecha_completada.desc()).limit(20).all()

    return {
        'pendiente': pendientes,
        'en_progreso': en_progreso,
        'completada': completadas
    }


def get_resumen_actividades(db: Session, usuario_id: Optional[UUID] = None) -> Dict[str, Any]:
    """Obtiene resumen de actividades."""
    base_query = db.query(Actividad).filter(Actividad.is_active == True)

    if usuario_id:
        base_query = base_query.filter(
            or_(
                Actividad.creado_por_id == usuario_id,
                Actividad.asignado_a_id == usuario_id
            )
        )

    total = base_query.count()

    pendientes = base_query.filter(
        Actividad.estado == EstadoActividad.PENDIENTE.value
    ).count()

    en_progreso = base_query.filter(
        Actividad.estado == EstadoActividad.EN_PROGRESO.value
    ).count()

    # Completadas hoy
    hoy = date.today()
    completadas_hoy = base_query.filter(
        Actividad.estado == EstadoActividad.COMPLETADA.value,
        func.date(Actividad.fecha_completada) == hoy
    ).count()

    # Vencidas
    vencidas = base_query.filter(
        Actividad.estado.in_([EstadoActividad.PENDIENTE.value, EstadoActividad.EN_PROGRESO.value]),
        Actividad.fecha_limite < hoy
    ).count()

    # Por categoría
    por_categoria = []
    for categoria in CategoriaActividad:
        count = base_query.filter(
            Actividad.categoria == categoria.value,
            Actividad.estado.in_([EstadoActividad.PENDIENTE.value, EstadoActividad.EN_PROGRESO.value])
        ).count()
        if count > 0:
            por_categoria.append({
                'categoria': categoria.value,
                'cantidad': count
            })

    return {
        'total': total,
        'pendientes': pendientes,
        'en_progreso': en_progreso,
        'completadas_hoy': completadas_hoy,
        'vencidas': vencidas,
        'por_categoria': por_categoria
    }


def get_actividades_vencidas(db: Session, usuario_id: Optional[UUID] = None) -> List[Actividad]:
    """Obtiene actividades vencidas."""
    hoy = date.today()
    query = db.query(Actividad).options(
        joinedload(Actividad.creado_por),
        joinedload(Actividad.asignado_a)
    ).filter(
        Actividad.is_active == True,
        Actividad.estado.in_([EstadoActividad.PENDIENTE.value, EstadoActividad.EN_PROGRESO.value]),
        Actividad.fecha_limite < hoy
    )

    if usuario_id:
        query = query.filter(
            or_(
                Actividad.creado_por_id == usuario_id,
                Actividad.asignado_a_id == usuario_id
            )
        )

    return query.order_by(Actividad.fecha_limite.asc()).all()


def get_actividades_proximas(
    db: Session,
    dias: int = 7,
    usuario_id: Optional[UUID] = None
) -> List[Actividad]:
    """Obtiene actividades con fecha límite próxima."""
    hoy = date.today()
    fecha_limite = date.today()
    # Calcular fecha límite para los próximos X días
    from datetime import timedelta
    fecha_limite = hoy + timedelta(days=dias)

    query = db.query(Actividad).options(
        joinedload(Actividad.creado_por),
        joinedload(Actividad.asignado_a)
    ).filter(
        Actividad.is_active == True,
        Actividad.estado.in_([EstadoActividad.PENDIENTE.value, EstadoActividad.EN_PROGRESO.value]),
        Actividad.fecha_limite >= hoy,
        Actividad.fecha_limite <= fecha_limite
    )

    if usuario_id:
        query = query.filter(
            or_(
                Actividad.creado_por_id == usuario_id,
                Actividad.asignado_a_id == usuario_id
            )
        )

    return query.order_by(Actividad.fecha_limite.asc()).all()
