"""
Servicio de Proveedores y Órdenes de Compra.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.proveedor import Proveedor
from app.models.producto_proveedor import ProductoProveedor
from app.models.historial_precios_proveedor import HistorialPreciosProveedor
from app.models.orden_compra import (
    OrdenCompra,
    OrdenCompraDetalle,
    RecepcionCompra,
    RecepcionCompraDetalle,
    EstadoOrdenCompra,
)
from app.models.movimiento_stock import TipoMovimiento, OrigenMovimiento
from app.schemas.proveedor import ProveedorCreate, ProveedorUpdate
from app.schemas.producto_proveedor import (
    ProductoProveedorCreate,
    ProductoProveedorUpdate,
    ActualizarPrecioRequest,
)
from app.schemas.orden_compra import (
    OrdenCompraCreate,
    OrdenCompraUpdate,
    RecepcionCompraCreate,
)
from app.services.log_service import log_service
from app.services.stock_service import StockService


class ProveedorService:
    """Servicio para gestión de proveedores."""

    def __init__(self, db: Session):
        self.db = db
        self.log_service = log_service

    # ==================== PROVEEDORES ====================

    def get_proveedores(
        self,
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None,
        rubro: Optional[str] = None,
        solo_activos: bool = True,
    ) -> Tuple[List[Proveedor], int]:
        """Obtiene lista de proveedores."""
        query = self.db.query(Proveedor)

        if solo_activos:
            query = query.filter(Proveedor.activo == True)

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Proveedor.razon_social.ilike(search_term),
                    Proveedor.nombre_fantasia.ilike(search_term),
                    Proveedor.cuit.ilike(search_term),
                )
            )

        if rubro:
            query = query.filter(Proveedor.rubro == rubro)

        total = query.count()
        proveedores = query.order_by(Proveedor.razon_social).offset(skip).limit(limit).all()

        return proveedores, total

    def get_proveedor(self, proveedor_id: UUID) -> Optional[Proveedor]:
        """Obtiene un proveedor por ID."""
        return self.db.query(Proveedor).filter(Proveedor.id == proveedor_id).first()

    def get_proveedor_by_cuit(self, cuit: str) -> Optional[Proveedor]:
        """Obtiene un proveedor por CUIT."""
        cuit_limpio = cuit.replace("-", "")
        return self.db.query(Proveedor).filter(Proveedor.cuit == cuit_limpio).first()

    def create_proveedor(self, data: ProveedorCreate, usuario_id: UUID) -> Proveedor:
        """Crea un nuevo proveedor."""
        proveedor = Proveedor(**data.model_dump())
        self.db.add(proveedor)
        self.db.commit()
        self.db.refresh(proveedor)

        self.log_service.registrar(
            usuario_id=usuario_id,
            accion="crear",
            entidad="Proveedor",
            entidad_id=proveedor.id,
            datos_nuevos=data.model_dump(),
        )

        return proveedor

    def update_proveedor(
        self,
        proveedor_id: UUID,
        data: ProveedorUpdate,
        usuario_id: UUID,
    ) -> Optional[Proveedor]:
        """Actualiza un proveedor."""
        proveedor = self.get_proveedor(proveedor_id)
        if not proveedor:
            return None

        datos_anteriores = {
            "razon_social": proveedor.razon_social,
            "cuit": proveedor.cuit,
            "activo": proveedor.activo,
        }

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(proveedor, field, value)

        self.db.commit()
        self.db.refresh(proveedor)

        self.log_service.registrar(
            usuario_id=usuario_id,
            accion="actualizar",
            entidad="Proveedor",
            entidad_id=proveedor.id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=data.model_dump(exclude_unset=True),
        )

        return proveedor

    def delete_proveedor(self, proveedor_id: UUID, usuario_id: UUID) -> bool:
        """Elimina (soft delete) un proveedor."""
        proveedor = self.get_proveedor(proveedor_id)
        if not proveedor:
            return False

        proveedor.activo = False
        self.db.commit()

        self.log_service.registrar(
            usuario_id=usuario_id,
            accion="eliminar",
            entidad="Proveedor",
            entidad_id=proveedor.id,
        )

        return True

    # ==================== PRODUCTOS PROVEEDOR ====================

    def get_productos_proveedor(
        self,
        proveedor_id: Optional[UUID] = None,
        insumo_id: Optional[UUID] = None,
        solo_activos: bool = True,
        solo_preferidos: bool = False,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[ProductoProveedor], int]:
        """Obtiene productos de proveedor."""
        query = self.db.query(ProductoProveedor).options(
            joinedload(ProductoProveedor.proveedor),
            joinedload(ProductoProveedor.insumo),
        )

        if proveedor_id:
            query = query.filter(ProductoProveedor.proveedor_id == proveedor_id)

        if insumo_id:
            query = query.filter(ProductoProveedor.insumo_id == insumo_id)

        if solo_activos:
            query = query.filter(ProductoProveedor.activo == True)

        if solo_preferidos:
            query = query.filter(ProductoProveedor.es_preferido == True)

        total = query.count()
        productos = query.offset(skip).limit(limit).all()

        return productos, total

    def get_producto_proveedor(self, producto_id: UUID) -> Optional[ProductoProveedor]:
        """Obtiene un producto de proveedor por ID."""
        return (
            self.db.query(ProductoProveedor)
            .options(
                joinedload(ProductoProveedor.proveedor),
                joinedload(ProductoProveedor.insumo),
            )
            .filter(ProductoProveedor.id == producto_id)
            .first()
        )

    def create_producto_proveedor(
        self,
        data: ProductoProveedorCreate,
        usuario_id: UUID,
    ) -> ProductoProveedor:
        """Crea un producto de proveedor."""
        producto = ProductoProveedor(**data.model_dump())
        self.db.add(producto)
        self.db.commit()
        self.db.refresh(producto)

        # Registrar en historial de precios
        self._registrar_historial_precio(
            producto_proveedor_id=producto.id,
            precio_anterior=None,
            precio_nuevo=data.precio_unitario,
            moneda=data.moneda,
            usuario_id=usuario_id,
        )

        self.log_service.registrar(
            usuario_id=usuario_id,
            accion="crear",
            entidad="ProductoProveedor",
            entidad_id=producto.id,
            datos_nuevos=data.model_dump(),
        )

        return producto

    def update_producto_proveedor(
        self,
        producto_id: UUID,
        data: ProductoProveedorUpdate,
        usuario_id: UUID,
    ) -> Optional[ProductoProveedor]:
        """Actualiza un producto de proveedor."""
        producto = self.get_producto_proveedor(producto_id)
        if not producto:
            return None

        precio_anterior = producto.precio_unitario

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(producto, field, value)

        # Si cambió el precio, registrar en historial
        if data.precio_unitario and data.precio_unitario != precio_anterior:
            self._registrar_historial_precio(
                producto_proveedor_id=producto.id,
                precio_anterior=precio_anterior,
                precio_nuevo=data.precio_unitario,
                moneda=producto.moneda,
                usuario_id=usuario_id,
            )

        self.db.commit()
        self.db.refresh(producto)

        return producto

    def actualizar_precio(
        self,
        producto_id: UUID,
        data: ActualizarPrecioRequest,
        usuario_id: UUID,
    ) -> Optional[ProductoProveedor]:
        """Actualiza el precio de un producto."""
        producto = self.get_producto_proveedor(producto_id)
        if not producto:
            return None

        precio_anterior = producto.precio_unitario

        producto.precio_unitario = data.precio_unitario
        producto.fecha_precio = data.fecha_precio
        producto.fecha_vencimiento_precio = data.fecha_vencimiento_precio

        self._registrar_historial_precio(
            producto_proveedor_id=producto.id,
            precio_anterior=precio_anterior,
            precio_nuevo=data.precio_unitario,
            moneda=producto.moneda,
            usuario_id=usuario_id,
            documento_referencia=data.documento_referencia,
            notas=data.notas,
        )

        self.db.commit()
        self.db.refresh(producto)

        return producto

    def _registrar_historial_precio(
        self,
        producto_proveedor_id: UUID,
        precio_anterior: Optional[Decimal],
        precio_nuevo: Decimal,
        moneda: str,
        usuario_id: UUID,
        documento_referencia: Optional[str] = None,
        notas: Optional[str] = None,
    ) -> HistorialPreciosProveedor:
        """Registra un cambio de precio en el historial."""
        variacion = None
        if precio_anterior and precio_anterior > 0:
            variacion = ((precio_nuevo - precio_anterior) / precio_anterior) * 100

        historial = HistorialPreciosProveedor(
            producto_proveedor_id=producto_proveedor_id,
            precio_anterior=precio_anterior,
            precio_nuevo=precio_nuevo,
            moneda=moneda,
            variacion_porcentual=variacion,
            usuario_id=usuario_id,
            documento_referencia=documento_referencia,
            notas=notas,
        )
        self.db.add(historial)
        return historial

    # ==================== ÓRDENES DE COMPRA ====================

    def get_ordenes_compra(
        self,
        proveedor_id: Optional[UUID] = None,
        estado: Optional[EstadoOrdenCompra] = None,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[OrdenCompra], int]:
        """Obtiene órdenes de compra."""
        query = self.db.query(OrdenCompra).options(
            joinedload(OrdenCompra.proveedor),
            joinedload(OrdenCompra.creado_por),
        )

        if proveedor_id:
            query = query.filter(OrdenCompra.proveedor_id == proveedor_id)

        if estado:
            query = query.filter(OrdenCompra.estado == estado.value)

        if fecha_desde:
            query = query.filter(OrdenCompra.fecha_emision >= fecha_desde)

        if fecha_hasta:
            query = query.filter(OrdenCompra.fecha_emision <= fecha_hasta)

        query = query.filter(OrdenCompra.activo == True)

        total = query.count()
        ordenes = (
            query.order_by(OrdenCompra.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return ordenes, total

    def get_orden_compra(self, orden_id: UUID) -> Optional[OrdenCompra]:
        """Obtiene una orden de compra por ID."""
        return (
            self.db.query(OrdenCompra)
            .options(
                joinedload(OrdenCompra.proveedor),
                joinedload(OrdenCompra.creado_por),
                joinedload(OrdenCompra.aprobada_por),
                joinedload(OrdenCompra.items).joinedload(OrdenCompraDetalle.insumo),
            )
            .filter(OrdenCompra.id == orden_id)
            .first()
        )

    def create_orden_compra(
        self,
        data: OrdenCompraCreate,
        usuario_id: UUID,
    ) -> OrdenCompra:
        """Crea una orden de compra."""
        # Generar número de orden
        numero = self._generar_numero_orden()

        orden = OrdenCompra(
            numero=numero,
            proveedor_id=data.proveedor_id,
            estado=EstadoOrdenCompra.BORRADOR.value,
            fecha_emision=data.fecha_emision,
            fecha_entrega_estimada=data.fecha_entrega_estimada,
            descuento_porcentaje=data.descuento_porcentaje,
            moneda=data.moneda,
            condicion_pago=data.condicion_pago,
            plazo_pago_dias=data.plazo_pago_dias,
            lugar_entrega=data.lugar_entrega,
            requiere_aprobacion=data.requiere_aprobacion,
            notas=data.notas,
            notas_internas=data.notas_internas,
            creado_por_id=usuario_id,
        )

        self.db.add(orden)
        self.db.flush()

        # Agregar items
        for i, item_data in enumerate(data.items, start=1):
            item = OrdenCompraDetalle(
                orden_compra_id=orden.id,
                insumo_id=item_data.insumo_id,
                producto_proveedor_id=item_data.producto_proveedor_id,
                descripcion=item_data.descripcion,
                cantidad=item_data.cantidad,
                unidad=item_data.unidad,
                precio_unitario=item_data.precio_unitario,
                descuento_porcentaje=item_data.descuento_porcentaje,
                numero_linea=i,
                notas=item_data.notas,
            )
            item.calcular_subtotal()
            self.db.add(item)

        self.db.flush()

        # Recalcular totales
        orden.calcular_totales()

        self.db.commit()
        self.db.refresh(orden)

        self.log_service.registrar(
            usuario_id=usuario_id,
            accion="crear",
            entidad="OrdenCompra",
            entidad_id=orden.id,
            datos_nuevos={"numero": numero, "total": str(orden.total)},
        )

        return orden

    def update_orden_compra(
        self,
        orden_id: UUID,
        data: OrdenCompraUpdate,
        usuario_id: UUID,
    ) -> Optional[OrdenCompra]:
        """Actualiza una orden de compra."""
        orden = self.get_orden_compra(orden_id)
        if not orden or not orden.puede_editar:
            return None

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(orden, field, value)

        # Recalcular totales si cambió el descuento
        if data.descuento_porcentaje is not None:
            orden.calcular_totales()

        self.db.commit()
        self.db.refresh(orden)

        return orden

    def cambiar_estado_orden(
        self,
        orden_id: UUID,
        nuevo_estado: EstadoOrdenCompra,
        usuario_id: UUID,
        notas: Optional[str] = None,
    ) -> Optional[OrdenCompra]:
        """Cambia el estado de una orden."""
        orden = self.get_orden_compra(orden_id)
        if not orden:
            return None

        estado_anterior = orden.estado
        orden.estado = nuevo_estado.value

        if nuevo_estado == EstadoOrdenCompra.APROBADA:
            orden.aprobada_por_id = usuario_id
            orden.fecha_aprobacion = datetime.utcnow()

        if notas:
            orden.notas_internas = (orden.notas_internas or "") + f"\n[{datetime.utcnow()}] {notas}"

        self.db.commit()
        self.db.refresh(orden)

        self.log_service.registrar(
            usuario_id=usuario_id,
            accion="cambiar_estado",
            entidad="OrdenCompra",
            entidad_id=orden.id,
            datos_anteriores={"estado": estado_anterior},
            datos_nuevos={"estado": nuevo_estado.value},
        )

        return orden

    def aprobar_orden(
        self,
        orden_id: UUID,
        usuario_id: UUID,
        notas: Optional[str] = None,
    ) -> Optional[OrdenCompra]:
        """Aprueba una orden de compra."""
        orden = self.get_orden_compra(orden_id)
        if not orden or not orden.puede_aprobar:
            return None

        return self.cambiar_estado_orden(
            orden_id=orden_id,
            nuevo_estado=EstadoOrdenCompra.APROBADA,
            usuario_id=usuario_id,
            notas=notas,
        )

    def cancelar_orden(
        self,
        orden_id: UUID,
        usuario_id: UUID,
        motivo: str,
    ) -> Optional[OrdenCompra]:
        """Cancela una orden de compra."""
        orden = self.get_orden_compra(orden_id)
        if not orden or not orden.puede_cancelar:
            return None

        return self.cambiar_estado_orden(
            orden_id=orden_id,
            nuevo_estado=EstadoOrdenCompra.CANCELADA,
            usuario_id=usuario_id,
            notas=f"Cancelada: {motivo}",
        )

    # ==================== RECEPCIÓN ====================

    def registrar_recepcion(
        self,
        data: RecepcionCompraCreate,
        usuario_id: UUID,
    ) -> RecepcionCompra:
        """Registra la recepción de una orden de compra."""
        orden = self.get_orden_compra(data.orden_compra_id)
        if not orden:
            raise ValueError("Orden de compra no encontrada")

        if orden.estado not in [
            EstadoOrdenCompra.APROBADA.value,
            EstadoOrdenCompra.ENVIADA.value,
            EstadoOrdenCompra.PARCIAL.value,
        ]:
            raise ValueError("La orden no está en estado para recibir")

        # Generar número de recepción
        numero = self._generar_numero_recepcion()

        recepcion = RecepcionCompra(
            orden_compra_id=data.orden_compra_id,
            numero=numero,
            remito_numero=data.remito_numero,
            factura_numero=data.factura_numero,
            recibido_por_id=usuario_id,
            notas=data.notas,
        )

        self.db.add(recepcion)
        self.db.flush()

        stock_service = StockService(self.db)
        tiene_diferencias = False

        # Procesar items
        for item_data in data.items:
            # Actualizar cantidad recibida en el detalle de la orden
            orden_detalle = (
                self.db.query(OrdenCompraDetalle)
                .filter(OrdenCompraDetalle.id == item_data.orden_detalle_id)
                .first()
            )
            if orden_detalle:
                orden_detalle.cantidad_recibida += item_data.cantidad_recibida

            # Crear detalle de recepción
            detalle = RecepcionCompraDetalle(
                recepcion_id=recepcion.id,
                orden_detalle_id=item_data.orden_detalle_id,
                insumo_id=item_data.insumo_id,
                cantidad_esperada=item_data.cantidad_esperada,
                cantidad_recibida=item_data.cantidad_recibida,
                cantidad_rechazada=item_data.cantidad_rechazada,
                numero_lote=item_data.numero_lote,
                fecha_vencimiento=item_data.fecha_vencimiento,
                ubicacion=item_data.ubicacion,
                motivo_rechazo=item_data.motivo_rechazo,
            )

            if detalle.tiene_diferencia:
                tiene_diferencias = True

            self.db.add(detalle)
            self.db.flush()

            # Registrar entrada de stock
            if item_data.cantidad_recibida > 0:
                movimiento = stock_service.registrar_entrada(
                    insumo_id=item_data.insumo_id,
                    cantidad=item_data.cantidad_recibida,
                    usuario_id=usuario_id,
                    origen=OrigenMovimiento.COMPRA,
                    proveedor_id=orden.proveedor_id,
                    documento_tipo="orden_compra",
                    documento_id=orden.id,
                    numero_documento=orden.numero,
                    numero_lote=item_data.numero_lote,
                    fecha_vencimiento=datetime.combine(item_data.fecha_vencimiento, datetime.min.time()) if item_data.fecha_vencimiento else None,
                    notas=f"Recepción {numero}",
                )
                detalle.movimiento_stock_id = movimiento.id

        # Actualizar estado de la recepción
        recepcion.estado = "con_diferencias" if tiene_diferencias else "completada"

        # Verificar si la orden está completa
        self._verificar_orden_completa(orden)

        self.db.commit()
        self.db.refresh(recepcion)

        self.log_service.registrar(
            usuario_id=usuario_id,
            accion="crear",
            entidad="RecepcionCompra",
            entidad_id=recepcion.id,
            datos_nuevos={"numero": numero, "orden": orden.numero},
        )

        return recepcion

    def _verificar_orden_completa(self, orden: OrdenCompra) -> None:
        """Verifica si la orden está completamente recibida."""
        todos_completos = all(
            item.completamente_recibido for item in orden.items
        )

        if todos_completos:
            orden.estado = EstadoOrdenCompra.COMPLETADA.value
            orden.fecha_entrega_real = date.today()
        else:
            alguno_recibido = any(
                item.cantidad_recibida > 0 for item in orden.items
            )
            if alguno_recibido:
                orden.estado = EstadoOrdenCompra.PARCIAL.value

    def _generar_numero_orden(self) -> str:
        """Genera el número de la siguiente orden de compra."""
        year = date.today().year
        prefijo = f"OC-{year}-"

        ultima = (
            self.db.query(OrdenCompra)
            .filter(OrdenCompra.numero.like(f"{prefijo}%"))
            .order_by(OrdenCompra.numero.desc())
            .first()
        )

        if ultima:
            ultimo_num = int(ultima.numero.split("-")[-1])
            nuevo_num = ultimo_num + 1
        else:
            nuevo_num = 1

        return f"{prefijo}{nuevo_num:05d}"

    def _generar_numero_recepcion(self) -> str:
        """Genera el número de la siguiente recepción."""
        year = date.today().year
        prefijo = f"RC-{year}-"

        ultima = (
            self.db.query(RecepcionCompra)
            .filter(RecepcionCompra.numero.like(f"{prefijo}%"))
            .order_by(RecepcionCompra.numero.desc())
            .first()
        )

        if ultima:
            ultimo_num = int(ultima.numero.split("-")[-1])
            nuevo_num = ultimo_num + 1
        else:
            nuevo_num = 1

        return f"{prefijo}{nuevo_num:05d}"
