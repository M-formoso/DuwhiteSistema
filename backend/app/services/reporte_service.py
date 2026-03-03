"""
Servicio de Reportes para DUWHITE ERP
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlalchemy import select, func, and_, or_, extract, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pedido import Pedido, DetallePedido, EstadoPedido
from app.models.cliente import Cliente
from app.models.lote_produccion import LoteProduccion, LoteEtapa, EstadoLote
from app.models.caja import Caja, MovimientoCaja, EstadoCaja
from app.models.insumo import Insumo
from app.models.movimiento_stock import MovimientoStock
from app.models.empleado import Empleado, JornadaLaboral
from app.models.lista_precios import Servicio


class ReporteService:
    """Servicio para generación de reportes"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ==================== REPORTES DE VENTAS ====================

    async def get_ventas_por_periodo(
        self,
        fecha_desde: date,
        fecha_hasta: date,
        agrupacion: str = "dia"  # dia, semana, mes
    ) -> List[Dict[str, Any]]:
        """Reporte de ventas agrupado por período"""
        if agrupacion == "dia":
            group_expr = Pedido.fecha_pedido
            format_label = lambda d: d.strftime("%d/%m/%Y")
        elif agrupacion == "semana":
            group_expr = func.date_trunc('week', Pedido.fecha_pedido)
            format_label = lambda d: f"Sem {d.isocalendar()[1]}"
        else:  # mes
            group_expr = func.date_trunc('month', Pedido.fecha_pedido)
            format_label = lambda d: d.strftime("%m/%Y")

        result = await self.db.execute(
            select(
                group_expr.label('periodo'),
                func.count(Pedido.id).label('cantidad_pedidos'),
                func.sum(Pedido.subtotal).label('subtotal'),
                func.sum(Pedido.descuento_monto).label('descuentos'),
                func.sum(Pedido.total).label('total')
            )
            .where(and_(
                Pedido.activo == True,
                Pedido.fecha_pedido >= fecha_desde,
                Pedido.fecha_pedido <= fecha_hasta
            ))
            .group_by(group_expr)
            .order_by(group_expr)
        )

        rows = result.all()
        return [
            {
                "periodo": row.periodo,
                "periodo_label": format_label(row.periodo) if row.periodo else "",
                "cantidad_pedidos": row.cantidad_pedidos or 0,
                "subtotal": float(row.subtotal or 0),
                "descuentos": float(row.descuentos or 0),
                "total": float(row.total or 0),
            }
            for row in rows
        ]

    async def get_ventas_por_cliente(
        self,
        fecha_desde: date,
        fecha_hasta: date,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Reporte de ventas por cliente (top clientes)"""
        result = await self.db.execute(
            select(
                Pedido.cliente_id,
                Cliente.razon_social,
                func.count(Pedido.id).label('cantidad_pedidos'),
                func.sum(Pedido.total).label('total'),
                func.avg(Pedido.total).label('promedio_pedido')
            )
            .join(Cliente, Pedido.cliente_id == Cliente.id)
            .where(and_(
                Pedido.activo == True,
                Pedido.fecha_pedido >= fecha_desde,
                Pedido.fecha_pedido <= fecha_hasta
            ))
            .group_by(Pedido.cliente_id, Cliente.razon_social)
            .order_by(func.sum(Pedido.total).desc())
            .limit(limit)
        )

        rows = result.all()
        return [
            {
                "cliente_id": str(row.cliente_id),
                "cliente_nombre": row.razon_social,
                "cantidad_pedidos": row.cantidad_pedidos or 0,
                "total": float(row.total or 0),
                "promedio_pedido": float(row.promedio_pedido or 0),
            }
            for row in rows
        ]

    async def get_ventas_por_servicio(
        self,
        fecha_desde: date,
        fecha_hasta: date
    ) -> List[Dict[str, Any]]:
        """Reporte de ventas por tipo de servicio"""
        result = await self.db.execute(
            select(
                DetallePedido.servicio_id,
                Servicio.nombre,
                func.count(DetallePedido.id).label('cantidad'),
                func.sum(DetallePedido.cantidad).label('unidades'),
                func.sum(DetallePedido.subtotal).label('total')
            )
            .join(Pedido, DetallePedido.pedido_id == Pedido.id)
            .join(Servicio, DetallePedido.servicio_id == Servicio.id)
            .where(and_(
                Pedido.activo == True,
                Pedido.fecha_pedido >= fecha_desde,
                Pedido.fecha_pedido <= fecha_hasta
            ))
            .group_by(DetallePedido.servicio_id, Servicio.nombre)
            .order_by(func.sum(DetallePedido.subtotal).desc())
        )

        rows = result.all()
        return [
            {
                "servicio_id": str(row.servicio_id),
                "servicio_nombre": row.nombre,
                "cantidad_items": row.cantidad or 0,
                "unidades_vendidas": float(row.unidades or 0),
                "total": float(row.total or 0),
            }
            for row in rows
        ]

    # ==================== REPORTES DE PRODUCCION ====================

    async def get_produccion_por_periodo(
        self,
        fecha_desde: date,
        fecha_hasta: date,
        agrupacion: str = "dia"
    ) -> List[Dict[str, Any]]:
        """Reporte de producción por período"""
        if agrupacion == "dia":
            group_expr = LoteProduccion.fecha_ingreso
        elif agrupacion == "semana":
            group_expr = func.date_trunc('week', LoteProduccion.fecha_ingreso)
        else:
            group_expr = func.date_trunc('month', LoteProduccion.fecha_ingreso)

        result = await self.db.execute(
            select(
                group_expr.label('periodo'),
                func.count(LoteProduccion.id).label('cantidad_lotes'),
                func.sum(LoteProduccion.peso_entrada_kg).label('kg_total'),
                func.sum(
                    case(
                        (LoteProduccion.estado == EstadoLote.COMPLETADO.value, 1),
                        else_=0
                    )
                ).label('lotes_completados'),
                func.sum(
                    case(
                        (LoteProduccion.estado == EstadoLote.EN_PROCESO.value, 1),
                        else_=0
                    )
                ).label('lotes_en_proceso')
            )
            .where(and_(
                LoteProduccion.activo == True,
                LoteProduccion.fecha_ingreso >= fecha_desde,
                LoteProduccion.fecha_ingreso <= fecha_hasta
            ))
            .group_by(group_expr)
            .order_by(group_expr)
        )

        rows = result.all()
        return [
            {
                "periodo": row.periodo,
                "cantidad_lotes": row.cantidad_lotes or 0,
                "kg_total": float(row.kg_total or 0),
                "lotes_completados": row.lotes_completados or 0,
                "lotes_en_proceso": row.lotes_en_proceso or 0,
            }
            for row in rows
        ]

    async def get_produccion_por_etapa(
        self,
        fecha_desde: date,
        fecha_hasta: date
    ) -> List[Dict[str, Any]]:
        """Reporte de tiempo en cada etapa de producción"""
        result = await self.db.execute(
            select(
                LoteEtapa.etapa_id,
                func.count(LoteEtapa.id).label('cantidad'),
                func.avg(
                    extract('epoch', LoteEtapa.fecha_fin - LoteEtapa.fecha_inicio) / 3600
                ).label('promedio_horas')
            )
            .join(LoteProduccion, LoteEtapa.lote_id == LoteProduccion.id)
            .where(and_(
                LoteProduccion.activo == True,
                LoteEtapa.fecha_fin.isnot(None),
                LoteProduccion.fecha_ingreso >= fecha_desde,
                LoteProduccion.fecha_ingreso <= fecha_hasta
            ))
            .group_by(LoteEtapa.etapa_id)
        )

        rows = result.all()
        return [
            {
                "etapa_id": str(row.etapa_id),
                "cantidad_procesos": row.cantidad or 0,
                "promedio_horas": float(row.promedio_horas or 0),
            }
            for row in rows
        ]

    # ==================== REPORTES FINANCIEROS ====================

    async def get_flujo_caja_periodo(
        self,
        fecha_desde: date,
        fecha_hasta: date,
        agrupacion: str = "dia"
    ) -> List[Dict[str, Any]]:
        """Reporte de flujo de caja por período"""
        if agrupacion == "dia":
            group_expr = func.date(MovimientoCaja.created_at)
        elif agrupacion == "semana":
            group_expr = func.date_trunc('week', MovimientoCaja.created_at)
        else:
            group_expr = func.date_trunc('month', MovimientoCaja.created_at)

        result = await self.db.execute(
            select(
                group_expr.label('periodo'),
                func.sum(
                    case(
                        (MovimientoCaja.tipo == 'ingreso', MovimientoCaja.monto),
                        else_=Decimal("0")
                    )
                ).label('ingresos'),
                func.sum(
                    case(
                        (MovimientoCaja.tipo == 'egreso', MovimientoCaja.monto),
                        else_=Decimal("0")
                    )
                ).label('egresos')
            )
            .where(and_(
                MovimientoCaja.anulado == False,
                func.date(MovimientoCaja.created_at) >= fecha_desde,
                func.date(MovimientoCaja.created_at) <= fecha_hasta
            ))
            .group_by(group_expr)
            .order_by(group_expr)
        )

        rows = result.all()
        return [
            {
                "periodo": row.periodo,
                "ingresos": float(row.ingresos or 0),
                "egresos": float(row.egresos or 0),
                "balance": float((row.ingresos or 0) - (row.egresos or 0)),
            }
            for row in rows
        ]

    async def get_movimientos_por_categoria(
        self,
        fecha_desde: date,
        fecha_hasta: date,
        tipo: Optional[str] = None  # ingreso o egreso
    ) -> List[Dict[str, Any]]:
        """Reporte de movimientos de caja por categoría"""
        query = select(
            MovimientoCaja.categoria,
            MovimientoCaja.tipo,
            func.count(MovimientoCaja.id).label('cantidad'),
            func.sum(MovimientoCaja.monto).label('total')
        ).where(and_(
            MovimientoCaja.anulado == False,
            func.date(MovimientoCaja.created_at) >= fecha_desde,
            func.date(MovimientoCaja.created_at) <= fecha_hasta
        ))

        if tipo:
            query = query.where(MovimientoCaja.tipo == tipo)

        query = query.group_by(MovimientoCaja.categoria, MovimientoCaja.tipo)
        query = query.order_by(func.sum(MovimientoCaja.monto).desc())

        result = await self.db.execute(query)
        rows = result.all()

        return [
            {
                "categoria": row.categoria,
                "tipo": row.tipo,
                "cantidad": row.cantidad or 0,
                "total": float(row.total or 0),
            }
            for row in rows
        ]

    # ==================== REPORTES DE STOCK ====================

    async def get_movimientos_stock(
        self,
        fecha_desde: date,
        fecha_hasta: date,
        insumo_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """Reporte de movimientos de stock"""
        query = select(
            MovimientoStock.insumo_id,
            Insumo.nombre,
            func.sum(
                case(
                    (MovimientoStock.tipo == 'entrada', MovimientoStock.cantidad),
                    else_=Decimal("0")
                )
            ).label('entradas'),
            func.sum(
                case(
                    (MovimientoStock.tipo == 'salida', MovimientoStock.cantidad),
                    else_=Decimal("0")
                )
            ).label('salidas')
        ).join(Insumo, MovimientoStock.insumo_id == Insumo.id
        ).where(and_(
            func.date(MovimientoStock.created_at) >= fecha_desde,
            func.date(MovimientoStock.created_at) <= fecha_hasta
        ))

        if insumo_id:
            query = query.where(MovimientoStock.insumo_id == insumo_id)

        query = query.group_by(MovimientoStock.insumo_id, Insumo.nombre)

        result = await self.db.execute(query)
        rows = result.all()

        return [
            {
                "insumo_id": str(row.insumo_id),
                "insumo_nombre": row.nombre,
                "entradas": float(row.entradas or 0),
                "salidas": float(row.salidas or 0),
                "neto": float((row.entradas or 0) - (row.salidas or 0)),
            }
            for row in rows
        ]

    async def get_stock_bajo_minimo(self) -> List[Dict[str, Any]]:
        """Reporte de insumos con stock bajo el mínimo"""
        result = await self.db.execute(
            select(Insumo)
            .where(and_(
                Insumo.activo == True,
                Insumo.stock_actual < Insumo.stock_minimo
            ))
            .order_by((Insumo.stock_actual / Insumo.stock_minimo))
        )

        insumos = result.scalars().all()
        return [
            {
                "insumo_id": str(i.id),
                "codigo": i.codigo,
                "nombre": i.nombre,
                "stock_actual": float(i.stock_actual),
                "stock_minimo": float(i.stock_minimo),
                "diferencia": float(i.stock_minimo - i.stock_actual),
                "porcentaje": float(i.stock_actual / i.stock_minimo * 100) if i.stock_minimo > 0 else 0,
            }
            for i in insumos
        ]

    # ==================== REPORTES DE EMPLEADOS ====================

    async def get_asistencia_periodo(
        self,
        fecha_desde: date,
        fecha_hasta: date,
        empleado_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """Reporte de asistencia por período"""
        query = select(
            JornadaLaboral.empleado_id,
            Empleado.nombre,
            Empleado.apellido,
            func.count(JornadaLaboral.id).label('dias_registrados'),
            func.sum(JornadaLaboral.horas_trabajadas).label('horas_trabajadas'),
            func.sum(JornadaLaboral.horas_extra).label('horas_extra'),
            func.sum(
                case((JornadaLaboral.llegada_tarde == True, 1), else_=0)
            ).label('llegadas_tarde'),
            func.sum(
                case((JornadaLaboral.ausente == True, 1), else_=0)
            ).label('ausencias')
        ).join(Empleado, JornadaLaboral.empleado_id == Empleado.id
        ).where(and_(
            JornadaLaboral.fecha >= fecha_desde,
            JornadaLaboral.fecha <= fecha_hasta
        ))

        if empleado_id:
            query = query.where(JornadaLaboral.empleado_id == empleado_id)

        query = query.group_by(
            JornadaLaboral.empleado_id,
            Empleado.nombre,
            Empleado.apellido
        )

        result = await self.db.execute(query)
        rows = result.all()

        return [
            {
                "empleado_id": str(row.empleado_id),
                "empleado_nombre": f"{row.nombre} {row.apellido}",
                "dias_registrados": row.dias_registrados or 0,
                "horas_trabajadas": float(row.horas_trabajadas or 0),
                "horas_extra": float(row.horas_extra or 0),
                "llegadas_tarde": row.llegadas_tarde or 0,
                "ausencias": row.ausencias or 0,
            }
            for row in rows
        ]

    # ==================== REPORTES GENERALES ====================

    async def get_resumen_general(
        self,
        fecha_desde: date,
        fecha_hasta: date
    ) -> Dict[str, Any]:
        """Resumen general del período"""
        # Ventas
        ventas_result = await self.db.execute(
            select(
                func.count(Pedido.id).label('cantidad_pedidos'),
                func.sum(Pedido.total).label('total_ventas')
            )
            .where(and_(
                Pedido.activo == True,
                Pedido.fecha_pedido >= fecha_desde,
                Pedido.fecha_pedido <= fecha_hasta
            ))
        )
        ventas = ventas_result.one()

        # Producción
        produccion_result = await self.db.execute(
            select(
                func.count(LoteProduccion.id).label('cantidad_lotes'),
                func.sum(
                    case(
                        (LoteProduccion.estado == EstadoLote.COMPLETADO.value, 1),
                        else_=0
                    )
                ).label('lotes_completados')
            )
            .where(and_(
                LoteProduccion.activo == True,
                LoteProduccion.fecha_ingreso >= fecha_desde,
                LoteProduccion.fecha_ingreso <= fecha_hasta
            ))
        )
        produccion = produccion_result.one()

        # Finanzas
        finanzas_result = await self.db.execute(
            select(
                func.sum(
                    case(
                        (MovimientoCaja.tipo == 'ingreso', MovimientoCaja.monto),
                        else_=Decimal("0")
                    )
                ).label('ingresos'),
                func.sum(
                    case(
                        (MovimientoCaja.tipo == 'egreso', MovimientoCaja.monto),
                        else_=Decimal("0")
                    )
                ).label('egresos')
            )
            .where(and_(
                MovimientoCaja.anulado == False,
                func.date(MovimientoCaja.created_at) >= fecha_desde,
                func.date(MovimientoCaja.created_at) <= fecha_hasta
            ))
        )
        finanzas = finanzas_result.one()

        # Clientes nuevos
        clientes_result = await self.db.execute(
            select(func.count(Cliente.id))
            .where(and_(
                Cliente.activo == True,
                func.date(Cliente.created_at) >= fecha_desde,
                func.date(Cliente.created_at) <= fecha_hasta
            ))
        )
        clientes_nuevos = clientes_result.scalar() or 0

        ingresos = finanzas.ingresos or Decimal("0")
        egresos = finanzas.egresos or Decimal("0")

        return {
            "periodo": {
                "desde": fecha_desde.isoformat(),
                "hasta": fecha_hasta.isoformat(),
            },
            "ventas": {
                "cantidad_pedidos": ventas.cantidad_pedidos or 0,
                "total": float(ventas.total_ventas or 0),
            },
            "produccion": {
                "cantidad_lotes": produccion.cantidad_lotes or 0,
                "lotes_completados": produccion.lotes_completados or 0,
            },
            "finanzas": {
                "ingresos": float(ingresos),
                "egresos": float(egresos),
                "balance": float(ingresos - egresos),
            },
            "clientes_nuevos": clientes_nuevos,
        }
