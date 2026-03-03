"""
Endpoints de Órdenes de Compra.
"""

from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_permission
from app.models.usuario import Usuario
from app.models.orden_compra import EstadoOrdenCompra
from app.schemas.orden_compra import (
    OrdenCompraCreate,
    OrdenCompraUpdate,
    OrdenCompraResponse,
    OrdenCompraList,
    OrdenCompraDetalleResponse,
    AprobarOrdenRequest,
    CambiarEstadoRequest,
    RecepcionCompraCreate,
    RecepcionCompraResponse,
)
from app.schemas.common import PaginatedResponse, MessageResponse
from app.services.proveedor_service import ProveedorService

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
def listar_ordenes_compra(
    skip: int = 0,
    limit: int = 50,
    proveedor_id: Optional[UUID] = None,
    estado: Optional[EstadoOrdenCompra] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista órdenes de compra con filtros."""
    service = ProveedorService(db)
    ordenes, total = service.get_ordenes_compra(
        proveedor_id=proveedor_id,
        estado=estado,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        skip=skip,
        limit=limit,
    )

    items = []
    for orden in ordenes:
        items.append(OrdenCompraList(
            id=orden.id,
            numero=orden.numero,
            proveedor_id=orden.proveedor_id,
            proveedor_nombre=orden.proveedor.razon_social if orden.proveedor else None,
            estado=EstadoOrdenCompra(orden.estado),
            fecha_emision=orden.fecha_emision,
            total=orden.total,
            moneda=orden.moneda,
        ))

    return PaginatedResponse(
        items=items,
        total=total,
        page=skip // limit + 1 if limit > 0 else 1,
        size=limit,
        pages=(total + limit - 1) // limit if limit > 0 else 1,
    )


@router.get("/{orden_id}", response_model=OrdenCompraResponse)
def obtener_orden_compra(
    orden_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene una orden de compra por ID."""
    service = ProveedorService(db)
    orden = service.get_orden_compra(orden_id)

    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden de compra no encontrada",
        )

    items_response = []
    for item in orden.items:
        items_response.append(OrdenCompraDetalleResponse(
            id=item.id,
            orden_compra_id=item.orden_compra_id,
            insumo_id=item.insumo_id,
            producto_proveedor_id=item.producto_proveedor_id,
            descripcion=item.descripcion,
            cantidad=item.cantidad,
            unidad=item.unidad,
            precio_unitario=item.precio_unitario,
            descuento_porcentaje=item.descuento_porcentaje,
            subtotal=item.subtotal,
            cantidad_recibida=item.cantidad_recibida,
            numero_linea=item.numero_linea,
            notas=item.notas,
            created_at=item.created_at,
            insumo_codigo=item.insumo.codigo if item.insumo else None,
            insumo_nombre=item.insumo.nombre if item.insumo else None,
            cantidad_pendiente=item.cantidad_pendiente,
            completamente_recibido=item.completamente_recibido,
        ))

    return OrdenCompraResponse(
        id=orden.id,
        numero=orden.numero,
        proveedor_id=orden.proveedor_id,
        estado=EstadoOrdenCompra(orden.estado),
        fecha_emision=orden.fecha_emision,
        fecha_entrega_estimada=orden.fecha_entrega_estimada,
        fecha_entrega_real=orden.fecha_entrega_real,
        subtotal=orden.subtotal,
        descuento_porcentaje=orden.descuento_porcentaje,
        descuento_monto=orden.descuento_monto,
        iva=orden.iva,
        total=orden.total,
        moneda=orden.moneda,
        condicion_pago=orden.condicion_pago,
        plazo_pago_dias=orden.plazo_pago_dias,
        lugar_entrega=orden.lugar_entrega,
        requiere_aprobacion=orden.requiere_aprobacion,
        aprobada_por_id=orden.aprobada_por_id,
        fecha_aprobacion=orden.fecha_aprobacion,
        creado_por_id=orden.creado_por_id,
        notas=orden.notas,
        notas_internas=orden.notas_internas,
        created_at=orden.created_at,
        updated_at=orden.updated_at,
        is_active=orden.is_active,
        proveedor_nombre=orden.proveedor.razon_social if orden.proveedor else None,
        creado_por_nombre=orden.creado_por.nombre_completo if orden.creado_por else None,
        aprobada_por_nombre=orden.aprobada_por.nombre_completo if orden.aprobada_por else None,
        items=items_response,
        puede_editar=orden.puede_editar,
        puede_aprobar=orden.puede_aprobar,
        puede_cancelar=orden.puede_cancelar,
    )


