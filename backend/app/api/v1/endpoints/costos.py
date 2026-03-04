"""
Endpoints de Costos para DUWHITE ERP
"""

from datetime import date
from typing import Optional, List, Dict, Any
from uuid import UUID
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

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
def list_costos_fijos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    categoria: Optional[str] = None,
    solo_vigentes: bool = True,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista costos fijos"""
    service = CostoService(db)
    costos, total = service.get_costos_fijos(
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
def create_costo_fijo(
    data: CostoFijoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Crea costo fijo"""
    service = CostoService(db)
    costo = service.create_costo_fijo(data)

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
def get_costo_fijo(
    costo_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene costo fijo por ID"""
    service = CostoService(db)
    costo = service.get_costo_fijo(costo_id)

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
def update_costo_fijo(
    costo_id: UUID,
    data: CostoFijoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Actualiza costo fijo"""
    service = CostoService(db)
    costo = service.update_costo_fijo(costo_id, data)

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
def delete_costo_fijo(
    costo_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Elimina costo fijo"""
    service = CostoService(db)
    success = service.delete_costo_fijo(costo_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Costo fijo no encontrado"
        )


# ==================== COSTOS VARIABLES ====================

@router.get("/variables", response_model=PaginatedResponse[CostoVariableResponse])
def list_costos_variables(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    categoria: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista costos variables"""
    service = CostoService(db)
    costos, total = service.get_costos_variables(
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
def create_costo_variable(
    data: CostoVariableCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Crea costo variable"""
    service = CostoService(db)
    costo = service.create_costo_variable(data)

    return CostoVariableResponse(
        **costo.__dict__,
        costo_por_kg=(
            costo.costo_por_unidad * costo.consumo_por_kg
            if costo.consumo_por_kg else None
        )
    )


@router.put("/variables/{costo_id}", response_model=CostoVariableResponse)
def update_costo_variable(
    costo_id: UUID,
    data: CostoVariableUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Actualiza costo variable"""
    service = CostoService(db)
    costo = service.update_costo_variable(costo_id, data)

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
def delete_costo_variable(
    costo_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Elimina costo variable"""
    service = CostoService(db)
    success = service.delete_costo_variable(costo_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Costo variable no encontrado"
        )


# ==================== TARIFAS DE SERVICIOS ====================

@router.get("/tarifas", response_model=PaginatedResponse[TarifaServicioResponse])
def list_tarifas_servicios(
    servicio_id: Optional[UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista tarifas de servicios"""
    service = CostoService(db)
    tarifas, total = service.get_tarifas_servicios(
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
def create_tarifa_servicio(
    data: TarifaServicioCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Crea tarifa de servicio"""
    service = CostoService(db)
    tarifa = service.create_tarifa_servicio(data)

    return TarifaServicioResponse(
        **tarifa.__dict__,
        margen_real=tarifa.margen_real
    )


@router.get("/tarifas/servicio/{servicio_id}/vigente", response_model=TarifaServicioResponse)
def get_tarifa_vigente(
    servicio_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene tarifa vigente para un servicio"""
    service = CostoService(db)
    tarifa = service.get_tarifa_vigente(servicio_id)

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
def update_tarifa_servicio(
    tarifa_id: UUID,
    data: TarifaServicioUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Actualiza tarifa de servicio"""
    service = CostoService(db)
    tarifa = service.update_tarifa_servicio(tarifa_id, data)

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
def crear_analisis_lote(
    lote_id: UUID,
    data: Optional[AnalisisCostoLoteCreate] = None,
    auto_calcular: bool = True,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Crea o calcula análisis de costo para un lote"""
    service = CostoService(db)

    try:
        if auto_calcular:
            analisis = service.calcular_costo_lote(lote_id)
        elif data:
            data.lote_id = lote_id
            analisis = service.create_analisis_lote(data)
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
def get_analisis_lote(
    lote_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene análisis de costo de un lote"""
    service = CostoService(db)
    analisis = service.get_analisis_lote(lote_id)

    if not analisis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Análisis no encontrado para este lote"
        )

    return AnalisisCostoLoteResponse(**analisis.__dict__)


# ==================== PARAMETROS ====================

@router.get("/parametros", response_model=List[ParametroCostoResponse])
def list_parametros(
    categoria: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista parámetros de costo"""
    service = CostoService(db)
    parametros = service.get_parametros(categoria)

    return [ParametroCostoResponse(**p.__dict__) for p in parametros]


@router.post("/parametros", response_model=ParametroCostoResponse, status_code=status.HTTP_201_CREATED)
def set_parametro(
    data: ParametroCostoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Crea o actualiza parámetro de costo"""
    service = CostoService(db)
    parametro = service.set_parametro(data)

    return ParametroCostoResponse(**parametro.__dict__)


# ==================== REPORTES ====================

@router.get("/resumen/mes", response_model=ResumenCostosMes)
def get_resumen_costos_mes(
    mes: int = Query(..., ge=1, le=12),
    anio: int = Query(..., ge=2020),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene resumen de costos del mes"""
    service = CostoService(db)
    return service.get_resumen_costos_mes(mes, anio)


@router.get("/rentabilidad/clientes", response_model=List[RentabilidadCliente])
def get_rentabilidad_clientes(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene rentabilidad por cliente"""
    service = CostoService(db)
    return service.get_rentabilidad_por_cliente(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        limit=limit
    )


# ==================== CONSTANTES ====================

@router.get("/constantes", response_model=dict)
def get_constantes(
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene constantes de costos"""
    return {
        "categorias": CATEGORIAS_COSTO,
        "unidades_medida": UNIDADES_MEDIDA_COSTO,
    }


# ==================== RECOMENDACIÓN DE PRECIOS ====================

@router.get("/recomendar-precio/{servicio_id}", response_model=Dict[str, Any])
def recomendar_precio_servicio(
    servicio_id: UUID,
    margen_objetivo: float = Query(30, ge=0, le=100, description="Margen objetivo en porcentaje"),
    incluir_costos_fijos: bool = True,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Recomienda un precio de venta para un servicio basado en costos.

    - Calcula el costo total (variables + fijos prorrateados)
    - Aplica el margen objetivo deseado
    - Compara con el precio actual si existe
    """
    service = CostoService(db)

    try:
        resultado = service.recomendar_precio_servicio(
            servicio_id=servicio_id,
            margen_objetivo=Decimal(str(margen_objetivo)),
            incluir_costos_fijos=incluir_costos_fijos,
        )
        return resultado
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/recomendar-precios", response_model=List[Dict[str, Any]])
def recomendar_precios_todos(
    margen_objetivo: float = Query(30, ge=0, le=100, description="Margen objetivo en porcentaje"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Recomienda precios para todos los servicios activos.

    Útil para revisión periódica de lista de precios.
    """
    service = CostoService(db)
    return service.recomendar_precios_lista(margen_objetivo=Decimal(str(margen_objetivo)))


# ==================== SIMULADOR "QUÉ PASA SI" ====================

@router.get("/simulador/escenario", response_model=Dict[str, Any])
def simular_escenario(
    variacion_costos_fijos: float = Query(0, description="% de variación en costos fijos"),
    variacion_costos_variables: float = Query(0, description="% de variación en costos variables"),
    variacion_volumen: float = Query(0, description="% de variación en volumen de producción"),
    variacion_precios: float = Query(0, description="% de variación en precios de venta"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Simula escenarios "qué pasa si" para análisis de sensibilidad.

    Ejemplos de uso:
    - ¿Qué pasa si los costos fijos suben 10%?
    - ¿Qué pasa si aumentamos el volumen 20%?
    - ¿Qué pasa si bajamos los precios 5%?

    Retorna comparación entre escenario actual y simulado.
    """
    service = CostoService(db)
    return service.simular_escenario(
        variacion_costos_fijos=Decimal(str(variacion_costos_fijos)),
        variacion_costos_variables=Decimal(str(variacion_costos_variables)),
        variacion_volumen=Decimal(str(variacion_volumen)),
        variacion_precios=Decimal(str(variacion_precios)),
    )


@router.get("/simulador/punto-equilibrio", response_model=Dict[str, Any])
def calcular_punto_equilibrio(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Calcula el punto de equilibrio operativo.

    Retorna:
    - Cantidad de kg necesarios para cubrir costos fijos
    - Ingresos necesarios para punto de equilibrio
    - Comparación con volumen actual
    - Margen de seguridad
    """
    service = CostoService(db)
    return service.simular_punto_equilibrio()


# ==================== ALERTAS DE MARGEN ====================

@router.get("/alertas/margen-bajo", response_model=List[Dict[str, Any]])
def get_alertas_margen_bajo(
    margen_minimo: float = Query(15, ge=0, le=100, description="Margen mínimo aceptable en %"),
    dias_atras: int = Query(30, ge=1, le=365, description="Días hacia atrás para analizar"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Obtiene alertas de servicios y lotes con margen por debajo del mínimo.

    Identifica:
    - Lotes recientes con margen bajo o negativo
    - Servicios cuyo margen real es menor al objetivo
    """
    service = CostoService(db)
    return service.get_alertas_margen_bajo(
        margen_minimo=Decimal(str(margen_minimo)),
        dias_atras=dias_atras,
    )


@router.get("/alertas/resumen", response_model=Dict[str, Any])
def get_resumen_alertas_costos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Obtiene un resumen de todas las alertas de costos.

    Útil para dashboard y monitoreo general.
    """
    service = CostoService(db)
    return service.get_resumen_alertas_costos()
