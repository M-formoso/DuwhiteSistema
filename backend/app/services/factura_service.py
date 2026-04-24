"""
Servicio de Facturación.

Responsable de:
- Crear facturas (desde pedido o manual) en estado BORRADOR.
- Calcular totales con IVA discriminado.
- Determinar tipo de comprobante según condición IVA.
- Listar / obtener / anular borradores.

La emisión contra AFIP (solicitar CAE) está en ``emitir_factura`` pero su
implementación completa se agrega en la Fase 4. Aquí solo queda el esqueleto.
"""

import logging
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Tuple
from uuid import UUID
import uuid

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.cliente import Cliente, CondicionIVA
from app.models.cuenta_corriente import (
    MovimientoCuentaCorriente,
    TipoMovimientoCC,
    EstadoFacturacion,
    MedioPago,
)
from app.models.factura import (
    Factura,
    FacturaDetalle,
    TipoComprobante,
    EstadoFactura,
    EstadoPago,
    ConceptoAfip,
    CondicionVenta,
    CODIGO_AFIP,
    LETRA_COMPROBANTE,
)
from app.models.pedido import Pedido, EstadoPedido
from app.schemas.factura import (
    FacturaCreateDesdePedido,
    FacturaCreateManual,
    FacturaDetalleCreate,
    FacturaFiltros,
    NotaCreditoCreate,
    NotaDebitoCreate,
    RegistrarCobroRequest,
)

logger = logging.getLogger(__name__)


# ==================== CONSTANTES ====================

DOS_DECIMALES = Decimal("0.01")
CUATRO_DECIMALES = Decimal("0.0001")


def _q2(value: Decimal) -> Decimal:
    """Redondeo bancario a 2 decimales."""
    return value.quantize(DOS_DECIMALES, rounding=ROUND_HALF_UP)


# ==================== TIPO DE COMPROBANTE ====================


def determinar_tipo_factura(condicion_iva: str) -> TipoComprobante:
    """
    DUWHITE es Responsable Inscripto; emite:
    - Factura A si el cliente también es RI.
    - Factura B en los demás casos.
    """
    if condicion_iva == CondicionIVA.RESPONSABLE_INSCRIPTO.value:
        return TipoComprobante.FACTURA_A
    return TipoComprobante.FACTURA_B


def tipo_nc_para(factura: Factura) -> TipoComprobante:
    letra = LETRA_COMPROBANTE.get(TipoComprobante(factura.tipo))
    return TipoComprobante.NOTA_CREDITO_A if letra == "A" else TipoComprobante.NOTA_CREDITO_B


def tipo_nd_para(factura: Factura) -> TipoComprobante:
    letra = LETRA_COMPROBANTE.get(TipoComprobante(factura.tipo))
    return TipoComprobante.NOTA_DEBITO_A if letra == "A" else TipoComprobante.NOTA_DEBITO_B


# ==================== CÁLCULOS ====================


def calcular_linea(
    precio_unitario_neto: Decimal,
    cantidad: Decimal,
    descuento_porcentaje: Decimal,
    iva_porcentaje: Decimal,
) -> dict:
    """
    Calcula los montos de una línea de factura.

    ``precio_unitario_neto`` es SIEMPRE sin IVA (el cálculo internamente es igual
    para A y B). La diferencia A/B es cómo se *muestra* en el PDF.
    """
    precio = Decimal(precio_unitario_neto)
    cant = Decimal(cantidad)
    descuento_pct = Decimal(descuento_porcentaje or 0)
    iva_pct = Decimal(iva_porcentaje or 0)

    subtotal_bruto = precio * cant
    descuento_monto = subtotal_bruto * (descuento_pct / Decimal("100"))
    subtotal_neto = _q2(subtotal_bruto - descuento_monto)
    iva_monto = _q2(subtotal_neto * (iva_pct / Decimal("100")))
    total_linea = _q2(subtotal_neto + iva_monto)

    return {
        "subtotal_neto": subtotal_neto,
        "iva_monto": iva_monto,
        "total_linea": total_linea,
    }


def calcular_totales(detalles: List[FacturaDetalle]) -> dict:
    """Agrega los totales de una factura a partir de sus líneas."""
    subtotal = Decimal("0")
    neto_21 = Decimal("0")
    neto_105 = Decimal("0")
    neto_no_grav = Decimal("0")
    iva_21 = Decimal("0")
    iva_105 = Decimal("0")

    for d in detalles:
        subtotal += d.subtotal_neto
        iva_pct = Decimal(d.iva_porcentaje)
        if iva_pct == Decimal("21"):
            neto_21 += d.subtotal_neto
            iva_21 += d.iva_monto
        elif iva_pct == Decimal("10.5"):
            neto_105 += d.subtotal_neto
            iva_105 += d.iva_monto
        else:
            neto_no_grav += d.subtotal_neto

    total = neto_21 + iva_21 + neto_105 + iva_105 + neto_no_grav

    return {
        "subtotal": _q2(subtotal),
        "neto_gravado_21": _q2(neto_21),
        "neto_gravado_105": _q2(neto_105),
        "neto_no_gravado": _q2(neto_no_grav),
        "iva_21": _q2(iva_21),
        "iva_105": _q2(iva_105),
        "total": _q2(total),
    }


