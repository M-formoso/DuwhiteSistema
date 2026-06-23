"""
Endpoints de Facturación (A/B + Notas de Crédito/Débito).
"""

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_db, get_current_user
from app.core.permissions import verificar_permiso
from app.models.usuario import Usuario
from app.schemas.factura import (
    FacturaCreateDesdePedido,
    FacturaCreateDesdeRemito,
    FacturaCreateManual,
    FacturaResponse,
    FacturaListItem,
    FacturaFiltros,
    EmitirFacturaResponse,
    NotaCreditoCreate,
    NotaDebitoCreate,
    RegistrarCobroRequest,
    RegistrarCobroResponse,
    PedidoPendienteFacturar,
    RemitoPendienteFacturar,
    FacturarMasivoRequest,
    FacturarMasivoResponse,
    TIPOS_COMPROBANTE,
    ESTADOS_FACTURA,
    ESTADOS_PAGO,
)
from app.services import factura_service
from app.services import factura_pdf_service
from app.services import factura_diagnostico_service


router = APIRouter()


# ==================== HELPERS DE SERIALIZACIÓN ====================


def _factura_to_response(factura) -> FacturaResponse:
    return FacturaResponse(
        id=str(factura.id),
        tipo=factura.tipo,
        letra=factura.letra,
        punto_venta=factura.punto_venta,
        numero_comprobante=factura.numero_comprobante,
        numero_completo=factura.numero_completo,
        cliente_id=str(factura.cliente_id),
        cliente_razon_social_snap=factura.cliente_razon_social_snap,
        cliente_cuit_snap=factura.cliente_cuit_snap,
        cliente_documento_tipo_snap=factura.cliente_documento_tipo_snap,
        cliente_documento_nro_snap=factura.cliente_documento_nro_snap,
        cliente_condicion_iva_snap=factura.cliente_condicion_iva_snap,
        cliente_domicilio_snap=factura.cliente_domicilio_snap,
        pedido_id=str(factura.pedido_id) if factura.pedido_id else None,
        factura_original_id=str(factura.factura_original_id) if factura.factura_original_id else None,
        fecha_emision=factura.fecha_emision,
        fecha_servicio_desde=factura.fecha_servicio_desde,
        fecha_servicio_hasta=factura.fecha_servicio_hasta,
        fecha_vencimiento_pago=factura.fecha_vencimiento_pago,
        concepto_afip=factura.concepto_afip,
        condicion_venta=factura.condicion_venta,
        subtotal=factura.subtotal,
        descuento_monto=factura.descuento_monto,
        neto_gravado_21=factura.neto_gravado_21,
        neto_gravado_105=factura.neto_gravado_105,
        neto_no_gravado=factura.neto_no_gravado,
        iva_21=factura.iva_21,
        iva_105=factura.iva_105,
        percepciones=factura.percepciones,
        total=factura.total,
        estado=factura.estado,
        estado_pago=factura.estado_pago,
        monto_pagado=factura.monto_pagado,
        fecha_ultimo_cobro=factura.fecha_ultimo_cobro,
        cae=factura.cae,
        cae_vencimiento=factura.cae_vencimiento,
        afip_resultado=factura.afip_resultado,
        afip_observaciones=factura.afip_observaciones,
        afip_errores=factura.afip_errores,
        emitido_at=factura.emitido_at,
        anulada_por_nc_id=str(factura.anulada_por_nc_id) if factura.anulada_por_nc_id else None,
        observaciones=factura.observaciones,
        motivo=factura.motivo,
        movimiento_cuenta_corriente_id=(
            str(factura.movimiento_cuenta_corriente_id)
            if factura.movimiento_cuenta_corriente_id
            else None
        ),
        creado_por_id=str(factura.creado_por_id),
        emitido_por_id=str(factura.emitido_por_id) if factura.emitido_por_id else None,
        created_at=factura.created_at,
        updated_at=factura.updated_at,
        detalles=[
            {
                "id": str(d.id),
                "descripcion": d.descripcion,
                "cantidad": d.cantidad,
                "unidad_medida": d.unidad_medida,
                "precio_unitario_neto": d.precio_unitario_neto,
                "descuento_porcentaje": d.descuento_porcentaje,
                "iva_porcentaje": d.iva_porcentaje,
                "detalle_pedido_id": str(d.detalle_pedido_id) if d.detalle_pedido_id else None,
                "producto_lavado_id": str(d.producto_lavado_id) if d.producto_lavado_id else None,
                "subtotal_neto": d.subtotal_neto,
                "iva_monto": d.iva_monto,
                "total_linea": d.total_linea,
            }
            for d in factura.detalles
        ],
    )


