"""
Endpoint de Historial de Lavados.

Reconversión del antiguo módulo "Actividades" a una vista de auditoría
para superadmin/administrador. Consulta procesos de lavado (lotes),
sus etapas, remitos y consumos, además de la solapa "Eliminados"
alimentada desde LogActividad.
"""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, and_, cast, func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_db, require_permission
from app.models.cliente import Cliente
from app.models.cuenta_corriente import MovimientoCuentaCorriente
from app.models.log_actividad import LogActividad
from app.models.lote_produccion import (
    ConsumoInsumoLote,
    LoteEtapa,
    LoteProduccion,
    TipoServicio,
)
from app.models.producto_lavado import ProductoLavado
from app.models.remito import DetalleRemito, Remito
from app.models.usuario import Usuario

router = APIRouter()


REQUIERE_ROL = require_permission("superadmin", "administrador")


def _duracion_minutos(inicio: Optional[datetime], fin: Optional[datetime]) -> Optional[int]:
    if not inicio or not fin:
        return None
    delta = fin - inicio
    return int(delta.total_seconds() / 60)


def _lote_to_row(lote: LoteProduccion) -> dict:
    remitos_activos = [r for r in lote.remitos if r.activo]

    # Resumen de productos: agrego cantidades por producto de todos los remitos
    productos_agrupados: dict[str, int] = {}
    for r in remitos_activos:
        for d in r.detalles:
            nombre = d.producto.nombre if d.producto else "—"
            productos_agrupados[nombre] = productos_agrupados.get(nombre, 0) + int(d.cantidad or 0)

    productos_resumen = [
        {"producto": nombre, "cantidad": cant}
        for nombre, cant in productos_agrupados.items()
    ]

    return {
        "lote_id": str(lote.id),
        "numero_lote": lote.numero,
        "cliente_id": str(lote.cliente_id) if lote.cliente_id else None,
        "cliente_nombre": lote.cliente.razon_social if lote.cliente else None,
        "estado": lote.estado,
        "tipo_servicio": lote.tipo_servicio,
        "fecha_ingreso": lote.fecha_ingreso.isoformat() if lote.fecha_ingreso else None,
        "fecha_inicio_proceso": (
            lote.fecha_inicio_proceso.isoformat() if lote.fecha_inicio_proceso else None
        ),
        "fecha_fin_proceso": (
            lote.fecha_fin_proceso.isoformat() if lote.fecha_fin_proceso else None
        ),
        "duracion_minutos": _duracion_minutos(lote.fecha_inicio_proceso, lote.fecha_fin_proceso),
        "peso_entrada_kg": float(lote.peso_entrada_kg) if lote.peso_entrada_kg else None,
        "peso_salida_kg": float(lote.peso_salida_kg) if lote.peso_salida_kg else None,
        "cantidad_prendas": lote.cantidad_prendas,
        "remitos": [
            {
                "id": str(r.id),
                "numero": r.numero,
                "fecha_emision": r.fecha_emision.isoformat() if r.fecha_emision else None,
                "estado": r.estado,
                "total": float(r.total) if r.total else 0.0,
            }
            for r in remitos_activos
        ],
        "productos_resumen": productos_resumen,
    }


