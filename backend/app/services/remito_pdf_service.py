"""
Servicio de generación de PDF para Remito X RETIRO.

Imprime los datos variables (fecha, cantidad, descripción) en las
posiciones exactas del papel preimpreso DUWHITE (formato 33cm × 20cm
apaisado, 2 hojas idénticas por hoja física separadas por perforación
horizontal: ORIGINAL arriba, DUPLICADO abajo).

Si el papel sale corrido al imprimir, ajustar las constantes COORD_*
de este archivo. Están todas declaradas explícitamente para facilitar
la calibración fina sin tocar el HTML.
"""

import logging
import os
from datetime import date
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.remito import Remito

logger = logging.getLogger(__name__)

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")


# ==================== COORDENADAS DEL PAPEL PREIMPRESO ====================
#
# Medidas del papel completo (apaisado, 2 hojas unidas por perforación
# horizontal). Si el formato cambia, ajustar acá.

PAGE_WIDTH_MM = 330   # 33 cm ancho total
PAGE_HEIGHT_MM = 200  # 20 cm alto total
HOJA_HEIGHT_MM = 100  # alto de cada hoja (mitad)

# Posición del cuadro FECHA dentro de cada hoja (medido desde top-left
# de la hoja). Está sobre el cuadrito a la derecha donde dice "FECHA".
COORD_FECHA_TOP_MM = 70     # bajo desde el borde superior de la hoja
COORD_FECHA_LEFT_MM = 282   # cuadro a la derecha del cuerpo
COORD_FECHA_WIDTH_MM = 40

# Posición del bloque de ítems (cantidad + detalle).
# Empieza en la parte de arriba del cuerpo, justo debajo del título.
COORD_ITEMS_TOP_MM = 20
COORD_CANTIDAD_LEFT_MM = 8   # columna CANTIDAD (margen izquierdo)
COORD_CANTIDAD_WIDTH_MM = 28
COORD_DETALLE_GAP_MM = 4     # gap horizontal entre cantidad y detalle
COORD_ITEMS_WIDTH_MM = 268   # ancho disponible para cantidad+detalle
COORD_ITEMS_HEIGHT_MM = 70   # alto disponible para la lista

# Altura de cada fila — afecta cuántos ítems entran.
COORD_ROW_HEIGHT_MM = 6

# Mensaje "+N ítems más" si no entran todos.
OVERFLOW_NOTE_TOP_MM = 92

# Nombre del cliente — pequeño, en la parte superior izquierda.
COORD_CLIENTE_TOP_MM = 11
COORD_CLIENTE_LEFT_MM = 8
COORD_CLIENTE_WIDTH_MM = 220

# Número de remito (chiquito, abajo a la izquierda como traza interna).
COORD_NUMERO_TOP_MM = 93
COORD_NUMERO_LEFT_MM = 8


def _cantidad_para_mostrar() -> int:
    """Cuántos ítems entran físicamente en una hoja."""
    return max(1, int(COORD_ITEMS_HEIGHT_MM // COORD_ROW_HEIGHT_MM))


def _format_cantidad(cantidad) -> str:
    """Formatea cantidad: enteros sin decimales, fraccionales con coma."""
    try:
        from decimal import Decimal
        d = Decimal(str(cantidad))
        if d == d.to_integral_value():
            return str(int(d))
        return f"{d:.2f}".replace(".", ",").rstrip("0").rstrip(",")
    except Exception:
        return str(cantidad)


def _formatear_fecha(d: Optional[date]) -> str:
    if not d:
        return ""
    return d.strftime("%d/%m/%Y")


def _get_env():
    try:
        from jinja2 import Environment, FileSystemLoader, select_autoescape
    except ImportError as exc:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Jinja2 no disponible: {exc}",
        )
    return Environment(
        loader=FileSystemLoader(TEMPLATES_DIR),
        autoescape=select_autoescape(["html", "xml"]),
    )


def generar_pdf(db: Session, remito: Remito) -> bytes:
    """Renderiza el remito a PDF y devuelve los bytes."""
    try:
        from weasyprint import HTML
    except ImportError as exc:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"WeasyPrint no disponible: {exc}",
        )

    env = _get_env()
    template = env.get_template("remito.html")

    max_items = _cantidad_para_mostrar()
    detalles = list(remito.detalles or [])

    items_visibles = []
    for det in detalles[:max_items]:
        nombre = ""
        codigo = ""
        if det.producto:
            nombre = det.producto.nombre or ""
            codigo = det.producto.codigo or ""
        if not nombre:
            nombre = det.descripcion or "Producto sin nombre"
        items_visibles.append(
            {
                "cantidad_fmt": _format_cantidad(det.cantidad),
                "nombre": nombre,
                "codigo": codigo,
            }
        )

    items_overflow = max(0, len(detalles) - max_items)

    cliente_nombre = ""
    if remito.cliente:
        cliente_nombre = (
            remito.cliente.razon_social
            or getattr(remito.cliente, "nombre", "")
            or ""
        )

    try:
        html_str = template.render(
            remito=remito,
            fecha_formateada=_formatear_fecha(remito.fecha_emision),
            cliente_nombre=cliente_nombre,
            items_visibles=items_visibles,
            items_overflow=items_overflow,
            copias=["ORIGINAL", "DUPLICADO"],
            # Coordenadas (mm)
            page_width_mm=PAGE_WIDTH_MM,
            page_height_mm=PAGE_HEIGHT_MM,
            hoja_height_mm=HOJA_HEIGHT_MM,
            coord_fecha_top_mm=COORD_FECHA_TOP_MM,
            coord_fecha_left_mm=COORD_FECHA_LEFT_MM,
            coord_fecha_width_mm=COORD_FECHA_WIDTH_MM,
            coord_items_top_mm=COORD_ITEMS_TOP_MM,
            coord_cantidad_left_mm=COORD_CANTIDAD_LEFT_MM,
            coord_cantidad_width_mm=COORD_CANTIDAD_WIDTH_MM,
            coord_detalle_gap_mm=COORD_DETALLE_GAP_MM,
            coord_items_width_mm=COORD_ITEMS_WIDTH_MM,
            coord_items_height_mm=COORD_ITEMS_HEIGHT_MM,
            coord_row_height_mm=COORD_ROW_HEIGHT_MM,
            overflow_note_top_mm=OVERFLOW_NOTE_TOP_MM,
            coord_cliente_top_mm=COORD_CLIENTE_TOP_MM,
            coord_cliente_left_mm=COORD_CLIENTE_LEFT_MM,
            coord_cliente_width_mm=COORD_CLIENTE_WIDTH_MM,
            coord_numero_top_mm=COORD_NUMERO_TOP_MM,
            coord_numero_left_mm=COORD_NUMERO_LEFT_MM,
        )
    except Exception as exc:
        logger.exception(
            "Error renderizando template remito.html para remito %s", remito.id
        )
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al renderizar template: {exc}",
        )

    try:
        pdf_bytes = HTML(string=html_str, base_url=TEMPLATES_DIR).write_pdf()
    except Exception as exc:
        logger.exception("WeasyPrint falló al generar PDF para remito %s", remito.id)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al renderizar PDF (WeasyPrint): {exc}",
        )
    return pdf_bytes
