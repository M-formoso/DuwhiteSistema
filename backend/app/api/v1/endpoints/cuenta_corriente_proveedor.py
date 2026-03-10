"""
Endpoints de Cuenta Corriente de Proveedores.
"""

from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_permission
from app.models.usuario import Usuario
from app.services.cuenta_corriente_proveedor_service import CuentaCorrienteProveedorService
from app.schemas.cuenta_corriente_proveedor import (
    MovimientoCCProveedorResponse,
    MovimientoCCProveedorList,
    RegistrarCargoProveedorRequest,
    RegistrarPagoProveedorRequest,
    EstadoCuentaProveedorResponse,
    AnalisisVencimientosResponse,
    TIPOS_MOVIMIENTO_CC_PROVEEDOR,
)
from app.schemas.common import PaginatedResponse

router = APIRouter()


# ==================== MOVIMIENTOS ====================

@router.get("/{proveedor_id}/movimientos", response_model=PaginatedResponse)
def listar_movimientos_cc_proveedor(
    proveedor_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    tipo: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista movimientos de cuenta corriente de un proveedor."""
    service = CuentaCorrienteProveedorService(db)

    movimientos, total = service.get_movimientos(
        proveedor_id=proveedor_id,
        skip=skip,
        limit=limit,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        tipo=tipo,
    )

    items = []
    for m in movimientos:
        items.append(MovimientoCCProveedorList(
            id=str(m.id),
            proveedor_id=str(m.proveedor_id),
            tipo=m.tipo,
            concepto=m.concepto,
            monto=m.monto,
            saldo_anterior=m.saldo_anterior,
            saldo_posterior=m.saldo_posterior,
            fecha_movimiento=m.fecha_movimiento,
            factura_numero=m.factura_numero,
            saldo_comprobante=m.saldo_comprobante,
            estado_pago=m.estado_pago,
            created_at=m.created_at,
        ))

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{proveedor_id}/saldo")
def obtener_saldo_proveedor(
    proveedor_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene el saldo actual de cuenta corriente de un proveedor."""
    service = CuentaCorrienteProveedorService(db)
    saldo = service.get_saldo_actual(proveedor_id)
    return {"proveedor_id": proveedor_id, "saldo": saldo}


@router.get("/{proveedor_id}/comprobantes-pendientes")
def obtener_comprobantes_pendientes(
    proveedor_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene comprobantes pendientes de pago de un proveedor."""
    service = CuentaCorrienteProveedorService(db)
    comprobantes = service.get_comprobantes_pendientes(proveedor_id)

    return [
        {
            "id": str(c.id),
            "tipo": c.tipo,
            "factura_numero": c.factura_numero,
            "concepto": c.concepto,
            "fecha_movimiento": c.fecha_movimiento.isoformat() if c.fecha_movimiento else None,
            "fecha_vencimiento": c.fecha_vencimiento.isoformat() if c.fecha_vencimiento else None,
            "monto": float(c.monto),
            "saldo_comprobante": float(c.saldo_comprobante),
            "estado_pago": c.estado_pago,
        }
        for c in comprobantes
    ]


# ==================== REGISTRAR MOVIMIENTOS ====================

@router.post("/{proveedor_id}/cargo", status_code=status.HTTP_201_CREATED)
def registrar_cargo(
    proveedor_id: str,
    data: RegistrarCargoProveedorRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Registra un cargo (deuda) en cuenta corriente del proveedor."""
    service = CuentaCorrienteProveedorService(db)

    try:
        movimiento = service.registrar_cargo(
            proveedor_id=proveedor_id,
            monto=data.monto,
            concepto=data.concepto,
            factura_numero=data.factura_numero,
            fecha_factura=data.fecha_factura,
            fecha_vencimiento=data.fecha_vencimiento,
            fecha_movimiento=data.fecha_movimiento,
            usuario_id=str(current_user.id),
            recepcion_compra_id=data.recepcion_compra_id,
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


@router.post("/{proveedor_id}/pago", status_code=status.HTTP_201_CREATED)
def registrar_pago(
    proveedor_id: str,
    data: RegistrarPagoProveedorRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "contador")),
):
    """Registra un pago en cuenta corriente del proveedor."""
    service = CuentaCorrienteProveedorService(db)

    try:
        movimiento = service.registrar_pago(
            proveedor_id=proveedor_id,
            monto=data.monto,
            concepto=data.concepto,
            fecha_movimiento=data.fecha_movimiento,
            usuario_id=str(current_user.id),
            orden_pago_id=data.orden_pago_id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return {
        "id": str(movimiento.id),
        "mensaje": "Pago registrado correctamente",
        "saldo_posterior": float(movimiento.saldo_posterior),
    }


# ==================== ESTADO DE CUENTA ====================

@router.get("/{proveedor_id}/estado-cuenta", response_model=EstadoCuentaProveedorResponse)
def obtener_estado_cuenta(
    proveedor_id: str,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene el estado de cuenta completo de un proveedor."""
    service = CuentaCorrienteProveedorService(db)

    try:
        estado = service.get_estado_cuenta(
            proveedor_id=proveedor_id,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return estado


# ==================== ANÁLISIS DE VENCIMIENTOS ====================

@router.get("/analisis-vencimientos", response_model=AnalisisVencimientosResponse)
def obtener_analisis_vencimientos(
    proveedor_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene análisis de vencimientos (aging) de proveedores."""
    service = CuentaCorrienteProveedorService(db)
    return service.get_analisis_vencimientos(proveedor_id=proveedor_id)


# ==================== CONSTANTES ====================

@router.get("/tipos-movimiento")
def obtener_tipos_movimiento():
    """Obtiene los tipos de movimiento de cuenta corriente proveedor."""
    return TIPOS_MOVIMIENTO_CC_PROVEEDOR
