"""
Endpoints de Pedidos.
"""

from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.usuario import Usuario
from app.services.cliente_service import ClienteService
from app.schemas.pedido import (
    PedidoCreate,
    PedidoUpdate,
    PedidoResponse,
    PedidoList,
    DetallePedidoCreate,
    DetallePedidoResponse,
    CambiarEstadoPedidoRequest,
    ESTADOS_PEDIDO,
    TIPOS_ENTREGA,
)
from app.schemas.common import PaginatedResponse

router = APIRouter()


@router.get("", response_model=PaginatedResponse[PedidoList])
def listar_pedidos(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    cliente_id: Optional[str] = None,
    estado: Optional[str] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista pedidos con filtros y paginación."""
    service = ClienteService(db)
    pedidos, total = service.get_pedidos(
        skip=skip,
        limit=limit,
        cliente_id=cliente_id,
        estado=estado,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )

    return {
        "items": [
            PedidoList(
                id=str(p.id),
                numero=p.numero,
                cliente_id=str(p.cliente_id),
                cliente_nombre=p.cliente.nombre_display if p.cliente else None,
                estado=p.estado,
                fecha_pedido=p.fecha_pedido,
                fecha_entrega_estimada=p.fecha_entrega_estimada,
                total=p.total,
                saldo_pendiente=p.saldo_pendiente,
                tipo_entrega=p.tipo_entrega,
            )
            for p in pedidos
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/estados")
def obtener_estados_pedido():
    """Obtiene los estados de pedido disponibles."""
    return ESTADOS_PEDIDO


@router.get("/tipos-entrega")
def obtener_tipos_entrega():
    """Obtiene los tipos de entrega disponibles."""
    return TIPOS_ENTREGA


@router.get("/{pedido_id}", response_model=PedidoResponse)
def obtener_pedido(
    pedido_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene un pedido por ID."""
    service = ClienteService(db)
    pedido = service.get_pedido(pedido_id)

    if not pedido:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido no encontrado",
        )

    return PedidoResponse(
        id=str(pedido.id),
        numero=pedido.numero,
        cliente_id=str(pedido.cliente_id),
        estado=pedido.estado,
        fecha_pedido=pedido.fecha_pedido,
        fecha_retiro=pedido.fecha_retiro,
        fecha_entrega_estimada=pedido.fecha_entrega_estimada,
        fecha_entrega_real=pedido.fecha_entrega_real,
        fecha_facturacion=pedido.fecha_facturacion,
        tipo_entrega=pedido.tipo_entrega,
        direccion_entrega=pedido.direccion_entrega,
        horario_entrega=pedido.horario_entrega,
        subtotal=pedido.subtotal,
        descuento_porcentaje=pedido.descuento_porcentaje,
        descuento_monto=pedido.descuento_monto,
        iva=pedido.iva,
        total=pedido.total,
        saldo_pendiente=pedido.saldo_pendiente,
        factura_numero=pedido.factura_numero,
        factura_tipo=pedido.factura_tipo,
        notas=pedido.notas,
        notas_internas=pedido.notas_internas,
        observaciones_entrega=pedido.observaciones_entrega,
        creado_por_id=str(pedido.creado_por_id),
        created_at=pedido.created_at,
        updated_at=pedido.updated_at,
        detalles=[
            DetallePedidoResponse(
                id=str(d.id),
                servicio_id=str(d.servicio_id) if d.servicio_id else None,
                descripcion=d.descripcion,
                cantidad=d.cantidad,
                unidad=d.unidad,
                precio_unitario=d.precio_unitario,
                descuento_porcentaje=d.descuento_porcentaje,
                subtotal=d.subtotal,
                notas=d.notas,
            )
            for d in pedido.detalles
        ],
        cliente_nombre=pedido.cliente.nombre_display if pedido.cliente else None,
        creado_por_nombre=pedido.creado_por.nombre_completo if pedido.creado_por else None,
    )


