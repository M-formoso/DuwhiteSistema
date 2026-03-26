"""
Servicio de Liquidación de Pedidos.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
import uuid

from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from fastapi import HTTPException, status

from app.models.liquidacion import LiquidacionPedido, DetalleLiquidacion, EstadoLiquidacion
from app.models.pedido import Pedido, EstadoPedido
from app.models.cliente import Cliente
from app.models.cuenta_corriente import MovimientoCuentaCorriente, TipoMovimientoCC
from app.models.lista_precios import ListaPrecios, ItemListaPrecios, Servicio
from app.schemas.liquidacion import (
    LiquidacionCreate,
    LiquidacionUpdate,
    DetalleLiquidacionCreate,
    LiquidacionDesdeControl,
)


def generar_numero_liquidacion(db: Session) -> str:
    """Genera el siguiente número de liquidación."""
    anio = datetime.now().year
    prefijo = f"LIQ-{anio}-"

    ultima = db.query(LiquidacionPedido).filter(
        LiquidacionPedido.numero.like(f"{prefijo}%")
    ).order_by(LiquidacionPedido.numero.desc()).first()

    if ultima:
        try:
            ultimo_num = int(ultima.numero.split("-")[-1])
            nuevo_num = ultimo_num + 1
        except (ValueError, IndexError):
            nuevo_num = 1
    else:
        nuevo_num = 1

    return f"{prefijo}{nuevo_num:05d}"


def obtener_liquidaciones(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    estado: Optional[str] = None,
    cliente_id: Optional[UUID] = None,
    pedido_id: Optional[UUID] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    incluir_anuladas: bool = False,
) -> tuple[List[LiquidacionPedido], int]:
    """Obtiene listado de liquidaciones con filtros."""
    query = db.query(LiquidacionPedido).filter(LiquidacionPedido.activo == True)

    if not incluir_anuladas:
        query = query.filter(LiquidacionPedido.anulado == False)

    if estado:
        query = query.filter(LiquidacionPedido.estado == estado)

    if cliente_id:
        query = query.filter(LiquidacionPedido.cliente_id == cliente_id)

    if pedido_id:
        query = query.filter(LiquidacionPedido.pedido_id == pedido_id)

    if fecha_desde:
        query = query.filter(LiquidacionPedido.fecha_liquidacion >= fecha_desde)

    if fecha_hasta:
        query = query.filter(LiquidacionPedido.fecha_liquidacion <= fecha_hasta)

    total = query.count()
    liquidaciones = query.order_by(LiquidacionPedido.created_at.desc()).offset(skip).limit(limit).all()

    return liquidaciones, total


def obtener_liquidacion(db: Session, liquidacion_id: UUID) -> LiquidacionPedido:
    """Obtiene una liquidación por ID."""
    liquidacion = db.query(LiquidacionPedido).filter(
        LiquidacionPedido.id == liquidacion_id,
        LiquidacionPedido.activo == True
    ).first()

    if not liquidacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Liquidación no encontrada"
        )

    return liquidacion


def obtener_liquidacion_por_pedido(db: Session, pedido_id: UUID) -> Optional[LiquidacionPedido]:
    """Obtiene la liquidación de un pedido si existe."""
    return db.query(LiquidacionPedido).filter(
        LiquidacionPedido.pedido_id == pedido_id,
        LiquidacionPedido.activo == True,
        LiquidacionPedido.anulado == False
    ).first()


def crear_liquidacion(
    db: Session,
    data: LiquidacionCreate,
    usuario_id: UUID,
) -> LiquidacionPedido:
    """Crea una nueva liquidación."""

    # Verificar que el pedido existe
    pedido = db.query(Pedido).filter(Pedido.id == data.pedido_id).first()
    if not pedido:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido no encontrado"
        )

    # Verificar que no existe liquidación activa para este pedido
    liquidacion_existente = obtener_liquidacion_por_pedido(db, data.pedido_id)
    if liquidacion_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una liquidación para este pedido"
        )

    # Verificar cliente
    cliente = db.query(Cliente).filter(Cliente.id == data.cliente_id).first()
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado"
        )

    # Crear liquidación
    liquidacion = LiquidacionPedido(
        id=uuid.uuid4(),
        numero=generar_numero_liquidacion(db),
        pedido_id=data.pedido_id,
        cliente_id=data.cliente_id,
        lista_precios_id=data.lista_precios_id,
        fecha_liquidacion=data.fecha_liquidacion,
        descuento_porcentaje=data.descuento_porcentaje or Decimal("0"),
        iva_porcentaje=data.iva_porcentaje or Decimal("21"),
        notas=data.notas,
        estado=EstadoLiquidacion.BORRADOR.value,
        liquidado_por_id=usuario_id,
    )

    # Crear detalles
    for idx, detalle_data in enumerate(data.detalles, start=1):
        subtotal = detalle_data.cantidad * detalle_data.precio_unitario
        detalle = DetalleLiquidacion(
            id=uuid.uuid4(),
            liquidacion_id=liquidacion.id,
            servicio_id=detalle_data.servicio_id,
            servicio_nombre=detalle_data.servicio_nombre,
            descripcion=detalle_data.descripcion,
            cantidad=detalle_data.cantidad,
            unidad=detalle_data.unidad,
            precio_unitario=detalle_data.precio_unitario,
            subtotal=subtotal,
            lote_id=detalle_data.lote_id,
            numero_linea=idx,
            notas=detalle_data.notas,
        )
        liquidacion.detalles.append(detalle)

    # Calcular totales
    liquidacion.calcular_totales()

    db.add(liquidacion)
    db.commit()
    db.refresh(liquidacion)

    return liquidacion


def actualizar_liquidacion(
    db: Session,
    liquidacion_id: UUID,
    data: LiquidacionUpdate,
) -> LiquidacionPedido:
    """Actualiza una liquidación en estado borrador."""
    liquidacion = obtener_liquidacion(db, liquidacion_id)

    if not liquidacion.puede_editar:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden editar liquidaciones en estado borrador"
        )

    # Actualizar campos básicos
    if data.lista_precios_id is not None:
        liquidacion.lista_precios_id = data.lista_precios_id
    if data.fecha_liquidacion is not None:
        liquidacion.fecha_liquidacion = data.fecha_liquidacion
    if data.descuento_porcentaje is not None:
        liquidacion.descuento_porcentaje = data.descuento_porcentaje
    if data.iva_porcentaje is not None:
        liquidacion.iva_porcentaje = data.iva_porcentaje
    if data.notas is not None:
        liquidacion.notas = data.notas

    # Actualizar detalles si se proporcionan
    if data.detalles is not None:
        # Eliminar detalles existentes
        for detalle in liquidacion.detalles:
            db.delete(detalle)

        # Crear nuevos detalles
        liquidacion.detalles = []
        for idx, detalle_data in enumerate(data.detalles, start=1):
            subtotal = detalle_data.cantidad * detalle_data.precio_unitario
            detalle = DetalleLiquidacion(
                id=uuid.uuid4(),
                liquidacion_id=liquidacion.id,
                servicio_id=detalle_data.servicio_id,
                servicio_nombre=detalle_data.servicio_nombre,
                descripcion=detalle_data.descripcion,
                cantidad=detalle_data.cantidad,
                unidad=detalle_data.unidad,
                precio_unitario=detalle_data.precio_unitario,
                subtotal=subtotal,
                lote_id=detalle_data.lote_id,
                numero_linea=idx,
                notas=detalle_data.notas,
            )
            liquidacion.detalles.append(detalle)

    # Recalcular totales
    liquidacion.calcular_totales()

    db.commit()
    db.refresh(liquidacion)

    return liquidacion


def confirmar_liquidacion(
    db: Session,
    liquidacion_id: UUID,
    usuario_id: UUID,
    notas: Optional[str] = None,
) -> LiquidacionPedido:
    """Confirma una liquidación y genera el cargo en cuenta corriente."""
    liquidacion = obtener_liquidacion(db, liquidacion_id)

    if not liquidacion.puede_confirmar:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La liquidación no puede ser confirmada"
        )

    # Obtener cliente para el saldo
    cliente = db.query(Cliente).filter(Cliente.id == liquidacion.cliente_id).first()
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado"
        )

    saldo_anterior = cliente.saldo_cuenta_corriente or Decimal("0")
    saldo_posterior = saldo_anterior + liquidacion.total

    # Crear movimiento de cuenta corriente
    movimiento = MovimientoCuentaCorriente(
        id=uuid.uuid4(),
        cliente_id=liquidacion.cliente_id,
        tipo=TipoMovimientoCC.CARGO.value,
        concepto=f"Liquidación {liquidacion.numero} - Pedido {liquidacion.pedido.numero if liquidacion.pedido else 'N/A'}",
        pedido_id=liquidacion.pedido_id,
        monto=liquidacion.total,
        saldo_anterior=saldo_anterior,
        saldo_posterior=saldo_posterior,
        fecha_movimiento=date.today(),
        registrado_por_id=usuario_id,
        notas=notas,
        activo=True,
    )

    db.add(movimiento)

    # Actualizar saldo del cliente
    cliente.saldo_cuenta_corriente = saldo_posterior

    # Actualizar liquidación
    liquidacion.estado = EstadoLiquidacion.CONFIRMADA.value
    liquidacion.movimiento_cc_id = movimiento.id
    liquidacion.confirmado_por_id = usuario_id
    liquidacion.fecha_confirmacion = datetime.now()

    if notas:
        liquidacion.notas = (liquidacion.notas or "") + f"\n[Confirmación] {notas}"

    # Actualizar estado del pedido
    if liquidacion.pedido:
        liquidacion.pedido.estado = EstadoPedido.FACTURADO.value

    db.commit()
    db.refresh(liquidacion)

    return liquidacion


def anular_liquidacion(
    db: Session,
    liquidacion_id: UUID,
    usuario_id: UUID,
    motivo: str,
) -> LiquidacionPedido:
    """Anula una liquidación y revierte el movimiento de cuenta corriente si existe."""
    liquidacion = obtener_liquidacion(db, liquidacion_id)

    if not liquidacion.puede_anular:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La liquidación no puede ser anulada"
        )

    # Si tenía movimiento de CC, revertirlo
    if liquidacion.movimiento_cc_id:
        cliente = db.query(Cliente).filter(Cliente.id == liquidacion.cliente_id).first()
        if cliente:
            saldo_anterior = cliente.saldo_cuenta_corriente or Decimal("0")
            saldo_posterior = saldo_anterior - liquidacion.total

            # Crear movimiento de reversión
            movimiento_reversion = MovimientoCuentaCorriente(
                id=uuid.uuid4(),
                cliente_id=liquidacion.cliente_id,
                tipo=TipoMovimientoCC.AJUSTE.value,
                concepto=f"Anulación Liquidación {liquidacion.numero}",
                pedido_id=liquidacion.pedido_id,
                monto=-liquidacion.total,
                saldo_anterior=saldo_anterior,
                saldo_posterior=saldo_posterior,
                fecha_movimiento=date.today(),
                registrado_por_id=usuario_id,
                notas=f"Anulación: {motivo}",
                activo=True,
            )
            db.add(movimiento_reversion)

            # Actualizar saldo del cliente
            cliente.saldo_cuenta_corriente = saldo_posterior

    # Actualizar liquidación
    liquidacion.estado = EstadoLiquidacion.ANULADA.value
    liquidacion.anulado = True
    liquidacion.anulado_por_id = usuario_id
    liquidacion.fecha_anulacion = datetime.now()
    liquidacion.motivo_anulacion = motivo

    # Restaurar estado del pedido si corresponde
    if liquidacion.pedido and liquidacion.pedido.estado == EstadoPedido.FACTURADO.value:
        liquidacion.pedido.estado = EstadoPedido.LISTO.value

    db.commit()
    db.refresh(liquidacion)

    return liquidacion


def obtener_precios_lista(
    db: Session,
    lista_id: UUID,
) -> List[dict]:
    """Obtiene los precios de una lista para liquidación."""
    items = db.query(ItemListaPrecios).filter(
        ItemListaPrecios.lista_id == lista_id,
        ItemListaPrecios.activo == True
    ).all()

    result = []
    for item in items:
        servicio = db.query(Servicio).filter(Servicio.id == item.servicio_id).first()
        if servicio:
            result.append({
                "servicio_id": servicio.id,
                "servicio_codigo": servicio.codigo,
                "servicio_nombre": servicio.nombre,
                "unidad_cobro": servicio.unidad_cobro,
                "precio": item.precio,
                "precio_minimo": item.precio_minimo,
            })

    return result


def obtener_resumen_liquidaciones(
    db: Session,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
) -> dict:
    """Obtiene resumen de liquidaciones para dashboard."""
    query = db.query(LiquidacionPedido).filter(LiquidacionPedido.activo == True)

    if fecha_desde:
        query = query.filter(LiquidacionPedido.fecha_liquidacion >= fecha_desde)
    if fecha_hasta:
        query = query.filter(LiquidacionPedido.fecha_liquidacion <= fecha_hasta)

    liquidaciones = query.all()

    resumen = {
        "total_borradores": 0,
        "total_confirmadas": 0,
        "total_facturadas": 0,
        "total_anuladas": 0,
        "monto_borradores": Decimal("0"),
        "monto_confirmadas": Decimal("0"),
        "monto_facturadas": Decimal("0"),
    }

    for liq in liquidaciones:
        if liq.anulado:
            resumen["total_anuladas"] += 1
        elif liq.estado == EstadoLiquidacion.BORRADOR.value:
            resumen["total_borradores"] += 1
            resumen["monto_borradores"] += liq.total
        elif liq.estado == EstadoLiquidacion.CONFIRMADA.value:
            resumen["total_confirmadas"] += 1
            resumen["monto_confirmadas"] += liq.total
        elif liq.estado == EstadoLiquidacion.FACTURADA.value:
            resumen["total_facturadas"] += 1
            resumen["monto_facturadas"] += liq.total

    return resumen


def crear_liquidacion_desde_control(
    db: Session,
    data: LiquidacionDesdeControl,
    usuario_id: UUID,
) -> LiquidacionPedido:
    """Crea liquidación directamente desde control de producción."""
    # Obtener pedido
    pedido = db.query(Pedido).filter(Pedido.id == data.pedido_id).first()
    if not pedido:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido no encontrado"
        )

    # Crear datos de liquidación
    liquidacion_data = LiquidacionCreate(
        pedido_id=data.pedido_id,
        cliente_id=pedido.cliente_id,
        lista_precios_id=data.lista_precios_id,
        fecha_liquidacion=date.today(),
        descuento_porcentaje=data.descuento_porcentaje or Decimal("0"),
        notas=data.notas,
        detalles=data.detalles,
    )

    return crear_liquidacion(db, liquidacion_data, usuario_id)
