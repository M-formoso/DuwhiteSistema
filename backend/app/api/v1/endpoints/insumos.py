"""
Endpoints de Insumos (Stock).
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_permission
from app.models.usuario import Usuario
from app.schemas.insumo import (
    InsumoCreate,
    InsumoUpdate,
    InsumoResponse,
    InsumoList,
    InsumoAlerta,
    AjusteStockRequest,
)
from app.schemas.movimiento_stock import (
    MovimientoStockResponse,
    MovimientoStockFilter,
    ResumenMovimientos,
)
from app.schemas.common import PaginatedResponse, MessageResponse
from app.services.stock_service import StockService
from app.models.movimiento_stock import TipoMovimiento, OrigenMovimiento

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
def listar_insumos(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    categoria_id: Optional[UUID] = None,
    solo_activos: bool = True,
    solo_stock_bajo: bool = False,
    solo_sin_stock: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista insumos con filtros."""
    service = StockService(db)
    insumos, total = service.get_insumos(
        skip=skip,
        limit=limit,
        search=search,
        categoria_id=categoria_id,
        solo_activos=solo_activos,
        solo_stock_bajo=solo_stock_bajo,
        solo_sin_stock=solo_sin_stock,
    )

    items = []
    for insumo in insumos:
        item = InsumoResponse(
            id=insumo.id,
            codigo=insumo.codigo,
            codigo_barras=insumo.codigo_barras,
            nombre=insumo.nombre,
            categoria_id=insumo.categoria_id,
            subcategoria=insumo.subcategoria,
            unidad=insumo.unidad,
            stock_actual=insumo.stock_actual,
            stock_minimo=insumo.stock_minimo,
            stock_maximo=insumo.stock_maximo,
            precio_unitario_costo=insumo.precio_unitario_costo,
            precio_promedio_ponderado=insumo.precio_promedio_ponderado,
            proveedor_habitual_id=insumo.proveedor_habitual_id,
            ubicacion_deposito=insumo.ubicacion_deposito,
            fecha_vencimiento=insumo.fecha_vencimiento,
            foto=insumo.foto,
            notas=insumo.notas,
            created_at=insumo.created_at,
            updated_at=insumo.updated_at,
            is_active=insumo.activo,
            categoria_nombre=insumo.categoria.nombre if insumo.categoria else None,
            proveedor_nombre=insumo.proveedor_habitual.razon_social if insumo.proveedor_habitual else None,
            stock_bajo=insumo.stock_bajo,
            sin_stock=insumo.sin_stock,
            sobrestock=insumo.sobrestock,
            proximo_a_vencer=insumo.proximo_a_vencer,
            valor_stock=insumo.valor_stock,
        )
        items.append(item)

    return PaginatedResponse(
        items=items,
        total=total,
        page=skip // limit + 1 if limit > 0 else 1,
        size=limit,
        pages=(total + limit - 1) // limit if limit > 0 else 1,
    )