# ==================== SNAPSHOT CLIENTE ====================


def _snapshot_cliente(cliente: Cliente) -> dict:
    """Toma los datos fiscales del cliente al momento de crear la factura."""
    if cliente.cuit:
        doc_tipo, doc_nro = "CUIT", cliente.cuit
    elif cliente.condicion_iva == CondicionIVA.CONSUMIDOR_FINAL.value:
        doc_tipo, doc_nro = "CF", ""
    else:
        doc_tipo, doc_nro = "DNI", ""

    domicilio = ", ".join(
        filter(None, [cliente.direccion, cliente.ciudad, cliente.provincia])
    )

    return {
        "cliente_razon_social_snap": cliente.razon_social,
        "cliente_cuit_snap": cliente.cuit,
        "cliente_documento_tipo_snap": doc_tipo,
        "cliente_documento_nro_snap": doc_nro,
        "cliente_condicion_iva_snap": cliente.condicion_iva,
        "cliente_domicilio_snap": domicilio or None,
    }


# ==================== CREAR FACTURAS ====================


def crear_desde_pedido(
    db: Session,
    data: FacturaCreateDesdePedido,
    usuario_id: UUID,
    punto_venta: int,
) -> Factura:
    """
    Crea una factura BORRADOR a partir de un pedido confirmado.

    Raises:
        404 si el pedido no existe.
        400 si el pedido ya tiene una factura activa (no ANULADA/RECHAZADA).
        400 si el pedido no tiene detalles.
    """
    pedido = db.query(Pedido).filter(
        Pedido.id == data.pedido_id,
        Pedido.activo == True,
    ).first()

    if not pedido:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")

    # Evitar facturas duplicadas (borrador, autorizada) para el mismo pedido
    existente = (
        db.query(Factura)
        .filter(
            Factura.pedido_id == pedido.id,
            Factura.activo == True,
            Factura.estado.in_(
                [EstadoFactura.BORRADOR.value, EstadoFactura.AUTORIZADA.value]
            ),
        )
        .first()
    )
    if existente:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"El pedido ya tiene una factura activa ({existente.estado})",
        )

    if not pedido.detalles:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="El pedido no tiene detalles para facturar",
        )

    cliente = db.query(Cliente).filter(Cliente.id == pedido.cliente_id).first()
    if not cliente:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Cliente del pedido no encontrado")

    tipo = determinar_tipo_factura(cliente.condicion_iva)
    snap = _snapshot_cliente(cliente)

    factura = Factura(
        id=uuid.uuid4(),
        tipo=tipo.value,
        punto_venta=punto_venta,
        pedido_id=pedido.id,
        cliente_id=cliente.id,
        fecha_emision=data.fecha_emision or date.today(),
        fecha_servicio_desde=data.fecha_servicio_desde or pedido.fecha_pedido,
        fecha_servicio_hasta=data.fecha_servicio_hasta or pedido.fecha_entrega_real or pedido.fecha_entrega_estimada,
        fecha_vencimiento_pago=data.fecha_vencimiento_pago,
        concepto_afip=data.concepto_afip or ConceptoAfip.SERVICIOS.value,
        condicion_venta=data.condicion_venta or CondicionVenta.CUENTA_CORRIENTE.value,
        observaciones=data.observaciones,
        estado=EstadoFactura.BORRADOR.value,
        creado_por_id=usuario_id,
        **snap,
    )
    db.add(factura)
    db.flush()

    # Mapear detalles del pedido a detalles de factura (todos a IVA 21%)
    iva_default = Decimal("21")
    for det in pedido.detalles:
        montos = calcular_linea(
            precio_unitario_neto=det.precio_unitario,
            cantidad=det.cantidad,
            descuento_porcentaje=det.descuento_porcentaje or Decimal("0"),
            iva_porcentaje=iva_default,
        )
        db.add(
            FacturaDetalle(
                id=uuid.uuid4(),
                factura_id=factura.id,
                detalle_pedido_id=det.id,
                descripcion=det.descripcion,
                cantidad=det.cantidad,
                unidad_medida=det.unidad or "unidad",
                precio_unitario_neto=det.precio_unitario,
                descuento_porcentaje=det.descuento_porcentaje or Decimal("0"),
                iva_porcentaje=iva_default,
                **montos,
            )
        )

    db.flush()
    db.refresh(factura)
    _recalcular_y_persistir_totales(db, factura)
    return factura


