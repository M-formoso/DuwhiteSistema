"""
Endpoints de Producción (Lotes, Etapas, Kanban).
"""

from datetime import date
from typing import Dict, Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_permission
from app.models.usuario import Usuario
from app.models.lote_produccion import EstadoLote, PrioridadLote
from app.models.orden_produccion import EstadoOrdenProduccion
from app.schemas.etapa_produccion import (
    EtapaProduccionCreate,
    EtapaProduccionUpdate,
    EtapaProduccionResponse,
    EtapaProduccionList,
)
from app.schemas.maquina import (
    MaquinaCreate,
    MaquinaUpdate,
    MaquinaResponse,
    MaquinaList,
)
from app.schemas.lote_produccion import (
    LoteProduccionCreate,
    LoteProduccionUpdate,
    LoteProduccionResponse,
    LoteProduccionList,
    LoteEtapaResponse,
    ConsumoInsumoLoteCreate,
    ConsumoInsumoLoteResponse,
    IniciarEtapaRequest,
    FinalizarEtapaRequest,
    MoverLoteRequest,
    CambiarEstadoLoteRequest,
    KanbanBoard,
)
from app.schemas.common import PaginatedResponse, MessageResponse
from app.schemas.orden_produccion import (
    OrdenProduccionCreate,
    OrdenProduccionUpdate,
    OrdenProduccionResponse,
    OrdenProduccionList,
    AsignacionEmpleadoCreate,
    AsignacionEmpleadoUpdate,
    AsignacionEmpleadoResponse,
    IncidenciaCreate,
    IncidenciaUpdate,
    IncidenciaResponse,
    IncidenciaResolverRequest,
)
from app.services.produccion_service import ProduccionService

router = APIRouter()


# ==================== KANBAN ====================

