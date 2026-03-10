"""
Endpoints de Órdenes de Pago.
"""

from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_permission
from app.models.usuario import Usuario
from app.services.orden_pago_service import OrdenPagoService
from app.schemas.orden_pago import (
    OrdenPagoCreate,
    OrdenPagoUpdate,
    OrdenPagoResponse,
    OrdenPagoList,
    ConfirmarOrdenPagoRequest,
    PagarOrdenPagoRequest,
    AnularOrdenPagoRequest,
    DetalleOrdenPagoResponse,
    ESTADOS_ORDEN_PAGO,
    MEDIOS_PAGO,
)
from app.schemas.common import PaginatedResponse, MessageResponse

router = APIRouter()


# ==================== CRUD ====================

@router.get("", response_model=PaginatedResponse)
def listar_ordenes_pago(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    proveedor_id: Optional[str] = None,
    estado: Optional[str] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    incluir_anuladas: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista órdenes de pago con filtros."""
    service = OrdenPagoService(db)

    ordenes, total = service.get_ordenes_pago(
        skip=skip,
        limit=limit,
        proveedor_id=proveedor_id,
        estado=estado,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        incluir_anuladas=incluir_anuladas,
    )

    items = []
    for o in ordenes:
        items.append(OrdenPagoList(
            id=str(o.id),
            numero=o.numero,
            proveedor_id=str(o.proveedor_id),
            proveedor_nombre=o.proveedor.nombre_display if o.proveedor else None,
            fecha_emision=o.fecha_emision,
            fecha_pago_programada=o.fecha_pago_programada,
            fecha_pago_real=o.fecha_pago_real,
            estado=o.estado,
            monto_total=o.monto_total,
            monto_pagado=o.monto_pagado,
            cantidad_comprobantes=len(o.detalles) if o.detalles else 0,
            anulado=o.anulado,
            created_at=o.created_at,
        ))

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{orden_id}", response_model=OrdenPagoResponse)
def obtener_orden_pago(
    orden_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene una orden de pago por ID."""
    service = OrdenPagoService(db)
    orden = service.get_orden_pago(orden_id)

    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden de pago no encontrada",
        )

    detalles = []
    for d in orden.detalles:
        detalles.append(DetalleOrdenPagoResponse(
            id=str(d.id),
            movimiento_id=str(d.movimiento_id),
            descripcion=d.descripcion,
            monto_comprobante=d.monto_comprobante,
            monto_pendiente_antes=d.monto_pendiente_antes,
            monto_a_pagar=d.monto_a_pagar,
            numero_linea=d.numero_linea,
            factura_numero=d.movimiento.factura_numero if d.movimiento else None,
            fecha_factura=d.movimiento.fecha_factura if d.movimiento else None,
            fecha_vencimiento=d.movimiento.fecha_vencimiento if d.movimiento else None,
        ))

    return OrdenPagoResponse(
        id=str(orden.id),
        numero=orden.numero,
        proveedor_id=str(orden.proveedor_id),
        fecha_emision=orden.fecha_emision,
        fecha_pago_programada=orden.fecha_pago_programada,
        fecha_pago_real=orden.fecha_pago_real,
        estado=orden.estado,
        monto_total=orden.monto_total,
        monto_pagado=orden.monto_pagado,
        medio_pago=orden.medio_pago,
        cuenta_bancaria_id=str(orden.cuenta_bancaria_id) if orden.cuenta_bancaria_id else None,
        referencia_pago=orden.referencia_pago,
        concepto=orden.concepto,
        notas=orden.notas,
        anulado=orden.anulado,
        fecha_anulacion=orden.fecha_anulacion,
        motivo_anulacion=orden.motivo_anulacion,
        creado_por_id=str(orden.creado_por_id),
        pagado_por_id=str(orden.pagado_por_id) if orden.pagado_por_id else None,
        anulado_por_id=str(orden.anulado_por_id) if orden.anulado_por_id else None,
        created_at=orden.created_at,
        updated_at=orden.updated_at,
        proveedor_nombre=orden.proveedor.nombre_display if orden.proveedor else None,
        proveedor_cuit=orden.proveedor.cuit if orden.proveedor else None,
        cuenta_bancaria_nombre=orden.cuenta_bancaria.nombre if orden.cuenta_bancaria else None,
        detalles=detalles,
        puede_editar=orden.puede_editar,
        puede_confirmar=orden.puede_confirmar,
        puede_pagar=orden.puede_pagar,
        puede_anular=orden.puede_anular,
    )