def crear_manual(
    db: Session,
    data: FacturaCreateManual,
    usuario_id: UUID,
    punto_venta: int,
) -> Factura:
    """Crea una factura BORRADOR sin pedido (venta suelta)."""
    cliente = db.query(Cliente).filter(
        Cliente.id == data.cliente_id, Cliente.activo == True
    ).first()
    if not cliente:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")

    if not data.detalles:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="La factura necesita al menos un ítem")

    tipo = determinar_tipo_factura(cliente.condicion_iva)
    snap = _snapshot_cliente(cliente)

    factura = Factura(
        id=uuid.uuid4(),
        tipo=tipo.value,
        punto_venta=punto_venta,
        cliente_id=cliente.id,
        fecha_emision=data.fecha_emision or date.today(),
        fecha_servicio_desde=data.fecha_servicio_desde,
        fecha_servicio_hasta=data.fecha_servicio_hasta,
        fecha_vencimiento_pago=data.fecha_vencimiento_pago,
        concepto_afip=data.concepto_afip or ConceptoAfip.SERVICIOS.value,
        condicion_venta=data.condicion_venta or CondicionVenta.CUENTA_CORRIENTE.value,
        observaciones=data.observaciones,
        estado=EstadoFactura.BORRADOR.value,
        creado_por_id=usuario_id,
        **snap,
    )
    db.add(factura)
    db.flush()

    for d in data.detalles:
        montos = calcular_linea(
            precio_unitario_neto=d.precio_unitario_neto,
            cantidad=d.cantidad,
            descuento_porcentaje=d.descuento_porcentaje,
            iva_porcentaje=d.iva_porcentaje,
        )
        db.add(
            FacturaDetalle(
                id=uuid.uuid4(),
                factura_id=factura.id,
                detalle_pedido_id=d.detalle_pedido_id,
                producto_lavado_id=d.producto_lavado_id,
                descripcion=d.descripcion,
                cantidad=d.cantidad,
                unidad_medida=d.unidad_medida or "unidad",
                precio_unitario_neto=d.precio_unitario_neto,
                descuento_porcentaje=d.descuento_porcentaje,
                iva_porcentaje=d.iva_porcentaje,
                **montos,
            )
        )

    db.flush()
    db.refresh(factura)
    _recalcular_y_persistir_totales(db, factura)
    return factura


def _recalcular_y_persistir_totales(db: Session, factura: Factura) -> None:
    """Recalcula totales de la factura sumando sus líneas y guarda."""
    totales = calcular_totales(factura.detalles)
    factura.subtotal = totales["subtotal"]
    factura.neto_gravado_21 = totales["neto_gravado_21"]
    factura.neto_gravado_105 = totales["neto_gravado_105"]
    factura.neto_no_gravado = totales["neto_no_gravado"]
    factura.iva_21 = totales["iva_21"]
    factura.iva_105 = totales["iva_105"]
    factura.total = totales["total"]
    db.flush()


# ==================== PEDIDOS PENDIENTES DE FACTURAR ====================


