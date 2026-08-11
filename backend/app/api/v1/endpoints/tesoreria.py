"""
Endpoints de Tesorería.
"""

from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_permission
from app.core.storage import (
    abrir_archivo_cheque,
    content_type_por_extension,
    eliminar_archivo,
    guardar_archivo_cheque,
)
from app.models.usuario import Usuario
from app.services.tesoreria_service import TesoreriaService
from app.schemas.tesoreria import (
    ChequeCreate,
    ChequeUpdate,
    ChequeResponse,
    ChequeList,
    DepositarChequeRequest,
    CobrarChequeRequest,
    RechazarChequeRequest,
    EntregarChequeRequest,
    MovimientoTesoreriaCreate,
    MovimientoTesoreriaUpdate,
    MovimientoTesoreriaResponse,
    MovimientoTesoreriaList,
    MovimientoConsolidado,
    AnularMovimientoRequest,
    ResumenTesoreria,
    TIPOS_CHEQUE,
    ORIGENES_CHEQUE,
    ESTADOS_CHEQUE,
    METODOS_PAGO_TESORERIA,
    BANCOS_ARGENTINA,
)
from app.schemas.common import PaginatedResponse

router = APIRouter()


# ==================== CONSTANTES ====================

@router.get("/constantes/tipos-cheque")
def get_tipos_cheque():
    """Obtiene tipos de cheque."""
    return TIPOS_CHEQUE


@router.get("/constantes/origenes-cheque")
def get_origenes_cheque():
    """Obtiene orígenes de cheque."""
    return ORIGENES_CHEQUE


@router.get("/constantes/estados-cheque")
def get_estados_cheque():
    """Obtiene estados de cheque."""
    return ESTADOS_CHEQUE


@router.get("/constantes/metodos-pago")
def get_metodos_pago():
    """Obtiene métodos de pago."""
    return METODOS_PAGO_TESORERIA


@router.get("/constantes/bancos")
def get_bancos():
    """Obtiene lista de bancos."""
    return BANCOS_ARGENTINA


# ==================== RESUMEN ====================

