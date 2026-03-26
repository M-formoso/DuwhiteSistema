"""
Endpoints de Tesorería.
"""

from datetime import date
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_permission
from app.models.usuario import Usuario
from app.services.tesoreria_service import TesoreriaService
from app.schemas.tesoreria import (
    ChequeCreate,
    ChequeUpdate,
    ChequeResponse,
    ChequeList,
    DepositarChequeRequest,
    CobrarChequeRequest,
    RechazarChequeRequest,
    EntregarChequeRequest,
    MovimientoTesoreriaCreate,
    MovimientoTesoreriaResponse,
    MovimientoTesoreriaList,
    AnularMovimientoRequest,
    ResumenTesoreria,
    TIPOS_CHEQUE,
    ORIGENES_CHEQUE,
    ESTADOS_CHEQUE,
    METODOS_PAGO_TESORERIA,
    BANCOS_ARGENTINA,
)
from app.schemas.common import PaginatedResponse

router = APIRouter()


# ==================== CONSTANTES ====================

@router.get("/constantes/tipos-cheque")
def get_tipos_cheque():
    """Obtiene tipos de cheque."""
    return TIPOS_CHEQUE


@router.get("/constantes/origenes-cheque")
def get_origenes_cheque():
    """Obtiene orígenes de cheque."""
    return ORIGENES_CHEQUE


@router.get("/constantes/estados-cheque")
def get_estados_cheque():
    """Obtiene estados de cheque."""
    return ESTADOS_CHEQUE


@router.get("/constantes/metodos-pago")
def get_metodos_pago():
    """Obtiene métodos de pago."""
    return METODOS_PAGO_TESORERIA


@router.get("/constantes/bancos")
def get_bancos():
    """Obtiene lista de bancos."""
    return BANCOS_ARGENTINA


# ==================== RESUMEN ====================