@router.post("", response_model=PedidoResponse, status_code=status.HTTP_201_CREATED)
def crear_pedido(
    data: PedidoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Crea un nuevo pedido."""
    service = ClienteService(db)

    # Verificar que el cliente existe
    cliente = service.get_cliente(data.cliente_id)
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cliente no encontrado",
        )

    pedido = service.create_pedido(data, str(current_user.id))

    return PedidoResponse(
        id=str(pedido.id),
        numero=pedido.numero,
        cliente_id=str(pedido.cliente_id),
        estado=pedido.estado,
        fecha_pedido=pedido.fecha_pedido,
        fecha_retiro=pedido.fecha_retiro,
        fecha_entrega_estimada=pedido.fecha_entrega_estimada,
        fecha_entrega_real=pedido.fecha_entrega_real,
        fecha_facturacion=pedido.fecha_facturacion,
        tipo_entrega=pedido.tipo_entrega,
        direccion_entrega=pedido.direccion_entrega,
        horario_entrega=pedido.horario_entrega,
        subtotal=pedido.subtotal,
        descuento_porcentaje=pedido.descuento_porcentaje,
        descuento_monto=pedido.descuento_monto,
        iva=pedido.iva,
        total=pedido.total,
        saldo_pendiente=pedido.saldo_pendiente,
        factura_numero=pedido.factura_numero,
        factura_tipo=pedido.factura_tipo,
        notas=pedido.notas,
        notas_internas=pedido.notas_internas,
        observaciones_entrega=pedido.observaciones_entrega,
        creado_por_id=str(pedido.creado_por_id),
        created_at=pedido.created_at,
        updated_at=pedido.updated_at,
        detalles=[
            DetallePedidoResponse(
                id=str(d.id),
                servicio_id=str(d.servicio_id) if d.servicio_id else None,
                descripcion=d.descripcion,
                cantidad=d.cantidad,
                unidad=d.unidad,
                precio_unitario=d.precio_unitario,
                descuento_porcentaje=d.descuento_porcentaje,
                subtotal=d.subtotal,
                notas=d.notas,
            )
            for d in pedido.detalles
        ],
        cliente_nombre=pedido.cliente.nombre_display if pedido.cliente else None,
        creado_por_nombre=current_user.nombre_completo,
    )


@router.put("/{pedido_id}", response_model=PedidoResponse)
def actualizar_pedido(
    pedido_id: str,
    data: PedidoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Actualiza un pedido."""
    service = ClienteService(db)

    try:
        pedido = service.update_pedido(pedido_id, data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    if not pedido:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido no encontrado",
        )

    return PedidoResponse(
        id=str(pedido.id),
        numero=pedido.numero,
        cliente_id=str(pedido.cliente_id),
        estado=pedido.estado,
        fecha_pedido=pedido.fecha_pedido,
        fecha_retiro=pedido.fecha_retiro,
        fecha_entrega_estimada=pedido.fecha_entrega_estimada,
        fecha_entrega_real=pedido.fecha_entrega_real,
        fecha_facturacion=pedido.fecha_facturacion,
        tipo_entrega=pedido.tipo_entrega,
        direccion_entrega=pedido.direccion_entrega,
        horario_entrega=pedido.horario_entrega,
        subtotal=pedido.subtotal,
        descuento_porcentaje=pedido.descuento_porcentaje,
        descuento_monto=pedido.descuento_monto,
        iva=pedido.iva,
        total=pedido.total,
        saldo_pendiente=pedido.saldo_pendiente,
        factura_numero=pedido.factura_numero,
        factura_tipo=pedido.factura_tipo,
        notas=pedido.notas,
        notas_internas=pedido.notas_internas,
        observaciones_entrega=pedido.observaciones_entrega,
        creado_por_id=str(pedido.creado_por_id),
        created_at=pedido.created_at,
        updated_at=pedido.updated_at,
        detalles=[
            DetallePedidoResponse(
                id=str(d.id),
                servicio_id=str(d.servicio_id) if d.servicio_id else None,
                descripcion=d.descripcion,
                cantidad=d.cantidad,
                unidad=d.unidad,
                precio_unitario=d.precio_unitario,
                descuento_porcentaje=d.descuento_porcentaje,
                subtotal=d.subtotal,
                notas=d.notas,
            )
            for d in pedido.detalles
        ],
        cliente_nombre=pedido.cliente.nombre_display if pedido.cliente else None,
        creado_por_nombre=pedido.creado_por.nombre_completo if pedido.creado_por else None,
    )


@router.post("/{pedido_id}/detalles", response_model=PedidoResponse)
def agregar_detalle_pedido(
    pedido_id: str,
    data: DetallePedidoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Agrega un detalle a un pedido."""
    service = ClienteService(db)

    try:
        pedido = service.agregar_detalle_pedido(pedido_id, data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    if not pedido:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido no encontrado",
        )

    return PedidoResponse(
        id=str(pedido.id),
        numero=pedido.numero,
        cliente_id=str(pedido.cliente_id),
        estado=pedido.estado,
        fecha_pedido=pedido.fecha_pedido,
        fecha_retiro=pedido.fecha_retiro,
        fecha_entrega_estimada=pedido.fecha_entrega_estimada,
        fecha_entrega_real=pedido.fecha_entrega_real,
        fecha_facturacion=pedido.fecha_facturacion,
        tipo_entrega=pedido.tipo_entrega,
        direccion_entrega=pedido.direccion_entrega,
        horario_entrega=pedido.horario_entrega,
        subtotal=pedido.subtotal,
        descuento_porcentaje=pedido.descuento_porcentaje,
        descuento_monto=pedido.descuento_monto,
        iva=pedido.iva,
        total=pedido.total,
        saldo_pendiente=pedido.saldo_pendiente,
        factura_numero=pedido.factura_numero,
        factura_tipo=pedido.factura_tipo,
        notas=pedido.notas,
        notas_internas=pedido.notas_internas,
        observaciones_entrega=pedido.observaciones_entrega,
        creado_por_id=str(pedido.creado_por_id),
        created_at=pedido.created_at,
        updated_at=pedido.updated_at,
        detalles=[
            DetallePedidoResponse(
                id=str(d.id),
                servicio_id=str(d.servicio_id) if d.servicio_id else None,
                descripcion=d.descripcion,
                cantidad=d.cantidad,
                unidad=d.unidad,
                precio_unitario=d.precio_unitario,
                descuento_porcentaje=d.descuento_porcentaje,
                subtotal=d.subtotal,
                notas=d.notas,
            )
            for d in pedido.detalles
        ],
        cliente_nombre=pedido.cliente.nombre_display if pedido.cliente else None,
        creado_por_nombre=pedido.creado_por.nombre_completo if pedido.creado_por else None,
    )


@router.post("/{pedido_id}/estado")
def cambiar_estado_pedido(
    pedido_id: str,
    data: CambiarEstadoPedidoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Cambia el estado de un pedido."""
    service = ClienteService(db)

    try:
        pedido = service.cambiar_estado_pedido(pedido_id, data.estado, data.observaciones)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    if not pedido:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido no encontrado",
        )

    return {
        "message": f"Pedido cambiado a estado '{data.estado}'",
        "numero": pedido.numero,
        "estado": pedido.estado,
    }


@router.delete("/{pedido_id}")
def cancelar_pedido(
    pedido_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Cancela un pedido."""
    service = ClienteService(db)

    try:
        pedido = service.cambiar_estado_pedido(pedido_id, "cancelado", "Cancelado por el usuario")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    if not pedido:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido no encontrado",
        )

    return {"message": "Pedido cancelado correctamente"}