def listar_pedidos_pendientes(
    db: Session,
    cliente_id: Optional[UUID] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    solo_listos: bool = False,
    page: int = 1,
    page_size: int = 50,
) -> Tuple[List[Pedido], int]:
    """
    Pedidos pendientes de facturar.

    Criterios:
      - pedido.activo == True
      - pedido.estado NOT IN ('cancelado', 'facturado', 'borrador')
      - NO tienen factura activa (borrador o autorizada) asociada
      - Si ``solo_listos=True``, filtra además a ('listo', 'entregado').

    Se ordena poniendo primero los que ya terminaron producción.
    """
    from sqlalchemy import case

    subq_facturas_activas = (
        db.query(Factura.pedido_id)
        .filter(
            Factura.activo == True,
            Factura.pedido_id.isnot(None),
            Factura.estado.in_(
                [EstadoFactura.BORRADOR.value, EstadoFactura.AUTORIZADA.value]
            ),
        )
        .subquery()
    )

    # Estados "candidatos a factura": todo lo que no sea terminal
    estados_validos = [
        EstadoPedido.CONFIRMADO.value,
        EstadoPedido.EN_PROCESO.value,
        EstadoPedido.LISTO.value,
        EstadoPedido.ENTREGADO.value,
    ]
    if solo_listos:
        estados_validos = [EstadoPedido.LISTO.value, EstadoPedido.ENTREGADO.value]

    query = db.query(Pedido).filter(
        Pedido.activo == True,
        Pedido.estado.in_(estados_validos),
        ~Pedido.id.in_(subq_facturas_activas),
    )

    if cliente_id:
        query = query.filter(Pedido.cliente_id == cliente_id)
    if fecha_desde:
        query = query.filter(Pedido.fecha_pedido >= fecha_desde)
    if fecha_hasta:
        query = query.filter(Pedido.fecha_pedido <= fecha_hasta)

    total = query.count()

    # Orden: primero entregados, después listos, después en_proceso, después confirmado.
    orden_estado = case(
        (Pedido.estado == EstadoPedido.ENTREGADO.value, 1),
        (Pedido.estado == EstadoPedido.LISTO.value, 2),
        (Pedido.estado == EstadoPedido.EN_PROCESO.value, 3),
        (Pedido.estado == EstadoPedido.CONFIRMADO.value, 4),
        else_=5,
    )
    query = (
        query.order_by(
            orden_estado,
            Pedido.fecha_entrega_real.desc().nullslast(),
            Pedido.fecha_pedido.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    return query.all(), total


def facturar_pedidos_masivo(
    db: Session,
    pedido_ids: List[UUID],
    usuario_id: UUID,
    punto_venta: int,
) -> dict:
    """
    Crea facturas BORRADOR para una lista de pedidos.
    No emite a AFIP — solo crea los borradores (el usuario después revisa y emite).

    Devuelve ``{creadas: [factura_ids], errores: [{pedido_id, detail}]}``
    sin abortar la transacción si algún pedido falla (se saltea).
    """
    from app.schemas.factura import FacturaCreateDesdePedido

    creadas: List[str] = []
    errores: List[dict] = []

    for pid in pedido_ids:
        try:
            factura = crear_desde_pedido(
                db=db,
                data=FacturaCreateDesdePedido(pedido_id=str(pid)),
                usuario_id=usuario_id,
                punto_venta=punto_venta,
            )
            creadas.append(str(factura.id))
        except HTTPException as exc:
            errores.append({"pedido_id": str(pid), "detail": exc.detail})
        except Exception as exc:  # defensive: no romper el batch
            errores.append({"pedido_id": str(pid), "detail": str(exc)})

    return {"creadas": creadas, "errores": errores}


# ==================== LECTURA ====================


def obtener(db: Session, factura_id: UUID) -> Optional[Factura]:
    return (
        db.query(Factura)
        .filter(Factura.id == factura_id, Factura.activo == True)
        .first()
    )


def listar(
    db: Session,
    filtros: FacturaFiltros,
) -> Tuple[List[Factura], int]:
    query = db.query(Factura).filter(Factura.activo == True)

    if filtros.cliente_id:
        query = query.filter(Factura.cliente_id == filtros.cliente_id)
    if filtros.tipo:
        query = query.filter(Factura.tipo == filtros.tipo)
    if filtros.estado:
        query = query.filter(Factura.estado == filtros.estado)
    if filtros.estado_pago:
        query = query.filter(Factura.estado_pago == filtros.estado_pago)
    if filtros.fecha_desde:
        query = query.filter(Factura.fecha_emision >= filtros.fecha_desde)
    if filtros.fecha_hasta:
        query = query.filter(Factura.fecha_emision <= filtros.fecha_hasta)
    if filtros.numero:
        like = f"%{filtros.numero}%"
        query = query.filter(
            or_(
                Factura.numero_completo.ilike(like),
                Factura.cae.ilike(like),
            )
        )

    total = query.count()

    query = query.order_by(Factura.fecha_emision.desc(), Factura.created_at.desc())
    query = query.offset((filtros.page - 1) * filtros.page_size).limit(filtros.page_size)

    return query.all(), total


# ==================== EDICIÓN / ANULACIÓN BORRADOR ====================


def eliminar_borrador(db: Session, factura_id: UUID) -> None:
    """
    Soft-delete de una factura BORRADOR. No se permite para autorizadas.
    Para anular una factura con CAE hay que emitir una NC.
    """
    factura = obtener(db, factura_id)
    if not factura:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Factura no encontrada")

    if factura.estado != EstadoFactura.BORRADOR.value:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden eliminar facturas en estado borrador. Para anular una factura autorizada emití una Nota de Crédito.",
        )

    factura.activo = False
    db.flush()


# ==================== NOTAS DE CRÉDITO / DÉBITO ====================


def crear_nota_credito(
    db: Session,
    factura_original_id: UUID,
    data: NotaCreditoCreate,
    usuario_id: UUID,
) -> Factura:
    """
    Crea una Nota de Crédito BORRADOR asociada a una factura AUTORIZADA.

    - Si ``data.total=True`` la NC cubre el total de la factura original
      (generará anulación al emitirse).
    - Si se pasan ``data.detalles`` la NC es parcial. La suma de totales no
      puede superar el total de la factura original.
    """
    original = obtener(db, factura_original_id)
    if not original:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Factura original no encontrada")
    if original.estado != EstadoFactura.AUTORIZADA.value:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden generar notas de crédito sobre facturas autorizadas.",
        )
    if original.es_nota_credito or original.es_nota_debito:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="No se puede emitir NC sobre otra nota.",
        )

    tipo_nc = tipo_nc_para(original)

    nc = Factura(
        id=uuid.uuid4(),
        tipo=tipo_nc.value,
        punto_venta=original.punto_venta,
        cliente_id=original.cliente_id,
        cliente_razon_social_snap=original.cliente_razon_social_snap,
        cliente_cuit_snap=original.cliente_cuit_snap,
        cliente_documento_tipo_snap=original.cliente_documento_tipo_snap,
        cliente_documento_nro_snap=original.cliente_documento_nro_snap,
        cliente_condicion_iva_snap=original.cliente_condicion_iva_snap,
        cliente_domicilio_snap=original.cliente_domicilio_snap,
        factura_original_id=original.id,
        fecha_emision=data.fecha_emision or date.today(),
        fecha_servicio_desde=original.fecha_servicio_desde,
        fecha_servicio_hasta=original.fecha_servicio_hasta,
        concepto_afip=original.concepto_afip,
        condicion_venta=original.condicion_venta,
        motivo=data.motivo,
        observaciones=data.observaciones,
        estado=EstadoFactura.BORRADOR.value,
        creado_por_id=usuario_id,
    )
    db.add(nc)
    db.flush()

    if data.total:
        # Replicar las mismas líneas de la original
        for det_orig in original.detalles:
            db.add(
                FacturaDetalle(
                    id=uuid.uuid4(),
                    factura_id=nc.id,
                    descripcion=det_orig.descripcion,
                    cantidad=det_orig.cantidad,
                    unidad_medida=det_orig.unidad_medida,
                    precio_unitario_neto=det_orig.precio_unitario_neto,
                    descuento_porcentaje=det_orig.descuento_porcentaje,
                    iva_porcentaje=det_orig.iva_porcentaje,
                    subtotal_neto=det_orig.subtotal_neto,
                    iva_monto=det_orig.iva_monto,
                    total_linea=det_orig.total_linea,
                )
            )
    else:
        if not data.detalles:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Indicá total=true o al menos un detalle a creditar.",
            )
        for item in data.detalles:
            iva_pct = Decimal(item.iva_porcentaje or Decimal("21"))
            montos = calcular_linea(
                precio_unitario_neto=item.precio_unitario_neto,
                cantidad=item.cantidad,
                descuento_porcentaje=Decimal("0"),
                iva_porcentaje=iva_pct,
            )
            db.add(
                FacturaDetalle(
                    id=uuid.uuid4(),
                    factura_id=nc.id,
                    descripcion=item.descripcion,
                    cantidad=item.cantidad,
                    unidad_medida="unidad",
                    precio_unitario_neto=item.precio_unitario_neto,
                    descuento_porcentaje=Decimal("0"),
                    iva_porcentaje=iva_pct,
                    **montos,
                )
            )

    db.flush()
    db.refresh(nc)
    _recalcular_y_persistir_totales(db, nc)

    if Decimal(nc.total) > Decimal(original.total):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="El total de la NC no puede superar el total de la factura original.",
        )

    return nc


