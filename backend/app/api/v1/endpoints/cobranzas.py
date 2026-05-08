"""
Endpoints de gestión de cobranzas: aging, dashboard, compensación masiva.
"""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.usuario import Usuario
from app.services import aging_service, aplicacion_pago_service
from app.models.cuenta_corriente import MovimientoCuentaCorriente, TipoMovimientoCC


router = APIRouter()


@router.get("/aging")
def aging_clientes(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Listado de clientes con saldo pendiente, distribuido en buckets de antigüedad."""
    return {
        "clientes": aging_service.aging_por_cliente(db),
        "totales": aging_service.aging_totales(db),
    }


@router.get("/dashboard")
def dashboard_cobranzas(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Métricas resumidas para dashboard de cobranzas."""
    rows = aging_service.aging_por_cliente(db)
    totales = aging_service.aging_totales(db)

    top_deudores = rows[:10]

    vencidas_30plus = (
        totales["buckets"].get("31-60", 0)
        + totales["buckets"].get("61-90", 0)
        + totales["buckets"].get("90+", 0)
    )
    al_dia = totales["buckets"].get("0-30", 0)

    return {
        "total_a_cobrar": totales["total_general"],
        "al_dia": al_dia,
        "vencido": vencidas_30plus,
        "buckets": totales["buckets"],
        "clientes_con_deuda": totales["cantidad_clientes_con_deuda"],
        "top_deudores": top_deudores,
    }


@router.post("/compensar/{cliente_id}")
def compensar_cliente(
    cliente_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Para un cliente, aplica todos sus pagos sin aplicar (anticipos) a sus
    facturas pendientes en orden FIFO. Útil cuando hay anticipos viejos
    huérfanos y facturas nuevas pendientes que se pueden compensar.
    """
    pagos_sin_aplicar = (
        db.query(MovimientoCuentaCorriente)
        .filter(
            MovimientoCuentaCorriente.cliente_id == str(cliente_id),
            MovimientoCuentaCorriente.tipo == TipoMovimientoCC.PAGO.value,
        )
        .order_by(MovimientoCuentaCorriente.fecha_movimiento.asc())
        .all()
    )

    aplicaciones_creadas = 0
    monto_total_aplicado = Decimal("0")

    for pago in pagos_sin_aplicar:
        saldo = aplicacion_pago_service.saldo_a_aplicar_pago(db, pago)
        if saldo <= 0:
            continue
        nuevas = aplicacion_pago_service.aplicar_fifo(
            db, pago, UUID(str(current_user.id))
        )
        for ap in nuevas:
            aplicaciones_creadas += 1
            monto_total_aplicado += Decimal(ap.monto_aplicado)

    db.commit()

    return {
        "aplicaciones_creadas": aplicaciones_creadas,
        "monto_total_aplicado": float(monto_total_aplicado),
        "cliente_id": str(cliente_id),
    }
