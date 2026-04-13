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
    GenerarRemitoResponse,
    EntregarRemitoRequest,
    AnularRemitoRequest,
    TIPOS_REMITO,
    ESTADOS_REMITO,
)
from app.services.remito_service import RemitoService


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
