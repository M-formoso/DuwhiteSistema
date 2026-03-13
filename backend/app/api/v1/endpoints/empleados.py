"""
Endpoints de Empleados para DUWHITE ERP
"""

import logging
from datetime import date
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.core.deps import get_db, get_current_user
from app.models.usuario import Usuario
from app.services.empleado_service import EmpleadoService
from app.schemas.empleado import (
    EmpleadoCreate, EmpleadoUpdate, EmpleadoResponse, EmpleadoList,
    AsistenciaCreate, AsistenciaResponse,
    JornadaLaboralResponse, JornadaJustificacion,
    MovimientoNominaCreate, MovimientoNominaResponse, PagarMovimientoRequest,
    LiquidacionCreate, LiquidacionResponse
)
from app.schemas.common import PaginatedResponse
from app.models.empleado import Empleado

router = APIRouter()


def _empleado_to_response(empleado: Empleado) -> EmpleadoResponse:
    """Convierte un modelo Empleado a EmpleadoResponse"""
    return EmpleadoResponse(
        id=empleado.id,
        codigo=empleado.codigo,
        nombre=empleado.nombre,
        apellido=empleado.apellido,
        nombre_completo=empleado.nombre_completo,
        dni=empleado.dni,
        cuil=empleado.cuil,
        fecha_nacimiento=empleado.fecha_nacimiento,
        email=empleado.email,
        telefono=empleado.telefono,
        telefono_emergencia=empleado.telefono_emergencia,
        contacto_emergencia=empleado.contacto_emergencia,
        direccion=empleado.direccion,
        ciudad=empleado.ciudad,
        codigo_postal=empleado.codigo_postal,
        tipo=empleado.tipo,
        tipo_contrato=empleado.tipo_contrato,
        estado=empleado.estado,
        puesto=empleado.puesto,
        departamento=empleado.departamento,
        fecha_ingreso=empleado.fecha_ingreso,
        fecha_egreso=empleado.fecha_egreso,
        horario_entrada=empleado.horario_entrada,
        horario_salida=empleado.horario_salida,
        dias_trabajo=empleado.dias_trabajo,
        salario_base=empleado.salario_base,
        salario_hora=empleado.salario_hora,
        tipo_contratacion=empleado.tipo_contratacion,
        dia_pago=empleado.dia_pago,
        jornada_horas=empleado.jornada_horas,
        adelanto_maximo_porcentaje=empleado.adelanto_maximo_porcentaje,
        banco=empleado.banco,
        tipo_cuenta_banco=empleado.tipo_cuenta_banco,
        numero_cuenta_banco=empleado.numero_cuenta_banco,
        cbu=empleado.cbu,
        alias_cbu=empleado.alias_cbu,
        obra_social=empleado.obra_social,
        numero_afiliado_os=empleado.numero_afiliado_os,
        art=empleado.art,
        user_id=empleado.user_id,
        notas=empleado.notas,
        foto_url=empleado.foto_url,
        activo=empleado.activo,
        created_at=empleado.created_at,
    )


# ==================== EMPLEADOS ====================

