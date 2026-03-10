"""
Servicio de Órdenes de Pago.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.cuenta_corriente_proveedor import (
    OrdenPago,
    DetalleOrdenPago,
    EstadoOrdenPago,
    MovimientoCuentaCorrienteProveedor,
)
from app.models.proveedor import Proveedor
from app.models.caja import MovimientoCaja, TipoMovimientoCaja, Caja, EstadoCaja
from app.models.cuenta_bancaria import MovimientoBancario, CuentaBancaria
from app.services.cuenta_corriente_proveedor_service import CuentaCorrienteProveedorService
from app.schemas.orden_pago import (
    OrdenPagoCreate,
    OrdenPagoUpdate,
    PagarOrdenPagoRequest,
)


class OrdenPagoService:
    """Servicio para gestión de Órdenes de Pago."""

    def __init__(self, db: Session):
        self.db = db
        self.cc_service = CuentaCorrienteProveedorService(db)

    def _generar_numero(self) -> str:
        """Genera número de OP: OP-YYYY-XXXXX."""
        anio = date.today().year
        ultimo = self.db.query(func.max(OrdenPago.numero)).filter(
            OrdenPago.numero.like(f"OP-{anio}-%")
        ).scalar()

        if ultimo:
            ultimo_num = int(ultimo.split("-")[-1])
            nuevo_num = ultimo_num + 1
        else:
            nuevo_num = 1

        return f"OP-{anio}-{nuevo_num:05d}"

    def get_ordenes_pago(
        self,
        skip: int = 0,
        limit: int = 20,
        proveedor_id: Optional[str] = None,
        estado: Optional[str] = None,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
        incluir_anuladas: bool = False,
    ) -> Tuple[List[OrdenPago], int]:
        """Obtiene lista de órdenes de pago."""
        query = self.db.query(OrdenPago)

        if not incluir_anuladas:
            query = query.filter(OrdenPago.anulado == False)

        if proveedor_id:
            query = query.filter(OrdenPago.proveedor_id == proveedor_id)
        if estado:
            query = query.filter(OrdenPago.estado == estado)
        if fecha_desde:
            query = query.filter(OrdenPago.fecha_emision >= fecha_desde)
        if fecha_hasta:
            query = query.filter(OrdenPago.fecha_emision <= fecha_hasta)

        total = query.count()
        ordenes = query.order_by(OrdenPago.fecha_emision.desc()).offset(skip).limit(limit).all()

        return ordenes, total

    def get_orden_pago(self, orden_id: str) -> Optional[OrdenPago]:
        """Obtiene una orden de pago por ID."""
        return self.db.query(OrdenPago).filter(OrdenPago.id == orden_id).first()

    def get_orden_por_numero(self, numero: str) -> Optional[OrdenPago]:
        """Obtiene una orden de pago por número."""
        return self.db.query(OrdenPago).filter(OrdenPago.numero == numero).first()

    def crear_orden_pago(
        self,
        data: OrdenPagoCreate,
        usuario_id: str,
    ) -> OrdenPago:
        """Crea una nueva orden de pago."""
        # Validar proveedor
        proveedor = self.db.query(Proveedor).filter(Proveedor.id == data.proveedor_id).first()
        if not proveedor:
            raise ValueError("Proveedor no encontrado")

        # Validar que los movimientos existen y tienen saldo
        monto_total = Decimal("0")
        detalles_validados = []
        numero_linea = 1

        for detalle in data.detalles:
            movimiento = self.db.query(MovimientoCuentaCorrienteProveedor).filter(
                MovimientoCuentaCorrienteProveedor.id == detalle.movimiento_id
            ).first()

            if not movimiento:
                raise ValueError(f"Movimiento {detalle.movimiento_id} no encontrado")

            if movimiento.proveedor_id != data.proveedor_id:
                raise ValueError(f"El movimiento {detalle.movimiento_id} no pertenece al proveedor seleccionado")

            if movimiento.saldo_comprobante < detalle.monto_a_pagar:
                raise ValueError(
                    f"Monto a pagar (${detalle.monto_a_pagar}) supera saldo pendiente "
                    f"de factura {movimiento.factura_numero or movimiento.concepto} (${movimiento.saldo_comprobante})"
                )

            monto_total += detalle.monto_a_pagar
            detalles_validados.append({
                "movimiento": movimiento,
                "monto_a_pagar": detalle.monto_a_pagar,
                "descripcion": detalle.descripcion or f"Factura {movimiento.factura_numero or movimiento.concepto}",
                "numero_linea": numero_linea,
            })
            numero_linea += 1

        # Crear orden de pago
        orden = OrdenPago(
            id=str(uuid4()),
            numero=self._generar_numero(),
            proveedor_id=data.proveedor_id,
            fecha_emision=data.fecha_emision,
            fecha_pago_programada=data.fecha_pago_programada,
            estado=EstadoOrdenPago.BORRADOR.value,
            monto_total=monto_total,
            concepto=data.concepto,
            notas=data.notas,
            creado_por_id=usuario_id,
        )

        self.db.add(orden)

        # Crear detalles
        for det in detalles_validados:
            detalle_op = DetalleOrdenPago(
                id=str(uuid4()),
                orden_pago_id=orden.id,
                movimiento_id=str(det["movimiento"].id),
                descripcion=det["descripcion"],
                monto_comprobante=det["movimiento"].monto,
                monto_pendiente_antes=det["movimiento"].saldo_comprobante,
                monto_a_pagar=det["monto_a_pagar"],
                numero_linea=det["numero_linea"],
            )
            self.db.add(detalle_op)

        self.db.commit()
        self.db.refresh(orden)

        return orden

    def actualizar_orden_pago(
        self,
        orden_id: str,
        data: OrdenPagoUpdate,
        usuario_id: str,
    ) -> OrdenPago:
        """Actualiza una orden de pago (solo en borrador)."""
        orden = self.get_orden_pago(orden_id)
        if not orden:
            raise ValueError("Orden de pago no encontrada")

        if not orden.puede_editar:
            raise ValueError("Solo se pueden editar órdenes en estado borrador")

        # Actualizar campos básicos
        if data.fecha_pago_programada is not None:
            orden.fecha_pago_programada = data.fecha_pago_programada
        if data.concepto is not None:
            orden.concepto = data.concepto
        if data.notas is not None:
            orden.notas = data.notas

        # Si se actualizan detalles, recalcular
        if data.detalles is not None:
            # Eliminar detalles anteriores
            for detalle in orden.detalles:
                self.db.delete(detalle)

            monto_total = Decimal("0")
            numero_linea = 1

            for det in data.detalles:
                movimiento = self.db.query(MovimientoCuentaCorrienteProveedor).filter(
                    MovimientoCuentaCorrienteProveedor.id == det.movimiento_id
                ).first()

                if not movimiento:
                    raise ValueError(f"Movimiento {det.movimiento_id} no encontrado")

                if movimiento.saldo_comprobante < det.monto_a_pagar:
                    raise ValueError(f"Monto excede saldo pendiente de {movimiento.factura_numero}")

                monto_total += det.monto_a_pagar

                detalle_op = DetalleOrdenPago(
                    id=str(uuid4()),
                    orden_pago_id=orden.id,
                    movimiento_id=det.movimiento_id,
                    descripcion=det.descripcion or f"Factura {movimiento.factura_numero or movimiento.concepto}",
                    monto_comprobante=movimiento.monto,
                    monto_pendiente_antes=movimiento.saldo_comprobante,
                    monto_a_pagar=det.monto_a_pagar,
                    numero_linea=numero_linea,
                )
                self.db.add(detalle_op)
                numero_linea += 1

            orden.monto_total = monto_total

        self.db.commit()
        self.db.refresh(orden)

        return orden

    def confirmar(self, orden_id: str, usuario_id: str, notas: Optional[str] = None) -> OrdenPago:
        """Confirma una orden de pago (pasa de borrador a confirmada)."""
        orden = self.get_orden_pago(orden_id)
        if not orden:
            raise ValueError("Orden de pago no encontrada")

        if not orden.puede_confirmar:
            raise ValueError("La orden no puede confirmarse en su estado actual")

        orden.estado = EstadoOrdenPago.CONFIRMADA.value
        if notas:
            orden.notas = (orden.notas or "") + f"\n[Confirmación] {notas}"

        self.db.commit()
        self.db.refresh(orden)

        return orden

    def pagar(
        self,
        orden_id: str,
        data: PagarOrdenPagoRequest,
        usuario_id: str,
    ) -> OrdenPago:
        """Efectúa el pago de una orden de pago."""
        orden = self.get_orden_pago(orden_id)
        if not orden:
            raise ValueError("Orden de pago no encontrada")

        if not orden.puede_pagar:
            raise ValueError("La orden no puede pagarse en su estado actual")

        # Validar cuenta bancaria si no es efectivo
        if data.medio_pago != "efectivo" and not data.cuenta_bancaria_id:
            raise ValueError("Debe especificar una cuenta bancaria para pagos que no son en efectivo")

        # Registrar pago en CC proveedor
        self.cc_service.registrar_pago(
            proveedor_id=str(orden.proveedor_id),
            monto=orden.monto_total,
            concepto=f"Pago OP {orden.numero}",
            fecha_movimiento=data.fecha_pago,
            usuario_id=usuario_id,
            orden_pago_id=str(orden.id),
        )

        # Imputar a cada comprobante
        for detalle in orden.detalles:
            self.cc_service.imputar_pago_a_comprobante(
                movimiento_cargo_id=str(detalle.movimiento_id),
                monto_a_imputar=detalle.monto_a_pagar,
                orden_pago_id=str(orden.id),
                usuario_id=usuario_id,
            )

        # Registrar movimiento financiero según medio de pago
        if data.medio_pago == "efectivo":
            self._registrar_egreso_caja(orden, data, usuario_id)
        elif data.cuenta_bancaria_id:
            self._registrar_movimiento_banco(orden, data, usuario_id)

        # Actualizar orden
        orden.estado = EstadoOrdenPago.PAGADA.value
        orden.fecha_pago_real = data.fecha_pago
        orden.medio_pago = data.medio_pago
        orden.cuenta_bancaria_id = data.cuenta_bancaria_id
        orden.referencia_pago = data.referencia_pago
        orden.monto_pagado = orden.monto_total
        orden.pagado_por_id = usuario_id

        self.db.commit()
        self.db.refresh(orden)

        return orden

    def _registrar_egreso_caja(
        self,
        orden: OrdenPago,
        data: PagarOrdenPagoRequest,
        usuario_id: str,
    ) -> None:
        """Registra el egreso en caja."""
        # Buscar caja abierta
        caja = self.db.query(Caja).filter(
            Caja.estado == EstadoCaja.ABIERTA.value
        ).first()

        if not caja:
            raise ValueError("No hay caja abierta para registrar el pago")

        movimiento = MovimientoCaja(
            id=str(uuid4()),
            caja_id=str(caja.id),
            tipo=TipoMovimientoCaja.EGRESO.value,
            categoria="pago_proveedor",
            concepto=f"Pago OP {orden.numero} - {orden.proveedor.nombre_display}",
            monto=orden.monto_total,
            medio_pago=data.medio_pago,
            referencia=data.referencia_pago,
            proveedor_id=str(orden.proveedor_id),
            registrado_por_id=usuario_id,
        )

        self.db.add(movimiento)

        # Actualizar totales de caja
        caja.total_egresos = (caja.total_egresos or Decimal("0")) + orden.monto_total

    def _registrar_movimiento_banco(
        self,
        orden: OrdenPago,
        data: PagarOrdenPagoRequest,
        usuario_id: str,
    ) -> None:
        """Registra el movimiento bancario."""
        cuenta = self.db.query(CuentaBancaria).filter(
            CuentaBancaria.id == data.cuenta_bancaria_id
        ).first()

        if not cuenta:
            raise ValueError("Cuenta bancaria no encontrada")

        saldo_anterior = cuenta.saldo_actual
        saldo_posterior = saldo_anterior - orden.monto_total

        movimiento = MovimientoBancario(
            id=str(uuid4()),
            cuenta_id=data.cuenta_bancaria_id,
            tipo="transferencia_salida",
            concepto=f"Pago OP {orden.numero} - {orden.proveedor.nombre_display}",
            monto=orden.monto_total,
            saldo_anterior=saldo_anterior,
            saldo_posterior=saldo_posterior,
            fecha_movimiento=data.fecha_pago,
            numero_comprobante=data.referencia_pago,
            proveedor_id=str(orden.proveedor_id),
            registrado_por_id=usuario_id,
        )

        self.db.add(movimiento)

        # Actualizar saldo de cuenta
        cuenta.saldo_actual = saldo_posterior

    def anular(self, orden_id: str, usuario_id: str, motivo: str) -> OrdenPago:
        """Anula una orden de pago."""
        orden = self.get_orden_pago(orden_id)
        if not orden:
            raise ValueError("Orden de pago no encontrada")

        if not orden.puede_anular:
            raise ValueError("No se puede anular una orden de pago ya pagada")

        orden.anulado = True
        orden.fecha_anulacion = datetime.utcnow()
        orden.anulado_por_id = usuario_id
        orden.motivo_anulacion = motivo
        orden.estado = EstadoOrdenPago.ANULADA.value

        self.db.commit()
        self.db.refresh(orden)

        return orden

    def get_resumen_ordenes(
        self,
        proveedor_id: Optional[str] = None,
    ) -> dict:
        """Obtiene resumen de órdenes de pago."""
        query = self.db.query(OrdenPago).filter(OrdenPago.anulado == False)

        if proveedor_id:
            query = query.filter(OrdenPago.proveedor_id == proveedor_id)

        ordenes = query.all()

        total_borrador = sum(o.monto_total for o in ordenes if o.estado == EstadoOrdenPago.BORRADOR.value)
        total_confirmadas = sum(o.monto_total for o in ordenes if o.estado == EstadoOrdenPago.CONFIRMADA.value)
        total_pagadas = sum(o.monto_total for o in ordenes if o.estado == EstadoOrdenPago.PAGADA.value)

        return {
            "total_borrador": total_borrador,
            "total_confirmadas": total_confirmadas,
            "total_pagadas": total_pagadas,
            "cantidad_borrador": len([o for o in ordenes if o.estado == EstadoOrdenPago.BORRADOR.value]),
            "cantidad_confirmadas": len([o for o in ordenes if o.estado == EstadoOrdenPago.CONFIRMADA.value]),
            "cantidad_pagadas": len([o for o in ordenes if o.estado == EstadoOrdenPago.PAGADA.value]),
        }
