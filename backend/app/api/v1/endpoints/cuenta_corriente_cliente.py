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
    RegistrarAjusteRequest,
    EditarAjusteRequest,
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
    from sqlalchemy import or_, desc, asc, func
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
        func.sum(Cliente.saldo_cuenta_corriente)
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
    from sqlalchemy import func
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
        func.sum(Cliente.saldo_cuenta_corriente)
    ).filter(
        Cliente.activo == True,
        Cliente.saldo_cuenta_corriente > 0
    ).scalar() or Decimal("0")

    # Total facturado este mes
    total_facturado_mes = db.query(
        func.sum(MovimientoCuentaCorriente.monto)
    ).filter(
        MovimientoCuentaCorriente.tipo == TipoMovimientoCC.CARGO.value,
        MovimientoCuentaCorriente.fecha_movimiento >= primer_dia_mes,
    ).scalar() or Decimal("0")

    # Total cobrado este mes
    total_cobrado_mes = db.query(
        func.sum(MovimientoCuentaCorriente.monto)
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


def _cargar_pago_detalle(db: Session, m) -> Optional[dict]:
    """
    Reconstruye la trazabilidad de un pago: MovimientoTesoreria + Cheque +
    CuentaBancaria destino + MovimientoCaja asociado. No hay FK directa desde
    MovimientoCC, así que se matchea por (cliente_id + fecha + monto + medio).
    """
    if m.tipo != "pago":
        return None

    from app.models.tesoreria import MovimientoTesoreria, Cheque
    from app.models.caja import MovimientoCaja, Caja
    from app.models.cuenta_corriente import Recibo

    medio_norm = (m.medio_pago or "").lower()

    mov_tes = (
        db.query(MovimientoTesoreria)
        .filter(
            MovimientoTesoreria.cliente_id == m.cliente_id,
            MovimientoTesoreria.fecha_movimiento == m.fecha_movimiento,
            MovimientoTesoreria.monto == m.monto,
            MovimientoTesoreria.es_ingreso == True,
            MovimientoTesoreria.metodo_pago == medio_norm,
        )
        .order_by(MovimientoTesoreria.created_at.desc())
        .first()
    )

    cheque_info = None
    cuenta_info = None
    caja_info = None
    fecha_valor_iso = None

    if mov_tes:
        fecha_valor_iso = mov_tes.fecha_valor.isoformat() if mov_tes.fecha_valor else None

        if mov_tes.cheque_id:
            ch = db.query(Cheque).filter(Cheque.id == mov_tes.cheque_id).first()
            if ch:
                cheque_info = {
                    "id": str(ch.id),
                    "numero": ch.numero,
                    "tipo": ch.tipo,
                    "estado": ch.estado,
                    "banco_origen": ch.banco_origen,
                    "librador": ch.librador,
                    "cuit_librador": ch.cuit_librador,
                    "fecha_emision": ch.fecha_emision.isoformat() if ch.fecha_emision else None,
                    "fecha_vencimiento": ch.fecha_vencimiento.isoformat() if ch.fecha_vencimiento else None,
                    "monto": float(ch.monto) if ch.monto is not None else None,
                }

        if mov_tes.cuenta_destino_id:
            from app.models.cuenta_bancaria import CuentaBancaria
            cta = db.query(CuentaBancaria).filter(
                CuentaBancaria.id == mov_tes.cuenta_destino_id
            ).first()
            if cta:
                cuenta_info = {
                    "id": str(cta.id),
                    "nombre": cta.nombre or cta.alias,
                    "banco": cta.banco,
                    "numero_cuenta": cta.numero_cuenta,
                    "cbu": cta.cbu,
                }

    # Caja: solo aplica a efectivo; se linkea vía Recibo.id (mov_caja.recibo_id)
    if medio_norm == "efectivo" and m.recibo_numero:
        recibo = db.query(Recibo).filter(Recibo.numero == m.recibo_numero).first()
        if recibo:
            mov_caja = (
                db.query(MovimientoCaja)
                .filter(MovimientoCaja.recibo_id == recibo.id)
                .first()
            )
            if mov_caja:
                caja = db.query(Caja).filter(Caja.id == mov_caja.caja_id).first()
                caja_info = {
                    "movimiento_caja_id": str(mov_caja.id),
                    "caja_id": str(mov_caja.caja_id),
                    "caja_numero": caja.numero if caja else None,
                    "caja_fecha": caja.fecha.isoformat() if caja and caja.fecha else None,
                    "caja_fecha_apertura": (
                        caja.fecha_apertura.isoformat()
                        if caja and caja.fecha_apertura
                        else None
                    ),
                }

    if not (mov_tes or cheque_info or cuenta_info or caja_info):
        return None

    return {
        "movimiento_tesoreria_id": str(mov_tes.id) if mov_tes else None,
        "metodo_pago": medio_norm or None,
        "fecha_valor": fecha_valor_iso,
        "banco_origen": mov_tes.banco_origen if mov_tes else None,
        "numero_transferencia": mov_tes.numero_transferencia if mov_tes else None,
        "cheque": cheque_info,
        "cuenta_destino": cuenta_info,
        "caja": caja_info,
    }


def _cargar_remito_detalle(db: Session, m) -> Optional[dict]:
    """Devuelve el remito (con productos) asociado a un movimiento de cargo.

    Se busca primero por la FK directa `Remito.movimiento_cc_id`; si no hay
    match (movimientos históricos anteriores a esa columna), se cae al
    match por `lote_id` cuando el movimiento lo tenga.
    """
    if m.tipo != "cargo":
        return None

    from sqlalchemy.orm import joinedload
    from app.models.remito import Remito, DetalleRemito

    remito = (
        db.query(Remito)
        .options(joinedload(Remito.detalles).joinedload(DetalleRemito.producto))
        .filter(Remito.movimiento_cc_id == m.id)
        .first()
    )
    if not remito and m.lote_id:
        remito = (
            db.query(Remito)
            .options(joinedload(Remito.detalles).joinedload(DetalleRemito.producto))
            .filter(Remito.lote_id == m.lote_id, Remito.activo.is_(True))
            .order_by(Remito.created_at.desc())
            .first()
        )
    if not remito:
        return None

    detalles = []
    for d in remito.detalles:
        producto = getattr(d, "producto", None)
        detalles.append({
            "id": str(d.id),
            "producto_id": str(d.producto_id) if d.producto_id else None,
            "producto_codigo": getattr(producto, "codigo", None),
            "producto_nombre": getattr(producto, "nombre", None),
            "cantidad": int(d.cantidad) if d.cantidad is not None else 0,
            "precio_unitario": float(d.precio_unitario) if d.precio_unitario is not None else 0.0,
            "subtotal": float(d.subtotal) if d.subtotal is not None else 0.0,
            "descripcion": d.descripcion,
        })

    return {
        "id": str(remito.id),
        "numero": remito.numero,
        "tipo": remito.tipo,
        "estado": remito.estado,
        "fecha_emision": remito.fecha_emision.isoformat() if remito.fecha_emision else None,
        "peso_total_kg": float(remito.peso_total_kg) if remito.peso_total_kg is not None else None,
        "subtotal": float(remito.subtotal) if remito.subtotal is not None else 0.0,
        "descuento": float(remito.descuento) if remito.descuento is not None else 0.0,
        "total": float(remito.total) if remito.total is not None else 0.0,
        "notas": remito.notas,
        "detalles": detalles,
    }


def _serializar_movimiento(m, db: Optional[Session] = None) -> dict:
    """Serializa un MovimientoCuentaCorriente enriquecido con info de factura asociada."""
    factura_info = None
    if m.factura_id and m.factura:
        f = m.factura
        factura_info = {
            "id": str(f.id),
            "numero_completo": f.numero_completo,
            "tipo": f.tipo,
            "letra": f.letra,
            "estado": f.estado,
            "estado_pago": getattr(f, "estado_pago", None),
            "total": float(f.total) if f.total is not None else None,
            "monto_pagado": float(f.monto_pagado) if getattr(f, "monto_pagado", None) is not None else 0.0,
            "fecha_emision": f.fecha_emision.isoformat() if f.fecha_emision else None,
            "fecha_vencimiento_pago": f.fecha_vencimiento_pago.isoformat() if f.fecha_vencimiento_pago else None,
            "cae": f.cae,
        }

    registrado_por_nombre = None
    if getattr(m, "registrado_por", None):
        u = m.registrado_por
        registrado_por_nombre = (
            getattr(u, "nombre_completo", None)
            or getattr(u, "nombre", None)
            or getattr(u, "email", None)
        )

    return {
        "id": str(m.id),
        "tipo": m.tipo,
        "concepto": m.concepto,
        "monto": float(m.monto),
        "fecha_movimiento": m.fecha_movimiento.isoformat(),
        "fecha_vencimiento": m.fecha_vencimiento.isoformat() if m.fecha_vencimiento else None,
        "saldo_anterior": float(m.saldo_anterior),
        "saldo_posterior": float(m.saldo_posterior),
        "factura_id": str(m.factura_id) if m.factura_id else None,
        "factura_numero": m.factura_numero,
        "recibo_numero": m.recibo_numero,
        "medio_pago": m.medio_pago,
        "referencia_pago": m.referencia_pago,
        "estado_facturacion": getattr(m, "estado_facturacion", "sin_facturar"),
        "pedido_id": str(m.pedido_id) if m.pedido_id else None,
        "lote_id": str(m.lote_id) if m.lote_id else None,
        "factura": factura_info,
        "notas": m.notas,
        "registrado_por_nombre": registrado_por_nombre,
        "created_at": m.created_at.isoformat() if getattr(m, "created_at", None) else None,
        "pago_detalle": _cargar_pago_detalle(db, m) if db is not None else None,
        "remito": _cargar_remito_detalle(db, m) if db is not None else None,
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
        MovimientoCuentaCorriente.cliente_id == cliente_id,
        MovimientoCuentaCorriente.activo == True,
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

    items = [_serializar_movimiento(m, db) for m in movimientos]

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{cliente_id}/estado-cuenta")
def obtener_estado_cuenta_cliente(
    cliente_id: str,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene el estado de cuenta completo de un cliente.

    Si se pasan fechas, las cifras (saldo, deuda facturada, sin facturar,
    saldo a favor) se calculan sobre ese rango.
    """
    service = ClienteService(db)

    try:
        return service.get_estado_cuenta(
            cliente_id, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta
        )
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


# ==================== AJUSTE MANUAL ====================

@router.post("/{cliente_id}/ajuste", status_code=status.HTTP_201_CREATED)
def registrar_ajuste_cliente(
    cliente_id: str,
    data: RegistrarAjusteRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """
    Registra un ajuste manual de saldo en la cuenta corriente del cliente.

    Crea un movimiento tipo AJUSTE (débito o crédito) sin tocar movimientos
    anteriores. Mantiene la trazabilidad contable — cualquier corrección
    de un pago/cargo mal cargado se hace con dos ajustes que compensen.
    """
    service = ClienteService(db)

    try:
        movimiento = service.registrar_ajuste(
            cliente_id=cliente_id,
            monto=data.monto,
            direccion=data.direccion,
            concepto=data.concepto,
            fecha=data.fecha,
            usuario_id=str(current_user.id),
            notas=data.notas,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return {
        "id": str(movimiento.id),
        "mensaje": "Ajuste registrado correctamente",
        "saldo_anterior": float(movimiento.saldo_anterior),
        "saldo_posterior": float(movimiento.saldo_posterior),
    }


@router.put("/{cliente_id}/movimientos/{movimiento_id}", status_code=status.HTTP_200_OK)
def editar_movimiento_ajuste(
    cliente_id: str,
    movimiento_id: str,
    data: EditarAjusteRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """
    Edita un movimiento tipo AJUSTE ya cargado.

    Solo AJUSTES son editables. Al cambiar monto/direccion, los saldos
    posteriores del cliente se recalculan automáticamente.
    """
    service = ClienteService(db)

    try:
        movimiento = service.editar_ajuste(
            movimiento_id=movimiento_id,
            monto=data.monto,
            direccion=data.direccion,
            concepto=data.concepto,
            fecha=data.fecha,
            notas=data.notas,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    if str(movimiento.cliente_id) != cliente_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El movimiento no pertenece a este cliente",
        )

    return {
        "id": str(movimiento.id),
        "mensaje": "Movimiento actualizado correctamente",
        "saldo_anterior": float(movimiento.saldo_anterior),
        "saldo_posterior": float(movimiento.saldo_posterior),
    }


@router.delete("/{cliente_id}/movimientos/{movimiento_id}", status_code=status.HTTP_200_OK)
def eliminar_movimiento_ajuste(
    cliente_id: str,
    movimiento_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """
    Elimina un movimiento tipo AJUSTE y recalcula los saldos posteriores
    del cliente. Solo se permiten AJUSTES.
    """
    from app.models.cuenta_corriente import MovimientoCuentaCorriente

    movimiento = db.query(MovimientoCuentaCorriente).filter(
        MovimientoCuentaCorriente.id == movimiento_id
    ).first()

    if not movimiento:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movimiento no encontrado",
        )
    if str(movimiento.cliente_id) != cliente_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El movimiento no pertenece a este cliente",
        )

    service = ClienteService(db)
    try:
        resultado = service.eliminar_ajuste(movimiento_id=movimiento_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return {
        "mensaje": "Movimiento eliminado correctamente",
        "saldo_posterior_cliente": resultado["saldo_posterior_cliente"],
    }


# ==================== ELIMINAR REMITO ====================


class EliminarRemitoRequest(__import__("pydantic").BaseModel):
    motivo: Optional[str] = None


@router.delete("/{cliente_id}/remitos/{remito_id}", status_code=status.HTTP_200_OK)
def eliminar_remito(
    cliente_id: str,
    remito_id: str,
    payload: Optional[EliminarRemitoRequest] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador")),
):
    """
    Elimina (soft delete) un remito de un cliente y revierte su impacto en
    cuenta corriente. Registra el evento en LogActividad para la solapa
    "Eliminados" del módulo Historial de Lavados.
    """
    from uuid import UUID
    from app.models.remito import Remito
    from app.services.remito_service import RemitoService

    remito = db.query(Remito).filter(Remito.id == remito_id).first()
    if not remito:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Remito no encontrado",
        )
    if str(remito.cliente_id) != cliente_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El remito no pertenece a este cliente",
        )

    motivo = payload.motivo if payload else None
    resultado = RemitoService.eliminar(
        db=db,
        remito_id=UUID(remito_id),
        motivo=motivo,
        usuario_id=current_user.id,
    )

    return {
        "mensaje": f"Remito {resultado['numero']} eliminado correctamente",
        **resultado,
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
