"""
Servicio de Reportes para DUWHITE ERP
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlalchemy import func, and_, or_, extract, case
from sqlalchemy.orm import Session

from app.models.pedido import Pedido, DetallePedido, EstadoPedido
from app.models.cliente import Cliente
from app.models.lote_produccion import LoteProduccion, LoteEtapa, EstadoLote
from app.models.caja import Caja, MovimientoCaja, EstadoCaja
from app.models.insumo import Insumo
from app.models.movimiento_stock import MovimientoStock
from app.models.empleado import Empleado, JornadaLaboral
from app.models.lista_precios import Servicio
from app.models.etapa_produccion import EtapaProduccion
from app.models.producto_lavado import ProductoLavado
from app.models.remito import Remito, DetalleRemito, EstadoRemito


# ==================== REPORTES DE VENTAS ====================

def get_ventas_por_periodo(
    db: Session,
    fecha_desde: date,
    fecha_hasta: date,
    agrupacion: str = "dia"  # dia, semana, mes
) -> List[Dict[str, Any]]:
    """Reporte de ventas agrupado por período"""
    if agrupacion == "dia":
        group_expr = func.date(Pedido.fecha_pedido)
        format_label = lambda d: d.strftime("%d/%m/%Y") if d else ""
    elif agrupacion == "semana":
        group_expr = func.date_trunc('week', Pedido.fecha_pedido)
        format_label = lambda d: f"Sem {d.isocalendar()[1]} - {d.year}" if d else ""
    else:  # mes
        group_expr = func.date_trunc('month', Pedido.fecha_pedido)
        format_label = lambda d: d.strftime("%m/%Y") if d else ""

    result = db.query(
        group_expr.label('periodo'),
        func.count(Pedido.id).label('cantidad_pedidos'),
        func.sum(Pedido.subtotal).label('subtotal'),
        func.sum(Pedido.descuento_monto).label('descuentos'),
        func.sum(Pedido.total).label('total')
    ).filter(
        Pedido.activo == True,
        Pedido.fecha_pedido >= fecha_desde,
        Pedido.fecha_pedido <= fecha_hasta
    ).group_by(group_expr).order_by(group_expr).all()

    return [
        {
            "periodo": row.periodo.isoformat() if row.periodo else None,
            "periodo_label": format_label(row.periodo),
            "cantidad_pedidos": row.cantidad_pedidos or 0,
            "subtotal": float(row.subtotal or 0),
            "descuentos": float(row.descuentos or 0),
            "total": float(row.total or 0),
        }
        for row in result
    ]


def get_ventas_por_cliente(
    db: Session,
    fecha_desde: date,
    fecha_hasta: date,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """Reporte de ventas por cliente (top clientes)"""
    result = db.query(
        Pedido.cliente_id,
        Cliente.razon_social,
        func.count(Pedido.id).label('cantidad_pedidos'),
        func.sum(Pedido.total).label('total'),
        func.avg(Pedido.total).label('promedio_pedido')
    ).join(
        Cliente, Pedido.cliente_id == Cliente.id
    ).filter(
        Pedido.activo == True,
        Pedido.fecha_pedido >= fecha_desde,
        Pedido.fecha_pedido <= fecha_hasta
    ).group_by(
        Pedido.cliente_id, Cliente.razon_social
    ).order_by(
        func.sum(Pedido.total).desc()
    ).limit(limit).all()

    return [
        {
            "cliente_id": str(row.cliente_id),
            "cliente_nombre": row.razon_social,
            "cantidad_pedidos": row.cantidad_pedidos or 0,
            "total": float(row.total or 0),
            "promedio_pedido": float(row.promedio_pedido or 0),
        }
        for row in result
    ]


def get_ventas_por_servicio(
    db: Session,
    fecha_desde: date,
    fecha_hasta: date
) -> List[Dict[str, Any]]:
    """Reporte de ventas por tipo de servicio"""
    result = db.query(
        DetallePedido.servicio_id,
        Servicio.nombre,
        func.count(DetallePedido.id).label('cantidad'),
        func.sum(DetallePedido.cantidad).label('unidades'),
        func.sum(DetallePedido.subtotal).label('total')
    ).join(
        Pedido, DetallePedido.pedido_id == Pedido.id
    ).join(
        Servicio, DetallePedido.servicio_id == Servicio.id
    ).filter(
        Pedido.activo == True,
        Pedido.fecha_pedido >= fecha_desde,
        Pedido.fecha_pedido <= fecha_hasta
    ).group_by(
        DetallePedido.servicio_id, Servicio.nombre
    ).order_by(
        func.sum(DetallePedido.subtotal).desc()
    ).all()

    return [
        {
            "servicio_id": str(row.servicio_id),
            "servicio_nombre": row.nombre,
            "cantidad_items": row.cantidad or 0,
            "unidades_vendidas": float(row.unidades or 0),
            "total": float(row.total or 0),
        }
        for row in result
    ]


# ==================== REPORTES DE PRODUCCION ====================

def get_produccion_por_periodo(
    db: Session,
    fecha_desde: date,
    fecha_hasta: date,
    agrupacion: str = "dia"
) -> List[Dict[str, Any]]:
    """Reporte de producción por período"""
    if agrupacion == "dia":
        group_expr = func.date(LoteProduccion.fecha_ingreso)
    elif agrupacion == "semana":
        group_expr = func.date_trunc('week', LoteProduccion.fecha_ingreso)
    else:
        group_expr = func.date_trunc('month', LoteProduccion.fecha_ingreso)

    result = db.query(
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
    ).filter(
        LoteProduccion.activo == True,
        LoteProduccion.fecha_ingreso >= fecha_desde,
        LoteProduccion.fecha_ingreso <= fecha_hasta
    ).group_by(group_expr).order_by(group_expr).all()

    return [
        {
            "periodo": row.periodo.isoformat() if row.periodo else None,
            "cantidad_lotes": row.cantidad_lotes or 0,
            "kg_total": float(row.kg_total or 0),
            "lotes_completados": row.lotes_completados or 0,
            "lotes_en_proceso": row.lotes_en_proceso or 0,
        }
        for row in result
    ]


def get_produccion_por_etapa(
    db: Session,
    fecha_desde: date,
    fecha_hasta: date
) -> List[Dict[str, Any]]:
    """Reporte de tiempo en cada etapa de producción"""
    from app.models.etapa_produccion import EtapaProduccion

    result = db.query(
        LoteEtapa.etapa_id,
        EtapaProduccion.nombre.label('etapa_nombre'),
        func.count(LoteEtapa.id).label('cantidad'),
        func.avg(
            extract('epoch', LoteEtapa.fecha_fin - LoteEtapa.fecha_inicio) / 3600
        ).label('promedio_horas')
    ).join(
        LoteProduccion, LoteEtapa.lote_id == LoteProduccion.id
    ).join(
        EtapaProduccion, LoteEtapa.etapa_id == EtapaProduccion.id
    ).filter(
        LoteProduccion.activo == True,
        LoteEtapa.fecha_fin.isnot(None),
        LoteProduccion.fecha_ingreso >= fecha_desde,
        LoteProduccion.fecha_ingreso <= fecha_hasta
    ).group_by(LoteEtapa.etapa_id, EtapaProduccion.nombre).all()

    return [
        {
            "etapa_id": str(row.etapa_id),
            "etapa_nombre": row.etapa_nombre,
            "cantidad_procesos": row.cantidad or 0,
            "promedio_horas": round(float(row.promedio_horas or 0), 2),
        }
        for row in result
    ]


def get_analitica_produccion(
    db: Session,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Analítica de producción en tiempo real + finalizados en un rango.

    - "En proceso" es siempre el estado actual (no se filtra por fecha).
    - "Finalizados" / kg / horas planta se calculan dentro del rango
      [fecha_desde, fecha_hasta]. Default = hoy.

    Para cada posta activa devuelve:
    - lotes_en_proceso: lista con número, cliente, operario, kg, minutos en curso
    - lotes_finalizados: lista de etapas finalizadas en el rango
    - kg_en_proceso / kg_finalizado_rango
    - minutos_activos_rango: minutos que la posta estuvo trabajando en el rango
    - throughput_kg_hora: kg finalizados / horas activas (sólo si hay actividad)

    Y un bloque `totales` con sumatorias globales del rango.
    """
    hoy = date.today()
    desde = fecha_desde or hoy
    hasta = fecha_hasta or hoy
    inicio_rango = datetime.combine(desde, datetime.min.time())
    fin_rango = datetime.combine(hasta, datetime.max.time())
    ahora = datetime.utcnow()

    etapas = (
        db.query(EtapaProduccion)
        .filter(EtapaProduccion.activo == True)
        .order_by(EtapaProduccion.orden)
        .all()
    )

    total_kg_en_proceso = 0.0
    total_kg_finalizado_rango = 0.0
    total_lotes_en_proceso = 0
    total_lotes_finalizados_rango = 0
    total_minutos_activos = 0.0

    postas_data: List[Dict[str, Any]] = []

    for etapa in etapas:
        # Lotes en proceso ahora (fecha_inicio sin fecha_fin)
        en_proceso = (
            db.query(LoteEtapa)
            .join(LoteProduccion, LoteEtapa.lote_id == LoteProduccion.id)
            .filter(
                LoteEtapa.etapa_id == etapa.id,
                LoteEtapa.fecha_inicio.isnot(None),
                LoteEtapa.fecha_fin.is_(None),
                LoteProduccion.activo == True,
            )
            .all()
        )

        # Lotes finalizados en el rango en esta etapa
        finalizados_rango = (
            db.query(LoteEtapa)
            .join(LoteProduccion, LoteEtapa.lote_id == LoteProduccion.id)
            .filter(
                LoteEtapa.etapa_id == etapa.id,
                LoteEtapa.fecha_fin >= inicio_rango,
                LoteEtapa.fecha_fin <= fin_rango,
                LoteProduccion.activo == True,
            )
            .all()
        )

        # Construir payload de lotes en proceso
        lotes_en_proceso_data = []
        kg_en_proceso = 0.0
        for le in en_proceso:
            lote = le.lote
            kg = float(lote.peso_entrada_kg or 0)
            kg_en_proceso += kg
            minutos = int((ahora - le.fecha_inicio).total_seconds() / 60) if le.fecha_inicio else 0
            responsable = None
            if le.responsable:
                responsable = f"{le.responsable.nombre} {le.responsable.apellido or ''}".strip()
            lotes_en_proceso_data.append({
                "lote_id": str(lote.id),
                "lote_numero": lote.numero,
                "cliente_nombre": lote.cliente.razon_social if lote.cliente else None,
                "kg": kg,
                "minutos_en_etapa": minutos,
                "responsable": responsable,
            })

        # Lotes finalizados en el rango
        lotes_finalizados_data = []
        kg_finalizado_rango = 0.0
        minutos_etapa_rango = 0.0
        for le in finalizados_rango:
            lote = le.lote
            kg = float(lote.peso_entrada_kg or 0)
            kg_finalizado_rango += kg
            if le.fecha_inicio and le.fecha_fin:
                # Solo cuenta el tramo del trabajo dentro del rango
                ini = max(le.fecha_inicio, inicio_rango)
                fin = min(le.fecha_fin, fin_rango)
                minutos = max(0, (fin - ini).total_seconds() / 60)
                minutos_etapa_rango += minutos
                duracion_total = int((le.fecha_fin - le.fecha_inicio).total_seconds() / 60)
            else:
                duracion_total = 0
            lotes_finalizados_data.append({
                "lote_id": str(lote.id),
                "lote_numero": lote.numero,
                "cliente_nombre": lote.cliente.razon_social if lote.cliente else None,
                "kg": kg,
                "duracion_minutos": duracion_total,
                "fecha_fin": le.fecha_fin.isoformat() if le.fecha_fin else None,
            })

        horas_activas = minutos_etapa_rango / 60 if minutos_etapa_rango > 0 else 0.0
        throughput_kg_h = (kg_finalizado_rango / horas_activas) if horas_activas > 0 else 0.0

        total_kg_en_proceso += kg_en_proceso
        total_kg_finalizado_rango += kg_finalizado_rango
        total_lotes_en_proceso += len(lotes_en_proceso_data)
        total_lotes_finalizados_rango += len(lotes_finalizados_data)
        total_minutos_activos += minutos_etapa_rango

        postas_data.append({
            "etapa_id": str(etapa.id),
            "etapa_codigo": etapa.codigo,
            "etapa_nombre": etapa.nombre,
            "etapa_color": etapa.color,
            "orden": etapa.orden,
            "tiempo_estimado_minutos": etapa.tiempo_estimado_minutos,
            "lotes_en_proceso": lotes_en_proceso_data,
            "lotes_finalizados_hoy": lotes_finalizados_data,  # nombre conservado por compatibilidad
            "kg_en_proceso": round(kg_en_proceso, 1),
            "kg_finalizado_hoy": round(kg_finalizado_rango, 1),
            "minutos_activos_hoy": round(minutos_etapa_rango, 1),
            "throughput_kg_hora": round(throughput_kg_h, 1),
        })

    horas_planta = (total_minutos_activos / 60) if total_minutos_activos > 0 else 0.0

    # Ciclo completo de lotes finalizados dentro del rango.
    # Se mide desde fecha_inicio_proceso (cuando arrancó la primera etapa)
    # hasta fecha_fin_proceso (cuando terminó la última etapa).
    lotes_completados = (
        db.query(LoteProduccion)
        .filter(
            LoteProduccion.activo == True,
            LoteProduccion.fecha_fin_proceso.isnot(None),
            LoteProduccion.fecha_inicio_proceso.isnot(None),
            LoteProduccion.fecha_fin_proceso >= inicio_rango,
            LoteProduccion.fecha_fin_proceso <= fin_rango,
        )
        .all()
    )

    kg_total_completado = 0.0
    duraciones_minutos: List[float] = []
    duracion_min_lote: Optional[float] = None
    duracion_max_lote: Optional[float] = None
    for lote in lotes_completados:
        kg = float(lote.peso_entrada_kg or 0)
        kg_total_completado += kg
        if lote.fecha_inicio_proceso and lote.fecha_fin_proceso:
            d = (lote.fecha_fin_proceso - lote.fecha_inicio_proceso).total_seconds() / 60
            if d >= 0:
                duraciones_minutos.append(d)
                if duracion_min_lote is None or d < duracion_min_lote:
                    duracion_min_lote = d
                if duracion_max_lote is None or d > duracion_max_lote:
                    duracion_max_lote = d

    cantidad_completados = len(duraciones_minutos)
    duracion_promedio = (
        sum(duraciones_minutos) / cantidad_completados if cantidad_completados > 0 else 0.0
    )

    return {
        "generado_en": ahora.isoformat(),
        "rango": {
            "fecha_desde": desde.isoformat(),
            "fecha_hasta": hasta.isoformat(),
        },
        "totales": {
            "kg_en_proceso": round(total_kg_en_proceso, 1),
            "kg_finalizado_hoy": round(total_kg_finalizado_rango, 1),
            "lotes_en_proceso": total_lotes_en_proceso,
            "lotes_finalizados_hoy": total_lotes_finalizados_rango,
            "horas_planta_hoy": round(horas_planta, 2),
        },
        "ciclo_lotes": {
            "lotes_completados": cantidad_completados,
            "kg_total_completado": round(kg_total_completado, 1),
            "duracion_promedio_minutos": round(duracion_promedio, 1),
            "duracion_min_minutos": round(duracion_min_lote, 1) if duracion_min_lote else None,
            "duracion_max_minutos": round(duracion_max_lote, 1) if duracion_max_lote else None,
        },
        "postas": postas_data,
    }