@router.get("/", response_model=dict)
def listar_historial(
    cliente_id: Optional[UUID] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    numero_remito: Optional[str] = Query(None, description="Búsqueda parcial"),
    tipo_servicio: Optional[str] = Query(None),
    producto_id: Optional[UUID] = Query(None),
    estado: Optional[str] = Query(None, description="Por defecto: solo completados"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(REQUIERE_ROL),
):
    """
    Lista de procesos de lavado (lotes) con filtros para el módulo de historial.
    """
    query = db.query(LoteProduccion).options(
        joinedload(LoteProduccion.cliente),
        joinedload(LoteProduccion.remitos).joinedload(Remito.detalles).joinedload(
            DetalleRemito.producto
        ),
    )

    if estado:
        query = query.filter(LoteProduccion.estado == estado)

    if cliente_id:
        query = query.filter(LoteProduccion.cliente_id == cliente_id)

    if fecha_desde:
        query = query.filter(LoteProduccion.fecha_ingreso >= fecha_desde)
    if fecha_hasta:
        # Incluye el día completo
        query = query.filter(
            LoteProduccion.fecha_ingreso < datetime.combine(fecha_hasta, datetime.max.time())
        )

    if tipo_servicio:
        query = query.filter(LoteProduccion.tipo_servicio == tipo_servicio)

    if numero_remito:
        remito_ids = (
            db.query(Remito.lote_id)
            .filter(Remito.numero.ilike(f"%{numero_remito}%"), Remito.activo == True)
            .subquery()
        )
        query = query.filter(LoteProduccion.id.in_(remito_ids))

    if producto_id:
        lote_ids_con_producto = (
            db.query(Remito.lote_id)
            .join(DetalleRemito, DetalleRemito.remito_id == Remito.id)
            .filter(DetalleRemito.producto_id == producto_id, Remito.activo == True)
            .subquery()
        )
        query = query.filter(LoteProduccion.id.in_(lote_ids_con_producto))

    total = query.count()

    lotes = (
        query.order_by(LoteProduccion.fecha_ingreso.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [_lote_to_row(l) for l in lotes],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total else 0,
    }


@router.get("/tipos-servicio", response_model=list)
def tipos_servicio(current_user: Usuario = Depends(REQUIERE_ROL)):
    """Enum de tipos de servicio disponibles."""
    return [{"value": t.value, "label": t.value.replace("_", " ").title()} for t in TipoServicio]


@router.get("/eliminados/remitos", response_model=dict)
def listar_remitos_eliminados(
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    cliente_id: Optional[UUID] = Query(None),
    usuario_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(REQUIERE_ROL),
):
    """
    Lista de remitos eliminados leyendo LogActividad con
    modulo='remitos' y accion='eliminar'.
    """
    query = (
        db.query(LogActividad, Usuario)
        .outerjoin(Usuario, Usuario.id == LogActividad.usuario_id)
        .filter(LogActividad.modulo == "remitos", LogActividad.accion == "eliminar")
    )

    if fecha_desde:
        query = query.filter(LogActividad.created_at >= datetime.combine(fecha_desde, datetime.min.time()))
    if fecha_hasta:
        query = query.filter(LogActividad.created_at < datetime.combine(fecha_hasta, datetime.max.time()))
    if usuario_id:
        query = query.filter(LogActividad.usuario_id == usuario_id)
    if cliente_id:
        # datos_anteriores.cliente_id es string en JSONB
        query = query.filter(
            LogActividad.datos_anteriores["cliente_id"].astext == str(cliente_id)
        )

    total = query.count()
    rows = (
        query.order_by(LogActividad.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = []
    for log, usuario in rows:
        datos = log.datos_anteriores or {}
        items.append(
            {
                "log_id": str(log.id),
                "fecha": log.created_at.date().isoformat() if log.created_at else None,
                "hora": log.created_at.strftime("%H:%M:%S") if log.created_at else None,
                "created_at": log.created_at.isoformat() if log.created_at else None,
                "usuario_id": str(log.usuario_id) if log.usuario_id else None,
                "usuario_nombre": (
                    usuario.nombre_completo if usuario and hasattr(usuario, "nombre_completo") else (usuario.nombre if usuario else None)
                ),
                "remito_id": str(log.entidad_id) if log.entidad_id else None,
                "numero_remito": datos.get("numero"),
                "cliente_id": datos.get("cliente_id"),
                "cliente_nombre": datos.get("cliente_nombre"),
                "monto": datos.get("total"),
                "motivo": datos.get("motivo") or log.descripcion,
                "datos": datos,
            }
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total else 0,
    }


@router.get("/{lote_id}", response_model=dict)
def detalle_lote(
    lote_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(REQUIERE_ROL),
):
    """Detalle completo de un proceso de lavado."""
    lote = (
        db.query(LoteProduccion)
        .options(
            joinedload(LoteProduccion.cliente),
            joinedload(LoteProduccion.pedido),
            joinedload(LoteProduccion.etapas).joinedload(LoteEtapa.etapa),
            joinedload(LoteProduccion.etapas).joinedload(LoteEtapa.responsable),
            joinedload(LoteProduccion.consumos_insumo).joinedload(ConsumoInsumoLote.insumo),
            joinedload(LoteProduccion.remitos).joinedload(Remito.detalles).joinedload(
                DetalleRemito.producto
            ),
        )
        .filter(LoteProduccion.id == lote_id)
        .first()
    )

    if not lote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote no encontrado")

    etapas = [
        {
            "id": str(e.id),
            "orden": e.orden,
            "codigo": e.etapa.codigo if e.etapa else None,
            "nombre": e.etapa.nombre if e.etapa else None,
            "estado": e.estado,
            "fecha_inicio": e.fecha_inicio.isoformat() if e.fecha_inicio else None,
            "fecha_fin": e.fecha_fin.isoformat() if e.fecha_fin else None,
            "duracion_minutos": e.duracion_minutos,
            "responsable_id": str(e.responsable_id) if e.responsable_id else None,
            "responsable_nombre": (
                e.responsable.nombre_completo
                if e.responsable and hasattr(e.responsable, "nombre_completo")
                else (e.responsable.nombre if e.responsable else None)
            ),
            "peso_kg": float(e.peso_kg) if e.peso_kg else None,
            "observaciones": e.observaciones,
        }
        for e in sorted(lote.etapas, key=lambda x: x.orden)
    ]

    consumos = [
        {
            "id": str(c.id),
            "insumo_nombre": c.insumo.nombre if c.insumo else None,
            "cantidad": float(c.cantidad) if c.cantidad else 0.0,
            "unidad": c.unidad,
            "costo_total": float(c.costo_total) if c.costo_total else None,
            "notas": c.notas,
        }
        for c in lote.consumos_insumo
    ]

    remitos = []
    for r in lote.remitos:
        if not r.activo:
            continue
        remitos.append(
            {
                "id": str(r.id),
                "numero": r.numero,
                "tipo": r.tipo,
                "estado": r.estado,
                "fecha_emision": r.fecha_emision.isoformat() if r.fecha_emision else None,
                "fecha_entrega": r.fecha_entrega.isoformat() if r.fecha_entrega else None,
                "subtotal": float(r.subtotal) if r.subtotal else 0.0,
                "descuento": float(r.descuento) if r.descuento else 0.0,
                "total": float(r.total) if r.total else 0.0,
                "detalles": [
                    {
                        "producto_id": str(d.producto_id) if d.producto_id else None,
                        "producto_nombre": d.producto.nombre if d.producto else None,
                        "cantidad": d.cantidad,
                        "precio_unitario": float(d.precio_unitario) if d.precio_unitario else 0.0,
                        "subtotal": float(d.subtotal) if d.subtotal else 0.0,
                    }
                    for d in r.detalles
                ],
            }
        )

    return {
        "lote_id": str(lote.id),
        "numero_lote": lote.numero,
        "estado": lote.estado,
        "tipo_servicio": lote.tipo_servicio,
        "tipo_lote": lote.tipo_lote,
        "prioridad": lote.prioridad,
        "cliente": (
            {
                "id": str(lote.cliente_id),
                "razon_social": lote.cliente.razon_social if lote.cliente else None,
                "cuit": lote.cliente.cuit if lote.cliente else None,
            }
            if lote.cliente_id
            else None
        ),
        "pedido": (
            {"id": str(lote.pedido_id), "numero": lote.pedido.numero}
            if lote.pedido_id and lote.pedido
            else None
        ),
        "fecha_ingreso": lote.fecha_ingreso.isoformat() if lote.fecha_ingreso else None,
        "fecha_compromiso": lote.fecha_compromiso.isoformat() if lote.fecha_compromiso else None,
        "fecha_inicio_proceso": (
            lote.fecha_inicio_proceso.isoformat() if lote.fecha_inicio_proceso else None
        ),
        "fecha_fin_proceso": (
            lote.fecha_fin_proceso.isoformat() if lote.fecha_fin_proceso else None
        ),
        "duracion_minutos": _duracion_minutos(lote.fecha_inicio_proceso, lote.fecha_fin_proceso),
        "peso_entrada_kg": float(lote.peso_entrada_kg) if lote.peso_entrada_kg else None,
        "peso_salida_kg": float(lote.peso_salida_kg) if lote.peso_salida_kg else None,
        "cantidad_prendas": lote.cantidad_prendas,
        "descripcion": lote.descripcion,
        "notas_internas": lote.notas_internas,
        "notas_cliente": lote.notas_cliente,
        "observaciones_calidad": lote.observaciones_calidad,
        "etapas": etapas,
        "consumos": consumos,
        "remitos": remitos,
    }