def crear_nota_debito(
    db: Session,
    factura_original_id: UUID,
    data: NotaDebitoCreate,
    usuario_id: UUID,
) -> Factura:
    """Crea una Nota de Débito BORRADOR asociada a una factura AUTORIZADA."""
    original = obtener(db, factura_original_id)
    if not original:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Factura original no encontrada")
    if original.estado != EstadoFactura.AUTORIZADA.value:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden generar notas de débito sobre facturas autorizadas.",
        )

    tipo_nd = tipo_nd_para(original)

    nd = Factura(
        id=uuid.uuid4(),
        tipo=tipo_nd.value,
        punto_venta=original.punto_venta,
        cliente_id=original.cliente_id,
        cliente_razon_social_snap=original.cliente_razon_social_snap,
        cliente_cuit_snap=original.cliente_cuit_snap,
        cliente_documento_tipo_snap=original.cliente_documento_tipo_snap,
        cliente_documento_nro_snap=original.cliente_documento_nro_snap,
        cliente_condicion_iva_snap=original.cliente_condicion_iva_snap,
        cliente_domicilio_snap=original.cliente_domicilio_snap,
        factura_original_id=original.id,
        fecha_emision=data.fecha_emision or date.today(),
        concepto_afip=original.concepto_afip,
        condicion_venta=original.condicion_venta,
        motivo=data.motivo,
        observaciones=data.observaciones,
        estado=EstadoFactura.BORRADOR.value,
        creado_por_id=usuario_id,
    )
    db.add(nd)
    db.flush()

    for d in data.detalles:
        montos = calcular_linea(
            precio_unitario_neto=d.precio_unitario_neto,
            cantidad=d.cantidad,
            descuento_porcentaje=d.descuento_porcentaje,
            iva_porcentaje=d.iva_porcentaje,
        )
        db.add(
            FacturaDetalle(
                id=uuid.uuid4(),
                factura_id=nd.id,
                descripcion=d.descripcion,
                cantidad=d.cantidad,
                unidad_medida=d.unidad_medida or "unidad",
                precio_unitario_neto=d.precio_unitario_neto,
                descuento_porcentaje=d.descuento_porcentaje,
                iva_porcentaje=d.iva_porcentaje,
                **montos,
            )
        )

    db.flush()
    db.refresh(nd)
    _recalcular_y_persistir_totales(db, nd)
    return nd


# ==================== EMISIÓN AFIP ====================


# Mapping CondicionIVA DUWHITE → CondicionIVAReceptorId AFIP (RG 5616/2024)
CONDICION_IVA_AFIP = {
    CondicionIVA.RESPONSABLE_INSCRIPTO.value: 1,
    CondicionIVA.EXENTO.value: 4,
    CondicionIVA.CONSUMIDOR_FINAL.value: 5,
    CondicionIVA.MONOTRIBUTO.value: 6,
    CondicionIVA.NO_RESPONSABLE.value: 7,
}