@router.get("/resumen", response_model=ResumenTesoreria)
def get_resumen_tesoreria(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene resumen de tesorería."""
    service = TesoreriaService(db)
    return service.get_resumen(fecha_desde, fecha_hasta)


# ==================== CHEQUES ====================

@router.get("/cheques", response_model=PaginatedResponse[ChequeList])
def list_cheques(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    estado: Optional[str] = None,
    tipo: Optional[str] = None,
    origen: Optional[str] = None,
    cliente_id: Optional[UUID] = None,
    proveedor_id: Optional[UUID] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    buscar: Optional[str] = None,
    solo_en_cartera: bool = False,
    vencidos: bool = False,
    proximos_vencer: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista cheques con filtros."""
    service = TesoreriaService(db)
    cheques, total = service.get_cheques(
        skip=skip,
        limit=limit,
        estado=estado,
        tipo=tipo,
        origen=origen,
        cliente_id=cliente_id,
        proveedor_id=proveedor_id,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        buscar=buscar,
        solo_en_cartera=solo_en_cartera,
        vencidos=vencidos,
        proximos_vencer=proximos_vencer,
    )

    items = [ChequeList(**service.enrich_cheque(c)) for c in cheques]

    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/cheques/{cheque_id}", response_model=ChequeResponse)
def get_cheque(
    cheque_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene un cheque por ID."""
    service = TesoreriaService(db)
    cheque = service.get_cheque(cheque_id)

    if not cheque:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cheque no encontrado"
        )

    return ChequeResponse(**service.enrich_cheque(cheque))


@router.post("/cheques", response_model=ChequeResponse, status_code=status.HTTP_201_CREATED)
def create_cheque(
    data: ChequeCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Crea un nuevo cheque."""
    service = TesoreriaService(db)
    cheque = service.create_cheque(data, current_user.id)
    return ChequeResponse(**service.enrich_cheque(cheque))


@router.put("/cheques/{cheque_id}", response_model=ChequeResponse)
def update_cheque(
    cheque_id: UUID,
    data: ChequeUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Actualiza un cheque."""
    service = TesoreriaService(db)
    cheque = service.update_cheque(cheque_id, data)

    if not cheque:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cheque no encontrado"
        )

    return ChequeResponse(**service.enrich_cheque(cheque))


@router.delete("/cheques/{cheque_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cheque(
    cheque_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Elimina un cheque (soft delete). Solo cheques en cartera."""
    service = TesoreriaService(db)

    try:
        service.delete_cheque(cheque_id, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return None


@router.post("/cheques/{cheque_id}/depositar", response_model=ChequeResponse)
def depositar_cheque(
    cheque_id: UUID,
    data: DepositarChequeRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Marca un cheque como depositado."""
    service = TesoreriaService(db)

    try:
        cheque = service.depositar_cheque(cheque_id, data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return ChequeResponse(**service.enrich_cheque(cheque))


@router.post("/cheques/{cheque_id}/cobrar", response_model=ChequeResponse)
def cobrar_cheque(
    cheque_id: UUID,
    data: CobrarChequeRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Marca un cheque como cobrado."""
    service = TesoreriaService(db)

    try:
        cheque = service.cobrar_cheque(cheque_id, data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return ChequeResponse(**service.enrich_cheque(cheque))


@router.post("/cheques/{cheque_id}/rechazar", response_model=ChequeResponse)
def rechazar_cheque(
    cheque_id: UUID,
    data: RechazarChequeRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Marca un cheque como rechazado."""
    service = TesoreriaService(db)

    try:
        cheque = service.rechazar_cheque(cheque_id, data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return ChequeResponse(**service.enrich_cheque(cheque))


@router.post("/cheques/{cheque_id}/entregar", response_model=ChequeResponse)
def entregar_cheque(
    cheque_id: UUID,
    data: EntregarChequeRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Marca un cheque como entregado a tercero."""
    service = TesoreriaService(db)

    try:
        cheque = service.entregar_cheque(cheque_id, data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return ChequeResponse(**service.enrich_cheque(cheque))


# ==================== MOVIMIENTOS ====================

@router.get("/movimientos", response_model=PaginatedResponse[MovimientoTesoreriaList])
def list_movimientos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    tipo: Optional[str] = None,
    es_ingreso: Optional[bool] = None,
    metodo_pago: Optional[str] = None,
    cliente_id: Optional[UUID] = None,
    proveedor_id: Optional[UUID] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    buscar: Optional[str] = None,
    incluir_anulados: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista movimientos de tesorería con filtros."""
    service = TesoreriaService(db)
    movimientos, total = service.get_movimientos(
        skip=skip,
        limit=limit,
        tipo=tipo,
        es_ingreso=es_ingreso,
        metodo_pago=metodo_pago,
        cliente_id=cliente_id,
        proveedor_id=proveedor_id,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        buscar=buscar,
        incluir_anulados=incluir_anulados,
    )

    items = [MovimientoTesoreriaList(**service.enrich_movimiento(m)) for m in movimientos]

    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/movimientos/{movimiento_id}", response_model=MovimientoTesoreriaResponse)
def get_movimiento(
    movimiento_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene un movimiento por ID."""
    service = TesoreriaService(db)
    movimiento = service.get_movimiento(movimiento_id)

    if not movimiento:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movimiento no encontrado"
        )

    return MovimientoTesoreriaResponse(**service.enrich_movimiento(movimiento))


@router.post("/movimientos", response_model=MovimientoTesoreriaResponse, status_code=status.HTTP_201_CREATED)
def create_movimiento(
    data: MovimientoTesoreriaCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Crea un nuevo movimiento de tesorería."""
    service = TesoreriaService(db)

    try:
        movimiento = service.create_movimiento(data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return MovimientoTesoreriaResponse(**service.enrich_movimiento(movimiento))


@router.post("/movimientos/{movimiento_id}/anular", response_model=MovimientoTesoreriaResponse)
def anular_movimiento(
    movimiento_id: UUID,
    data: AnularMovimientoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador")),
):
    """Anula un movimiento de tesorería."""
    service = TesoreriaService(db)

    try:
        movimiento = service.anular_movimiento(movimiento_id, data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return MovimientoTesoreriaResponse(**service.enrich_movimiento(movimiento))
