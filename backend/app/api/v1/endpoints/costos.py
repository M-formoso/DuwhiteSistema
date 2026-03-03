"""
Endpoints de Costos para DUWHITE ERP
"""

from datetime import date
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.models.usuario import Usuario
from app.services.costo_service import CostoService
from app.schemas.costo import (
    CostoFijoCreate, CostoFijoUpdate, CostoFijoResponse,
    CostoVariableCreate, CostoVariableUpdate, CostoVariableResponse,
    TarifaServicioCreate, TarifaServicioUpdate, TarifaServicioResponse,
    AnalisisCostoLoteCreate, AnalisisCostoLoteResponse,
    ParametroCostoCreate, ParametroCostoResponse,
    ResumenCostosMes, RentabilidadCliente,
    CATEGORIAS_COSTO, UNIDADES_MEDIDA_COSTO
)
from app.schemas.common import PaginatedResponse

router = APIRouter()


# ==================== COSTOS FIJOS ====================

@router.get("/fijos", response_model=PaginatedResponse[CostoFijoResponse])
async def list_costos_fijos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    categoria: Optional[str] = None,
    solo_vigentes: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista costos fijos"""
    service = CostoService(db)
    costos, total = await service.get_costos_fijos(
        skip=skip,
        limit=limit,
        categoria=categoria,
        solo_vigentes=solo_vigentes
    )

    hoy = date.today()
    items = [
        CostoFijoResponse(
            **c.__dict__,
            costo_diario=c.monto_mensual / c.dias_mes if c.dias_mes else None,
            vigente=(
                c.fecha_inicio <= hoy and
                (c.fecha_fin is None or c.fecha_fin >= hoy)
            )
        )
        for c in costos
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


@router.post("/fijos", response_model=CostoFijoResponse, status_code=status.HTTP_201_CREATED)
async def create_costo_fijo(
    data: CostoFijoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Crea costo fijo"""
    service = CostoService(db)
    costo = await service.create_costo_fijo(data)

    hoy = date.today()
    return CostoFijoResponse(
        **costo.__dict__,
        costo_diario=costo.monto_mensual / costo.dias_mes if costo.dias_mes else None,
        vigente=(
            costo.fecha_inicio <= hoy and
            (costo.fecha_fin is None or costo.fecha_fin >= hoy)
        )
    )


@router.get("/fijos/{costo_id}", response_model=CostoFijoResponse)
async def get_costo_fijo(
    costo_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene costo fijo por ID"""
    service = CostoService(db)
    costo = await service.get_costo_fijo(costo_id)

    if not costo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Costo fijo no encontrado"
        )

    hoy = date.today()
    return CostoFijoResponse(
        **costo.__dict__,
        costo_diario=costo.monto_mensual / costo.dias_mes if costo.dias_mes else None,
        vigente=(
            costo.fecha_inicio <= hoy and
            (costo.fecha_fin is None or costo.fecha_fin >= hoy)
        )
    )


@router.put("/fijos/{costo_id}", response_model=CostoFijoResponse)
async def update_costo_fijo(
    costo_id: UUID,
    data: CostoFijoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Actualiza costo fijo"""
    service = CostoService(db)
    costo = await service.update_costo_fijo(costo_id, data)

    if not costo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Costo fijo no encontrado"
        )

    hoy = date.today()
    return CostoFijoResponse(
        **costo.__dict__,
        costo_diario=costo.monto_mensual / costo.dias_mes if costo.dias_mes else None,
        vigente=(
            costo.fecha_inicio <= hoy and
            (costo.fecha_fin is None or costo.fecha_fin >= hoy)
        )
    )