@router.get("", response_model=PaginatedResponse[EmpleadoList])
def list_empleados(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    tipo: Optional[str] = None,
    estado: Optional[str] = None,
    departamento: Optional[str] = None,
    search: Optional[str] = None,
    solo_activos: bool = True,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista empleados con filtros"""
    service = EmpleadoService(db)
    empleados, total = service.get_empleados(
        skip=skip,
        limit=limit,
        tipo=tipo,
        estado=estado,
        departamento=departamento,
        search=search,
        solo_activos=solo_activos
    )

    items = [
        EmpleadoList(
            id=e.id,
            codigo=e.codigo,
            nombre_completo=e.nombre_completo,
            dni=e.dni,
            tipo=e.tipo,
            estado=e.estado,
            puesto=e.puesto,
            departamento=e.departamento,
            fecha_ingreso=e.fecha_ingreso,
            telefono=e.telefono,
            email=e.email,
            tipo_contratacion=e.tipo_contratacion,
            salario_base=e.salario_base
        )
        for e in empleados
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/departamentos", response_model=List[str])
def list_departamentos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista departamentos únicos"""
    service = EmpleadoService(db)
    return service.get_departamentos()


@router.post("", response_model=EmpleadoResponse, status_code=status.HTTP_201_CREATED)
def create_empleado(
    data: EmpleadoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Crea nuevo empleado"""
    logger.info(f"Creando empleado: nombre={data.nombre}, apellido={data.apellido}, dni={data.dni}")

    service = EmpleadoService(db)

    # Verificar DNI único (incluyendo inactivos)
    existing = service.get_empleado_by_dni(data.dni)
    if existing:
        logger.warning(f"DNI duplicado: {data.dni}, activo={existing.activo}")
        if existing.activo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un empleado activo con el DNI {data.dni}"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un empleado inactivo con el DNI {data.dni}. Puede reactivarlo en lugar de crear uno nuevo."
            )

    try:
        empleado = service.create_empleado(data)
        logger.info(f"Empleado creado: id={empleado.id}, codigo={empleado.codigo}")
        return _empleado_to_response(empleado)
    except Exception as e:
        logger.error(f"Error al crear empleado: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al crear empleado: {str(e)}"
        )


@router.get("/{empleado_id}", response_model=EmpleadoResponse)
def get_empleado(
    empleado_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene empleado por ID"""
    service = EmpleadoService(db)
    empleado = service.get_empleado(empleado_id)

    if not empleado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empleado no encontrado"
        )

    return _empleado_to_response(empleado)


@router.put("/{empleado_id}", response_model=EmpleadoResponse)
def update_empleado(
    empleado_id: UUID,
    data: EmpleadoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Actualiza empleado"""
    # Debug: ver qué fecha llega
    if data.fecha_ingreso:
        logger.info(f"UPDATE empleado {empleado_id}: fecha_ingreso recibida = {data.fecha_ingreso} (tipo: {type(data.fecha_ingreso)})")

    service = EmpleadoService(db)
    empleado = service.update_empleado(empleado_id, data)

    # Debug: ver qué fecha se guardó
    if empleado:
        logger.info(f"UPDATE empleado {empleado_id}: fecha_ingreso guardada = {empleado.fecha_ingreso}")

    if not empleado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empleado no encontrado"
        )

    return _empleado_to_response(empleado)


@router.delete("/{empleado_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_empleado(
    empleado_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Elimina empleado (soft delete)"""
    service = EmpleadoService(db)
    success = service.delete_empleado(empleado_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empleado no encontrado"
        )


# ==================== ASISTENCIA ====================

@router.post("/asistencia", response_model=AsistenciaResponse, status_code=status.HTTP_201_CREATED)
def registrar_asistencia(
    data: AsistenciaCreate,
    es_manual: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Registra asistencia de empleado"""
    service = EmpleadoService(db)

    # Verificar que el empleado existe
    empleado = service.get_empleado(data.empleado_id)
    if not empleado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empleado no encontrado"
        )

    asistencia = service.registrar_asistencia(
        data=data,
        registrado_por_id=current_user.id,
        es_manual=es_manual
    )

    return AsistenciaResponse(**asistencia.__dict__)


@router.get("/asistencia/listado", response_model=PaginatedResponse[AsistenciaResponse])
def list_asistencias(
    empleado_id: Optional[UUID] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista registros de asistencia"""
    service = EmpleadoService(db)
    asistencias, total = service.get_asistencias(
        empleado_id=empleado_id,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        skip=skip,
        limit=limit
    )

    items = [AsistenciaResponse(**a.__dict__) for a in asistencias]

    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


# ==================== JORNADAS ====================

@router.get("/jornadas", response_model=PaginatedResponse[JornadaLaboralResponse])
def list_jornadas(
    empleado_id: Optional[UUID] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista jornadas laborales"""
    service = EmpleadoService(db)
    jornadas, total = service.get_jornadas(
        empleado_id=empleado_id,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        skip=skip,
        limit=limit
    )

    items = [JornadaLaboralResponse(**j.__dict__) for j in jornadas]

    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


@router.post("/jornadas/{jornada_id}/justificar", response_model=JornadaLaboralResponse)
def justificar_jornada(
    jornada_id: UUID,
    data: JornadaJustificacion,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Justifica ausencia o tardanza"""
    service = EmpleadoService(db)
    jornada = service.justificar_jornada(jornada_id, data)

    if not jornada:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jornada no encontrada"
        )

    return JornadaLaboralResponse(**jornada.__dict__)


# ==================== MOVIMIENTOS NOMINA ====================

@router.post("/nomina/movimientos", response_model=MovimientoNominaResponse, status_code=status.HTTP_201_CREATED)
def create_movimiento_nomina(
    data: MovimientoNominaCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Crea movimiento de nómina (bono, adelanto, descuento, etc.)"""
    service = EmpleadoService(db)

    # Verificar que el empleado existe
    empleado = service.get_empleado(data.empleado_id)
    if not empleado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empleado no encontrado"
        )

    try:
        movimiento = service.create_movimiento_nomina(
            data=data,
            registrado_por_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return MovimientoNominaResponse(
        **movimiento.__dict__,
        empleado_nombre=empleado.nombre_completo
    )


@router.get("/nomina/movimientos", response_model=PaginatedResponse[MovimientoNominaResponse])
def list_movimientos_nomina(
    empleado_id: Optional[UUID] = None,
    periodo_mes: Optional[int] = Query(None, ge=1, le=12),
    periodo_anio: Optional[int] = Query(None, ge=2020),
    tipo: Optional[str] = None,
    pagado: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista movimientos de nómina"""
    service = EmpleadoService(db)
    movimientos, total = service.get_movimientos_nomina(
        empleado_id=empleado_id,
        periodo_mes=periodo_mes,
        periodo_anio=periodo_anio,
        tipo=tipo,
        pagado=pagado,
        skip=skip,
        limit=limit
    )

    items = [MovimientoNominaResponse(**m.__dict__) for m in movimientos]

    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


@router.post("/nomina/movimientos/{movimiento_id}/pagar", response_model=MovimientoNominaResponse)
def pagar_movimiento_nomina(
    movimiento_id: UUID,
    data: PagarMovimientoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Marca movimiento de nómina como pagado"""
    service = EmpleadoService(db)
    movimiento = service.pagar_movimiento(movimiento_id, data)

    if not movimiento:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movimiento no encontrado"
        )

    return MovimientoNominaResponse(**movimiento.__dict__)


# ==================== LIQUIDACIONES ====================

@router.post("/liquidaciones", response_model=LiquidacionResponse, status_code=status.HTTP_201_CREATED)
def create_liquidacion(
    data: LiquidacionCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Genera liquidación de sueldo"""
    service = EmpleadoService(db)

    try:
        liquidacion = service.create_liquidacion(
            data=data,
            generada_por_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    # Obtener nombre del empleado
    empleado = service.get_empleado(liquidacion.empleado_id)

    return LiquidacionResponse(
        **liquidacion.__dict__,
        empleado_nombre=empleado.nombre_completo if empleado else None
    )


@router.get("/liquidaciones", response_model=PaginatedResponse[LiquidacionResponse])
def list_liquidaciones(
    empleado_id: Optional[UUID] = None,
    periodo_mes: Optional[int] = Query(None, ge=1, le=12),
    periodo_anio: Optional[int] = Query(None, ge=2020),
    pagada: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista liquidaciones"""
    service = EmpleadoService(db)
    liquidaciones, total = service.get_liquidaciones(
        empleado_id=empleado_id,
        periodo_mes=periodo_mes,
        periodo_anio=periodo_anio,
        pagada=pagada,
        skip=skip,
        limit=limit
    )

    items = [LiquidacionResponse(**l.__dict__) for l in liquidaciones]

    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


@router.post("/liquidaciones/{liquidacion_id}/pagar", response_model=LiquidacionResponse)
def pagar_liquidacion(
    liquidacion_id: UUID,
    fecha_pago: date,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Marca liquidación como pagada"""
    service = EmpleadoService(db)
    liquidacion = service.pagar_liquidacion(liquidacion_id, fecha_pago)

    if not liquidacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Liquidación no encontrada"
        )

    return LiquidacionResponse(**liquidacion.__dict__)


# ==================== TIPOS Y CONSTANTES ====================

@router.get("/tipos", response_model=dict)
def get_tipos_empleado(
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene tipos y estados de empleados"""
    return {
        "tipos_empleado": [
            {"value": "operario", "label": "Operario"},
            {"value": "administrativo", "label": "Administrativo"},
            {"value": "supervisor", "label": "Supervisor"},
            {"value": "repartidor", "label": "Repartidor"},
            {"value": "gerente", "label": "Gerente"},
        ],
        "tipos_contrato": [
            {"value": "permanente", "label": "Permanente"},
            {"value": "temporal", "label": "Temporal"},
            {"value": "medio_tiempo", "label": "Medio Tiempo"},
            {"value": "por_hora", "label": "Por Hora"},
        ],
        "tipos_contratacion": [
            {"value": "blanco", "label": "En Blanco"},
            {"value": "negro", "label": "Sin Registrar"},
            {"value": "monotributo", "label": "Monotributo"},
        ],
        "estados_empleado": [
            {"value": "activo", "label": "Activo"},
            {"value": "licencia", "label": "En Licencia"},
            {"value": "vacaciones", "label": "De Vacaciones"},
            {"value": "suspendido", "label": "Suspendido"},
            {"value": "desvinculado", "label": "Desvinculado"},
        ],
        "tipos_movimiento_nomina": [
            {"value": "salario", "label": "Salario"},
            {"value": "hora_extra", "label": "Hora Extra"},
            {"value": "bono", "label": "Bono"},
            {"value": "comision", "label": "Comisión"},
            {"value": "aguinaldo", "label": "Aguinaldo"},
            {"value": "vacaciones", "label": "Vacaciones"},
            {"value": "descuento", "label": "Descuento"},
            {"value": "adelanto", "label": "Adelanto"},
            {"value": "prestamo", "label": "Préstamo"},
            {"value": "otro", "label": "Otro"},
        ],
    }
