"""
Endpoints de Proveedores.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_permission
from app.models.usuario import Usuario
from app.schemas.proveedor import (
    ProveedorCreate,
    ProveedorUpdate,
    ProveedorResponse,
    ProveedorList,
)
from app.schemas.producto_proveedor import (
    ProductoProveedorCreate,
    ProductoProveedorUpdate,
    ProductoProveedorResponse,
    ActualizarPrecioRequest,
)
from app.schemas.common import PaginatedResponse, MessageResponse
from app.services.proveedor_service import ProveedorService

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
def listar_proveedores(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    rubro: Optional[str] = None,
    solo_activos: bool = True,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista proveedores con filtros."""
    service = ProveedorService(db)
    proveedores, total = service.get_proveedores(
        skip=skip,
        limit=limit,
        search=search,
        rubro=rubro,
        solo_activos=solo_activos,
    )

    items = []
    for prov in proveedores:
        items.append(ProveedorResponse(
            id=prov.id,
            razon_social=prov.razon_social,
            nombre_fantasia=prov.nombre_fantasia,
            cuit=prov.cuit,
            direccion=prov.direccion,
            ciudad=prov.ciudad,
            provincia=prov.provincia,
            codigo_postal=prov.codigo_postal,
            telefono=prov.telefono,
            email=prov.email,
            sitio_web=prov.sitio_web,
            contacto_nombre=prov.contacto_nombre,
            contacto_telefono=prov.contacto_telefono,
            contacto_email=prov.contacto_email,
            condicion_pago=prov.condicion_pago,
            dias_entrega_estimados=prov.dias_entrega_estimados,
            descuento_habitual=prov.descuento_habitual,
            rubro=prov.rubro,
            activo=prov.activo,
            notas=prov.notas,
            created_at=prov.created_at,
            updated_at=prov.updated_at,
            is_active=prov.is_active,
            nombre_display=prov.nombre_display,
            cuit_formateado=prov.cuit_formateado,
            cantidad_productos=prov.productos.count() if prov.productos else 0,
            cantidad_ordenes=prov.ordenes_compra.count() if prov.ordenes_compra else 0,
        ))

    return PaginatedResponse(
        items=items,
        total=total,
        page=skip // limit + 1 if limit > 0 else 1,
        size=limit,
        pages=(total + limit - 1) // limit if limit > 0 else 1,
    )


@router.get("/lista", response_model=List[ProveedorList])
def listar_proveedores_dropdown(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista simplificada para dropdowns."""
    service = ProveedorService(db)
    proveedores, _ = service.get_proveedores(search=search, limit=100)
    return [
        ProveedorList(
            id=p.id,
            razon_social=p.razon_social,
            nombre_fantasia=p.nombre_fantasia,
            cuit=p.cuit,
        )
        for p in proveedores
    ]


@router.get("/{proveedor_id}", response_model=ProveedorResponse)
def obtener_proveedor(
    proveedor_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene un proveedor por ID."""
    service = ProveedorService(db)
    proveedor = service.get_proveedor(proveedor_id)

    if not proveedor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proveedor no encontrado",
        )

    return ProveedorResponse(
        id=proveedor.id,
        razon_social=proveedor.razon_social,
        nombre_fantasia=proveedor.nombre_fantasia,
        cuit=proveedor.cuit,
        direccion=proveedor.direccion,
        ciudad=proveedor.ciudad,
        provincia=proveedor.provincia,
        codigo_postal=proveedor.codigo_postal,
        telefono=proveedor.telefono,
        email=proveedor.email,
        sitio_web=proveedor.sitio_web,
        contacto_nombre=proveedor.contacto_nombre,
        contacto_telefono=proveedor.contacto_telefono,
        contacto_email=proveedor.contacto_email,
        condicion_pago=proveedor.condicion_pago,
        dias_entrega_estimados=proveedor.dias_entrega_estimados,
        descuento_habitual=proveedor.descuento_habitual,
        rubro=proveedor.rubro,
        activo=proveedor.activo,
        notas=proveedor.notas,
        created_at=proveedor.created_at,
        updated_at=proveedor.updated_at,
        is_active=proveedor.is_active,
        nombre_display=proveedor.nombre_display,
        cuit_formateado=proveedor.cuit_formateado,
        cantidad_productos=proveedor.productos.count() if proveedor.productos else 0,
        cantidad_ordenes=proveedor.ordenes_compra.count() if proveedor.ordenes_compra else 0,
    )


