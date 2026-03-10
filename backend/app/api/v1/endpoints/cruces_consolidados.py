"""
Endpoints de Cruces Consolidados Cliente-Proveedor.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_permission
from app.models.usuario import Usuario
from app.services.cruce_consolidado_service import CruceConsolidadoService
from app.schemas.cruce_consolidado import (
    EntidadConsolidadaResponse,
    EntidadConsolidadaList,
    SaldoConsolidadoDetalle,
    SincronizarEntidadesResponse,
)
from app.schemas.common import PaginatedResponse, MessageResponse

router = APIRouter()


# ==================== SINCRONIZACIÓN ====================

@router.post("/sincronizar", response_model=SincronizarEntidadesResponse)
def sincronizar_entidades(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """
    Sincroniza entidades consolidadas basándose en CUIT.
    Detecta clientes que también son proveedores y viceversa.
    """
    service = CruceConsolidadoService(db)
    return service.sincronizar_entidades()


# ==================== LISTADOS ====================

@router.get("", response_model=PaginatedResponse)
def listar_entidades_consolidadas(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    solo_cruzadas: bool = False,
    con_saldo: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Lista entidades consolidadas.

    - solo_cruzadas: Solo entidades que son cliente Y proveedor
    - con_saldo: Solo entidades con saldo neto distinto de cero
    """
    service = CruceConsolidadoService(db)

    entidades, total = service.get_entidades_consolidadas(
        solo_cruzadas=solo_cruzadas,
        con_saldo=con_saldo,
        skip=skip,
        limit=limit,
    )

    items = []
    for e in entidades:
        items.append(EntidadConsolidadaList(
            id=str(e.id),
            cuit=e.cuit,
            razon_social=e.razon_social,
            es_cliente=e.es_cliente,
            es_proveedor=e.es_proveedor,
            saldo_como_cliente=e.saldo_como_cliente,
            saldo_como_proveedor=e.saldo_como_proveedor,
            saldo_neto=e.saldo_neto,
            tiene_cruce=e.tiene_cruce,
        ))

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/por-cuit/{cuit}", response_model=EntidadConsolidadaResponse)
def obtener_entidad_por_cuit(
    cuit: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene una entidad consolidada por CUIT."""
    service = CruceConsolidadoService(db)
    entidad = service.get_entidad_por_cuit(cuit)

    if not entidad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entidad no encontrada",
        )

    return EntidadConsolidadaResponse(
        id=str(entidad.id),
        cuit=entidad.cuit,
        razon_social=entidad.razon_social,
        es_cliente=entidad.es_cliente,
        es_proveedor=entidad.es_proveedor,
        cliente_id=str(entidad.cliente_id) if entidad.cliente_id else None,
        proveedor_id=str(entidad.proveedor_id) if entidad.proveedor_id else None,
        saldo_como_cliente=entidad.saldo_como_cliente,
        saldo_como_proveedor=entidad.saldo_como_proveedor,
        saldo_neto=entidad.saldo_neto,
        activo=entidad.activo,
        created_at=entidad.created_at,
        updated_at=entidad.updated_at,
        tiene_cruce=entidad.tiene_cruce,
        cliente_nombre=entidad.cliente.nombre_display if entidad.cliente else None,
        proveedor_nombre=entidad.proveedor.nombre_display if entidad.proveedor else None,
    )


# ==================== SALDO CONSOLIDADO ====================

@router.get("/saldo/{cuit}", response_model=SaldoConsolidadoDetalle)
def obtener_saldo_consolidado(
    cuit: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene el detalle de saldo consolidado por CUIT."""
    service = CruceConsolidadoService(db)
    saldo = service.get_saldo_consolidado(cuit)

    if not saldo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entidad no encontrada",
        )

    return saldo


@router.post("/actualizar-saldos/{cuit}", response_model=MessageResponse)
def actualizar_saldos_entidad(
    cuit: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Actualiza los saldos de una entidad específica."""
    service = CruceConsolidadoService(db)
    entidad = service.actualizar_saldos_entidad(cuit)

    if not entidad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entidad no encontrada",
        )

    return MessageResponse(
        message=f"Saldos actualizados. Saldo neto: ${entidad.saldo_neto:,.2f}"
    )


# ==================== RESUMEN ====================

@router.get("/resumen")
def obtener_resumen_cruces(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene resumen de cruces consolidados."""
    service = CruceConsolidadoService(db)
    return service.get_resumen_cruces()
