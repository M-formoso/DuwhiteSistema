"""
Reporte de antigüedad de saldos (aging).

Distribuye las facturas pendientes de cobro en buckets según los días
transcurridos desde la fecha de emisión (o vencimiento si está informado):
  - Al día: 0-30 días
  - 31-60
  - 61-90
  - +90 (vencidas serias)

Sirve para gestión de cobranzas: identificar deudores antiguos.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Dict, List

from sqlalchemy.orm import Session

from app.models.cliente import Cliente
from app.models.factura import Factura, EstadoFactura, EstadoPago
from app.services import aplicacion_pago_service


BUCKETS = [
    ("0-30", 0, 30),
    ("31-60", 31, 60),
    ("61-90", 61, 90),
    ("90+", 91, 10**6),
]


def _bucket_de_dias(dias: int) -> str:
    if dias <= 30:
        return "0-30"
    if dias <= 60:
        return "31-60"
    if dias <= 90:
        return "61-90"
    return "90+"


def aging_por_cliente(db: Session, hoy: date | None = None) -> List[Dict]:
    """
    Devuelve, por cliente con saldo > 0, los buckets de antigüedad.
    Solo considera facturas autorizadas, no NC/ND, con saldo pendiente > 0.
    """
    hoy = hoy or date.today()

    facturas = (
        db.query(Factura)
        .filter(
            Factura.activo == True,
            Factura.estado == EstadoFactura.AUTORIZADA.value,
            Factura.estado_pago.in_([EstadoPago.SIN_COBRAR.value, EstadoPago.PARCIAL.value]),
        )
        .all()
    )

    por_cliente: Dict[str, Dict] = {}
    for f in facturas:
        if f.es_nota_credito or f.es_nota_debito:
            continue
        pendiente = Decimal(f.total) - Decimal(f.monto_pagado or 0)
        if pendiente <= 0:
            continue

        # Días transcurridos desde la emisión (o vencimiento si está)
        ref_date = f.fecha_vencimiento_pago or f.fecha_emision
        dias = (hoy - ref_date).days if ref_date else 0
        bucket = _bucket_de_dias(max(dias, 0))

        cid = str(f.cliente_id)
        if cid not in por_cliente:
            cliente = db.query(Cliente).filter(Cliente.id == cid).first()
            por_cliente[cid] = {
                "cliente_id": cid,
                "cliente_razon_social": cliente.razon_social if cliente else "Cliente eliminado",
                "cliente_nombre_fantasia": cliente.nombre_fantasia if cliente else None,
                "cuit": cliente.cuit if cliente else None,
                "buckets": {b[0]: Decimal("0") for b in BUCKETS},
                "total": Decimal("0"),
                "facturas_pendientes": 0,
                "factura_mas_vieja_dias": 0,
            }

        por_cliente[cid]["buckets"][bucket] += pendiente
        por_cliente[cid]["total"] += pendiente
        por_cliente[cid]["facturas_pendientes"] += 1
        por_cliente[cid]["factura_mas_vieja_dias"] = max(
            por_cliente[cid]["factura_mas_vieja_dias"], dias
        )

    resultado = sorted(
        por_cliente.values(), key=lambda x: x["total"], reverse=True
    )

    # Convertir Decimals a float para la respuesta JSON
    for r in resultado:
        r["buckets"] = {k: float(v) for k, v in r["buckets"].items()}
        r["total"] = float(r["total"])

    return resultado


def aging_totales(db: Session, hoy: date | None = None) -> Dict:
    """Resumen agregado: totales por bucket en toda la cartera."""
    rows = aging_por_cliente(db, hoy)
    totales = {b[0]: 0.0 for b in BUCKETS}
    total_general = 0.0
    for r in rows:
        for b in totales:
            totales[b] += r["buckets"][b]
        total_general += r["total"]
    return {
        "buckets": totales,
        "total_general": total_general,
        "cantidad_clientes_con_deuda": len(rows),
    }