@router.post("", response_model=ProveedorResponse, status_code=status.HTTP_201_CREATED)
def crear_proveedor(
    data: ProveedorCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("proveedores", "crear")),
):
    """Crea un nuevo proveedor."""
    service = ProveedorService(db)

    # Verificar CUIT único
    existing = service.get_proveedor_by_cuit(data.cuit)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un proveedor con ese CUIT",
        )

    proveedor = service.create_proveedor(data, current_user.id)

    return ProveedorResponse(
        id=proveedor.id,
        razon_social=proveedor.razon_social,
        nombre_fantasia=proveedor.nombre_fantasia,
        cuit=proveedor.cuit,
        direccion=proveedor.direccion,
        ciudad=proveedor.ciudad,
        provincia=proveedor.provincia,
        codigo_postal=proveedor.codigo_postal,
        telefono=proveedor.telefono,
        email=proveedor.email,
        sitio_web=proveedor.sitio_web,
        contacto_nombre=proveedor.contacto_nombre,
        contacto_telefono=proveedor.contacto_telefono,
        contacto_email=proveedor.contacto_email,
        condicion_pago=proveedor.condicion_pago,
        dias_entrega_estimados=proveedor.dias_entrega_estimados,
        descuento_habitual=proveedor.descuento_habitual,
        rubro=proveedor.rubro,
        activo=proveedor.activo,
        notas=proveedor.notas,
        created_at=proveedor.created_at,
        updated_at=proveedor.updated_at,
        is_active=proveedor.is_active,
        nombre_display=proveedor.nombre_display,
        cuit_formateado=proveedor.cuit_formateado,
        cantidad_productos=0,
        cantidad_ordenes=0,
    )


@router.put("/{proveedor_id}", response_model=ProveedorResponse)
def actualizar_proveedor(
    proveedor_id: UUID,
    data: ProveedorUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("proveedores", "editar")),
):
    """Actualiza un proveedor."""
    service = ProveedorService(db)

    # Verificar CUIT único si se está actualizando
    if data.cuit:
        existing = service.get_proveedor_by_cuit(data.cuit)
        if existing and existing.id != proveedor_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe un proveedor con ese CUIT",
            )

    proveedor = service.update_proveedor(proveedor_id, data, current_user.id)

    if not proveedor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proveedor no encontrado",
        )

    return ProveedorResponse(
        id=proveedor.id,
        razon_social=proveedor.razon_social,
        nombre_fantasia=proveedor.nombre_fantasia,
        cuit=proveedor.cuit,
        direccion=proveedor.direccion,
        ciudad=proveedor.ciudad,
        provincia=proveedor.provincia,
        codigo_postal=proveedor.codigo_postal,
        telefono=proveedor.telefono,
        email=proveedor.email,
        sitio_web=proveedor.sitio_web,
        contacto_nombre=proveedor.contacto_nombre,
        contacto_telefono=proveedor.contacto_telefono,
        contacto_email=proveedor.contacto_email,
        condicion_pago=proveedor.condicion_pago,
        dias_entrega_estimados=proveedor.dias_entrega_estimados,
        descuento_habitual=proveedor.descuento_habitual,
        rubro=proveedor.rubro,
        activo=proveedor.activo,
        notas=proveedor.notas,
        created_at=proveedor.created_at,
        updated_at=proveedor.updated_at,
        is_active=proveedor.is_active,
        nombre_display=proveedor.nombre_display,
        cuit_formateado=proveedor.cuit_formateado,
        cantidad_productos=proveedor.productos.count() if proveedor.productos else 0,
        cantidad_ordenes=proveedor.ordenes_compra.count() if proveedor.ordenes_compra else 0,
    )