@router.get("/alertas", response_model=List[InsumoAlerta])
def obtener_alertas(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene alertas de stock (bajo, sin stock, vencimiento)."""
    service = StockService(db)
    return service.get_alertas_stock()


@router.get("/lista", response_model=List[InsumoList])
def listar_insumos_dropdown(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista simplificada para dropdowns."""
    service = StockService(db)
    insumos, _ = service.get_insumos(search=search, limit=100)
    return [
        InsumoList(
            id=i.id,
            codigo=i.codigo,
            nombre=i.nombre,
            unidad=i.unidad,
            stock_actual=i.stock_actual,
            stock_minimo=i.stock_minimo,
            stock_bajo=i.stock_bajo,
        )
        for i in insumos
    ]


@router.get("/{insumo_id}", response_model=InsumoResponse)
def obtener_insumo(
    insumo_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene un insumo por ID."""
    service = StockService(db)
    insumo = service.get_insumo(insumo_id)

    if not insumo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insumo no encontrado",
        )

    return InsumoResponse(
        id=insumo.id,
        codigo=insumo.codigo,
        codigo_barras=insumo.codigo_barras,
        nombre=insumo.nombre,
        categoria_id=insumo.categoria_id,
        subcategoria=insumo.subcategoria,
        unidad=insumo.unidad,
        stock_actual=insumo.stock_actual,
        stock_minimo=insumo.stock_minimo,
        stock_maximo=insumo.stock_maximo,
        precio_unitario_costo=insumo.precio_unitario_costo,
        precio_promedio_ponderado=insumo.precio_promedio_ponderado,
        proveedor_habitual_id=insumo.proveedor_habitual_id,
        ubicacion_deposito=insumo.ubicacion_deposito,
        fecha_vencimiento=insumo.fecha_vencimiento,
        foto=insumo.foto,
        notas=insumo.notas,
        created_at=insumo.created_at,
        updated_at=insumo.updated_at,
        is_active=insumo.activo,
        categoria_nombre=insumo.categoria.nombre if insumo.categoria else None,
        proveedor_nombre=insumo.proveedor_habitual.razon_social if insumo.proveedor_habitual else None,
        stock_bajo=insumo.stock_bajo,
        sin_stock=insumo.sin_stock,
        sobrestock=insumo.sobrestock,
        proximo_a_vencer=insumo.proximo_a_vencer,
        valor_stock=insumo.valor_stock,
    )


@router.post("", response_model=InsumoResponse, status_code=status.HTTP_201_CREATED)
def crear_insumo(
    data: InsumoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("stock", "crear")),
):
    """Crea un nuevo insumo."""
    service = StockService(db)

    # Verificar código único
    existing = service.get_insumo_by_codigo(data.codigo)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un insumo con ese código",
        )

    insumo = service.create_insumo(data, current_user.id)

    return InsumoResponse(
        id=insumo.id,
        codigo=insumo.codigo,
        codigo_barras=insumo.codigo_barras,
        nombre=insumo.nombre,
        categoria_id=insumo.categoria_id,
        subcategoria=insumo.subcategoria,
        unidad=insumo.unidad,
        stock_actual=insumo.stock_actual,
        stock_minimo=insumo.stock_minimo,
        stock_maximo=insumo.stock_maximo,
        precio_unitario_costo=insumo.precio_unitario_costo,
        precio_promedio_ponderado=insumo.precio_promedio_ponderado,
        proveedor_habitual_id=insumo.proveedor_habitual_id,
        ubicacion_deposito=insumo.ubicacion_deposito,
        fecha_vencimiento=insumo.fecha_vencimiento,
        foto=insumo.foto,
        notas=insumo.notas,
        created_at=insumo.created_at,
        updated_at=insumo.updated_at,
        is_active=insumo.activo,
        categoria_nombre=None,
        proveedor_nombre=None,
        stock_bajo=insumo.stock_bajo,
        sin_stock=insumo.sin_stock,
        sobrestock=insumo.sobrestock,
        proximo_a_vencer=insumo.proximo_a_vencer,
        valor_stock=insumo.valor_stock,
    )


@router.put("/{insumo_id}", response_model=InsumoResponse)
def actualizar_insumo(
    insumo_id: UUID,
    data: InsumoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("stock", "editar")),
):
    """Actualiza un insumo."""
    service = StockService(db)

    # Verificar código único si se está actualizando
    if data.codigo:
        existing = service.get_insumo_by_codigo(data.codigo)
        if existing and existing.id != insumo_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe un insumo con ese código",
            )

    insumo = service.update_insumo(insumo_id, data, current_user.id)

    if not insumo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insumo no encontrado",
        )

    return InsumoResponse(
        id=insumo.id,
        codigo=insumo.codigo,
        codigo_barras=insumo.codigo_barras,
        nombre=insumo.nombre,
        categoria_id=insumo.categoria_id,
        subcategoria=insumo.subcategoria,
        unidad=insumo.unidad,
        stock_actual=insumo.stock_actual,
        stock_minimo=insumo.stock_minimo,
        stock_maximo=insumo.stock_maximo,
        precio_unitario_costo=insumo.precio_unitario_costo,
        precio_promedio_ponderado=insumo.precio_promedio_ponderado,
        proveedor_habitual_id=insumo.proveedor_habitual_id,
        ubicacion_deposito=insumo.ubicacion_deposito,
        fecha_vencimiento=insumo.fecha_vencimiento,
        foto=insumo.foto,
        notas=insumo.notas,
        created_at=insumo.created_at,
        updated_at=insumo.updated_at,
        is_active=insumo.activo,
        categoria_nombre=insumo.categoria.nombre if insumo.categoria else None,
        proveedor_nombre=insumo.proveedor_habitual.razon_social if insumo.proveedor_habitual else None,
        stock_bajo=insumo.stock_bajo,
        sin_stock=insumo.sin_stock,
        sobrestock=insumo.sobrestock,
        proximo_a_vencer=insumo.proximo_a_vencer,
        valor_stock=insumo.valor_stock,
    )


@router.delete("/{insumo_id}", response_model=MessageResponse)
def eliminar_insumo(
    insumo_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("stock", "eliminar")),
):
    """Elimina (soft delete) un insumo."""
    service = StockService(db)
    success = service.delete_insumo(insumo_id, current_user.id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insumo no encontrado",
        )

    return MessageResponse(message="Insumo eliminado correctamente")


@router.post("/{insumo_id}/ajuste", response_model=MovimientoStockResponse)
def ajustar_stock(
    insumo_id: UUID,
    data: AjusteStockRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("stock", "editar")),
):
    """Realiza un ajuste manual de stock."""
    if data.insumo_id != insumo_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El ID del insumo no coincide",
        )

    service = StockService(db)

    try:
        movimiento = service.ajustar_stock(data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return MovimientoStockResponse(
        id=movimiento.id,
        insumo_id=movimiento.insumo_id,
        tipo=TipoMovimiento(movimiento.tipo),
        origen=OrigenMovimiento(movimiento.origen) if movimiento.origen else None,
        cantidad=movimiento.cantidad,
        stock_anterior=movimiento.stock_anterior,
        stock_posterior=movimiento.stock_posterior,
        precio_unitario=movimiento.precio_unitario,
        costo_total=movimiento.costo_total,
        documento_tipo=movimiento.documento_tipo,
        documento_id=movimiento.documento_id,
        numero_documento=movimiento.numero_documento,
        proveedor_id=movimiento.proveedor_id,
        numero_lote=movimiento.numero_lote,
        fecha_vencimiento_lote=movimiento.fecha_vencimiento_lote,
        notas=movimiento.notas,
        usuario_id=movimiento.usuario_id,
        fecha_movimiento=movimiento.fecha_movimiento,
        created_at=movimiento.created_at,
        insumo_codigo=movimiento.insumo.codigo if movimiento.insumo else None,
        insumo_nombre=movimiento.insumo.nombre if movimiento.insumo else None,
        proveedor_nombre=None,
        usuario_nombre=current_user.nombre_completo,
    )


@router.get("/{insumo_id}/movimientos", response_model=PaginatedResponse)
def listar_movimientos_insumo(
    insumo_id: UUID,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista movimientos de un insumo específico."""
    service = StockService(db)

    # Verificar que el insumo existe
    insumo = service.get_insumo(insumo_id)
    if not insumo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insumo no encontrado",
        )

    filtros = MovimientoStockFilter(insumo_id=insumo_id)
    movimientos, total = service.get_movimientos(filtros, skip=skip, limit=limit)

    items = []
    for mov in movimientos:
        items.append(MovimientoStockResponse(
            id=mov.id,
            insumo_id=mov.insumo_id,
            tipo=TipoMovimiento(mov.tipo),
            origen=OrigenMovimiento(mov.origen) if mov.origen else None,
            cantidad=mov.cantidad,
            stock_anterior=mov.stock_anterior,
            stock_posterior=mov.stock_posterior,
            precio_unitario=mov.precio_unitario,
            costo_total=mov.costo_total,
            documento_tipo=mov.documento_tipo,
            documento_id=mov.documento_id,
            numero_documento=mov.numero_documento,
            proveedor_id=mov.proveedor_id,
            numero_lote=mov.numero_lote,
            fecha_vencimiento_lote=mov.fecha_vencimiento_lote,
            notas=mov.notas,
            usuario_id=mov.usuario_id,
            fecha_movimiento=mov.fecha_movimiento,
            created_at=mov.created_at,
            insumo_codigo=mov.insumo.codigo if mov.insumo else None,
            insumo_nombre=mov.insumo.nombre if mov.insumo else None,
            proveedor_nombre=mov.proveedor.razon_social if mov.proveedor else None,
            usuario_nombre=mov.usuario.nombre_completo if mov.usuario else None,
        ))

    return PaginatedResponse(
        items=items,
        total=total,
        page=skip // limit + 1 if limit > 0 else 1,
        size=limit,
        pages=(total + limit - 1) // limit if limit > 0 else 1,
    )


@router.get("/{insumo_id}/resumen", response_model=ResumenMovimientos)
def obtener_resumen_movimientos(
    insumo_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene resumen de movimientos de un insumo."""
    service = StockService(db)

    # Verificar que el insumo existe
    insumo = service.get_insumo(insumo_id)
    if not insumo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insumo no encontrado",
        )

    return service.get_resumen_movimientos(insumo_id=insumo_id)