@router.post("", response_model=OrdenPagoResponse, status_code=status.HTTP_201_CREATED)
def crear_orden_pago(
    data: OrdenPagoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Crea una nueva orden de pago."""
    service = OrdenPagoService(db)

    try:
        orden = service.crear_orden_pago(data, str(current_user.id))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Recargar para obtener relaciones
    orden = service.get_orden_pago(str(orden.id))

    detalles = []
    for d in orden.detalles:
        detalles.append(DetalleOrdenPagoResponse(
            id=str(d.id),
            movimiento_id=str(d.movimiento_id),
            descripcion=d.descripcion,
            monto_comprobante=d.monto_comprobante,
            monto_pendiente_antes=d.monto_pendiente_antes,
            monto_a_pagar=d.monto_a_pagar,
            numero_linea=d.numero_linea,
            factura_numero=d.movimiento.factura_numero if d.movimiento else None,
            fecha_factura=d.movimiento.fecha_factura if d.movimiento else None,
            fecha_vencimiento=d.movimiento.fecha_vencimiento if d.movimiento else None,
        ))

    return OrdenPagoResponse(
        id=str(orden.id),
        numero=orden.numero,
        proveedor_id=str(orden.proveedor_id),
        fecha_emision=orden.fecha_emision,
        fecha_pago_programada=orden.fecha_pago_programada,
        fecha_pago_real=orden.fecha_pago_real,
        estado=orden.estado,
        monto_total=orden.monto_total,
        monto_pagado=orden.monto_pagado,
        medio_pago=orden.medio_pago,
        cuenta_bancaria_id=str(orden.cuenta_bancaria_id) if orden.cuenta_bancaria_id else None,
        referencia_pago=orden.referencia_pago,
        concepto=orden.concepto,
        notas=orden.notas,
        anulado=orden.anulado,
        fecha_anulacion=None,
        motivo_anulacion=None,
        creado_por_id=str(orden.creado_por_id),
        pagado_por_id=None,
        anulado_por_id=None,
        created_at=orden.created_at,
        updated_at=orden.updated_at,
        proveedor_nombre=orden.proveedor.nombre_display if orden.proveedor else None,
        proveedor_cuit=orden.proveedor.cuit if orden.proveedor else None,
        cuenta_bancaria_nombre=None,
        detalles=detalles,
        puede_editar=orden.puede_editar,
        puede_confirmar=orden.puede_confirmar,
        puede_pagar=orden.puede_pagar,
        puede_anular=orden.puede_anular,
    )


@router.put("/{orden_id}", response_model=OrdenPagoResponse)
def actualizar_orden_pago(
    orden_id: str,
    data: OrdenPagoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Actualiza una orden de pago (solo en estado borrador)."""
    service = OrdenPagoService(db)

    try:
        orden = service.actualizar_orden_pago(orden_id, data, str(current_user.id))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Recargar para obtener relaciones
    orden = service.get_orden_pago(str(orden.id))

    detalles = []
    for d in orden.detalles:
        detalles.append(DetalleOrdenPagoResponse(
            id=str(d.id),
            movimiento_id=str(d.movimiento_id),
            descripcion=d.descripcion,
            monto_comprobante=d.monto_comprobante,
            monto_pendiente_antes=d.monto_pendiente_antes,
            monto_a_pagar=d.monto_a_pagar,
            numero_linea=d.numero_linea,
            factura_numero=d.movimiento.factura_numero if d.movimiento else None,
            fecha_factura=d.movimiento.fecha_factura if d.movimiento else None,
            fecha_vencimiento=d.movimiento.fecha_vencimiento if d.movimiento else None,
        ))

    return OrdenPagoResponse(
        id=str(orden.id),
        numero=orden.numero,
        proveedor_id=str(orden.proveedor_id),
        fecha_emision=orden.fecha_emision,
        fecha_pago_programada=orden.fecha_pago_programada,
        fecha_pago_real=orden.fecha_pago_real,
        estado=orden.estado,
        monto_total=orden.monto_total,
        monto_pagado=orden.monto_pagado,
        medio_pago=orden.medio_pago,
        cuenta_bancaria_id=str(orden.cuenta_bancaria_id) if orden.cuenta_bancaria_id else None,
        referencia_pago=orden.referencia_pago,
        concepto=orden.concepto,
        notas=orden.notas,
        anulado=orden.anulado,
        fecha_anulacion=orden.fecha_anulacion,
        motivo_anulacion=orden.motivo_anulacion,
        creado_por_id=str(orden.creado_por_id),
        pagado_por_id=str(orden.pagado_por_id) if orden.pagado_por_id else None,
        anulado_por_id=str(orden.anulado_por_id) if orden.anulado_por_id else None,
        created_at=orden.created_at,
        updated_at=orden.updated_at,
        proveedor_nombre=orden.proveedor.nombre_display if orden.proveedor else None,
        proveedor_cuit=orden.proveedor.cuit if orden.proveedor else None,
        cuenta_bancaria_nombre=orden.cuenta_bancaria.nombre if orden.cuenta_bancaria else None,
        detalles=detalles,
        puede_editar=orden.puede_editar,
        puede_confirmar=orden.puede_confirmar,
        puede_pagar=orden.puede_pagar,
        puede_anular=orden.puede_anular,
    )


# ==================== ACCIONES ====================

@router.post("/{orden_id}/confirmar", response_model=MessageResponse)
def confirmar_orden_pago(
    orden_id: str,
    data: Optional[ConfirmarOrdenPagoRequest] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Confirma una orden de pago."""
    service = OrdenPagoService(db)

    notas = data.notas if data else None

    try:
        service.confirmar(orden_id, str(current_user.id), notas)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return MessageResponse(message="Orden de pago confirmada correctamente")


@router.post("/{orden_id}/pagar", response_model=MessageResponse)
def pagar_orden_pago(
    orden_id: str,
    data: PagarOrdenPagoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Efectúa el pago de una orden de pago."""
    service = OrdenPagoService(db)

    try:
        service.pagar(orden_id, data, str(current_user.id))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return MessageResponse(message="Orden de pago procesada correctamente")


@router.post("/{orden_id}/anular", response_model=MessageResponse)
def anular_orden_pago(
    orden_id: str,
    data: AnularOrdenPagoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador")),
):
    """Anula una orden de pago."""
    service = OrdenPagoService(db)

    try:
        service.anular(orden_id, str(current_user.id), data.motivo)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return MessageResponse(message="Orden de pago anulada correctamente")


# ==================== RESUMEN ====================

@router.get("/resumen/general")
def obtener_resumen_ordenes_pago(
    proveedor_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene resumen de órdenes de pago."""
    service = OrdenPagoService(db)
    return service.get_resumen_ordenes(proveedor_id=proveedor_id)


# ==================== CONSTANTES ====================

@router.get("/constantes/estados")
def obtener_estados_orden_pago():
    """Obtiene los estados de órdenes de pago."""
    return ESTADOS_ORDEN_PAGO


@router.get("/constantes/medios-pago")
def obtener_medios_pago():
    """Obtiene los medios de pago disponibles."""
    return MEDIOS_PAGO