def _factura_to_list_item(factura) -> FacturaListItem:
    return FacturaListItem(
        id=str(factura.id),
        tipo=factura.tipo,
        letra=factura.letra,
        punto_venta=factura.punto_venta,
        numero_completo=factura.numero_completo,
        cliente_id=str(factura.cliente_id),
        cliente_razon_social_snap=factura.cliente_razon_social_snap,
        fecha_emision=factura.fecha_emision,
        total=factura.total,
        estado=factura.estado,
        estado_pago=factura.estado_pago,
        monto_pagado=factura.monto_pagado,
        cae=factura.cae,
    )


# ==================== CATÁLOGOS ====================


@router.get("/tipos")
def listar_tipos_comprobante(current_user: Usuario = Depends(get_current_user)):
    verificar_permiso(current_user, "facturacion.ver")
    return TIPOS_COMPROBANTE


@router.get("/estados")
def listar_estados_factura(current_user: Usuario = Depends(get_current_user)):
    verificar_permiso(current_user, "facturacion.ver")
    return ESTADOS_FACTURA


@router.get("/estados-pago")
def listar_estados_pago(current_user: Usuario = Depends(get_current_user)):
    verificar_permiso(current_user, "facturacion.ver")
    return ESTADOS_PAGO


# ==================== DIAGNÓSTICO ARCA ====================


@router.get("/estado-arca")
def estado_arca(current_user: Usuario = Depends(get_current_user)):
    """
    Diagnóstico de la integración con ARCA / AFIP.
    Devuelve un reporte con el estado de cada componente: CUIT, certificado,
    clave privada, conexión WSAA, conexión WSFEv1, CBU configurada.

    Estado general posible:
      - "verde": todo OK, listo para emitir.
      - "amarillo": se puede emitir pero hay advertencias (ej. CBU no cargada).
      - "rojo": falta algún requisito crítico.
    """
    verificar_permiso(current_user, "facturacion.ver")
    return factura_diagnostico_service.diagnosticar_arca()


@router.get("/condiciones-iva-receptor/{cbte_tipo}")
def consultar_condiciones_iva_receptor(
    cbte_tipo: int,
    current_user: Usuario = Depends(get_current_user),
):
    """
    Consulta a ARCA las condiciones IVA del receptor permitidas para un
    tipo de comprobante (RG 5616/2024). Útil para diagnosticar el error
    10243 — devuelve los códigos vigentes de ARCA en tiempo real.

    Códigos comunes de comprobante:
      - 1: Factura A
      - 6: Factura B
      - 11: Factura C
      - 3: NC A | 8: NC B | 13: NC C
      - 2: ND A | 7: ND B | 12: ND C
    """
    verificar_permiso(current_user, "facturacion.ver")
    from app.integrations.afip.wsfev1 import WsfeClient
    client = WsfeClient()
    return {
        "cbte_tipo": cbte_tipo,
        "condiciones": client.obtener_condiciones_iva_receptor(cbte_tipo),
    }


# ==================== PEDIDOS PENDIENTES DE FACTURAR ====================


