# Crear Endpoint FastAPI

Crea un endpoint FastAPI siguiendo las convenciones del proyecto DUWHITE.

## Parámetros
- **$ARGUMENTS**: Descripción del endpoint (ej: "GET /stock/alertas - listar alertas de stock bajo")

## Template de Endpoint

```python
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.core.deps import get_db, get_current_user
from app.core.permissions import require_permissions
from app.models.usuario import Usuario
from app.schemas.{modulo} import {Schema}Response, {Schema}Create, {Schema}Update
from app.schemas.common import PaginatedResponse
from app.services.{modulo}_service import {modulo}_service

router = APIRouter()


@router.get(
    "/",
    response_model=PaginatedResponse[{Schema}Response],
    summary="Listar {entidad}s",
    description="Obtiene una lista paginada de {entidad}s con filtros opcionales.",
)
@require_permissions(["ver_{modulo}"])
async def listar_{entidad}s(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
    skip: int = Query(0, ge=0, description="Registros a omitir"),
    limit: int = Query(20, ge=1, le=100, description="Límite de registros"),
    search: Optional[str] = Query(None, description="Búsqueda por texto"),
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo"),
):
    """
    Lista {entidad}s con paginación y filtros.

    - **skip**: Offset para paginación
    - **limit**: Cantidad máxima de resultados
    - **search**: Búsqueda por nombre/código
    - **activo**: Filtrar activos/inactivos
    """
    items, total = {modulo}_service.obtener_todos(
        db,
        skip=skip,
        limit=limit,
        search=search,
        activo=activo,
    )
    return PaginatedResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{id}",
    response_model={Schema}Response,
    summary="Obtener {entidad} por ID",
)
@require_permissions(["ver_{modulo}"])
async def obtener_{entidad}(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Obtiene un {entidad} específico por su ID."""
    item = {modulo}_service.obtener_por_id(db, id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="{Entidad} no encontrado",
        )
    return item


@router.post(
    "/",
    response_model={Schema}Response,
    status_code=status.HTTP_201_CREATED,
    summary="Crear {entidad}",
)
@require_permissions(["crear_{modulo}"])
async def crear_{entidad}(
    data: {Schema}Create,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Crea un nuevo {entidad}."""
    return {modulo}_service.crear(db, data, usuario_id=current_user.id)


@router.put(
    "/{id}",
    response_model={Schema}Response,
    summary="Actualizar {entidad}",
)
@require_permissions(["editar_{modulo}"])
async def actualizar_{entidad}(
    id: UUID,
    data: {Schema}Update,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Actualiza un {entidad} existente."""
    item = {modulo}_service.actualizar(db, id, data, usuario_id=current_user.id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="{Entidad} no encontrado",
        )
    return item


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar {entidad}",
)
@require_permissions(["eliminar_{modulo}"])
async def eliminar_{entidad}(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Elimina (soft delete) un {entidad}."""
    success = {modulo}_service.eliminar(db, id, usuario_id=current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="{Entidad} no encontrado",
        )
```

## Permisos por Rol

```python
# Definir en app/core/permissions.py

PERMISOS_POR_ROL = {
    "superadmin": ["*"],  # Todos los permisos
    "administrador": [
        "ver_stock", "crear_stock", "editar_stock", "eliminar_stock",
        "ver_proveedores", "crear_proveedores", "editar_proveedores",
        # ... etc
    ],
    "jefe_produccion": [
        "ver_stock", "crear_stock", "editar_stock",
        "ver_produccion", "crear_produccion", "editar_produccion",
        # ...
    ],
    "operador": [
        "ver_stock",
        "ver_produccion", "registrar_produccion",
        # ...
    ],
    # ...
}
```

## Ejemplo de uso
```
/crear-endpoint POST /produccion/ordenes/{id}/iniciar-etapa - inicia una etapa de producción
```
