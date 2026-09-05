"""
PDF de listado de Remitos de un cliente.

A diferencia de `estado_cuenta_pdf_service`, este PDF NO incluye datos de
saldos ni deudas. Solo el detalle de todos los remitos del cliente en el
período con sus productos entregados.
"""

from __future__ import annotations

import os
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.orm import Session, joinedload

from app.core.timezone import now_ar
from app.models.cliente import Cliente
from app.models.remito import Remito, DetalleRemito, EstadoRemito
from app.models.lote_produccion import LoteProduccion
from app.services import configuracion_service


TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")


def _moneda(value) -> str:
    if value is None:
        return ""
    try:
        v = Decimal(value)
    except Exception:
        return str(value)
    s = f"{v:,.2f}"
    return "$ " + s.replace(",", "_").replace(".", ",").replace("_", ".")


def _fecha_ar(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%d/%m/%Y")
    return str(value)


def _get_env() -> Environment:
    env = Environment(
        loader=FileSystemLoader(TEMPLATES_DIR),
        autoescape=select_autoescape(["html"]),
    )
    env.filters["moneda"] = _moneda
    env.filters["fecha_ar"] = _fecha_ar
    return env


# Estados de remito que representan una entrega efectiva.
_ESTADOS_REMITO_VALIDOS = (EstadoRemito.EMITIDO.value, EstadoRemito.ENTREGADO.value)


def generar_pdf(
    db: Session,
    cliente_id: UUID,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
) -> bytes:
    """
    Genera un PDF con el listado de remitos del cliente en el período.
    Cada remito incluye su detalle de productos entregados.
    """
    try:
        from weasyprint import HTML
    except ImportError as exc:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"WeasyPrint no disponible: {exc}",
        )

    cliente = db.query(Cliente).filter(Cliente.id == str(cliente_id)).first()
    if not cliente:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente no encontrado")

    # Query de remitos con sus detalles + producto + lote (para número).
    remitos_query = (
        db.query(Remito)
        .options(
            joinedload(Remito.detalles).joinedload(DetalleRemito.producto),
        )
        .filter(
            Remito.cliente_id == str(cliente_id),
            Remito.activo.is_(True),
            Remito.estado.in_(_ESTADOS_REMITO_VALIDOS),
        )
    )
    if fecha_desde:
        remitos_query = remitos_query.filter(Remito.fecha_emision >= fecha_desde)
    if fecha_hasta:
        remitos_query = remitos_query.filter(Remito.fecha_emision <= fecha_hasta)

    remitos = remitos_query.order_by(
        Remito.fecha_emision.asc(), Remito.numero.asc()
    ).all()

    # Cargar números de lote sin sobrecargar (una sola query).
    lote_ids = {r.lote_id for r in remitos if r.lote_id}
    lotes_map = {}
    if lote_ids:
        lotes = db.query(LoteProduccion).filter(LoteProduccion.id.in_(lote_ids)).all()
        lotes_map = {l.id: l for l in lotes}

    # Armar estructura por remito con sus items para el template.
    remitos_ctx = []
    total_general = Decimal(0)
    total_kg = Decimal(0)
    total_cantidad_items = 0

    for r in remitos:
        items = []
        subtotal_remito = Decimal(0)
        for d in r.detalles:
            prod = getattr(d, "producto", None)
            cantidad = int(d.cantidad or 0)
            precio = Decimal(d.precio_unitario or 0)
            sub = Decimal(d.subtotal or 0)
            items.append({
                "codigo": getattr(prod, "codigo", None) or "-",
                "nombre": getattr(prod, "nombre", None) or (d.descripcion or "-"),
                "cantidad": cantidad,
                "peso_kg": (
                    float(prod.peso_promedio_kg) * cantidad
                    if prod and prod.peso_promedio_kg
                    else None
                ),
                "precio_unitario": precio,
                "subtotal": sub,
            })
            subtotal_remito += sub
            total_cantidad_items += cantidad

        lote = lotes_map.get(r.lote_id) if r.lote_id else None
        remitos_ctx.append({
            "numero": r.numero,
            "fecha_emision": r.fecha_emision,
            "fecha_entrega": r.fecha_entrega,
            "estado": r.estado,
            "lote_numero": lote.numero if lote else None,
            "peso_total_kg": r.peso_total_kg,
            "subtotal": r.subtotal,
            "descuento": r.descuento,
            "total": r.total,
            "items": items,
        })
        total_general += Decimal(r.total or 0)
        if r.peso_total_kg:
            total_kg += Decimal(r.peso_total_kg)

    periodo = None
    if fecha_desde or fecha_hasta:
        periodo = f"{_fecha_ar(fecha_desde) or '...'} a {_fecha_ar(fecha_hasta) or 'hoy'}"

    empresa = configuracion_service.get_empresa_dict(db)

    env = _get_env()
    template = env.get_template("remitos_cliente.html")
    html_str = template.render(
        cliente=cliente,
        empresa=empresa,
        remitos=remitos_ctx,
        cantidad_remitos=len(remitos_ctx),
        total_general=total_general,
        total_kg=total_kg,
        total_cantidad_items=total_cantidad_items,
        generado_at=now_ar().strftime("%d/%m/%Y %H:%M"),
        periodo=periodo,
    )
    return HTML(string=html_str, base_url=TEMPLATES_DIR).write_pdf()