# Mapping alícuota IVA → Id AFIP
ALICUOTA_AFIP = {
    Decimal("0"): 3,
    Decimal("10.5"): 4,
    Decimal("21"): 5,
    Decimal("27"): 6,
    Decimal("5"): 8,
    Decimal("2.5"): 9,
}


def _doc_tipo_y_numero(factura: Factura) -> Tuple[int, int]:
    """Devuelve (DocTipo, DocNro) para AFIP según los datos del cliente."""
    if factura.cliente_cuit_snap:
        numero = int(factura.cliente_cuit_snap.replace("-", "").replace(" ", ""))
        return 80, numero  # CUIT
    # Consumidor final sin identificar
    return 99, 0


def _construir_alicuotas(factura: Factura) -> list:
    """Convierte los totales por alícuota de la factura a AlicuotaIva (AFIP)."""
    from app.integrations.afip.types import AlicuotaIva

    alicuotas = []
    if Decimal(factura.neto_gravado_21) > 0:
        alicuotas.append(
            AlicuotaIva(
                id=ALICUOTA_AFIP[Decimal("21")],
                base_imponible=Decimal(factura.neto_gravado_21),
                importe=Decimal(factura.iva_21),
            )
        )
    if Decimal(factura.neto_gravado_105) > 0:
        alicuotas.append(
            AlicuotaIva(
                id=ALICUOTA_AFIP[Decimal("10.5")],
                base_imponible=Decimal(factura.neto_gravado_105),
                importe=Decimal(factura.iva_105),
            )
        )
    return alicuotas


def _construir_solicitud_cae(
    factura: Factura,
    numero_comprobante: int,
) -> "SolicitudCae":
    from app.integrations.afip.types import SolicitudCae, ComprobanteAsociado

    doc_tipo, doc_nro = _doc_tipo_y_numero(factura)

    # Neto gravado a declarar: solo para Factura A (IVA discriminado).
    # Factura B en AFIP también va discriminada aunque el PDF muestre total con IVA.
    imp_neto = Decimal(factura.neto_gravado_21) + Decimal(factura.neto_gravado_105)
    imp_iva = Decimal(factura.iva_21) + Decimal(factura.iva_105)
    imp_op_ex = Decimal("0")
    imp_tot_conc = Decimal(factura.neto_no_gravado)
    imp_trib = Decimal(factura.percepciones)
    imp_total = imp_neto + imp_iva + imp_op_ex + imp_tot_conc + imp_trib

    concepto = int(factura.concepto_afip)

    comprobantes_asoc = []
    if factura.factura_original_id and factura.factura_original:
        original = factura.factura_original
        if original.numero_comprobante and original.codigo_afip:
            comprobantes_asoc.append(
                ComprobanteAsociado(
                    tipo=original.codigo_afip,
                    punto_venta=original.punto_venta,
                    numero=original.numero_comprobante,
                    cuit=str(settings.EMPRESA_CUIT_NUMERICO),
                )
            )

    condicion_receptor = CONDICION_IVA_AFIP.get(factura.cliente_condicion_iva_snap)

    return SolicitudCae(
        cbte_tipo=factura.codigo_afip,
        punto_venta=factura.punto_venta,
        concepto=concepto,
        doc_tipo=doc_tipo,
        doc_nro=doc_nro,
        cbte_desde=numero_comprobante,
        cbte_hasta=numero_comprobante,
        cbte_fecha=factura.fecha_emision,
        imp_total=imp_total,
        imp_tot_conc=imp_tot_conc,
        imp_neto=imp_neto,
        imp_op_ex=imp_op_ex,
        imp_trib=imp_trib,
        imp_iva=imp_iva,
        fecha_servicio_desde=factura.fecha_servicio_desde if concepto in (2, 3) else None,
        fecha_servicio_hasta=factura.fecha_servicio_hasta if concepto in (2, 3) else None,
        fecha_vto_pago=factura.fecha_vencimiento_pago if concepto in (2, 3) else None,
        alicuotas=_construir_alicuotas(factura),
        comprobantes_asociados=comprobantes_asoc,
        condicion_iva_receptor_id=condicion_receptor,
    )


