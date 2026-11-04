"""
Servicio de Tesorería.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import UUID, uuid4

from sqlalchemy import func, or_, and_, desc, text
from sqlalchemy.orm import Session


# Flag de módulo: el "schema healing" corre solo una vez por proceso.
# Zero overhead para todos los requests posteriores.
_SCHEMA_MOV_BANCARIOS_OK = False


def _asegurar_schema_movimientos_bancarios(db: Session) -> None:
    """Red de seguridad: garantiza que la tabla ``movimientos_bancarios``
    tenga las columnas de conciliación. Idempotente y sin tocar la session
    actual: los ALTER corren en una CONEXIÓN SEPARADA con autocommit, así
    no commiteamos registros pendientes de la sesión del request (que
    antes causaba que el MovimientoTesoreria se persistiera antes de
    crear su MovimientoBancario asociado).
    """
    global _SCHEMA_MOV_BANCARIOS_OK
    if _SCHEMA_MOV_BANCARIOS_OK:
        return
    from app.db.base import engine
    try:
        with engine.connect() as conn:
            conn = conn.execution_options(isolation_level="AUTOCOMMIT")
            for stmt in (
                "ALTER TABLE movimientos_bancarios ADD COLUMN IF NOT EXISTS conciliado BOOLEAN NOT NULL DEFAULT FALSE",
                "ALTER TABLE movimientos_bancarios ADD COLUMN IF NOT EXISTS fecha_conciliacion TIMESTAMP",
                "ALTER TABLE movimientos_bancarios ADD COLUMN IF NOT EXISTS conciliacion_id UUID",
                "ALTER TABLE movimientos_bancarios ADD COLUMN IF NOT EXISTS conciliado_por_id UUID",
                "ALTER TABLE movimientos_bancarios ADD COLUMN IF NOT EXISTS referencia_conciliacion VARCHAR(100)",
            ):
                conn.execute(text(stmt))
        _SCHEMA_MOV_BANCARIOS_OK = True
    except Exception:
        # Si el ALTER falla (sin permisos, ya están, etc), el INSERT
        # va a tirar error claro igual. No rompemos el request.
        pass

from app.core.timezone import now_utc_naive, today_ar
from app.models.tesoreria import (
    Cheque,
    MovimientoTesoreria,
    EstadoCheque,
    TipoMovimientoTesoreria,
    OrigenCheque,
)
from app.models.cliente import Cliente
from app.models.proveedor import Proveedor
from app.models.usuario import Usuario
from app.models.cuenta_bancaria import CuentaBancaria
from app.models.cuenta_corriente import (
    MovimientoCuentaCorriente,
    Recibo,
    TipoMovimientoCC,
)
from app.schemas.tesoreria import (
    ChequeCreate,
    ChequeUpdate,
    DepositarChequeRequest,
    CobrarChequeRequest,
    RechazarChequeRequest,
    EntregarChequeRequest,
    MovimientoTesoreriaCreate,
    MovimientoTesoreriaUpdate,
    AnularMovimientoRequest,
    ResumenTesoreria,
)


class TesoreriaService:
    """Servicio para gestión de tesorería."""

    def __init__(self, db: Session):
        self.db = db

    # ==================== CHEQUES ====================

    def get_cheques(
        self,
        skip: int = 0,
        limit: int = 50,
        estado: Optional[str] = None,
        tipo: Optional[str] = None,
        origen: Optional[str] = None,
        cliente_id: Optional[UUID] = None,
        proveedor_id: Optional[UUID] = None,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
        buscar: Optional[str] = None,
        solo_en_cartera: bool = False,
        vencidos: bool = False,
        proximos_vencer: bool = False,
    ) -> Tuple[List[Cheque], int]:
        """Obtiene lista de cheques con filtros."""
        query = self.db.query(Cheque).filter(Cheque.activo == True)

        if estado:
            query = query.filter(Cheque.estado == estado)

        if solo_en_cartera:
            query = query.filter(Cheque.estado == EstadoCheque.EN_CARTERA.value)

        if tipo:
            query = query.filter(Cheque.tipo == tipo)

        if origen:
            query = query.filter(Cheque.origen == origen)

        if cliente_id:
            query = query.filter(Cheque.cliente_id == str(cliente_id))

        if proveedor_id:
            query = query.filter(Cheque.proveedor_id == str(proveedor_id))

        if fecha_desde:
            query = query.filter(Cheque.fecha_vencimiento >= fecha_desde)

        if fecha_hasta:
            query = query.filter(Cheque.fecha_vencimiento <= fecha_hasta)

        if vencidos:
            query = query.filter(
                Cheque.fecha_vencimiento < today_ar(),
                Cheque.estado == EstadoCheque.EN_CARTERA.value
            )

        if proximos_vencer:
            fecha_limite = today_ar() + timedelta(days=7)
            query = query.filter(
                Cheque.fecha_vencimiento <= fecha_limite,
                Cheque.fecha_vencimiento >= today_ar(),
                Cheque.estado == EstadoCheque.EN_CARTERA.value
            )

        if buscar:
            search = f"%{buscar}%"
            query = query.filter(
                or_(
                    Cheque.numero.ilike(search),
                    Cheque.librador.ilike(search),
                    Cheque.banco_origen.ilike(search),
                )
            )

        total = query.count()
        cheques = query.order_by(Cheque.fecha_vencimiento.asc()).offset(skip).limit(limit).all()

        return cheques, total

    def get_cheque(self, cheque_id: UUID) -> Optional[Cheque]:
        """Obtiene un cheque por ID."""
        return self.db.query(Cheque).filter(
            Cheque.id == str(cheque_id),
            Cheque.activo == True
        ).first()

    def create_cheque(self, data: ChequeCreate, registrado_por_id: UUID) -> Cheque:
        """
        Crea un nuevo cheque.

        Si el cheque es de origen 'recibido_cliente', se registra automáticamente
        como PAGO en la cuenta corriente del cliente (disminuye su deuda).
        """
        # Validar que si es cheque recibido de cliente, tenga cliente_id
        if data.origen == OrigenCheque.RECIBIDO_CLIENTE.value and not data.cliente_id:
            raise ValueError("Los cheques recibidos de cliente deben tener un cliente asociado obligatoriamente")

        cheque = Cheque(
            id=str(uuid4()),
            numero=data.numero,
            tipo=data.tipo,
            origen=data.origen,
            estado=EstadoCheque.EN_CARTERA.value,
            monto=data.monto,
            fecha_emision=data.fecha_emision,
            fecha_vencimiento=data.fecha_vencimiento,
            banco_origen=data.banco_origen,
            cuenta_destino_id=str(data.cuenta_destino_id) if data.cuenta_destino_id else None,
            banco_destino=data.banco_destino,
            cliente_id=str(data.cliente_id) if data.cliente_id else None,
            proveedor_id=str(data.proveedor_id) if data.proveedor_id else None,
            librador=data.librador,
            cuit_librador=data.cuit_librador,
            notas=data.notas,
            registrado_por_id=str(registrado_por_id),
            fecha_registro=now_utc_naive(),
        )

        self.db.add(cheque)
        self.db.flush()  # Para obtener el ID del cheque

        # Si es cheque recibido de cliente, imputar automáticamente a cuenta corriente
        if data.origen == OrigenCheque.RECIBIDO_CLIENTE.value and data.cliente_id:
            self._imputar_cheque_cliente(
                cheque=cheque,
                cliente_id=str(data.cliente_id),
                usuario_id=str(registrado_por_id),
                es_pago=True  # El cliente paga con cheque
            )

        self.db.commit()
        self.db.refresh(cheque)

        return cheque

    def update_cheque(self, cheque_id: UUID, data: ChequeUpdate) -> Optional[Cheque]:
        """Actualiza un cheque."""
        cheque = self.get_cheque(cheque_id)
        if not cheque:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field.endswith('_id') and value is not None:
                value = str(value)
            setattr(cheque, field, value)

        self.db.commit()
        self.db.refresh(cheque)

        return cheque

    def depositar_cheque(
        self,
        cheque_id: UUID,
        data: DepositarChequeRequest,
        usuario_id: UUID
    ) -> Cheque:
        """Marca un cheque como depositado."""
        cheque = self.get_cheque(cheque_id)
        if not cheque:
            raise ValueError("Cheque no encontrado")

        if cheque.estado != EstadoCheque.EN_CARTERA.value:
            raise ValueError(f"El cheque no está en cartera (estado actual: {cheque.estado})")

        cheque.estado = EstadoCheque.DEPOSITADO.value
        cheque.cuenta_destino_id = str(data.cuenta_destino_id)
        if data.notas:
            cheque.notas = (cheque.notas or "") + f"\n[Depositado {data.fecha_deposito}] {data.notas}"

        self.db.commit()
        self.db.refresh(cheque)

        return cheque

    def cobrar_cheque(
        self,
        cheque_id: UUID,
        data: CobrarChequeRequest,
        usuario_id: UUID
    ) -> Cheque:
        """Marca un cheque como cobrado."""
        cheque = self.get_cheque(cheque_id)
        if not cheque:
            raise ValueError("Cheque no encontrado")

        if cheque.estado not in [EstadoCheque.EN_CARTERA.value, EstadoCheque.DEPOSITADO.value]:
            raise ValueError(f"El cheque no puede cobrarse (estado actual: {cheque.estado})")

        cheque.estado = EstadoCheque.COBRADO.value
        cheque.fecha_cobro = data.fecha_cobro
        cheque.cobrado_por_id = str(usuario_id)
        if data.notas:
            cheque.notas = (cheque.notas or "") + f"\n[Cobrado {data.fecha_cobro}] {data.notas}"

        self.db.commit()
        self.db.refresh(cheque)

        return cheque

    def rechazar_cheque(
        self,
        cheque_id: UUID,
        data: RechazarChequeRequest,
        usuario_id: UUID
    ) -> Cheque:
        """
        Marca un cheque como rechazado.

        Si el cheque era de un cliente, se REVIERTE el pago en su cuenta corriente
        (se genera un cargo por el monto del cheque rechazado).
        """
        cheque = self.get_cheque(cheque_id)
        if not cheque:
            raise ValueError("Cheque no encontrado")

        # Guardar estado anterior para verificar si era de cliente
        origen_anterior = cheque.origen
        cliente_id = cheque.cliente_id

        cheque.estado = EstadoCheque.RECHAZADO.value
        cheque.motivo_rechazo = data.motivo_rechazo

        # Si era un cheque de cliente, revertir el pago en cuenta corriente
        if origen_anterior == OrigenCheque.RECIBIDO_CLIENTE.value and cliente_id:
            self._imputar_cheque_cliente(
                cheque=cheque,
                cliente_id=cliente_id,
                usuario_id=str(usuario_id),
                es_pago=False,  # Es un cargo (reversión del pago)
                motivo=f"Cheque rechazado: {data.motivo_rechazo}"
            )

        self.db.commit()
        self.db.refresh(cheque)

        return cheque

    def entregar_cheque(
        self,
        cheque_id: UUID,
        data: EntregarChequeRequest,
        usuario_id: UUID
    ) -> Cheque:
        """Marca un cheque como entregado a tercero."""
        cheque = self.get_cheque(cheque_id)
        if not cheque:
            raise ValueError("Cheque no encontrado")

        if cheque.estado != EstadoCheque.EN_CARTERA.value:
            raise ValueError(f"El cheque no está en cartera (estado actual: {cheque.estado})")

        cheque.estado = EstadoCheque.ENTREGADO.value
        if data.proveedor_id:
            cheque.proveedor_id = str(data.proveedor_id)
        cheque.notas = (cheque.notas or "") + f"\n[Entregado {data.fecha_entrega}] {data.concepto}"
        if data.notas:
            cheque.notas += f" - {data.notas}"

        self.db.commit()
        self.db.refresh(cheque)

        return cheque

    def delete_cheque(self, cheque_id: UUID, usuario_id: UUID) -> bool:
        """
        Elimina un cheque (soft delete).

        Solo se pueden eliminar cheques que estén en cartera y no tengan
        movimientos de cuenta corriente asociados.
        """
        cheque = self.get_cheque(cheque_id)
        if not cheque:
            raise ValueError("Cheque no encontrado")

        # Solo permitir eliminar cheques en_cartera
        if cheque.estado != EstadoCheque.EN_CARTERA.value:
            raise ValueError(
                f"Solo se pueden eliminar cheques en cartera. Estado actual: {cheque.estado}"
            )

        # Verificar si tiene movimientos de cuenta corriente asociados
        if cheque.origen == OrigenCheque.RECIBIDO_CLIENTE.value and cheque.cliente_id:
            # Buscar si hay movimientos de CC con referencia a este cheque
            movimiento_cc = self.db.query(MovimientoCuentaCorriente).filter(
                MovimientoCuentaCorriente.referencia_pago == f"CH-{cheque.numero}",
                MovimientoCuentaCorriente.cliente_id == cheque.cliente_id,
            ).first()

            if movimiento_cc:
                # Revertir el pago en la cuenta corriente
                cliente = self.db.query(Cliente).filter(
                    Cliente.id == cheque.cliente_id
                ).first()
                if cliente:
                    saldo_anterior = cliente.saldo_cuenta_corriente or Decimal("0")
                    # El cheque había restado de la deuda, ahora la sumamos de vuelta
                    cliente.saldo_cuenta_corriente = saldo_anterior + cheque.monto

                    # Crear movimiento de reversión
                    from uuid import uuid4
                    movimiento_reversion = MovimientoCuentaCorriente(
                        id=str(uuid4()),
                        cliente_id=cheque.cliente_id,
                        tipo=TipoMovimientoCC.CARGO.value,
                        concepto=f"Reversión por eliminación de cheque #{cheque.numero}",
                        monto=cheque.monto,
                        saldo_anterior=saldo_anterior,
                        saldo_posterior=cliente.saldo_cuenta_corriente,
                        medio_pago="cheque",
                        referencia_pago=f"REV-CH-{cheque.numero}",
                        fecha_movimiento=today_ar(),
                        registrado_por_id=str(usuario_id),
                        notas=f"Cheque #{cheque.numero} eliminado del sistema",
                    )
                    self.db.add(movimiento_reversion)

        # Soft delete
        cheque.activo = False
        cheque.estado = EstadoCheque.ANULADO.value

        self.db.commit()
        return True

    def get_cheques_en_cartera_total(self) -> Tuple[int, Decimal]:
        """Obtiene total de cheques en cartera."""
        result = self.db.query(
            func.count(Cheque.id),
            func.coalesce(func.sum(Cheque.monto), 0)
        ).filter(
            Cheque.activo == True,
            Cheque.estado == EstadoCheque.EN_CARTERA.value
        ).first()

        return result[0] or 0, result[1] or Decimal("0")

    # ==================== MOVIMIENTOS ====================

    def get_movimientos(
        self,
        skip: int = 0,
        limit: int = 50,
        tipo: Optional[str] = None,
        es_ingreso: Optional[bool] = None,
        metodo_pago: Optional[str] = None,
        cliente_id: Optional[UUID] = None,
        proveedor_id: Optional[UUID] = None,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
        buscar: Optional[str] = None,
        incluir_anulados: bool = False,
    ) -> Tuple[List[MovimientoTesoreria], int]:
        """Obtiene lista de movimientos con filtros."""
        query = self.db.query(MovimientoTesoreria).filter(
            MovimientoTesoreria.activo == True
        )

        if not incluir_anulados:
            query = query.filter(MovimientoTesoreria.anulado == False)

        if tipo:
            query = query.filter(MovimientoTesoreria.tipo == tipo)

        if es_ingreso is not None:
            query = query.filter(MovimientoTesoreria.es_ingreso == es_ingreso)

        if metodo_pago:
            query = query.filter(MovimientoTesoreria.metodo_pago == metodo_pago)

        if cliente_id:
            query = query.filter(MovimientoTesoreria.cliente_id == str(cliente_id))

        if proveedor_id:
            query = query.filter(MovimientoTesoreria.proveedor_id == str(proveedor_id))

        if fecha_desde:
            query = query.filter(MovimientoTesoreria.fecha_movimiento >= fecha_desde)

        if fecha_hasta:
            query = query.filter(MovimientoTesoreria.fecha_movimiento <= fecha_hasta)

        if buscar:
            search = f"%{buscar}%"
            query = query.filter(
                or_(
                    MovimientoTesoreria.concepto.ilike(search),
                    MovimientoTesoreria.descripcion.ilike(search),
                    MovimientoTesoreria.comprobante.ilike(search),
                )
            )

        total = query.count()
        movimientos = query.order_by(
            MovimientoTesoreria.fecha_movimiento.desc(),
            MovimientoTesoreria.created_at.desc()
        ).offset(skip).limit(limit).all()

        return movimientos, total

    def get_movimiento(self, movimiento_id: UUID) -> Optional[MovimientoTesoreria]:
        """Obtiene un movimiento por ID."""
        return self.db.query(MovimientoTesoreria).filter(
            MovimientoTesoreria.id == str(movimiento_id),
            MovimientoTesoreria.activo == True
        ).first()

    def create_movimiento(
        self,
        data: MovimientoTesoreriaCreate,
        registrado_por_id: UUID
    ) -> MovimientoTesoreria:
        """Crea un nuevo movimiento de tesorería.

        Cada movimiento se imputa a UNA cuenta (banco / efectivo / billetera
        virtual). Se exige `cuenta_destino_id` salvo para los cheques, que
        no afectan saldos de cuenta hasta que se depositan/cobran.

        Al imputar: suma/resta el monto al saldo de la cuenta y deja un
        MovimientoBancario de trail con `saldo_anterior`/`saldo_posterior`
        para que la vista "detalle de la cuenta" pueda reconstruir cómo
        llegó al saldo actual.
        """
        if data.cheque_id:
            cheque = self.get_cheque(data.cheque_id)
            if not cheque:
                raise ValueError("Cheque no encontrado")

        # Validación: todo movimiento que no sea cheque exige cuenta destino.
        # Antes esto era implícito ("sin cuenta → va a la caja genérica abierta"),
        # pero eliminamos la lógica de caja y ahora todo pasa por cuentas
        # nombradas. Si querés registrar un movimiento sin afectar saldos,
        # creá primero una cuenta "sin asignar" tipo efectivo y usála.
        if data.metodo_pago != "cheque" and not data.cuenta_destino_id:
            raise ValueError(
                "Elegí una cuenta para imputar el movimiento (banco, "
                "efectivo o billetera virtual)."
            )

        movimiento = MovimientoTesoreria(
            id=str(uuid4()),
            tipo=data.tipo,
            concepto=data.concepto,
            descripcion=data.descripcion,
            monto=data.monto,
            es_ingreso=data.es_ingreso,
            fecha_movimiento=data.fecha_movimiento,
            fecha_valor=data.fecha_valor,
            metodo_pago=data.metodo_pago,
            banco_origen=data.banco_origen,
            banco_destino=data.banco_destino,
            cuenta_destino_id=str(data.cuenta_destino_id) if data.cuenta_destino_id else None,
            numero_transferencia=data.numero_transferencia,
            cheque_id=str(data.cheque_id) if data.cheque_id else None,
            cliente_id=str(data.cliente_id) if data.cliente_id else None,
            proveedor_id=str(data.proveedor_id) if data.proveedor_id else None,
            categoria_gasto_id=str(data.categoria_gasto_id) if data.categoria_gasto_id else None,
            notas=data.notas,
            comprobante=data.comprobante,
            registrado_por_id=str(registrado_por_id),
        )

        self.db.add(movimiento)

        # Reflejo en la cuenta elegida (banco/efectivo/billetera_virtual):
        # saldo nuevo + fila en MovimientoBancario para el trail.
        if data.cuenta_destino_id:
            from app.models.cuenta_bancaria import MovimientoBancario, TipoMovimientoBanco
            # Red de seguridad: si la migracion 20260310100000 (campos de
            # conciliacion bancaria) no corrio en esta DB, el INSERT revienta
            # con "column conciliacion_id does not exist". Nos aseguramos de
            # que las columnas esten una vez por proceso antes de insertar.
            _asegurar_schema_movimientos_bancarios(self.db)
            cuenta = (
                self.db.query(CuentaBancaria)
                .filter(CuentaBancaria.id == str(data.cuenta_destino_id))
                .first()
            )
            if cuenta is None:
                raise ValueError("Cuenta destino no encontrada")

            saldo_anterior = cuenta.saldo_actual or Decimal("0")
            delta = data.monto if data.es_ingreso else -data.monto
            saldo_posterior = saldo_anterior + delta
            cuenta.saldo_actual = saldo_posterior

            tipo_banco = (
                TipoMovimientoBanco.TRANSFERENCIA_ENTRADA.value
                if data.es_ingreso
                else TipoMovimientoBanco.TRANSFERENCIA_SALIDA.value
            )

            mov_banco = MovimientoBancario(
                id=str(uuid4()),
                cuenta_id=str(cuenta.id),
                tipo=tipo_banco,
                concepto=data.concepto,
                descripcion=data.descripcion,
                monto=data.monto,
                saldo_anterior=saldo_anterior,
                saldo_posterior=saldo_posterior,
                fecha_movimiento=data.fecha_movimiento,
                fecha_valor=data.fecha_valor or data.fecha_movimiento,
                numero_comprobante=data.numero_transferencia,
                cliente_id=str(data.cliente_id) if data.cliente_id else None,
                proveedor_id=str(data.proveedor_id) if data.proveedor_id else None,
                registrado_por_id=str(registrado_por_id),
            )
            self.db.add(mov_banco)

        # Reflejo en cuenta corriente del cliente/proveedor.
        # Ingreso de cliente = cliente te pagó → pago en su CC (baja deuda).
        # Egreso al cliente = devolución → cargo en su CC (aumenta deuda).
        # Egreso al proveedor = le pagaste → pago en su CC (baja deuda tuya).
        # Ingreso de proveedor = ajuste/nota crédito → cargo en su CC.
        #
        # Cheques quedan excluidos acá: ya los maneja _imputar_cheque_cliente
        # desde el endpoint específico (create_movimiento_con_cheque /
        # create_cheque), y pasar también por acá generaría dos movimientos
        # de CC por el mismo cheque.
        referencia_cc = data.numero_transferencia or data.comprobante

        if data.cliente_id and data.metodo_pago != "cheque":
            self._imputar_a_cc_cliente(
                cliente_id=str(data.cliente_id),
                monto=data.monto,
                es_pago=data.es_ingreso,
                concepto=data.concepto,
                usuario_id=str(registrado_por_id),
                medio_pago=data.metodo_pago,
                referencia_pago=referencia_cc,
                fecha_movimiento=data.fecha_movimiento,
                notas=data.notas,
            )

        if data.proveedor_id and data.metodo_pago != "cheque":
            self._imputar_a_cc_proveedor(
                proveedor_id=str(data.proveedor_id),
                monto=data.monto,
                es_pago=not data.es_ingreso,
                concepto=data.concepto,
                usuario_id=str(registrado_por_id),
                fecha_movimiento=data.fecha_movimiento,
                notas=data.notas,
            )

        self.db.commit()
        self.db.refresh(movimiento)

        return movimiento

    def create_movimiento_con_cheque(
        self,
        *,
        usuario_id: UUID,
        # Movimiento
        tipo: str,
        concepto: str,
        monto: Decimal,
        es_ingreso: bool,
        fecha_movimiento: date,
        notas: Optional[str],
        cliente_id: Optional[UUID],
        proveedor_id: Optional[UUID],
        # Cheque
        cheque_numero: str,
        cheque_tipo: str,
        cheque_origen: str,
        cheque_banco_origen: Optional[str],
        cheque_fecha_emision: Optional[date],
        cheque_fecha_vencimiento: date,
        cheque_librador: Optional[str],
        cheque_cuit_librador: Optional[str],
        imagen_url: Optional[str],
    ) -> Tuple[Cheque, MovimientoTesoreria]:
        """
        Crea Cheque + MovimientoTesoreria vinculado en una sola transacción.
        Si es cheque recibido de cliente, también imputa en cuenta corriente.
        """
        cheque_cliente_id = str(cliente_id) if cliente_id else None
        cheque_proveedor_id = str(proveedor_id) if proveedor_id else None

        cheque = Cheque(
            id=str(uuid4()),
            numero=cheque_numero,
            tipo=cheque_tipo,
            origen=cheque_origen,
            estado=EstadoCheque.EN_CARTERA.value,
            monto=monto,
            fecha_emision=cheque_fecha_emision,
            fecha_vencimiento=cheque_fecha_vencimiento,
            banco_origen=cheque_banco_origen,
            cliente_id=cheque_cliente_id,
            proveedor_id=cheque_proveedor_id,
            librador=cheque_librador,
            cuit_librador=cheque_cuit_librador,
            notas=notas,
            imagen_url=imagen_url,
            registrado_por_id=str(usuario_id),
            fecha_registro=now_utc_naive(),
        )
        self.db.add(cheque)
        self.db.flush()  # id disponible

        movimiento = MovimientoTesoreria(
            id=str(uuid4()),
            tipo=tipo,
            concepto=concepto,
            monto=monto,
            es_ingreso=es_ingreso,
            fecha_movimiento=fecha_movimiento,
            fecha_valor=cheque_fecha_vencimiento,
            metodo_pago="cheque",
            cheque_id=str(cheque.id),
            cliente_id=cheque_cliente_id,
            proveedor_id=cheque_proveedor_id,
            notas=notas,
            registrado_por_id=str(usuario_id),
        )
        self.db.add(movimiento)

        # Si es cheque recibido de cliente, imputar como PAGO en cuenta corriente
        if cheque_origen == OrigenCheque.RECIBIDO_CLIENTE.value and cheque_cliente_id:
            self._imputar_cheque_cliente(
                cheque=cheque,
                cliente_id=cheque_cliente_id,
                usuario_id=str(usuario_id),
                es_pago=True,
            )

        self.db.commit()
        self.db.refresh(cheque)
        self.db.refresh(movimiento)
        return cheque, movimiento

    def _revertir_impactos_movimiento(self, movimiento: MovimientoTesoreria) -> None:
        """Revierte todos los side-effects que ``create_movimiento`` dejó al
        crear este ``MovimientoTesoreria``:

        - Saldo de la cuenta destino + soft-delete del MovimientoBancario espejo.
        - Saldo del cliente + soft-delete del MovimientoCuentaCorriente de
          pago + Recibo asociado.
        - Saldo del proveedor + soft-delete del MovimientoCuentaCorrienteProveedor.

        No commitea — queda a cargo del caller (anular / delete) para que
        toda la reversión sea atómica.
        """
        from app.models.cuenta_bancaria import MovimientoBancario
        from app.models.cuenta_corriente_proveedor import MovimientoCuentaCorrienteProveedor
        from datetime import timedelta

        # Para encontrar los registros espejo usamos una ventana de 5s alrededor
        # del created_at del movimiento + match de cuenta + monto. Es la mejor
        # heurística con el schema actual (no hay FK explícita).
        ventana_ini = movimiento.created_at - timedelta(seconds=5)
        ventana_fin = movimiento.created_at + timedelta(seconds=5)

        # 1. Cuenta bancaria destino
        if movimiento.cuenta_destino_id:
            cuenta = (
                self.db.query(CuentaBancaria)
                .filter(CuentaBancaria.id == str(movimiento.cuenta_destino_id))
                .first()
            )
            if cuenta is not None:
                # Revertimos el delta: si fue ingreso resto, si fue egreso sumo.
                delta = -movimiento.monto if movimiento.es_ingreso else movimiento.monto
                cuenta.saldo_actual = (cuenta.saldo_actual or Decimal("0")) + delta

            # Soft-delete del MovimientoBancario espejo (si existe).
            mov_banco = (
                self.db.query(MovimientoBancario)
                .filter(
                    MovimientoBancario.cuenta_id == str(movimiento.cuenta_destino_id),
                    MovimientoBancario.monto == movimiento.monto,
                    MovimientoBancario.created_at >= ventana_ini,
                    MovimientoBancario.created_at <= ventana_fin,
                )
                .first()
            )
            if mov_banco is not None:
                self.db.delete(mov_banco)

        # 2. Cuenta corriente del cliente (si no era cheque, que tiene su
        # propio flujo de reversión en los endpoints de cheque).
        if movimiento.cliente_id and movimiento.metodo_pago != "cheque":
            mov_cc = (
                self.db.query(MovimientoCuentaCorriente)
                .filter(
                    MovimientoCuentaCorriente.cliente_id == str(movimiento.cliente_id),
                    MovimientoCuentaCorriente.monto == movimiento.monto,
                    MovimientoCuentaCorriente.activo == True,
                    MovimientoCuentaCorriente.created_at >= ventana_ini,
                    MovimientoCuentaCorriente.created_at <= ventana_fin,
                )
                .first()
            )
            if mov_cc is not None:
                # Revertir saldo del cliente
                cliente = self.db.query(Cliente).filter(Cliente.id == movimiento.cliente_id).first()
                if cliente is not None:
                    # Si era un PAGO (ingreso), el cliente bajó deuda → al
                    # revertir vuelve a subir. Si era CARGO (egreso), vuelve a bajar.
                    delta = movimiento.monto if movimiento.es_ingreso else -movimiento.monto
                    cliente.saldo_cuenta_corriente = (
                        (cliente.saldo_cuenta_corriente or Decimal("0")) + delta
                    )
                # Recibo asociado al mov_cc (si lo había)
                if mov_cc.recibo_numero:
                    recibo = (
                        self.db.query(Recibo)
                        .filter(Recibo.numero == mov_cc.recibo_numero)
                        .first()
                    )
                    if recibo is not None:
                        self.db.delete(recibo)
                mov_cc.activo = False

        # 3. Cuenta corriente del proveedor
        if movimiento.proveedor_id and movimiento.metodo_pago != "cheque":
            mov_cc_prov = (
                self.db.query(MovimientoCuentaCorrienteProveedor)
                .filter(
                    MovimientoCuentaCorrienteProveedor.proveedor_id == str(movimiento.proveedor_id),
                    MovimientoCuentaCorrienteProveedor.monto == movimiento.monto,
                    MovimientoCuentaCorrienteProveedor.created_at >= ventana_ini,
                    MovimientoCuentaCorrienteProveedor.created_at <= ventana_fin,
                )
                .first()
            )
            if mov_cc_prov is not None:
                proveedor = (
                    self.db.query(Proveedor)
                    .filter(Proveedor.id == movimiento.proveedor_id)
                    .first()
                )
                if proveedor is not None:
                    # Si era PAGO al proveedor (egreso tuyo), bajaste deuda →
                    # al revertir vuelve a subir. Al revés si era CARGO.
                    delta = movimiento.monto if not movimiento.es_ingreso else -movimiento.monto
                    proveedor.saldo_cuenta_corriente = (
                        (proveedor.saldo_cuenta_corriente or Decimal("0")) + delta
                    )
                self.db.delete(mov_cc_prov)

    def anular_movimiento(
        self,
        movimiento_id: UUID,
        data: AnularMovimientoRequest,
        usuario_id: UUID
    ) -> MovimientoTesoreria:
        """Anula un movimiento de tesorería y revierte todos sus impactos
        laterales (saldos de cuenta, CC cliente/proveedor, recibo)."""
        movimiento = self.get_movimiento(movimiento_id)
        if not movimiento:
            raise ValueError("Movimiento no encontrado")

        if movimiento.anulado:
            raise ValueError("El movimiento ya está anulado")

        self._revertir_impactos_movimiento(movimiento)

        movimiento.anulado = True
        movimiento.motivo_anulacion = data.motivo
        movimiento.anulado_por_id = str(usuario_id)
        movimiento.fecha_anulacion = now_utc_naive()

        self.db.commit()
        self.db.refresh(movimiento)

        return movimiento

    def update_movimiento(
        self,
        movimiento_id: UUID,
        data: MovimientoTesoreriaUpdate,
        usuario_id: UUID
    ) -> MovimientoTesoreria:
        """Actualiza un movimiento de tesorería."""
        movimiento = self.get_movimiento(movimiento_id)
        if not movimiento:
            raise ValueError("Movimiento no encontrado")

        if movimiento.anulado:
            raise ValueError("No se puede editar un movimiento anulado")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field.endswith('_id') and value is not None:
                value = str(value)
            setattr(movimiento, field, value)

        self.db.commit()
        self.db.refresh(movimiento)

        return movimiento

    def delete_movimiento(
        self,
        movimiento_id: UUID,
        usuario_id: UUID
    ) -> bool:
        """Elimina (soft delete) un movimiento de tesorería y revierte todos
        sus impactos laterales (saldo de cuenta, CC cliente/proveedor,
        recibo). Antes solo anulaba el registro dejando los saldos
        cambiados — bug reportado por el usuario al ver que la cuenta
        bancaria seguia con el monto despues de eliminar el movimiento.
        """
        movimiento = self.get_movimiento(movimiento_id)
        if not movimiento:
            raise ValueError("Movimiento no encontrado")

        if movimiento.anulado:
            raise ValueError("El movimiento ya está anulado, no se puede eliminar")

        self._revertir_impactos_movimiento(movimiento)

        # Soft delete: marcar como anulado y desactivar
        movimiento.anulado = True
        movimiento.motivo_anulacion = "Eliminado por el usuario"
        movimiento.anulado_por_id = str(usuario_id)
        movimiento.fecha_anulacion = now_utc_naive()
        movimiento.activo = False

        self.db.commit()
        return True

    # ==================== TRANSFERENCIAS ENTRE CUENTAS ====================

    def transferir_entre_cuentas(
        self,
        *,
        cuenta_origen_id: Optional[UUID],
        cuenta_destino_id: Optional[UUID],
        monto: Decimal,
        fecha: date,
        concepto: str,
        notas: Optional[str],
        usuario_id: UUID,
    ) -> dict:
        """Transfiere monto de una cuenta propia a otra. Ambas cuentas son
        obligatorias (banco, efectivo o billetera virtual). Operación atómica."""
        from app.models.cuenta_bancaria import MovimientoBancario, TipoMovimientoBanco

        if cuenta_origen_id is None or cuenta_destino_id is None:
            raise ValueError("Elegí cuenta origen y cuenta destino")
        if cuenta_origen_id == cuenta_destino_id:
            raise ValueError("La cuenta origen y destino no pueden ser la misma")
        if monto <= 0:
            raise ValueError("El monto debe ser positivo")

        ref_transferencia = f"TR-{uuid4().hex[:12].upper()}"

        cuenta_origen_obj = (
            self.db.query(CuentaBancaria)
            .filter(CuentaBancaria.id == str(cuenta_origen_id))
            .first()
        )
        if not cuenta_origen_obj:
            raise ValueError("Cuenta origen no encontrada")

        cuenta_destino_obj = (
            self.db.query(CuentaBancaria)
            .filter(CuentaBancaria.id == str(cuenta_destino_id))
            .first()
        )
        if not cuenta_destino_obj:
            raise ValueError("Cuenta destino no encontrada")

        label_origen = cuenta_origen_obj.nombre or f"{cuenta_origen_obj.banco} - {cuenta_origen_obj.numero_cuenta}"
        label_destino = cuenta_destino_obj.nombre or f"{cuenta_destino_obj.banco} - {cuenta_destino_obj.numero_cuenta}"
        concepto_origen = f"{concepto} → {label_destino}"
        concepto_destino = f"{concepto} ← {label_origen}"

        # Dos MovimientoTesoreria vinculados por numero_transferencia.
        mov_origen = MovimientoTesoreria(
            id=str(uuid4()),
            tipo="transferencia_salida",
            concepto=concepto_origen,
            descripcion=notas,
            monto=monto,
            es_ingreso=False,
            fecha_movimiento=fecha,
            fecha_valor=fecha,
            metodo_pago="transferencia",
            cuenta_destino_id=str(cuenta_origen_id),
            numero_transferencia=ref_transferencia,
            notas=notas,
            registrado_por_id=str(usuario_id),
        )
        self.db.add(mov_origen)

        mov_destino = MovimientoTesoreria(
            id=str(uuid4()),
            tipo="transferencia_entrada",
            concepto=concepto_destino,
            descripcion=notas,
            monto=monto,
            es_ingreso=True,
            fecha_movimiento=fecha,
            fecha_valor=fecha,
            metodo_pago="transferencia",
            cuenta_destino_id=str(cuenta_destino_id),
            numero_transferencia=ref_transferencia,
            notas=notas,
            registrado_por_id=str(usuario_id),
        )
        self.db.add(mov_destino)

        # Saldos + MovimientoBancario de trail para cada cuenta.
        saldo_origen_prev = cuenta_origen_obj.saldo_actual or Decimal("0")
        saldo_origen_posterior = saldo_origen_prev - monto
        cuenta_origen_obj.saldo_actual = saldo_origen_posterior
        self.db.add(MovimientoBancario(
            id=str(uuid4()),
            cuenta_id=str(cuenta_origen_obj.id),
            tipo=TipoMovimientoBanco.TRANSFERENCIA_SALIDA.value,
            concepto=concepto_origen,
            monto=monto,
            saldo_anterior=saldo_origen_prev,
            saldo_posterior=saldo_origen_posterior,
            fecha_movimiento=fecha,
            fecha_valor=fecha,
            numero_comprobante=ref_transferencia,
            registrado_por_id=str(usuario_id),
        ))

        saldo_destino_prev = cuenta_destino_obj.saldo_actual or Decimal("0")
        saldo_destino_posterior = saldo_destino_prev + monto
        cuenta_destino_obj.saldo_actual = saldo_destino_posterior
        self.db.add(MovimientoBancario(
            id=str(uuid4()),
            cuenta_id=str(cuenta_destino_obj.id),
            tipo=TipoMovimientoBanco.TRANSFERENCIA_ENTRADA.value,
            concepto=concepto_destino,
            monto=monto,
            saldo_anterior=saldo_destino_prev,
            saldo_posterior=saldo_destino_posterior,
            fecha_movimiento=fecha,
            fecha_valor=fecha,
            numero_comprobante=ref_transferencia,
            registrado_por_id=str(usuario_id),
        ))

        self.db.commit()
        self.db.refresh(mov_origen)
        self.db.refresh(mov_destino)

        return {
            "movimiento_origen_id": str(mov_origen.id),
            "movimiento_destino_id": str(mov_destino.id),
            "cuenta_origen": label_origen,
            "cuenta_destino": label_destino,
            "monto": monto,
            "saldo_origen_posterior": saldo_origen_posterior,
            "saldo_destino_posterior": saldo_destino_posterior,
        }

    # ==================== RESUMEN ====================

    def get_resumen(
        self,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None
    ) -> ResumenTesoreria:
        """Obtiene resumen de tesorería."""
        hoy = today_ar()
        if not fecha_desde:
            fecha_desde = hoy.replace(day=1)
        if not fecha_hasta:
            fecha_hasta = hoy

        # Cheques en cartera
        cheques_cartera = self.db.query(
            func.count(Cheque.id),
            func.coalesce(func.sum(Cheque.monto), 0)
        ).filter(
            Cheque.activo == True,
            Cheque.estado == EstadoCheque.EN_CARTERA.value
        ).first()

        # Cheques próximos a vencer (7 días)
        fecha_limite = hoy + timedelta(days=7)
        cheques_proximos = self.db.query(
            func.count(Cheque.id),
            func.coalesce(func.sum(Cheque.monto), 0)
        ).filter(
            Cheque.activo == True,
            Cheque.estado == EstadoCheque.EN_CARTERA.value,
            Cheque.fecha_vencimiento <= fecha_limite,
            Cheque.fecha_vencimiento >= hoy
        ).first()

        # Cheques vencidos
        cheques_vencidos = self.db.query(
            func.count(Cheque.id),
            func.coalesce(func.sum(Cheque.monto), 0)
        ).filter(
            Cheque.activo == True,
            Cheque.estado == EstadoCheque.EN_CARTERA.value,
            Cheque.fecha_vencimiento < hoy
        ).first()

        # Movimientos del período - Ingresos
        ingresos_efectivo = self.db.query(
            func.coalesce(func.sum(MovimientoTesoreria.monto), 0)
        ).filter(
            MovimientoTesoreria.activo == True,
            MovimientoTesoreria.anulado == False,
            MovimientoTesoreria.es_ingreso == True,
            MovimientoTesoreria.metodo_pago == "efectivo",
            MovimientoTesoreria.fecha_movimiento >= fecha_desde,
            MovimientoTesoreria.fecha_movimiento <= fecha_hasta
        ).scalar() or Decimal("0")

        ingresos_transferencia = self.db.query(
            func.coalesce(func.sum(MovimientoTesoreria.monto), 0)
        ).filter(
            MovimientoTesoreria.activo == True,
            MovimientoTesoreria.anulado == False,
            MovimientoTesoreria.es_ingreso == True,
            MovimientoTesoreria.metodo_pago == "transferencia",
            MovimientoTesoreria.fecha_movimiento >= fecha_desde,
            MovimientoTesoreria.fecha_movimiento <= fecha_hasta
        ).scalar() or Decimal("0")

        ingresos_cheque = self.db.query(
            func.coalesce(func.sum(MovimientoTesoreria.monto), 0)
        ).filter(
            MovimientoTesoreria.activo == True,
            MovimientoTesoreria.anulado == False,
            MovimientoTesoreria.es_ingreso == True,
            MovimientoTesoreria.metodo_pago == "cheque",
            MovimientoTesoreria.fecha_movimiento >= fecha_desde,
            MovimientoTesoreria.fecha_movimiento <= fecha_hasta
        ).scalar() or Decimal("0")

        # Movimientos del período - Egresos
        egresos_efectivo = self.db.query(
            func.coalesce(func.sum(MovimientoTesoreria.monto), 0)
        ).filter(
            MovimientoTesoreria.activo == True,
            MovimientoTesoreria.anulado == False,
            MovimientoTesoreria.es_ingreso == False,
            MovimientoTesoreria.metodo_pago == "efectivo",
            MovimientoTesoreria.fecha_movimiento >= fecha_desde,
            MovimientoTesoreria.fecha_movimiento <= fecha_hasta
        ).scalar() or Decimal("0")

        egresos_transferencia = self.db.query(
            func.coalesce(func.sum(MovimientoTesoreria.monto), 0)
        ).filter(
            MovimientoTesoreria.activo == True,
            MovimientoTesoreria.anulado == False,
            MovimientoTesoreria.es_ingreso == False,
            MovimientoTesoreria.metodo_pago == "transferencia",
            MovimientoTesoreria.fecha_movimiento >= fecha_desde,
            MovimientoTesoreria.fecha_movimiento <= fecha_hasta
        ).scalar() or Decimal("0")

        egresos_cheque = self.db.query(
            func.coalesce(func.sum(MovimientoTesoreria.monto), 0)
        ).filter(
            MovimientoTesoreria.activo == True,
            MovimientoTesoreria.anulado == False,
            MovimientoTesoreria.es_ingreso == False,
            MovimientoTesoreria.metodo_pago == "cheque",
            MovimientoTesoreria.fecha_movimiento >= fecha_desde,
            MovimientoTesoreria.fecha_movimiento <= fecha_hasta
        ).scalar() or Decimal("0")

        total_ingresos = ingresos_efectivo + ingresos_transferencia + ingresos_cheque
        total_egresos = egresos_efectivo + egresos_transferencia + egresos_cheque

        return ResumenTesoreria(
            cheques_en_cartera=cheques_cartera[0] or 0,
            total_cheques_cartera=cheques_cartera[1] or Decimal("0"),
            cheques_proximos_vencer=cheques_proximos[0] or 0,
            total_proximos_vencer=cheques_proximos[1] or Decimal("0"),
            cheques_vencidos=cheques_vencidos[0] or 0,
            total_vencidos=cheques_vencidos[1] or Decimal("0"),
            total_ingresos_efectivo=ingresos_efectivo,
            total_ingresos_transferencia=ingresos_transferencia,
            total_ingresos_cheque=ingresos_cheque,
            total_egresos_efectivo=egresos_efectivo,
            total_egresos_transferencia=egresos_transferencia,
            total_egresos_cheque=egresos_cheque,
            saldo_periodo=total_ingresos - total_egresos,
        )

    # ==================== CUENTA CORRIENTE ====================

    def _imputar_a_cc_cliente(
        self,
        *,
        cliente_id: str,
        monto: Decimal,
        es_pago: bool,
        concepto: str,
        usuario_id: str,
        medio_pago: str,
        referencia_pago: Optional[str],
        fecha_movimiento: date,
        notas: Optional[str] = None,
        con_recibo: bool = True,
    ) -> MovimientoCuentaCorriente:
        """Impacta un movimiento en la cuenta corriente del cliente.

        Es el único punto que actualiza `cliente.saldo_cuenta_corriente` desde
        este módulo. Lo usan tanto el flujo de cheques (vía
        ``_imputar_cheque_cliente``) como el de movimientos directos de
        tesorería (vía ``create_movimiento``), evitando duplicación de la
        lógica de recálculo de saldos y generación de recibo.

        - ``es_pago=True`` → tipo PAGO, baja la deuda, genera recibo si
          ``con_recibo`` (es lo normal: un ingreso de cliente a tesorería ES un pago).
        - ``es_pago=False`` → tipo CARGO, aumenta la deuda (usado para
          reversiones: cheque rechazado, egreso al cliente por devolución).
        """
        cliente = self.db.query(Cliente).filter(Cliente.id == cliente_id).first()
        if not cliente:
            raise ValueError(f"Cliente no encontrado: {cliente_id}")

        saldo_anterior = cliente.saldo_cuenta_corriente or Decimal("0")
        delta = -monto if es_pago else monto
        saldo_posterior = saldo_anterior + delta

        numero_recibo: Optional[str] = None
        if es_pago and con_recibo:
            numero_recibo = self._generar_numero_recibo()
            self.db.add(Recibo(
                id=str(uuid4()),
                numero=numero_recibo,
                cliente_id=cliente_id,
                fecha=fecha_movimiento,
                monto_total=monto,
                medio_pago=medio_pago,
                referencia_pago=referencia_pago,
                emitido_por_id=usuario_id,
                notas=notas,
            ))

        movimiento = MovimientoCuentaCorriente(
            id=str(uuid4()),
            cliente_id=cliente_id,
            tipo=TipoMovimientoCC.PAGO.value if es_pago else TipoMovimientoCC.CARGO.value,
            concepto=concepto,
            monto=monto,
            saldo_anterior=saldo_anterior,
            saldo_posterior=saldo_posterior,
            medio_pago=medio_pago,
            referencia_pago=referencia_pago,
            fecha_movimiento=fecha_movimiento,
            registrado_por_id=usuario_id,
            recibo_numero=numero_recibo,
            notas=notas,
        )
        self.db.add(movimiento)
        cliente.saldo_cuenta_corriente = saldo_posterior
        return movimiento

    def _imputar_a_cc_proveedor(
        self,
        *,
        proveedor_id: str,
        monto: Decimal,
        es_pago: bool,
        concepto: str,
        usuario_id: str,
        fecha_movimiento: date,
        notas: Optional[str] = None,
    ) -> "MovimientoCuentaCorrienteProveedor":
        """Impacta un movimiento en la cuenta corriente del proveedor.

        - ``es_pago=True`` → tipo PAGO (le pagaste al proveedor → tu deuda con
          él baja).
        - ``es_pago=False`` → tipo CARGO (volvió a aumentar tu deuda, p.ej.
          por reversión / nota débito).
        """
        from app.models.cuenta_corriente_proveedor import (
            MovimientoCuentaCorrienteProveedor,
            TipoMovimientoCCProveedor,
        )
        proveedor = self.db.query(Proveedor).filter(Proveedor.id == proveedor_id).first()
        if not proveedor:
            raise ValueError(f"Proveedor no encontrado: {proveedor_id}")

        saldo_anterior = proveedor.saldo_cuenta_corriente or Decimal("0")
        delta = -monto if es_pago else monto
        saldo_posterior = saldo_anterior + delta

        movimiento = MovimientoCuentaCorrienteProveedor(
            id=str(uuid4()),
            proveedor_id=proveedor_id,
            tipo=(
                TipoMovimientoCCProveedor.PAGO.value
                if es_pago
                else TipoMovimientoCCProveedor.CARGO.value
            ),
            concepto=concepto,
            monto=monto,
            saldo_anterior=saldo_anterior,
            saldo_posterior=saldo_posterior,
            fecha_movimiento=fecha_movimiento,
            registrado_por_id=usuario_id,
            notas=notas,
        )
        self.db.add(movimiento)
        proveedor.saldo_cuenta_corriente = saldo_posterior
        return movimiento

    def _imputar_cheque_cliente(
        self,
        cheque: Cheque,
        cliente_id: str,
        usuario_id: str,
        es_pago: bool = True,
        motivo: Optional[str] = None
    ) -> MovimientoCuentaCorriente:
        """Wrapper específico para cheques: delega en ``_imputar_a_cc_cliente``
        armando el concepto y las notas con los datos del cheque."""
        if es_pago:
            concepto = f"Pago con cheque #{cheque.numero}"
            if cheque.banco_origen:
                concepto += f" - {cheque.banco_origen}"
        else:
            concepto = motivo or f"Reversión cheque rechazado #{cheque.numero}"

        notas = (
            f"Cheque #{cheque.numero} - Banco: {cheque.banco_origen or 'N/A'} "
            f"- Vto: {cheque.fecha_vencimiento}"
        )
        return self._imputar_a_cc_cliente(
            cliente_id=cliente_id,
            monto=cheque.monto,
            es_pago=es_pago,
            concepto=concepto,
            usuario_id=usuario_id,
            medio_pago="cheque",
            referencia_pago=f"CH-{cheque.numero}",
            fecha_movimiento=today_ar(),
            notas=notas,
        )

    def _generar_numero_recibo(self) -> str:
        """Genera número único de recibo."""
        hoy = today_ar()
        prefijo = f"REC-{hoy.strftime('%y%m%d')}"

        ultimo = (
            self.db.query(Recibo)
            .filter(Recibo.numero.like(f"{prefijo}-%"))
            .order_by(Recibo.numero.desc())
            .first()
        )

        if ultimo:
            numero = int(ultimo.numero.split("-")[-1]) + 1
        else:
            numero = 1

        return f"{prefijo}-{numero:04d}"

    # ==================== HELPERS ====================

    def enrich_cheque(self, cheque: Cheque) -> dict:
        """Enriquece un cheque con datos relacionados."""
        data = cheque.__dict__.copy()

        # Cliente
        if cheque.cliente_id:
            cliente = self.db.query(Cliente).filter(Cliente.id == cheque.cliente_id).first()
            data['cliente_nombre'] = cliente.razon_social if cliente else None

        # Proveedor
        if cheque.proveedor_id:
            proveedor = self.db.query(Proveedor).filter(Proveedor.id == cheque.proveedor_id).first()
            data['proveedor_nombre'] = proveedor.razon_social if proveedor else None

        # Usuario que registró
        if cheque.registrado_por_id:
            usuario = self.db.query(Usuario).filter(Usuario.id == cheque.registrado_por_id).first()
            data['registrado_por_nombre'] = f"{usuario.nombre} {usuario.apellido}" if usuario else None

        # Días para vencimiento
        if cheque.fecha_vencimiento:
            delta = (cheque.fecha_vencimiento - today_ar()).days
            data['dias_para_vencimiento'] = delta

        return data

    def enrich_movimiento(self, movimiento: MovimientoTesoreria) -> dict:
        """Enriquece un movimiento con datos relacionados."""
        from app.models.categoria_gasto import CategoriaGasto
        data = movimiento.__dict__.copy()

        # Cliente
        if movimiento.cliente_id:
            cliente = self.db.query(Cliente).filter(Cliente.id == movimiento.cliente_id).first()
            data['cliente_nombre'] = cliente.razon_social if cliente else None

        # Proveedor
        if movimiento.proveedor_id:
            proveedor = self.db.query(Proveedor).filter(Proveedor.id == movimiento.proveedor_id).first()
            data['proveedor_nombre'] = proveedor.razon_social if proveedor else None

        # Categoría de gasto (para egresos sin proveedor concreto).
        if movimiento.categoria_gasto_id:
            cat = (
                self.db.query(CategoriaGasto)
                .filter(CategoriaGasto.id == movimiento.categoria_gasto_id)
                .first()
            )
            data['categoria_gasto_nombre'] = cat.nombre if cat else None

        # Usuario que registró
        if movimiento.registrado_por_id:
            usuario = self.db.query(Usuario).filter(Usuario.id == movimiento.registrado_por_id).first()
            data['registrado_por_nombre'] = f"{usuario.nombre} {usuario.apellido}" if usuario else None

        # Cheque
        if movimiento.cheque_id:
            cheque = self.db.query(Cheque).filter(Cheque.id == movimiento.cheque_id).first()
            data['cheque_numero'] = cheque.numero if cheque else None

        return data

    # ==================== MOVIMIENTOS CONSOLIDADOS ====================

    def get_movimientos_consolidados(
        self,
        skip: int = 0,
        limit: int = 100,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
        tipo: Optional[str] = None,  # cheque, transferencia, efectivo, etc.
        es_ingreso: Optional[bool] = None,
        buscar: Optional[str] = None,
    ) -> dict:
        """
        Obtiene todos los movimientos financieros consolidados:
        - Cheques (cobrados/pagados/depositados)
        - Movimientos de tesorería
        - Movimientos bancarios
        """
        movimientos = []

        # 1. CHEQUES - Incluir TODOS los cheques activos
        cheques_query = self.db.query(Cheque).filter(
            Cheque.activo == True
        )

        if fecha_desde:
            cheques_query = cheques_query.filter(
                or_(
                    Cheque.fecha_cobro >= fecha_desde,
                    Cheque.created_at >= datetime.combine(fecha_desde, datetime.min.time())
                )
            )
        if fecha_hasta:
            cheques_query = cheques_query.filter(
                or_(
                    Cheque.fecha_cobro <= fecha_hasta,
                    Cheque.created_at <= datetime.combine(fecha_hasta, datetime.max.time())
                )
            )

        if buscar:
            cheques_query = cheques_query.filter(
                or_(
                    Cheque.numero.ilike(f"%{buscar}%"),
                    Cheque.banco_origen.ilike(f"%{buscar}%"),
                    Cheque.librador.ilike(f"%{buscar}%"),
                )
            )

        for cheque in cheques_query.all():
            # Determinar si es ingreso o egreso
            if cheque.origen == 'recibido_cliente':
                es_ing = True
                tipo_mov = 'cheque_recibido'
                concepto = f"Cheque recibido #{cheque.numero}"
            elif cheque.origen == 'emitido':
                es_ing = False
                tipo_mov = 'cheque_emitido'
                concepto = f"Cheque emitido #{cheque.numero}"
            else:
                es_ing = cheque.origen != 'emitido'
                tipo_mov = 'cheque'
                concepto = f"Cheque #{cheque.numero}"

            # Filtrar por tipo de ingreso/egreso
            if es_ingreso is not None and es_ing != es_ingreso:
                continue

            # Obtener nombres
            cliente_nombre = None
            proveedor_nombre = None
            if cheque.cliente_id:
                cliente = self.db.query(Cliente).filter(Cliente.id == cheque.cliente_id).first()
                cliente_nombre = cliente.razon_social if cliente else None
            if cheque.proveedor_id:
                proveedor = self.db.query(Proveedor).filter(Proveedor.id == cheque.proveedor_id).first()
                proveedor_nombre = proveedor.razon_social if proveedor else None

            fecha_mov = cheque.fecha_cobro or cheque.created_at.date()

            movimientos.append({
                'id': str(cheque.id),
                'fecha': fecha_mov,
                'tipo': tipo_mov,
                'origen': 'cheque',
                'concepto': concepto,
                'monto': cheque.monto,
                'es_ingreso': es_ing,
                'metodo_pago': 'cheque',
                'cliente_id': str(cheque.cliente_id) if cheque.cliente_id else None,
                'cliente_nombre': cliente_nombre,
                'proveedor_id': str(cheque.proveedor_id) if cheque.proveedor_id else None,
                'proveedor_nombre': proveedor_nombre,
                'numero_referencia': cheque.numero,
                'banco': cheque.banco_origen,
                'estado': cheque.estado,
                'created_at': cheque.created_at,
            })

        # 2. MOVIMIENTOS DE TESORERÍA
        mov_teso_query = self.db.query(MovimientoTesoreria).filter(
            MovimientoTesoreria.activo == True,
            MovimientoTesoreria.anulado == False
        )

        if fecha_desde:
            mov_teso_query = mov_teso_query.filter(MovimientoTesoreria.fecha_movimiento >= fecha_desde)
        if fecha_hasta:
            mov_teso_query = mov_teso_query.filter(MovimientoTesoreria.fecha_movimiento <= fecha_hasta)
        if es_ingreso is not None:
            mov_teso_query = mov_teso_query.filter(MovimientoTesoreria.es_ingreso == es_ingreso)
        if buscar:
            mov_teso_query = mov_teso_query.filter(
                or_(
                    MovimientoTesoreria.concepto.ilike(f"%{buscar}%"),
                    MovimientoTesoreria.descripcion.ilike(f"%{buscar}%"),
                )
            )

        from app.models.categoria_gasto import CategoriaGasto
        for mov in mov_teso_query.all():
            cliente_nombre = None
            proveedor_nombre = None
            categoria_gasto_nombre = None
            if mov.cliente_id:
                cliente = self.db.query(Cliente).filter(Cliente.id == mov.cliente_id).first()
                cliente_nombre = cliente.razon_social if cliente else None
            if mov.proveedor_id:
                proveedor = self.db.query(Proveedor).filter(Proveedor.id == mov.proveedor_id).first()
                proveedor_nombre = proveedor.razon_social if proveedor else None
            if mov.categoria_gasto_id:
                cat = (
                    self.db.query(CategoriaGasto)
                    .filter(CategoriaGasto.id == mov.categoria_gasto_id)
                    .first()
                )
                categoria_gasto_nombre = cat.nombre if cat else None

            movimientos.append({
                'id': str(mov.id),
                'fecha': mov.fecha_movimiento,
                'tipo': mov.tipo,
                'origen': 'movimiento_tesoreria',
                'concepto': mov.concepto,
                'monto': mov.monto,
                'es_ingreso': mov.es_ingreso,
                'metodo_pago': mov.metodo_pago,
                'cliente_id': str(mov.cliente_id) if mov.cliente_id else None,
                'cliente_nombre': cliente_nombre,
                'proveedor_id': str(mov.proveedor_id) if mov.proveedor_id else None,
                'proveedor_nombre': proveedor_nombre,
                'categoria_gasto_id': str(mov.categoria_gasto_id) if mov.categoria_gasto_id else None,
                'categoria_gasto_nombre': categoria_gasto_nombre,
                'numero_referencia': mov.numero_transferencia,
                'banco': mov.banco_origen or mov.banco_destino,
                'estado': None,
                'created_at': mov.created_at,
            })

        # Los MovimientoBancario son el "trail interno" de cada cuenta —
        # cada vez que se crea un MovimientoTesoreria con cuenta destino se
        # deja además una fila bancaria para reconstruir el historial de la
        # cuenta. NO los listamos acá para no duplicar (antes aparecían
        # dos filas por el mismo pago: una con botones editar/eliminar y
        # otra sin ellos) y para que los totales no cuenten doble. El
        # historial por cuenta se ve en el detalle de la cuenta puntual.

        # Ordenar por fecha descendente
        movimientos.sort(key=lambda x: (x['fecha'], x['created_at']), reverse=True)

        # Calcular totales
        total = len(movimientos)
        total_ingresos = sum(m['monto'] for m in movimientos if m['es_ingreso'])
        total_egresos = sum(m['monto'] for m in movimientos if not m['es_ingreso'])

        # Aplicar paginación
        movimientos_paginados = movimientos[skip:skip + limit]

        return {
            'items': movimientos_paginados,
            'total': total,
            'total_ingresos': total_ingresos,
            'total_egresos': total_egresos,
            'skip': skip,
            'limit': limit,
        }
