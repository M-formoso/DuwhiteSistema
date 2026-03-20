"""
Endpoints de Cuenta Corriente de Clientes.
"""

from datetime import date
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_permission
from app.models.usuario import Usuario
from app.services.cliente_service import ClienteService
from app.schemas.cuenta_corriente import (
    MovimientoCCList,
    RegistrarPagoRequest,
    RegistrarCobranzaRequest,
    EstadoCuentaResponse,
    TIPOS_MOVIMIENTO_CC,
    MEDIOS_PAGO,
    ESTADOS_FACTURACION,
)
from app.schemas.common import PaginatedResponse

router = APIRouter()


# ==================== LISTADO GENERAL ====================

@router.get("/clientes-con-deuda")
def listar_clientes_con_deuda(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    buscar: Optional[str] = None,
    orden: str = Query("saldo_desc", regex="^(saldo_desc|saldo_asc|nombre|antiguedad)$"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista todos los clientes con deuda pendiente."""
    from sqlalchemy import or_, desc, asc
    from app.models.cliente import Cliente
    from app.models.cuenta_corriente import MovimientoCuentaCorriente, TipoMovimientoCC

    query = db.query(Cliente).filter(
        Cliente.activo == True,
        Cliente.saldo_cuenta_corriente > 0
    )

    if buscar:
        search = f"%{buscar}%"
        query = query.filter(
            or_(
                Cliente.codigo.ilike(search),
                Cliente.razon_social.ilike(search),
                Cliente.nombre_fantasia.ilike(search),
                Cliente.cuit.ilike(search),
            )
        )

    # Ordenamiento
    if orden == "saldo_desc":
        query = query.order_by(desc(Cliente.saldo_cuenta_corriente))
    elif orden == "saldo_asc":
        query = query.order_by(asc(Cliente.saldo_cuenta_corriente))
    elif orden == "nombre":
        query = query.order_by(asc(Cliente.razon_social))

    total = query.count()
    clientes = query.offset(skip).limit(limit).all()

    # Calcular totales
    total_deuda = db.query(
        db.func.sum(Cliente.saldo_cuenta_corriente)
    ).filter(
        Cliente.activo == True,
        Cliente.saldo_cuenta_corriente > 0
    ).scalar() or Decimal("0")

    items = []
    for c in clientes:
        # Buscar último movimiento
        ultimo_mov = db.query(MovimientoCuentaCorriente).filter(
            MovimientoCuentaCorriente.cliente_id == str(c.id),
            MovimientoCuentaCorriente.tipo == TipoMovimientoCC.CARGO.value
        ).order_by(MovimientoCuentaCorriente.fecha_movimiento.desc()).first()

        dias_antiguedad = None
        if ultimo_mov:
            dias_antiguedad = (date.today() - ultimo_mov.fecha_movimiento).days

        items.append({
            "id": str(c.id),
            "codigo": c.codigo,
            "razon_social": c.razon_social,
            "nombre_fantasia": c.nombre_fantasia,
            "cuit": c.cuit,
            "telefono": c.telefono,
            "email": c.email,
            "saldo": float(c.saldo_cuenta_corriente),
            "limite_credito": float(c.limite_credito) if c.limite_credito else None,
            "dias_antiguedad": dias_antiguedad,
        })

    return {
        "items": items,
        "total": total,
        "total_deuda": float(total_deuda),
        "skip": skip,
        "limit": limit,
    }


@router.get("/resumen")
def obtener_resumen_cuentas_corrientes(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene resumen general de cuentas corrientes de clientes."""
    from app.models.cliente import Cliente
    from app.models.cuenta_corriente import MovimientoCuentaCorriente, TipoMovimientoCC

    hoy = date.today()
    primer_dia_mes = hoy.replace(day=1)

    # Total clientes con deuda
    clientes_con_deuda = db.query(Cliente).filter(
        Cliente.activo == True,
        Cliente.saldo_cuenta_corriente > 0
    ).count()

    # Total deuda
    total_deuda = db.query(
        db.func.sum(Cliente.saldo_cuenta_corriente)
    ).filter(
        Cliente.activo == True,
        Cliente.saldo_cuenta_corriente > 0
    ).scalar() or Decimal("0")

    # Total facturado este mes
    total_facturado_mes = db.query(
        db.func.sum(MovimientoCuentaCorriente.monto)
    ).filter(
        MovimientoCuentaCorriente.tipo == TipoMovimientoCC.CARGO.value,
        MovimientoCuentaCorriente.fecha_movimiento >= primer_dia_mes,
    ).scalar() or Decimal("0")

    # Total cobrado este mes
    total_cobrado_mes = db.query(
        db.func.sum(MovimientoCuentaCorriente.monto)
    ).filter(
        MovimientoCuentaCorriente.tipo == TipoMovimientoCC.PAGO.value,
        MovimientoCuentaCorriente.fecha_movimiento >= primer_dia_mes,
    ).scalar() or Decimal("0")

    # Promedio de días de cobranza (simplificado)
    promedio_dias = 0

    return {
        "clientes_con_deuda": clientes_con_deuda,
        "total_deuda": float(total_deuda),
        "total_facturado_mes": float(total_facturado_mes),
        "total_cobrado_mes": float(total_cobrado_mes),
        "promedio_dias_cobranza": promedio_dias,
    }


# ==================== MOVIMIENTOS POR CLIENTE ====================

@router.get("/{cliente_id}/movimientos", response_model=PaginatedResponse)
def listar_movimientos_cliente(
    cliente_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    tipo: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista movimientos de cuenta corriente de un cliente."""
    service = ClienteService(db)

    # Verificar que el cliente existe
    cliente = service.get_cliente(cliente_id)
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )

    from app.models.cuenta_corriente import MovimientoCuentaCorriente

    query = db.query(MovimientoCuentaCorriente).filter(
        MovimientoCuentaCorriente.cliente_id == cliente_id
    )

    if fecha_desde:
        query = query.filter(MovimientoCuentaCorriente.fecha_movimiento >= fecha_desde)

    if fecha_hasta:
        query = query.filter(MovimientoCuentaCorriente.fecha_movimiento <= fecha_hasta)

    if tipo:
        query = query.filter(MovimientoCuentaCorriente.tipo == tipo)

    total = query.count()
    movimientos = query.order_by(
        MovimientoCuentaCorriente.created_at.desc()
    ).offset(skip).limit(limit).all()

    items = []
    for m in movimientos:
        items.append({
            "id": str(m.id),
            "tipo": m.tipo,
            "concepto": m.concepto,
            "monto": float(m.monto),
            "fecha_movimiento": m.fecha_movimiento.isoformat(),
            "saldo_anterior": float(m.saldo_anterior),
            "saldo_posterior": float(m.saldo_posterior),
            "factura_numero": m.factura_numero,
            "recibo_numero": m.recibo_numero,
            "medio_pago": m.medio_pago,
            "referencia_pago": m.referencia_pago,
            "estado_facturacion": getattr(m, 'estado_facturacion', 'sin_facturar'),
            "pedido_id": str(m.pedido_id) if m.pedido_id else None,
            "lote_id": str(m.lote_id) if m.lote_id else None,
        })

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{cliente_id}/estado-cuenta")
def obtener_estado_cuenta_cliente(
    cliente_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene el estado de cuenta completo de un cliente."""
    service = ClienteService(db)

    try:
        return service.get_estado_cuenta(cliente_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# ==================== REGISTRAR MOVIMIENTOS ====================

@router.post("/{cliente_id}/cargo", status_code=status.HTTP_201_CREATED)
def registrar_cargo_cliente(
    cliente_id: str,
    monto: Decimal,
    concepto: str,
    factura_numero: Optional[str] = None,
    fecha_vencimiento: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador", "comercial")),
):
    """Registra un cargo (factura/deuda) en cuenta corriente del cliente."""
    service = ClienteService(db)

    try:
        movimiento = service.registrar_cargo(
            cliente_id=cliente_id,
            monto=monto,
            concepto=concepto,
            usuario_id=str(current_user.id),
            factura_numero=factura_numero,
            fecha_vencimiento=fecha_vencimiento,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return {
        "id": str(movimiento.id),
        "mensaje": "Cargo registrado correctamente",
        "saldo_posterior": float(movimiento.saldo_posterior),
    }


@router.post("/{cliente_id}/pago", status_code=status.HTTP_201_CREATED)
def registrar_pago_cliente(
    cliente_id: str,
    data: RegistrarPagoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador", "comercial")),
):
    """Registra un pago en cuenta corriente del cliente."""
    service = ClienteService(db)

    # Asegurar que el cliente_id del path coincida con el del body
    data.cliente_id = cliente_id

    try:
        recibo, movimiento = service.registrar_pago(data, str(current_user.id))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return {
        "id": str(movimiento.id),
        "recibo_numero": recibo.numero,
        "mensaje": "Pago registrado correctamente",
        "saldo_posterior": float(movimiento.saldo_posterior),
    }


# ==================== CONSTANTES ====================

@router.get("/tipos-movimiento")
def obtener_tipos_movimiento():
    """Obtiene los tipos de movimiento de cuenta corriente."""
    return TIPOS_MOVIMIENTO_CC


@router.get("/medios-pago")
def obtener_medios_pago():
    """Obtiene los medios de pago disponibles."""
    return MEDIOS_PAGO


@router.get("/estados-facturacion")
def obtener_estados_facturacion():
    """Obtiene los estados de facturación disponibles."""
    return ESTADOS_FACTURACION


# ==================== COBRANZA COMPLETA ====================

@router.post("/{cliente_id}/cobranza", status_code=status.HTTP_201_CREATED)
def registrar_cobranza(
    cliente_id: str,
    data: RegistrarCobranzaRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador", "comercial")),
):
    """
    Registra una cobranza/ingreso de un cliente.

    Permite:
    - Cobrar sin asociar a pedido/lote (ingreso libre)
    - Asociar a un pedido específico
    - Asociar a un lote de producción
    - Marcar estado de facturación (sin facturar, factura A, B, ticket)
    """
    service = ClienteService(db)

    # Verificar cliente
    cliente = service.get_cliente(cliente_id)
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )

    # Verificar pedido si se especificó
    pedido = None
    if data.pedido_id:
        pedido = service.get_pedido(data.pedido_id)
        if not pedido:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pedido no encontrado",
            )
        if str(pedido.cliente_id) != cliente_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El pedido no pertenece a este cliente",
            )

    # Verificar lote si se especificó
    lote = None
    if data.lote_id:
        from app.models.produccion import Lote
        lote = db.query(Lote).filter(Lote.id == data.lote_id).first()
        if not lote:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lote no encontrado",
            )

    # Generar concepto si no se proveyó
    concepto = data.concepto
    if not concepto:
        if pedido:
            concepto = f"Cobro pedido {pedido.numero}"
        elif lote:
            concepto = f"Cobro lote {lote.numero}"
        else:
            concepto = f"Cobro - {data.medio_pago}"

    # Agregar estado de facturación al concepto si está facturado
    if data.estado_facturacion != "sin_facturar":
        estado_label = next(
            (e["label"] for e in ESTADOS_FACTURACION if e["value"] == data.estado_facturacion),
            data.estado_facturacion
        )
        if data.factura_numero:
            concepto = f"{concepto} ({estado_label} {data.factura_numero})"
        else:
            concepto = f"{concepto} ({estado_label})"

    # Crear el pago usando RegistrarPagoRequest
    pago_data = RegistrarPagoRequest(
        cliente_id=cliente_id,
        monto=data.monto,
        fecha=data.fecha,
        medio_pago=data.medio_pago,
        referencia_pago=data.referencia_pago,
        notas=data.notas,
        pedido_id=data.pedido_id,
        lote_id=data.lote_id,
        estado_facturacion=data.estado_facturacion,
        factura_numero=data.factura_numero,
    )

    try:
        recibo, movimiento = service.registrar_pago(pago_data, str(current_user.id))

        # Actualizar el concepto del movimiento
        movimiento.concepto = concepto
        db.commit()

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return {
        "id": str(movimiento.id),
        "recibo_numero": recibo.numero,
        "mensaje": "Cobranza registrada correctamente",
        "saldo_anterior": float(movimiento.saldo_anterior),
        "saldo_posterior": float(movimiento.saldo_posterior),
        "estado_facturacion": data.estado_facturacion,
        "pedido_numero": pedido.numero if pedido else None,
        "lote_numero": lote.numero if lote else None,
    }


# ==================== PEDIDOS Y LOTES PARA ASOCIAR ====================

@router.get("/{cliente_id}/pedidos-pendientes")
def obtener_pedidos_pendientes(
    cliente_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene pedidos del cliente que tienen saldo pendiente o están sin facturar."""
    from app.models.pedido import Pedido

    pedidos = db.query(Pedido).filter(
        Pedido.cliente_id == cliente_id,
        Pedido.activo == True,
        Pedido.saldo_pendiente > 0,
    ).order_by(Pedido.fecha_pedido.desc()).limit(50).all()

    return [
        {
            "id": str(p.id),
            "numero": p.numero,
            "fecha": p.fecha_pedido.isoformat(),
            "total": float(p.total),
            "saldo_pendiente": float(p.saldo_pendiente),
            "estado": p.estado,
        }
        for p in pedidos
    ]


@router.get("/{cliente_id}/lotes")
def obtener_lotes_cliente(
    cliente_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene lotes de producción asociados al cliente."""
    from app.models.produccion import Lote

    lotes = db.query(Lote).filter(
        Lote.cliente_id == cliente_id,
        Lote.activo == True,
    ).order_by(Lote.fecha_ingreso.desc()).limit(50).all()

    return [
        {
            "id": str(l.id),
            "numero": l.numero,
            "fecha_ingreso": l.fecha_ingreso.isoformat() if l.fecha_ingreso else None,
            "estado": l.estado,
            "descripcion": l.descripcion,
        }
        for l in lotes
    ]
