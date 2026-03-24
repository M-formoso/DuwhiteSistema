"""
Servicio de Tesorería.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import UUID, uuid4

from sqlalchemy import func, or_, and_, desc
from sqlalchemy.orm import Session

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
                Cheque.fecha_vencimiento < date.today(),
                Cheque.estado == EstadoCheque.EN_CARTERA.value
            )

        if proximos_vencer:
            fecha_limite = date.today() + timedelta(days=7)
            query = query.filter(
                Cheque.fecha_vencimiento <= fecha_limite,
                Cheque.fecha_vencimiento >= date.today(),
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
            fecha_registro=datetime.now(),
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
        """Crea un nuevo movimiento de tesorería."""
        # Si es con cheque existente, verificar
        if data.cheque_id:
            cheque = self.get_cheque(data.cheque_id)
            if not cheque:
                raise ValueError("Cheque no encontrado")

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
            notas=data.notas,
            comprobante=data.comprobante,
            registrado_por_id=str(registrado_por_id),
        )

        self.db.add(movimiento)
        self.db.commit()
        self.db.refresh(movimiento)

        return movimiento

    def anular_movimiento(
        self,
        movimiento_id: UUID,
        data: AnularMovimientoRequest,
        usuario_id: UUID
    ) -> MovimientoTesoreria:
        """Anula un movimiento de tesorería."""
        movimiento = self.get_movimiento(movimiento_id)
        if not movimiento:
            raise ValueError("Movimiento no encontrado")

        if movimiento.anulado:
            raise ValueError("El movimiento ya está anulado")

        movimiento.anulado = True
        movimiento.motivo_anulacion = data.motivo
        movimiento.anulado_por_id = str(usuario_id)
        movimiento.fecha_anulacion = datetime.now()

        self.db.commit()
        self.db.refresh(movimiento)

        return movimiento

    # ==================== RESUMEN ====================

    def get_resumen(
        self,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None
    ) -> ResumenTesoreria:
        """Obtiene resumen de tesorería."""
        hoy = date.today()
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

    def _imputar_cheque_cliente(
        self,
        cheque: Cheque,
        cliente_id: str,
        usuario_id: str,
        es_pago: bool = True,
        motivo: Optional[str] = None
    ) -> MovimientoCuentaCorriente:
        """
        Imputa un cheque a la cuenta corriente del cliente.

        Args:
            cheque: El cheque a imputar
            cliente_id: ID del cliente
            usuario_id: ID del usuario que registra
            es_pago: True = pago (disminuye deuda), False = cargo (aumenta deuda, ej: rechazo)
            motivo: Motivo opcional (usado en rechazos)

        Returns:
            MovimientoCuentaCorriente creado
        """
        cliente = self.db.query(Cliente).filter(Cliente.id == cliente_id).first()
        if not cliente:
            raise ValueError(f"Cliente no encontrado: {cliente_id}")

        saldo_anterior = cliente.saldo_cuenta_corriente or Decimal("0")

        if es_pago:
            # Pago: disminuye la deuda del cliente
            tipo = TipoMovimientoCC.PAGO.value
            saldo_posterior = saldo_anterior - cheque.monto
            concepto = f"Pago con cheque #{cheque.numero}"
            if cheque.banco_origen:
                concepto += f" - {cheque.banco_origen}"

            # Generar número de recibo
            numero_recibo = self._generar_numero_recibo()

            # Crear recibo
            recibo = Recibo(
                id=str(uuid4()),
                numero=numero_recibo,
                cliente_id=cliente_id,
                fecha=date.today(),
                monto_total=cheque.monto,
                medio_pago="cheque",
                referencia_pago=f"CH-{cheque.numero}",
                emitido_por_id=usuario_id,
                notas=f"Cheque {cheque.numero} - Vto: {cheque.fecha_vencimiento}",
            )
            self.db.add(recibo)
        else:
            # Cargo (reversión por rechazo): aumenta la deuda del cliente
            tipo = TipoMovimientoCC.CARGO.value
            saldo_posterior = saldo_anterior + cheque.monto
            concepto = motivo or f"Reversión cheque rechazado #{cheque.numero}"
            numero_recibo = None

        movimiento = MovimientoCuentaCorriente(
            id=str(uuid4()),
            cliente_id=cliente_id,
            tipo=tipo,
            concepto=concepto,
            monto=cheque.monto,
            saldo_anterior=saldo_anterior,
            saldo_posterior=saldo_posterior,
            medio_pago="cheque",
            referencia_pago=f"CH-{cheque.numero}",
            fecha_movimiento=date.today(),
            registrado_por_id=usuario_id,
            recibo_numero=numero_recibo if es_pago else None,
            notas=f"Cheque #{cheque.numero} - Banco: {cheque.banco_origen or 'N/A'} - Vto: {cheque.fecha_vencimiento}",
        )

        self.db.add(movimiento)

        # Actualizar saldo del cliente
        cliente.saldo_cuenta_corriente = saldo_posterior

        return movimiento

    def _generar_numero_recibo(self) -> str:
        """Genera número único de recibo."""
        hoy = date.today()
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
            delta = (cheque.fecha_vencimiento - date.today()).days
            data['dias_para_vencimiento'] = delta

        return data

    def enrich_movimiento(self, movimiento: MovimientoTesoreria) -> dict:
        """Enriquece un movimiento con datos relacionados."""
        data = movimiento.__dict__.copy()

        # Cliente
        if movimiento.cliente_id:
            cliente = self.db.query(Cliente).filter(Cliente.id == movimiento.cliente_id).first()
            data['cliente_nombre'] = cliente.razon_social if cliente else None

        # Proveedor
        if movimiento.proveedor_id:
            proveedor = self.db.query(Proveedor).filter(Proveedor.id == movimiento.proveedor_id).first()
            data['proveedor_nombre'] = proveedor.razon_social if proveedor else None

        # Usuario que registró
        if movimiento.registrado_por_id:
            usuario = self.db.query(Usuario).filter(Usuario.id == movimiento.registrado_por_id).first()
            data['registrado_por_nombre'] = f"{usuario.nombre} {usuario.apellido}" if usuario else None

        # Cheque
        if movimiento.cheque_id:
            cheque = self.db.query(Cheque).filter(Cheque.id == movimiento.cheque_id).first()
            data['cheque_numero'] = cheque.numero if cheque else None

        return data
