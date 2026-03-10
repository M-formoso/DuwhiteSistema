"""
Endpoints de Conciliación Bancaria.
"""

from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_permission
from app.models.usuario import Usuario
from app.services.conciliacion_bancaria_service import ConciliacionBancariaService
from app.schemas.conciliacion_bancaria import (
    ConciliacionBancariaCreate,
    ConciliacionBancariaResponse,
    ConciliacionBancariaList,
    ItemConciliacionResponse,
    ConciliarMovimientoRequest,
    ConciliarVariosRequest,
    FinalizarConciliacionRequest,
    MovimientoSinConciliarResponse,
    ESTADOS_CONCILIACION,
)
from app.schemas.common import PaginatedResponse, MessageResponse

router = APIRouter()


# ==================== CONCILIACIONES ====================

@router.get("", response_model=PaginatedResponse)
def listar_conciliaciones(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    cuenta_id: Optional[str] = None,
    estado: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista conciliaciones bancarias."""
    service = ConciliacionBancariaService(db)

    conciliaciones, total = service.get_conciliaciones(
        cuenta_id=cuenta_id,
        estado=estado,
        skip=skip,
        limit=limit,
    )

    items = []
    for c in conciliaciones:
        cantidad_pendientes = sum(1 for i in c.items if not i.conciliado) if c.items else 0
        items.append(ConciliacionBancariaList(
            id=str(c.id),
            cuenta_id=str(c.cuenta_id),
            cuenta_nombre=c.cuenta.nombre if c.cuenta else None,
            fecha_desde=c.fecha_desde,
            fecha_hasta=c.fecha_hasta,
            estado=c.estado,
            cantidad_conciliados=c.cantidad_conciliados or 0,
            cantidad_pendientes=cantidad_pendientes,
            diferencia=c.diferencia,
            created_at=c.created_at,
        ))

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{conciliacion_id}", response_model=ConciliacionBancariaResponse)
def obtener_conciliacion(
    conciliacion_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene una conciliación por ID con sus items."""
    service = ConciliacionBancariaService(db)
    conciliacion = service.get_conciliacion(conciliacion_id)

    if not conciliacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conciliación no encontrada",
        )

    items = []
    cantidad_pendientes = 0
    for item in conciliacion.items:
        if not item.conciliado:
            cantidad_pendientes += 1

        mov = item.movimiento_bancario
        items.append(ItemConciliacionResponse(
            id=str(item.id),
            movimiento_bancario_id=str(item.movimiento_bancario_id),
            conciliado=item.conciliado,
            fecha_conciliacion=item.fecha_conciliacion,
            referencia_extracto=item.referencia_extracto,
            notas=item.notas,
            tipo_movimiento=mov.tipo if mov else None,
            concepto=mov.concepto if mov else None,
            monto=mov.monto if mov else None,
            fecha_movimiento=mov.fecha_movimiento if mov else None,
            referencia_externa=mov.referencia_externa if mov else None,
        ))

    return ConciliacionBancariaResponse(
        id=str(conciliacion.id),
        cuenta_id=str(conciliacion.cuenta_id),
        fecha_desde=conciliacion.fecha_desde,
        fecha_hasta=conciliacion.fecha_hasta,
        estado=conciliacion.estado,
        saldo_extracto_bancario=conciliacion.saldo_extracto_bancario,
        saldo_sistema=conciliacion.saldo_sistema,
        diferencia=conciliacion.diferencia,
        cantidad_conciliados=conciliacion.cantidad_conciliados or 0,
        monto_conciliado=conciliacion.monto_conciliado,
        creado_por_id=str(conciliacion.creado_por_id),
        finalizado_por_id=str(conciliacion.finalizado_por_id) if conciliacion.finalizado_por_id else None,
        fecha_finalizacion=conciliacion.fecha_finalizacion,
        notas=conciliacion.notas,
        created_at=conciliacion.created_at,
        items=items,
        cuenta_nombre=conciliacion.cuenta.nombre if conciliacion.cuenta else None,
        cuenta_banco=conciliacion.cuenta.banco if conciliacion.cuenta else None,
        cantidad_pendientes=cantidad_pendientes,
        esta_finalizada=conciliacion.esta_finalizada,
    )


