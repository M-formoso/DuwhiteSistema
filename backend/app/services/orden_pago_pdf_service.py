"""
PDF de Orden de Pago (comprobante formal para auditoría y entrega al proveedor).
"""

from __future__ import annotations

import logging
import os
from decimal import Decimal

from fastapi import HTTPException, status
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.orm import Session, joinedload

from app.core.timezone import now_ar
from app.models.cuenta_corriente_proveedor import OrdenPago, DetalleOrdenPago
from app.models.proveedor import Proveedor
from app.models.cuenta_corriente_proveedor import MovimientoCuentaCorrienteProveedor


logger = logging.getLogger(__name__)

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")


def _moneda(value) -> str:
    if value is None:
        return "-"
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


def generar_pdf(db: Session, orden_id: str) -> tuple[bytes, str]:
    """
    Genera el PDF de una orden de pago.
    Retorna (bytes, filename).
    """
    try:
        from weasyprint import HTML
    except ImportError as exc:
        logger.exception("WeasyPrint no disponible")
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"WeasyPrint no disponible: {exc}",
        )

    orden = (
        db.query(OrdenPago)
        .options(
            joinedload(OrdenPago.proveedor),
            joinedload(OrdenPago.detalles).joinedload(DetalleOrdenPago.movimiento),
        )
        .filter(OrdenPago.id == orden_id)
        .first()
    )
    if not orden:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Orden de pago no encontrada")

    # Armar lista de comprobantes imputados con la info visible al proveedor.
    detalles = []
    for d in sorted(orden.detalles, key=lambda x: x.numero_linea or 0):
        mov = d.movimiento
        detalles.append({
            "factura_numero": (mov.factura_numero if mov else None) or d.descripcion or "—",
            "fecha_factura": mov.factura_fecha if mov else None,
            "fecha_vencimiento": mov.fecha_vencimiento if mov else None,
            "monto_comprobante": d.monto_comprobante,
            "monto_pendiente_antes": d.monto_pendiente_antes,
            "monto_a_pagar": d.monto_a_pagar,
        })

    try:
        from app.services import configuracion_service
        env = _get_env()
        template = env.get_template("orden_pago.html")
        html_str = template.render(
            orden=orden,
            proveedor=orden.proveedor,
            detalles=detalles,
            empresa=configuracion_service.get_empresa_dict(db),
            generado_at=now_ar().strftime("%d/%m/%Y %H:%M"),
        )
    except Exception as exc:
        logger.exception("Error renderizando template orden_pago.html")
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al renderizar template: {exc}",
        )

    try:
        pdf_bytes = HTML(string=html_str, base_url=TEMPLATES_DIR).write_pdf()
    except Exception as exc:
        logger.exception("WeasyPrint falló al generar PDF para OP %s", orden_id)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al renderizar PDF (WeasyPrint): {exc}",
        )

    filename = f"orden_pago_{orden.numero}.pdf"
    return pdf_bytes, filename