@router.get("/resumen", response_model=ResumenTesoreria)
def get_resumen_tesoreria(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene resumen de tesorería."""
    service = TesoreriaService(db)
    return service.get_resumen(fecha_desde, fecha_hasta)


# ==================== CHEQUES ====================

@router.get("/cheques", response_model=PaginatedResponse[ChequeList])
def list_cheques(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    estado: Optional[str] = None,
    tipo: Optional[str] = None,
    origen: Optional[str] = None,
    cliente_id: Optional[UUID] = None,
    proveedor_id: Optional[UUID] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    buscar: Optional[str] = None,
    solo_en_cartera: bool = False,
    vencidos: bool = False,
    proximos_vencer: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista cheques con filtros."""
    service = TesoreriaService(db)
    cheques, total = service.get_cheques(
        skip=skip,
        limit=limit,
        estado=estado,
        tipo=tipo,
        origen=origen,
        cliente_id=cliente_id,
        proveedor_id=proveedor_id,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        buscar=buscar,
        solo_en_cartera=solo_en_cartera,
        vencidos=vencidos,
        proximos_vencer=proximos_vencer,
    )

    items = [ChequeList(**service.enrich_cheque(c)) for c in cheques]

    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/cheques/{cheque_id}", response_model=ChequeResponse)
def get_cheque(
    cheque_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene un cheque por ID."""
    service = TesoreriaService(db)
    cheque = service.get_cheque(cheque_id)

    if not cheque:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cheque no encontrado"
        )

    return ChequeResponse(**service.enrich_cheque(cheque))


@router.post("/cheques", response_model=ChequeResponse, status_code=status.HTTP_201_CREATED)
def create_cheque(
    data: ChequeCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Crea un nuevo cheque."""
    service = TesoreriaService(db)
    cheque = service.create_cheque(data, current_user.id)
    return ChequeResponse(**service.enrich_cheque(cheque))


@router.put("/cheques/{cheque_id}", response_model=ChequeResponse)
def update_cheque(
    cheque_id: UUID,
    data: ChequeUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Actualiza un cheque."""
    service = TesoreriaService(db)
    cheque = service.update_cheque(cheque_id, data)

    if not cheque:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cheque no encontrado"
        )

    return ChequeResponse(**service.enrich_cheque(cheque))


@router.delete("/cheques/{cheque_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cheque(
    cheque_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Elimina un cheque (soft delete). Solo cheques en cartera."""
    service = TesoreriaService(db)

    try:
        service.delete_cheque(cheque_id, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return None


@router.post("/cheques/{cheque_id}/depositar", response_model=ChequeResponse)
def depositar_cheque(
    cheque_id: UUID,
    data: DepositarChequeRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Marca un cheque como depositado."""
    service = TesoreriaService(db)

    try:
        cheque = service.depositar_cheque(cheque_id, data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return ChequeResponse(**service.enrich_cheque(cheque))


@router.post("/cheques/{cheque_id}/cobrar", response_model=ChequeResponse)
def cobrar_cheque(
    cheque_id: UUID,
    data: CobrarChequeRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Marca un cheque como cobrado."""
    service = TesoreriaService(db)

    try:
        cheque = service.cobrar_cheque(cheque_id, data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return ChequeResponse(**service.enrich_cheque(cheque))


@router.post("/cheques/{cheque_id}/rechazar", response_model=ChequeResponse)
def rechazar_cheque(
    cheque_id: UUID,
    data: RechazarChequeRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Marca un cheque como rechazado."""
    service = TesoreriaService(db)

    try:
        cheque = service.rechazar_cheque(cheque_id, data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return ChequeResponse(**service.enrich_cheque(cheque))


@router.post("/cheques/{cheque_id}/entregar", response_model=ChequeResponse)
def entregar_cheque(
    cheque_id: UUID,
    data: EntregarChequeRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Marca un cheque como entregado a tercero."""
    service = TesoreriaService(db)

    try:
        cheque = service.entregar_cheque(cheque_id, data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return ChequeResponse(**service.enrich_cheque(cheque))


# ==================== MOVIMIENTOS CONSOLIDADOS ====================

@router.get("/movimientos-consolidados")
def list_movimientos_consolidados(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    tipo: Optional[str] = None,
    es_ingreso: Optional[bool] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    buscar: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Lista todos los movimientos financieros consolidados.
    Incluye: cheques, movimientos de tesorería, movimientos bancarios.
    """
    service = TesoreriaService(db)
    resultado = service.get_movimientos_consolidados(
        skip=skip,
        limit=limit,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        tipo=tipo,
        es_ingreso=es_ingreso,
        buscar=buscar,
    )

    return resultado


# ==================== MOVIMIENTOS ====================

@router.get("/movimientos", response_model=PaginatedResponse[MovimientoTesoreriaList])
def list_movimientos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    tipo: Optional[str] = None,
    es_ingreso: Optional[bool] = None,
    metodo_pago: Optional[str] = None,
    cliente_id: Optional[UUID] = None,
    proveedor_id: Optional[UUID] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    buscar: Optional[str] = None,
    incluir_anulados: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista movimientos de tesorería con filtros."""
    service = TesoreriaService(db)
    movimientos, total = service.get_movimientos(
        skip=skip,
        limit=limit,
        tipo=tipo,
        es_ingreso=es_ingreso,
        metodo_pago=metodo_pago,
        cliente_id=cliente_id,
        proveedor_id=proveedor_id,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        buscar=buscar,
        incluir_anulados=incluir_anulados,
    )

    items = [MovimientoTesoreriaList(**service.enrich_movimiento(m)) for m in movimientos]

    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/movimientos/{movimiento_id}", response_model=MovimientoTesoreriaResponse)
def get_movimiento(
    movimiento_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene un movimiento por ID."""
    service = TesoreriaService(db)
    movimiento = service.get_movimiento(movimiento_id)

    if not movimiento:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movimiento no encontrado"
        )

    return MovimientoTesoreriaResponse(**service.enrich_movimiento(movimiento))


@router.post("/movimientos", response_model=MovimientoTesoreriaResponse, status_code=status.HTTP_201_CREATED)
def create_movimiento(
    data: MovimientoTesoreriaCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Crea un nuevo movimiento de tesorería."""
    service = TesoreriaService(db)

    try:
        movimiento = service.create_movimiento(data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return MovimientoTesoreriaResponse(**service.enrich_movimiento(movimiento))


@router.put("/movimientos/{movimiento_id}", response_model=MovimientoTesoreriaResponse)
def update_movimiento(
    movimiento_id: UUID,
    data: MovimientoTesoreriaUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Actualiza un movimiento de tesorería."""
    service = TesoreriaService(db)

    try:
        movimiento = service.update_movimiento(movimiento_id, data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return MovimientoTesoreriaResponse(**service.enrich_movimiento(movimiento))


@router.delete("/movimientos/{movimiento_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_movimiento(
    movimiento_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador")),
):
    """Elimina un movimiento de tesorería (soft delete)."""
    service = TesoreriaService(db)

    try:
        service.delete_movimiento(movimiento_id, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return None


@router.post("/movimientos/{movimiento_id}/anular", response_model=MovimientoTesoreriaResponse)
def anular_movimiento(
    movimiento_id: UUID,
    data: AnularMovimientoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador")),
):
    """Anula un movimiento de tesorería."""
    service = TesoreriaService(db)

    try:
        movimiento = service.anular_movimiento(movimiento_id, data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return MovimientoTesoreriaResponse(**service.enrich_movimiento(movimiento))


# ==================== ENDPOINT UNIFICADO: MOVIMIENTO + CHEQUE ====================

def _uuid_opt(valor: Optional[str], campo: str) -> Optional[UUID]:
    if not valor or valor in ("", "null", "undefined"):
        return None
    try:
        return UUID(valor)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{campo} inválido: debe ser un UUID válido",
        )


def _date_req(valor: str, campo: str) -> date:
    try:
        return date.fromisoformat(valor)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{campo}: fecha inválida. Formato esperado: AAAA-MM-DD",
        )


def _date_opt(valor: Optional[str], campo: str) -> Optional[date]:
    if not valor:
        return None
    return _date_req(valor, campo)


def _decimal_req(valor: str, campo: str) -> Decimal:
    try:
        d = Decimal(str(valor).replace(",", "."))
    except (InvalidOperation, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{campo}: número inválido",
        )
    if d <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{campo} debe ser mayor a cero",
        )
    return d


@router.post(
    "/movimientos-con-cheque",
    response_model=MovimientoTesoreriaResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_movimiento_con_cheque(
    # Datos del movimiento
    tipo: str = Form(..., description="ingreso_cheque | egreso_cheque"),
    concepto: str = Form(..., min_length=3, max_length=200),
    monto: str = Form(...),
    es_ingreso: bool = Form(True),
    fecha_movimiento: str = Form(...),
    notas: Optional[str] = Form(None),
    cliente_id: Optional[str] = Form(None),
    proveedor_id: Optional[str] = Form(None),
    # Datos del cheque
    cheque_numero: str = Form(..., min_length=1, max_length=50),
    cheque_tipo: str = Form("fisico", description="fisico | echeq"),
    cheque_origen: str = Form("recibido_cliente"),
    cheque_banco_origen: Optional[str] = Form(None, max_length=100),
    cheque_fecha_emision: Optional[str] = Form(None),
    cheque_fecha_vencimiento: str = Form(...),
    cheque_librador: Optional[str] = Form(None, max_length=200),
    cheque_cuit_librador: Optional[str] = Form(None, max_length=15),
    # Adjunto opcional
    imagen: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """
    Endpoint unificado que crea un Cheque + un MovimientoTesoreria vinculado
    en una sola operación. Acepta multipart/form-data para poder recibir el
    archivo (imagen o PDF) del cheque.
    """
    # ---- Parseo y validación de tipos ----
    monto_dec = _decimal_req(monto, "Monto")
    fecha_mov = _date_req(fecha_movimiento, "Fecha del movimiento")
    fecha_emi = _date_opt(cheque_fecha_emision, "Fecha de emisión del cheque")
    fecha_venc = _date_req(cheque_fecha_vencimiento, "Fecha de vencimiento del cheque")
    cliente_uuid = _uuid_opt(cliente_id, "cliente_id")
    proveedor_uuid = _uuid_opt(proveedor_id, "proveedor_id")

    # ---- Validaciones de negocio ----
    MIN_ANIO, MAX_ANIO = 2000, 2100
    for etiqueta, f in (
        ("Fecha de emisión del cheque", fecha_emi),
        ("Fecha de vencimiento del cheque", fecha_venc),
    ):
        if f and not (MIN_ANIO <= f.year <= MAX_ANIO):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{etiqueta} inválida: el año debe estar entre {MIN_ANIO} y {MAX_ANIO}",
            )
    if fecha_emi and fecha_venc and fecha_emi > fecha_venc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de emisión del cheque no puede ser posterior a la fecha de vencimiento",
        )

    if cheque_origen == "recibido_cliente" and not cliente_uuid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los cheques recibidos de cliente deben tener un cliente asociado",
        )

    # ---- Guardar imagen (antes de tocar BD) ----
    imagen_url: Optional[str] = None
    if imagen is not None and (imagen.filename or "").strip():
        imagen_url = guardar_archivo_cheque(imagen)

    # ---- Crear Cheque + Movimiento en transacción ----
    service = TesoreriaService(db)
    try:
        cheque, movimiento = service.create_movimiento_con_cheque(
            usuario_id=current_user.id,
            # Movimiento
            tipo=tipo,
            concepto=concepto.strip(),
            monto=monto_dec,
            es_ingreso=es_ingreso,
            fecha_movimiento=fecha_mov,
            notas=notas,
            cliente_id=cliente_uuid,
            proveedor_id=proveedor_uuid,
            # Cheque
            cheque_numero=cheque_numero.strip(),
            cheque_tipo=cheque_tipo,
            cheque_origen=cheque_origen,
            cheque_banco_origen=cheque_banco_origen,
            cheque_fecha_emision=fecha_emi,
            cheque_fecha_vencimiento=fecha_venc,
            cheque_librador=cheque_librador,
            cheque_cuit_librador=cheque_cuit_librador,
            imagen_url=imagen_url,
        )
    except ValueError as e:
        # Si algo falla, borrar la imagen recién guardada para no dejar huérfanos.
        eliminar_archivo(imagen_url)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception:
        eliminar_archivo(imagen_url)
        raise

    return MovimientoTesoreriaResponse(**service.enrich_movimiento(movimiento))


@router.get("/cheques/{cheque_id}/imagen")
def get_imagen_cheque(
    cheque_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Devuelve la imagen o PDF adjunto a un cheque."""
    service = TesoreriaService(db)
    cheque = service.get_cheque(cheque_id)
    if not cheque:
        raise HTTPException(status_code=404, detail="Cheque no encontrado")
    if not cheque.imagen_url:
        raise HTTPException(status_code=404, detail="El cheque no tiene imagen adjunta")

    ruta = abrir_archivo_cheque(cheque.imagen_url)
    return FileResponse(
        path=str(ruta),
        media_type=content_type_por_extension(ruta),
        filename=f"cheque-{cheque.numero}{ruta.suffix}",
    )
