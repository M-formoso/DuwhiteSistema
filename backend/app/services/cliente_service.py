"""
Servicio de Clientes.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import uuid4

from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session

from app.models.cliente import Cliente
from app.models.pedido import Pedido, DetallePedido, EstadoPedido
from app.models.cuenta_corriente import (
    MovimientoCuentaCorriente,
    Recibo,
    DetalleRecibo,
    TipoMovimientoCC,
)
from app.schemas.cliente import ClienteCreate, ClienteUpdate
from app.schemas.pedido import PedidoCreate, PedidoUpdate, DetallePedidoCreate
from app.schemas.cuenta_corriente import MovimientoCCCreate, RegistrarPagoRequest


class ClienteService:
    """Servicio para gestión de clientes."""

    def __init__(self, db: Session):
        self.db = db

    # ==================== CLIENTES ====================

    def get_clientes(
        self,
        skip: int = 0,
        limit: int = 20,
        tipo: Optional[str] = None,
        activo: Optional[bool] = None,
        con_deuda: Optional[bool] = None,
        buscar: Optional[str] = None,
    ) -> Tuple[List[Cliente], int]:
        """Obtiene lista de clientes con filtros."""
        query = self.db.query(Cliente)

        if tipo:
            query = query.filter(Cliente.tipo == tipo)

        if activo is not None:
            query = query.filter(Cliente.activo == activo)

        if con_deuda is True:
            query = query.filter(Cliente.saldo_cuenta_corriente > 0)
        elif con_deuda is False:
            query = query.filter(Cliente.saldo_cuenta_corriente <= 0)

        if buscar:
            search = f"%{buscar}%"
            query = query.filter(
                or_(
                    Cliente.codigo.ilike(search),
                    Cliente.razon_social.ilike(search),
                    Cliente.nombre_fantasia.ilike(search),
                    Cliente.cuit.ilike(search),
                    Cliente.email.ilike(search),
                )
            )

        total = query.count()
        clientes = query.order_by(Cliente.razon_social).offset(skip).limit(limit).all()

        return clientes, total

    def get_cliente(self, cliente_id: str) -> Optional[Cliente]:
        """Obtiene un cliente por ID."""
        return self.db.query(Cliente).filter(Cliente.id == cliente_id).first()

    def get_cliente_by_codigo(self, codigo: str) -> Optional[Cliente]:
        """Obtiene un cliente por código."""
        return self.db.query(Cliente).filter(Cliente.codigo == codigo).first()

    def get_cliente_by_cuit(self, cuit: str) -> Optional[Cliente]:
        """Obtiene un cliente por CUIT."""
        return self.db.query(Cliente).filter(Cliente.cuit == cuit).first()

    def create_cliente(self, data: ClienteCreate) -> Cliente:
        """Crea un nuevo cliente."""
        # Generar código
        codigo = self._generar_codigo_cliente()

        cliente = Cliente(
            id=str(uuid4()),
            codigo=codigo,
            fecha_alta=date.today(),
            **data.model_dump(),
        )

        self.db.add(cliente)
        self.db.commit()
        self.db.refresh(cliente)

        return cliente

    def update_cliente(self, cliente_id: str, data: ClienteUpdate) -> Optional[Cliente]:
        """Actualiza un cliente."""
        cliente = self.get_cliente(cliente_id)
        if not cliente:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(cliente, field, value)

        self.db.commit()
        self.db.refresh(cliente)

        return cliente

    def get_clientes_lista(self) -> List[dict]:
        """Obtiene lista simplificada para selectores."""
        clientes = (
            self.db.query(Cliente)
            .filter(Cliente.activo == True)
            .order_by(Cliente.razon_social)
            .all()
        )

        return [
            {
                "id": str(c.id),
                "codigo": c.codigo,
                "nombre": c.nombre_display,
                "cuit": c.cuit,
            }
            for c in clientes
        ]

    def _generar_codigo_cliente(self) -> str:
        """Genera código único de cliente."""
        # Formato: CLI-XXXX
        ultimo = (
            self.db.query(Cliente)
            .filter(Cliente.codigo.like("CLI-%"))
            .order_by(Cliente.codigo.desc())
            .first()
        )

        if ultimo:
            numero = int(ultimo.codigo.split("-")[1]) + 1
        else:
            numero = 1

        return f"CLI-{numero:04d}"

    # ==================== PEDIDOS ====================

    def get_pedidos(
        self,
        skip: int = 0,
        limit: int = 20,
        cliente_id: Optional[str] = None,
        estado: Optional[str] = None,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
    ) -> Tuple[List[Pedido], int]:
        """Obtiene lista de pedidos con filtros."""
        query = self.db.query(Pedido).filter(Pedido.is_active == True)

        if cliente_id:
            query = query.filter(Pedido.cliente_id == cliente_id)

        if estado:
            query = query.filter(Pedido.estado == estado)

        if fecha_desde:
            query = query.filter(Pedido.fecha_pedido >= fecha_desde)

        if fecha_hasta:
            query = query.filter(Pedido.fecha_pedido <= fecha_hasta)

        total = query.count()
        pedidos = query.order_by(Pedido.fecha_pedido.desc()).offset(skip).limit(limit).all()

        return pedidos, total

    def get_pedido(self, pedido_id: str) -> Optional[Pedido]:
        """Obtiene un pedido por ID."""
        return self.db.query(Pedido).filter(Pedido.id == pedido_id).first()

    def create_pedido(self, data: PedidoCreate, usuario_id: str) -> Pedido:
        """Crea un nuevo pedido."""
        # Generar número
        numero = self._generar_numero_pedido()

        pedido = Pedido(
            id=str(uuid4()),
            numero=numero,
            cliente_id=data.cliente_id,
            fecha_pedido=data.fecha_pedido,
            fecha_retiro=data.fecha_retiro,
            fecha_entrega_estimada=data.fecha_entrega_estimada,
            tipo_entrega=data.tipo_entrega,
            direccion_entrega=data.direccion_entrega,
            horario_entrega=data.horario_entrega,
            descuento_porcentaje=data.descuento_porcentaje,
            notas=data.notas,
            notas_internas=data.notas_internas,
            observaciones_entrega=data.observaciones_entrega,
            creado_por_id=usuario_id,
            estado=EstadoPedido.BORRADOR.value,
        )

        self.db.add(pedido)

        # Agregar detalles
        for detalle_data in data.detalles:
            self._agregar_detalle_pedido(pedido, detalle_data)

        # Calcular totales
        self._calcular_totales_pedido(pedido)

        self.db.commit()
        self.db.refresh(pedido)

        return pedido

    def update_pedido(self, pedido_id: str, data: PedidoUpdate) -> Optional[Pedido]:
        """Actualiza un pedido."""
        pedido = self.get_pedido(pedido_id)
        if not pedido:
            return None

        if pedido.estado not in [EstadoPedido.BORRADOR.value, EstadoPedido.CONFIRMADO.value]:
            raise ValueError("No se puede modificar un pedido en este estado")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(pedido, field, value)

        # Recalcular totales si cambió el descuento
        if "descuento_porcentaje" in update_data:
            self._calcular_totales_pedido(pedido)

        self.db.commit()
        self.db.refresh(pedido)

        return pedido

    def agregar_detalle_pedido(
        self, pedido_id: str, detalle: DetallePedidoCreate
    ) -> Optional[Pedido]:
        """Agrega un detalle a un pedido."""
        pedido = self.get_pedido(pedido_id)
        if not pedido:
            return None

        if pedido.estado not in [EstadoPedido.BORRADOR.value]:
            raise ValueError("No se pueden agregar items a un pedido confirmado")

        self._agregar_detalle_pedido(pedido, detalle)
        self._calcular_totales_pedido(pedido)

        self.db.commit()
        self.db.refresh(pedido)

        return pedido

    def cambiar_estado_pedido(
        self, pedido_id: str, nuevo_estado: str, observaciones: Optional[str] = None
    ) -> Optional[Pedido]:
        """Cambia el estado de un pedido."""
        pedido = self.get_pedido(pedido_id)
        if not pedido:
            return None

        # Validar transición de estado
        transiciones_validas = {
            EstadoPedido.BORRADOR.value: [EstadoPedido.CONFIRMADO.value, EstadoPedido.CANCELADO.value],
            EstadoPedido.CONFIRMADO.value: [EstadoPedido.EN_PROCESO.value, EstadoPedido.CANCELADO.value],
            EstadoPedido.EN_PROCESO.value: [EstadoPedido.LISTO.value, EstadoPedido.CANCELADO.value],
            EstadoPedido.LISTO.value: [EstadoPedido.ENTREGADO.value],
            EstadoPedido.ENTREGADO.value: [EstadoPedido.FACTURADO.value],
        }

        if nuevo_estado not in transiciones_validas.get(pedido.estado, []):
            raise ValueError(f"No se puede cambiar de {pedido.estado} a {nuevo_estado}")

        pedido.estado = nuevo_estado

        # Acciones según nuevo estado
        if nuevo_estado == EstadoPedido.ENTREGADO.value:
            pedido.fecha_entrega_real = date.today()
            # Actualizar fecha última compra del cliente
            cliente = self.get_cliente(str(pedido.cliente_id))
            if cliente:
                cliente.fecha_ultima_compra = date.today()

        self.db.commit()
        self.db.refresh(pedido)

        return pedido

    def _agregar_detalle_pedido(self, pedido: Pedido, data: DetallePedidoCreate) -> None:
        """Agrega un detalle al pedido."""
        subtotal = data.cantidad * data.precio_unitario
        if data.descuento_porcentaje:
            subtotal = subtotal * (1 - data.descuento_porcentaje / 100)

        detalle = DetallePedido(
            id=str(uuid4()),
            pedido_id=pedido.id,
            servicio_id=data.servicio_id,
            descripcion=data.descripcion,
            cantidad=data.cantidad,
            unidad=data.unidad,
            precio_unitario=data.precio_unitario,
            descuento_porcentaje=data.descuento_porcentaje,
            subtotal=subtotal,
            notas=data.notas,
        )

        self.db.add(detalle)

    def _calcular_totales_pedido(self, pedido: Pedido) -> None:
        """Calcula los totales del pedido."""
        self.db.flush()  # Asegurar que los detalles estén en BD

        # Subtotal de todos los detalles
        subtotal = sum(d.subtotal for d in pedido.detalles) if pedido.detalles else Decimal("0")
        pedido.subtotal = subtotal

        # Aplicar descuento general
        descuento_monto = Decimal("0")
        if pedido.descuento_porcentaje and pedido.descuento_porcentaje > 0:
            descuento_monto = subtotal * (pedido.descuento_porcentaje / 100)
        pedido.descuento_monto = descuento_monto

        # Base imponible
        base = subtotal - descuento_monto

        # IVA 21%
        pedido.iva = base * Decimal("0.21")

        # Total
        pedido.total = base + pedido.iva
        pedido.saldo_pendiente = pedido.total

    def _generar_numero_pedido(self) -> str:
        """Genera número único de pedido."""
        # Formato: PED-YYMMDD-XXXX
        hoy = date.today()
        prefijo = f"PED-{hoy.strftime('%y%m%d')}"

        ultimo = (
            self.db.query(Pedido)
            .filter(Pedido.numero.like(f"{prefijo}-%"))
            .order_by(Pedido.numero.desc())
            .first()
        )

        if ultimo:
            numero = int(ultimo.numero.split("-")[-1]) + 1
        else:
            numero = 1

        return f"{prefijo}-{numero:04d}"

    # ==================== CUENTA CORRIENTE ====================

    def get_movimientos_cuenta(
        self,
        cliente_id: str,
        skip: int = 0,
        limit: int = 50,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
    ) -> Tuple[List[MovimientoCuentaCorriente], int]:
        """Obtiene movimientos de cuenta corriente de un cliente."""
        query = self.db.query(MovimientoCuentaCorriente).filter(
            MovimientoCuentaCorriente.cliente_id == cliente_id
        )

        if fecha_desde:
            query = query.filter(MovimientoCuentaCorriente.fecha_movimiento >= fecha_desde)

        if fecha_hasta:
            query = query.filter(MovimientoCuentaCorriente.fecha_movimiento <= fecha_hasta)

        total = query.count()
        movimientos = (
            query.order_by(MovimientoCuentaCorriente.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return movimientos, total

    def registrar_cargo(
        self,
        cliente_id: str,
        monto: Decimal,
        concepto: str,
        usuario_id: str,
        pedido_id: Optional[str] = None,
        factura_numero: Optional[str] = None,
        fecha_vencimiento: Optional[date] = None,
    ) -> MovimientoCuentaCorriente:
        """Registra un cargo (aumenta deuda) en cuenta corriente."""
        cliente = self.get_cliente(cliente_id)
        if not cliente:
            raise ValueError("Cliente no encontrado")

        saldo_anterior = cliente.saldo_cuenta_corriente
        saldo_posterior = saldo_anterior + monto

        movimiento = MovimientoCuentaCorriente(
            id=str(uuid4()),
            cliente_id=cliente_id,
            tipo=TipoMovimientoCC.CARGO.value,
            concepto=concepto,
            monto=monto,
            saldo_anterior=saldo_anterior,
            saldo_posterior=saldo_posterior,
            pedido_id=pedido_id,
            factura_numero=factura_numero,
            fecha_movimiento=date.today(),
            fecha_vencimiento=fecha_vencimiento,
            registrado_por_id=usuario_id,
        )

        self.db.add(movimiento)

        # Actualizar saldo del cliente
        cliente.saldo_cuenta_corriente = saldo_posterior

        self.db.commit()
        self.db.refresh(movimiento)

        return movimiento

    def registrar_pago(
        self,
        data: RegistrarPagoRequest,
        usuario_id: str,
    ) -> Tuple[Recibo, MovimientoCuentaCorriente]:
        """Registra un pago (disminuye deuda) y genera recibo."""
        cliente = self.get_cliente(data.cliente_id)
        if not cliente:
            raise ValueError("Cliente no encontrado")

        saldo_anterior = cliente.saldo_cuenta_corriente
        saldo_posterior = saldo_anterior - data.monto

        # Crear movimiento
        movimiento = MovimientoCuentaCorriente(
            id=str(uuid4()),
            cliente_id=data.cliente_id,
            tipo=TipoMovimientoCC.PAGO.value,
            concepto=f"Pago recibido - {data.medio_pago}",
            monto=data.monto,
            saldo_anterior=saldo_anterior,
            saldo_posterior=saldo_posterior,
            medio_pago=data.medio_pago,
            referencia_pago=data.referencia_pago,
            fecha_movimiento=data.fecha,
            registrado_por_id=usuario_id,
            notas=data.notas,
        )

        self.db.add(movimiento)

        # Generar recibo
        numero_recibo = self._generar_numero_recibo()

        recibo = Recibo(
            id=str(uuid4()),
            numero=numero_recibo,
            cliente_id=data.cliente_id,
            fecha=data.fecha,
            monto_total=data.monto,
            medio_pago=data.medio_pago,
            referencia_pago=data.referencia_pago,
            emitido_por_id=usuario_id,
            notas=data.notas,
        )

        self.db.add(recibo)

        # Actualizar número de recibo en movimiento
        movimiento.recibo_numero = numero_recibo

        # Actualizar saldo del cliente
        cliente.saldo_cuenta_corriente = saldo_posterior

        # Si se especificaron pedidos, actualizar sus saldos
        if data.aplicar_a_pedidos:
            monto_restante = data.monto
            for pedido_id in data.aplicar_a_pedidos:
                if monto_restante <= 0:
                    break

                pedido = self.get_pedido(pedido_id)
                if pedido and pedido.saldo_pendiente > 0:
                    aplicar = min(monto_restante, pedido.saldo_pendiente)
                    pedido.saldo_pendiente -= aplicar
                    monto_restante -= aplicar

                    # Agregar detalle al recibo
                    detalle = DetalleRecibo(
                        id=str(uuid4()),
                        recibo_id=recibo.id,
                        pedido_id=pedido_id,
                        descripcion=f"Pago pedido {pedido.numero}",
                        monto=aplicar,
                    )
                    self.db.add(detalle)

        self.db.commit()
        self.db.refresh(recibo)
        self.db.refresh(movimiento)

        return recibo, movimiento

    def get_estado_cuenta(self, cliente_id: str) -> dict:
        """Obtiene resumen del estado de cuenta de un cliente."""
        cliente = self.get_cliente(cliente_id)
        if not cliente:
            raise ValueError("Cliente no encontrado")

        # Calcular totales del mes
        hoy = date.today()
        primer_dia_mes = hoy.replace(day=1)

        total_facturado_mes = (
            self.db.query(func.sum(MovimientoCuentaCorriente.monto))
            .filter(
                MovimientoCuentaCorriente.cliente_id == cliente_id,
                MovimientoCuentaCorriente.tipo == TipoMovimientoCC.CARGO.value,
                MovimientoCuentaCorriente.fecha_movimiento >= primer_dia_mes,
            )
            .scalar()
            or Decimal("0")
        )

        total_pagado_mes = (
            self.db.query(func.sum(MovimientoCuentaCorriente.monto))
            .filter(
                MovimientoCuentaCorriente.cliente_id == cliente_id,
                MovimientoCuentaCorriente.tipo == TipoMovimientoCC.PAGO.value,
                MovimientoCuentaCorriente.fecha_movimiento >= primer_dia_mes,
            )
            .scalar()
            or Decimal("0")
        )

        # Pedidos con saldo pendiente
        pedidos_pendientes = (
            self.db.query(Pedido)
            .filter(
                Pedido.cliente_id == cliente_id,
                Pedido.saldo_pendiente > 0,
            )
            .all()
        )

        # Días desde factura más antigua
        factura_mas_antigua = None
        if pedidos_pendientes:
            fecha_mas_antigua = min(p.fecha_pedido for p in pedidos_pendientes)
            factura_mas_antigua = (hoy - fecha_mas_antigua).days

        # Crédito disponible
        credito_disponible = None
        if cliente.limite_credito:
            credito_disponible = cliente.limite_credito - cliente.saldo_cuenta_corriente

        return {
            "cliente_id": str(cliente.id),
            "cliente_nombre": cliente.nombre_display,
            "saldo_actual": cliente.saldo_cuenta_corriente,
            "limite_credito": cliente.limite_credito,
            "credito_disponible": credito_disponible,
            "total_facturado_mes": total_facturado_mes,
            "total_pagado_mes": total_pagado_mes,
            "cantidad_facturas_pendientes": len(pedidos_pendientes),
            "factura_mas_antigua_dias": factura_mas_antigua,
        }

    def _generar_numero_recibo(self) -> str:
        """Genera número único de recibo."""
        # Formato: REC-YYMMDD-XXXX
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