@router.delete("/fijos/{costo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_costo_fijo(
    costo_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Elimina costo fijo"""
    service = CostoService(db)
    success = await service.delete_costo_fijo(costo_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Costo fijo no encontrado"
        )


# ==================== COSTOS VARIABLES ====================

@router.get("/variables", response_model=PaginatedResponse[CostoVariableResponse])
async def list_costos_variables(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    categoria: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista costos variables"""
    service = CostoService(db)
    costos, total = await service.get_costos_variables(
        skip=skip,
        limit=limit,
        categoria=categoria
    )

    items = [
        CostoVariableResponse(
            **c.__dict__,
            costo_por_kg=(
                c.costo_por_unidad * c.consumo_por_kg
                if c.consumo_por_kg else None
            )
        )
        for c in costos
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


@router.post("/variables", response_model=CostoVariableResponse, status_code=status.HTTP_201_CREATED)
async def create_costo_variable(
    data: CostoVariableCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Crea costo variable"""
    service = CostoService(db)
    costo = await service.create_costo_variable(data)

    return CostoVariableResponse(
        **costo.__dict__,
        costo_por_kg=(
            costo.costo_por_unidad * costo.consumo_por_kg
            if costo.consumo_por_kg else None
        )
    )


@router.put("/variables/{costo_id}", response_model=CostoVariableResponse)
async def update_costo_variable(
    costo_id: UUID,
    data: CostoVariableUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Actualiza costo variable"""
    service = CostoService(db)
    costo = await service.update_costo_variable(costo_id, data)

    if not costo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Costo variable no encontrado"
        )

    return CostoVariableResponse(
        **costo.__dict__,
        costo_por_kg=(
            costo.costo_por_unidad * costo.consumo_por_kg
            if costo.consumo_por_kg else None
        )
    )


@router.delete("/variables/{costo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_costo_variable(
    costo_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Elimina costo variable"""
    service = CostoService(db)
    success = await service.delete_costo_variable(costo_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Costo variable no encontrado"
        )


# ==================== TARIFAS DE SERVICIOS ====================

@router.get("/tarifas", response_model=PaginatedResponse[TarifaServicioResponse])
async def list_tarifas_servicios(
    servicio_id: Optional[UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista tarifas de servicios"""
    service = CostoService(db)
    tarifas, total = await service.get_tarifas_servicios(
        servicio_id=servicio_id,
        skip=skip,
        limit=limit
    )

    items = [
        TarifaServicioResponse(
            **t.__dict__,
            margen_real=t.margen_real
        )
        for t in tarifas
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


@router.post("/tarifas", response_model=TarifaServicioResponse, status_code=status.HTTP_201_CREATED)
async def create_tarifa_servicio(
    data: TarifaServicioCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Crea tarifa de servicio"""
    service = CostoService(db)
    tarifa = await service.create_tarifa_servicio(data)

    return TarifaServicioResponse(
        **tarifa.__dict__,
        margen_real=tarifa.margen_real
    )


@router.get("/tarifas/servicio/{servicio_id}/vigente", response_model=TarifaServicioResponse)
async def get_tarifa_vigente(
    servicio_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene tarifa vigente para un servicio"""
    service = CostoService(db)
    tarifa = await service.get_tarifa_vigente(servicio_id)

    if not tarifa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay tarifa vigente para este servicio"
        )

    return TarifaServicioResponse(
        **tarifa.__dict__,
        margen_real=tarifa.margen_real
    )


@router.put("/tarifas/{tarifa_id}", response_model=TarifaServicioResponse)
async def update_tarifa_servicio(
    tarifa_id: UUID,
    data: TarifaServicioUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Actualiza tarifa de servicio"""
    service = CostoService(db)
    tarifa = await service.update_tarifa_servicio(tarifa_id, data)

    if not tarifa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarifa no encontrada"
        )

    return TarifaServicioResponse(
        **tarifa.__dict__,
        margen_real=tarifa.margen_real
    )


# ==================== ANALISIS DE LOTES ====================

@router.post("/lotes/{lote_id}/analisis", response_model=AnalisisCostoLoteResponse, status_code=status.HTTP_201_CREATED)
async def crear_analisis_lote(
    lote_id: UUID,
    data: Optional[AnalisisCostoLoteCreate] = None,
    auto_calcular: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Crea o calcula análisis de costo para un lote"""
    service = CostoService(db)

    try:
        if auto_calcular:
            analisis = await service.calcular_costo_lote(lote_id)
        elif data:
            data.lote_id = lote_id
            analisis = await service.create_analisis_lote(data)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe proporcionar datos o usar auto_calcular=true"
            )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return AnalisisCostoLoteResponse(**analisis.__dict__)


@router.get("/lotes/{lote_id}/analisis", response_model=AnalisisCostoLoteResponse)
async def get_analisis_lote(
    lote_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene análisis de costo de un lote"""
    service = CostoService(db)
    analisis = await service.get_analisis_lote(lote_id)

    if not analisis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Análisis no encontrado para este lote"
        )

    return AnalisisCostoLoteResponse(**analisis.__dict__)


# ==================== PARAMETROS ====================

@router.get("/parametros", response_model=List[ParametroCostoResponse])
async def list_parametros(
    categoria: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista parámetros de costo"""
    service = CostoService(db)
    parametros = await service.get_parametros(categoria)

    return [ParametroCostoResponse(**p.__dict__) for p in parametros]


@router.post("/parametros", response_model=ParametroCostoResponse, status_code=status.HTTP_201_CREATED)
async def set_parametro(
    data: ParametroCostoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Crea o actualiza parámetro de costo"""
    service = CostoService(db)
    parametro = await service.set_parametro(data)

    return ParametroCostoResponse(**parametro.__dict__)


# ==================== REPORTES ====================

@router.get("/resumen/mes", response_model=ResumenCostosMes)
async def get_resumen_costos_mes(
    mes: int = Query(..., ge=1, le=12),
    anio: int = Query(..., ge=2020),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene resumen de costos del mes"""
    service = CostoService(db)
    return await service.get_resumen_costos_mes(mes, anio)


@router.get("/rentabilidad/clientes", response_model=List[RentabilidadCliente])
async def get_rentabilidad_clientes(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene rentabilidad por cliente"""
    service = CostoService(db)
    return await service.get_rentabilidad_por_cliente(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        limit=limit
    )


# ==================== CONSTANTES ====================

@router.get("/constantes", response_model=dict)
async def get_constantes(
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene constantes de costos"""
    return {
        "categorias": CATEGORIAS_COSTO,
        "unidades_medida": UNIDADES_MEDIDA_COSTO,
    }
