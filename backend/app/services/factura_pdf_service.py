"""
Generación de PDF de Factura con layout A/B y QR AFIP (RG 4892).

Depende de: weasyprint, qrcode[pil], jinja2.
"""

from __future__ import annotations

import base64
import json
import logging
import os
from datetime import date
from decimal import Decimal
from io import BytesIO
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.factura import Factura, EstadoFactura, TipoComprobante

logger = logging.getLogger(__name__)


TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")


# ==================== QR AFIP (RG 4892) ====================


def _generar_qr_afip_datauri(factura: Factura) -> Optional[str]:
    """
    Genera el QR AFIP según RG 4892 y lo retorna como data URI (base64 png).

    Estructura JSON requerida:
      ver, fecha, cuit, ptoVta, tipoCmp, nroCmp, importe, moneda, ctz,
      tipoDocRec, nroDocRec, tipoCodAut="E", codAut (CAE).
    """
    try:
        import qrcode
    except ImportError as exc:
        logger.warning("qrcode no disponible, omitiendo QR: %s", exc)
        return None

    if not factura.cae or not factura.numero_comprobante:
        return None

    # DocTipo para AFIP (80=CUIT, 99=CF)
    doc_tipo = 80 if factura.cliente_cuit_snap else 99
    doc_nro = (
        int(factura.cliente_cuit_snap.replace("-", "")) if factura.cliente_cuit_snap else 0
    )

    payload = {
        "ver": 1,
        "fecha": factura.fecha_emision.isoformat(),
        "cuit": settings.EMPRESA_CUIT_NUMERICO,
        "ptoVta": factura.punto_venta,
        "tipoCmp": factura.codigo_afip,
        "nroCmp": factura.numero_comprobante,
        "importe": float(factura.total),
        "moneda": "PES",
        "ctz": 1,
        "tipoDocRec": doc_tipo,
        "nroDocRec": doc_nro,
        "tipoCodAut": "E",
        "codAut": int(factura.cae),
    }
    json_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    b64 = base64.urlsafe_b64encode(json_bytes).decode("ascii")
    url = f"https://www.afip.gob.ar/fe/qr/?p={b64}"

    img = qrcode.make(url)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


# ==================== FORMATEO ARG ====================


def _formatear_moneda(v) -> str:
    try:
        num = Decimal(v or 0)
    except Exception:
        return "$ 0,00"
    # Formato AR: miles con punto, decimales con coma
    entero, decimales = f"{num:,.2f}".split(".")
    entero = entero.replace(",", ".")
    return f"$ {entero},{decimales}"


def _formatear_fecha(d) -> str:
    if not d:
        return ""
    if isinstance(d, str):
        return d
    if isinstance(d, date):
        return d.strftime("%d/%m/%Y")
    return str(d)


# ==================== TEMPLATE ====================


def _get_env():
    """Construye el entorno Jinja2 (lazy import para no romper si no está instalado)."""
    try:
        from jinja2 import Environment, FileSystemLoader, select_autoescape
    except ImportError as exc:  # pragma: no cover
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Jinja2 no disponible: {exc}",
        )
    env = Environment(
        loader=FileSystemLoader(TEMPLATES_DIR),
        autoescape=select_autoescape(["html", "xml"]),
    )
    env.filters["moneda"] = _formatear_moneda
    env.filters["fecha_ar"] = _formatear_fecha
    return env


# ==================== API ====================


def generar_pdf(db: Session, factura: Factura) -> bytes:
    """Renderiza la factura a PDF y devuelve los bytes."""
    if factura.estado != EstadoFactura.AUTORIZADA.value:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Solo se puede generar PDF de facturas autorizadas.",
        )

    try:
        from weasyprint import HTML
    except ImportError as exc:  # pragma: no cover
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"WeasyPrint no disponible: {exc}",
        )

    env = _get_env()
    template = env.get_template("factura.html")

    qr_datauri = _generar_qr_afip_datauri(factura)

    html_str = template.render(
        factura=factura,
        empresa={
            "nombre": settings.EMPRESA_NOMBRE,
            "razon_social": settings.EMPRESA_RAZON_SOCIAL,
            "cuit": settings.EMPRESA_CUIT,
            "direccion": settings.EMPRESA_DIRECCION,
            "condicion_iva": settings.EMPRESA_CONDICION_IVA,
            "iibb": settings.EMPRESA_IIBB,
            "inicio_actividades": settings.EMPRESA_INICIO_ACTIVIDADES,
            "cbu": settings.EMPRESA_CBU,
            "banco": settings.EMPRESA_BANCO,
            "cuenta_titular": settings.EMPRESA_CUENTA_TITULAR or settings.EMPRESA_RAZON_SOCIAL,
            "leyenda_cbu": settings.EMPRESA_LEYENDA_CBU,
        },
        qr_datauri=qr_datauri,
        es_factura_a=factura.letra == "A",
        es_factura_b=factura.letra == "B",
    )

    pdf_bytes = HTML(string=html_str, base_url=TEMPLATES_DIR).write_pdf()
    return pdf_bytes
