"""
Endpoints de Reportes para DUWHITE ERP
"""

from datetime import date, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.usuario import Usuario
from app.services import reporte_service

router = APIRouter()


# ==================== ESTADISTICAS RAPIDAS ====================

@router.get("/estadisticas")
def get_estadisticas_rapidas(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Estadísticas rápidas para el dashboard de reportes"""
    return reporte_service.get_estadisticas_rapidas(db)


# ==================== REPORTES DE VENTAS ====================

@router.get("/ventas/periodo")
def get_ventas_por_periodo(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    agrupacion: str = Query("dia", regex="^(dia|semana|mes)$"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de ventas agrupado por período"""
    return reporte_service.get_ventas_por_periodo(
        db=db,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        agrupacion=agrupacion
    )


@router.get("/ventas/clientes")
def get_ventas_por_cliente(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de ventas por cliente (top clientes)"""
    return reporte_service.get_ventas_por_cliente(
        db=db,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        limit=limit
    )


@router.get("/ventas/servicios")
def get_ventas_por_servicio(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de ventas por tipo de servicio"""
    return reporte_service.get_ventas_por_servicio(
        db=db,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )


# ==================== REPORTES DE PRODUCCION ====================

@router.get("/produccion/periodo")
def get_produccion_por_periodo(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    agrupacion: str = Query("dia", regex="^(dia|semana|mes)$"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de producción por período"""
    return reporte_service.get_produccion_por_periodo(
        db=db,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        agrupacion=agrupacion
    )


@router.get("/produccion/etapas")
def get_produccion_por_etapa(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de tiempo promedio por etapa de producción"""
    return reporte_service.get_produccion_por_etapa(
        db=db,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )


# ==================== REPORTES FINANCIEROS ====================

@router.get("/finanzas/flujo-caja")
def get_flujo_caja(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    agrupacion: str = Query("dia", regex="^(dia|semana|mes)$"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de flujo de caja por período"""
    return reporte_service.get_flujo_caja_periodo(
        db=db,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        agrupacion=agrupacion
    )


@router.get("/finanzas/categorias")
def get_movimientos_por_categoria(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    tipo: Optional[str] = Query(None, regex="^(ingreso|egreso)$"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de movimientos de caja por categoría"""
    return reporte_service.get_movimientos_por_categoria(
        db=db,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        tipo=tipo
    )


# ==================== REPORTES DE STOCK ====================

@router.get("/stock/movimientos")
def get_movimientos_stock(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    insumo_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de movimientos de stock"""
    return reporte_service.get_movimientos_stock(
        db=db,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        insumo_id=insumo_id
    )


@router.get("/stock/bajo-minimo")
def get_stock_bajo_minimo(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de insumos con stock bajo el mínimo"""
    return reporte_service.get_stock_bajo_minimo(db)


@router.get("/stock/actual")
def get_stock_actual(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de stock actual de todos los insumos"""
    return reporte_service.get_stock_actual(db)


# ==================== REPORTES DE EMPLEADOS ====================

@router.get("/empleados/asistencia")
def get_asistencia_periodo(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    empleado_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de asistencia por período"""
    return reporte_service.get_asistencia_periodo(
        db=db,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        empleado_id=empleado_id
    )


# ==================== RESUMEN GENERAL ====================

@router.get("/resumen")
def get_resumen_general(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Resumen general del período"""
    return reporte_service.get_resumen_general(
        db=db,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )


# ==================== REPORTES RAPIDOS ====================

@router.get("/rapidos/hoy")
def get_reporte_hoy(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Resumen del día actual"""
    hoy = date.today()
    return reporte_service.get_resumen_general(
        db=db,
        fecha_desde=hoy,
        fecha_hasta=hoy
    )


@router.get("/rapidos/semana")
def get_reporte_semana(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Resumen de la semana actual"""
    hoy = date.today()
    inicio_semana = hoy - timedelta(days=hoy.weekday())
    return reporte_service.get_resumen_general(
        db=db,
        fecha_desde=inicio_semana,
        fecha_hasta=hoy
    )


@router.get("/rapidos/mes")
def get_reporte_mes(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Resumen del mes actual"""
    hoy = date.today()
    inicio_mes = date(hoy.year, hoy.month, 1)
    return reporte_service.get_resumen_general(
        db=db,
        fecha_desde=inicio_mes,
        fecha_hasta=hoy
    )
