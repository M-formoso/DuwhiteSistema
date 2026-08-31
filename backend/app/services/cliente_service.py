"""
Servicio de Clientes.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import UUID, uuid4

from sqlalchemy import func, or_, and_, case
from sqlalchemy.orm import Session

from app.models.cliente import Cliente
from app.models.titular_fiscal import TitularFiscal
from app.models.pedido import Pedido, DetallePedido, EstadoPedido
from app.models.cuenta_corriente import (
    MovimientoCuentaCorriente,
    Recibo,
    DetalleRecibo,
    TipoMovimientoCC,
)
from app.models.tesoreria import (
    MovimientoTesoreria,
    TipoMovimientoTesoreria,
    Cheque,
    TipoCheque,
    OrigenCheque,
    EstadoCheque,
)
from app.models.caja import (
    Caja,
    MovimientoCaja,
    EstadoCaja,
    TipoMovimientoCaja,
    CategoriaMovimiento,
)
from app.models.factura import Factura, EstadoFactura, TipoComprobante
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
        orden: Optional[str] = None,
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
            # El CUIT vive en TitularFiscal — outer-join para no perder
            # clientes sin titular.
            query = query.outerjoin(
                TitularFiscal, Cliente.titular_fiscal_id == TitularFiscal.id
            ).filter(
                or_(
                    Cliente.codigo.ilike(search),
                    Cliente.razon_social.ilike(search),
                    Cliente.nombre_fantasia.ilike(search),
                    TitularFiscal.cuit.ilike(search),
                    Cliente.email.ilike(search),
                )
            )

        total = query.count()

        # Aplicar ordenamiento.
        # El frontend muestra `nombre_fantasia || razon_social` (cae con string vacío también),
        # así que el orden debe replicar lo mismo: NULLIF convierte '' en NULL para que el
        # COALESCE caiga a razon_social. UPPER hace que el orden sea case-insensitive.
        nombre_display = func.upper(
            func.coalesce(
                func.nullif(func.trim(Cliente.nombre_fantasia), ''),
                Cliente.razon_social,
            )
        )

        if orden == "saldo_desc":
            query = query.order_by(Cliente.saldo_cuenta_corriente.desc(), nombre_display)
        elif orden == "saldo_asc":
            query = query.order_by(Cliente.saldo_cuenta_corriente.asc(), nombre_display)
        elif orden == "codigo":
            query = query.order_by(Cliente.codigo)
        else:  # "nombre" o default
            query = query.order_by(nombre_display)

        clientes = query.offset(skip).limit(limit).all()

        return clientes, total

    def get_cliente(self, cliente_id: str) -> Optional[Cliente]:
        """Obtiene un cliente por ID."""
        return self.db.query(Cliente).filter(Cliente.id == cliente_id).first()

    def get_cliente_by_codigo(self, codigo: str) -> Optional[Cliente]:
        """Obtiene un cliente por código."""
        return self.db.query(Cliente).filter(Cliente.codigo == codigo).first()

    def get_clientes_by_cuit(self, cuit: str) -> List[Cliente]:
        """Obtiene todos los clientes bajo un titular fiscal con ese CUIT."""
        titular = self.db.query(TitularFiscal).filter(TitularFiscal.cuit == cuit).first()
        if not titular:
            return []
        return self.db.query(Cliente).filter(Cliente.titular_fiscal_id == titular.id).all()

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
        nombre_display = func.upper(
            func.coalesce(
                func.nullif(func.trim(Cliente.nombre_fantasia), ''),
                Cliente.razon_social,
            )
        )
        clientes = (
            self.db.query(Cliente)
            .filter(Cliente.activo == True)
            .order_by(nombre_display)
            .all()
        )

        return [
            {
                "id": str(c.id),
                "codigo": c.codigo,
                "nombre": c.nombre_display,
                "cuit": c.cuit,
                "lista_precios_id": str(c.lista_precios_id) if c.lista_precios_id else None,
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
        query = self.db.query(Pedido).filter(Pedido.activo == True)

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
        self,
        pedido_id: str,
        nuevo_estado: str,
        observaciones: Optional[str] = None,
        usuario_id: Optional[str] = None,
    ) -> Optional[Pedido]:
        """Cambia el estado de un pedido."""
        pedido = self.get_pedido(pedido_id)
        if not pedido:
            return None

        # Validar transición de estado
        transiciones_validas = {
            EstadoPedido.BORRADOR.value: [EstadoPedido.CONFIRMADO.value, EstadoPedido.CANCELADO.value],
            EstadoPedido.CONFIRMADO.value: [EstadoPedido.EN_PROCESO.value, EstadoPedido.LISTO.value, EstadoPedido.CANCELADO.value],
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
            MovimientoCuentaCorriente.cliente_id == cliente_id,
            MovimientoCuentaCorriente.activo == True,
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
        lote_id: Optional[str] = None,
        factura_numero: Optional[str] = None,
        fecha_vencimiento: Optional[date] = None,
        estado_facturacion: Optional[str] = "sin_facturar",
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
            lote_id=lote_id,
            factura_numero=factura_numero,
            estado_facturacion=estado_facturacion,
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

    def registrar_ajuste(
        self,
        cliente_id: str,
        monto: Decimal,
        direccion: str,
        concepto: str,
        fecha: date,
        usuario_id: str,
        notas: Optional[str] = None,
    ) -> MovimientoCuentaCorriente:
        """
        Registra un ajuste manual de saldo en la cuenta corriente del cliente.

        `direccion='aumentar'` suma al saldo (débito, aumenta deuda).
        `direccion='disminuir'` resta al saldo (crédito, reduce deuda).

        Queda como un movimiento tipo AJUSTE inmutable — el signo se infiere
        del delta `saldo_posterior - saldo_anterior`.
        """
        if direccion not in ("aumentar", "disminuir"):
            raise ValueError("direccion debe ser 'aumentar' o 'disminuir'")
        if monto is None or Decimal(monto) <= 0:
            raise ValueError("El monto del ajuste debe ser positivo")

        cliente = self.get_cliente(cliente_id)
        if not cliente:
            raise ValueError("Cliente no encontrado")

        monto_pos = Decimal(monto)
        delta = monto_pos if direccion == "aumentar" else -monto_pos
        saldo_anterior = cliente.saldo_cuenta_corriente or Decimal(0)
        saldo_posterior = saldo_anterior + delta

        movimiento = MovimientoCuentaCorriente(
            id=str(uuid4()),
            cliente_id=cliente_id,
            tipo=TipoMovimientoCC.AJUSTE.value,
            concepto=concepto,
            monto=monto_pos,
            saldo_anterior=saldo_anterior,
            saldo_posterior=saldo_posterior,
            fecha_movimiento=fecha,
            registrado_por_id=usuario_id,
            notas=notas,
        )

        self.db.add(movimiento)
        cliente.saldo_cuenta_corriente = saldo_posterior

        self.db.commit()
        self.db.refresh(movimiento)

        return movimiento

    def editar_ajuste(
        self,
        movimiento_id: str,
        monto: Optional[Decimal] = None,
        direccion: Optional[str] = None,
        concepto: Optional[str] = None,
        fecha: Optional[date] = None,
        notas: Optional[str] = None,
    ) -> MovimientoCuentaCorriente:
        """
        Edita un movimiento tipo AJUSTE, PAGO o CARGO.

        Si cambia el monto/dirección, recalcula saldo_anterior/posterior de este
        movimiento y de todos los movimientos POSTERIORES del mismo cliente
        (ordenados por created_at), y actualiza el saldo del cliente.

        - PAGO: dirección forzada a 'disminuir'. NO revierte movimientos de
          tesorería/cajas/cheques vinculados.
        - CARGO: dirección forzada a 'aumentar'. NO modifica el remito ni sus
          detalles (productos, cantidades). Solo actualiza el movimiento CC.
        """
        movimiento = self.db.query(MovimientoCuentaCorriente).filter(
            MovimientoCuentaCorriente.id == movimiento_id
        ).first()
        if not movimiento:
            raise ValueError("Movimiento no encontrado")
        if movimiento.tipo not in (
            TipoMovimientoCC.AJUSTE.value,
            TipoMovimientoCC.PAGO.value,
            TipoMovimientoCC.CARGO.value,
        ):
            raise ValueError("Tipo de movimiento no editable")
        if movimiento.tipo == TipoMovimientoCC.PAGO.value:
            direccion = "disminuir"
        elif movimiento.tipo == TipoMovimientoCC.CARGO.value:
            direccion = "aumentar"

        cliente = self.get_cliente(str(movimiento.cliente_id))
        if not cliente:
            raise ValueError("Cliente del movimiento no encontrado")

        # Dirección actual inferida del delta original
        delta_actual = Decimal(movimiento.saldo_posterior) - Decimal(movimiento.saldo_anterior)
        direccion_actual = "aumentar" if delta_actual >= 0 else "disminuir"

        nueva_direccion = direccion or direccion_actual
        if nueva_direccion not in ("aumentar", "disminuir"):
            raise ValueError("direccion debe ser 'aumentar' o 'disminuir'")

        nuevo_monto = Decimal(monto) if monto is not None else Decimal(movimiento.monto)
        if nuevo_monto <= 0:
            raise ValueError("El monto debe ser positivo")

        # Actualizar campos "seguros" (no afectan saldos)
        if concepto is not None:
            movimiento.concepto = concepto
        if fecha is not None:
            movimiento.fecha_movimiento = fecha
        if notas is not None:
            movimiento.notas = notas

        monto_anterior = Decimal(movimiento.monto)
        cambio_montos = nuevo_monto != monto_anterior or nueva_direccion != direccion_actual

        movimiento.monto = nuevo_monto

        if not cambio_montos:
            self.db.commit()
            self.db.refresh(movimiento)
            return movimiento

        # Recálculo de saldos: este movimiento y todos los posteriores del cliente.
        nuevo_saldo_posterior_este = Decimal(movimiento.saldo_anterior) + (
            nuevo_monto if nueva_direccion == "aumentar" else -nuevo_monto
        )
        movimiento.saldo_posterior = nuevo_saldo_posterior_este

        posteriores = (
            self.db.query(MovimientoCuentaCorriente)
            .filter(
                MovimientoCuentaCorriente.cliente_id == movimiento.cliente_id,
                MovimientoCuentaCorriente.created_at > movimiento.created_at,
            )
            .order_by(MovimientoCuentaCorriente.created_at.asc())
            .all()
        )

        saldo_running = nuevo_saldo_posterior_este
        for mov_post in posteriores:
            delta_post = Decimal(mov_post.saldo_posterior) - Decimal(mov_post.saldo_anterior)
            mov_post.saldo_anterior = saldo_running
            mov_post.saldo_posterior = saldo_running + delta_post
            saldo_running = mov_post.saldo_posterior

        cliente.saldo_cuenta_corriente = saldo_running

        self.db.commit()
        self.db.refresh(movimiento)
        return movimiento

    def eliminar_ajuste(self, movimiento_id: str) -> dict:
        """
        Elimina (soft delete: activo=False) un movimiento tipo AJUSTE, PAGO o
        CARGO y recalcula saldos posteriores del cliente. Devuelve un dict con
        info del cliente + nuevo saldo.

        Notas:
        - PAGO: no revierte movimientos de tesorería/caja ni anula cheques.
        - CARGO: si tiene remito asociado, lo soft-deletea también (activo=False).
          Los cargos por remito quedan registrados en LogActividad para la
          solapa "Eliminados" solo si se usa el endpoint DELETE /remitos/{id};
          esta vía solo revierte el impacto en CC.
        """
        movimiento = self.db.query(MovimientoCuentaCorriente).filter(
            MovimientoCuentaCorriente.id == movimiento_id
        ).first()
        if not movimiento:
            raise ValueError("Movimiento no encontrado")
        if movimiento.tipo not in (
            TipoMovimientoCC.AJUSTE.value,
            TipoMovimientoCC.PAGO.value,
            TipoMovimientoCC.CARGO.value,
        ):
            raise ValueError("Tipo de movimiento no eliminable")
        if not movimiento.activo:
            raise ValueError("El movimiento ya está eliminado")

        cliente = self.get_cliente(str(movimiento.cliente_id))
        if not cliente:
            raise ValueError("Cliente del movimiento no encontrado")

        cliente_id = movimiento.cliente_id
        saldo_base = Decimal(movimiento.saldo_anterior)

        posteriores = (
            self.db.query(MovimientoCuentaCorriente)
            .filter(
                MovimientoCuentaCorriente.cliente_id == cliente_id,
                MovimientoCuentaCorriente.created_at > movimiento.created_at,
                MovimientoCuentaCorriente.activo == True,
            )
            .order_by(MovimientoCuentaCorriente.created_at.asc())
            .all()
        )

        # Recalcular preservando el delta original de cada posterior
        saldo_running = saldo_base
        for mov_post in posteriores:
            delta = Decimal(mov_post.saldo_posterior) - Decimal(mov_post.saldo_anterior)
            mov_post.saldo_anterior = saldo_running
            mov_post.saldo_posterior = saldo_running + delta
            saldo_running = mov_post.saldo_posterior

        cliente.saldo_cuenta_corriente = saldo_running
        movimiento.activo = False

        # Si es cargo con remito asociado, soft-delete del remito también.
        if movimiento.tipo == TipoMovimientoCC.CARGO.value:
            from app.models.remito import Remito

            remito = (
                self.db.query(Remito)
                .filter(Remito.movimiento_cc_id == movimiento.id)
                .first()
            )
            if remito and remito.activo:
                remito.activo = False

        self.db.commit()

        return {
            "cliente_id": str(cliente_id),
            "saldo_posterior_cliente": float(saldo_running),
        }

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

        # Generar concepto según el contexto
        concepto = f"Pago recibido - {data.medio_pago}"
        if hasattr(data, 'pedido_id') and data.pedido_id:
            pedido = self.get_pedido(data.pedido_id)
            if pedido:
                concepto = f"Pago pedido {pedido.numero} - {data.medio_pago}"

        # Estado de facturación
        estado_facturacion = getattr(data, 'estado_facturacion', 'sin_facturar') or 'sin_facturar'
        factura_numero = getattr(data, 'factura_numero', None)

        # Crear movimiento
        movimiento = MovimientoCuentaCorriente(
            id=str(uuid4()),
            cliente_id=data.cliente_id,
            tipo=TipoMovimientoCC.PAGO.value,
            concepto=concepto,
            monto=data.monto,
            saldo_anterior=saldo_anterior,
            saldo_posterior=saldo_posterior,
            medio_pago=data.medio_pago,
            referencia_pago=data.referencia_pago,
            fecha_movimiento=data.fecha,
            registrado_por_id=usuario_id,
            notas=data.notas,
            pedido_id=getattr(data, 'pedido_id', None),
            lote_id=getattr(data, 'lote_id', None),
            estado_facturacion=estado_facturacion,
            factura_numero=factura_numero,
        )

        self.db.add(movimiento)

        # ==================== Tesorería ====================
        # Cada pago genera un MovimientoTesoreria (ingreso real de plata).
        # Según el medio_pago, se completan campos específicos y se crean
        # entidades asociadas (Cheque para cheques, MovimientoCaja para efectivo).
        tipo_tesoreria_map = {
            "efectivo": TipoMovimientoTesoreria.INGRESO_EFECTIVO.value,
            "transferencia": TipoMovimientoTesoreria.INGRESO_TRANSFERENCIA.value,
            "cheque": TipoMovimientoTesoreria.INGRESO_CHEQUE.value,
        }
        metodo_pago_norm = (data.medio_pago or "efectivo").lower()
        tipo_tesoreria = tipo_tesoreria_map.get(
            metodo_pago_norm, TipoMovimientoTesoreria.INGRESO_EFECTIVO.value
        )
        metodo_pago_tesoreria = (
            metodo_pago_norm if metodo_pago_norm in tipo_tesoreria_map else "efectivo"
        )

        # Validaciones y creación de entidades asociadas según medio
        cheque_creado: Optional[Cheque] = None
        cuenta_destino_id: Optional[str] = None
        transferencia_banco_origen: Optional[str] = None
        transferencia_numero: Optional[str] = None
        fecha_valor: Optional[date] = None

        if metodo_pago_norm == "cheque":
            # Requiere al menos número, banco emisor y fecha de vencimiento
            if not getattr(data, "cheque_numero", None):
                raise ValueError("Número de cheque es obligatorio para pagos con cheque")
            if not getattr(data, "cheque_banco", None):
                raise ValueError("Banco emisor es obligatorio para pagos con cheque")
            if not getattr(data, "cheque_fecha_vencimiento", None):
                raise ValueError(
                    "Fecha de vencimiento es obligatoria para pagos con cheque"
                )

            cheque_tipo_val = getattr(data, "cheque_tipo", None) or TipoCheque.FISICO.value
            cheque_creado = Cheque(
                id=str(uuid4()),
                numero=str(data.cheque_numero).strip(),
                tipo=cheque_tipo_val,
                origen=OrigenCheque.RECIBIDO_CLIENTE.value,
                estado=EstadoCheque.EN_CARTERA.value,
                monto=data.monto,
                fecha_emision=getattr(data, "cheque_fecha_emision", None),
                fecha_vencimiento=data.cheque_fecha_vencimiento,
                banco_origen=data.cheque_banco,
                cliente_id=data.cliente_id,
                librador=getattr(data, "cheque_librador", None),
                cuit_librador=getattr(data, "cheque_cuit_librador", None),
                registrado_por_id=usuario_id,
                fecha_registro=datetime.utcnow(),
                notas=data.notas,
            )
            self.db.add(cheque_creado)
            self.db.flush()  # asegurar id disponible antes del movimiento
            fecha_valor = data.cheque_fecha_vencimiento

        elif metodo_pago_norm == "transferencia":
            transferencia_banco_origen = getattr(data, "transferencia_banco_origen", None)
            transferencia_numero = (
                getattr(data, "transferencia_numero", None) or data.referencia_pago
            )
            cuenta_destino_id = getattr(data, "cuenta_destino_id", None)

        movimiento_tesoreria = MovimientoTesoreria(
            id=str(uuid4()),
            tipo=tipo_tesoreria,
            concepto=concepto,
            monto=data.monto,
            es_ingreso=True,
            fecha_movimiento=data.fecha,
            fecha_valor=fecha_valor,
            metodo_pago=metodo_pago_tesoreria,
            cliente_id=data.cliente_id,
            registrado_por_id=usuario_id,
            notas=data.notas,
            comprobante=data.referencia_pago,
            cheque_id=str(cheque_creado.id) if cheque_creado else None,
            banco_origen=transferencia_banco_origen,
            numero_transferencia=transferencia_numero,
            cuenta_destino_id=cuenta_destino_id,
        )
        self.db.add(movimiento_tesoreria)

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

        # ==================== Movimiento en Caja (solo efectivo) ====================
        # Si el pago es en efectivo, además se registra un ingreso en la caja
        # abierta (auto-detect si no se pasó caja_id explícita).
        if metodo_pago_norm == "efectivo":
            caja_para_ingreso: Optional[Caja] = None
            caja_id_solicitada = getattr(data, "caja_id", None)
            if caja_id_solicitada:
                caja_para_ingreso = (
                    self.db.query(Caja)
                    .filter(Caja.id == caja_id_solicitada)
                    .filter(Caja.estado == EstadoCaja.ABIERTA.value)
                    .first()
                )
                if not caja_para_ingreso:
                    raise ValueError(
                        "La caja indicada no existe o no está abierta"
                    )
            else:
                caja_para_ingreso = (
                    self.db.query(Caja)
                    .filter(Caja.estado == EstadoCaja.ABIERTA.value)
                    .order_by(Caja.fecha_apertura.desc())
                    .first()
                )

            if caja_para_ingreso is not None:
                mov_caja = MovimientoCaja(
                    id=str(uuid4()),
                    caja_id=str(caja_para_ingreso.id),
                    tipo=TipoMovimientoCaja.INGRESO.value,
                    categoria=CategoriaMovimiento.COBRO_CLIENTE.value,
                    concepto=concepto,
                    monto=data.monto,
                    medio_pago="efectivo",
                    referencia=numero_recibo,
                    cliente_id=data.cliente_id,
                    recibo_id=str(recibo.id),
                    registrado_por_id=usuario_id,
                )
                self.db.add(mov_caja)
            # Si no hay caja abierta, el ingreso queda en tesorería pero no
            # impacta caja física — el usuario debe abrir caja para registrarlo.

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

        # Aplicación FIFO automática a facturas pendientes del cliente
        try:
            from app.services import aplicacion_pago_service
            aplicacion_pago_service.aplicar_fifo(self.db, movimiento, usuario_id)
        except Exception:
            # Si la aplicación falla, no bloqueamos el pago — queda como anticipo
            pass

        self.db.commit()
        self.db.refresh(recibo)
        self.db.refresh(movimiento)

        return recibo, movimiento

    def get_estado_cuenta(
        self,
        cliente_id: str,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
    ) -> dict:
        """
        Obtiene resumen del estado de cuenta de un cliente.

        Cuando `fecha_desde` y/o `fecha_hasta` vienen, todas las cifras se
        acotan a ese rango (deuda_facturada, cargos_sin_facturar y saldo_actual
        pasan a representar el "neto del período"). Sin filtros el
        comportamiento es el histórico global.
        """
        cliente = self.get_cliente(cliente_id)
        if not cliente:
            raise ValueError("Cliente no encontrado")

        tiene_filtro_periodo = fecha_desde is not None or fecha_hasta is not None

        # Calcular totales del mes en curso (se mantiene para retrocompat)
        hoy = date.today()
        primer_dia_mes = hoy.replace(day=1)

        total_facturado_mes = (
            self.db.query(func.sum(MovimientoCuentaCorriente.monto))
            .filter(
                MovimientoCuentaCorriente.cliente_id == cliente_id,
                MovimientoCuentaCorriente.tipo == TipoMovimientoCC.CARGO.value,
                MovimientoCuentaCorriente.fecha_movimiento >= primer_dia_mes,
                MovimientoCuentaCorriente.activo == True,
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
                MovimientoCuentaCorriente.activo == True,
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

        # Filtros comunes: siempre activos; opcionalmente acotados al rango.
        def _aplicar_rango(query):
            if fecha_desde is not None:
                query = query.filter(
                    MovimientoCuentaCorriente.fecha_movimiento >= fecha_desde
                )
            if fecha_hasta is not None:
                query = query.filter(
                    MovimientoCuentaCorriente.fecha_movimiento <= fecha_hasta
                )
            return query

        # Desglose facturado / sin facturar.
        #
        # Sin filtro de período: se computa el saldo REAL pendiente de las
        # facturas emitidas del cliente (total − monto_pagado, restando NCs).
        # El resto del saldo del cliente se considera "sin facturar" (viene de
        # remitos pendientes de facturar o de ajustes manuales).
        # Invariante: total_facturado + cargos_sin_facturar = total_adeudado.
        #
        # Con filtro de período: se muestra el bruto de cargos del período
        # separado por si el CARGO está vinculado a una factura o no. Aquí no
        # aplica el invariante (es una vista de flujo, no de saldo).
        if tiene_filtro_periodo:
            deuda_facturada = (
                _aplicar_rango(
                    self.db.query(func.sum(MovimientoCuentaCorriente.monto)).filter(
                        MovimientoCuentaCorriente.cliente_id == cliente_id,
                        MovimientoCuentaCorriente.tipo == TipoMovimientoCC.CARGO.value,
                        MovimientoCuentaCorriente.factura_id.isnot(None),
                        MovimientoCuentaCorriente.activo == True,
                    )
                )
                .scalar()
                or Decimal("0")
            )
            cargos_sin_facturar = (
                _aplicar_rango(
                    self.db.query(func.sum(MovimientoCuentaCorriente.monto)).filter(
                        MovimientoCuentaCorriente.cliente_id == cliente_id,
                        MovimientoCuentaCorriente.tipo == TipoMovimientoCC.CARGO.value,
                        MovimientoCuentaCorriente.factura_id.is_(None),
                        MovimientoCuentaCorriente.activo == True,
                    )
                )
                .scalar()
                or Decimal("0")
            )
        else:
            _NC_TIPOS = [
                TipoComprobante.NOTA_CREDITO_A.value,
                TipoComprobante.NOTA_CREDITO_B.value,
            ]
            saldo_facturas_pendiente = (
                self.db.query(
                    func.sum(
                        case(
                            (
                                Factura.tipo.in_(_NC_TIPOS),
                                -(Factura.total - Factura.monto_pagado),
                            ),
                            else_=(Factura.total - Factura.monto_pagado),
                        )
                    )
                )
                .filter(
                    Factura.cliente_id == cliente_id,
                    Factura.estado == EstadoFactura.AUTORIZADA.value,
                    Factura.anulada_por_nc_id.is_(None),
                    Factura.activo == True,
                )
                .scalar()
                or Decimal("0")
            )
            # El resto se resolverá abajo, cuando ya tengamos total_adeudado.
            deuda_facturada = saldo_facturas_pendiente  # provisional
            cargos_sin_facturar = None  # se calcula abajo
        total_pagos_historicos = (
            self.db.query(func.sum(MovimientoCuentaCorriente.monto))
            .filter(
                MovimientoCuentaCorriente.cliente_id == cliente_id,
                MovimientoCuentaCorriente.tipo == TipoMovimientoCC.PAGO.value,
                MovimientoCuentaCorriente.activo == True,
            )
            .scalar()
            or Decimal("0")
        )

        if tiene_filtro_periodo:
            # Con filtros: saldo_actual = delta del período (cargos + ajustes - pagos).
            # Se usa el signo del ajuste con `saldo_posterior - saldo_anterior`
            # para preservar dirección (aumentar/disminuir).
            cargos_periodo = (
                _aplicar_rango(
                    self.db.query(func.sum(MovimientoCuentaCorriente.monto)).filter(
                        MovimientoCuentaCorriente.cliente_id == cliente_id,
                        MovimientoCuentaCorriente.tipo == TipoMovimientoCC.CARGO.value,
                        MovimientoCuentaCorriente.activo == True,
                    )
                )
                .scalar()
                or Decimal("0")
            )
            pagos_periodo = (
                _aplicar_rango(
                    self.db.query(func.sum(MovimientoCuentaCorriente.monto)).filter(
                        MovimientoCuentaCorriente.cliente_id == cliente_id,
                        MovimientoCuentaCorriente.tipo == TipoMovimientoCC.PAGO.value,
                        MovimientoCuentaCorriente.activo == True,
                    )
                )
                .scalar()
                or Decimal("0")
            )
            ajustes_delta = (
                _aplicar_rango(
                    self.db.query(
                        func.sum(
                            MovimientoCuentaCorriente.saldo_posterior
                            - MovimientoCuentaCorriente.saldo_anterior
                        )
                    ).filter(
                        MovimientoCuentaCorriente.cliente_id == cliente_id,
                        MovimientoCuentaCorriente.tipo == TipoMovimientoCC.AJUSTE.value,
                        MovimientoCuentaCorriente.activo == True,
                    )
                )
                .scalar()
                or Decimal("0")
            )
            saldo_actual = cargos_periodo - pagos_periodo + ajustes_delta
            saldo_a_favor = -saldo_actual if saldo_actual < 0 else Decimal("0")
        else:
            # Sin filtros: saldo global actual del cliente
            saldo_actual = Decimal(cliente.saldo_cuenta_corriente or 0)
            saldo_a_favor = -saldo_actual if saldo_actual < 0 else Decimal("0")

        # ---- Métricas independientes del filtro (siempre "mes actual") ----
        #
        # Deuda vencida: saldo neto de meses anteriores calculado por SUMA de
        # movimientos con `fecha_movimiento < primer_dia_mes`. No usamos
        # `saldo_posterior` porque ese campo es una snapshot del momento en que
        # se creó cada movimiento — un ajuste registrado hoy con fecha
        # retroactiva lo dejaría desactualizado.
        cargos_previos = (
            self.db.query(func.sum(MovimientoCuentaCorriente.monto))
            .filter(
                MovimientoCuentaCorriente.cliente_id == cliente_id,
                MovimientoCuentaCorriente.tipo == TipoMovimientoCC.CARGO.value,
                MovimientoCuentaCorriente.fecha_movimiento < primer_dia_mes,
                MovimientoCuentaCorriente.activo == True,
            )
            .scalar()
            or Decimal("0")
        )
        pagos_previos = (
            self.db.query(func.sum(MovimientoCuentaCorriente.monto))
            .filter(
                MovimientoCuentaCorriente.cliente_id == cliente_id,
                MovimientoCuentaCorriente.tipo == TipoMovimientoCC.PAGO.value,
                MovimientoCuentaCorriente.fecha_movimiento < primer_dia_mes,
                MovimientoCuentaCorriente.activo == True,
            )
            .scalar()
            or Decimal("0")
        )
        # Para ajustes usamos el delta real (saldo_posterior - saldo_anterior)
        # que sí representa el cambio absoluto que introdujo ese movimiento
        # (independiente del histórico).
        ajustes_delta_previos = (
            self.db.query(
                func.sum(
                    MovimientoCuentaCorriente.saldo_posterior
                    - MovimientoCuentaCorriente.saldo_anterior
                )
            )
            .filter(
                MovimientoCuentaCorriente.cliente_id == cliente_id,
                MovimientoCuentaCorriente.tipo == TipoMovimientoCC.AJUSTE.value,
                MovimientoCuentaCorriente.fecha_movimiento < primer_dia_mes,
                MovimientoCuentaCorriente.activo == True,
            )
            .scalar()
            or Decimal("0")
        )
        saldo_al_cierre_mes_anterior = (
            cargos_previos - pagos_previos + ajustes_delta_previos
        )
        # Si el saldo previo era positivo → deuda vencida real. Si era negativo
        # (cliente había pagado de más), lo tratamos como crédito previo que
        # después se aplicará al consumo del mes.
        deuda_vencida_bruta = (
            saldo_al_cierre_mes_anterior
            if saldo_al_cierre_mes_anterior > 0
            else Decimal("0")
        )
        credito_previo = (
            -saldo_al_cierre_mes_anterior
            if saldo_al_cierre_mes_anterior < 0
            else Decimal("0")
        )

        # Consumo del mes en curso: cargos + ajustes positivos (los que
        # aumentan la deuda) entre el 1° del mes y hoy. Se incluyen los
        # ajustes que suman al saldo (ej: "FACTURA JULIO" registrado como
        # ajuste manual) para que:
        #   deuda_vencida + consumo_mes_actual ≈ total_adeudado
        cargos_mes = (
            self.db.query(func.sum(MovimientoCuentaCorriente.monto))
            .filter(
                MovimientoCuentaCorriente.cliente_id == cliente_id,
                MovimientoCuentaCorriente.tipo == TipoMovimientoCC.CARGO.value,
                MovimientoCuentaCorriente.fecha_movimiento >= primer_dia_mes,
                MovimientoCuentaCorriente.fecha_movimiento <= hoy,
                MovimientoCuentaCorriente.activo == True,
            )
            .scalar()
            or Decimal("0")
        )
        ajustes_positivos_mes = (
            self.db.query(
                func.sum(
                    case(
                        (
                            MovimientoCuentaCorriente.saldo_posterior
                            > MovimientoCuentaCorriente.saldo_anterior,
                            MovimientoCuentaCorriente.saldo_posterior
                            - MovimientoCuentaCorriente.saldo_anterior,
                        ),
                        else_=0,
                    )
                )
            )
            .filter(
                MovimientoCuentaCorriente.cliente_id == cliente_id,
                MovimientoCuentaCorriente.tipo == TipoMovimientoCC.AJUSTE.value,
                MovimientoCuentaCorriente.fecha_movimiento >= primer_dia_mes,
                MovimientoCuentaCorriente.fecha_movimiento <= hoy,
                MovimientoCuentaCorriente.activo == True,
            )
            .scalar()
            or Decimal("0")
        )
        consumo_mes_bruto = cargos_mes + ajustes_positivos_mes

        # Ajustes NEGATIVOS del mes (los que reducen la deuda): se cuentan
        # como pagos efectivos para el FIFO. Sin esto, si el usuario registra
        # una entrega/pago vía "Ajustar Saldo" en vez de "Registrar Pago",
        # la deuda vencida quedaba inflada.
        ajustes_negativos_mes = (
            self.db.query(
                func.sum(
                    case(
                        (
                            MovimientoCuentaCorriente.saldo_posterior
                            < MovimientoCuentaCorriente.saldo_anterior,
                            MovimientoCuentaCorriente.saldo_anterior
                            - MovimientoCuentaCorriente.saldo_posterior,
                        ),
                        else_=0,
                    )
                )
            )
            .filter(
                MovimientoCuentaCorriente.cliente_id == cliente_id,
                MovimientoCuentaCorriente.tipo == TipoMovimientoCC.AJUSTE.value,
                MovimientoCuentaCorriente.fecha_movimiento >= primer_dia_mes,
                MovimientoCuentaCorriente.fecha_movimiento <= hoy,
                MovimientoCuentaCorriente.activo == True,
            )
            .scalar()
            or Decimal("0")
        )

        # Aplicación FIFO de las reducciones del mes (pagos + ajustes
        # negativos): primero cancelan la deuda vencida (más antigua) y el
        # sobrante reduce el consumo del mes. El crédito previo (saldo a
        # favor arrastrado) también reduce el consumo.
        # Invariante: deuda_vencida + consumo_mes_actual = total_adeudado.
        reducciones_mes = total_pagado_mes + ajustes_negativos_mes
        pagos_a_vencida = min(reducciones_mes, deuda_vencida_bruta)
        deuda_vencida = deuda_vencida_bruta - pagos_a_vencida
        pagos_sobrantes = reducciones_mes - pagos_a_vencida
        consumo_mes_actual = max(
            Decimal("0"), consumo_mes_bruto - pagos_sobrantes - credito_previo
        )

        # Total adeudado: saldo real del cliente al día de hoy si es positivo.
        # Debe coincidir con deuda_vencida + consumo_mes_actual.
        saldo_cliente = Decimal(cliente.saldo_cuenta_corriente or 0)
        total_adeudado = saldo_cliente if saldo_cliente > 0 else Decimal("0")

        # Cierre del desglose facturado / sin facturar (sin filtro):
        # el total_facturado se acota al total_adeudado para que ambas cards
        # sumen exactamente el saldo actual (no se muestran negativos ni
        # excedentes de facturas ya cobradas por otro lado).
        if not tiene_filtro_periodo:
            deuda_facturada = max(
                Decimal("0"), min(deuda_facturada, total_adeudado)
            )
            cargos_sin_facturar = total_adeudado - deuda_facturada

        return {
            "cliente_id": str(cliente.id),
            "cliente_nombre": cliente.nombre_display,
            "saldo_actual": saldo_actual,
            "deuda_facturada": deuda_facturada,
            "cargos_sin_facturar": cargos_sin_facturar,
            "saldo_a_favor": saldo_a_favor,
            "total_pagos_historicos": total_pagos_historicos,
            "limite_credito": cliente.limite_credito,
            "credito_disponible": credito_disponible,
            "total_facturado_mes": total_facturado_mes,
            "total_pagado_mes": total_pagado_mes,
            "cantidad_facturas_pendientes": len(pedidos_pendientes),
            "factura_mas_antigua_dias": factura_mas_antigua,
            "filtro_periodo": tiene_filtro_periodo,
            "fecha_desde": fecha_desde.isoformat() if fecha_desde else None,
            "fecha_hasta": fecha_hasta.isoformat() if fecha_hasta else None,
            # Resumen del mes en curso (independiente del filtro)
            "deuda_vencida": deuda_vencida,
            # BRUTO: suma de cargos + ajustes positivos del mes, SIN restar
            # pagos ni crédito previo. Es lo que debe verse en la card
            # "Consumo del mes" — refleja lo consumido en el período,
            # independientemente de si el cliente pagó adelantado.
            "consumo_mes_bruto": consumo_mes_bruto,
            # NETO: consumo del mes después de aplicar pagos y crédito
            # previo. Se usa para mantener el invariante
            # deuda_vencida + consumo_mes_actual = total_adeudado.
            "consumo_mes_actual": consumo_mes_actual,
            "total_adeudado": total_adeudado,
            "mes_actual_desde": primer_dia_mes.isoformat(),
            "mes_actual_hasta": hoy.isoformat(),
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