@router.post("", response_model=ConciliacionBancariaResponse, status_code=status.HTTP_201_CREATED)
def iniciar_conciliacion(
    data: ConciliacionBancariaCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Inicia una nueva sesión de conciliación bancaria."""
    service = ConciliacionBancariaService(db)

    try:
        conciliacion = service.iniciar_conciliacion(data, str(current_user.id))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Recargar para obtener relaciones
    conciliacion = service.get_conciliacion(str(conciliacion.id))

    items = []
    cantidad_pendientes = 0
    for item in conciliacion.items:
        if not item.conciliado:
            cantidad_pendientes += 1

        mov = item.movimiento_bancario
        items.append(ItemConciliacionResponse(
            id=str(item.id),
            movimiento_bancario_id=str(item.movimiento_bancario_id),
            conciliado=item.conciliado,
            fecha_conciliacion=item.fecha_conciliacion,
            referencia_extracto=item.referencia_extracto,
            notas=item.notas,
            tipo_movimiento=mov.tipo if mov else None,
            concepto=mov.concepto if mov else None,
            monto=mov.monto if mov else None,
            fecha_movimiento=mov.fecha_movimiento if mov else None,
            referencia_externa=mov.referencia_externa if mov else None,
        ))

    return ConciliacionBancariaResponse(
        id=str(conciliacion.id),
        cuenta_id=str(conciliacion.cuenta_id),
        fecha_desde=conciliacion.fecha_desde,
        fecha_hasta=conciliacion.fecha_hasta,
        estado=conciliacion.estado,
        saldo_extracto_bancario=conciliacion.saldo_extracto_bancario,
        saldo_sistema=conciliacion.saldo_sistema,
        diferencia=conciliacion.diferencia,
        cantidad_conciliados=conciliacion.cantidad_conciliados or 0,
        monto_conciliado=conciliacion.monto_conciliado,
        creado_por_id=str(conciliacion.creado_por_id),
        finalizado_por_id=None,
        fecha_finalizacion=None,
        notas=conciliacion.notas,
        created_at=conciliacion.created_at,
        items=items,
        cuenta_nombre=conciliacion.cuenta.nombre if conciliacion.cuenta else None,
        cuenta_banco=conciliacion.cuenta.banco if conciliacion.cuenta else None,
        cantidad_pendientes=cantidad_pendientes,
        esta_finalizada=False,
    )


# ==================== ACCIONES DE CONCILIACIÓN ====================

@router.post("/{conciliacion_id}/conciliar", response_model=MessageResponse)
def conciliar_movimiento(
    conciliacion_id: str,
    data: ConciliarMovimientoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Marca un movimiento como conciliado."""
    service = ConciliacionBancariaService(db)

    try:
        service.conciliar_movimiento(conciliacion_id, data, str(current_user.id))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return MessageResponse(message="Movimiento conciliado correctamente")


@router.post("/{conciliacion_id}/desconciliar/{movimiento_id}", response_model=MessageResponse)
def desconciliar_movimiento(
    conciliacion_id: str,
    movimiento_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Desmarca un movimiento como conciliado."""
    service = ConciliacionBancariaService(db)

    try:
        service.desconciliar_movimiento(conciliacion_id, movimiento_id, str(current_user.id))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return MessageResponse(message="Movimiento desconciliado correctamente")


@router.post("/{conciliacion_id}/conciliar-varios", response_model=MessageResponse)
def conciliar_varios_movimientos(
    conciliacion_id: str,
    data: ConciliarVariosRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Concilia varios movimientos a la vez."""
    service = ConciliacionBancariaService(db)

    movimientos_ids = [m.movimiento_bancario_id for m in data.movimientos]
    conciliados = service.conciliar_varios(conciliacion_id, movimientos_ids, str(current_user.id))

    return MessageResponse(message=f"Se conciliaron {conciliados} movimientos correctamente")


@router.post("/{conciliacion_id}/finalizar", response_model=MessageResponse)
def finalizar_conciliacion(
    conciliacion_id: str,
    data: FinalizarConciliacionRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Finaliza una sesión de conciliación."""
    service = ConciliacionBancariaService(db)

    try:
        conciliacion = service.finalizar_conciliacion(
            conciliacion_id,
            data.saldo_extracto_bancario,
            str(current_user.id),
            data.notas,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    diferencia = conciliacion.diferencia or 0
    return MessageResponse(
        message=f"Conciliación finalizada. Diferencia: ${diferencia:,.2f}"
    )


# ==================== MOVIMIENTOS SIN CONCILIAR ====================

@router.get("/cuenta/{cuenta_id}/sin-conciliar", response_model=List[MovimientoSinConciliarResponse])
def obtener_movimientos_sin_conciliar(
    cuenta_id: str,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene movimientos sin conciliar de una cuenta."""
    service = ConciliacionBancariaService(db)
    movimientos = service.get_movimientos_sin_conciliar(cuenta_id, fecha_hasta)

    return [
        MovimientoSinConciliarResponse(
            id=str(m.id),
            cuenta_id=str(m.cuenta_id),
            tipo=m.tipo,
            concepto=m.concepto,
            monto=m.monto,
            fecha_movimiento=m.fecha_movimiento,
            referencia_externa=m.referencia_externa,
            numero_comprobante=m.numero_comprobante,
            cliente_nombre=m.cliente.nombre_display if m.cliente else None,
            proveedor_nombre=m.proveedor.razon_social if m.proveedor else None,
        )
        for m in movimientos
    ]


# ==================== RESUMEN ====================

@router.get("/cuenta/{cuenta_id}/resumen")
def obtener_resumen_cuenta(
    cuenta_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene resumen de conciliación de una cuenta."""
    service = ConciliacionBancariaService(db)

    try:
        return service.get_resumen_cuenta(cuenta_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# ==================== CONSTANTES ====================

@router.get("/constantes/estados")
def obtener_estados_conciliacion():
    """Obtiene los estados de conciliación."""
    return ESTADOS_CONCILIACION
