"""
PDF de Lista de Precios (para enviar a clientes).
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from decimal import Decimal
from typing import List
from uuid import UUID

from fastapi import HTTPException, status
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.timezone import now_ar
from app.models.lista_precios import ListaPrecios
from app.models.producto_lavado import PrecioProductoLavado, ProductoLavado


logger = logging.getLogger(__name__)

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")

CATEGORIAS_LABEL = {
    "toallas": "Toallas",
    "ropa_cama": "Ropa de Cama",
    "manteleria": "Mantelería",
    "alfombras": "Alfombras",
    "cortinas": "Cortinas",
    "otros": "Otros",
}

# Alícuota IVA general (RG 21%). Si en el futuro se soportan alícuotas
# diferenciadas por lista, mover a columna en `listas_precios`.
ALICUOTA_IVA_DEFAULT = Decimal("21.00")


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


def generar_pdf(
    db: Session,
    lista_id: UUID,
    producto_ids: List[UUID] | None = None,
) -> tuple[bytes, str]:
    """
    Genera el PDF de una lista de precios.

    Si ``producto_ids`` se pasa (no vacío), sólo incluye esos productos.
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

    lista = db.query(ListaPrecios).filter(ListaPrecios.id == str(lista_id)).first()
    if not lista:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lista de precios no encontrada")

    logger.info("Generando PDF de lista %s (%s)", lista.codigo, lista_id)

    try:
        # Cargar precios activos con producto asociado.
        query = (
            db.query(PrecioProductoLavado)
            .join(ProductoLavado, PrecioProductoLavado.producto_id == ProductoLavado.id)
            .filter(
                PrecioProductoLavado.lista_precios_id == str(lista_id),
                PrecioProductoLavado.activo.is_(True),
                ProductoLavado.activo.is_(True),
            )
        )
        if producto_ids:
            query = query.filter(
                PrecioProductoLavado.producto_id.in_([str(pid) for pid in producto_ids])
            )
        precios: List[PrecioProductoLavado] = query.all()
    except Exception:
        logger.exception("Error cargando precios de la lista %s", lista_id)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error cargando precios de la lista",
        )

    # IVA: si la lista lo incluye, aplicamos la alícuota al precio mostrado.
    incluye_iva = bool(getattr(lista, "incluye_iva", False))
    alicuota_iva = ALICUOTA_IVA_DEFAULT
    factor_iva = (Decimal("1") + alicuota_iva / Decimal("100")) if incluye_iva else Decimal("1")

    # Lista plana ordenada por código numérico ascendente (cae al alfabético
    # si el código no es puramente numérico), sin agrupar por categoría.
    def _sort_key(p: PrecioProductoLavado):
        codigo = (p.producto.codigo if p.producto else "") or ""
        limpio = codigo.strip()
        if limpio.isdigit():
            return (0, int(limpio), "")
        return (1, 0, limpio.lower())

    precios_ordenados = sorted(
        [p for p in precios if p.producto is not None],
        key=_sort_key,
    )
    productos_out: list[dict] = []
    for p in precios_ordenados:
        prod = p.producto
        precio_base = Decimal(p.precio_unitario or 0)
        precio_display = (precio_base * factor_iva).quantize(Decimal("0.01"))
        productos_out.append({
            "codigo": prod.codigo,
            "nombre": prod.nombre,
            "descripcion": prod.descripcion,
            "peso_promedio_kg": float(prod.peso_promedio_kg) if prod.peso_promedio_kg else None,
            "precio": precio_display,
        })

    try:
        from app.services import configuracion_service
        env = _get_env()
        template = env.get_template("lista_precios.html")
        html_str = template.render(
            lista=lista,
            empresa=configuracion_service.get_empresa_dict(db),
            productos=productos_out,
            total_items=len(productos_out),
            generado_at=now_ar().strftime("%d/%m/%Y %H:%M"),
            iva={
                "incluido": incluye_iva,
                "alicuota": alicuota_iva,
            },
        )
    except Exception as exc:
        logger.exception("Error renderizando template lista_precios.html")
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al renderizar template: {exc}",
        )

    try:
        pdf_bytes = HTML(string=html_str, base_url=TEMPLATES_DIR).write_pdf()
    except Exception as exc:
        logger.exception("WeasyPrint falló al generar PDF para lista %s", lista_id)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al renderizar PDF (WeasyPrint): {exc}",
        )

    # Nombre de archivo amigable.
    slug = (lista.codigo or "lista_precios").strip().replace(" ", "_")
    filename = f"lista_precios_{slug}.pdf"
    return pdf_bytes, filename
