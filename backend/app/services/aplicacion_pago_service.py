"""
Servicio de aplicaciones pago↔factura.

Maneja la lógica de aplicar pagos (movimientos de cuenta corriente tipo PAGO)
contra facturas emitidas, manteniendo invariantes de saldos.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.aplicacion_pago import AplicacionPagoFactura
from app.models.cuenta_corriente import MovimientoCuentaCorriente, TipoMovimientoCC
from app.models.factura import Factura, EstadoFactura, EstadoPago


CENTAVO = Decimal("0.01")


def total_aplicado_a_factura(db: Session, factura_id: UUID) -> Decimal:
    val = (
        db.query(func.sum(AplicacionPagoFactura.monto_aplicado))
        .filter(
            AplicacionPagoFactura.factura_id == factura_id,
            AplicacionPagoFactura.activo == True,
        )
        .scalar()
    )
    return Decimal(val or 0)


def total_aplicado_de_pago(db: Session, movimiento_pago_id: UUID) -> Decimal:
    val = (
        db.query(func.sum(AplicacionPagoFactura.monto_aplicado))
        .filter(
            AplicacionPagoFactura.movimiento_pago_id == movimiento_pago_id,
            AplicacionPagoFactura.activo == True,
        )
        .scalar()
    )
    return Decimal(val or 0)


def saldo_pendiente_factura(db: Session, factura: Factura) -> Decimal:
    return Decimal(factura.total) - total_aplicado_a_factura(db, factura.id)


def saldo_a_aplicar_pago(db: Session, movimiento: MovimientoCuentaCorriente) -> Decimal:
    return Decimal(movimiento.monto) - total_aplicado_de_pago(db, movimiento.id)


def _refrescar_factura(db: Session, factura: Factura) -> None:
    """Recalcula monto_pagado y estado_pago de una factura desde sus aplicaciones."""
    aplicado = total_aplicado_a_factura(db, factura.id)
    factura.monto_pagado = aplicado
    factura.fecha_ultimo_cobro = (
        db.query(func.max(AplicacionPagoFactura.fecha_aplicacion))
        .filter(
            AplicacionPagoFactura.factura_id == factura.id,
            AplicacionPagoFactura.activo == True,
        )
        .scalar()
    )

    total = Decimal(factura.total)
    if aplicado >= total - CENTAVO:
        factura.estado_pago = EstadoPago.PAGADA.value
    elif aplicado > 0:
        factura.estado_pago = EstadoPago.PARCIAL.value
    else:
        factura.estado_pago = EstadoPago.SIN_COBRAR.value


def aplicar_pago_a_factura(
    db: Session,
    movimiento_pago_id: UUID,
    factura_id: UUID,
    monto: Decimal,
    usuario_id: UUID,
    automatica: bool = False,
    notas: Optional[str] = None,
    fecha_aplicacion: Optional[date] = None,
) -> AplicacionPagoFactura:
    """
    Aplica `monto` de un pago a una factura. Valida invariantes:
      - El pago debe ser tipo PAGO.
      - Saldo del pago disponible >= monto.
      - Saldo pendiente de factura >= monto.
      - Misma cuenta corriente (mismo cliente).
    """
    monto = Decimal(monto)
    if monto <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El monto a aplicar debe ser > 0.")

    movimiento = (
        db.query(MovimientoCuentaCorriente)
        .filter(MovimientoCuentaCorriente.id == movimiento_pago_id)
        .first()
    )
    if not movimiento:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Movimiento de pago no encontrado.")
    if movimiento.tipo != TipoMovimientoCC.PAGO.value:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El movimiento no es de tipo PAGO.")

    factura = db.query(Factura).filter(Factura.id == factura_id, Factura.activo == True).first()
    if not factura:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Factura no encontrada.")
    if str(factura.cliente_id) != str(movimiento.cliente_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El pago y la factura deben pertenecer al mismo cliente.")
    if factura.estado != EstadoFactura.AUTORIZADA.value:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"La factura debe estar AUTORIZADA (está {factura.estado}).",
        )
    if factura.es_nota_credito or factura.es_nota_debito:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No se aplican pagos a NC/ND.")

    saldo_pago = saldo_a_aplicar_pago(db, movimiento)
    if monto > saldo_pago + CENTAVO:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"El monto excede el saldo a aplicar del pago (disponible: {saldo_pago}).",
        )

    saldo_factura = saldo_pendiente_factura(db, factura)
    if monto > saldo_factura + CENTAVO:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"El monto excede el saldo pendiente de la factura (pendiente: {saldo_factura}).",
        )

    # Si ya existe una aplicación entre este par, sumamos en lugar de violar el unique
    existente = (
        db.query(AplicacionPagoFactura)
        .filter(
            AplicacionPagoFactura.factura_id == factura.id,
            AplicacionPagoFactura.movimiento_pago_id == movimiento.id,
            AplicacionPagoFactura.activo == True,
        )
        .first()
    )
    if existente:
        existente.monto_aplicado = Decimal(existente.monto_aplicado) + monto
        existente.fecha_aplicacion = fecha_aplicacion or date.today()
        if notas:
            existente.notas = ((existente.notas or "") + "\n" + notas).strip()
        aplicacion = existente
    else:
        aplicacion = AplicacionPagoFactura(
            id=uuid.uuid4(),
            factura_id=factura.id,
            movimiento_pago_id=movimiento.id,
            monto_aplicado=monto,
            fecha_aplicacion=fecha_aplicacion or date.today(),
            automatica=automatica,
            notas=notas,
            registrado_por_id=usuario_id,
        )
        db.add(aplicacion)

    db.flush()
    _refrescar_factura(db, factura)

    # Linkear el movimiento_pago a la primera factura aplicada (para drill-down)
    if not movimiento.factura_id:
        movimiento.factura_id = factura.id
        movimiento.factura_numero = factura.numero_completo

    db.flush()
    return aplicacion


def desaplicar(
    db: Session,
    aplicacion_id: UUID,
    usuario_id: UUID,
) -> None:
    aplicacion = (
        db.query(AplicacionPagoFactura)
        .filter(AplicacionPagoFactura.id == aplicacion_id, AplicacionPagoFactura.activo == True)
        .first()
    )
    if not aplicacion:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Aplicación no encontrada.")
    aplicacion.activo = False
    db.flush()
    factura = db.query(Factura).filter(Factura.id == aplicacion.factura_id).first()
    if factura:
        _refrescar_factura(db, factura)


def aplicar_fifo(
    db: Session,
    movimiento_pago: MovimientoCuentaCorriente,
    usuario_id: UUID,
) -> List[AplicacionPagoFactura]:
    """
    Aplica el saldo a aplicar de un pago a las facturas pendientes del mismo
    cliente, en orden FIFO (factura más vieja primero). Marca todas las
    aplicaciones como `automatica=True`.
    """
    saldo = saldo_a_aplicar_pago(db, movimiento_pago)
    if saldo <= 0:
        return []

    facturas_pendientes = (
        db.query(Factura)
        .filter(
            Factura.cliente_id == movimiento_pago.cliente_id,
            Factura.activo == True,
            Factura.estado == EstadoFactura.AUTORIZADA.value,
            Factura.estado_pago.in_([EstadoPago.SIN_COBRAR.value, EstadoPago.PARCIAL.value]),
        )
        .order_by(Factura.fecha_emision.asc(), Factura.created_at.asc())
        .all()
    )

    aplicaciones: List[AplicacionPagoFactura] = []
    for factura in facturas_pendientes:
        if saldo <= 0:
            break
        # NC/ND no son objetivo de cobranza
        if factura.es_nota_credito or factura.es_nota_debito:
            continue
        pendiente = saldo_pendiente_factura(db, factura)
        if pendiente <= 0:
            continue
        a_aplicar = min(saldo, pendiente)
        ap = aplicar_pago_a_factura(
            db,
            movimiento_pago_id=movimiento_pago.id,
            factura_id=factura.id,
            monto=a_aplicar,
            usuario_id=usuario_id,
            automatica=True,
            notas="Aplicación FIFO automática",
        )
        aplicaciones.append(ap)
        saldo -= a_aplicar

    return aplicaciones


def listar_aplicaciones_de_factura(db: Session, factura_id: UUID) -> List[AplicacionPagoFactura]:
    return (
        db.query(AplicacionPagoFactura)
        .filter(
            AplicacionPagoFactura.factura_id == factura_id,
            AplicacionPagoFactura.activo == True,
        )
        .order_by(AplicacionPagoFactura.fecha_aplicacion.asc())
        .all()
    )


def listar_aplicaciones_de_pago(db: Session, movimiento_pago_id: UUID) -> List[AplicacionPagoFactura]:
    return (
        db.query(AplicacionPagoFactura)
        .filter(
            AplicacionPagoFactura.movimiento_pago_id == movimiento_pago_id,
            AplicacionPagoFactura.activo == True,
        )
        .order_by(AplicacionPagoFactura.fecha_aplicacion.asc())
        .all()
    )
