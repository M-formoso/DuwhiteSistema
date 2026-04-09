"""
Endpoints de Canastos.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_permission
from app.models.usuario import Usuario
from app.schemas.canasto import (
    CanastoUpdate,
    CanastoResponse,
    CanastoListResponse,
    CanastoGridItem,
    CanastosGridResponse,
    AsignarCanastosRequest,
    LiberarCanastosRequest,
    LoteCanastoResponse,
    ESTADOS_CANASTO,
)
from app.services.canasto_service import CanastoService


router = APIRouter()


# ==================== CANASTOS ====================

@router.get("", response_model=List[CanastoListResponse])
def listar_canastos(
    estado: Optional[str] = Query(None, description="Filtrar por estado"),
    solo_disponibles: bool = Query(False, description="Solo canastos disponibles"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("produccion", "ver"))
):
    """Lista todos los canastos."""
    canastos = CanastoService.get_all(
        db,
        estado=estado,
        solo_disponibles=solo_disponibles
    )

    result = []
    for c in canastos:
        lote_numero = None
        cliente_nombre = None
        lote = c.lote_actual
        if lote:
            lote_numero = lote.numero
            if lote.cliente:
                cliente_nombre = lote.cliente.nombre_fantasia or lote.cliente.razon_social

        result.append(CanastoListResponse(
            id=c.id,
            numero=c.numero,
            codigo=c.codigo,
            estado=c.estado,
            lote_actual_numero=lote_numero,
            cliente_nombre=cliente_nombre
        ))

    return result


@router.get("/grid", response_model=CanastosGridResponse)
def obtener_grid_canastos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("produccion", "ver"))
):
    """Obtiene el grid visual de canastos con información de lotes."""
    return CanastoService.get_grid(db)


@router.get("/disponibles", response_model=List[CanastoListResponse])
def listar_canastos_disponibles(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("produccion", "ver"))
):
    """Lista canastos disponibles para asignar."""
    canastos = CanastoService.get_disponibles(db)
    return [
        CanastoListResponse(
            id=c.id,
            numero=c.numero,
            codigo=c.codigo,
            estado=c.estado,
            lote_actual_numero=None,
            cliente_nombre=None
        )
        for c in canastos
    ]


@router.get("/disponibles/count")
def contar_canastos_disponibles(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("produccion", "ver"))
):
    """Obtiene la cantidad de canastos disponibles."""
    return {"count": CanastoService.get_disponibles_count(db)}


@router.get("/estados")
def obtener_estados_canasto():
    """Obtiene los estados posibles de canasto."""
    return ESTADOS_CANASTO


@router.get("/{canasto_id}", response_model=CanastoResponse)
def obtener_canasto(
    canasto_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("produccion", "ver"))
):
    """Obtiene un canasto por ID."""
    from fastapi import HTTPException, status

    canasto = CanastoService.get_by_id(db, canasto_id)
    if not canasto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Canasto no encontrado"
        )

    lote = canasto.lote_actual
    lote_id = None
    lote_numero = None
    cliente_nombre = None
    if lote:
        lote_id = lote.id
        lote_numero = lote.numero
        if lote.cliente:
            cliente_nombre = lote.cliente.nombre_fantasia or lote.cliente.razon_social

    return CanastoResponse(
        id=canasto.id,
        numero=canasto.numero,
        codigo=canasto.codigo,
        estado=canasto.estado,
        ubicacion=canasto.ubicacion,
        notas=canasto.notas,
        activo=canasto.activo,
        lote_actual_id=lote_id,
        lote_actual_numero=lote_numero,
        cliente_nombre=cliente_nombre
    )


@router.put("/{canasto_id}", response_model=CanastoResponse)
def actualizar_canasto(
    canasto_id: UUID,
    data: CanastoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("produccion", "editar"))
):
    """Actualiza un canasto."""
    canasto = CanastoService.update(db, canasto_id, data, current_user.id)

    lote = canasto.lote_actual
    lote_id = None
    lote_numero = None
    cliente_nombre = None
    if lote:
        lote_id = lote.id
        lote_numero = lote.numero
        if lote.cliente:
            cliente_nombre = lote.cliente.nombre_fantasia or lote.cliente.razon_social

    return CanastoResponse(
        id=canasto.id,
        numero=canasto.numero,
        codigo=canasto.codigo,
        estado=canasto.estado,
        ubicacion=canasto.ubicacion,
        notas=canasto.notas,
        activo=canasto.activo,
        lote_actual_id=lote_id,
        lote_actual_numero=lote_numero,
        cliente_nombre=cliente_nombre
    )


@router.post("/{canasto_id}/estado")
def cambiar_estado_canasto(
    canasto_id: UUID,
    estado: str = Query(..., description="Nuevo estado"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("produccion", "editar"))
):
    """Cambia el estado de un canasto."""
    canasto = CanastoService.cambiar_estado(db, canasto_id, estado, current_user.id)
    return {
        "mensaje": f"Canasto {canasto.codigo} actualizado a estado: {estado}",
        "canasto_id": canasto.id,
        "estado": canasto.estado
    }


@router.get("/{canasto_id}/historial", response_model=List[LoteCanastoResponse])
def obtener_historial_canasto(
    canasto_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("produccion", "ver"))
):
    """Obtiene el historial de uso de un canasto."""
    asignaciones = CanastoService.get_historial_canasto(db, canasto_id, limit)

    result = []
    for a in asignaciones:
        result.append(LoteCanastoResponse(
            id=a.id,
            lote_id=a.lote_id,
            canasto_id=a.canasto_id,
            canasto_numero=a.canasto.numero,
            canasto_codigo=a.canasto.codigo,
            etapa_id=a.etapa_id,
            etapa_nombre=a.etapa.nombre if a.etapa else None,
            fecha_asignacion=a.fecha_asignacion,
            fecha_liberacion=a.fecha_liberacion,
            asignado_por_nombre=a.asignado_por.nombre_completo if a.asignado_por else None,
            liberado_por_nombre=a.liberado_por.nombre_completo if a.liberado_por else None,
            duracion_minutos=a.duracion_minutos,
            esta_activo=a.esta_activo,
            notas=a.notas
        ))

    return result


# ==================== ASIGNACIÓN A LOTES ====================

@router.post("/lotes/{lote_id}/asignar")
def asignar_canastos_a_lote(
    lote_id: UUID,
    request: AsignarCanastosRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("produccion", "editar"))
):
    """Asigna canastos a un lote."""
    asignaciones = CanastoService.asignar_canastos(db, lote_id, request, current_user.id)

    return {
        "mensaje": f"{len(asignaciones)} canasto(s) asignado(s) al lote",
        "lote_id": lote_id,
        "canastos_asignados": len(asignaciones),
        "canastos": [
            {"id": a.canasto_id, "codigo": a.canasto.codigo}
            for a in asignaciones
        ]
    }


@router.post("/lotes/{lote_id}/liberar")
def liberar_canastos_de_lote(
    lote_id: UUID,
    request: LiberarCanastosRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("produccion", "editar"))
):
    """Libera canastos de un lote."""
    liberados = CanastoService.liberar_canastos(db, lote_id, request, current_user.id)

    return {
        "mensaje": f"{len(liberados)} canasto(s) liberado(s)",
        "lote_id": lote_id,
        "canastos_liberados": len(liberados),
        "canastos": [
            {"id": a.canasto_id, "codigo": a.canasto.codigo}
            for a in liberados
        ]
    }


@router.get("/lotes/{lote_id}/canastos", response_model=List[LoteCanastoResponse])
def obtener_canastos_de_lote(
    lote_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("produccion", "ver"))
):
    """Obtiene los canastos actualmente asignados a un lote."""
    asignaciones = CanastoService.get_canastos_lote(db, lote_id)

    result = []
    for a in asignaciones:
        result.append(LoteCanastoResponse(
            id=a.id,
            lote_id=a.lote_id,
            canasto_id=a.canasto_id,
            canasto_numero=a.canasto.numero,
            canasto_codigo=a.canasto.codigo,
            etapa_id=a.etapa_id,
            etapa_nombre=a.etapa.nombre if a.etapa else None,
            fecha_asignacion=a.fecha_asignacion,
            fecha_liberacion=a.fecha_liberacion,
            asignado_por_nombre=a.asignado_por.nombre_completo if a.asignado_por else None,
            liberado_por_nombre=None,
            duracion_minutos=a.duracion_minutos,
            esta_activo=True,
            notas=a.notas
        ))

    return result