def _registrar_impacto_cuenta_corriente(
    db: Session, factura: Factura, usuario_id: UUID
) -> MovimientoCuentaCorriente:
    """
    Crea el movimiento de cuenta corriente correspondiente y actualiza el saldo del cliente.

    - Facturas y Notas de Débito → tipo CARGO (aumenta deuda).
    - Notas de Crédito → tipo PAGO (disminuye deuda).
    """
    cliente = db.query(Cliente).filter(Cliente.id == factura.cliente_id).first()
    if not cliente:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")

    saldo_anterior = Decimal(cliente.saldo_cuenta_corriente or 0)
    monto = Decimal(factura.total)

    if factura.es_nota_credito:
        tipo_mov = TipoMovimientoCC.PAGO.value
        delta = -monto
        concepto_txt = f"Nota de Crédito {factura.letra} {factura.numero_completo}"
    else:  # Factura o Nota de Débito
        tipo_mov = TipoMovimientoCC.CARGO.value
        delta = monto
        concepto_txt = f"{'Nota de Débito' if factura.es_nota_debito else 'Factura'} {factura.letra} {factura.numero_completo}"

    saldo_posterior = saldo_anterior + delta

    estado_fact = (
        EstadoFacturacion.FACTURA_A.value
        if factura.letra == "A"
        else EstadoFacturacion.FACTURA_B.value
    )

    movimiento = MovimientoCuentaCorriente(
        id=uuid.uuid4(),
        cliente_id=cliente.id,
        tipo=tipo_mov,
        concepto=concepto_txt,
        pedido_id=factura.pedido_id,
        factura_numero=factura.numero_completo,
        estado_facturacion=estado_fact,
        monto=monto,
        saldo_anterior=saldo_anterior,
        saldo_posterior=saldo_posterior,
        fecha_movimiento=factura.fecha_emision,
        fecha_vencimiento=factura.fecha_vencimiento_pago,
        registrado_por_id=usuario_id,
    )
    db.add(movimiento)

    cliente.saldo_cuenta_corriente = saldo_posterior
    db.flush()
    return movimiento


def _actualizar_pedido_emitido(db: Session, factura: Factura) -> None:
    if not factura.pedido_id:
        return
    pedido = db.query(Pedido).filter(Pedido.id == factura.pedido_id).first()
    if not pedido:
        return

    pedido.factura_numero = factura.numero_completo
    pedido.factura_tipo = factura.letra
    pedido.fecha_facturacion = factura.fecha_emision

    if pedido.estado not in (EstadoPedido.CANCELADO.value, EstadoPedido.FACTURADO.value):
        pedido.estado = EstadoPedido.FACTURADO.value

    db.flush()


def emitir_factura(db: Session, factura_id: UUID, usuario_id: UUID) -> Factura:
    """
    Emite una factura BORRADOR contra AFIP (WSFEv1) y la marca AUTORIZADA
    si AFIP devuelve resultado 'A'. Si rebota, la deja RECHAZADA con los errores.

    Efectos en caso de éxito:
      - Setea CAE, cae_vencimiento, número_comprobante, numero_completo.
      - Estado → AUTORIZADA, emitido_at, emitido_por_id.
      - Actualiza el pedido asociado (factura_numero / tipo / fecha / estado=FACTURADO).
      - Crea movimiento en cuenta corriente (CARGO para facturas/ND, PAGO para NC).
    """
    factura = obtener(db, factura_id)
    if not factura:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Factura no encontrada")

    if factura.estado not in (EstadoFactura.BORRADOR.value, EstadoFactura.RECHAZADA.value):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"La factura no se puede emitir en estado {factura.estado}.",
        )

    codigo_afip = factura.codigo_afip
    if not codigo_afip:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de comprobante no soportado por AFIP: {factura.tipo}",
        )

    # Lazy import para no fallar si las deps AFIP aún no están instaladas
    try:
        from app.integrations.afip.wsfev1 import WsfeClient
        from app.integrations.afip.exceptions import AfipError
    except ImportError as exc:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Integración AFIP no disponible: {exc}",
        )

    client = WsfeClient()

    # 1. Consultar último número autorizado
    try:
        ultimo = client.obtener_ultimo_comprobante(factura.punto_venta, codigo_afip)
    except AfipError as exc:
        logger.exception("Error al consultar último comprobante")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=f"AFIP no respondió: {exc}",
        )

    numero_propuesto = ultimo + 1
    solicitud = _construir_solicitud_cae(factura, numero_propuesto)

    # 2. Solicitar CAE
    try:
        respuesta = client.solicitar_cae(solicitud)
    except AfipError as exc:
        logger.exception("Error en FECAESolicitar")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=f"AFIP no respondió: {exc}",
        )

    # 3. Persistir respuesta
    factura.afip_resultado = respuesta.resultado
    factura.afip_response_raw = respuesta.raw
    factura.afip_observaciones = (
        "\n".join(f"[{o.get('code')}] {o.get('msg')}" for o in respuesta.observaciones)
        if respuesta.observaciones
        else None
    )
    factura.afip_errores = (
        "\n".join(f"[{e.get('code')}] {e.get('msg')}" for e in respuesta.errores)
        if respuesta.resultado == "R" and respuesta.errores
        else None
    )

    if respuesta.resultado == "A" and respuesta.cae:
        factura.numero_comprobante = respuesta.numero_comprobante or numero_propuesto
        factura.numero_completo = f"{factura.punto_venta:04d}-{factura.numero_comprobante:08d}"
        factura.cae = respuesta.cae
        factura.cae_vencimiento = respuesta.cae_vencimiento
        factura.estado = EstadoFactura.AUTORIZADA.value
        factura.emitido_at = datetime.utcnow()
        factura.emitido_por_id = usuario_id

        # Estado de pago inicial según tipo
        if factura.es_nota_credito:
            factura.estado_pago = EstadoPago.NO_APLICA.value
        else:
            factura.estado_pago = EstadoPago.SIN_COBRAR.value
            factura.monto_pagado = Decimal("0")

        # Impacto en cuenta corriente (solo si factura no es borrador previo rechazado que ya creó mov)
        if not factura.movimiento_cuenta_corriente_id:
            mov = _registrar_impacto_cuenta_corriente(db, factura, usuario_id)
            factura.movimiento_cuenta_corriente_id = mov.id

        # Solo facturas "comunes" actualizan el pedido asociado
        if not factura.es_nota_credito and not factura.es_nota_debito:
            _actualizar_pedido_emitido(db, factura)

        # Si es una NC que cubre el total de la factura original, la marca ANULADA
        if factura.es_nota_credito and factura.factura_original_id:
            original = db.query(Factura).filter(Factura.id == factura.factura_original_id).first()
            if original and Decimal(factura.total) >= Decimal(original.total):
                original.estado = EstadoFactura.ANULADA.value
                original.anulada_por_nc_id = factura.id
    else:
        factura.estado = EstadoFactura.RECHAZADA.value

    db.flush()
    return factura


