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

    # Armar dos estructuras: lista plana de remitos + consolidado de productos.
    remitos_ctx = []
    total_general = Decimal(0)
    # Consolidado por producto: codigo -> {codigo, nombre, cantidad, subtotal}
    productos_map: dict = {}

    for r in remitos:
        for d in r.detalles:
            prod = getattr(d, "producto", None)
            cantidad = int(d.cantidad or 0)
            sub = Decimal(d.subtotal or 0)
            codigo = getattr(prod, "codigo", None) or "-"
            nombre = getattr(prod, "nombre", None) or (d.descripcion or "-")
            key = codigo if codigo != "-" else nombre
            if key not in productos_map:
                productos_map[key] = {
                    "codigo": codigo,
                    "nombre": nombre,
                    "cantidad": 0,
                    "subtotal": Decimal(0),
                }
            productos_map[key]["cantidad"] += cantidad
            productos_map[key]["subtotal"] += sub

        lote = lotes_map.get(r.lote_id) if r.lote_id else None
        remitos_ctx.append({
            "numero": r.numero,
            "fecha_emision": r.fecha_emision,
            "estado": r.estado,
            "lote_numero": lote.numero if lote else None,
            "total": r.total,
        })
        total_general += Decimal(r.total or 0)

    # Ordenar productos: primero por codigo numerico si aplica, si no alfabetico.
    def _codigo_sort_key(p):
        try:
            return (0, int(p["codigo"]))
        except (ValueError, TypeError):
            return (1, str(p["codigo"]))

    productos_ctx = sorted(productos_map.values(), key=_codigo_sort_key)
    total_cantidad_items = sum(p["cantidad"] for p in productos_ctx)

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
        productos=productos_ctx,
        cantidad_remitos=len(remitos_ctx),
        total_general=total_general,
        total_cantidad_items=total_cantidad_items,
        generado_at=now_ar().strftime("%d/%m/%Y %H:%M"),
        periodo=periodo,
    )
    return HTML(string=html_str, base_url=TEMPLATES_DIR).write_pdf()
