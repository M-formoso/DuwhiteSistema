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
        generado_at=datetime.now().strftime("%d/%m/%Y %H:%M"),
        periodo=periodo,
    )
    return HTML(string=html_str, base_url=TEMPLATES_DIR).write_pdf()
