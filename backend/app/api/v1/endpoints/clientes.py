"""
Endpoints de Clientes.
"""

from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.usuario import Usuario
from app.services.cliente_service import ClienteService
from app.schemas.cliente import (
    ClienteCreate,
    ClienteUpdate,
    ClienteResponse,
    ClienteList,
    ClienteSelect,
    TIPOS_CLIENTE,
    CONDICIONES_IVA,
)
from app.schemas.base import PaginatedResponse

router = APIRouter()


# ==================== CLIENTES ====================

@router.get("", response_model=PaginatedResponse[ClienteList])
def listar_clientes(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    tipo: Optional[str] = None,
    activo: Optional[bool] = None,
    con_deuda: Optional[bool] = None,
    buscar: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista clientes con filtros y paginación."""
    service = ClienteService(db)
    clientes, total = service.get_clientes(
        skip=skip,
        limit=limit,
        tipo=tipo,
        activo=activo,
        con_deuda=con_deuda,
        buscar=buscar,
    )

    return {
        "items": [
            ClienteList(
                id=str(c.id),
                codigo=c.codigo,
                tipo=c.tipo,
                razon_social=c.razon_social,
                nombre_fantasia=c.nombre_fantasia,
                cuit=c.cuit,
                email=c.email,
                telefono=c.telefono,
                ciudad=c.ciudad,
                saldo_cuenta_corriente=c.saldo_cuenta_corriente,
                activo=c.activo,
                tiene_deuda=c.tiene_deuda,
            )
            for c in clientes
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/lista", response_model=List[ClienteSelect])
def listar_clientes_select(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista simplificada de clientes para selectores."""
    service = ClienteService(db)
    return service.get_clientes_lista()


@router.get("/tipos")
def obtener_tipos_cliente():
    """Obtiene los tipos de cliente disponibles."""
    return TIPOS_CLIENTE


@router.get("/condiciones-iva")
def obtener_condiciones_iva():
    """Obtiene las condiciones de IVA disponibles."""
    return CONDICIONES_IVA


@router.get("/{cliente_id}", response_model=ClienteResponse)
def obtener_cliente(
    cliente_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene un cliente por ID."""
    service = ClienteService(db)
    cliente = service.get_cliente(cliente_id)

    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )

    return ClienteResponse(
        id=str(cliente.id),
        codigo=cliente.codigo,
        tipo=cliente.tipo,
        razon_social=cliente.razon_social,
        nombre_fantasia=cliente.nombre_fantasia,
        cuit=cliente.cuit,
        condicion_iva=cliente.condicion_iva,
        email=cliente.email,
        telefono=cliente.telefono,
        celular=cliente.celular,
        contacto_nombre=cliente.contacto_nombre,
        contacto_cargo=cliente.contacto_cargo,
        direccion=cliente.direccion,
        ciudad=cliente.ciudad,
        provincia=cliente.provincia,
        codigo_postal=cliente.codigo_postal,
        lista_precios_id=str(cliente.lista_precios_id) if cliente.lista_precios_id else None,
        descuento_general=cliente.descuento_general,
        limite_credito=cliente.limite_credito,
        dias_credito=cliente.dias_credito,
        saldo_cuenta_corriente=cliente.saldo_cuenta_corriente,
        dia_retiro_preferido=cliente.dia_retiro_preferido,
        horario_retiro_preferido=cliente.horario_retiro_preferido,
        requiere_factura=cliente.requiere_factura,
        enviar_notificaciones=cliente.enviar_notificaciones,
        fecha_alta=cliente.fecha_alta,
        fecha_ultima_compra=cliente.fecha_ultima_compra,
        notas=cliente.notas,
        notas_internas=cliente.notas_internas,
        activo=cliente.activo,
        created_at=cliente.created_at,
        updated_at=cliente.updated_at,
        nombre_display=cliente.nombre_display,
        tiene_deuda=cliente.tiene_deuda,
        supera_limite_credito=cliente.supera_limite_credito,
    )


@router.post("", response_model=ClienteResponse, status_code=status.HTTP_201_CREATED)
def crear_cliente(
    data: ClienteCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Crea un nuevo cliente."""
    service = ClienteService(db)

    # Verificar CUIT único
    if data.cuit:
        existente = service.get_cliente_by_cuit(data.cuit)
        if existente:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe un cliente con ese CUIT",
            )

    cliente = service.create_cliente(data)

    return ClienteResponse(
        id=str(cliente.id),
        codigo=cliente.codigo,
        tipo=cliente.tipo,
        razon_social=cliente.razon_social,
        nombre_fantasia=cliente.nombre_fantasia,
        cuit=cliente.cuit,
        condicion_iva=cliente.condicion_iva,
        email=cliente.email,
        telefono=cliente.telefono,
        celular=cliente.celular,
        contacto_nombre=cliente.contacto_nombre,
        contacto_cargo=cliente.contacto_cargo,
        direccion=cliente.direccion,
        ciudad=cliente.ciudad,
        provincia=cliente.provincia,
        codigo_postal=cliente.codigo_postal,
        lista_precios_id=None,
        descuento_general=cliente.descuento_general,
        limite_credito=cliente.limite_credito,
        dias_credito=cliente.dias_credito,
        saldo_cuenta_corriente=cliente.saldo_cuenta_corriente,
        dia_retiro_preferido=cliente.dia_retiro_preferido,
        horario_retiro_preferido=cliente.horario_retiro_preferido,
        requiere_factura=cliente.requiere_factura,
        enviar_notificaciones=cliente.enviar_notificaciones,
        fecha_alta=cliente.fecha_alta,
        fecha_ultima_compra=cliente.fecha_ultima_compra,
        notas=cliente.notas,
        notas_internas=cliente.notas_internas,
        activo=cliente.activo,
        created_at=cliente.created_at,
        updated_at=cliente.updated_at,
        nombre_display=cliente.nombre_display,
        tiene_deuda=cliente.tiene_deuda,
        supera_limite_credito=cliente.supera_limite_credito,
    )


@router.put("/{cliente_id}", response_model=ClienteResponse)
def actualizar_cliente(
    cliente_id: str,
    data: ClienteUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Actualiza un cliente."""
    service = ClienteService(db)

    # Verificar CUIT único si se está actualizando
    if data.cuit:
        existente = service.get_cliente_by_cuit(data.cuit)
        if existente and str(existente.id) != cliente_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe otro cliente con ese CUIT",
            )

    cliente = service.update_cliente(cliente_id, data)

    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )

    return ClienteResponse(
        id=str(cliente.id),
        codigo=cliente.codigo,
        tipo=cliente.tipo,
        razon_social=cliente.razon_social,
        nombre_fantasia=cliente.nombre_fantasia,
        cuit=cliente.cuit,
        condicion_iva=cliente.condicion_iva,
        email=cliente.email,
        telefono=cliente.telefono,
        celular=cliente.celular,
        contacto_nombre=cliente.contacto_nombre,
        contacto_cargo=cliente.contacto_cargo,
        direccion=cliente.direccion,
        ciudad=cliente.ciudad,
        provincia=cliente.provincia,
        codigo_postal=cliente.codigo_postal,
        lista_precios_id=str(cliente.lista_precios_id) if cliente.lista_precios_id else None,
        descuento_general=cliente.descuento_general,
        limite_credito=cliente.limite_credito,
        dias_credito=cliente.dias_credito,
        saldo_cuenta_corriente=cliente.saldo_cuenta_corriente,
        dia_retiro_preferido=cliente.dia_retiro_preferido,
        horario_retiro_preferido=cliente.horario_retiro_preferido,
        requiere_factura=cliente.requiere_factura,
        enviar_notificaciones=cliente.enviar_notificaciones,
        fecha_alta=cliente.fecha_alta,
        fecha_ultima_compra=cliente.fecha_ultima_compra,
        notas=cliente.notas,
        notas_internas=cliente.notas_internas,
        activo=cliente.activo,
        created_at=cliente.created_at,
        updated_at=cliente.updated_at,
        nombre_display=cliente.nombre_display,
        tiene_deuda=cliente.tiene_deuda,
        supera_limite_credito=cliente.supera_limite_credito,
    )


@router.delete("/{cliente_id}")
def desactivar_cliente(
    cliente_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Desactiva un cliente (soft delete)."""
    service = ClienteService(db)
    cliente = service.get_cliente(cliente_id)

    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )

    # Verificar si tiene deuda
    if cliente.tiene_deuda:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede desactivar un cliente con deuda pendiente",
        )

    from app.schemas.cliente import ClienteUpdate

    service.update_cliente(cliente_id, ClienteUpdate(activo=False))

    return {"message": "Cliente desactivado correctamente"}


