"""
Servicio de Stock (Insumos y Movimientos).
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.insumo import Insumo
from app.models.categoria_insumo import CategoriaInsumo
from app.models.movimiento_stock import MovimientoStock, TipoMovimiento, OrigenMovimiento
from app.schemas.insumo import (
    InsumoCreate,
    InsumoUpdate,
    InsumoResponse,
    InsumoAlerta,
    AjusteStockRequest,
)
from app.schemas.categoria_insumo import CategoriaInsumoCreate, CategoriaInsumoUpdate
from app.schemas.movimiento_stock import MovimientoStockCreate, MovimientoStockFilter, ResumenMovimientos
from app.services.log_service import log_service


class StockService:
    """Servicio para gestión de stock."""

    def __init__(self, db: Session):
        self.db = db
        self.log_service = log_service

    # ==================== CATEGORÍAS ====================

    def get_categorias(
        self,
        skip: int = 0,
        limit: int = 100,
        solo_activas: bool = True,
    ) -> Tuple[List[CategoriaInsumo], int]:
        """Obtiene lista de categorías."""
        query = self.db.query(CategoriaInsumo)

        if solo_activas:
            query = query.filter(CategoriaInsumo.activo == True)

        total = query.count()
        categorias = query.order_by(CategoriaInsumo.orden, CategoriaInsumo.nombre).offset(skip).limit(limit).all()

        return categorias, total

    def get_categoria(self, categoria_id: UUID) -> Optional[CategoriaInsumo]:
        """Obtiene una categoría por ID."""
        return self.db.query(CategoriaInsumo).filter(CategoriaInsumo.id == categoria_id).first()

    def create_categoria(
        self,
        data: CategoriaInsumoCreate,
        usuario_id: UUID,
    ) -> CategoriaInsumo:
        """Crea una nueva categoría."""
        categoria = CategoriaInsumo(**data.model_dump())
        self.db.add(categoria)
        self.db.commit()
        self.db.refresh(categoria)

        self.log_service.registrar(
            db=self.db,
            usuario_id=usuario_id,
            accion="crear",
            modulo="stock",
            entidad_tipo="CategoriaInsumo",
            entidad_id=categoria.id,
            datos_nuevos=data.model_dump(),
        )

        return categoria

    def update_categoria(
        self,
        categoria_id: UUID,
        data: CategoriaInsumoUpdate,
        usuario_id: UUID,
    ) -> Optional[CategoriaInsumo]:
        """Actualiza una categoría."""
        categoria = self.get_categoria(categoria_id)
        if not categoria:
            return None

        datos_anteriores = {
            "nombre": categoria.nombre,
            "descripcion": categoria.descripcion,
            "orden": categoria.orden,
            "activo": categoria.activo,
        }

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(categoria, field, value)

        self.db.commit()
        self.db.refresh(categoria)

        self.log_service.registrar(
            db=self.db,
            usuario_id=usuario_id,
            accion="actualizar",
            modulo="stock",
            entidad_tipo="CategoriaInsumo",
            entidad_id=categoria.id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=data.model_dump(exclude_unset=True),
        )

        return categoria

    def delete_categoria(self, categoria_id: UUID, usuario_id: UUID) -> bool:
        """Elimina (desactiva) una categoría."""
        categoria = self.get_categoria(categoria_id)
        if not categoria:
            return False

        categoria.activo = False
        self.db.commit()

        self.log_service.registrar(
            db=self.db,
            usuario_id=usuario_id,
            accion="eliminar",
            modulo="stock",
            entidad_tipo="CategoriaInsumo",
            entidad_id=categoria.id,
        )

        return True

    # ==================== INSUMOS ====================

    def get_insumos(
        self,
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None,
        categoria_id: Optional[UUID] = None,
        solo_activos: bool = True,
        solo_stock_bajo: bool = False,
        solo_sin_stock: bool = False,
    ) -> Tuple[List[Insumo], int]:
        """Obtiene lista de insumos con filtros."""
        query = self.db.query(Insumo).options(
            joinedload(Insumo.categoria),
            joinedload(Insumo.proveedor_habitual),
        )

        if solo_activos:
            query = query.filter(Insumo.activo == True)

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Insumo.codigo.ilike(search_term),
                    Insumo.nombre.ilike(search_term),
                    Insumo.codigo_barras.ilike(search_term),
                )
            )

        if categoria_id:
            query = query.filter(Insumo.categoria_id == categoria_id)

        if solo_stock_bajo:
            query = query.filter(Insumo.stock_actual <= Insumo.stock_minimo)

        if solo_sin_stock:
            query = query.filter(Insumo.stock_actual <= 0)

        total = query.count()
        insumos = query.order_by(Insumo.nombre).offset(skip).limit(limit).all()

        return insumos, total

    def get_insumo(self, insumo_id: UUID) -> Optional[Insumo]:
        """Obtiene un insumo por ID."""
        return (
            self.db.query(Insumo)
            .options(
                joinedload(Insumo.categoria),
                joinedload(Insumo.proveedor_habitual),
            )
            .filter(Insumo.id == insumo_id)
            .first()
        )

    def get_insumo_by_codigo(self, codigo: str) -> Optional[Insumo]:
        """Obtiene un insumo por código."""
        return self.db.query(Insumo).filter(Insumo.codigo == codigo).first()

    def create_insumo(self, data: InsumoCreate, usuario_id: UUID) -> Insumo:
        """Crea un nuevo insumo."""
        insumo = Insumo(**data.model_dump())
        self.db.add(insumo)
        self.db.commit()
        self.db.refresh(insumo)

        # Si tiene stock inicial, crear movimiento
        if data.stock_actual > 0:
            self._crear_movimiento(
                insumo_id=insumo.id,
                tipo=TipoMovimiento.ENTRADA,
                origen=OrigenMovimiento.INICIAL,
                cantidad=data.stock_actual,
                stock_anterior=Decimal("0"),
                precio_unitario=data.precio_unitario_costo,
                usuario_id=usuario_id,
                notas="Stock inicial",
            )

        self.log_service.registrar(
            db=self.db,
            usuario_id=usuario_id,
            accion="crear",
            modulo="stock",
            entidad_tipo="Insumo",
            entidad_id=insumo.id,
            datos_nuevos=data.model_dump(),
        )

        return insumo

    def update_insumo(
        self,
        insumo_id: UUID,
        data: InsumoUpdate,
        usuario_id: UUID,
    ) -> Optional[Insumo]:
        """Actualiza un insumo."""
        insumo = self.get_insumo(insumo_id)
        if not insumo:
            return None

        datos_anteriores = {
            "codigo": insumo.codigo,
            "nombre": insumo.nombre,
            "stock_minimo": str(insumo.stock_minimo),
            "stock_maximo": str(insumo.stock_maximo) if insumo.stock_maximo else None,
        }

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(insumo, field, value)

        self.db.commit()
        self.db.refresh(insumo)

        self.log_service.registrar(
            db=self.db,
            usuario_id=usuario_id,
            accion="actualizar",
            modulo="stock",
            entidad_tipo="Insumo",
            entidad_id=insumo.id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=data.model_dump(exclude_unset=True),
        )

        return insumo

    def delete_insumo(self, insumo_id: UUID, usuario_id: UUID) -> bool:
        """Elimina (soft delete) un insumo."""
        insumo = self.get_insumo(insumo_id)
        if not insumo:
            return False

        insumo.activo = False
        self.db.commit()

        self.log_service.registrar(
            db=self.db,
            usuario_id=usuario_id,
            accion="eliminar",
            modulo="stock",
            entidad_tipo="Insumo",
            entidad_id=insumo.id,
        )

        return True

    # ==================== MOVIMIENTOS ====================

    def ajustar_stock(
        self,
        data: AjusteStockRequest,
        usuario_id: UUID,
    ) -> MovimientoStock:
        """Realiza un ajuste manual de stock."""
        insumo = self.get_insumo(data.insumo_id)
        if not insumo:
            raise ValueError("Insumo no encontrado")

        # Validar que la cantidad no sea cero
        if data.cantidad == 0:
            raise ValueError("La cantidad de ajuste no puede ser cero")

        stock_anterior = insumo.stock_actual

        if data.cantidad > 0:
            tipo = TipoMovimiento.AJUSTE_POSITIVO
            insumo.stock_actual += data.cantidad
        else:
            tipo = TipoMovimiento.AJUSTE_NEGATIVO
            if insumo.stock_actual + data.cantidad < 0:
                raise ValueError("El ajuste dejaría el stock en negativo")
            insumo.stock_actual += data.cantidad  # cantidad es negativa

        movimiento = self._crear_movimiento(
            insumo_id=data.insumo_id,
            tipo=tipo,
            origen=OrigenMovimiento.AJUSTE_INVENTARIO,
            cantidad=abs(data.cantidad),
            stock_anterior=stock_anterior,
            usuario_id=usuario_id,
            numero_lote=data.numero_lote,
            fecha_vencimiento_lote=data.fecha_vencimiento,
            notas=data.motivo,
        )

        self.db.commit()

        return movimiento

    def registrar_entrada(
        self,
        insumo_id: UUID,
        cantidad: Decimal,
        usuario_id: UUID,
        origen: OrigenMovimiento = OrigenMovimiento.COMPRA,
        precio_unitario: Optional[Decimal] = None,
        proveedor_id: Optional[UUID] = None,
        documento_tipo: Optional[str] = None,
        documento_id: Optional[UUID] = None,
        numero_documento: Optional[str] = None,
        numero_lote: Optional[str] = None,
        fecha_vencimiento: Optional[datetime] = None,
        notas: Optional[str] = None,
    ) -> MovimientoStock:
        """Registra una entrada de stock."""
        insumo = self.get_insumo(insumo_id)
        if not insumo:
            raise ValueError("Insumo no encontrado")

        stock_anterior = insumo.stock_actual
        insumo.stock_actual += cantidad

        # Actualizar precio promedio ponderado
        if precio_unitario:
            self._actualizar_precio_promedio(insumo, cantidad, precio_unitario)
            insumo.precio_unitario_costo = precio_unitario

        movimiento = self._crear_movimiento(
            insumo_id=insumo_id,
            tipo=TipoMovimiento.ENTRADA,
            origen=origen,
            cantidad=cantidad,
            stock_anterior=stock_anterior,
            precio_unitario=precio_unitario,
            proveedor_id=proveedor_id,
            documento_tipo=documento_tipo,
            documento_id=documento_id,
            numero_documento=numero_documento,
            usuario_id=usuario_id,
            numero_lote=numero_lote,
            fecha_vencimiento_lote=fecha_vencimiento,
            notas=notas,
        )

        self.db.commit()

        return movimiento

    def registrar_salida(
        self,
        insumo_id: UUID,
        cantidad: Decimal,
        usuario_id: UUID,
        origen: OrigenMovimiento = OrigenMovimiento.PRODUCCION,
        documento_tipo: Optional[str] = None,
        documento_id: Optional[UUID] = None,
        numero_documento: Optional[str] = None,
        notas: Optional[str] = None,
    ) -> MovimientoStock:
        """Registra una salida de stock."""
        insumo = self.get_insumo(insumo_id)
        if not insumo:
            raise ValueError("Insumo no encontrado")

        if insumo.stock_actual < cantidad:
            raise ValueError(f"Stock insuficiente. Disponible: {insumo.stock_actual}")

        stock_anterior = insumo.stock_actual
        insumo.stock_actual -= cantidad

        movimiento = self._crear_movimiento(
            insumo_id=insumo_id,
            tipo=TipoMovimiento.SALIDA,
            origen=origen,
            cantidad=cantidad,
            stock_anterior=stock_anterior,
            precio_unitario=insumo.precio_promedio_ponderado or insumo.precio_unitario_costo,
            documento_tipo=documento_tipo,
            documento_id=documento_id,
            numero_documento=numero_documento,
            usuario_id=usuario_id,
            notas=notas,
        )

        self.db.commit()

        return movimiento

    def get_movimientos(
        self,
        filtros: MovimientoStockFilter,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[MovimientoStock], int]:
        """Obtiene movimientos con filtros."""
        query = self.db.query(MovimientoStock).options(
            joinedload(MovimientoStock.insumo),
            joinedload(MovimientoStock.proveedor),
            joinedload(MovimientoStock.usuario),
        )

        if filtros.insumo_id:
            query = query.filter(MovimientoStock.insumo_id == filtros.insumo_id)

        if filtros.tipo:
            query = query.filter(MovimientoStock.tipo == filtros.tipo.value)

        if filtros.origen:
            query = query.filter(MovimientoStock.origen == filtros.origen.value)

        if filtros.proveedor_id:
            query = query.filter(MovimientoStock.proveedor_id == filtros.proveedor_id)

        if filtros.usuario_id:
            query = query.filter(MovimientoStock.usuario_id == filtros.usuario_id)

        if filtros.fecha_desde:
            query = query.filter(
                func.date(MovimientoStock.fecha_movimiento) >= filtros.fecha_desde
            )

        if filtros.fecha_hasta:
            query = query.filter(
                func.date(MovimientoStock.fecha_movimiento) <= filtros.fecha_hasta
            )

        if filtros.numero_documento:
            query = query.filter(
                MovimientoStock.numero_documento.ilike(f"%{filtros.numero_documento}%")
            )

        total = query.count()
        movimientos = (
            query.order_by(MovimientoStock.fecha_movimiento.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return movimientos, total

    def get_resumen_movimientos(
        self,
        insumo_id: Optional[UUID] = None,
        fecha_desde: Optional[date] = None,
        fecha_hasta: Optional[date] = None,
    ) -> ResumenMovimientos:
        """Obtiene resumen de movimientos."""
        query = self.db.query(MovimientoStock)

        if insumo_id:
            query = query.filter(MovimientoStock.insumo_id == insumo_id)

        if fecha_desde:
            query = query.filter(func.date(MovimientoStock.fecha_movimiento) >= fecha_desde)

        if fecha_hasta:
            query = query.filter(func.date(MovimientoStock.fecha_movimiento) <= fecha_hasta)

        movimientos = query.all()

        resumen = ResumenMovimientos()
        for mov in movimientos:
            if mov.tipo in [TipoMovimiento.ENTRADA.value, TipoMovimiento.AJUSTE_POSITIVO.value]:
                resumen.total_entradas += mov.cantidad
                if mov.costo_total:
                    resumen.valor_entradas += mov.costo_total
            else:
                resumen.total_salidas += mov.cantidad
                if mov.costo_total:
                    resumen.valor_salidas += mov.costo_total
            resumen.cantidad_movimientos += 1

        return resumen

    # ==================== ALERTAS ====================

    def get_alertas_stock(self) -> List[InsumoAlerta]:
        """Obtiene alertas de stock (bajo, sin stock, vencimiento)."""
        alertas = []

        # Insumos con stock bajo o sin stock
        insumos_criticos = (
            self.db.query(Insumo)
            .filter(
                Insumo.activo == True,
                Insumo.stock_actual <= Insumo.stock_minimo,
            )
            .all()
        )

        for insumo in insumos_criticos:
            if insumo.stock_actual <= 0:
                alertas.append(InsumoAlerta(
                    id=insumo.id,
                    codigo=insumo.codigo,
                    nombre=insumo.nombre,
                    unidad=insumo.unidad,
                    stock_actual=insumo.stock_actual,
                    stock_minimo=insumo.stock_minimo,
                    tipo_alerta="sin_stock",
                    mensaje=f"Sin stock de {insumo.nombre}",
                ))
            else:
                alertas.append(InsumoAlerta(
                    id=insumo.id,
                    codigo=insumo.codigo,
                    nombre=insumo.nombre,
                    unidad=insumo.unidad,
                    stock_actual=insumo.stock_actual,
                    stock_minimo=insumo.stock_minimo,
                    tipo_alerta="stock_bajo",
                    mensaje=f"Stock bajo de {insumo.nombre}: {insumo.stock_actual} {insumo.unidad}",
                ))

        # Insumos próximos a vencer
        fecha_limite = date.today() + timedelta(days=30)
        insumos_vencimiento = (
            self.db.query(Insumo)
            .filter(
                Insumo.activo == True,
                Insumo.fecha_vencimiento != None,
                Insumo.fecha_vencimiento <= fecha_limite,
                Insumo.stock_actual > 0,
            )
            .all()
        )

        for insumo in insumos_vencimiento:
            dias = (insumo.fecha_vencimiento - date.today()).days
            alertas.append(InsumoAlerta(
                id=insumo.id,
                codigo=insumo.codigo,
                nombre=insumo.nombre,
                unidad=insumo.unidad,
                stock_actual=insumo.stock_actual,
                stock_minimo=insumo.stock_minimo,
                tipo_alerta="vencimiento",
                mensaje=f"{insumo.nombre} vence en {dias} días",
            ))

        return alertas

    # ==================== HELPERS ====================

    def _crear_movimiento(
        self,
        insumo_id: UUID,
        tipo: TipoMovimiento,
        cantidad: Decimal,
        stock_anterior: Decimal,
        usuario_id: UUID,
        origen: Optional[OrigenMovimiento] = None,
        precio_unitario: Optional[Decimal] = None,
        proveedor_id: Optional[UUID] = None,
        documento_tipo: Optional[str] = None,
        documento_id: Optional[UUID] = None,
        numero_documento: Optional[str] = None,
        numero_lote: Optional[str] = None,
        fecha_vencimiento_lote: Optional[datetime] = None,
        notas: Optional[str] = None,
    ) -> MovimientoStock:
        """Crea un movimiento de stock."""
        # Calcular stock posterior
        if tipo in [TipoMovimiento.ENTRADA, TipoMovimiento.AJUSTE_POSITIVO]:
            stock_posterior = stock_anterior + cantidad
        else:
            stock_posterior = stock_anterior - cantidad

        # Calcular costo total
        costo_total = None
        if precio_unitario:
            costo_total = cantidad * precio_unitario

        movimiento = MovimientoStock(
            insumo_id=insumo_id,
            tipo=tipo.value,
            origen=origen.value if origen else None,
            cantidad=cantidad,
            stock_anterior=stock_anterior,
            stock_posterior=stock_posterior,
            precio_unitario=precio_unitario,
            costo_total=costo_total,
            proveedor_id=proveedor_id,
            documento_tipo=documento_tipo,
            documento_id=documento_id,
            numero_documento=numero_documento,
            usuario_id=usuario_id,
            numero_lote=numero_lote,
            fecha_vencimiento_lote=fecha_vencimiento_lote,
            notas=notas,
        )

        self.db.add(movimiento)
        return movimiento

    def _actualizar_precio_promedio(
        self,
        insumo: Insumo,
        cantidad_nueva: Decimal,
        precio_nuevo: Decimal,
    ) -> None:
        """Actualiza el precio promedio ponderado."""
        if insumo.stock_actual == 0 or not insumo.precio_promedio_ponderado:
            insumo.precio_promedio_ponderado = precio_nuevo
        else:
            valor_actual = insumo.stock_actual * insumo.precio_promedio_ponderado
            valor_nuevo = cantidad_nueva * precio_nuevo
            total_cantidad = insumo.stock_actual + cantidad_nueva
            insumo.precio_promedio_ponderado = (valor_actual + valor_nuevo) / total_cantidad

    # ==================== ENDPOINTS ADICIONALES ====================

    def get_insumos_por_vencer(
        self,
        dias: int = 30,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Insumo], int]:
        """Obtiene insumos próximos a vencer."""
        fecha_limite = date.today() + timedelta(days=dias)

        query = (
            self.db.query(Insumo)
            .options(
                joinedload(Insumo.categoria),
                joinedload(Insumo.proveedor_habitual),
            )
            .filter(
                Insumo.activo == True,
                Insumo.fecha_vencimiento != None,
                Insumo.fecha_vencimiento <= fecha_limite,
                Insumo.stock_actual > 0,
            )
            .order_by(Insumo.fecha_vencimiento)
        )

        total = query.count()
        insumos = query.offset(skip).limit(limit).all()

        return insumos, total

    def get_insumos_sobrestock(
        self,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Insumo], int]:
        """Obtiene insumos con sobrestock (stock > stock_maximo)."""
        query = (
            self.db.query(Insumo)
            .options(
                joinedload(Insumo.categoria),
                joinedload(Insumo.proveedor_habitual),
            )
            .filter(
                Insumo.activo == True,
                Insumo.stock_maximo != None,
                Insumo.stock_actual > Insumo.stock_maximo,
            )
            .order_by((Insumo.stock_actual - Insumo.stock_maximo).desc())
        )

        total = query.count()
        insumos = query.offset(skip).limit(limit).all()

        return insumos, total

    def get_stock_valorizado(
        self,
        categoria_id: Optional[UUID] = None,
    ) -> dict:
        """Obtiene el stock valorizado total y por categoría."""
        query = self.db.query(Insumo).filter(
            Insumo.activo == True,
            Insumo.stock_actual > 0,
        )

        if categoria_id:
            query = query.filter(Insumo.categoria_id == categoria_id)

        insumos = query.options(joinedload(Insumo.categoria)).all()

        total_valor = Decimal("0")
        total_items = 0
        por_categoria = {}
        detalle = []

        for insumo in insumos:
            precio = insumo.precio_promedio_ponderado or insumo.precio_unitario_costo or Decimal("0")
            valor = insumo.stock_actual * precio
            total_valor += valor
            total_items += 1

            # Agrupar por categoría
            cat_nombre = insumo.categoria.nombre if insumo.categoria else "Sin categoría"
            cat_id = str(insumo.categoria_id) if insumo.categoria_id else "sin_categoria"

            if cat_id not in por_categoria:
                por_categoria[cat_id] = {
                    "categoria_id": cat_id,
                    "categoria_nombre": cat_nombre,
                    "cantidad_items": 0,
                    "valor_total": Decimal("0"),
                }

            por_categoria[cat_id]["cantidad_items"] += 1
            por_categoria[cat_id]["valor_total"] += valor

            detalle.append({
                "insumo_id": str(insumo.id),
                "codigo": insumo.codigo,
                "nombre": insumo.nombre,
                "categoria": cat_nombre,
                "stock_actual": float(insumo.stock_actual),
                "unidad": insumo.unidad,
                "precio_unitario": float(precio),
                "valor_stock": float(valor),
            })

        # Convertir valores Decimal a float para JSON
        for cat in por_categoria.values():
            cat["valor_total"] = float(cat["valor_total"])

        return {
            "total_valor": float(total_valor),
            "total_items": total_items,
            "por_categoria": list(por_categoria.values()),
            "detalle": detalle,
        }
