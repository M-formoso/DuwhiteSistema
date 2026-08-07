"""
PDF de Lista de Precios (para enviar a clientes).
"""

from __future__ import annotations

import os
from datetime import datetime
from decimal import Decimal
from typing import List
from uuid import UUID

from fastapi import HTTPException, status
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.lista_precios import ListaPrecios
from app.models.producto_lavado import PrecioProductoLavado, ProductoLavado


TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")

CATEGORIAS_LABEL = {
    "toallas": "Toallas",
    "ropa_cama": "Ropa de Cama",
    "manteleria": "Mantelería",
    "alfombras": "Alfombras",
    "cortinas": "Cortinas",
    "otros": "Otros",
}


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


def generar_pdf(db: Session, lista_id: UUID) -> tuple[bytes, str]:
    """
    Genera el PDF de una lista de precios.
    Retorna (bytes, filename).
    """
    try:
        from weasyprint import HTML
    except ImportError as exc:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"WeasyPrint no disponible: {exc}",
        )

    lista = db.query(ListaPrecios).filter(ListaPrecios.id == str(lista_id)).first()
    if not lista:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lista de precios no encontrada")

    # Cargar precios activos con producto asociado.
    precios: List[PrecioProductoLavado] = (
        db.query(PrecioProductoLavado)
        .join(ProductoLavado, PrecioProductoLavado.producto_id == ProductoLavado.id)
        .filter(
            PrecioProductoLavado.lista_precios_id == str(lista_id),
            PrecioProductoLavado.activo.is_(True),
            ProductoLavado.activo.is_(True),
        )
        .order_by(ProductoLavado.categoria, ProductoLavado.nombre)
        .all()
    )

    # Agrupar por categoría.
    grupos_map: dict = {}
    for p in precios:
        prod = p.producto
        if prod is None:
            continue
        cat_key = prod.categoria or "otros"
        if cat_key not in grupos_map:
            grupos_map[cat_key] = {
                "categoria_key": cat_key,
                "categoria_label": CATEGORIAS_LABEL.get(cat_key, cat_key.replace("_", " ").title()),
                "items": [],
            }
        grupos_map[cat_key]["items"].append({
            "codigo": prod.codigo,
            "nombre": prod.nombre,
            "descripcion": prod.descripcion,
            "peso_promedio_kg": float(prod.peso_promedio_kg) if prod.peso_promedio_kg else None,
            "precio": p.precio_unitario,
        })

    # Orden estable de categorías: usar el orden del enum.
    orden_cat = ["toallas", "ropa_cama", "manteleria", "alfombras", "cortinas", "otros"]
    grupos = [grupos_map[k] for k in orden_cat if k in grupos_map]
    # Categorías fuera del enum (por si acaso).
    for k, v in grupos_map.items():
        if k not in orden_cat:
            grupos.append(v)

    env = _get_env()
    template = env.get_template("lista_precios.html")
    html_str = template.render(
        lista=lista,
        empresa={
            "nombre": settings.EMPRESA_NOMBRE,
            "razon_social": settings.EMPRESA_RAZON_SOCIAL,
            "cuit": settings.EMPRESA_CUIT,
            "direccion": settings.EMPRESA_DIRECCION,
            "condicion_iva": settings.EMPRESA_CONDICION_IVA,
            "email": settings.EMAIL_FROM,
        },
        grupos=grupos,
        total_items=len(precios),
        generado_at=datetime.now().strftime("%d/%m/%Y %H:%M"),
    )
    pdf_bytes = HTML(string=html_str, base_url=TEMPLATES_DIR).write_pdf()

    # Nombre de archivo amigable.
    slug = lista.codigo.strip().replace(" ", "_") or "lista_precios"
    filename = f"lista_precios_{slug}.pdf"
    return pdf_bytes, filename
