"""
Servicio de Remitos.
"""

from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.remito import Remito, DetalleRemito, EstadoRemito, TipoRemito
from app.models.lote_produccion import LoteProduccion, EstadoLote, TipoLote, PrioridadLote
from app.models.producto_lavado import ProductoLavado
from app.models.cliente import Cliente
from app.models.cuenta_corriente import MovimientoCuentaCorriente, TipoMovimientoCC
from app.models.etapa_produccion import EtapaProduccion
from app.schemas.remito import (
    RemitoCreate,
    RemitoUpdate,
    GenerarRemitoRequest,
    GenerarRemitoResponse,
    EmitirRemitoResponse,
    DetalleRemitoCreate,
)
from app.services.log_service import LogService
from app.services.canasto_service import CanastoService


class RemitoService:
    """Servicio para gestión de remitos."""

    @staticmethod
    def _generar_numero_remito(db: Session, tipo: str = "normal") -> str:
        """Genera el número de remito automáticamente."""
        hoy = date.today()
        prefijo = "REM"
        if tipo == TipoRemito.COMPLEMENTARIO.value:
            prefijo = "REM"  # Se agrega -C al final

        fecha_str = hoy.strftime("%y%m%d")
        base = f"{prefijo}-{fecha_str}-"

        # Buscar el último número del día
        ultimo = db.query(Remito).filter(
            Remito.numero.like(f"{base}%")
        ).order_by(Remito.numero.desc()).first()

        if ultimo:
            try:
                ultimo_num = int(ultimo.numero.split("-")[-1].replace("C", ""))
                nuevo_num = ultimo_num + 1
            except (ValueError, IndexError):
                nuevo_num = 1
        else:
            nuevo_num = 1

        numero = f"{base}{nuevo_num:04d}"
        if tipo == TipoRemito.COMPLEMENTARIO.value:
            numero += "-C"

        return numero

    @staticmethod
    def get_all(
        db: Session,
        cliente_id: Optional[UUID] = None,
        lote_id: Optional[UUID] = None,
        estado: Optional[str] = None,
        tipo: Optional[str] = None,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
        solo_activos: bool = True,
        skip: int = 0,
        limit: int = 50
    ) -> List[Remito]:
        """Obtiene remitos con filtros."""
        query = db.query(Remito)

        if solo_activos:
            query = query.filter(Remito.activo == True)

        if cliente_id:
            query = query.filter(Remito.cliente_id == cliente_id)

        if lote_id:
            query = query.filter(Remito.lote_id == lote_id)

        if estado:
            query = query.filter(Remito.estado == estado)

        if tipo:
            query = query.filter(Remito.tipo == tipo)

        if fecha_desde:
            query = query.filter(Remito.fecha_emision >= fecha_desde)

        if fecha_hasta:
            query = query.filter(Remito.fecha_emision <= fecha_hasta)

        return query.order_by(Remito.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_by_id(db: Session, remito_id: UUID) -> Optional[Remito]:
        """Obtiene un remito por ID."""
        return db.query(Remito).filter(Remito.id == remito_id).first()

    @staticmethod
    def get_by_numero(db: Session, numero: str) -> Optional[Remito]:
        """Obtiene un remito por número."""
        return db.query(Remito).filter(Remito.numero == numero).first()

    @staticmethod
    def generar_remito_desde_lote(
        db: Session,
        lote_id: UUID,
        request: GenerarRemitoRequest,
        usuario_id: UUID
    ) -> GenerarRemitoResponse:
        """
        Genera un remito desde la etapa de conteo y finalización.

        Este es el método principal que:
        1. Crea el remito con los detalles
        2. Calcula totales
        3. Emite el remito (crea cargo en CC)
        4. Si hay items a relavar, crea lote de relevado
        5. Actualiza estado del lote
        """
        # Verificar lote
        lote = db.query(LoteProduccion).filter(LoteProduccion.id == lote_id).first()
        if not lote:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lote no encontrado"
            )

        # Verificar que tiene cliente
        if not lote.cliente_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El lote no tiene cliente asignado"
            )

        cliente = lote.cliente

        # Determinar tipo de remito
        tiene_relevado = request.items_relevado and len(request.items_relevado) > 0
        tipo_remito = TipoRemito.PARCIAL.value if tiene_relevado else TipoRemito.NORMAL.value

        # Generar número
        numero = RemitoService._generar_numero_remito(db, tipo_remito)

        # Calcular totales
        subtotal = Decimal(0)
        for detalle in request.detalles:
            item_subtotal = detalle.cantidad * detalle.precio_unitario
            subtotal += item_subtotal

        # Aplicar descuento del cliente si tiene
        descuento = Decimal(0)
        if cliente.descuento_general and cliente.descuento_general > 0:
            descuento = subtotal * (cliente.descuento_general / 100)

        total = subtotal - descuento

        # Crear remito
        remito = Remito(
            numero=numero,
            lote_id=lote_id,
            cliente_id=cliente.id,
            tipo=tipo_remito,
            estado=EstadoRemito.BORRADOR.value,
            fecha_emision=date.today(),
            peso_total_kg=request.peso_total_kg or lote.peso_entrada_kg,
            subtotal=subtotal,
            descuento=descuento,
            total=total,
            notas=request.notas,
            emitido_por_id=usuario_id
        )
        db.add(remito)
        db.flush()  # Para obtener el ID

        # Crear detalles
        for detalle_data in request.detalles:
            producto = db.query(ProductoLavado).filter(
                ProductoLavado.id == detalle_data.producto_id
            ).first()

            if not producto:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Producto {detalle_data.producto_id} no encontrado"
                )

            item_subtotal = detalle_data.cantidad * detalle_data.precio_unitario

            detalle = DetalleRemito(
                remito_id=remito.id,
                producto_id=detalle_data.producto_id,
                cantidad=detalle_data.cantidad,
                precio_unitario=detalle_data.precio_unitario,
                subtotal=item_subtotal,
                descripcion=detalle_data.descripcion
            )
            db.add(detalle)

        # Emitir remito (crear cargo en CC)
        movimiento_cc = RemitoService._crear_cargo_cc(
            db, remito, cliente, usuario_id
        )
        remito.movimiento_cc_id = movimiento_cc.id
        remito.estado = EstadoRemito.EMITIDO.value

        # Variables para respuesta
        lote_relevado_id = None
        lote_relevado_numero = None

        # Crear lote de relevado si hay items
        if tiene_relevado:
            lote_relevado = RemitoService._crear_lote_relevado(
                db, lote, request.items_relevado, usuario_id
            )
            lote_relevado_id = lote_relevado.id
            lote_relevado_numero = lote_relevado.numero

            # Lote original queda parcialmente completado
            lote.estado = EstadoLote.PARCIALMENTE_COMPLETADO.value
        else:
            # Lote completado
            lote.estado = EstadoLote.COMPLETADO.value
            lote.fecha_fin_proceso = datetime.utcnow()

        db.commit()

        # Log
        log_service = LogService()
        log_service.registrar(
            db=db,
            usuario_id=usuario_id,
            accion="generar_remito",
            modulo="remitos",
            descripcion=f"Remito {numero} generado para lote {lote.numero}. Total: ${total}",
            entidad_tipo="remito",
            entidad_id=remito.id
        )

        return GenerarRemitoResponse(
            remito_id=remito.id,
            remito_numero=remito.numero,
            tipo=remito.tipo,
            total=remito.total,
            movimiento_cc_id=movimiento_cc.id,
            lote_estado=lote.estado,
            lote_relevado_id=lote_relevado_id,
            lote_relevado_numero=lote_relevado_numero,
            mensaje=f"Remito {numero} generado y cargado a cuenta corriente"
        )

    @staticmethod
    def _crear_cargo_cc(
        db: Session,
        remito: Remito,
        cliente: Cliente,
        usuario_id: UUID
    ) -> MovimientoCuentaCorriente:
        """Crea el cargo en cuenta corriente del cliente."""
        # Obtener saldo anterior
        saldo_anterior = cliente.saldo_cuenta_corriente or Decimal(0)
        saldo_posterior = saldo_anterior + remito.total

        # Crear movimiento
        movimiento = MovimientoCuentaCorriente(
            cliente_id=cliente.id,
            tipo=TipoMovimientoCC.CARGO.value,
            concepto=f"Remito {remito.numero}",
            monto=remito.total,
            saldo_anterior=saldo_anterior,
            saldo_posterior=saldo_posterior,
            fecha_movimiento=date.today(),
            estado_facturacion="sin_facturar",
            lote_id=remito.lote_id,
            registrado_por_id=usuario_id,
            notas=f"Generado automáticamente desde remito {remito.numero}"
        )
        db.add(movimiento)

        # Actualizar saldo del cliente
        cliente.saldo_cuenta_corriente = saldo_posterior

        db.flush()
        return movimiento

    @staticmethod
    def _crear_lote_relevado(
        db: Session,
        lote_padre: LoteProduccion,
        items_relevado: List[dict],
        usuario_id: UUID
    ) -> LoteProduccion:
        """Crea un lote de relevado a partir del lote padre."""
        # Generar número de lote de relevado
        # Buscar cuántos relevados tiene este lote
        count_relevados = db.query(LoteProduccion).filter(
            LoteProduccion.lote_padre_id == lote_padre.id
        ).count()

        numero_relevado = f"{lote_padre.numero}-R{count_relevados + 1}"

        # Buscar etapa de lavado para que entre directo ahí
        etapa_lavado = db.query(EtapaProduccion).filter(
            EtapaProduccion.codigo == "LAV",
            EtapaProduccion.activo == True
        ).first()

        # Crear descripción de items a relavar
        descripcion_items = []
        for item in items_relevado:
            producto = db.query(ProductoLavado).filter(
                ProductoLavado.id == item.get("producto_id")
            ).first()
            if producto:
                descripcion_items.append(f"{item.get('cantidad', 0)}x {producto.nombre}")

        descripcion = f"Relevado de lote {lote_padre.numero}: {', '.join(descripcion_items)}"

        # Crear lote de relevado
        lote_relevado = LoteProduccion(
            numero=numero_relevado,
            cliente_id=lote_padre.cliente_id,
            tipo_lote=TipoLote.RELEVADO.value,
            lote_padre_id=lote_padre.id,
            estado=EstadoLote.PENDIENTE.value,
            prioridad=PrioridadLote.ALTA.value,  # Prioridad alta
            etapa_actual_id=etapa_lavado.id if etapa_lavado else None,
            fecha_ingreso=datetime.utcnow(),
            creado_por_id=usuario_id,
            descripcion=descripcion,
            notas_internas=f"Lote de relevado generado automáticamente. Items: {descripcion_items}"
        )

        db.add(lote_relevado)
        db.flush()

        # Log
        log_service = LogService()
        log_service.registrar(
            db=db,
            usuario_id=usuario_id,
            accion="crear_lote_relevado",
            modulo="produccion",
            descripcion=f"Lote de relevado {numero_relevado} creado desde {lote_padre.numero}",
            entidad_tipo="lote",
            entidad_id=lote_relevado.id
        )

        return lote_relevado

    @staticmethod
    def generar_remito_complementario(
        db: Session,
        lote_relevado_id: UUID,
        request: GenerarRemitoRequest,
        usuario_id: UUID
    ) -> GenerarRemitoResponse:
        """
        Genera un remito complementario cuando termina un lote de relevado.
        """
        lote_relevado = db.query(LoteProduccion).filter(
            LoteProduccion.id == lote_relevado_id
        ).first()

        if not lote_relevado:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lote de relevado no encontrado"
            )

        if lote_relevado.tipo_lote != TipoLote.RELEVADO.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este lote no es de relevado"
            )

        if not lote_relevado.lote_padre_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Lote de relevado sin lote padre"
            )

        # Buscar remito original (parcial)
        remito_padre = db.query(Remito).filter(
            Remito.lote_id == lote_relevado.lote_padre_id,
            Remito.tipo == TipoRemito.PARCIAL.value,
            Remito.activo == True
        ).first()

        cliente = lote_relevado.cliente

        # Generar número complementario
        numero = RemitoService._generar_numero_remito(db, TipoRemito.COMPLEMENTARIO.value)

        # Calcular totales
        subtotal = Decimal(0)
        for detalle in request.detalles:
            item_subtotal = detalle.cantidad * detalle.precio_unitario
            subtotal += item_subtotal

        descuento = Decimal(0)
        if cliente.descuento_general and cliente.descuento_general > 0:
            descuento = subtotal * (cliente.descuento_general / 100)

        total = subtotal - descuento

        # Crear remito complementario
        remito = Remito(
            numero=numero,
            lote_id=lote_relevado_id,
            cliente_id=cliente.id,
            tipo=TipoRemito.COMPLEMENTARIO.value,
            estado=EstadoRemito.BORRADOR.value,
            fecha_emision=date.today(),
            peso_total_kg=request.peso_total_kg,
            subtotal=subtotal,
            descuento=descuento,
            total=total,
            remito_padre_id=remito_padre.id if remito_padre else None,
            notas=request.notas or f"Complemento de {remito_padre.numero if remito_padre else 'relevado'}",
            emitido_por_id=usuario_id
        )
        db.add(remito)
        db.flush()

        # Crear detalles
        for detalle_data in request.detalles:
            detalle = DetalleRemito(
                remito_id=remito.id,
                producto_id=detalle_data.producto_id,
                cantidad=detalle_data.cantidad,
                precio_unitario=detalle_data.precio_unitario,
                subtotal=detalle_data.cantidad * detalle_data.precio_unitario,
                descripcion=detalle_data.descripcion
            )
            db.add(detalle)

        # Emitir remito
        movimiento_cc = RemitoService._crear_cargo_cc(db, remito, cliente, usuario_id)
        remito.movimiento_cc_id = movimiento_cc.id
        remito.estado = EstadoRemito.EMITIDO.value

        # Completar lote de relevado
        lote_relevado.estado = EstadoLote.COMPLETADO.value
        lote_relevado.fecha_fin_proceso = datetime.utcnow()

        # Completar lote padre si no tiene más relevados pendientes
        lote_padre = lote_relevado.lote_padre
        if lote_padre and not lote_padre.tiene_relevado_pendiente:
            lote_padre.estado = EstadoLote.COMPLETADO.value
            lote_padre.fecha_fin_proceso = datetime.utcnow()

        db.commit()

        # Log
        log_service = LogService()
        log_service.registrar(
            db=db,
            usuario_id=usuario_id,
            accion="generar_remito_complementario",
            modulo="remitos",
            descripcion=f"Remito complementario {numero} generado. Total: ${total}",
            entidad_tipo="remito",
            entidad_id=remito.id
        )

        return GenerarRemitoResponse(
            remito_id=remito.id,
            remito_numero=remito.numero,
            tipo=remito.tipo,
            total=remito.total,
            movimiento_cc_id=movimiento_cc.id,
            lote_estado=lote_relevado.estado,
            mensaje=f"Remito complementario {numero} generado"
        )

    @staticmethod
    def marcar_entregado(
        db: Session,
        remito_id: UUID,
        notas_entrega: Optional[str],
        usuario_id: UUID
    ) -> Remito:
        """Marca un remito como entregado."""
        remito = RemitoService.get_by_id(db, remito_id)
        if not remito:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Remito no encontrado"
            )

        if remito.estado not in [EstadoRemito.EMITIDO.value]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede entregar un remito en estado {remito.estado}"
            )

        remito.estado = EstadoRemito.ENTREGADO.value
        remito.fecha_entrega = datetime.utcnow()
        remito.entregado_por_id = usuario_id
        if notas_entrega:
            remito.notas_entrega = notas_entrega

        db.commit()
        db.refresh(remito)

        # Log
        log_service = LogService()
        log_service.registrar(
            db=db,
            usuario_id=usuario_id,
            accion="entregar_remito",
            modulo="remitos",
            descripcion=f"Remito {remito.numero} entregado",
            entidad_tipo="remito",
            entidad_id=remito.id
        )

        return remito

    @staticmethod
    def anular(
        db: Session,
        remito_id: UUID,
        motivo: str,
        usuario_id: UUID
    ) -> Remito:
        """Anula un remito."""
        remito = RemitoService.get_by_id(db, remito_id)
        if not remito:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Remito no encontrado"
            )

        if remito.estado == EstadoRemito.ANULADO.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El remito ya está anulado"
            )

        # Si tiene movimiento de CC, crear movimiento de reversión
        if remito.movimiento_cc_id:
            cliente = remito.cliente
            saldo_anterior = cliente.saldo_cuenta_corriente
            saldo_posterior = saldo_anterior - remito.total

            movimiento_reversion = MovimientoCuentaCorriente(
                cliente_id=cliente.id,
                tipo=TipoMovimientoCC.AJUSTE.value,
                concepto=f"Anulación remito {remito.numero}",
                monto=-remito.total,  # Negativo para revertir
                saldo_anterior=saldo_anterior,
                saldo_posterior=saldo_posterior,
                fecha_movimiento=date.today(),
                registrado_por_id=usuario_id,
                notas=f"Anulación: {motivo}"
            )
            db.add(movimiento_reversion)

            cliente.saldo_cuenta_corriente = saldo_posterior

        remito.estado = EstadoRemito.ANULADO.value
        remito.fecha_anulacion = datetime.utcnow()
        remito.motivo_anulacion = motivo
        remito.anulado_por_id = usuario_id

        db.commit()
        db.refresh(remito)

        # Log
        log_service = LogService()
        log_service.registrar(
            db=db,
            usuario_id=usuario_id,
            accion="anular_remito",
            modulo="remitos",
            descripcion=f"Remito {remito.numero} anulado. Motivo: {motivo}",
            entidad_tipo="remito",
            entidad_id=remito.id
        )

        return remito

    @staticmethod
    def get_remitos_cliente(
        db: Session,
        cliente_id: UUID,
        skip: int = 0,
        limit: int = 50
    ) -> List[Remito]:
        """Obtiene remitos de un cliente."""
        return RemitoService.get_all(
            db, cliente_id=cliente_id, skip=skip, limit=limit
        )

    @staticmethod
    def get_remitos_lote(db: Session, lote_id: UUID) -> List[Remito]:
        """Obtiene remitos de un lote."""
        return db.query(Remito).filter(
            Remito.lote_id == lote_id,
            Remito.activo == True
        ).order_by(Remito.created_at.desc()).all()
