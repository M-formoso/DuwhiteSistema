"""
Endpoints de Remitos.
"""

from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_permission
from app.models.usuario import Usuario
from app.schemas.remito import (
    RemitoResponse,
    RemitoListResponse,
    DetalleRemitoResponse,
    GenerarRemitoRequest,
    GenerarRemitoManualRequest,
    GenerarRemitoResponse,
    EntregarRemitoRequest,
    AnularRemitoRequest,
    TIPOS_REMITO,
    ESTADOS_REMITO,
)
from app.services.remito_service import RemitoService
from app.services import remito_pdf_service


router = APIRouter()


# ==================== LISTADOS ====================

@router.get("", response_model=List[RemitoListResponse])
def listar_remitos(
    cliente_id: Optional[UUID] = Query(None, description="Filtrar por cliente"),
    lote_id: Optional[UUID] = Query(None, description="Filtrar por lote"),
    estado: Optional[str] = Query(None, description="Filtrar por estado"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo"),
    fecha_desde: Optional[date] = Query(None, description="Fecha desde"),
    fecha_hasta: Optional[date] = Query(None, description="Fecha hasta"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador", "comercial"))
):
    """Lista remitos con filtros."""
    remitos = RemitoService.get_all(
        db,
        cliente_id=cliente_id,
        lote_id=lote_id,
        estado=estado,
        tipo=tipo,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        skip=skip,
        limit=limit
    )

    return [
        RemitoListResponse(
            id=r.id,
            numero=r.numero,
            lote_numero=r.lote.numero if r.lote else "",
            cliente_nombre=r.cliente.nombre_fantasia or r.cliente.razon_social if r.cliente else "",
            tipo=r.tipo,
            estado=r.estado,
            fecha_emision=r.fecha_emision,
            total=r.total,
            tiene_complemento=r.tiene_complemento
        )
        for r in remitos
    ]


@router.get("/tipos")
def obtener_tipos_remito():
    """Obtiene los tipos de remito disponibles."""
    return TIPOS_REMITO


@router.get("/estados")
def obtener_estados_remito():
    """Obtiene los estados de remito disponibles."""
    return ESTADOS_REMITO


# ==================== PORTAL CLIENTE ====================


def _serializar_remito_para_portal(remito) -> dict:
    """Serializa un remito con sus detalles de productos para el portal cliente."""
    detalles = []
    for d in remito.detalles:
        producto = getattr(d, "producto", None)
        detalles.append({
            "id": str(d.id),
            "producto_id": str(d.producto_id) if d.producto_id else None,
            "producto_codigo": getattr(producto, "codigo", None),
            "producto_nombre": getattr(producto, "nombre", None),
            "cantidad": int(d.cantidad) if d.cantidad is not None else 0,
            "precio_unitario": float(d.precio_unitario) if d.precio_unitario is not None else 0.0,
            "subtotal": float(d.subtotal) if d.subtotal is not None else 0.0,
            "descripcion": d.descripcion,
        })
    return {
        "id": str(remito.id),
        "numero": remito.numero,
        "tipo": remito.tipo,
        "estado": remito.estado,
        "fecha_emision": remito.fecha_emision.isoformat() if remito.fecha_emision else None,
        "fecha_entrega": remito.fecha_entrega.isoformat() if remito.fecha_entrega else None,
        "lote_numero": remito.lote.numero if remito.lote else None,
        "peso_total_kg": float(remito.peso_total_kg) if remito.peso_total_kg is not None else None,
        "subtotal": float(remito.subtotal) if remito.subtotal is not None else 0.0,
        "descuento": float(remito.descuento) if remito.descuento is not None else 0.0,
        "total": float(remito.total) if remito.total is not None else 0.0,
        "notas": remito.notas,
        "detalles": detalles,
    }


@router.get("/mis-remitos")
def obtener_mis_remitos(
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista los remitos del cliente logueado. Solo accesible con rol=cliente."""
    if current_user.rol != "cliente" or not current_user.cliente_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Endpoint reservado para clientes",
        )
    remitos = RemitoService.get_all(
        db,
        cliente_id=current_user.cliente_id,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        skip=skip,
        limit=limit,
    )
    return [
        {
            "id": str(r.id),
            "numero": r.numero,
            "tipo": r.tipo,
            "estado": r.estado,
            "fecha_emision": r.fecha_emision.isoformat() if r.fecha_emision else None,
            "fecha_entrega": r.fecha_entrega.isoformat() if r.fecha_entrega else None,
            "lote_numero": r.lote.numero if r.lote else None,
            "total": float(r.total) if r.total is not None else 0.0,
        }
        for r in remitos
    ]


@router.get("/mis-productos-entregados")
def obtener_mis_productos_entregados(
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Resumen agregado de productos entregados al cliente logueado en el
    rango de fechas. Suma cantidades y subtotales por producto tomando los
    detalles de todos sus remitos activos. Solo rol=cliente."""
    if current_user.rol != "cliente" or not current_user.cliente_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Endpoint reservado para clientes",
        )

    from sqlalchemy.orm import joinedload
    from app.models.remito import Remito, DetalleRemito

    query = (
        db.query(Remito)
        .options(joinedload(Remito.detalles).joinedload(DetalleRemito.producto))
        .filter(
            Remito.cliente_id == current_user.cliente_id,
            Remito.activo.is_(True),
        )
    )
    if fecha_desde:
        query = query.filter(Remito.fecha_emision >= fecha_desde)
    if fecha_hasta:
        query = query.filter(Remito.fecha_emision <= fecha_hasta)

    productos: dict = {}
    total_cantidad = 0
    total_subtotal = 0.0
    for remito in query.all():
        for d in remito.detalles:
            pid = str(d.producto_id) if d.producto_id else "sin_producto"
            if pid not in productos:
                producto = getattr(d, "producto", None)
                productos[pid] = {
                    "producto_id": pid if pid != "sin_producto" else None,
                    "producto_codigo": getattr(producto, "codigo", None),
                    "producto_nombre": getattr(producto, "nombre", None),
                    "cantidad": 0,
                    "subtotal": 0.0,
                }
            cantidad = int(d.cantidad) if d.cantidad is not None else 0
            subtotal = float(d.subtotal) if d.subtotal is not None else 0.0
            productos[pid]["cantidad"] += cantidad
            productos[pid]["subtotal"] += subtotal
            total_cantidad += cantidad
            total_subtotal += subtotal

    items = sorted(productos.values(), key=lambda p: p["cantidad"], reverse=True)
    return {
        "items": items,
        "total_cantidad": total_cantidad,
        "total_subtotal": total_subtotal,
    }


@router.get("/mis-remitos/{remito_id}")
def obtener_mi_remito(
    remito_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Detalle de un remito del cliente logueado con productos. Solo rol=cliente."""
    if current_user.rol != "cliente" or not current_user.cliente_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Endpoint reservado para clientes",
        )
    from sqlalchemy.orm import joinedload
    from app.models.remito import Remito, DetalleRemito

    remito = (
        db.query(Remito)
        .options(joinedload(Remito.detalles).joinedload(DetalleRemito.producto), joinedload(Remito.lote))
        .filter(Remito.id == remito_id)
        .first()
    )
    if not remito or remito.cliente_id != current_user.cliente_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Remito no encontrado",
        )
    return _serializar_remito_para_portal(remito)


@router.get("/{remito_id}", response_model=RemitoResponse)
def obtener_remito(
    remito_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador", "comercial"))
):
    """Obtiene un remito por ID."""
    remito = RemitoService.get_by_id(db, remito_id)
    if not remito:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Remito no encontrado"
        )

    detalles = [
        DetalleRemitoResponse(
            id=d.id,
            remito_id=d.remito_id,
            producto_id=d.producto_id,
            producto_codigo=d.producto.codigo if d.producto else "",
            producto_nombre=d.producto.nombre if d.producto else "",
            cantidad=d.cantidad,
            precio_unitario=d.precio_unitario,
            subtotal=d.subtotal,
            descripcion=d.descripcion,
            pendiente_relevado=d.pendiente_relevado,
            cantidad_relevado=d.cantidad_relevado
        )
        for d in remito.detalles
    ]

    complementarios = [
        RemitoListResponse(
            id=c.id,
            numero=c.numero,
            lote_numero=c.lote.numero if c.lote else "",
            cliente_nombre=c.cliente.nombre_fantasia or c.cliente.razon_social if c.cliente else "",
            tipo=c.tipo,
            estado=c.estado,
            fecha_emision=c.fecha_emision,
            total=c.total,
            tiene_complemento=False
        )
        for c in remito.remitos_complementarios
    ]

    return RemitoResponse(
        id=remito.id,
        numero=remito.numero,
        lote_id=remito.lote_id,
        lote_numero=remito.lote.numero if remito.lote else "",
        cliente_id=remito.cliente_id,
        cliente_nombre=remito.cliente.nombre_fantasia or remito.cliente.razon_social if remito.cliente else "",
        tipo=remito.tipo,
        estado=remito.estado,
        fecha_emision=remito.fecha_emision,
        fecha_entrega=remito.fecha_entrega,
        peso_total_kg=remito.peso_total_kg,
        subtotal=remito.subtotal,
        descuento=remito.descuento,
        total=remito.total,
        remito_padre_id=remito.remito_padre_id,
        remito_padre_numero=remito.remito_padre.numero if remito.remito_padre else None,
        movimiento_cc_id=remito.movimiento_cc_id,
        emitido_por_nombre=remito.emitido_por.nombre_completo if remito.emitido_por else None,
        entregado_por_nombre=remito.entregado_por.nombre_completo if remito.entregado_por else None,
        notas=remito.notas,
        notas_entrega=remito.notas_entrega,
        activo=remito.activo,
        created_at=remito.created_at,
        detalles=detalles,
        tiene_complemento=remito.tiene_complemento,
        remitos_complementarios=complementarios
    )


# ==================== PDF ====================

@router.get("/{remito_id}/pdf")
def descargar_remito_pdf(
    remito_id: UUID,
    con_precios: bool = Query(False, description="Incluir columna de precios y total"),
    preview: bool = Query(False, description="Dibujar los cuadros del papel preimpreso para preview en pantalla"),
    off_x: Optional[float] = Query(None, description="Offset horizontal en mm para calibrar el preimpreso (positivo=derecha)"),
    off_y: Optional[float] = Query(None, description="Offset vertical en mm para calibrar el preimpreso (positivo=abajo)"),
    grid: Optional[float] = Query(None, description="Dibuja regla en mm cada N milímetros (ej. 5) + marcadores de bloques"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador", "comercial"))
):
    """
    Devuelve el PDF del remito posicionado para imprimir sobre el papel
    preimpreso DUWHITE (33×20 cm apaisado, original + duplicado).
    Con preview=true agrega el diseño del preimpreso simulado para
    verificar alineación sin gastar papel.
    off_x / off_y permiten calibrar en vivo el corrimiento global de los
    datos variables sobre el papel (útil si el alimentador entra distinto).
    """
    from fastapi.responses import Response

    remito = RemitoService.get_by_id(db, remito_id)
    if not remito:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Remito no encontrado")

    pdf_bytes = remito_pdf_service.generar_pdf(
        db, remito,
        con_precios=con_precios,
        preview_preimpreso=preview,
        offset_x_mm=off_x,
        offset_y_mm=off_y,
        grid_mm=grid,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="remito-{remito.numero}.pdf"',
        },
    )


# ==================== GENERAR REMITO ====================

@router.post("/lotes/{lote_id}/generar", response_model=GenerarRemitoResponse)
def generar_remito_desde_lote(
    lote_id: UUID,
    request: GenerarRemitoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador"))
):
    """
    Genera un remito desde la etapa de conteo y finalización.

    Este endpoint:
    1. Crea el remito con los detalles
    2. Emite el remito (genera cargo en cuenta corriente)
    3. Si hay items a relavar, crea un lote de relevado
    4. Actualiza el estado del lote
    """
    return RemitoService.generar_remito_desde_lote(
        db, lote_id, request, current_user.id
    )


@router.post("/manual", response_model=GenerarRemitoResponse)
def generar_remito_manual(
    request: GenerarRemitoManualRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(
        require_permission("superadmin", "administrador", "jefe_produccion", "comercial", "operador")
    ),
):
    """Genera un remito directamente para un cliente, sin pasar por el
    flujo de producción (recepción/lavado/etc). Crea un Lote sombra
    completado y usa el flujo estándar de remito para cargar en CC.
    """
    return RemitoService.generar_remito_manual(db, request, current_user.id)


@router.post("/lotes/{lote_id}/generar-complementario", response_model=GenerarRemitoResponse)
def generar_remito_complementario(
    lote_id: UUID,
    request: GenerarRemitoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador"))
):
    """
    Genera un remito complementario para un lote de relevado.

    Se usa cuando termina el proceso de un lote de relevado
    para generar el remito de las prendas relavadas.
    """
    return RemitoService.generar_remito_complementario(
        db, lote_id, request, current_user.id
    )


# ==================== ACCIONES ====================

@router.post("/{remito_id}/entregar")
def marcar_remito_entregado(
    remito_id: UUID,
    request: EntregarRemitoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador"))
):
    """Marca un remito como entregado."""
    remito = RemitoService.marcar_entregado(
        db, remito_id, request.notas_entrega, current_user.id
    )

    return {
        "mensaje": f"Remito {remito.numero} marcado como entregado",
        "remito_id": remito.id,
        "estado": remito.estado,
        "fecha_entrega": remito.fecha_entrega
    }


@router.post("/{remito_id}/anular")
def anular_remito(
    remito_id: UUID,
    request: AnularRemitoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador"))
):
    """Anula un remito y revierte el cargo en cuenta corriente."""
    remito = RemitoService.anular(db, remito_id, request.motivo, current_user.id)

    return {
        "mensaje": f"Remito {remito.numero} anulado",
        "remito_id": remito.id,
        "estado": remito.estado,
        "motivo": remito.motivo_anulacion
    }


# ==================== CONSULTAS POR CLIENTE/LOTE ====================

@router.get("/cliente/{cliente_id}", response_model=List[RemitoListResponse])
def obtener_remitos_cliente(
    cliente_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador", "comercial"))
):
    """Obtiene los remitos de un cliente."""
    remitos = RemitoService.get_remitos_cliente(db, cliente_id, skip, limit)

    return [
        RemitoListResponse(
            id=r.id,
            numero=r.numero,
            lote_numero=r.lote.numero if r.lote else "",
            cliente_nombre=r.cliente.nombre_fantasia or r.cliente.razon_social if r.cliente else "",
            tipo=r.tipo,
            estado=r.estado,
            fecha_emision=r.fecha_emision,
            total=r.total,
            tiene_complemento=r.tiene_complemento
        )
        for r in remitos
    ]


@router.get("/lote/{lote_id}", response_model=List[RemitoListResponse])
def obtener_remitos_lote(
    lote_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador", "comercial"))
):
    """Obtiene los remitos de un lote."""
    remitos = RemitoService.get_remitos_lote(db, lote_id)

    return [
        RemitoListResponse(
            id=r.id,
            numero=r.numero,
            lote_numero=r.lote.numero if r.lote else "",
            cliente_nombre=r.cliente.nombre_fantasia or r.cliente.razon_social if r.cliente else "",
            tipo=r.tipo,
            estado=r.estado,
            fecha_emision=r.fecha_emision,
            total=r.total,
            tiene_complemento=r.tiene_complemento
        )
        for r in remitos
    ]
