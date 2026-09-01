"""
Servicio de Dashboard para DUWHITE ERP
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlalchemy import select, func, and_, or_, case, desc
from sqlalchemy.orm import Session

from app.models.pedido import Pedido, EstadoPedido
from app.models.cliente import Cliente
from app.models.lote_produccion import LoteProduccion, EstadoLote
from app.models.caja import Caja, MovimientoCaja, EstadoCaja
from app.models.insumo import Insumo
from app.models.empleado import Empleado, EstadoEmpleado
from app.models.remito import Remito, EstadoRemito


# Estados de remito que representan una venta efectiva (no borrador ni anulado).
_REMITO_ESTADOS_VENTA = (EstadoRemito.EMITIDO.value, EstadoRemito.ENTREGADO.value)

# Días de la semana en español (Lun=0 ... Dom=6). Usamos mapeo manual en
# vez de `strftime("%a")` porque en el servidor el locale es en inglés.
_DIAS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
_MESES_ES = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
]


class DashboardService:
    """Servicio para el dashboard principal"""

    def __init__(self, db: Session):
        self.db = db

    def get_kpis_principales(self) -> Dict[str, Any]:
        """Obtiene los KPIs principales del dashboard"""
        hoy = date.today()
        inicio_mes = date(hoy.year, hoy.month, 1)
        inicio_semana = hoy - timedelta(days=hoy.weekday())

        # Ventas del mes: en DUWHITE la venta efectiva se registra al emitir
        # el Remito (el Pedido nace vacío en la recolección y no se recalcula).
        ventas_mes_result = self.db.execute(
            select(
                func.count(Remito.id).label('cantidad'),
                func.sum(Remito.total).label('total')
            )
            .where(and_(
                Remito.estado.in_(_REMITO_ESTADOS_VENTA),
                Remito.fecha_emision >= inicio_mes
            ))
        )
        ventas_mes = ventas_mes_result.one()

        # Ventas de hoy
        ventas_hoy_result = self.db.execute(
            select(
                func.count(Remito.id).label('cantidad'),
                func.sum(Remito.total).label('total')
            )
            .where(and_(
                Remito.estado.in_(_REMITO_ESTADOS_VENTA),
                Remito.fecha_emision == hoy
            ))
        )
        ventas_hoy = ventas_hoy_result.one()

        # Producción en proceso
        produccion_result = self.db.execute(
            select(func.count(LoteProduccion.id))
            .where(and_(
                LoteProduccion.activo == True,
                LoteProduccion.estado == EstadoLote.EN_PROCESO.value
            ))
        )
        lotes_en_proceso = produccion_result.scalar() or 0

        # Lotes completados hoy
        lotes_hoy_result = self.db.execute(
            select(func.count(LoteProduccion.id))
            .where(and_(
                LoteProduccion.activo == True,
                LoteProduccion.estado == EstadoLote.COMPLETADO.value,
                func.date(LoteProduccion.fecha_fin_proceso) == hoy
            ))
        )
        lotes_completados_hoy = lotes_hoy_result.scalar() or 0

        # Caja actual
        caja_result = self.db.execute(
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
        clientes_result = self.db.execute(
            select(func.count(Cliente.id))
            .where(Cliente.activo == True)
        )
        clientes_activos = clientes_result.scalar() or 0

        # Insumos bajo mínimo
        insumos_bajo_result = self.db.execute(
            select(func.count(Insumo.id))
            .where(and_(
                Insumo.activo == True,
                Insumo.stock_actual < Insumo.stock_minimo
            ))
        )
        insumos_bajo_minimo = insumos_bajo_result.scalar() or 0

        # Empleados activos
        empleados_result = self.db.execute(
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

    def get_grafico_ventas(self, rango: str = "semana") -> List[Dict[str, Any]]:
        """
        Ventas agrupadas según el rango elegido (basado en Remitos EMITIDOS/
        ENTREGADOS).

        - "semana": últimos 7 días, agrupado por día (Lun...Dom).
        - "mes": últimos 30 días, agrupado por día (dd/mm).
        - "anio": últimos 12 meses, agrupado por mes (Ene...Dic).
        """
        hoy = date.today()
        rango = (rango or "semana").lower()

        if rango == "anio":
            return self._grafico_por_mes(hoy)
        if rango == "mes":
            return self._grafico_por_dia(hoy, dias=30, formato_dia="dd/mm")
        return self._grafico_por_dia(hoy, dias=7, formato_dia="semana")

    # Compat: nombre viejo usado por el endpoint /dashboard existente.
    def get_grafico_ventas_semana(self) -> List[Dict[str, Any]]:
        return self.get_grafico_ventas("semana")

    def _grafico_por_dia(
        self,
        hoy: date,
        dias: int,
        formato_dia: str,
    ) -> List[Dict[str, Any]]:
        desde = hoy - timedelta(days=dias - 1)

        result = self.db.execute(
            select(
                Remito.fecha_emision.label('fecha'),
                func.count(Remito.id).label('cantidad'),
                func.sum(Remito.total).label('total')
            )
            .where(and_(
                Remito.estado.in_(_REMITO_ESTADOS_VENTA),
                Remito.fecha_emision >= desde,
                Remito.fecha_emision <= hoy
            ))
            .group_by(Remito.fecha_emision)
            .order_by(Remito.fecha_emision)
        )
        ventas = {row.fecha: row for row in result.all()}

        datos: List[Dict[str, Any]] = []
        for i in range(dias):
            dia = desde + timedelta(days=i)
            if formato_dia == "dd/mm":
                label = f"{dia.day:02d}/{dia.month:02d}"
            else:
                label = _DIAS_ES[dia.weekday()]
            row = ventas.get(dia)
            datos.append({
                "fecha": dia.isoformat(),
                "dia": label,
                "cantidad": int(row.cantidad) if row else 0,
                "total": float(row.total or 0) if row else 0.0,
            })
        return datos

    def _grafico_por_mes(self, hoy: date) -> List[Dict[str, Any]]:
        # Anclar en el primer día del mes actual y retroceder 11 meses.
        primer_dia_mes_actual = date(hoy.year, hoy.month, 1)
        anio_inicio = primer_dia_mes_actual.year
        mes_inicio = primer_dia_mes_actual.month - 11
        while mes_inicio <= 0:
            mes_inicio += 12
            anio_inicio -= 1
        desde = date(anio_inicio, mes_inicio, 1)

        result = self.db.execute(
            select(
                func.date_trunc('month', Remito.fecha_emision).label('mes'),
                func.count(Remito.id).label('cantidad'),
                func.sum(Remito.total).label('total')
            )
            .where(and_(
                Remito.estado.in_(_REMITO_ESTADOS_VENTA),
                Remito.fecha_emision >= desde,
                Remito.fecha_emision <= hoy
            ))
            .group_by(func.date_trunc('month', Remito.fecha_emision))
            .order_by(func.date_trunc('month', Remito.fecha_emision))
        )
        # `date_trunc` devuelve un datetime; lo normalizamos a (anio, mes).
        ventas = {}
        for row in result.all():
            mes_obj = row.mes
            key = (mes_obj.year, mes_obj.month)
            ventas[key] = row

        datos: List[Dict[str, Any]] = []
        anio, mes = anio_inicio, mes_inicio
        for _ in range(12):
            key = (anio, mes)
            row = ventas.get(key)
            label = _MESES_ES[mes - 1]
            # Si el rango cruza dos años, aclaramos el año en el label.
            if anio != hoy.year:
                label = f"{label} {str(anio)[-2:]}"
            datos.append({
                "fecha": date(anio, mes, 1).isoformat(),
                "dia": label,
                "cantidad": int(row.cantidad) if row else 0,
                "total": float(row.total or 0) if row else 0.0,
            })
            mes += 1
            if mes > 12:
                mes = 1
                anio += 1
        return datos

    def get_pedidos_recientes(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Últimos pedidos ingresados"""
        result = self.db.execute(
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

    def get_lotes_en_proceso(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Lotes actualmente en proceso"""
        result = self.db.execute(
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
                "codigo": lote.numero,
                "tipo_servicio": lote.tipo_servicio,
                "prioridad": lote.prioridad,
                "peso_total": float(lote.peso_entrada_kg) if lote.peso_entrada_kg else 0,
                "fecha_ingreso": lote.fecha_ingreso.isoformat() if lote.fecha_ingreso else None,
                "etapa_actual_id": str(lote.etapa_actual_id) if lote.etapa_actual_id else None,
            }
            for lote in lotes
        ]

    def get_alertas(self) -> List[Dict[str, Any]]:
        """Obtiene alertas del sistema"""
        alertas = []

        # Alertas de stock bajo
        insumos_bajo = self.db.execute(
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
                "mensaje": f"{insumo.nombre}: {insumo.stock_actual} {insumo.unidad} (mín: {insumo.stock_minimo})",
                "entidad_id": str(insumo.id),
            })

        # Alertas de pedidos pendientes antiguos (más de 3 días)
        hace_3_dias = date.today() - timedelta(days=3)
        pedidos_antiguos = self.db.execute(
            select(Pedido)
            .where(and_(
                Pedido.activo == True,
                Pedido.estado.in_([EstadoPedido.BORRADOR.value, EstadoPedido.CONFIRMADO.value]),
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
        caja = self.db.execute(
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
        lotes_urgentes = self.db.execute(
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
                "mensaje": f"Lote {lote.numero} marcado como urgente",
                "entidad_id": str(lote.id),
            })

        return alertas

    def get_resumen_movimientos_hoy(self) -> Dict[str, Any]:
        """Resumen de movimientos de caja del día"""
        hoy = date.today()

        result = self.db.execute(
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

    def get_dashboard_completo(self) -> Dict[str, Any]:
        """Obtiene todos los datos del dashboard en una sola llamada"""
        try:
            kpis = self.get_kpis_principales()
        except Exception as e:
            print(f"Error en get_kpis_principales: {e}")
            kpis = {
                "ventas": {"mes": {"cantidad": 0, "total": 0}, "hoy": {"cantidad": 0, "total": 0}},
                "produccion": {"lotes_en_proceso": 0, "lotes_completados_hoy": 0},
                "finanzas": {"saldo_caja": 0, "caja_abierta": False},
                "operacion": {"clientes_activos": 0, "empleados_activos": 0, "insumos_bajo_minimo": 0}
            }

        try:
            grafico_ventas = self.get_grafico_ventas_semana()
        except Exception as e:
            print(f"Error en get_grafico_ventas_semana: {e}")
            grafico_ventas = []

        try:
            pedidos_recientes = self.get_pedidos_recientes()
        except Exception as e:
            print(f"Error en get_pedidos_recientes: {e}")
            pedidos_recientes = []

        try:
            lotes_en_proceso = self.get_lotes_en_proceso()
        except Exception as e:
            print(f"Error en get_lotes_en_proceso: {e}")
            lotes_en_proceso = []

        try:
            alertas = self.get_alertas()
        except Exception as e:
            print(f"Error en get_alertas: {e}")
            alertas = []

        try:
            movimientos_hoy = self.get_resumen_movimientos_hoy()
        except Exception as e:
            print(f"Error en get_resumen_movimientos_hoy: {e}")
            movimientos_hoy = {"ingresos": 0, "egresos": 0, "balance": 0, "cantidad_movimientos": 0}

        return {
            "kpis": kpis,
            "grafico_ventas_semana": grafico_ventas,
            "pedidos_recientes": pedidos_recientes,
            "lotes_en_proceso": lotes_en_proceso,
            "alertas": alertas,
            "movimientos_hoy": movimientos_hoy,
            "actualizado_at": datetime.now().isoformat(),
        }