@router.get("/kanban", response_model=KanbanBoard)
def obtener_kanban(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene el tablero Kanban completo."""
    service = ProduccionService(db)
    return service.get_kanban_board()


# ==================== ETAPAS ====================

@router.get("/etapas", response_model=List[EtapaProduccionResponse])
def listar_etapas(
    solo_activas: bool = True,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista todas las etapas de producción."""
    service = ProduccionService(db)
    etapas = service.get_etapas(solo_activas=solo_activas)

    return [
        EtapaProduccionResponse(
            id=e.id,
            codigo=e.codigo,
            nombre=e.nombre,
            descripcion=e.descripcion,
            orden=e.orden,
            color=e.color,
            es_inicial=e.es_inicial,
            es_final=e.es_final,
            requiere_peso=e.requiere_peso,
            requiere_maquina=e.requiere_maquina,
            tiempo_estimado_minutos=e.tiempo_estimado_minutos,
            activo=e.activo,
            created_at=e.created_at,
            updated_at=e.updated_at,
            cantidad_lotes_activos=len([le for le in e.lotes_etapa if le.estado == "en_proceso"]) if e.lotes_etapa else 0,
        )
        for e in etapas
    ]


@router.get("/etapas/lista", response_model=List[EtapaProduccionList])
def listar_etapas_dropdown(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista simplificada para dropdowns."""
    service = ProduccionService(db)
    etapas = service.get_etapas(solo_activas=True)
    return [
        EtapaProduccionList(
            id=e.id,
            codigo=e.codigo,
            nombre=e.nombre,
            color=e.color,
            orden=e.orden,
        )
        for e in etapas
    ]


@router.post("/etapas", response_model=EtapaProduccionResponse, status_code=status.HTTP_201_CREATED)
def crear_etapa(
    data: EtapaProduccionCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador")),
):
    """Crea una nueva etapa de producción."""
    service = ProduccionService(db)
    etapa = service.create_etapa(data, current_user.id)

    return EtapaProduccionResponse(
        id=etapa.id,
        codigo=etapa.codigo,
        nombre=etapa.nombre,
        descripcion=etapa.descripcion,
        orden=etapa.orden,
        color=etapa.color,
        es_inicial=etapa.es_inicial,
        es_final=etapa.es_final,
        requiere_peso=etapa.requiere_peso,
        requiere_maquina=etapa.requiere_maquina,
        tiempo_estimado_minutos=etapa.tiempo_estimado_minutos,
        activo=etapa.activo,
        created_at=etapa.created_at,
        updated_at=etapa.updated_at,
        cantidad_lotes_activos=0,
    )


@router.put("/etapas/{etapa_id}", response_model=EtapaProduccionResponse)
def actualizar_etapa(
    etapa_id: UUID,
    data: EtapaProduccionUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador")),
):
    """Actualiza una etapa de producción."""
    service = ProduccionService(db)
    etapa = service.update_etapa(etapa_id, data, current_user.id)

    if not etapa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etapa no encontrada",
        )

    return EtapaProduccionResponse(
        id=etapa.id,
        codigo=etapa.codigo,
        nombre=etapa.nombre,
        descripcion=etapa.descripcion,
        orden=etapa.orden,
        color=etapa.color,
        es_inicial=etapa.es_inicial,
        es_final=etapa.es_final,
        requiere_peso=etapa.requiere_peso,
        requiere_maquina=etapa.requiere_maquina,
        tiempo_estimado_minutos=etapa.tiempo_estimado_minutos,
        activo=etapa.activo,
        created_at=etapa.created_at,
        updated_at=etapa.updated_at,
        cantidad_lotes_activos=0,
    )


# ==================== MÁQUINAS ====================

@router.get("/maquinas", response_model=List[MaquinaResponse])
def listar_maquinas(
    tipo: Optional[str] = None,
    estado: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista todas las máquinas."""
    service = ProduccionService(db)
    maquinas = service.get_maquinas(tipo=tipo, estado=estado)

    return [
        MaquinaResponse(
            id=m.id,
            codigo=m.codigo,
            nombre=m.nombre,
            tipo=m.tipo,
            marca=m.marca,
            modelo=m.modelo,
            numero_serie=m.numero_serie,
            capacidad_kg=m.capacidad_kg,
            estado=m.estado,
            ubicacion=m.ubicacion,
            costo_hora=m.costo_hora,
            consumo_energia_kwh=m.consumo_energia_kwh,
            consumo_agua_litros=m.consumo_agua_litros,
            fecha_ultimo_mantenimiento=m.fecha_ultimo_mantenimiento,
            fecha_proximo_mantenimiento=m.fecha_proximo_mantenimiento,
            horas_uso_totales=m.horas_uso_totales,
            notas=m.notas,
            created_at=m.created_at,
            updated_at=m.updated_at,
            is_active=m.activo,
            requiere_mantenimiento=m.requiere_mantenimiento,
        )
        for m in maquinas
    ]


@router.get("/maquinas/lista", response_model=List[MaquinaList])
def listar_maquinas_dropdown(
    tipo: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista simplificada para dropdowns."""
    service = ProduccionService(db)
    maquinas = service.get_maquinas(tipo=tipo, estado="disponible")
    return [
        MaquinaList(
            id=m.id,
            codigo=m.codigo,
            nombre=m.nombre,
            tipo=m.tipo,
            estado=m.estado,
            capacidad_kg=m.capacidad_kg,
        )
        for m in maquinas
    ]


@router.post("/maquinas", response_model=MaquinaResponse, status_code=status.HTTP_201_CREATED)
def crear_maquina(
    data: MaquinaCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador")),
):
    """Crea una nueva máquina."""
    service = ProduccionService(db)
    maquina = service.create_maquina(data, current_user.id)

    return MaquinaResponse(
        id=maquina.id,
        codigo=maquina.codigo,
        nombre=maquina.nombre,
        tipo=maquina.tipo,
        marca=maquina.marca,
        modelo=maquina.modelo,
        numero_serie=maquina.numero_serie,
        capacidad_kg=maquina.capacidad_kg,
        estado=maquina.estado,
        ubicacion=maquina.ubicacion,
        costo_hora=maquina.costo_hora,
        consumo_energia_kwh=maquina.consumo_energia_kwh,
        consumo_agua_litros=maquina.consumo_agua_litros,
        fecha_ultimo_mantenimiento=maquina.fecha_ultimo_mantenimiento,
        fecha_proximo_mantenimiento=maquina.fecha_proximo_mantenimiento,
        horas_uso_totales=maquina.horas_uso_totales,
        notas=maquina.notas,
        created_at=maquina.created_at,
        updated_at=maquina.updated_at,
        is_active=maquina.activo,
        requiere_mantenimiento=maquina.requiere_mantenimiento,
    )


# ==================== LOTES ====================

@router.get("/lotes", response_model=PaginatedResponse)
def listar_lotes(
    skip: int = 0,
    limit: int = 50,
    estado: Optional[EstadoLote] = None,
    etapa_id: Optional[UUID] = None,
    cliente_id: Optional[UUID] = None,
    prioridad: Optional[PrioridadLote] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    solo_atrasados: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista lotes de producción con filtros."""
    service = ProduccionService(db)
    lotes, total = service.get_lotes(
        skip=skip,
        limit=limit,
        estado=estado,
        etapa_id=etapa_id,
        cliente_id=cliente_id,
        prioridad=prioridad,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        solo_atrasados=solo_atrasados,
    )

    items = [
        LoteProduccionList(
            id=l.id,
            numero=l.numero,
            cliente_nombre=l.cliente.razon_social if l.cliente else None,
            tipo_servicio=l.tipo_servicio,
            estado=l.estado,
            prioridad=l.prioridad,
            etapa_actual_nombre=l.etapa_actual.nombre if l.etapa_actual else None,
            etapa_actual_color=l.etapa_actual.color if l.etapa_actual else None,
            peso_entrada_kg=l.peso_entrada_kg,
            fecha_ingreso=l.fecha_ingreso,
            fecha_compromiso=l.fecha_compromiso,
            esta_atrasado=l.esta_atrasado,
            porcentaje_avance=l.porcentaje_avance,
        )
        for l in lotes
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/lotes/{lote_id}", response_model=LoteProduccionResponse)
def obtener_lote(
    lote_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene un lote por ID."""
    service = ProduccionService(db)
    lote = service.get_lote(lote_id)

    if not lote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lote no encontrado",
        )

    etapas_response = [
        LoteEtapaResponse(
            id=le.id,
            lote_id=le.lote_id,
            etapa_id=le.etapa_id,
            orden=le.orden,
            estado=le.estado,
            fecha_inicio=le.fecha_inicio,
            fecha_fin=le.fecha_fin,
            responsable_id=le.responsable_id,
            maquina_id=le.maquina_id,
            peso_kg=le.peso_kg,
            observaciones=le.observaciones,
            created_at=le.created_at,
            etapa_codigo=le.etapa.codigo if le.etapa else None,
            etapa_nombre=le.etapa.nombre if le.etapa else None,
            etapa_color=le.etapa.color if le.etapa else None,
            responsable_nombre=le.responsable.nombre_completo if le.responsable else None,
            maquina_nombre=le.maquina.nombre if le.maquina else None,
            duracion_minutos=le.duracion_minutos,
        )
        for le in sorted(lote.etapas, key=lambda x: x.orden)
    ]

    return LoteProduccionResponse(
        id=lote.id,
        numero=lote.numero,
        cliente_id=lote.cliente_id,
        pedido_id=lote.pedido_id,
        tipo_servicio=lote.tipo_servicio,
        estado=lote.estado,
        prioridad=lote.prioridad,
        etapa_actual_id=lote.etapa_actual_id,
        peso_entrada_kg=lote.peso_entrada_kg,
        peso_salida_kg=lote.peso_salida_kg,
        cantidad_prendas=lote.cantidad_prendas,
        fecha_ingreso=lote.fecha_ingreso,
        fecha_compromiso=lote.fecha_compromiso,
        fecha_inicio_proceso=lote.fecha_inicio_proceso,
        fecha_fin_proceso=lote.fecha_fin_proceso,
        creado_por_id=lote.creado_por_id,
        descripcion=lote.descripcion,
        notas_internas=lote.notas_internas,
        notas_cliente=lote.notas_cliente,
        observaciones_calidad=lote.observaciones_calidad,
        tiene_manchas=lote.tiene_manchas,
        tiene_roturas=lote.tiene_roturas,
        created_at=lote.created_at,
        updated_at=lote.updated_at,
        is_active=lote.activo,
        cliente_nombre=lote.cliente.razon_social if lote.cliente else None,
        pedido_numero=lote.pedido.numero if lote.pedido else None,
        etapa_actual_nombre=lote.etapa_actual.nombre if lote.etapa_actual else None,
        etapa_actual_color=lote.etapa_actual.color if lote.etapa_actual else None,
        creado_por_nombre=lote.creado_por.nombre_completo if lote.creado_por else None,
        tiempo_en_proceso=lote.tiempo_en_proceso,
        esta_atrasado=lote.esta_atrasado,
        porcentaje_avance=lote.porcentaje_avance,
        etapas=etapas_response,
    )


@router.post("/lotes", response_model=LoteProduccionResponse, status_code=status.HTTP_201_CREATED)
def crear_lote(
    data: LoteProduccionCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador")),
):
    """Crea un nuevo lote de producción."""
    service = ProduccionService(db)
    lote = service.create_lote(data, current_user.id)

    # Recargar con relaciones
    lote = service.get_lote(lote.id)

    etapas_response = [
        LoteEtapaResponse(
            id=le.id,
            lote_id=le.lote_id,
            etapa_id=le.etapa_id,
            orden=le.orden,
            estado=le.estado,
            fecha_inicio=le.fecha_inicio,
            fecha_fin=le.fecha_fin,
            responsable_id=le.responsable_id,
            maquina_id=le.maquina_id,
            peso_kg=le.peso_kg,
            observaciones=le.observaciones,
            created_at=le.created_at,
            etapa_codigo=le.etapa.codigo if le.etapa else None,
            etapa_nombre=le.etapa.nombre if le.etapa else None,
            etapa_color=le.etapa.color if le.etapa else None,
            responsable_nombre=None,
            maquina_nombre=None,
            duracion_minutos=0,
        )
        for le in sorted(lote.etapas, key=lambda x: x.orden)
    ]

    return LoteProduccionResponse(
        id=lote.id,
        numero=lote.numero,
        cliente_id=lote.cliente_id,
        pedido_id=lote.pedido_id,
        tipo_servicio=lote.tipo_servicio,
        estado=lote.estado,
        prioridad=lote.prioridad,
        etapa_actual_id=lote.etapa_actual_id,
        peso_entrada_kg=lote.peso_entrada_kg,
        peso_salida_kg=lote.peso_salida_kg,
        cantidad_prendas=lote.cantidad_prendas,
        fecha_ingreso=lote.fecha_ingreso,
        fecha_compromiso=lote.fecha_compromiso,
        fecha_inicio_proceso=lote.fecha_inicio_proceso,
        fecha_fin_proceso=lote.fecha_fin_proceso,
        creado_por_id=lote.creado_por_id,
        descripcion=lote.descripcion,
        notas_internas=lote.notas_internas,
        notas_cliente=lote.notas_cliente,
        observaciones_calidad=lote.observaciones_calidad,
        tiene_manchas=lote.tiene_manchas,
        tiene_roturas=lote.tiene_roturas,
        created_at=lote.created_at,
        updated_at=lote.updated_at,
        is_active=lote.activo,
        cliente_nombre=None,
        pedido_numero=None,
        etapa_actual_nombre=lote.etapa_actual.nombre if lote.etapa_actual else None,
        etapa_actual_color=lote.etapa_actual.color if lote.etapa_actual else None,
        creado_por_nombre=current_user.nombre_completo,
        tiempo_en_proceso=0,
        esta_atrasado=False,
        porcentaje_avance=0,
        etapas=etapas_response,
    )


@router.put("/lotes/{lote_id}", response_model=LoteProduccionResponse)
def actualizar_lote(
    lote_id: UUID,
    data: LoteProduccionUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador")),
):
    """Actualiza un lote de producción."""
    service = ProduccionService(db)
    lote = service.update_lote(lote_id, data, current_user.id)

    if not lote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lote no encontrado",
        )

    # Recargar con relaciones
    lote = service.get_lote(lote.id)

    return await obtener_lote(lote_id, db, current_user)


@router.post("/lotes/{lote_id}/estado", response_model=MessageResponse)
def cambiar_estado_lote(
    lote_id: UUID,
    data: CambiarEstadoLoteRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador")),
):
    """Cambia el estado de un lote."""
    service = ProduccionService(db)
    lote = service.cambiar_estado_lote(
        lote_id=lote_id,
        estado=data.estado,
        usuario_id=current_user.id,
        observaciones=data.observaciones,
    )

    if not lote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lote no encontrado",
        )

    return MessageResponse(message=f"Estado del lote {lote.numero} cambiado a {data.estado.value}")


@router.post("/lotes/{lote_id}/mover", response_model=MessageResponse)
def mover_lote(
    lote_id: UUID,
    data: MoverLoteRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador")),
):
    """Mueve un lote a otra etapa."""
    service = ProduccionService(db)
    lote = service.mover_lote_a_etapa(lote_id, data, current_user.id)

    if not lote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lote no encontrado",
        )

    return MessageResponse(message=f"Lote {lote.numero} movido correctamente")


# ==================== ETAPAS DE LOTE ====================

@router.post("/lotes/{lote_id}/etapas/{etapa_id}/iniciar", response_model=LoteEtapaResponse)
def iniciar_etapa_lote(
    lote_id: UUID,
    etapa_id: UUID,
    data: IniciarEtapaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador")),
):
    """Inicia una etapa para un lote."""
    service = ProduccionService(db)
    lote_etapa = service.iniciar_etapa(lote_id, etapa_id, data, current_user.id)

    if not lote_etapa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etapa de lote no encontrada",
        )

    return LoteEtapaResponse(
        id=lote_etapa.id,
        lote_id=lote_etapa.lote_id,
        etapa_id=lote_etapa.etapa_id,
        orden=lote_etapa.orden,
        estado=lote_etapa.estado,
        fecha_inicio=lote_etapa.fecha_inicio,
        fecha_fin=lote_etapa.fecha_fin,
        responsable_id=lote_etapa.responsable_id,
        maquina_id=lote_etapa.maquina_id,
        peso_kg=lote_etapa.peso_kg,
        observaciones=lote_etapa.observaciones,
        created_at=lote_etapa.created_at,
        etapa_codigo=lote_etapa.etapa.codigo if lote_etapa.etapa else None,
        etapa_nombre=lote_etapa.etapa.nombre if lote_etapa.etapa else None,
        etapa_color=lote_etapa.etapa.color if lote_etapa.etapa else None,
        responsable_nombre=lote_etapa.responsable.nombre_completo if lote_etapa.responsable else None,
        maquina_nombre=lote_etapa.maquina.nombre if lote_etapa.maquina else None,
        duracion_minutos=lote_etapa.duracion_minutos,
    )


@router.post("/lotes/{lote_id}/etapas/{etapa_id}/finalizar", response_model=LoteEtapaResponse)
def finalizar_etapa_lote(
    lote_id: UUID,
    etapa_id: UUID,
    data: FinalizarEtapaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador")),
):
    """Finaliza una etapa para un lote."""
    service = ProduccionService(db)
    lote_etapa = service.finalizar_etapa(lote_id, etapa_id, data, current_user.id)

    if not lote_etapa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etapa de lote no encontrada",
        )

    return LoteEtapaResponse(
        id=lote_etapa.id,
        lote_id=lote_etapa.lote_id,
        etapa_id=lote_etapa.etapa_id,
        orden=lote_etapa.orden,
        estado=lote_etapa.estado,
        fecha_inicio=lote_etapa.fecha_inicio,
        fecha_fin=lote_etapa.fecha_fin,
        responsable_id=lote_etapa.responsable_id,
        maquina_id=lote_etapa.maquina_id,
        peso_kg=lote_etapa.peso_kg,
        observaciones=lote_etapa.observaciones,
        created_at=lote_etapa.created_at,
        etapa_codigo=lote_etapa.etapa.codigo if lote_etapa.etapa else None,
        etapa_nombre=lote_etapa.etapa.nombre if lote_etapa.etapa else None,
        etapa_color=lote_etapa.etapa.color if lote_etapa.etapa else None,
        responsable_nombre=lote_etapa.responsable.nombre_completo if lote_etapa.responsable else None,
        maquina_nombre=lote_etapa.maquina.nombre if lote_etapa.maquina else None,
        duracion_minutos=lote_etapa.duracion_minutos,
    )


# ==================== CONSUMOS ====================

@router.get("/lotes/{lote_id}/consumos", response_model=List[ConsumoInsumoLoteResponse])
def listar_consumos_lote(
    lote_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista los consumos de insumos de un lote."""
    service = ProduccionService(db)
    consumos = service.get_consumos_lote(lote_id)

    return [
        ConsumoInsumoLoteResponse(
            id=c.id,
            lote_id=c.lote_id,
            insumo_id=c.insumo_id,
            etapa_id=c.etapa_id,
            cantidad=c.cantidad,
            unidad=c.unidad,
            costo_unitario=c.costo_unitario,
            costo_total=c.costo_total,
            registrado_por_id=c.registrado_por_id,
            registrado_por_nombre=c.registrado_por.nombre_completo if c.registrado_por else None,
            insumo_codigo=c.insumo.codigo if c.insumo else None,
            insumo_nombre=c.insumo.nombre if c.insumo else None,
            notas=c.notas,
            created_at=c.created_at,
        )
        for c in consumos
    ]


@router.post("/lotes/{lote_id}/consumos", response_model=ConsumoInsumoLoteResponse, status_code=status.HTTP_201_CREATED)
def registrar_consumo(
    lote_id: UUID,
    data: ConsumoInsumoLoteCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador")),
):
    """Registra consumo de insumo en un lote."""
    service = ProduccionService(db)

    try:
        consumo = service.registrar_consumo_insumo(lote_id, data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return ConsumoInsumoLoteResponse(
        id=consumo.id,
        lote_id=consumo.lote_id,
        insumo_id=consumo.insumo_id,
        etapa_id=consumo.etapa_id,
        cantidad=consumo.cantidad,
        unidad=consumo.unidad,
        costo_unitario=consumo.costo_unitario,
        costo_total=consumo.costo_total,
        registrado_por_id=consumo.registrado_por_id,
        registrado_por_nombre=current_user.nombre_completo,
        insumo_codigo=consumo.insumo.codigo if consumo.insumo else None,
        insumo_nombre=consumo.insumo.nombre if consumo.insumo else None,
        notas=consumo.notas,
        created_at=consumo.created_at,
    )


# ==================== ÓRDENES DE PRODUCCIÓN ====================

@router.get("/ordenes", response_model=PaginatedResponse)
def listar_ordenes_produccion(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    estado: Optional[str] = None,
    cliente_id: Optional[UUID] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista órdenes de producción con filtros."""
    service = ProduccionService(db)
    ordenes, total = service.get_ordenes_produccion(
        skip=skip,
        limit=limit,
        estado=estado,
        cliente_id=cliente_id,
        search=search,
    )

    items = [
        OrdenProduccionList(
            id=o.id,
            numero=o.numero,
            estado=o.estado,
            prioridad=o.prioridad,
            cliente_nombre=o.cliente.razon_social if o.cliente else None,
            fecha_programada_fin=o.fecha_programada_fin,
            porcentaje_avance=o.porcentaje_avance,
            esta_atrasada=o.esta_atrasada,
            cantidad_lotes=len(o.lotes) if o.lotes else 0,
        )
        for o in ordenes
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/ordenes/{orden_id}", response_model=OrdenProduccionResponse)
def obtener_orden_produccion(
    orden_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene una orden de producción por ID."""
    service = ProduccionService(db)
    orden = service.get_orden_produccion(orden_id)

    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden de producción no encontrada",
        )

    return OrdenProduccionResponse(
        id=orden.id,
        numero=orden.numero,
        cliente_id=orden.cliente_id,
        pedido_id=orden.pedido_id,
        estado=orden.estado,
        prioridad=orden.prioridad,
        fecha_emision=orden.fecha_emision,
        fecha_programada_inicio=orden.fecha_programada_inicio,
        fecha_programada_fin=orden.fecha_programada_fin,
        fecha_inicio_real=orden.fecha_inicio_real,
        fecha_fin_real=orden.fecha_fin_real,
        descripcion=orden.descripcion,
        instrucciones_especiales=orden.instrucciones_especiales,
        cantidad_prendas_estimada=orden.cantidad_prendas_estimada,
        peso_estimado_kg=orden.peso_estimado_kg,
        cantidad_prendas_real=orden.cantidad_prendas_real,
        peso_real_kg=orden.peso_real_kg,
        responsable_id=orden.responsable_id,
        notas_internas=orden.notas_internas,
        notas_produccion=orden.notas_produccion,
        created_at=orden.created_at,
        updated_at=orden.updated_at,
        activo=orden.activo,
        porcentaje_avance=orden.porcentaje_avance,
        esta_atrasada=orden.esta_atrasada,
        dias_restantes=orden.dias_restantes,
        cantidad_lotes=len(orden.lotes) if orden.lotes else 0,
        cliente_nombre=orden.cliente.razon_social if orden.cliente else None,
        responsable_nombre=orden.responsable.nombre_completo if orden.responsable else None,
    )


@router.post("/ordenes", response_model=OrdenProduccionResponse, status_code=status.HTTP_201_CREATED)
def crear_orden_produccion(
    data: OrdenProduccionCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion")),
):
    """Crea una nueva orden de producción."""
    service = ProduccionService(db)
    orden = service.create_orden_produccion(data, current_user.id)

    return OrdenProduccionResponse(
        id=orden.id,
        numero=orden.numero,
        cliente_id=orden.cliente_id,
        pedido_id=orden.pedido_id,
        estado=orden.estado,
        prioridad=orden.prioridad,
        fecha_emision=orden.fecha_emision,
        fecha_programada_inicio=orden.fecha_programada_inicio,
        fecha_programada_fin=orden.fecha_programada_fin,
        fecha_inicio_real=orden.fecha_inicio_real,
        fecha_fin_real=orden.fecha_fin_real,
        descripcion=orden.descripcion,
        instrucciones_especiales=orden.instrucciones_especiales,
        cantidad_prendas_estimada=orden.cantidad_prendas_estimada,
        peso_estimado_kg=orden.peso_estimado_kg,
        cantidad_prendas_real=orden.cantidad_prendas_real,
        peso_real_kg=orden.peso_real_kg,
        responsable_id=orden.responsable_id,
        notas_internas=orden.notas_internas,
        notas_produccion=orden.notas_produccion,
        created_at=orden.created_at,
        updated_at=orden.updated_at,
        activo=orden.activo,
        porcentaje_avance=0,
        esta_atrasada=False,
        dias_restantes=orden.dias_restantes,
        cantidad_lotes=0,
        cliente_nombre=orden.cliente.razon_social if orden.cliente else None,
        responsable_nombre=orden.responsable.nombre_completo if orden.responsable else None,
    )


@router.put("/ordenes/{orden_id}", response_model=OrdenProduccionResponse)
def actualizar_orden_produccion(
    orden_id: UUID,
    data: OrdenProduccionUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion")),
):
    """Actualiza una orden de producción."""
    service = ProduccionService(db)
    orden = service.update_orden_produccion(orden_id, data, current_user.id)

    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden de producción no encontrada",
        )

    return await obtener_orden_produccion(orden_id, db, current_user)


@router.post("/ordenes/{orden_id}/estado", response_model=MessageResponse)
def cambiar_estado_orden_produccion(
    orden_id: UUID,
    estado: EstadoOrdenProduccion = Query(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion")),
):
    """Cambia el estado de una orden de producción."""
    service = ProduccionService(db)
    orden = service.cambiar_estado_orden_produccion(orden_id, estado, current_user.id)

    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden de producción no encontrada",
        )

    return MessageResponse(message=f"Orden {orden.numero} cambiada a estado {estado.value}")


# ==================== ASIGNACIÓN DE EMPLEADOS ====================

@router.get("/ordenes/{orden_id}/asignaciones", response_model=List[AsignacionEmpleadoResponse])
def listar_asignaciones_orden(
    orden_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista las asignaciones de empleados de una orden."""
    service = ProduccionService(db)
    asignaciones = service.get_asignaciones_orden(orden_id)

    return [
        AsignacionEmpleadoResponse(
            id=a.id,
            orden_id=a.orden_id,
            empleado_id=a.empleado_id,
            etapa_id=a.etapa_id,
            fecha_asignacion=a.fecha_asignacion,
            fecha_fin_asignacion=a.fecha_fin_asignacion,
            turno=a.turno,
            horas_estimadas=a.horas_estimadas,
            horas_trabajadas=a.horas_trabajadas,
            notas=a.notas,
            activo=a.activo,
            created_at=a.created_at,
            updated_at=a.updated_at,
            empleado_nombre=a.empleado.nombre_completo if a.empleado else None,
            etapa_nombre=a.etapa.nombre if a.etapa else None,
            orden_numero=a.orden.numero if a.orden else None,
        )
        for a in asignaciones
    ]


@router.post("/ordenes/{orden_id}/asignaciones", response_model=AsignacionEmpleadoResponse, status_code=status.HTTP_201_CREATED)
def crear_asignacion_empleado(
    orden_id: UUID,
    data: AsignacionEmpleadoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion")),
):
    """Asigna un empleado a una orden de producción."""
    # Asegurar que el orden_id del path coincida
    data.orden_id = orden_id

    service = ProduccionService(db)
    asignacion = service.crear_asignacion_empleado(data, current_user.id)

    return AsignacionEmpleadoResponse(
        id=asignacion.id,
        orden_id=asignacion.orden_id,
        empleado_id=asignacion.empleado_id,
        etapa_id=asignacion.etapa_id,
        fecha_asignacion=asignacion.fecha_asignacion,
        fecha_fin_asignacion=asignacion.fecha_fin_asignacion,
        turno=asignacion.turno,
        horas_estimadas=asignacion.horas_estimadas,
        horas_trabajadas=asignacion.horas_trabajadas,
        notas=asignacion.notas,
        activo=asignacion.activo,
        created_at=asignacion.created_at,
        updated_at=asignacion.updated_at,
        empleado_nombre=asignacion.empleado.nombre_completo if asignacion.empleado else None,
        etapa_nombre=asignacion.etapa.nombre if asignacion.etapa else None,
        orden_numero=None,
    )


@router.put("/asignaciones/{asignacion_id}", response_model=AsignacionEmpleadoResponse)
def actualizar_asignacion_empleado(
    asignacion_id: UUID,
    data: AsignacionEmpleadoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion")),
):
    """Actualiza una asignación de empleado."""
    service = ProduccionService(db)
    asignacion = service.actualizar_asignacion_empleado(asignacion_id, data, current_user.id)

    if not asignacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asignación no encontrada",
        )

    return AsignacionEmpleadoResponse(
        id=asignacion.id,
        orden_id=asignacion.orden_id,
        empleado_id=asignacion.empleado_id,
        etapa_id=asignacion.etapa_id,
        fecha_asignacion=asignacion.fecha_asignacion,
        fecha_fin_asignacion=asignacion.fecha_fin_asignacion,
        turno=asignacion.turno,
        horas_estimadas=asignacion.horas_estimadas,
        horas_trabajadas=asignacion.horas_trabajadas,
        notas=asignacion.notas,
        activo=asignacion.activo,
        created_at=asignacion.created_at,
        updated_at=asignacion.updated_at,
        empleado_nombre=asignacion.empleado.nombre_completo if asignacion.empleado else None,
        etapa_nombre=asignacion.etapa.nombre if asignacion.etapa else None,
        orden_numero=asignacion.orden.numero if asignacion.orden else None,
    )


@router.delete("/asignaciones/{asignacion_id}", response_model=MessageResponse)
def eliminar_asignacion_empleado(
    asignacion_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion")),
):
    """Elimina una asignación de empleado."""
    service = ProduccionService(db)
    success = service.eliminar_asignacion_empleado(asignacion_id, current_user.id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asignación no encontrada",
        )

    return MessageResponse(message="Asignación eliminada correctamente")


# ==================== INCIDENCIAS ====================

@router.get("/incidencias", response_model=PaginatedResponse)
def listar_incidencias(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    orden_id: Optional[UUID] = None,
    estado: Optional[str] = None,
    severidad: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista incidencias de producción con filtros."""
    service = ProduccionService(db)
    incidencias, total = service.get_incidencias(
        skip=skip,
        limit=limit,
        orden_id=orden_id,
        estado=estado,
        severidad=severidad,
    )

    items = [
        IncidenciaResponse(
            id=i.id,
            orden_id=i.orden_id,
            lote_id=i.lote_id,
            etapa_id=i.etapa_id,
            tipo=i.tipo,
            severidad=i.severidad,
            titulo=i.titulo,
            descripcion=i.descripcion,
            estado=i.estado,
            fecha_incidencia=i.fecha_incidencia,
            fecha_resolucion=i.fecha_resolucion,
            acciones_tomadas=i.acciones_tomadas,
            tiempo_perdido_minutos=i.tiempo_perdido_minutos,
            costo_estimado=i.costo_estimado,
            fotos=i.fotos_lista,
            created_at=i.created_at,
            updated_at=i.updated_at,
            orden_numero=i.orden.numero if i.orden else None,
            lote_numero=i.lote.numero if i.lote else None,
            etapa_nombre=i.etapa.nombre if i.etapa else None,
            reportado_por_nombre=i.reportado_por.nombre_completo if i.reportado_por else None,
            resuelto_por_nombre=i.resuelto_por.nombre_completo if i.resuelto_por else None,
        )
        for i in incidencias
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/incidencias/{incidencia_id}", response_model=IncidenciaResponse)
def obtener_incidencia(
    incidencia_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene una incidencia por ID."""
    service = ProduccionService(db)
    incidencia = service.get_incidencia(incidencia_id)

    if not incidencia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incidencia no encontrada",
        )

    return IncidenciaResponse(
        id=incidencia.id,
        orden_id=incidencia.orden_id,
        lote_id=incidencia.lote_id,
        etapa_id=incidencia.etapa_id,
        tipo=incidencia.tipo,
        severidad=incidencia.severidad,
        titulo=incidencia.titulo,
        descripcion=incidencia.descripcion,
        estado=incidencia.estado,
        fecha_incidencia=incidencia.fecha_incidencia,
        fecha_resolucion=incidencia.fecha_resolucion,
        acciones_tomadas=incidencia.acciones_tomadas,
        tiempo_perdido_minutos=incidencia.tiempo_perdido_minutos,
        costo_estimado=incidencia.costo_estimado,
        fotos=incidencia.fotos_lista,
        created_at=incidencia.created_at,
        updated_at=incidencia.updated_at,
        orden_numero=incidencia.orden.numero if incidencia.orden else None,
        lote_numero=incidencia.lote.numero if incidencia.lote else None,
        etapa_nombre=incidencia.etapa.nombre if incidencia.etapa else None,
        reportado_por_nombre=incidencia.reportado_por.nombre_completo if incidencia.reportado_por else None,
        resuelto_por_nombre=incidencia.resuelto_por.nombre_completo if incidencia.resuelto_por else None,
    )


@router.post("/incidencias", response_model=IncidenciaResponse, status_code=status.HTTP_201_CREATED)
def crear_incidencia(
    data: IncidenciaCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador")),
):
    """Crea una nueva incidencia."""
    service = ProduccionService(db)
    incidencia = service.crear_incidencia(data, current_user.id)

    return IncidenciaResponse(
        id=incidencia.id,
        orden_id=incidencia.orden_id,
        lote_id=incidencia.lote_id,
        etapa_id=incidencia.etapa_id,
        tipo=incidencia.tipo,
        severidad=incidencia.severidad,
        titulo=incidencia.titulo,
        descripcion=incidencia.descripcion,
        estado=incidencia.estado,
        fecha_incidencia=incidencia.fecha_incidencia,
        fecha_resolucion=incidencia.fecha_resolucion,
        acciones_tomadas=incidencia.acciones_tomadas,
        tiempo_perdido_minutos=incidencia.tiempo_perdido_minutos,
        costo_estimado=incidencia.costo_estimado,
        fotos=incidencia.fotos_lista,
        created_at=incidencia.created_at,
        updated_at=incidencia.updated_at,
        orden_numero=None,
        lote_numero=None,
        etapa_nombre=None,
        reportado_por_nombre=current_user.nombre_completo,
        resuelto_por_nombre=None,
    )


@router.put("/incidencias/{incidencia_id}", response_model=IncidenciaResponse)
def actualizar_incidencia(
    incidencia_id: UUID,
    data: IncidenciaUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion")),
):
    """Actualiza una incidencia."""
    service = ProduccionService(db)
    incidencia = service.actualizar_incidencia(incidencia_id, data, current_user.id)

    if not incidencia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incidencia no encontrada",
        )

    return await obtener_incidencia(incidencia_id, db, current_user)


@router.post("/incidencias/{incidencia_id}/resolver", response_model=IncidenciaResponse)
def resolver_incidencia(
    incidencia_id: UUID,
    data: IncidenciaResolverRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion")),
):
    """Resuelve una incidencia."""
    service = ProduccionService(db)
    incidencia = service.resolver_incidencia(incidencia_id, data, current_user.id)

    if not incidencia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incidencia no encontrada",
        )

    return await obtener_incidencia(incidencia_id, db, current_user)
