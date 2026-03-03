"""
Servicio de Finanzas (Caja, Movimientos, Cuentas Bancarias).
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import uuid4

from sqlalchemy import func, and_, or_
from sqlalchemy.orm import Session

from app.models.caja import (
    Caja,
    MovimientoCaja,
    GastoRecurrente,
    EstadoCaja,
    TipoMovimientoCaja,
)
from app.models.cuenta_bancaria import (
    CuentaBancaria,
    MovimientoBancario,
    TipoMovimientoBanco,
)
from app.schemas.finanzas import (
    AbrirCajaRequest,
    CerrarCajaRequest,
    MovimientoCajaCreate,
    CuentaBancariaCreate,
    CuentaBancariaUpdate,
    MovimientoBancarioCreate,
)


class FinanzasService:
    """Servicio para gestión de finanzas."""

    def __init__(self, db: Session):
        self.db = db

    # ==================== CAJA ====================

    def get_caja_actual(self) -> Optional[Caja]:
        """Obtiene la caja abierta actual."""
        return (
            self.db.query(Caja)
            .filter(Caja.estado == EstadoCaja.ABIERTA.value)
            .order_by(Caja.fecha.desc())
            .first()
        )

    def get_caja(self, caja_id: str) -> Optional[Caja]:
        """Obtiene una caja por ID."""
        return self.db.query(Caja).filter(Caja.id == caja_id).first()

    def get_cajas(
        self,
        skip: int = 0,
        limit: int = 20,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
        estado: Optional[str] = None,
    ) -> Tuple[List[Caja], int]:
        """Obtiene lista de cajas con filtros."""
        query = self.db.query(Caja)

        if fecha_desde:
            query = query.filter(Caja.fecha >= fecha_desde)

        if fecha_hasta:
            query = query.filter(Caja.fecha <= fecha_hasta)

        if estado:
            query = query.filter(Caja.estado == estado)

        total = query.count()
        cajas = query.order_by(Caja.fecha.desc()).offset(skip).limit(limit).all()

        return cajas, total

    def abrir_caja(self, data: AbrirCajaRequest, usuario_id: str) -> Caja:
        """Abre una nueva caja."""
        # Verificar que no haya caja abierta
        caja_actual = self.get_caja_actual()
        if caja_actual:
            raise ValueError("Ya existe una caja abierta. Debe cerrarla primero.")

        # Obtener siguiente número
        ultimo_numero = (
            self.db.query(func.max(Caja.numero)).scalar() or 0
        )

        caja = Caja(
            id=str(uuid4()),
            numero=ultimo_numero + 1,
            fecha=date.today(),
            estado=EstadoCaja.ABIERTA.value,
            saldo_inicial=data.saldo_inicial,
            total_ingresos=Decimal("0"),
            total_egresos=Decimal("0"),
            abierta_por_id=usuario_id,
            fecha_apertura=datetime.utcnow(),
            observaciones_apertura=data.observaciones_apertura,
        )

        self.db.add(caja)
        self.db.commit()
        self.db.refresh(caja)

        return caja

    def cerrar_caja(self, caja_id: str, data: CerrarCajaRequest, usuario_id: str) -> Caja:
        """Cierra una caja."""
        caja = self.get_caja(caja_id)
        if not caja:
            raise ValueError("Caja no encontrada")

        if caja.estado != EstadoCaja.ABIERTA.value:
            raise ValueError("La caja ya está cerrada")

        # Actualizar totales
        caja.actualizar_totales()

        # Calcular saldo final
        saldo_final = caja.saldo_inicial + caja.total_ingresos - caja.total_egresos

        caja.estado = EstadoCaja.CERRADA.value
        caja.saldo_final = saldo_final
        caja.saldo_real = data.saldo_real
        caja.diferencia = data.saldo_real - saldo_final
        caja.cerrada_por_id = usuario_id
        caja.fecha_cierre = datetime.utcnow()
        caja.observaciones_cierre = data.observaciones_cierre

        self.db.commit()
        self.db.refresh(caja)

        return caja

    # ==================== MOVIMIENTOS CAJA ====================

    def get_movimientos_caja(
        self,
        caja_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
        tipo: Optional[str] = None,
        categoria: Optional[str] = None,
        incluir_anulados: bool = False,
    ) -> Tuple[List[MovimientoCaja], int]:
        """Obtiene movimientos de caja."""
        query = self.db.query(MovimientoCaja)

        if caja_id:
            query = query.filter(MovimientoCaja.caja_id == caja_id)

        if tipo:
            query = query.filter(MovimientoCaja.tipo == tipo)

        if categoria:
            query = query.filter(MovimientoCaja.categoria == categoria)

        if not incluir_anulados:
            query = query.filter(MovimientoCaja.anulado == False)

        total = query.count()
        movimientos = (
            query.order_by(MovimientoCaja.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return movimientos, total

    def registrar_movimiento_caja(
        self,
        data: MovimientoCajaCreate,
        usuario_id: str,
    ) -> MovimientoCaja:
        """Registra un movimiento de caja."""
        # Verificar caja abierta
        caja = self.get_caja_actual()
        if not caja:
            raise ValueError("No hay caja abierta. Debe abrir una caja primero.")

        movimiento = MovimientoCaja(
            id=str(uuid4()),
            caja_id=caja.id,
            tipo=data.tipo,
            categoria=data.categoria,
            concepto=data.concepto,
            descripcion=data.descripcion,
            monto=data.monto,
            medio_pago=data.medio_pago,
            referencia=data.referencia,
            cliente_id=data.cliente_id,
            proveedor_id=data.proveedor_id,
            pedido_id=data.pedido_id,
            registrado_por_id=usuario_id,
        )

        self.db.add(movimiento)

        # Actualizar totales de la caja
        if data.tipo == TipoMovimientoCaja.INGRESO.value:
            caja.total_ingresos += data.monto
        else:
            caja.total_egresos += data.monto

        self.db.commit()
        self.db.refresh(movimiento)

        return movimiento

    def anular_movimiento_caja(
        self,
        movimiento_id: str,
        motivo: str,
        usuario_id: str,
    ) -> MovimientoCaja:
        """Anula un movimiento de caja."""
        movimiento = (
            self.db.query(MovimientoCaja)
            .filter(MovimientoCaja.id == movimiento_id)
            .first()
        )

        if not movimiento:
            raise ValueError("Movimiento no encontrado")

        if movimiento.anulado:
            raise ValueError("El movimiento ya está anulado")

        # Verificar que la caja esté abierta
        caja = self.get_caja(str(movimiento.caja_id))
        if caja.estado != EstadoCaja.ABIERTA.value:
            raise ValueError("No se puede anular un movimiento de una caja cerrada")

        movimiento.anulado = True
        movimiento.fecha_anulacion = datetime.utcnow()
        movimiento.motivo_anulacion = motivo
        movimiento.anulado_por_id = usuario_id

        # Revertir totales
        if movimiento.tipo == TipoMovimientoCaja.INGRESO.value:
            caja.total_ingresos -= movimiento.monto
        else:
            caja.total_egresos -= movimiento.monto

        self.db.commit()
        self.db.refresh(movimiento)

        return movimiento

    # ==================== CUENTAS BANCARIAS ====================

    def get_cuentas_bancarias(
        self,
        solo_activas: bool = True,
    ) -> List[CuentaBancaria]:
        """Obtiene lista de cuentas bancarias."""
        query = self.db.query(CuentaBancaria)

        if solo_activas:
            query = query.filter(CuentaBancaria.activa == True)

        return query.order_by(CuentaBancaria.es_principal.desc(), CuentaBancaria.nombre).all()

    def get_cuenta_bancaria(self, cuenta_id: str) -> Optional[CuentaBancaria]:
        """Obtiene una cuenta bancaria por ID."""
        return self.db.query(CuentaBancaria).filter(CuentaBancaria.id == cuenta_id).first()

    def create_cuenta_bancaria(self, data: CuentaBancariaCreate) -> CuentaBancaria:
        """Crea una cuenta bancaria."""
        cuenta = CuentaBancaria(
            id=str(uuid4()),
            **data.model_dump(),
        )

        # Si es principal, desmarcar las otras
        if data.es_principal:
            self.db.query(CuentaBancaria).update({"es_principal": False})

        self.db.add(cuenta)
        self.db.commit()
        self.db.refresh(cuenta)

        return cuenta

    def update_cuenta_bancaria(
        self, cuenta_id: str, data: CuentaBancariaUpdate
    ) -> Optional[CuentaBancaria]:
        """Actualiza una cuenta bancaria."""
        cuenta = self.get_cuenta_bancaria(cuenta_id)
        if not cuenta:
            return None

        update_data = data.model_dump(exclude_unset=True)

        # Si se marca como principal, desmarcar las otras
        if update_data.get("es_principal"):
            self.db.query(CuentaBancaria).filter(
                CuentaBancaria.id != cuenta_id
            ).update({"es_principal": False})

        for field, value in update_data.items():
            setattr(cuenta, field, value)

        self.db.commit()
        self.db.refresh(cuenta)

        return cuenta

    # ==================== MOVIMIENTOS BANCARIOS ====================

    def get_movimientos_bancarios(
        self,
        cuenta_id: str,
        skip: int = 0,
        limit: int = 50,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
    ) -> Tuple[List[MovimientoBancario], int]:
        """Obtiene movimientos bancarios de una cuenta."""
        query = self.db.query(MovimientoBancario).filter(
            MovimientoBancario.cuenta_id == cuenta_id
        )

        if fecha_desde:
            query = query.filter(MovimientoBancario.fecha_movimiento >= fecha_desde)

        if fecha_hasta:
            query = query.filter(MovimientoBancario.fecha_movimiento <= fecha_hasta)

        total = query.count()
        movimientos = (
            query.order_by(MovimientoBancario.fecha_movimiento.desc(), MovimientoBancario.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return movimientos, total

    def registrar_movimiento_bancario(
        self,
        data: MovimientoBancarioCreate,
        usuario_id: str,
    ) -> MovimientoBancario:
        """Registra un movimiento bancario."""
        cuenta = self.get_cuenta_bancaria(data.cuenta_id)
        if not cuenta:
            raise ValueError("Cuenta bancaria no encontrada")

        saldo_anterior = cuenta.saldo_actual

        # Calcular saldo posterior según tipo de movimiento
        tipos_entrada = [
            TipoMovimientoBanco.DEPOSITO.value,
            TipoMovimientoBanco.TRANSFERENCIA_ENTRADA.value,
            TipoMovimientoBanco.CREDITO.value,
            TipoMovimientoBanco.CHEQUE_DEPOSITADO.value,
            TipoMovimientoBanco.INTERES.value,
        ]

        if data.tipo in tipos_entrada:
            saldo_posterior = saldo_anterior + data.monto
        else:
            saldo_posterior = saldo_anterior - data.monto

        movimiento = MovimientoBancario(
            id=str(uuid4()),
            cuenta_id=data.cuenta_id,
            tipo=data.tipo,
            concepto=data.concepto,
            descripcion=data.descripcion,
            monto=data.monto,
            saldo_anterior=saldo_anterior,
            saldo_posterior=saldo_posterior,
            fecha_movimiento=data.fecha_movimiento,
            fecha_valor=data.fecha_valor,
            numero_comprobante=data.numero_comprobante,
            referencia_externa=data.referencia_externa,
            cliente_id=data.cliente_id,
            proveedor_id=data.proveedor_id,
            registrado_por_id=usuario_id,
        )

        self.db.add(movimiento)

        # Actualizar saldo de la cuenta
        cuenta.saldo_actual = saldo_posterior

        self.db.commit()
        self.db.refresh(movimiento)

        return movimiento

    # ==================== RESUMEN FINANCIERO ====================

    def get_resumen_financiero(
        self,
        fecha_desde: date,
        fecha_hasta: date,
    ) -> dict:
        """Obtiene resumen financiero del período."""
        # Caja actual
        caja_actual = self.get_caja_actual()
        resumen_caja = None
        if caja_actual:
            resumen_caja = {
                "fecha": caja_actual.fecha,
                "caja_numero": caja_actual.numero,
                "estado": caja_actual.estado,
                "saldo_inicial": caja_actual.saldo_inicial,
                "total_ingresos": caja_actual.total_ingresos,
                "total_egresos": caja_actual.total_egresos,
                "saldo_actual": caja_actual.saldo_calculado,
                "cantidad_movimientos": caja_actual.movimientos.filter(
                    MovimientoCaja.anulado == False
                ).count(),
            }

        # Totales del período
        movimientos_periodo = (
            self.db.query(MovimientoCaja)
            .join(Caja)
            .filter(
                Caja.fecha >= fecha_desde,
                Caja.fecha <= fecha_hasta,
                MovimientoCaja.anulado == False,
            )
        )

        total_ingresos = (
            movimientos_periodo
            .filter(MovimientoCaja.tipo == TipoMovimientoCaja.INGRESO.value)
            .with_entities(func.sum(MovimientoCaja.monto))
            .scalar()
        ) or Decimal("0")

        total_egresos = (
            movimientos_periodo
            .filter(MovimientoCaja.tipo == TipoMovimientoCaja.EGRESO.value)
            .with_entities(func.sum(MovimientoCaja.monto))
            .scalar()
        ) or Decimal("0")

        # Por categoría
        ingresos_por_cat = {}
        egresos_por_cat = {}

        categorias_ingresos = (
            movimientos_periodo
            .filter(MovimientoCaja.tipo == TipoMovimientoCaja.INGRESO.value)
            .with_entities(MovimientoCaja.categoria, func.sum(MovimientoCaja.monto))
            .group_by(MovimientoCaja.categoria)
            .all()
        )
        for cat, monto in categorias_ingresos:
            ingresos_por_cat[cat] = float(monto)

        categorias_egresos = (
            movimientos_periodo
            .filter(MovimientoCaja.tipo == TipoMovimientoCaja.EGRESO.value)
            .with_entities(MovimientoCaja.categoria, func.sum(MovimientoCaja.monto))
            .group_by(MovimientoCaja.categoria)
            .all()
        )
        for cat, monto in categorias_egresos:
            egresos_por_cat[cat] = float(monto)

        # Total en bancos
        total_bancos = (
            self.db.query(func.sum(CuentaBancaria.saldo_actual))
            .filter(CuentaBancaria.activa == True)
            .scalar()
        ) or Decimal("0")

        return {
            "caja_actual": resumen_caja,
            "total_ingresos_periodo": total_ingresos,
            "total_egresos_periodo": total_egresos,
            "balance_periodo": total_ingresos - total_egresos,
            "ingresos_por_categoria": ingresos_por_cat,
            "egresos_por_categoria": egresos_por_cat,
            "total_en_bancos": total_bancos,
        }