# ==================== COBROS SOBRE FACTURA ====================


def registrar_cobro(
    db: Session,
    factura_id: UUID,
    data: RegistrarCobroRequest,
    usuario_id: UUID,
) -> dict:
    """
    Registra un cobro sobre una factura AUTORIZADA.

    Efectos:
      - Crea un ``MovimientoCuentaCorriente`` tipo PAGO con `factura_numero` de la factura.
      - Actualiza ``factura.monto_pagado`` y ``factura.estado_pago``:
        * pagada si monto_pagado == total
        * parcial si 0 < monto_pagado < total
      - Baja el ``cliente.saldo_cuenta_corriente`` en el monto del cobro.

    Validaciones:
      - La factura debe estar AUTORIZADA (no borrador, rechazada ni anulada).
      - No debe ser NC/ND (esas tienen ``estado_pago = no_aplica``).
      - El cobro no puede hacer que ``monto_pagado`` supere ``total``.
    """
    factura = obtener(db, factura_id)
    if not factura:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Factura no encontrada")

    if factura.estado != EstadoFactura.AUTORIZADA.value:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"No se pueden registrar cobros sobre una factura en estado {factura.estado}.",
        )
    if factura.es_nota_credito or factura.es_nota_debito:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Los cobros se registran sobre facturas, no sobre notas de crédito/débito.",
        )

    total = Decimal(factura.total)
    ya_pagado = Decimal(factura.monto_pagado or 0)
    nuevo_pagado = ya_pagado + Decimal(data.monto)
    if nuevo_pagado > total + Decimal("0.01"):  # tolerancia centavos
        adeudado = total - ya_pagado
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"El cobro supera el saldo adeudado de la factura (adeudado: {adeudado}).",
        )

    cliente = db.query(Cliente).filter(Cliente.id == factura.cliente_id).first()
    if not cliente:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")

    saldo_anterior = Decimal(cliente.saldo_cuenta_corriente or 0)
    saldo_posterior = saldo_anterior - Decimal(data.monto)

    estado_fact = (
        EstadoFacturacion.FACTURA_A.value
        if factura.letra == "A"
        else EstadoFacturacion.FACTURA_B.value
    )

    movimiento = MovimientoCuentaCorriente(
        id=uuid.uuid4(),
        cliente_id=cliente.id,
        tipo=TipoMovimientoCC.PAGO.value,
        concepto=f"Cobro Factura {factura.letra} {factura.numero_completo}",
        pedido_id=factura.pedido_id,
        factura_numero=factura.numero_completo,
        estado_facturacion=estado_fact,
        monto=Decimal(data.monto),
        saldo_anterior=saldo_anterior,
        saldo_posterior=saldo_posterior,
        medio_pago=data.medio_pago,
        referencia_pago=data.referencia_pago,
        fecha_movimiento=data.fecha_cobro or date.today(),
        registrado_por_id=usuario_id,
        notas=data.observaciones,
    )
    db.add(movimiento)

    cliente.saldo_cuenta_corriente = saldo_posterior
    factura.monto_pagado = nuevo_pagado
    factura.fecha_ultimo_cobro = data.fecha_cobro or date.today()

    # Recalcular estado_pago
    if nuevo_pagado >= total - Decimal("0.01"):
        factura.estado_pago = EstadoPago.PAGADA.value
    elif nuevo_pagado > 0:
        factura.estado_pago = EstadoPago.PARCIAL.value
    else:
        factura.estado_pago = EstadoPago.SIN_COBRAR.value

    db.flush()

    return {
        "factura_id": str(factura.id),
        "estado_pago": factura.estado_pago,
        "monto_pagado": factura.monto_pagado,
        "monto_adeudado": total - nuevo_pagado,
        "movimiento_cuenta_corriente_id": str(movimiento.id),
    }
