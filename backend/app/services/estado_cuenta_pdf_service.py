"""
PDF de Estado de Cuenta de un cliente.
"""

from __future__ import annotations

import os
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.cliente import Cliente
from app.models.cuenta_corriente import MovimientoCuentaCorriente, TipoMovimientoCC
from app.models.remito import Remito, DetalleRemito
from app.services.cliente_service import ClienteService


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
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value).date()
        except Exception:
            return value
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


def generar_pdf(
    db: Session,
    cliente_id: UUID,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
) -> bytes:
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

    query = db.query(MovimientoCuentaCorriente).filter(
        MovimientoCuentaCorriente.cliente_id == str(cliente_id)
    )
    if fecha_desde:
        query = query.filter(MovimientoCuentaCorriente.fecha_movimiento >= fecha_desde)
    if fecha_hasta:
        query = query.filter(MovimientoCuentaCorriente.fecha_movimiento <= fecha_hasta)
    movimientos = query.order_by(
        MovimientoCuentaCorriente.fecha_movimiento.asc(),
        MovimientoCuentaCorriente.created_at.asc(),
    ).all()

    estado = ClienteService(db).get_estado_cuenta(str(cliente_id))

    # Remitos del período (activos) con productos, para las dos secciones extra.
    from sqlalchemy.orm import joinedload

    remitos_query = (
        db.query(Remito)
        .options(joinedload(Remito.detalles).joinedload(DetalleRemito.producto))
        .filter(Remito.cliente_id == str(cliente_id), Remito.activo.is_(True))
    )
    if fecha_desde:
        remitos_query = remitos_query.filter(Remito.fecha_emision >= fecha_desde)
    if fecha_hasta:
        remitos_query = remitos_query.filter(Remito.fecha_emision <= fecha_hasta)
    remitos = remitos_query.order_by(Remito.fecha_emision.asc(), Remito.created_at.asc()).all()

    total_remitos = sum((Decimal(r.total or 0) for r in remitos), Decimal(0))

    # Productos entregados: agregación por producto a partir de los detalles.
    productos_map: dict = {}
    total_cantidad_productos = 0
    total_subtotal_productos = Decimal(0)
    for r in remitos:
        for d in r.detalles:
            pid = str(d.producto_id) if d.producto_id else "sin_producto"
            if pid not in productos_map:
                producto = getattr(d, "producto", None)
                productos_map[pid] = {
                    "codigo": getattr(producto, "codigo", None) or "-",
                    "nombre": getattr(producto, "nombre", None) or "-",
                    "cantidad": 0,
                    "subtotal": Decimal(0),
                }
            cantidad = int(d.cantidad or 0)
            subtotal = Decimal(d.subtotal or 0)
            productos_map[pid]["cantidad"] += cantidad
            productos_map[pid]["subtotal"] += subtotal
            total_cantidad_productos += cantidad
            total_subtotal_productos += subtotal
    productos_entregados = sorted(productos_map.values(), key=lambda p: p["cantidad"], reverse=True)

    periodo = None
    if fecha_desde or fecha_hasta:
        periodo = f"{_fecha_ar(fecha_desde) or '...'} a {_fecha_ar(fecha_hasta) or 'hoy'}"

    env = _get_env()
    template = env.get_template("estado_cuenta.html")
    html_str = template.render(
        cliente=cliente,
        empresa={
            "nombre": settings.EMPRESA_NOMBRE,
            "razon_social": settings.EMPRESA_RAZON_SOCIAL,
            "cuit": settings.EMPRESA_CUIT,
            "direccion": settings.EMPRESA_DIRECCION,
            "condicion_iva": settings.EMPRESA_CONDICION_IVA,
        },
        movimientos=movimientos,
        saldo_actual=estado.get("saldo_actual"),
        deuda_facturada=estado.get("deuda_facturada"),
        cargos_sin_facturar=estado.get("cargos_sin_facturar"),
        saldo_a_favor=estado.get("saldo_a_favor"),
        remitos=remitos,
        total_remitos=total_remitos,
        productos_entregados=productos_entregados,
        total_cantidad_productos=total_cantidad_productos,
        total_subtotal_productos=total_subtotal_productos,
        generado_at=datetime.now().strftime("%d/%m/%Y %H:%M"),
        periodo=periodo,
    )
    return HTML(string=html_str, base_url=TEMPLATES_DIR).write_pdf()
