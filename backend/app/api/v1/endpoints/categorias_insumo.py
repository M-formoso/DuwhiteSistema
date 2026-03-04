"""
Endpoints de Categorías de Insumo.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, require_permission
from app.models.usuario import Usuario
from app.schemas.categoria_insumo import (
    CategoriaInsumoCreate,
    CategoriaInsumoUpdate,
    CategoriaInsumoResponse,
    CategoriaInsumoList,
)
from app.schemas.common import PaginatedResponse, MessageResponse
from app.services.stock_service import StockService

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
def listar_categorias(
    skip: int = 0,
    limit: int = 100,
    solo_activas: bool = True,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista todas las categorías de insumos."""
    service = StockService(db)
    categorias, total = service.get_categorias(
        skip=skip,
        limit=limit,
        solo_activas=solo_activas,
    )

    items = []
    for cat in categorias:
        item = CategoriaInsumoResponse(
            id=cat.id,
            nombre=cat.nombre,
            descripcion=cat.descripcion,
            orden=cat.orden,
            activo=cat.activo,
            created_at=cat.created_at,
            updated_at=cat.updated_at,
            cantidad_insumos=cat.insumos.count() if cat.insumos else 0,
        )
        items.append(item)

    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/lista", response_model=List[CategoriaInsumoList])
def listar_categorias_dropdown(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista simplificada para dropdowns."""
    service = StockService(db)
    categorias, _ = service.get_categorias(solo_activas=True)
    return [CategoriaInsumoList(id=c.id, nombre=c.nombre) for c in categorias]


@router.get("/{categoria_id}", response_model=CategoriaInsumoResponse)
def obtener_categoria(
    categoria_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene una categoría por ID."""
    service = StockService(db)
    categoria = service.get_categoria(categoria_id)

    if not categoria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada",
        )

    return CategoriaInsumoResponse(
        id=categoria.id,
        nombre=categoria.nombre,
        descripcion=categoria.descripcion,
        orden=categoria.orden,
        activo=categoria.activo,
        created_at=categoria.created_at,
        updated_at=categoria.updated_at,
        cantidad_insumos=categoria.insumos.count() if categoria.insumos else 0,
    )


@router.post("", response_model=CategoriaInsumoResponse, status_code=status.HTTP_201_CREATED)
def crear_categoria(
    data: CategoriaInsumoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion")),
):
    """Crea una nueva categoría de insumo."""
    service = StockService(db)
    categoria = service.create_categoria(data, current_user.id)

    return CategoriaInsumoResponse(
        id=categoria.id,
        nombre=categoria.nombre,
        descripcion=categoria.descripcion,
        orden=categoria.orden,
        activo=categoria.activo,
        created_at=categoria.created_at,
        updated_at=categoria.updated_at,
        cantidad_insumos=0,
    )


@router.put("/{categoria_id}", response_model=CategoriaInsumoResponse)
def actualizar_categoria(
    categoria_id: UUID,
    data: CategoriaInsumoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador", "jefe_produccion")),
):
    """Actualiza una categoría."""
    service = StockService(db)
    categoria = service.update_categoria(categoria_id, data, current_user.id)

    if not categoria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada",
        )

    return CategoriaInsumoResponse(
        id=categoria.id,
        nombre=categoria.nombre,
        descripcion=categoria.descripcion,
        orden=categoria.orden,
        activo=categoria.activo,
        created_at=categoria.created_at,
        updated_at=categoria.updated_at,
        cantidad_insumos=categoria.insumos.count() if categoria.insumos else 0,
    )


@router.delete("/{categoria_id}", response_model=MessageResponse)
def eliminar_categoria(
    categoria_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_permission("superadmin", "administrador")),
):
    """Elimina (desactiva) una categoría."""
    service = StockService(db)
    success = service.delete_categoria(categoria_id, current_user.id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada",
        )

    return MessageResponse(message="Categoría eliminada correctamente")