@router.post("", response_model=OrdenCompraResponse, status_code=status.HTTP_201_CREATED)
def crear_orden_compra(
    data: OrdenCompraCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("proveedores", "crear")),
):
    """Crea una nueva orden de compra."""
    service = ProveedorService(db)
    orden = service.create_orden_compra(data, current_user.id)

    # Obtener la orden completa con relaciones
    orden = service.get_orden_compra(orden.id)

    items_response = []
    for item in orden.items:
        items_response.append(OrdenCompraDetalleResponse(
            id=item.id,
            orden_compra_id=item.orden_compra_id,
            insumo_id=item.insumo_id,
            producto_proveedor_id=item.producto_proveedor_id,
            descripcion=item.descripcion,
            cantidad=item.cantidad,
            unidad=item.unidad,
            precio_unitario=item.precio_unitario,
            descuento_porcentaje=item.descuento_porcentaje,
            subtotal=item.subtotal,
            cantidad_recibida=item.cantidad_recibida,
            numero_linea=item.numero_linea,
            notas=item.notas,
            created_at=item.created_at,
            insumo_codigo=item.insumo.codigo if item.insumo else None,
            insumo_nombre=item.insumo.nombre if item.insumo else None,
            cantidad_pendiente=item.cantidad_pendiente,
            completamente_recibido=item.completamente_recibido,
        ))

    return OrdenCompraResponse(
        id=orden.id,
        numero=orden.numero,
        proveedor_id=orden.proveedor_id,
        estado=EstadoOrdenCompra(orden.estado),
        fecha_emision=orden.fecha_emision,
        fecha_entrega_estimada=orden.fecha_entrega_estimada,
        fecha_entrega_real=orden.fecha_entrega_real,
        subtotal=orden.subtotal,
        descuento_porcentaje=orden.descuento_porcentaje,
        descuento_monto=orden.descuento_monto,
        iva=orden.iva,
        total=orden.total,
        moneda=orden.moneda,
        condicion_pago=orden.condicion_pago,
        plazo_pago_dias=orden.plazo_pago_dias,
        lugar_entrega=orden.lugar_entrega,
        requiere_aprobacion=orden.requiere_aprobacion,
        aprobada_por_id=orden.aprobada_por_id,
        fecha_aprobacion=orden.fecha_aprobacion,
        creado_por_id=orden.creado_por_id,
        notas=orden.notas,
        notas_internas=orden.notas_internas,
        created_at=orden.created_at,
        updated_at=orden.updated_at,
        is_active=orden.is_active,
        proveedor_nombre=orden.proveedor.razon_social if orden.proveedor else None,
        creado_por_nombre=orden.creado_por.nombre_completo if orden.creado_por else None,
        aprobada_por_nombre=None,
        items=items_response,
        puede_editar=orden.puede_editar,
        puede_aprobar=orden.puede_aprobar,
        puede_cancelar=orden.puede_cancelar,
    )