def get_rendimiento_productos(
    db: Session,
    dias_atras: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Rendimiento por producto basado en histórico de remitos emitidos.

    Se puede filtrar por:
    - dias_atras: ventana móvil (ej. últimos 30 días).
    - fecha_desde / fecha_hasta: rango explícito (tiene prioridad si está completo).

    Para cada producto retorna:
    - unidades_totales: suma de unidades en remitos emitidos en el periodo
    - peso_promedio_kg: peso unitario configurado en el producto
    - kg_estimados: unidades × peso promedio (si el producto tiene peso)
    - unidades_por_hora: unidades / horas activas de planta en el periodo
    - proyeccion_8h: unidades_por_hora × 8

    También devuelve resumen general (horas planta del periodo).
    """
    hoy = date.today()
    if fecha_desde and fecha_hasta:
        desde = fecha_desde
        hasta = fecha_hasta
    else:
        n = dias_atras if dias_atras is not None else 30
        hasta = hoy
        desde = hoy - timedelta(days=n)
    inicio_periodo = datetime.combine(desde, datetime.min.time())
    fin_periodo = datetime.combine(hasta, datetime.max.time())

    # Horas de planta del periodo: suma de duración de lote_etapas finalizadas
    minutos_planta = db.query(
        func.coalesce(
            func.sum(extract('epoch', LoteEtapa.fecha_fin - LoteEtapa.fecha_inicio) / 60),
            0,
        )
    ).filter(
        LoteEtapa.fecha_inicio.isnot(None),
        LoteEtapa.fecha_fin.isnot(None),
        LoteEtapa.fecha_fin >= inicio_periodo,
        LoteEtapa.fecha_fin <= fin_periodo,
    ).scalar() or 0

    horas_planta = float(minutos_planta) / 60 if minutos_planta else 0.0

    rows = (
        db.query(
            ProductoLavado.id,
            ProductoLavado.codigo,
            ProductoLavado.nombre,
            ProductoLavado.categoria,
            ProductoLavado.peso_promedio_kg,
            func.sum(DetalleRemito.cantidad).label("unidades_totales"),
        )
        .join(DetalleRemito, DetalleRemito.producto_id == ProductoLavado.id)
        .join(Remito, DetalleRemito.remito_id == Remito.id)
        .filter(
            Remito.estado == EstadoRemito.EMITIDO.value,
            Remito.fecha_emision >= desde,
            Remito.fecha_emision <= hasta,
            ProductoLavado.activo == True,
        )
        .group_by(
            ProductoLavado.id,
            ProductoLavado.codigo,
            ProductoLavado.nombre,
            ProductoLavado.categoria,
            ProductoLavado.peso_promedio_kg,
        )
        .order_by(func.sum(DetalleRemito.cantidad).desc())
        .all()
    )

    productos: List[Dict[str, Any]] = []
    for r in rows:
        unidades = float(r.unidades_totales or 0)
        peso_prom = float(r.peso_promedio_kg) if r.peso_promedio_kg else None
        u_por_hora = (unidades / horas_planta) if horas_planta > 0 else 0.0
        productos.append({
            "producto_id": str(r.id),
            "codigo": r.codigo,
            "nombre": r.nombre,
            "categoria": r.categoria,
            "peso_promedio_kg": peso_prom,
            "unidades_totales": int(unidades),
            "kg_estimados": round(unidades * peso_prom, 1) if peso_prom else None,
            "unidades_por_hora": round(u_por_hora, 2),
            "proyeccion_8h": int(round(u_por_hora * 8)),
        })

    dias_periodo = (hasta - desde).days + 1
    return {
        "periodo_dias": dias_periodo,
        "fecha_desde": desde.isoformat(),
        "fecha_hasta": hasta.isoformat(),
        "horas_planta": round(horas_planta, 2),
        "productos": productos,
    }


# ==================== REPORTES FINANCIEROS ====================

def get_flujo_caja_periodo(
    db: Session,
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

    result = db.query(
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
    ).filter(
        MovimientoCaja.anulado == False,
        func.date(MovimientoCaja.created_at) >= fecha_desde,
        func.date(MovimientoCaja.created_at) <= fecha_hasta
    ).group_by(group_expr).order_by(group_expr).all()

    return [
        {
            "periodo": row.periodo.isoformat() if row.periodo else None,
            "ingresos": float(row.ingresos or 0),
            "egresos": float(row.egresos or 0),
            "balance": float((row.ingresos or 0) - (row.egresos or 0)),
        }
        for row in result
    ]


def get_movimientos_por_categoria(
    db: Session,
    fecha_desde: date,
    fecha_hasta: date,
    tipo: Optional[str] = None  # ingreso o egreso
) -> List[Dict[str, Any]]:
    """Reporte de movimientos de caja por categoría"""
    query = db.query(
        MovimientoCaja.categoria,
        MovimientoCaja.tipo,
        func.count(MovimientoCaja.id).label('cantidad'),
        func.sum(MovimientoCaja.monto).label('total')
    ).filter(
        MovimientoCaja.anulado == False,
        func.date(MovimientoCaja.created_at) >= fecha_desde,
        func.date(MovimientoCaja.created_at) <= fecha_hasta
    )

    if tipo:
        query = query.filter(MovimientoCaja.tipo == tipo)

    query = query.group_by(MovimientoCaja.categoria, MovimientoCaja.tipo)
    query = query.order_by(func.sum(MovimientoCaja.monto).desc())

    result = query.all()

    return [
        {
            "categoria": row.categoria,
            "tipo": row.tipo,
            "cantidad": row.cantidad or 0,
            "total": float(row.total or 0),
        }
        for row in result
    ]


# ==================== REPORTES DE STOCK ====================

def get_movimientos_stock(
    db: Session,
    fecha_desde: date,
    fecha_hasta: date,
    insumo_id: Optional[UUID] = None
) -> List[Dict[str, Any]]:
    """Reporte de movimientos de stock"""
    query = db.query(
        MovimientoStock.insumo_id,
        Insumo.nombre,
        Insumo.unidad_medida,
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
    ).join(
        Insumo, MovimientoStock.insumo_id == Insumo.id
    ).filter(
        func.date(MovimientoStock.created_at) >= fecha_desde,
        func.date(MovimientoStock.created_at) <= fecha_hasta
    )

    if insumo_id:
        query = query.filter(MovimientoStock.insumo_id == insumo_id)

    query = query.group_by(MovimientoStock.insumo_id, Insumo.nombre, Insumo.unidad_medida)

    result = query.all()

    return [
        {
            "insumo_id": str(row.insumo_id),
            "insumo_nombre": row.nombre,
            "unidad_medida": row.unidad_medida,
            "entradas": float(row.entradas or 0),
            "salidas": float(row.salidas or 0),
            "neto": float((row.entradas or 0) - (row.salidas or 0)),
        }
        for row in result
    ]


def get_stock_bajo_minimo(db: Session) -> List[Dict[str, Any]]:
    """Reporte de insumos con stock bajo el mínimo"""
    result = db.query(Insumo).filter(
        Insumo.activo == True,
        Insumo.stock_actual < Insumo.stock_minimo
    ).order_by((Insumo.stock_actual / Insumo.stock_minimo)).all()

    return [
        {
            "insumo_id": str(i.id),
            "codigo": i.codigo,
            "nombre": i.nombre,
            "unidad_medida": i.unidad_medida,
            "stock_actual": float(i.stock_actual),
            "stock_minimo": float(i.stock_minimo),
            "diferencia": float(i.stock_minimo - i.stock_actual),
            "porcentaje": round(float(i.stock_actual / i.stock_minimo * 100), 1) if i.stock_minimo > 0 else 0,
        }
        for i in result
    ]


def get_stock_actual(db: Session) -> List[Dict[str, Any]]:
    """Reporte de stock actual de todos los insumos"""
    from app.models.categoria_insumo import CategoriaInsumo

    result = db.query(
        Insumo,
        CategoriaInsumo.nombre.label('categoria_nombre')
    ).outerjoin(
        CategoriaInsumo, Insumo.categoria_id == CategoriaInsumo.id
    ).filter(
        Insumo.activo == True
    ).order_by(CategoriaInsumo.nombre, Insumo.nombre).all()

    return [
        {
            "insumo_id": str(row.Insumo.id),
            "codigo": row.Insumo.codigo,
            "nombre": row.Insumo.nombre,
            "categoria": row.categoria_nombre,
            "unidad_medida": row.Insumo.unidad_medida,
            "stock_actual": float(row.Insumo.stock_actual),
            "stock_minimo": float(row.Insumo.stock_minimo),
            "stock_maximo": float(row.Insumo.stock_maximo) if row.Insumo.stock_maximo else None,
            "precio_unitario": float(row.Insumo.precio_unitario) if row.Insumo.precio_unitario else 0,
            "valor_total": float(row.Insumo.stock_actual * (row.Insumo.precio_unitario or 0)),
            "estado": "critico" if row.Insumo.stock_actual < row.Insumo.stock_minimo else
                     "bajo" if row.Insumo.stock_actual < row.Insumo.stock_minimo * 1.5 else "ok"
        }
        for row in result
    ]


# ==================== REPORTES DE EMPLEADOS ====================

def get_asistencia_periodo(
    db: Session,
    fecha_desde: date,
    fecha_hasta: date,
    empleado_id: Optional[UUID] = None
) -> List[Dict[str, Any]]:
    """Reporte de asistencia por período"""
    query = db.query(
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
    ).join(
        Empleado, JornadaLaboral.empleado_id == Empleado.id
    ).filter(
        JornadaLaboral.fecha >= fecha_desde,
        JornadaLaboral.fecha <= fecha_hasta
    )

    if empleado_id:
        query = query.filter(JornadaLaboral.empleado_id == empleado_id)

    query = query.group_by(
        JornadaLaboral.empleado_id,
        Empleado.nombre,
        Empleado.apellido
    )

    result = query.all()

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
        for row in result
    ]


# ==================== REPORTES GENERALES ====================

def get_resumen_general(
    db: Session,
    fecha_desde: date,
    fecha_hasta: date
) -> Dict[str, Any]:
    """Resumen general del período"""
    # Ventas
    ventas = db.query(
        func.count(Pedido.id).label('cantidad_pedidos'),
        func.sum(Pedido.total).label('total_ventas')
    ).filter(
        Pedido.activo == True,
        Pedido.fecha_pedido >= fecha_desde,
        Pedido.fecha_pedido <= fecha_hasta
    ).first()

    # Producción
    produccion = db.query(
        func.count(LoteProduccion.id).label('cantidad_lotes'),
        func.sum(LoteProduccion.peso_entrada_kg).label('kg_procesados'),
        func.sum(
            case(
                (LoteProduccion.estado == EstadoLote.COMPLETADO.value, 1),
                else_=0
            )
        ).label('lotes_completados')
    ).filter(
        LoteProduccion.activo == True,
        LoteProduccion.fecha_ingreso >= fecha_desde,
        LoteProduccion.fecha_ingreso <= fecha_hasta
    ).first()

    # Finanzas
    finanzas = db.query(
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
    ).filter(
        MovimientoCaja.anulado == False,
        func.date(MovimientoCaja.created_at) >= fecha_desde,
        func.date(MovimientoCaja.created_at) <= fecha_hasta
    ).first()

    # Clientes nuevos
    clientes_nuevos = db.query(func.count(Cliente.id)).filter(
        Cliente.activo == True,
        func.date(Cliente.created_at) >= fecha_desde,
        func.date(Cliente.created_at) <= fecha_hasta
    ).scalar() or 0

    # Stock bajo mínimo
    stock_critico = db.query(func.count(Insumo.id)).filter(
        Insumo.activo == True,
        Insumo.stock_actual < Insumo.stock_minimo
    ).scalar() or 0

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
            "kg_procesados": float(produccion.kg_procesados or 0),
            "lotes_completados": produccion.lotes_completados or 0,
        },
        "finanzas": {
            "ingresos": float(ingresos),
            "egresos": float(egresos),
            "balance": float(ingresos - egresos),
        },
        "clientes_nuevos": clientes_nuevos,
        "stock_critico": stock_critico,
    }


def get_estadisticas_rapidas(db: Session) -> Dict[str, Any]:
    """Estadísticas rápidas para el dashboard de reportes"""
    hoy = date.today()
    inicio_semana = hoy - timedelta(days=hoy.weekday())
    inicio_mes = date(hoy.year, hoy.month, 1)

    # Ventas hoy
    ventas_hoy = db.query(
        func.count(Pedido.id).label('cantidad'),
        func.sum(Pedido.total).label('total')
    ).filter(
        Pedido.activo == True,
        Pedido.fecha_pedido == hoy
    ).first()

    # Ventas semana
    ventas_semana = db.query(
        func.count(Pedido.id).label('cantidad'),
        func.sum(Pedido.total).label('total')
    ).filter(
        Pedido.activo == True,
        Pedido.fecha_pedido >= inicio_semana,
        Pedido.fecha_pedido <= hoy
    ).first()

    # Ventas mes
    ventas_mes = db.query(
        func.count(Pedido.id).label('cantidad'),
        func.sum(Pedido.total).label('total')
    ).filter(
        Pedido.activo == True,
        Pedido.fecha_pedido >= inicio_mes,
        Pedido.fecha_pedido <= hoy
    ).first()

    # Lotes en proceso
    lotes_en_proceso = db.query(func.count(LoteProduccion.id)).filter(
        LoteProduccion.activo == True,
        LoteProduccion.estado == EstadoLote.EN_PROCESO.value
    ).scalar() or 0

    # Stock crítico
    stock_critico = db.query(func.count(Insumo.id)).filter(
        Insumo.activo == True,
        Insumo.stock_actual < Insumo.stock_minimo
    ).scalar() or 0

    # Total clientes activos
    clientes_activos = db.query(func.count(Cliente.id)).filter(
        Cliente.activo == True
    ).scalar() or 0

    return {
        "hoy": {
            "pedidos": ventas_hoy.cantidad or 0,
            "total": float(ventas_hoy.total or 0),
        },
        "semana": {
            "pedidos": ventas_semana.cantidad or 0,
            "total": float(ventas_semana.total or 0),
        },
        "mes": {
            "pedidos": ventas_mes.cantidad or 0,
            "total": float(ventas_mes.total or 0),
        },
        "produccion": {
            "lotes_en_proceso": lotes_en_proceso,
        },
        "stock": {
            "critico": stock_critico,
        },
        "clientes": {
            "activos": clientes_activos,
        },
    }
