"""
Endpoints de Productos de Lavado.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_permission
from app.models.usuario import Usuario
from app.schemas.producto_lavado import (
    ProductoLavadoCreate,
    ProductoLavadoUpdate,
    ProductoLavadoResponse,
    ProductoLavadoListResponse,
    PrecioProductoLavadoCreate,
    PrecioProductoLavadoResponse,
    CATEGORIAS_PRODUCTO_LAVADO,
)
from app.services.producto_lavado_service import ProductoLavadoService


router = APIRouter()


# ==================== PRODUCTOS ====================

@router.get("", response_model=List[ProductoLavadoListResponse])
def listar_productos(
    categoria: Optional[str] = Query(None, description="Filtrar por categoría"),
    search: Optional[str] = Query(None, description="Buscar por código o nombre"),
    solo_activos: bool = Query(True, description="Solo productos activos"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador", "comercial"))
):
    """Lista todos los productos de lavado."""
    productos = ProductoLavadoService.get_all(
        db,
        categoria=categoria,
        solo_activos=solo_activos,
        search=search
    )

    return [
        ProductoLavadoListResponse(
            id=p.id,
            codigo=p.codigo,
            nombre=p.nombre,
            categoria=p.categoria,
            peso_promedio_kg=p.peso_promedio_kg,
            activo=p.activo
        )
        for p in productos
    ]


@router.get("/categorias")
def obtener_categorias():
    """Obtiene las categorías disponibles de productos."""
    return CATEGORIAS_PRODUCTO_LAVADO


@router.get("/con-precios")
def obtener_productos_con_precios(
    lista_precios_id: UUID = Query(..., description="ID de la lista de precios"),
    categoria: Optional[str] = Query(None, description="Filtrar por categoría"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador", "comercial"))
):
    """
    Obtiene todos los productos con sus precios para una lista de precios.
    Útil para el formulario de conteo y finalización.
    """
    return ProductoLavadoService.get_productos_con_precios(db, lista_precios_id, categoria)


@router.get("/{producto_id}", response_model=ProductoLavadoResponse)
def obtener_producto(
    producto_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador", "comercial"))
):
    """Obtiene un producto por ID."""
    from fastapi import HTTPException, status

    producto = ProductoLavadoService.get_by_id(db, producto_id)
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado"
        )

    return ProductoLavadoResponse(
        id=producto.id,
        codigo=producto.codigo,
        nombre=producto.nombre,
        descripcion=producto.descripcion,
        categoria=producto.categoria,
        peso_promedio_kg=producto.peso_promedio_kg,
        activo=producto.activo
    )


@router.post("", response_model=ProductoLavadoResponse)
def crear_producto(
    data: ProductoLavadoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion"))
):
    """Crea un nuevo producto de lavado."""
    producto = ProductoLavadoService.create(db, data, current_user.id)

    return ProductoLavadoResponse(
        id=producto.id,
        codigo=producto.codigo,
        nombre=producto.nombre,
        descripcion=producto.descripcion,
        categoria=producto.categoria,
        peso_promedio_kg=producto.peso_promedio_kg,
        activo=producto.activo
    )


@router.put("/{producto_id}", response_model=ProductoLavadoResponse)
def actualizar_producto(
    producto_id: UUID,
    data: ProductoLavadoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion"))
):
    """Actualiza un producto de lavado."""
    producto = ProductoLavadoService.update(db, producto_id, data, current_user.id)

    return ProductoLavadoResponse(
        id=producto.id,
        codigo=producto.codigo,
        nombre=producto.nombre,
        descripcion=producto.descripcion,
        categoria=producto.categoria,
        peso_promedio_kg=producto.peso_promedio_kg,
        activo=producto.activo
    )


@router.delete("/{producto_id}")
def eliminar_producto(
    producto_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador"))
):
    """Desactiva un producto de lavado (soft delete)."""
    ProductoLavadoService.delete(db, producto_id, current_user.id)
    return {"mensaje": "Producto desactivado correctamente"}


# ==================== PRECIOS ====================

@router.get("/precios/lista/{lista_precios_id}", response_model=List[PrecioProductoLavadoResponse])
def obtener_precios_lista(
    lista_precios_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "comercial"))
):
    """Obtiene los precios de productos para una lista de precios."""
    precios = ProductoLavadoService.get_precios_lista(db, lista_precios_id)

    return [
        PrecioProductoLavadoResponse(
            id=p.id,
            lista_precios_id=p.lista_precios_id,
            producto_id=p.producto_id,
            producto_codigo=p.producto.codigo if p.producto else None,
            producto_nombre=p.producto.nombre if p.producto else None,
            precio_unitario=p.precio_unitario,
            activo=p.activo
        )
        for p in precios
    ]


@router.post("/precios", response_model=PrecioProductoLavadoResponse)
def establecer_precio(
    data: PrecioProductoLavadoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador"))
):
    """Establece o actualiza el precio de un producto en una lista."""
    precio = ProductoLavadoService.set_precio(db, data, current_user.id)

    return PrecioProductoLavadoResponse(
        id=precio.id,
        lista_precios_id=precio.lista_precios_id,
        producto_id=precio.producto_id,
        producto_codigo=precio.producto.codigo if precio.producto else None,
        producto_nombre=precio.producto.nombre if precio.producto else None,
        precio_unitario=precio.precio_unitario,
        activo=precio.activo
    )


@router.get("/precios/{lista_precios_id}/{producto_id}")
def obtener_precio_producto(
    lista_precios_id: UUID,
    producto_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion", "operador", "comercial"))
):
    """Obtiene el precio de un producto específico en una lista."""
    precio = ProductoLavadoService.get_precio_producto(db, lista_precios_id, producto_id)

    if not precio:
        return {"precio_unitario": None, "tiene_precio": False}

    return {
        "precio_unitario": float(precio.precio_unitario),
        "tiene_precio": True
    }
