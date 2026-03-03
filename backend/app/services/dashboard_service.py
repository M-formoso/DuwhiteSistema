"""
Servicio de Dashboard para DUWHITE ERP
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlalchemy import select, func, and_, or_, case, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pedido import Pedido, EstadoPedido
from app.models.cliente import Cliente
from app.models.lote_produccion import LoteProduccion, EstadoLote
from app.models.caja import Caja, MovimientoCaja, EstadoCaja
from app.models.insumo import Insumo
from app.models.empleado import Empleado, EstadoEmpleado


class DashboardService:
    """Servicio para el dashboard principal"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_kpis_principales(self) -> Dict[str, Any]:
        """Obtiene los KPIs principales del dashboard"""
        hoy = date.today()
        inicio_mes = date(hoy.year, hoy.month, 1)
        inicio_semana = hoy - timedelta(days=hoy.weekday())

        # Ventas del mes
        ventas_mes_result = await self.db.execute(
            select(
                func.count(Pedido.id).label('cantidad'),
                func.sum(Pedido.total).label('total')
            )
            .where(and_(
                Pedido.activo == True,
                Pedido.fecha_pedido >= inicio_mes
            ))
        )
        ventas_mes = ventas_mes_result.one()

        # Ventas de hoy
        ventas_hoy_result = await self.db.execute(
            select(
                func.count(Pedido.id).label('cantidad'),
                func.sum(Pedido.total).label('total')
            )
            .where(and_(
                Pedido.activo == True,
                Pedido.fecha_pedido == hoy
            ))
        )
        ventas_hoy = ventas_hoy_result.one()

        # Producción en proceso
        produccion_result = await self.db.execute(
            select(func.count(LoteProduccion.id))
            .where(and_(
                LoteProduccion.activo == True,
                LoteProduccion.estado == EstadoLote.EN_PROCESO.value
            ))
        )
        lotes_en_proceso = produccion_result.scalar() or 0

        # Lotes completados hoy
        lotes_hoy_result = await self.db.execute(
            select(func.count(LoteProduccion.id))
            .where(and_(
                LoteProduccion.activo == True,
                LoteProduccion.estado == EstadoLote.COMPLETADO.value,
                func.date(LoteProduccion.fecha_completado) == hoy
            ))
        )
        lotes_completados_hoy = lotes_hoy_result.scalar() or 0

        # Caja actual
        caja_result = await self.db.execute(
            select(Caja)
            .where(and_(
                Caja.activo == True,
                Caja.estado == EstadoCaja.ABIERTA.value
            ))
            .order_by(Caja.fecha_apertura.desc())
            .limit(1)
        )
        caja = caja_result.scalar_one_or_none()

        saldo_caja = Decimal("0")
        if caja:
            saldo_caja = caja.saldo_inicial + caja.total_ingresos - caja.total_egresos

        # Clientes activos
        clientes_result = await self.db.execute(
            select(func.count(Cliente.id))
            .where(Cliente.activo == True)
        )
        clientes_activos = clientes_result.scalar() or 0

        # Insumos bajo mínimo
        insumos_bajo_result = await self.db.execute(
            select(func.count(Insumo.id))
            .where(and_(
                Insumo.activo == True,
                Insumo.stock_actual < Insumo.stock_minimo
            ))
        )
        insumos_bajo_minimo = insumos_bajo_result.scalar() or 0

        # Empleados activos
        empleados_result = await self.db.execute(
            select(func.count(Empleado.id))
            .where(and_(
                Empleado.activo == True,
                Empleado.estado == EstadoEmpleado.ACTIVO.value
            ))
        )
        empleados_activos = empleados_result.scalar() or 0

        return {
            "ventas": {
                "mes": {
                    "cantidad": ventas_mes.cantidad or 0,
                    "total": float(ventas_mes.total or 0),
                },
                "hoy": {
                    "cantidad": ventas_hoy.cantidad or 0,
                    "total": float(ventas_hoy.total or 0),
                }
            },
            "produccion": {
                "lotes_en_proceso": lotes_en_proceso,
                "lotes_completados_hoy": lotes_completados_hoy,
            },
            "finanzas": {
                "saldo_caja": float(saldo_caja),
                "caja_abierta": caja is not None,
            },
            "operacion": {
                "clientes_activos": clientes_activos,
                "empleados_activos": empleados_activos,
                "insumos_bajo_minimo": insumos_bajo_minimo,
            }
        }

    async def get_grafico_ventas_semana(self) -> List[Dict[str, Any]]:
        """Ventas de los últimos 7 días para gráfico"""
        hoy = date.today()
        hace_7_dias = hoy - timedelta(days=6)

        result = await self.db.execute(
            select(
                Pedido.fecha_pedido,
                func.count(Pedido.id).label('cantidad'),
                func.sum(Pedido.total).label('total')
            )
            .where(and_(
                Pedido.activo == True,
                Pedido.fecha_pedido >= hace_7_dias,
                Pedido.fecha_pedido <= hoy
            ))
            .group_by(Pedido.fecha_pedido)
            .order_by(Pedido.fecha_pedido)
        )

        rows = result.all()

        # Crear estructura con todos los días (incluyendo días sin ventas)
        ventas_por_dia = {row.fecha_pedido: row for row in rows}
        datos = []

        for i in range(7):
            dia = hace_7_dias + timedelta(days=i)
            if dia in ventas_por_dia:
                row = ventas_por_dia[dia]
                datos.append({
                    "fecha": dia.isoformat(),
                    "dia": dia.strftime("%a"),
                    "cantidad": row.cantidad,
                    "total": float(row.total or 0),
                })
            else:
                datos.append({
                    "fecha": dia.isoformat(),
                    "dia": dia.strftime("%a"),
                    "cantidad": 0,
                    "total": 0.0,
                })

        return datos

    async def get_pedidos_recientes(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Últimos pedidos ingresados"""
        result = await self.db.execute(
            select(Pedido, Cliente.razon_social)
            .join(Cliente, Pedido.cliente_id == Cliente.id)
            .where(Pedido.activo == True)
            .order_by(Pedido.created_at.desc())
            .limit(limit)
        )

        rows = result.all()
        return [
            {
                "id": str(pedido.id),
                "numero": pedido.numero,
                "cliente": razon_social,
                "fecha": pedido.fecha_pedido.isoformat(),
                "estado": pedido.estado,
                "total": float(pedido.total),
            }
            for pedido, razon_social in rows
        ]

    async def get_lotes_en_proceso(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Lotes actualmente en proceso"""
        result = await self.db.execute(
            select(LoteProduccion)
            .where(and_(
                LoteProduccion.activo == True,
                LoteProduccion.estado == EstadoLote.EN_PROCESO.value
            ))
            .order_by(LoteProduccion.prioridad.desc(), LoteProduccion.fecha_ingreso)
            .limit(limit)
        )

        lotes = result.scalars().all()
        return [
            {
                "id": str(lote.id),
                "codigo": lote.codigo,
                "tipo_servicio": lote.tipo_servicio,
                "prioridad": lote.prioridad,
                "peso_total": float(lote.peso_entrada_kg) if lote.peso_entrada_kg else 0,
                "fecha_ingreso": lote.fecha_ingreso.isoformat(),
                "etapa_actual_id": str(lote.etapa_actual_id) if lote.etapa_actual_id else None,
            }
            for lote in lotes
        ]

    async def get_alertas(self) -> List[Dict[str, Any]]:
        """Obtiene alertas del sistema"""
        alertas = []

        # Alertas de stock bajo
        insumos_bajo = await self.db.execute(
            select(Insumo)
            .where(and_(
                Insumo.activo == True,
                Insumo.stock_actual < Insumo.stock_minimo
            ))
            .limit(5)
        )
        for insumo in insumos_bajo.scalars():
            alertas.append({
                "tipo": "stock",
                "nivel": "warning",
                "titulo": "Stock bajo mínimo",
                "mensaje": f"{insumo.nombre}: {insumo.stock_actual} {insumo.unidad_medida} (mín: {insumo.stock_minimo})",
                "entidad_id": str(insumo.id),
            })

        # Alertas de pedidos pendientes antiguos (más de 3 días)
        hace_3_dias = date.today() - timedelta(days=3)
        pedidos_antiguos = await self.db.execute(
            select(Pedido)
            .where(and_(
                Pedido.activo == True,
                Pedido.estado == EstadoPedido.PENDIENTE.value,
                Pedido.fecha_pedido <= hace_3_dias
            ))
            .limit(5)
        )
        for pedido in pedidos_antiguos.scalars():
            alertas.append({
                "tipo": "pedido",
                "nivel": "warning",
                "titulo": "Pedido pendiente",
                "mensaje": f"Pedido #{pedido.numero} del {pedido.fecha_pedido.strftime('%d/%m')} sigue pendiente",
                "entidad_id": str(pedido.id),
            })

        # Alerta de caja no abierta
        caja = await self.db.execute(
            select(Caja)
            .where(and_(
                Caja.activo == True,
                Caja.fecha == date.today(),
                Caja.estado == EstadoCaja.ABIERTA.value
            ))
        )
        if not caja.scalar_one_or_none():
            alertas.append({
                "tipo": "caja",
                "nivel": "info",
                "titulo": "Caja no abierta",
                "mensaje": "No se ha abierto la caja del día",
                "entidad_id": None,
            })

        # Lotes urgentes
        lotes_urgentes = await self.db.execute(
            select(LoteProduccion)
            .where(and_(
                LoteProduccion.activo == True,
                LoteProduccion.prioridad == "urgente",
                LoteProduccion.estado.in_([EstadoLote.PENDIENTE.value, EstadoLote.EN_PROCESO.value])
            ))
            .limit(3)
        )
        for lote in lotes_urgentes.scalars():
            alertas.append({
                "tipo": "produccion",
                "nivel": "error",
                "titulo": "Lote urgente",
                "mensaje": f"Lote {lote.codigo} marcado como urgente",
                "entidad_id": str(lote.id),
            })

        return alertas

    async def get_resumen_movimientos_hoy(self) -> Dict[str, Any]:
        """Resumen de movimientos de caja del día"""
        hoy = date.today()

        result = await self.db.execute(
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
                ).label('egresos'),
                func.count(MovimientoCaja.id).label('cantidad')
            )
            .where(and_(
                MovimientoCaja.anulado == False,
                func.date(MovimientoCaja.created_at) == hoy
            ))
        )

        row = result.one()
        ingresos = row.ingresos or Decimal("0")
        egresos = row.egresos or Decimal("0")

        return {
            "ingresos": float(ingresos),
            "egresos": float(egresos),
            "balance": float(ingresos - egresos),
            "cantidad_movimientos": row.cantidad or 0,
        }

    async def get_dashboard_completo(self) -> Dict[str, Any]:
        """Obtiene todos los datos del dashboard en una sola llamada"""
        kpis = await self.get_kpis_principales()
        grafico_ventas = await self.get_grafico_ventas_semana()
        pedidos_recientes = await self.get_pedidos_recientes()
        lotes_en_proceso = await self.get_lotes_en_proceso()
        alertas = await self.get_alertas()
        movimientos_hoy = await self.get_resumen_movimientos_hoy()

        return {
            "kpis": kpis,
            "grafico_ventas_semana": grafico_ventas,
            "pedidos_recientes": pedidos_recientes,
            "lotes_en_proceso": lotes_en_proceso,
            "alertas": alertas,
            "movimientos_hoy": movimientos_hoy,
            "actualizado_at": datetime.now().isoformat(),
        }