@router.delete("/{proveedor_id}", response_model=MessageResponse)
def eliminar_proveedor(
    proveedor_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("proveedores", "eliminar")),
):
    """Elimina (soft delete) un proveedor."""
    service = ProveedorService(db)
    success = service.delete_proveedor(proveedor_id, current_user.id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proveedor no encontrado",
        )

    return MessageResponse(message="Proveedor eliminado correctamente")


# ==================== PRODUCTOS DE PROVEEDOR ====================

@router.get("/{proveedor_id}/productos", response_model=PaginatedResponse)
def listar_productos_proveedor(
    proveedor_id: UUID,
    skip: int = 0,
    limit: int = 50,
    solo_activos: bool = True,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista productos de un proveedor."""
    service = ProveedorService(db)
    productos, total = service.get_productos_proveedor(
        proveedor_id=proveedor_id,
        solo_activos=solo_activos,
        skip=skip,
        limit=limit,
    )

    items = []
    for prod in productos:
        items.append(ProductoProveedorResponse(
            id=prod.id,
            proveedor_id=prod.proveedor_id,
            insumo_id=prod.insumo_id,
            codigo_proveedor=prod.codigo_proveedor,
            nombre_proveedor=prod.nombre_proveedor,
            precio_unitario=prod.precio_unitario,
            moneda=prod.moneda,
            precio_con_iva=prod.precio_con_iva,
            unidad_compra=prod.unidad_compra,
            factor_conversion=prod.factor_conversion,
            cantidad_minima=prod.cantidad_minima,
            fecha_precio=prod.fecha_precio,
            fecha_vencimiento_precio=prod.fecha_vencimiento_precio,
            activo=prod.activo,
            es_preferido=prod.es_preferido,
            notas=prod.notas,
            created_at=prod.created_at,
            updated_at=prod.updated_at,
            proveedor_nombre=prod.proveedor.razon_social if prod.proveedor else None,
            insumo_codigo=prod.insumo.codigo if prod.insumo else None,
            insumo_nombre=prod.insumo.nombre if prod.insumo else None,
            precio_vigente=prod.precio_vigente,
            precio_sin_iva=prod.precio_sin_iva,
            precio_por_unidad_stock=prod.precio_por_unidad_stock,
        ))

    return PaginatedResponse(
        items=items,
        total=total,
        page=skip // limit + 1 if limit > 0 else 1,
        size=limit,
        pages=(total + limit - 1) // limit if limit > 0 else 1,
    )


@router.post("/{proveedor_id}/productos", response_model=ProductoProveedorResponse, status_code=status.HTTP_201_CREATED)
def crear_producto_proveedor(
    proveedor_id: UUID,
    data: ProductoProveedorCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("proveedores", "editar")),
):
    """Agrega un producto al catálogo del proveedor."""
    if data.proveedor_id != proveedor_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El ID del proveedor no coincide",
        )

    service = ProveedorService(db)
    producto = service.create_producto_proveedor(data, current_user.id)

    return ProductoProveedorResponse(
        id=producto.id,
        proveedor_id=producto.proveedor_id,
        insumo_id=producto.insumo_id,
        codigo_proveedor=producto.codigo_proveedor,
        nombre_proveedor=producto.nombre_proveedor,
        precio_unitario=producto.precio_unitario,
        moneda=producto.moneda,
        precio_con_iva=producto.precio_con_iva,
        unidad_compra=producto.unidad_compra,
        factor_conversion=producto.factor_conversion,
        cantidad_minima=producto.cantidad_minima,
        fecha_precio=producto.fecha_precio,
        fecha_vencimiento_precio=producto.fecha_vencimiento_precio,
        activo=producto.activo,
        es_preferido=producto.es_preferido,
        notas=producto.notas,
        created_at=producto.created_at,
        updated_at=producto.updated_at,
        proveedor_nombre=None,
        insumo_codigo=None,
        insumo_nombre=None,
        precio_vigente=producto.precio_vigente,
        precio_sin_iva=producto.precio_sin_iva,
        precio_por_unidad_stock=producto.precio_por_unidad_stock,
    )


@router.put("/productos/{producto_id}", response_model=ProductoProveedorResponse)
def actualizar_producto_proveedor(
    producto_id: UUID,
    data: ProductoProveedorUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("proveedores", "editar")),
):
    """Actualiza un producto del catálogo del proveedor."""
    service = ProveedorService(db)
    producto = service.update_producto_proveedor(producto_id, data, current_user.id)

    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado",
        )

    return ProductoProveedorResponse(
        id=producto.id,
        proveedor_id=producto.proveedor_id,
        insumo_id=producto.insumo_id,
        codigo_proveedor=producto.codigo_proveedor,
        nombre_proveedor=producto.nombre_proveedor,
        precio_unitario=producto.precio_unitario,
        moneda=producto.moneda,
        precio_con_iva=producto.precio_con_iva,
        unidad_compra=producto.unidad_compra,
        factor_conversion=producto.factor_conversion,
        cantidad_minima=producto.cantidad_minima,
        fecha_precio=producto.fecha_precio,
        fecha_vencimiento_precio=producto.fecha_vencimiento_precio,
        activo=producto.activo,
        es_preferido=producto.es_preferido,
        notas=producto.notas,
        created_at=producto.created_at,
        updated_at=producto.updated_at,
        proveedor_nombre=producto.proveedor.razon_social if producto.proveedor else None,
        insumo_codigo=producto.insumo.codigo if producto.insumo else None,
        insumo_nombre=producto.insumo.nombre if producto.insumo else None,
        precio_vigente=producto.precio_vigente,
        precio_sin_iva=producto.precio_sin_iva,
        precio_por_unidad_stock=producto.precio_por_unidad_stock,
    )


@router.post("/productos/{producto_id}/precio", response_model=ProductoProveedorResponse)
def actualizar_precio_producto(
    producto_id: UUID,
    data: ActualizarPrecioRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("proveedores", "editar")),
):
    """Actualiza el precio de un producto (registra en historial)."""
    service = ProveedorService(db)
    producto = service.actualizar_precio(producto_id, data, current_user.id)

    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado",
        )

    return ProductoProveedorResponse(
        id=producto.id,
        proveedor_id=producto.proveedor_id,
        insumo_id=producto.insumo_id,
        codigo_proveedor=producto.codigo_proveedor,
        nombre_proveedor=producto.nombre_proveedor,
        precio_unitario=producto.precio_unitario,
        moneda=producto.moneda,
        precio_con_iva=producto.precio_con_iva,
        unidad_compra=producto.unidad_compra,
        factor_conversion=producto.factor_conversion,
        cantidad_minima=producto.cantidad_minima,
        fecha_precio=producto.fecha_precio,
        fecha_vencimiento_precio=producto.fecha_vencimiento_precio,
        activo=producto.activo,
        es_preferido=producto.es_preferido,
        notas=producto.notas,
        created_at=producto.created_at,
        updated_at=producto.updated_at,
        proveedor_nombre=producto.proveedor.razon_social if producto.proveedor else None,
        insumo_codigo=producto.insumo.codigo if producto.insumo else None,
        insumo_nombre=producto.insumo.nombre if producto.insumo else None,
        precio_vigente=producto.precio_vigente,
        precio_sin_iva=producto.precio_sin_iva,
        precio_por_unidad_stock=producto.precio_por_unidad_stock,
    )
