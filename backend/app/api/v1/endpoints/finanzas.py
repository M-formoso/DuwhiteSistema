"""
Endpoints de Finanzas (Caja, Movimientos, Cuentas Bancarias).
"""

from datetime import date, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.usuario import Usuario
from app.services.finanzas_service import FinanzasService
from app.schemas.finanzas import (
    AbrirCajaRequest,
    CerrarCajaRequest,
    CajaResponse,
    CajaList,
    MovimientoCajaCreate,
    MovimientoCajaResponse,
    AnularMovimientoRequest,
    CuentaBancariaCreate,
    CuentaBancariaUpdate,
    CuentaBancariaResponse,
    MovimientoBancarioCreate,
    MovimientoBancarioResponse,
    ResumenFinanciero,
    CATEGORIAS_INGRESO,
    CATEGORIAS_EGRESO,
    TIPOS_CUENTA_BANCARIA,
    TIPOS_MOVIMIENTO_BANCO,
)
from app.schemas.base import PaginatedResponse

router = APIRouter()


# ==================== CAJA ====================

@router.get("/caja/actual", response_model=Optional[CajaResponse])
def obtener_caja_actual(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene la caja abierta actual."""
    service = FinanzasService(db)
    caja = service.get_caja_actual()

    if not caja:
        return None

    return CajaResponse(
        id=str(caja.id),
        numero=caja.numero,
        fecha=caja.fecha,
        estado=caja.estado,
        saldo_inicial=caja.saldo_inicial,
        total_ingresos=caja.total_ingresos,
        total_egresos=caja.total_egresos,
        saldo_final=caja.saldo_final,
        saldo_real=caja.saldo_real,
        diferencia=caja.diferencia,
        abierta_por_id=str(caja.abierta_por_id),
        fecha_apertura=caja.fecha_apertura,
        cerrada_por_id=str(caja.cerrada_por_id) if caja.cerrada_por_id else None,
        fecha_cierre=caja.fecha_cierre,
        observaciones_apertura=caja.observaciones_apertura,
        observaciones_cierre=caja.observaciones_cierre,
        created_at=caja.created_at,
        saldo_calculado=caja.saldo_calculado,
        abierta_por_nombre=caja.abierta_por.nombre_completo if caja.abierta_por else None,
        cerrada_por_nombre=caja.cerrada_por.nombre_completo if caja.cerrada_por else None,
    )


@router.get("/cajas", response_model=PaginatedResponse[CajaList])
def listar_cajas(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    estado: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista cajas con filtros y paginación."""
    service = FinanzasService(db)
    cajas, total = service.get_cajas(
        skip=skip,
        limit=limit,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        estado=estado,
    )

    return {
        "items": [
            CajaList(
                id=str(c.id),
                numero=c.numero,
                fecha=c.fecha,
                estado=c.estado,
                saldo_inicial=c.saldo_inicial,
                total_ingresos=c.total_ingresos,
                total_egresos=c.total_egresos,
                saldo_final=c.saldo_final,
                diferencia=c.diferencia,
            )
            for c in cajas
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("/caja/abrir", response_model=CajaResponse, status_code=status.HTTP_201_CREATED)
def abrir_caja(
    data: AbrirCajaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Abre una nueva caja."""
    service = FinanzasService(db)

    try:
        caja = service.abrir_caja(data, str(current_user.id))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return CajaResponse(
        id=str(caja.id),
        numero=caja.numero,
        fecha=caja.fecha,
        estado=caja.estado,
        saldo_inicial=caja.saldo_inicial,
        total_ingresos=caja.total_ingresos,
        total_egresos=caja.total_egresos,
        saldo_final=caja.saldo_final,
        saldo_real=caja.saldo_real,
        diferencia=caja.diferencia,
        abierta_por_id=str(caja.abierta_por_id),
        fecha_apertura=caja.fecha_apertura,
        cerrada_por_id=None,
        fecha_cierre=None,
        observaciones_apertura=caja.observaciones_apertura,
        observaciones_cierre=None,
        created_at=caja.created_at,
        saldo_calculado=caja.saldo_calculado,
        abierta_por_nombre=current_user.nombre_completo,
        cerrada_por_nombre=None,
    )


@router.post("/caja/{caja_id}/cerrar", response_model=CajaResponse)
def cerrar_caja(
    caja_id: str,
    data: CerrarCajaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Cierra una caja."""
    service = FinanzasService(db)

    try:
        caja = service.cerrar_caja(caja_id, data, str(current_user.id))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return CajaResponse(
        id=str(caja.id),
        numero=caja.numero,
        fecha=caja.fecha,
        estado=caja.estado,
        saldo_inicial=caja.saldo_inicial,
        total_ingresos=caja.total_ingresos,
        total_egresos=caja.total_egresos,
        saldo_final=caja.saldo_final,
        saldo_real=caja.saldo_real,
        diferencia=caja.diferencia,
        abierta_por_id=str(caja.abierta_por_id),
        fecha_apertura=caja.fecha_apertura,
        cerrada_por_id=str(caja.cerrada_por_id),
        fecha_cierre=caja.fecha_cierre,
        observaciones_apertura=caja.observaciones_apertura,
        observaciones_cierre=caja.observaciones_cierre,
        created_at=caja.created_at,
        saldo_calculado=caja.saldo_calculado,
        abierta_por_nombre=caja.abierta_por.nombre_completo if caja.abierta_por else None,
        cerrada_por_nombre=current_user.nombre_completo,
    )


# ==================== MOVIMIENTOS CAJA ====================

@router.get("/caja/movimientos", response_model=PaginatedResponse[MovimientoCajaResponse])
def listar_movimientos_caja(
    caja_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    tipo: Optional[str] = None,
    categoria: Optional[str] = None,
    incluir_anulados: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista movimientos de caja."""
    service = FinanzasService(db)

    # Si no se especifica caja, usar la actual
    if not caja_id:
        caja_actual = service.get_caja_actual()
        if caja_actual:
            caja_id = str(caja_actual.id)

    movimientos, total = service.get_movimientos_caja(
        caja_id=caja_id,
        skip=skip,
        limit=limit,
        tipo=tipo,
        categoria=categoria,
        incluir_anulados=incluir_anulados,
    )

    return {
        "items": [
            MovimientoCajaResponse(
                id=str(m.id),
                caja_id=str(m.caja_id),
                tipo=m.tipo,
                categoria=m.categoria,
                concepto=m.concepto,
                descripcion=m.descripcion,
                monto=m.monto,
                medio_pago=m.medio_pago,
                referencia=m.referencia,
                cliente_id=str(m.cliente_id) if m.cliente_id else None,
                proveedor_id=str(m.proveedor_id) if m.proveedor_id else None,
                pedido_id=str(m.pedido_id) if m.pedido_id else None,
                recibo_id=str(m.recibo_id) if m.recibo_id else None,
                registrado_por_id=str(m.registrado_por_id),
                anulado=m.anulado,
                fecha_anulacion=m.fecha_anulacion,
                motivo_anulacion=m.motivo_anulacion,
                created_at=m.created_at,
                cliente_nombre=m.cliente.nombre_display if m.cliente else None,
                proveedor_nombre=m.proveedor.razon_social if m.proveedor else None,
                registrado_por_nombre=m.registrado_por.nombre_completo if m.registrado_por else None,
            )
            for m in movimientos
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("/caja/movimientos", response_model=MovimientoCajaResponse, status_code=status.HTTP_201_CREATED)
def registrar_movimiento_caja(
    data: MovimientoCajaCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Registra un movimiento de caja."""
    service = FinanzasService(db)

    try:
        movimiento = service.registrar_movimiento_caja(data, str(current_user.id))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return MovimientoCajaResponse(
        id=str(movimiento.id),
        caja_id=str(movimiento.caja_id),
        tipo=movimiento.tipo,
        categoria=movimiento.categoria,
        concepto=movimiento.concepto,
        descripcion=movimiento.descripcion,
        monto=movimiento.monto,
        medio_pago=movimiento.medio_pago,
        referencia=movimiento.referencia,
        cliente_id=str(movimiento.cliente_id) if movimiento.cliente_id else None,
        proveedor_id=str(movimiento.proveedor_id) if movimiento.proveedor_id else None,
        pedido_id=str(movimiento.pedido_id) if movimiento.pedido_id else None,
        recibo_id=str(movimiento.recibo_id) if movimiento.recibo_id else None,
        registrado_por_id=str(movimiento.registrado_por_id),
        anulado=movimiento.anulado,
        fecha_anulacion=None,
        motivo_anulacion=None,
        created_at=movimiento.created_at,
        cliente_nombre=movimiento.cliente.nombre_display if movimiento.cliente else None,
        proveedor_nombre=movimiento.proveedor.razon_social if movimiento.proveedor else None,
        registrado_por_nombre=current_user.nombre_completo,
    )


@router.post("/caja/movimientos/{movimiento_id}/anular")
def anular_movimiento_caja(
    movimiento_id: str,
    data: AnularMovimientoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Anula un movimiento de caja."""
    service = FinanzasService(db)

    try:
        movimiento = service.anular_movimiento_caja(
            movimiento_id, data.motivo, str(current_user.id)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return {"message": "Movimiento anulado correctamente"}


@router.get("/caja/categorias")
def obtener_categorias():
    """Obtiene las categorías de movimientos."""
    return {
        "ingresos": CATEGORIAS_INGRESO,
        "egresos": CATEGORIAS_EGRESO,
    }


# ==================== CUENTAS BANCARIAS ====================

@router.get("/bancos/cuentas", response_model=List[CuentaBancariaResponse])
def listar_cuentas_bancarias(
    solo_activas: bool = True,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista cuentas bancarias."""
    service = FinanzasService(db)
    cuentas = service.get_cuentas_bancarias(solo_activas=solo_activas)

    return [
        CuentaBancariaResponse(
            id=str(c.id),
            nombre=c.nombre,
            banco=c.banco,
            tipo_cuenta=c.tipo_cuenta,
            numero_cuenta=c.numero_cuenta,
            cbu=c.cbu,
            alias=c.alias,
            titular=c.titular,
            cuit_titular=c.cuit_titular,
            saldo_actual=c.saldo_actual,
            saldo_disponible=c.saldo_disponible,
            activa=c.activa,
            es_principal=c.es_principal,
            notas=c.notas,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in cuentas
    ]


@router.post("/bancos/cuentas", response_model=CuentaBancariaResponse, status_code=status.HTTP_201_CREATED)
def crear_cuenta_bancaria(
    data: CuentaBancariaCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Crea una cuenta bancaria."""
    service = FinanzasService(db)
    cuenta = service.create_cuenta_bancaria(data)

    return CuentaBancariaResponse(
        id=str(cuenta.id),
        nombre=cuenta.nombre,
        banco=cuenta.banco,
        tipo_cuenta=cuenta.tipo_cuenta,
        numero_cuenta=cuenta.numero_cuenta,
        cbu=cuenta.cbu,
        alias=cuenta.alias,
        titular=cuenta.titular,
        cuit_titular=cuenta.cuit_titular,
        saldo_actual=cuenta.saldo_actual,
        saldo_disponible=cuenta.saldo_disponible,
        activa=cuenta.activa,
        es_principal=cuenta.es_principal,
        notas=cuenta.notas,
        created_at=cuenta.created_at,
        updated_at=cuenta.updated_at,
    )


@router.get("/bancos/cuentas/{cuenta_id}/movimientos")
def listar_movimientos_bancarios(
    cuenta_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista movimientos bancarios de una cuenta."""
    service = FinanzasService(db)
    movimientos, total = service.get_movimientos_bancarios(
        cuenta_id=cuenta_id,
        skip=skip,
        limit=limit,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )

    return {
        "items": [
            MovimientoBancarioResponse(
                id=str(m.id),
                cuenta_id=str(m.cuenta_id),
                tipo=m.tipo,
                concepto=m.concepto,
                descripcion=m.descripcion,
                monto=m.monto,
                saldo_anterior=m.saldo_anterior,
                saldo_posterior=m.saldo_posterior,
                fecha_movimiento=m.fecha_movimiento,
                fecha_valor=m.fecha_valor,
                numero_comprobante=m.numero_comprobante,
                referencia_externa=m.referencia_externa,
                cliente_id=str(m.cliente_id) if m.cliente_id else None,
                proveedor_id=str(m.proveedor_id) if m.proveedor_id else None,
                conciliado=m.conciliado,
                fecha_conciliacion=m.fecha_conciliacion,
                registrado_por_id=str(m.registrado_por_id),
                created_at=m.created_at,
                cuenta_nombre=m.cuenta.nombre if m.cuenta else None,
                cliente_nombre=m.cliente.nombre_display if m.cliente else None,
                proveedor_nombre=m.proveedor.razon_social if m.proveedor else None,
            )
            for m in movimientos
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("/bancos/movimientos", response_model=MovimientoBancarioResponse, status_code=status.HTTP_201_CREATED)
def registrar_movimiento_bancario(
    data: MovimientoBancarioCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Registra un movimiento bancario."""
    service = FinanzasService(db)

    try:
        movimiento = service.registrar_movimiento_bancario(data, str(current_user.id))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return MovimientoBancarioResponse(
        id=str(movimiento.id),
        cuenta_id=str(movimiento.cuenta_id),
        tipo=movimiento.tipo,
        concepto=movimiento.concepto,
        descripcion=movimiento.descripcion,
        monto=movimiento.monto,
        saldo_anterior=movimiento.saldo_anterior,
        saldo_posterior=movimiento.saldo_posterior,
        fecha_movimiento=movimiento.fecha_movimiento,
        fecha_valor=movimiento.fecha_valor,
        numero_comprobante=movimiento.numero_comprobante,
        referencia_externa=movimiento.referencia_externa,
        cliente_id=str(movimiento.cliente_id) if movimiento.cliente_id else None,
        proveedor_id=str(movimiento.proveedor_id) if movimiento.proveedor_id else None,
        conciliado=movimiento.conciliado,
        fecha_conciliacion=movimiento.fecha_conciliacion,
        registrado_por_id=str(movimiento.registrado_por_id),
        created_at=movimiento.created_at,
        cuenta_nombre=movimiento.cuenta.nombre if movimiento.cuenta else None,
        cliente_nombre=movimiento.cliente.nombre_display if movimiento.cliente else None,
        proveedor_nombre=movimiento.proveedor.razon_social if movimiento.proveedor else None,
    )


@router.get("/bancos/tipos-cuenta")
def obtener_tipos_cuenta():
    """Obtiene los tipos de cuenta bancaria."""
    return TIPOS_CUENTA_BANCARIA


@router.get("/bancos/tipos-movimiento")
def obtener_tipos_movimiento_banco():
    """Obtiene los tipos de movimiento bancario."""
    return TIPOS_MOVIMIENTO_BANCO


# ==================== RESUMEN FINANCIERO ====================

@router.get("/resumen")
def obtener_resumen_financiero(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene resumen financiero del período."""
    service = FinanzasService(db)

    # Por defecto, último mes
    if not fecha_hasta:
        fecha_hasta = date.today()
    if not fecha_desde:
        fecha_desde = fecha_hasta - timedelta(days=30)

    return service.get_resumen_financiero(fecha_desde, fecha_hasta)
