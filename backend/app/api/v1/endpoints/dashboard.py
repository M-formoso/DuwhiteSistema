"""
Endpoints de Dashboard para DUWHITE ERP
"""

from typing import Dict, List, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.models.usuario import Usuario
from app.services.dashboard_service import DashboardService

router = APIRouter()


@router.get("", response_model=Dict[str, Any])
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Obtiene todos los datos del dashboard en una sola llamada.

    Incluye:
    - KPIs principales (ventas, producción, finanzas, operación)
    - Gráfico de ventas de la semana
    - Pedidos recientes
    - Lotes en proceso
    - Alertas del sistema
    - Resumen de movimientos del día
    """
    service = DashboardService(db)
    return await service.get_dashboard_completo()


@router.get("/kpis", response_model=Dict[str, Any])
async def get_kpis(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene solo los KPIs principales"""
    service = DashboardService(db)
    return await service.get_kpis_principales()


@router.get("/ventas-semana", response_model=List[Dict[str, Any]])
async def get_ventas_semana(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Datos para gráfico de ventas de la semana"""
    service = DashboardService(db)
    return await service.get_grafico_ventas_semana()


@router.get("/pedidos-recientes", response_model=List[Dict[str, Any]])
async def get_pedidos_recientes(
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Últimos pedidos ingresados"""
    service = DashboardService(db)
    return await service.get_pedidos_recientes(limit=limit)


@router.get("/lotes-proceso", response_model=List[Dict[str, Any]])
async def get_lotes_en_proceso(
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lotes actualmente en proceso"""
    service = DashboardService(db)
    return await service.get_lotes_en_proceso(limit=limit)


@router.get("/alertas", response_model=List[Dict[str, Any]])
async def get_alertas(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Alertas del sistema (stock bajo, pedidos pendientes, etc.)"""
    service = DashboardService(db)
    return await service.get_alertas()


@router.get("/movimientos-hoy", response_model=Dict[str, Any])
async def get_movimientos_hoy(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Resumen de movimientos de caja del día"""
    service = DashboardService(db)
    return await service.get_resumen_movimientos_hoy()