@router.put("/{orden_id}", response_model=OrdenCompraResponse)
def actualizar_orden_compra(
    orden_id: UUID,
    data: OrdenCompraUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("proveedores", "editar")),
):
    """Actualiza una orden de compra."""
    service = ProveedorService(db)
    orden = service.update_orden_compra(orden_id, data, current_user.id)

    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden de compra no encontrada o no se puede editar",
        )

    # Obtener la orden completa con relaciones
    orden = service.get_orden_compra(orden.id)

    items_response = []
    for item in orden.items:
        items_response.append(OrdenCompraDetalleResponse(
            id=item.id,
            orden_compra_id=item.orden_compra_id,
            insumo_id=item.insumo_id,
            producto_proveedor_id=item.producto_proveedor_id,
            descripcion=item.descripcion,
            cantidad=item.cantidad,
            unidad=item.unidad,
            precio_unitario=item.precio_unitario,
            descuento_porcentaje=item.descuento_porcentaje,
            subtotal=item.subtotal,
            cantidad_recibida=item.cantidad_recibida,
            numero_linea=item.numero_linea,
            notas=item.notas,
            created_at=item.created_at,
            insumo_codigo=item.insumo.codigo if item.insumo else None,
            insumo_nombre=item.insumo.nombre if item.insumo else None,
            cantidad_pendiente=item.cantidad_pendiente,
            completamente_recibido=item.completamente_recibido,
        ))

    return OrdenCompraResponse(
        id=orden.id,
        numero=orden.numero,
        proveedor_id=orden.proveedor_id,
        estado=EstadoOrdenCompra(orden.estado),
        fecha_emision=orden.fecha_emision,
        fecha_entrega_estimada=orden.fecha_entrega_estimada,
        fecha_entrega_real=orden.fecha_entrega_real,
        subtotal=orden.subtotal,
        descuento_porcentaje=orden.descuento_porcentaje,
        descuento_monto=orden.descuento_monto,
        iva=orden.iva,
        total=orden.total,
        moneda=orden.moneda,
        condicion_pago=orden.condicion_pago,
        plazo_pago_dias=orden.plazo_pago_dias,
        lugar_entrega=orden.lugar_entrega,
        requiere_aprobacion=orden.requiere_aprobacion,
        aprobada_por_id=orden.aprobada_por_id,
        fecha_aprobacion=orden.fecha_aprobacion,
        creado_por_id=orden.creado_por_id,
        notas=orden.notas,
        notas_internas=orden.notas_internas,
        created_at=orden.created_at,
        updated_at=orden.updated_at,
        is_active=orden.is_active,
        proveedor_nombre=orden.proveedor.razon_social if orden.proveedor else None,
        creado_por_nombre=orden.creado_por.nombre_completo if orden.creado_por else None,
        aprobada_por_nombre=orden.aprobada_por.nombre_completo if orden.aprobada_por else None,
        items=items_response,
        puede_editar=orden.puede_editar,
        puede_aprobar=orden.puede_aprobar,
        puede_cancelar=orden.puede_cancelar,
    )


@router.post("/{orden_id}/aprobar", response_model=MessageResponse)
def aprobar_orden_compra(
    orden_id: UUID,
    data: AprobarOrdenRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("proveedores", "aprobar")),
):
    """Aprueba una orden de compra."""
    service = ProveedorService(db)
    orden = service.aprobar_orden(orden_id, current_user.id, data.notas)

    if not orden:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La orden no se puede aprobar",
        )

    return MessageResponse(message=f"Orden {orden.numero} aprobada correctamente")


@router.post("/{orden_id}/enviar", response_model=MessageResponse)
def enviar_orden_compra(
    orden_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("proveedores", "editar")),
):
    """Marca la orden como enviada al proveedor."""
    service = ProveedorService(db)
    orden = service.cambiar_estado_orden(
        orden_id=orden_id,
        nuevo_estado=EstadoOrdenCompra.ENVIADA,
        usuario_id=current_user.id,
        notas="Orden enviada al proveedor",
    )

    if not orden:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede cambiar el estado de la orden",
        )

    return MessageResponse(message=f"Orden {orden.numero} marcada como enviada")


@router.post("/{orden_id}/cancelar", response_model=MessageResponse)
def cancelar_orden_compra(
    orden_id: UUID,
    data: CambiarEstadoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("proveedores", "eliminar")),
):
    """Cancela una orden de compra."""
    service = ProveedorService(db)
    orden = service.cancelar_orden(
        orden_id=orden_id,
        usuario_id=current_user.id,
        motivo=data.notas or "Sin motivo especificado",
    )

    if not orden:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La orden no se puede cancelar",
        )

    return MessageResponse(message=f"Orden {orden.numero} cancelada")


# ==================== RECEPCIÓN ====================

@router.post("/{orden_id}/recepcion", response_model=RecepcionCompraResponse)
def registrar_recepcion(
    orden_id: UUID,
    data: RecepcionCompraCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("stock", "editar")),
):
    """Registra la recepción de mercadería de una orden."""
    if data.orden_compra_id != orden_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El ID de la orden no coincide",
        )

    service = ProveedorService(db)

    try:
        recepcion = service.registrar_recepcion(data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return RecepcionCompraResponse(
        id=recepcion.id,
        orden_compra_id=recepcion.orden_compra_id,
        numero=recepcion.numero,
        fecha_recepcion=recepcion.fecha_recepcion,
        remito_numero=recepcion.remito_numero,
        factura_numero=recepcion.factura_numero,
        recibido_por_id=recepcion.recibido_por_id,
        recibido_por_nombre=current_user.nombre_completo,
        estado=recepcion.estado,
        notas=recepcion.notas,
        created_at=recepcion.created_at,
    )
