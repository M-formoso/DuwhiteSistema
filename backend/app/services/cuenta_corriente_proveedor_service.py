"""
Servicio de Cuenta Corriente de Proveedores.
"""

from datetime import date
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.cuenta_corriente_proveedor import (
    MovimientoCuentaCorrienteProveedor,
    TipoMovimientoCCProveedor,
    ImputacionPagoProveedor,
)
from app.models.proveedor import Proveedor
from app.schemas.cuenta_corriente_proveedor import (
    RegistrarCargoProveedorRequest,
    EstadoCuentaProveedorResponse,
    ComprobanteVencimiento,
    AnalisisVencimientosResponse,
)


class CuentaCorrienteProveedorService:
    """Servicio para gestión de CC de proveedores."""

    def __init__(self, db: Session):
        self.db = db

    def get_saldo_actual(self, proveedor_id: str) -> Decimal:
        """Obtiene el saldo actual de un proveedor."""
        proveedor = self.db.query(Proveedor).filter(Proveedor.id == proveedor_id).first()
        return proveedor.saldo_cuenta_corriente if proveedor else Decimal("0")

    def get_movimientos(
        self,
        proveedor_id: str,
        skip: int = 0,
        limit: int = 50,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
        tipo: Optional[str] = None,
        solo_pendientes: bool = False,
    ) -> Tuple[List[MovimientoCuentaCorrienteProveedor], int]:
        """Obtiene movimientos de CC de un proveedor."""
        query = self.db.query(MovimientoCuentaCorrienteProveedor).filter(
            MovimientoCuentaCorrienteProveedor.proveedor_id == proveedor_id
        )

        if fecha_desde:
            query = query.filter(MovimientoCuentaCorrienteProveedor.fecha_movimiento >= fecha_desde)
        if fecha_hasta:
            query = query.filter(MovimientoCuentaCorrienteProveedor.fecha_movimiento <= fecha_hasta)
        if tipo:
            query = query.filter(MovimientoCuentaCorrienteProveedor.tipo == tipo)
        if solo_pendientes:
            query = query.filter(MovimientoCuentaCorrienteProveedor.saldo_comprobante > 0)

        total = query.count()
        movimientos = query.order_by(
            MovimientoCuentaCorrienteProveedor.fecha_movimiento.desc(),
            MovimientoCuentaCorrienteProveedor.created_at.desc()
        ).offset(skip).limit(limit).all()

        return movimientos, total

    def get_comprobantes_pendientes(
        self,
        proveedor_id: str,
    ) -> List[MovimientoCuentaCorrienteProveedor]:
        """Obtiene comprobantes (cargos) con saldo pendiente de un proveedor."""
        return self.db.query(MovimientoCuentaCorrienteProveedor).filter(
            MovimientoCuentaCorrienteProveedor.proveedor_id == proveedor_id,
            MovimientoCuentaCorrienteProveedor.tipo == TipoMovimientoCCProveedor.CARGO.value,
            MovimientoCuentaCorrienteProveedor.saldo_comprobante > 0,
        ).order_by(
            MovimientoCuentaCorrienteProveedor.fecha_vencimiento.asc().nullslast(),
            MovimientoCuentaCorrienteProveedor.fecha_movimiento.asc(),
        ).all()

    def registrar_cargo(
        self,
        proveedor_id: str,
        monto: Decimal,
        concepto: str,
        fecha_movimiento: date,
        usuario_id: str,
        factura_numero: Optional[str] = None,
        factura_fecha: Optional[date] = None,
        fecha_vencimiento: Optional[date] = None,
        orden_compra_id: Optional[str] = None,
        recepcion_compra_id: Optional[str] = None,
        notas: Optional[str] = None,
    ) -> MovimientoCuentaCorrienteProveedor:
        """Registra un cargo (factura) en la CC del proveedor."""
        proveedor = self.db.query(Proveedor).filter(Proveedor.id == proveedor_id).first()
        if not proveedor:
            raise ValueError("Proveedor no encontrado")

        saldo_anterior = proveedor.saldo_cuenta_corriente
        saldo_posterior = saldo_anterior + monto

        movimiento = MovimientoCuentaCorrienteProveedor(
            id=str(uuid4()),
            proveedor_id=proveedor_id,
            tipo=TipoMovimientoCCProveedor.CARGO.value,
            concepto=concepto,
            monto=monto,
            saldo_anterior=saldo_anterior,
            saldo_posterior=saldo_posterior,
            saldo_comprobante=monto,  # Inicialmente el saldo pendiente es el monto total
            fecha_movimiento=fecha_movimiento,
            fecha_vencimiento=fecha_vencimiento,
            factura_numero=factura_numero,
            factura_fecha=factura_fecha,
            orden_compra_id=orden_compra_id,
            recepcion_compra_id=recepcion_compra_id,
            registrado_por_id=usuario_id,
            notas=notas,
        )

        self.db.add(movimiento)
        proveedor.saldo_cuenta_corriente = saldo_posterior

        self.db.commit()
        self.db.refresh(movimiento)

        return movimiento

    def registrar_pago(
        self,
        proveedor_id: str,
        monto: Decimal,
        concepto: str,
        fecha_movimiento: date,
        usuario_id: str,
        orden_pago_id: Optional[str] = None,
        notas: Optional[str] = None,
    ) -> MovimientoCuentaCorrienteProveedor:
        """Registra un pago en la CC del proveedor."""
        proveedor = self.db.query(Proveedor).filter(Proveedor.id == proveedor_id).first()
        if not proveedor:
            raise ValueError("Proveedor no encontrado")

        saldo_anterior = proveedor.saldo_cuenta_corriente
        saldo_posterior = saldo_anterior - monto

        movimiento = MovimientoCuentaCorrienteProveedor(
            id=str(uuid4()),
            proveedor_id=proveedor_id,
            tipo=TipoMovimientoCCProveedor.PAGO.value,
            concepto=concepto,
            monto=monto,
            saldo_anterior=saldo_anterior,
            saldo_posterior=saldo_posterior,
            saldo_comprobante=Decimal("0"),  # Los pagos no tienen saldo pendiente
            fecha_movimiento=fecha_movimiento,
            orden_pago_id=orden_pago_id,
            registrado_por_id=usuario_id,
            notas=notas,
        )

        self.db.add(movimiento)
        proveedor.saldo_cuenta_corriente = saldo_posterior

        self.db.commit()
        self.db.refresh(movimiento)

        return movimiento

    def registrar_ajuste(
        self,
        proveedor_id: str,
        monto: Decimal,
        concepto: str,
        fecha_movimiento: date,
        usuario_id: str,
        es_a_favor: bool = False,  # True = disminuye deuda, False = aumenta
        notas: Optional[str] = None,
    ) -> MovimientoCuentaCorrienteProveedor:
        """Registra un ajuste en la CC del proveedor."""
        proveedor = self.db.query(Proveedor).filter(Proveedor.id == proveedor_id).first()
        if not proveedor:
            raise ValueError("Proveedor no encontrado")

        saldo_anterior = proveedor.saldo_cuenta_corriente
        if es_a_favor:
            saldo_posterior = saldo_anterior - monto
        else:
            saldo_posterior = saldo_anterior + monto

        movimiento = MovimientoCuentaCorrienteProveedor(
            id=str(uuid4()),
            proveedor_id=proveedor_id,
            tipo=TipoMovimientoCCProveedor.AJUSTE.value,
            concepto=concepto,
            monto=monto,
            saldo_anterior=saldo_anterior,
            saldo_posterior=saldo_posterior,
            saldo_comprobante=Decimal("0"),
            fecha_movimiento=fecha_movimiento,
            registrado_por_id=usuario_id,
            notas=notas,
        )

        self.db.add(movimiento)
        proveedor.saldo_cuenta_corriente = saldo_posterior

        self.db.commit()
        self.db.refresh(movimiento)

        return movimiento

    def imputar_pago_a_comprobante(
        self,
        movimiento_cargo_id: str,
        monto_a_imputar: Decimal,
        orden_pago_id: str,
        usuario_id: str,
    ) -> ImputacionPagoProveedor:
        """Imputa un monto de pago a un comprobante específico."""
        movimiento_cargo = self.db.query(MovimientoCuentaCorrienteProveedor).filter(
            MovimientoCuentaCorrienteProveedor.id == movimiento_cargo_id
        ).first()

        if not movimiento_cargo:
            raise ValueError("Comprobante no encontrado")

        if monto_a_imputar > movimiento_cargo.saldo_comprobante:
            raise ValueError(
                f"El monto a imputar (${monto_a_imputar}) supera el saldo pendiente "
                f"del comprobante (${movimiento_cargo.saldo_comprobante})"
            )

        # Actualizar saldo del comprobante
        movimiento_cargo.saldo_comprobante -= monto_a_imputar

        # Crear registro de imputación
        imputacion = ImputacionPagoProveedor(
            id=str(uuid4()),
            movimiento_cargo_id=movimiento_cargo_id,
            orden_pago_id=orden_pago_id,
            monto_imputado=monto_a_imputar,
            fecha_imputacion=date.today(),
            imputado_por_id=usuario_id,
        )

        self.db.add(imputacion)
        self.db.commit()
        self.db.refresh(imputacion)

        return imputacion

    def get_estado_cuenta(self, proveedor_id: str) -> EstadoCuentaProveedorResponse:
        """Obtiene resumen del estado de cuenta de un proveedor."""
        proveedor = self.db.query(Proveedor).filter(Proveedor.id == proveedor_id).first()
        if not proveedor:
            raise ValueError("Proveedor no encontrado")

        hoy = date.today()
        inicio_mes = hoy.replace(day=1)

        # Total facturado del mes
        total_facturado = self.db.query(func.sum(MovimientoCuentaCorrienteProveedor.monto)).filter(
            MovimientoCuentaCorrienteProveedor.proveedor_id == proveedor_id,
            MovimientoCuentaCorrienteProveedor.tipo == TipoMovimientoCCProveedor.CARGO.value,
            MovimientoCuentaCorrienteProveedor.fecha_movimiento >= inicio_mes,
        ).scalar() or Decimal("0")

        # Total pagado del mes
        total_pagado = self.db.query(func.sum(MovimientoCuentaCorrienteProveedor.monto)).filter(
            MovimientoCuentaCorrienteProveedor.proveedor_id == proveedor_id,
            MovimientoCuentaCorrienteProveedor.tipo == TipoMovimientoCCProveedor.PAGO.value,
            MovimientoCuentaCorrienteProveedor.fecha_movimiento >= inicio_mes,
        ).scalar() or Decimal("0")

        # Facturas pendientes
        facturas_pendientes = self.db.query(MovimientoCuentaCorrienteProveedor).filter(
            MovimientoCuentaCorrienteProveedor.proveedor_id == proveedor_id,
            MovimientoCuentaCorrienteProveedor.tipo == TipoMovimientoCCProveedor.CARGO.value,
            MovimientoCuentaCorrienteProveedor.saldo_comprobante > 0,
        ).all()

        cantidad_pendientes = len(facturas_pendientes)

        # Factura más antigua
        factura_mas_antigua_dias = None
        if facturas_pendientes:
            fecha_mas_antigua = min(f.fecha_movimiento for f in facturas_pendientes)
            factura_mas_antigua_dias = (hoy - fecha_mas_antigua).days

        # Desglose por antigüedad
        deuda_por_rango = self._calcular_deuda_por_antiguedad(proveedor_id)

        return EstadoCuentaProveedorResponse(
            proveedor_id=str(proveedor.id),
            proveedor_nombre=proveedor.nombre_display,
            saldo_actual=proveedor.saldo_cuenta_corriente,
            total_facturado_mes=total_facturado,
            total_pagado_mes=total_pagado,
            cantidad_facturas_pendientes=cantidad_pendientes,
            factura_mas_antigua_dias=factura_mas_antigua_dias,
            deuda_0_30_dias=deuda_por_rango["0-30"],
            deuda_30_60_dias=deuda_por_rango["30-60"],
            deuda_60_90_dias=deuda_por_rango["60-90"],
            deuda_mas_90_dias=deuda_por_rango["90+"],
        )

    def _calcular_deuda_por_antiguedad(self, proveedor_id: str) -> dict:
        """Calcula deuda agrupada por rangos de antigüedad."""
        hoy = date.today()
        rangos = {
            "0-30": Decimal("0"),
            "30-60": Decimal("0"),
            "60-90": Decimal("0"),
            "90+": Decimal("0")
        }

        facturas_pendientes = self.db.query(MovimientoCuentaCorrienteProveedor).filter(
            MovimientoCuentaCorrienteProveedor.proveedor_id == proveedor_id,
            MovimientoCuentaCorrienteProveedor.tipo == TipoMovimientoCCProveedor.CARGO.value,
            MovimientoCuentaCorrienteProveedor.saldo_comprobante > 0,
        ).all()

        for factura in facturas_pendientes:
            fecha_ref = factura.fecha_vencimiento or factura.fecha_movimiento
            dias = (hoy - fecha_ref).days

            if dias <= 30:
                rangos["0-30"] += factura.saldo_comprobante
            elif dias <= 60:
                rangos["30-60"] += factura.saldo_comprobante
            elif dias <= 90:
                rangos["60-90"] += factura.saldo_comprobante
            else:
                rangos["90+"] += factura.saldo_comprobante

        return rangos

    def get_analisis_vencimientos(
        self,
        proveedor_id: Optional[str] = None,
        fecha_corte: Optional[date] = None,
    ) -> AnalisisVencimientosResponse:
        """Obtiene análisis completo de vencimientos de todos los proveedores o uno específico."""
        hoy = fecha_corte or date.today()

        query = self.db.query(MovimientoCuentaCorrienteProveedor).filter(
            MovimientoCuentaCorrienteProveedor.tipo == TipoMovimientoCCProveedor.CARGO.value,
            MovimientoCuentaCorrienteProveedor.saldo_comprobante > 0,
        )

        if proveedor_id:
            query = query.filter(MovimientoCuentaCorrienteProveedor.proveedor_id == proveedor_id)

        facturas = query.all()

        # Inicializar totales
        total_deuda = Decimal("0")
        total_por_vencer = Decimal("0")
        total_vencido = Decimal("0")
        rangos = {
            "0-30": Decimal("0"),
            "30-60": Decimal("0"),
            "60-90": Decimal("0"),
            "90+": Decimal("0")
        }
        comprobantes = []

        for factura in facturas:
            fecha_ref = factura.fecha_vencimiento or factura.fecha_movimiento
            dias = (hoy - fecha_ref).days
            saldo = factura.saldo_comprobante

            total_deuda += saldo

            if dias > 0:
                total_vencido += saldo
            else:
                total_por_vencer += saldo

            # Clasificar en rango
            if dias <= 30:
                rango = "0-30"
            elif dias <= 60:
                rango = "30-60"
            elif dias <= 90:
                rango = "60-90"
            else:
                rango = "90+"

            rangos[rango] += saldo

            comprobantes.append(ComprobanteVencimiento(
                id=str(factura.id),
                proveedor_id=str(factura.proveedor_id),
                proveedor_nombre=factura.proveedor.nombre_display,
                tipo=factura.tipo,
                factura_numero=factura.factura_numero,
                monto_original=factura.monto,
                saldo_pendiente=saldo,
                fecha_movimiento=factura.fecha_movimiento,
                fecha_vencimiento=factura.fecha_vencimiento,
                dias_vencimiento=dias,
                rango_antiguedad=rango,
            ))

        # Ordenar por días de vencimiento (más vencido primero)
        comprobantes.sort(key=lambda x: x.dias_vencimiento, reverse=True)

        return AnalisisVencimientosResponse(
            fecha_analisis=hoy,
            total_deuda=total_deuda,
            total_por_vencer=total_por_vencer,
            total_vencido=total_vencido,
            rango_0_30=rangos["0-30"],
            rango_30_60=rangos["30-60"],
            rango_60_90=rangos["60-90"],
            rango_90_mas=rangos["90+"],
            comprobantes=comprobantes,
        )