# ==================== CUENTA CORRIENTE ====================

@router.get("/{cliente_id}/cuenta-corriente")
def obtener_estado_cuenta(
    cliente_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene el estado de cuenta corriente de un cliente."""
    service = ClienteService(db)

    try:
        return service.get_estado_cuenta(cliente_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/{cliente_id}/movimientos")
def listar_movimientos_cuenta(
    cliente_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
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

    movimientos, total = service.get_movimientos_cuenta(
        cliente_id=cliente_id,
        skip=skip,
        limit=limit,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )

    return {
        "items": [
            {
                "id": str(m.id),
                "tipo": m.tipo,
                "concepto": m.concepto,
                "monto": m.monto,
                "fecha_movimiento": m.fecha_movimiento,
                "saldo_anterior": m.saldo_anterior,
                "saldo_posterior": m.saldo_posterior,
                "factura_numero": m.factura_numero,
                "recibo_numero": m.recibo_numero,
                "medio_pago": m.medio_pago,
                "referencia_pago": m.referencia_pago,
            }
            for m in movimientos
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("/{cliente_id}/pagos")
def registrar_pago(
    cliente_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Registra un pago de un cliente."""
    from app.schemas.cuenta_corriente import RegistrarPagoRequest

    service = ClienteService(db)

    # Verificar que el cliente existe
    cliente = service.get_cliente(cliente_id)
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )

    try:
        pago_data = RegistrarPagoRequest(
            cliente_id=cliente_id,
            monto=data.get("monto"),
            fecha=data.get("fecha"),
            medio_pago=data.get("medio_pago"),
            referencia_pago=data.get("referencia_pago"),
            notas=data.get("notas"),
            aplicar_a_pedidos=data.get("aplicar_a_pedidos"),
        )

        recibo, movimiento = service.registrar_pago(pago_data, str(current_user.id))

        return {
            "recibo_numero": recibo.numero,
            "monto": recibo.monto_total,
            "saldo_anterior": movimiento.saldo_anterior,
            "saldo_posterior": movimiento.saldo_posterior,
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
