"""
Endpoints de Liquidaciones.
"""

from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.usuario import Usuario
from app.schemas.liquidacion import (
    LiquidacionCreate,
    LiquidacionUpdate,
    LiquidacionResponse,
    LiquidacionDetail,
    LiquidacionList,
    LiquidacionConfirmar,
    LiquidacionAnular,
    LiquidacionDesdeControl,
    ListaPreciosParaLiquidacion,
    ServicioPrecio,
    ResumenLiquidaciones,
)
from app.services import liquidacion_service


router = APIRouter()


@router.get("/", response_model=dict)
def listar_liquidaciones(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    estado: Optional[str] = Query(None),
    cliente_id: Optional[UUID] = Query(None),
    pedido_id: Optional[UUID] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    incluir_anuladas: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista las liquidaciones con filtros."""
    liquidaciones, total = liquidacion_service.obtener_liquidaciones(
        db=db,
        skip=skip,
        limit=limit,
        estado=estado,
        cliente_id=cliente_id,
        pedido_id=pedido_id,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        incluir_anuladas=incluir_anuladas,
    )

    items = []
    for liq in liquidaciones:
        items.append({
            "id": liq.id,
            "numero": liq.numero,
            "pedido_id": liq.pedido_id,
            "pedido_numero": liq.pedido.numero if liq.pedido else None,
            "cliente_id": liq.cliente_id,
            "cliente_nombre": liq.cliente.razon_social if liq.cliente else None,
            "fecha_liquidacion": liq.fecha_liquidacion,
            "subtotal": liq.subtotal,
            "total": liq.total,
            "estado": liq.estado,
            "anulado": liq.anulado,
            "created_at": liq.created_at,
        })

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/resumen", response_model=ResumenLiquidaciones)
def obtener_resumen(
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene resumen de liquidaciones para dashboard."""
    return liquidacion_service.obtener_resumen_liquidaciones(
        db=db,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )


@router.get("/por-pedido/{pedido_id}", response_model=Optional[LiquidacionDetail])
def obtener_liquidacion_por_pedido(
    pedido_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene la liquidación de un pedido si existe."""
    liquidacion = liquidacion_service.obtener_liquidacion_por_pedido(db, pedido_id)
    if not liquidacion:
        return None

    return _build_liquidacion_detail(liquidacion)


@router.get("/precios-lista/{lista_id}", response_model=ListaPreciosParaLiquidacion)
def obtener_precios_lista(
    lista_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene los precios de una lista para liquidación."""
    from app.models.lista_precios import ListaPrecios

    lista = db.query(ListaPrecios).filter(ListaPrecios.id == lista_id).first()
    if not lista:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista de precios no encontrada"
        )

    precios = liquidacion_service.obtener_precios_lista(db, lista_id)

    return {
        "lista_id": lista.id,
        "lista_nombre": lista.nombre,
        "servicios": [ServicioPrecio(**p) for p in precios],
    }


@router.get("/{liquidacion_id}", response_model=LiquidacionDetail)
def obtener_liquidacion(
    liquidacion_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene una liquidación por ID."""
    liquidacion = liquidacion_service.obtener_liquidacion(db, liquidacion_id)
    return _build_liquidacion_detail(liquidacion)


@router.post("/", response_model=LiquidacionDetail, status_code=status.HTTP_201_CREATED)
def crear_liquidacion(
    data: LiquidacionCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Crea una nueva liquidación."""
    liquidacion = liquidacion_service.crear_liquidacion(
        db=db,
        data=data,
        usuario_id=current_user.id,
    )
    return _build_liquidacion_detail(liquidacion)


@router.post("/desde-control", response_model=LiquidacionDetail, status_code=status.HTTP_201_CREATED)
def crear_liquidacion_desde_control(
    data: LiquidacionDesdeControl,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Crea liquidación directamente desde control de producción."""
    liquidacion = liquidacion_service.crear_liquidacion_desde_control(
        db=db,
        data=data,
        usuario_id=current_user.id,
    )
    return _build_liquidacion_detail(liquidacion)


@router.put("/{liquidacion_id}", response_model=LiquidacionDetail)
def actualizar_liquidacion(
    liquidacion_id: UUID,
    data: LiquidacionUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Actualiza una liquidación en estado borrador."""
    liquidacion = liquidacion_service.actualizar_liquidacion(
        db=db,
        liquidacion_id=liquidacion_id,
        data=data,
    )
    return _build_liquidacion_detail(liquidacion)


@router.post("/{liquidacion_id}/confirmar", response_model=LiquidacionDetail)
def confirmar_liquidacion(
    liquidacion_id: UUID,
    data: Optional[LiquidacionConfirmar] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Confirma una liquidación y genera el cargo en cuenta corriente."""
    liquidacion = liquidacion_service.confirmar_liquidacion(
        db=db,
        liquidacion_id=liquidacion_id,
        usuario_id=current_user.id,
        notas=data.notas if data else None,
    )
    return _build_liquidacion_detail(liquidacion)


@router.post("/{liquidacion_id}/anular", response_model=LiquidacionDetail)
def anular_liquidacion(
    liquidacion_id: UUID,
    data: LiquidacionAnular,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Anula una liquidación y revierte el movimiento de cuenta corriente si existe."""
    liquidacion = liquidacion_service.anular_liquidacion(
        db=db,
        liquidacion_id=liquidacion_id,
        usuario_id=current_user.id,
        motivo=data.motivo,
    )
    return _build_liquidacion_detail(liquidacion)


@router.delete("/{liquidacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_liquidacion(
    liquidacion_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Elimina (soft delete) una liquidación en estado borrador."""
    liquidacion = liquidacion_service.obtener_liquidacion(db, liquidacion_id)

    if not liquidacion.puede_editar:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden eliminar liquidaciones en estado borrador"
        )

    liquidacion.activo = False
    db.commit()

    return None


def _build_liquidacion_detail(liquidacion) -> dict:
    """Construye el detalle de liquidación para respuesta."""
    detalles = []
    for d in liquidacion.detalles:
        detalles.append({
            "id": d.id,
            "liquidacion_id": d.liquidacion_id,
            "servicio_id": d.servicio_id,
            "servicio_nombre": d.servicio_nombre,
            "descripcion": d.descripcion,
            "cantidad": d.cantidad,
            "unidad": d.unidad,
            "precio_unitario": d.precio_unitario,
            "subtotal": d.subtotal,
            "lote_id": d.lote_id,
            "numero_linea": d.numero_linea,
            "notas": d.notas,
        })

    return {
        "id": liquidacion.id,
        "numero": liquidacion.numero,
        "pedido_id": liquidacion.pedido_id,
        "cliente_id": liquidacion.cliente_id,
        "lista_precios_id": liquidacion.lista_precios_id,
        "fecha_liquidacion": liquidacion.fecha_liquidacion,
        "subtotal": liquidacion.subtotal,
        "descuento_porcentaje": liquidacion.descuento_porcentaje,
        "descuento_monto": liquidacion.descuento_monto,
        "iva_porcentaje": liquidacion.iva_porcentaje,
        "iva_monto": liquidacion.iva_monto,
        "total": liquidacion.total,
        "estado": liquidacion.estado,
        "movimiento_cc_id": liquidacion.movimiento_cc_id,
        "liquidado_por_id": liquidacion.liquidado_por_id,
        "confirmado_por_id": liquidacion.confirmado_por_id,
        "fecha_confirmacion": liquidacion.fecha_confirmacion,
        "anulado": liquidacion.anulado,
        "anulado_por_id": liquidacion.anulado_por_id,
        "fecha_anulacion": liquidacion.fecha_anulacion,
        "motivo_anulacion": liquidacion.motivo_anulacion,
        "notas": liquidacion.notas,
        "created_at": liquidacion.created_at,
        "updated_at": liquidacion.updated_at,
        "activo": liquidacion.activo,
        "puede_editar": liquidacion.puede_editar,
        "puede_confirmar": liquidacion.puede_confirmar,
        "puede_anular": liquidacion.puede_anular,
        "detalles": detalles,
        "cliente_nombre": liquidacion.cliente.razon_social if liquidacion.cliente else None,
        "cliente_cuit": liquidacion.cliente.cuit if liquidacion.cliente else None,
        "pedido_numero": liquidacion.pedido.numero if liquidacion.pedido else None,
        "lista_precios_nombre": liquidacion.lista_precios.nombre if liquidacion.lista_precios else None,
        "liquidado_por_nombre": f"{liquidacion.liquidado_por.nombre} {liquidacion.liquidado_por.apellido}" if liquidacion.liquidado_por else None,
        "confirmado_por_nombre": f"{liquidacion.confirmado_por.nombre} {liquidacion.confirmado_por.apellido}" if liquidacion.confirmado_por else None,
    }