@router.get("/pedidos-pendientes")
def listar_pedidos_pendientes(
    cliente_id: Optional[UUID] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    solo_listos: bool = Query(False, description="Si True, solo muestra estado listo/entregado"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Cola de pedidos pendientes de facturar. Por defecto incluye todos
    los estados no-terminales (confirmado, en_proceso, listo, entregado)
    sin factura activa. Con ``solo_listos=true`` filtra a los que ya
    terminaron producción.
    """
    verificar_permiso(current_user, "facturacion.ver")
    pedidos, total = factura_service.listar_pedidos_pendientes(
        db=db,
        cliente_id=cliente_id,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        solo_listos=solo_listos,
        page=page,
        page_size=page_size,
    )
    items = []
    for p in pedidos:
        cliente = p.cliente
        condicion = cliente.condicion_iva if cliente else "consumidor_final"
        tipo_sug = factura_service.determinar_tipo_factura(condicion).value
        items.append(
            PedidoPendienteFacturar(
                id=str(p.id),
                numero=p.numero,
                estado=p.estado,
                cliente_id=str(p.cliente_id),
                cliente_razon_social=cliente.razon_social if cliente else "",
                cliente_condicion_iva=condicion,
                tipo_comprobante_sugerido=tipo_sug,
                fecha_pedido=p.fecha_pedido,
                fecha_entrega_real=p.fecha_entrega_real,
                total=p.total,
            )
        )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post(
    "/pedidos-pendientes/facturar-masivo",
    response_model=FacturarMasivoResponse,
)
def facturar_pedidos_masivo(
    data: FacturarMasivoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Crea facturas BORRADOR para varios pedidos a la vez.
    No emite a AFIP — el usuario revisa y emite después.
    Los pedidos que no se puedan facturar se reportan en ``errores``.
    """
    verificar_permiso(current_user, "facturacion.crear")
    ids = [UUID(s) for s in data.pedido_ids]
    resultado = factura_service.facturar_pedidos_masivo(
        db=db,
        pedido_ids=ids,
        usuario_id=current_user.id,
        punto_venta=settings.AFIP_PUNTO_VENTA,
    )
    db.commit()
    return FacturarMasivoResponse(**resultado)


@router.get("/preview-mes-cliente")
def preview_mes_cliente(
    cliente_id: str,
    mes: int,
    anio: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Previsualiza qué pedidos entrarían en una factura mensual consolidada,
    separando los incluibles de los excluidos (ya facturados, cancelados,
    sin ítems). No crea nada en BD — solo informa.
    """
    verificar_permiso(current_user, "facturacion.ver")
    from uuid import UUID as _UUID
    return factura_service.preview_factura_mes_consolidado(
        db=db,
        cliente_id=_UUID(cliente_id),
        mes=mes,
        anio=anio,
    )


@router.post("/desde-mes-cliente")
def facturar_mes_cliente(
    cliente_id: str,
    mes: int,
    anio: int,
    fecha_emision: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Genera UNA factura BORRADOR consolidando todos los pedidos del cliente
    en el mes/año dado que aún no están facturados. Cada pedido aporta sus
    detalles. Después se emite a AFIP como cualquier factura.
    """
    verificar_permiso(current_user, "facturacion.crear")
    from uuid import UUID as _UUID
    factura = factura_service.facturar_mes_consolidado(
        db=db,
        cliente_id=_UUID(cliente_id),
        mes=mes,
        anio=anio,
        usuario_id=current_user.id,
        punto_venta=settings.AFIP_PUNTO_VENTA,
        fecha_emision=fecha_emision,
    )
    db.commit()
    return {
        "factura_id": str(factura.id),
        "tipo": factura.tipo,
        "total": float(factura.total),
        "items": len(factura.detalles),
        "mensaje": "Factura BORRADOR creada. Revisá y emití a AFIP cuando esté lista.",
    }


# ==================== REMITOS PENDIENTES DE FACTURAR ====================
#
# El flujo real de DUWHITE es: conteo → remito (carga CC) → factura.
# La unidad de facturación natural es el remito, no el pedido.


@router.get("/remitos-pendientes")
def listar_remitos_pendientes(
    cliente_id: Optional[UUID] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Cola de remitos pendientes de facturar (emitidos/entregados sin factura)."""
    verificar_permiso(current_user, "facturacion.ver")
    remitos, total = factura_service.listar_remitos_pendientes(
        db=db,
        cliente_id=cliente_id,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        page=page,
        page_size=page_size,
    )
    items = []
    for r in remitos:
        cliente = r.cliente
        condicion = cliente.condicion_iva if cliente else "consumidor_final"
        tipo_sug = factura_service.determinar_tipo_factura(condicion).value
        items.append(
            RemitoPendienteFacturar(
                id=str(r.id),
                numero=r.numero,
                estado=r.estado,
                cliente_id=str(r.cliente_id),
                cliente_razon_social=cliente.razon_social if cliente else "",
                cliente_condicion_iva=condicion,
                tipo_comprobante_sugerido=tipo_sug,
                fecha_emision=r.fecha_emision,
                lote_numero=r.lote.numero if r.lote else None,
                cantidad_items=len(r.detalles or []),
                total=r.total,
            )
        )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/desde-remito")
def crear_factura_desde_remito(
    data: FacturaCreateDesdeRemito,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Crea una factura BORRADOR a partir de uno o más remitos del mismo cliente.
    Si se pasa 1 remito → factura individual; si son varios → consolidada.
    """
    verificar_permiso(current_user, "facturacion.crear")
    factura = factura_service.crear_desde_remito(
        db=db,
        data=data,
        usuario_id=current_user.id,
        punto_venta=settings.AFIP_PUNTO_VENTA,
    )
    db.commit()
    return {
        "factura_id": str(factura.id),
        "tipo": factura.tipo,
        "total": float(factura.total),
        "items": len(factura.detalles),
        "mensaje": "Factura BORRADOR creada. Revisá y emití a AFIP cuando esté lista.",
    }


@router.get("/preview-mes-remitos")
def preview_mes_remitos(
    cliente_id: str,
    mes: int,
    anio: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Previsualiza qué remitos entrarían en una factura mensual consolidada."""
    verificar_permiso(current_user, "facturacion.ver")
    from uuid import UUID as _UUID
    return factura_service.preview_factura_mes_consolidado_remitos(
        db=db,
        cliente_id=_UUID(cliente_id),
        mes=mes,
        anio=anio,
    )


@router.post("/desde-mes-remitos")
def facturar_mes_remitos(
    cliente_id: str,
    mes: int,
    anio: int,
    fecha_emision: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Genera UNA factura BORRADOR consolidando todos los remitos del cliente
    en el mes/año dado que aún no están facturados.
    """
    verificar_permiso(current_user, "facturacion.crear")
    from uuid import UUID as _UUID
    factura = factura_service.facturar_mes_consolidado_remitos(
        db=db,
        cliente_id=_UUID(cliente_id),
        mes=mes,
        anio=anio,
        usuario_id=current_user.id,
        punto_venta=settings.AFIP_PUNTO_VENTA,
        fecha_emision=fecha_emision,
    )
    db.commit()
    return {
        "factura_id": str(factura.id),
        "tipo": factura.tipo,
        "total": float(factura.total),
        "items": len(factura.detalles),
        "mensaje": "Factura BORRADOR creada. Revisá y emití a AFIP cuando esté lista.",
    }


# ==================== LISTADO Y DETALLE ====================


@router.get("")
def listar_facturas(
    cliente_id: Optional[str] = None,
    tipo: Optional[str] = None,
    estado: Optional[str] = None,
    estado_pago: Optional[str] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    numero: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    verificar_permiso(current_user, "facturacion.ver")

    filtros = FacturaFiltros(
        cliente_id=cliente_id,
        tipo=tipo,
        estado=estado,
        estado_pago=estado_pago,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        numero=numero,
        page=page,
        page_size=page_size,
    )

    facturas, total = factura_service.listar(db, filtros)

    return {
        "items": [_factura_to_list_item(f) for f in facturas],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{factura_id}", response_model=FacturaResponse)
def obtener_factura(
    factura_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    verificar_permiso(current_user, "facturacion.ver")
    factura = factura_service.obtener(db, factura_id)
    if not factura:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Factura no encontrada")
    return _factura_to_response(factura)


# ==================== CREAR ====================


@router.post(
    "/desde-pedido",
    response_model=FacturaResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_factura_desde_pedido(
    data: FacturaCreateDesdePedido,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    verificar_permiso(current_user, "facturacion.crear")
    factura = factura_service.crear_desde_pedido(
        db=db,
        data=data,
        usuario_id=current_user.id,
        punto_venta=settings.AFIP_PUNTO_VENTA,
    )
    db.commit()
    db.refresh(factura)
    return _factura_to_response(factura)


@router.post(
    "/manual",
    response_model=FacturaResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_factura_manual(
    data: FacturaCreateManual,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    verificar_permiso(current_user, "facturacion.crear")
    factura = factura_service.crear_manual(
        db=db,
        data=data,
        usuario_id=current_user.id,
        punto_venta=settings.AFIP_PUNTO_VENTA,
    )
    db.commit()
    db.refresh(factura)
    return _factura_to_response(factura)


# ==================== EMISIÓN AFIP (Fase 4) ====================


@router.post("/{factura_id}/emitir", response_model=EmitirFacturaResponse)
def emitir_factura_afip(
    factura_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Solicita el CAE a AFIP para la factura.
    La implementación completa de AFIP se habilita en la Fase 4.
    """
    verificar_permiso(current_user, "facturacion.crear")
    factura = factura_service.emitir_factura(db, factura_id, current_user.id)
    db.commit()
    return EmitirFacturaResponse(
        id=str(factura.id),
        estado=factura.estado,
        cae=factura.cae,
        cae_vencimiento=factura.cae_vencimiento,
        numero_completo=factura.numero_completo,
        resultado=factura.afip_resultado,
        observaciones=factura.afip_observaciones,
        errores=factura.afip_errores,
    )


# ==================== NOTAS DE CRÉDITO / DÉBITO ====================


@router.post(
    "/{factura_id}/notas-credito",
    response_model=FacturaResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_nota_credito(
    factura_id: UUID,
    data: NotaCreditoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Crea una Nota de Crédito BORRADOR asociada a una factura autorizada."""
    verificar_permiso(current_user, "facturacion.crear")
    nc = factura_service.crear_nota_credito(
        db=db,
        factura_original_id=factura_id,
        data=data,
        usuario_id=current_user.id,
    )
    db.commit()
    db.refresh(nc)
    return _factura_to_response(nc)


@router.post(
    "/{factura_id}/notas-debito",
    response_model=FacturaResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_nota_debito(
    factura_id: UUID,
    data: NotaDebitoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Crea una Nota de Débito BORRADOR asociada a una factura autorizada."""
    verificar_permiso(current_user, "facturacion.crear")
    nd = factura_service.crear_nota_debito(
        db=db,
        factura_original_id=factura_id,
        data=data,
        usuario_id=current_user.id,
    )
    db.commit()
    db.refresh(nd)
    return _factura_to_response(nd)


# ==================== COBROS ====================


@router.post(
    "/{factura_id}/cobros",
    response_model=RegistrarCobroResponse,
    status_code=status.HTTP_201_CREATED,
)
def registrar_cobro_factura(
    factura_id: UUID,
    data: RegistrarCobroRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Registra un cobro contra una factura autorizada. Crea el movimiento
    de cuenta corriente (PAGO), actualiza el saldo del cliente y recalcula
    el estado de pago de la factura.
    """
    verificar_permiso(current_user, "facturacion.crear")
    resultado = factura_service.registrar_cobro(
        db=db,
        factura_id=factura_id,
        data=data,
        usuario_id=current_user.id,
    )
    db.commit()
    return RegistrarCobroResponse(**resultado)


# ==================== PDF ====================


@router.get("/{factura_id}/pdf")
def descargar_pdf(
    factura_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Retorna el PDF de la factura (solo si está autorizada)."""
    verificar_permiso(current_user, "facturacion.ver")
    factura = factura_service.obtener(db, factura_id)
    if not factura:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Factura no encontrada")

    pdf_bytes = factura_pdf_service.generar_pdf(db, factura)

    filename = f"factura_{factura.letra or 'X'}_{factura.numero_completo or factura_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ==================== ELIMINAR BORRADOR ====================


@router.delete("/{factura_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_factura_borrador(
    factura_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Elimina (soft) una factura en borrador. Solo permitido si estado = borrador."""
    verificar_permiso(current_user, "facturacion.eliminar")
    factura_service.eliminar_borrador(db, factura_id)
    db.commit()
    return None
