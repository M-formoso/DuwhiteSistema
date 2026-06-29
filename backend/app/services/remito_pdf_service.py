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
# Layout del papel: apaisado, dos hojas idénticas SIDE-BY-SIDE separadas
# por una perforación VERTICAL en el medio. ORIGINAL a la izquierda,
# DUPLICADO a la derecha.
#
# +-------------------------------+-------------------------------+
# |   DUWHITE      |   X RETIRO   |   DUWHITE      |   X RETIRO   |
# |   LAV. IND.    |   FECHA: []  |   LAV. IND.    |   FECHA: []  |
# |   [Caseros 248]              ||   [Caseros 248]              |
# |  +----+-------------------+  ||  +----+-------------------+  |
# |  | CT |     DETALLE       |  ||  | CT |     DETALLE       |  |
# |  | 1  | SABANAS           |  ||  | 1  | SABANAS           |  |
# |  | 2  | FUNDAS            |  ||  | 2  | FUNDAS            |  |
# |  +----+-------------------+  ||  +----+-------------------+  |
# |          ORIGINAL            ||          DUPLICADO           |
# +-------------------------------+-------------------------------+
#                              perforación vertical
#
# Las coordenadas de cada bloque (FECHA, CLIENTE, items) son
# DENTRO de UNA hoja (top-left de la hoja = 0,0).
# Para calibrar imprimí un remito de prueba y ajustá los mm.

PAGE_WIDTH_MM = 330    # 33 cm ancho total del papel
PAGE_HEIGHT_MM = 200   # 20 cm alto total del papel
HOJA_WIDTH_MM = 165    # cada hoja ocupa la mitad horizontal

# --- Cuadro FECHA (dentro del recuadro "X RETIRO" en la zona superior derecha)
COORD_FECHA_TOP_MM = 28
COORD_FECHA_LEFT_MM = 85
COORD_FECHA_WIDTH_MM = 40

# --- Nombre del cliente: dentro del recuadro horizontal que está debajo
#     del header DUWHITE y arriba de la tabla CANTIDAD/DETALLE.
COORD_CLIENTE_TOP_MM = 50
COORD_CLIENTE_LEFT_MM = 5
COORD_CLIENTE_WIDTH_MM = 150

# --- Bloque de ítems (tabla CANTIDAD + DETALLE)
COORD_ITEMS_TOP_MM = 88           # primera fila debajo del header de columnas
COORD_CANTIDAD_LEFT_MM = 4        # margen izquierdo de la columna CANTIDAD
COORD_CANTIDAD_WIDTH_MM = 28
COORD_DETALLE_GAP_MM = 4
COORD_PRECIO_WIDTH_MM = 28        # ancho columna precio (solo si con_precios=True)
COORD_ITEMS_WIDTH_MM = 150        # ancho total CANTIDAD + DETALLE
COORD_ITEMS_HEIGHT_MM = 85        # alto disponible para las filas
COORD_ROW_HEIGHT_MM = 6.5         # alto de cada fila

# Total al pie (solo si con_precios=True)
COORD_TOTAL_TOP_MM = 178
COORD_TOTAL_LEFT_MM = 4
COORD_TOTAL_WIDTH_MM = 150

# Mensaje "+N ítems más" si no entran todos (al pie del bloque)
OVERFLOW_NOTE_TOP_MM = 175

# Número de remito (traza chica, al pie de la hoja)
COORD_NUMERO_TOP_MM = 190
COORD_NUMERO_LEFT_MM = 4


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


def _format_monto(monto) -> str:
    """Formatea monto al estilo plano del papel preimpreso: 1234.00 (sin separador
    de miles, sin signo $, dos decimales con punto). Imita la tira clásica del
    sistema viejo de DUWHITE."""
    try:
        from decimal import Decimal
        d = Decimal(str(monto or 0))
        return f"{d:.2f}"
    except Exception:
        return f"{monto}"


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


def generar_pdf(db: Session, remito: Remito, con_precios: bool = False) -> bytes:
    """Renderiza el remito a PDF y devuelve los bytes.

    Si con_precios=True, agrega columna de subtotal por ítem y el TOTAL al pie.
    """
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
        if det.producto:
            nombre = det.producto.nombre or ""
        if not nombre:
            nombre = det.descripcion or "Producto sin nombre"
        items_visibles.append(
            {
                "cantidad_fmt": _format_cantidad(det.cantidad),
                "nombre": nombre,
                "subtotal_fmt": _format_monto(det.subtotal),
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

    remito_anulado = (remito.estado or "").lower() == "anulado"

    try:
        html_str = template.render(
            remito=remito,
            fecha_formateada=_formatear_fecha(remito.fecha_emision),
            cliente_nombre=cliente_nombre,
            remito_anulado=remito_anulado,
            items_visibles=items_visibles,
            items_overflow=items_overflow,
            copias=["ORIGINAL", "DUPLICADO"],
            con_precios=con_precios,
            total_fmt=_format_monto(remito.total),
            # Coordenadas (mm)
            page_width_mm=PAGE_WIDTH_MM,
            page_height_mm=PAGE_HEIGHT_MM,
            hoja_width_mm=HOJA_WIDTH_MM,
            coord_fecha_top_mm=COORD_FECHA_TOP_MM,
            coord_fecha_left_mm=COORD_FECHA_LEFT_MM,
            coord_fecha_width_mm=COORD_FECHA_WIDTH_MM,
            coord_items_top_mm=COORD_ITEMS_TOP_MM,
            coord_cantidad_left_mm=COORD_CANTIDAD_LEFT_MM,
            coord_cantidad_width_mm=COORD_CANTIDAD_WIDTH_MM,
            coord_detalle_gap_mm=COORD_DETALLE_GAP_MM,
            coord_precio_width_mm=COORD_PRECIO_WIDTH_MM,
            coord_items_width_mm=COORD_ITEMS_WIDTH_MM,
            coord_items_height_mm=COORD_ITEMS_HEIGHT_MM,
            coord_row_height_mm=COORD_ROW_HEIGHT_MM,
            overflow_note_top_mm=OVERFLOW_NOTE_TOP_MM,
            coord_cliente_top_mm=COORD_CLIENTE_TOP_MM,
            coord_cliente_left_mm=COORD_CLIENTE_LEFT_MM,
            coord_cliente_width_mm=COORD_CLIENTE_WIDTH_MM,
            coord_numero_top_mm=COORD_NUMERO_TOP_MM,
            coord_numero_left_mm=COORD_NUMERO_LEFT_MM,
            coord_total_top_mm=COORD_TOTAL_TOP_MM,
            coord_total_left_mm=COORD_TOTAL_LEFT_MM,
            coord_total_width_mm=COORD_TOTAL_WIDTH_MM,
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
