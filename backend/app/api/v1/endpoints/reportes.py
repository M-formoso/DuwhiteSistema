"""
Endpoints de Reportes para DUWHITE ERP
"""

from datetime import date, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.usuario import Usuario
from app.services.reporte_service import ReporteService

router = APIRouter()


# ==================== REPORTES DE VENTAS ====================

@router.get("/ventas/periodo", response_model=List[Dict[str, Any]])
async def get_ventas_por_periodo(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    agrupacion: str = Query("dia", regex="^(dia|semana|mes)$"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de ventas agrupado por período"""
    service = ReporteService(db)
    return await service.get_ventas_por_periodo(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        agrupacion=agrupacion
    )


@router.get("/ventas/clientes", response_model=List[Dict[str, Any]])
async def get_ventas_por_cliente(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de ventas por cliente (top clientes)"""
    service = ReporteService(db)
    return await service.get_ventas_por_cliente(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        limit=limit
    )


@router.get("/ventas/servicios", response_model=List[Dict[str, Any]])
async def get_ventas_por_servicio(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de ventas por tipo de servicio"""
    service = ReporteService(db)
    return await service.get_ventas_por_servicio(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )


# ==================== REPORTES DE PRODUCCION ====================

@router.get("/produccion/periodo", response_model=List[Dict[str, Any]])
async def get_produccion_por_periodo(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    agrupacion: str = Query("dia", regex="^(dia|semana|mes)$"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de producción por período"""
    service = ReporteService(db)
    return await service.get_produccion_por_periodo(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        agrupacion=agrupacion
    )


@router.get("/produccion/etapas", response_model=List[Dict[str, Any]])
async def get_produccion_por_etapa(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de tiempo promedio por etapa de producción"""
    service = ReporteService(db)
    return await service.get_produccion_por_etapa(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )


# ==================== REPORTES FINANCIEROS ====================

@router.get("/finanzas/flujo-caja", response_model=List[Dict[str, Any]])
async def get_flujo_caja(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    agrupacion: str = Query("dia", regex="^(dia|semana|mes)$"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de flujo de caja por período"""
    service = ReporteService(db)
    return await service.get_flujo_caja_periodo(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        agrupacion=agrupacion
    )


@router.get("/finanzas/categorias", response_model=List[Dict[str, Any]])
async def get_movimientos_por_categoria(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    tipo: Optional[str] = Query(None, regex="^(ingreso|egreso)$"),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de movimientos de caja por categoría"""
    service = ReporteService(db)
    return await service.get_movimientos_por_categoria(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        tipo=tipo
    )


# ==================== REPORTES DE STOCK ====================

@router.get("/stock/movimientos", response_model=List[Dict[str, Any]])
async def get_movimientos_stock(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    insumo_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de movimientos de stock"""
    service = ReporteService(db)
    return await service.get_movimientos_stock(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        insumo_id=insumo_id
    )


@router.get("/stock/bajo-minimo", response_model=List[Dict[str, Any]])
async def get_stock_bajo_minimo(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de insumos con stock bajo el mínimo"""
    service = ReporteService(db)
    return await service.get_stock_bajo_minimo()


# ==================== REPORTES DE EMPLEADOS ====================

@router.get("/empleados/asistencia", response_model=List[Dict[str, Any]])
async def get_asistencia_periodo(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    empleado_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Reporte de asistencia por período"""
    service = ReporteService(db)
    return await service.get_asistencia_periodo(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        empleado_id=empleado_id
    )


# ==================== RESUMEN GENERAL ====================

@router.get("/resumen", response_model=Dict[str, Any])
async def get_resumen_general(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Resumen general del período"""
    service = ReporteService(db)
    return await service.get_resumen_general(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )


# ==================== REPORTES RAPIDOS ====================

@router.get("/rapidos/hoy", response_model=Dict[str, Any])
async def get_reporte_hoy(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Resumen del día actual"""
    hoy = date.today()
    service = ReporteService(db)
    return await service.get_resumen_general(
        fecha_desde=hoy,
        fecha_hasta=hoy
    )


@router.get("/rapidos/semana", response_model=Dict[str, Any])
async def get_reporte_semana(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Resumen de la semana actual"""
    hoy = date.today()
    inicio_semana = hoy - timedelta(days=hoy.weekday())
    service = ReporteService(db)
    return await service.get_resumen_general(
        fecha_desde=inicio_semana,
        fecha_hasta=hoy
    )


@router.get("/rapidos/mes", response_model=Dict[str, Any])
async def get_reporte_mes(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Resumen del mes actual"""
    hoy = date.today()
    inicio_mes = date(hoy.year, hoy.month, 1)
    service = ReporteService(db)
    return await service.get_resumen_general(
        fecha_desde=inicio_mes,
        fecha_hasta=hoy
    )
