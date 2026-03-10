"""
Endpoints de Servicios y Listas de Precios.
"""

from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.usuario import Usuario
from app.services import servicio_service
from app.schemas.servicio import (
    ServicioCreate, ServicioUpdate, ServicioResponse, ServicioList,
    ListaPreciosCreate, ListaPreciosUpdate, ListaPreciosResponse, ListaPreciosList,
    ListaPreciosConItems,
    ItemListaPreciosCreate, ItemListaPreciosUpdate, ItemListaPreciosResponse,
    TipoServicioInfo, UnidadCobroInfo
)

router = APIRouter()


# ==================== SERVICIOS ====================

@router.get("/", response_model=dict)
def listar_servicios(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    tipo: Optional[str] = None,
    categoria: Optional[str] = None,
    activo: Optional[bool] = True,
    mostrar_en_web: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista servicios con filtros y paginación."""
    servicios = servicio_service.get_servicios(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        tipo=tipo,
        categoria=categoria,
        activo=activo,
        mostrar_en_web=mostrar_en_web
    )

    total = servicio_service.count_servicios(
        db=db,
        search=search,
        tipo=tipo,
        categoria=categoria,
        activo=activo,
        mostrar_en_web=mostrar_en_web
    )

    return {
        "items": [ServicioList.model_validate(s) for s in servicios],
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/tipos", response_model=List[TipoServicioInfo])
def obtener_tipos_servicio(
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene los tipos de servicio disponibles."""
    return servicio_service.get_tipos_servicio()


@router.get("/unidades-cobro", response_model=List[UnidadCobroInfo])
def obtener_unidades_cobro(
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene las unidades de cobro disponibles."""
    return servicio_service.get_unidades_cobro()


@router.get("/categorias", response_model=List[str])
def obtener_categorias(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene las categorías de servicios existentes."""
    return servicio_service.get_categorias_servicio(db)


@router.get("/buscar", response_model=List[ServicioList])
def buscar_servicios(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Búsqueda rápida de servicios."""
    servicios = servicio_service.buscar_servicios_por_texto(db, q, limit)
    return [ServicioList.model_validate(s) for s in servicios]


@router.get("/{servicio_id}", response_model=ServicioResponse)
def obtener_servicio(
    servicio_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene un servicio por ID."""
    servicio = servicio_service.get_servicio(db, servicio_id)
    if not servicio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado"
        )
    return ServicioResponse.model_validate(servicio)


@router.post("/", response_model=ServicioResponse, status_code=status.HTTP_201_CREATED)
def crear_servicio(
    data: ServicioCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Crea un nuevo servicio."""
    # Verificar permisos
    if current_user.rol not in ["superadmin", "administrador"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para crear servicios"
        )

    # Verificar código único
    existente = servicio_service.get_servicio_by_codigo(db, data.codigo)
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un servicio con el código {data.codigo}"
        )

    servicio = servicio_service.create_servicio(db, data)
    return ServicioResponse.model_validate(servicio)


@router.put("/{servicio_id}", response_model=ServicioResponse)
def actualizar_servicio(
    servicio_id: UUID,
    data: ServicioUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Actualiza un servicio."""
    # Verificar permisos
    if current_user.rol not in ["superadmin", "administrador"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para actualizar servicios"
        )

    servicio = servicio_service.get_servicio(db, servicio_id)
    if not servicio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado"
        )

    # Verificar código único si se cambia
    if data.codigo and data.codigo != servicio.codigo:
        existente = servicio_service.get_servicio_by_codigo(db, data.codigo)
        if existente:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un servicio con el código {data.codigo}"
            )

    servicio = servicio_service.update_servicio(db, servicio, data)
    return ServicioResponse.model_validate(servicio)


@router.delete("/{servicio_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_servicio(
    servicio_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Elimina (desactiva) un servicio."""
    # Verificar permisos
    if current_user.rol not in ["superadmin", "administrador"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para eliminar servicios"
        )

    servicio = servicio_service.get_servicio(db, servicio_id)
    if not servicio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado"
        )

    servicio_service.delete_servicio(db, servicio)
    return None


# ==================== LISTAS DE PRECIOS ====================

@router.get("/listas-precios/", response_model=dict)
def listar_listas_precios(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    activa: Optional[bool] = True,
    es_lista_base: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista listas de precios con filtros y paginación."""
    listas = servicio_service.get_listas_precios(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        activa=activa,
        es_lista_base=es_lista_base
    )

    total = servicio_service.count_listas_precios(
        db=db,
        search=search,
        activa=activa,
        es_lista_base=es_lista_base
    )

    # Agregar cantidad de items a cada lista
    items_response = []
    for lista in listas:
        lista_dict = ListaPreciosList.model_validate(lista).model_dump()
        lista_dict["cantidad_items"] = servicio_service.contar_items_lista(db, lista.id)
        items_response.append(lista_dict)

    return {
        "items": items_response,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/listas-precios/{lista_id}", response_model=ListaPreciosConItems)
def obtener_lista_precios(
    lista_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene una lista de precios con sus items."""
    lista = servicio_service.get_lista_precios_con_items(db, lista_id)
    if not lista:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista de precios no encontrada"
        )

    # Construir respuesta con items enriquecidos
    items_response = []
    for item in lista.items:
        if item.activo:
            item_dict = {
                "id": item.id,
                "lista_id": item.lista_id,
                "servicio_id": item.servicio_id,
                "precio": item.precio,
                "precio_minimo": item.precio_minimo,
                "cantidad_minima": item.cantidad_minima,
                "fecha_vigencia_desde": item.fecha_vigencia_desde,
                "fecha_vigencia_hasta": item.fecha_vigencia_hasta,
                "activo": item.activo,
                "servicio_codigo": item.servicio.codigo if item.servicio else None,
                "servicio_nombre": item.servicio.nombre if item.servicio else None,
                "servicio_unidad_cobro": item.servicio.unidad_cobro if item.servicio else None,
            }
            items_response.append(item_dict)

    response = {
        "id": lista.id,
        "codigo": lista.codigo,
        "nombre": lista.nombre,
        "descripcion": lista.descripcion,
        "es_lista_base": lista.es_lista_base,
        "lista_base_id": lista.lista_base_id,
        "porcentaje_modificador": lista.porcentaje_modificador,
        "fecha_vigencia_desde": lista.fecha_vigencia_desde,
        "fecha_vigencia_hasta": lista.fecha_vigencia_hasta,
        "notas": lista.notas,
        "activa": lista.activa,
        "created_at": lista.created_at,
        "updated_at": lista.updated_at,
        "lista_base_nombre": lista.lista_base.nombre if lista.lista_base else None,
        "cantidad_items": len(items_response),
        "items": items_response
    }

    return response


@router.post("/listas-precios/", response_model=ListaPreciosResponse, status_code=status.HTTP_201_CREATED)
def crear_lista_precios(
    data: ListaPreciosCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Crea una nueva lista de precios."""
    # Verificar permisos
    if current_user.rol not in ["superadmin", "administrador"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para crear listas de precios"
        )

    # Verificar código único
    existente = servicio_service.get_lista_precios_by_codigo(db, data.codigo)
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe una lista con el código {data.codigo}"
        )

    # Verificar lista base si se especifica
    if data.lista_base_id:
        lista_base = servicio_service.get_lista_precios(db, data.lista_base_id)
        if not lista_base:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Lista base no encontrada"
            )

    lista = servicio_service.create_lista_precios(db, data)
    response = ListaPreciosResponse.model_validate(lista)
    response.cantidad_items = 0
    return response


@router.put("/listas-precios/{lista_id}", response_model=ListaPreciosResponse)
def actualizar_lista_precios(
    lista_id: UUID,
    data: ListaPreciosUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Actualiza una lista de precios."""
    # Verificar permisos
    if current_user.rol not in ["superadmin", "administrador"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para actualizar listas de precios"
        )

    lista = servicio_service.get_lista_precios(db, lista_id)
    if not lista:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista de precios no encontrada"
        )

    # Verificar código único si se cambia
    if data.codigo and data.codigo != lista.codigo:
        existente = servicio_service.get_lista_precios_by_codigo(db, data.codigo)
        if existente:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe una lista con el código {data.codigo}"
            )

    lista = servicio_service.update_lista_precios(db, lista, data)
    response = ListaPreciosResponse.model_validate(lista)
    response.cantidad_items = servicio_service.contar_items_lista(db, lista.id)
    return response


@router.delete("/listas-precios/{lista_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_lista_precios(
    lista_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Elimina (desactiva) una lista de precios."""
    # Verificar permisos
    if current_user.rol not in ["superadmin", "administrador"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para eliminar listas de precios"
        )

    lista = servicio_service.get_lista_precios(db, lista_id)
    if not lista:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista de precios no encontrada"
        )

    servicio_service.delete_lista_precios(db, lista)
    return None


@router.post("/listas-precios/{lista_id}/aplicar-modificador", response_model=dict)
def aplicar_modificador_lista(
    lista_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Aplica el modificador de la lista derivada para crear/actualizar items."""
    # Verificar permisos
    if current_user.rol not in ["superadmin", "administrador"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para esta operación"
        )

    lista = servicio_service.get_lista_precios(db, lista_id)
    if not lista:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista de precios no encontrada"
        )

    if not lista.lista_base_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta lista no tiene una lista base configurada"
        )

    if lista.porcentaje_modificador is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta lista no tiene un porcentaje modificador configurado"
        )

    count = servicio_service.aplicar_modificador_lista(db, lista)
    return {"message": f"Se actualizaron {count} items", "items_actualizados": count}


# ==================== ITEMS DE LISTA ====================

@router.get("/listas-precios/{lista_id}/items", response_model=List[ItemListaPreciosResponse])
def listar_items_lista(
    lista_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene los items de una lista de precios."""
    lista = servicio_service.get_lista_precios(db, lista_id)
    if not lista:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista de precios no encontrada"
        )

    items = servicio_service.get_items_lista(db, lista_id)

    # Enriquecer con datos del servicio
    items_response = []
    for item in items:
        item_dict = {
            "id": item.id,
            "lista_id": item.lista_id,
            "servicio_id": item.servicio_id,
            "precio": item.precio,
            "precio_minimo": item.precio_minimo,
            "cantidad_minima": item.cantidad_minima,
            "fecha_vigencia_desde": item.fecha_vigencia_desde,
            "fecha_vigencia_hasta": item.fecha_vigencia_hasta,
            "activo": item.activo,
            "servicio_codigo": item.servicio.codigo if item.servicio else None,
            "servicio_nombre": item.servicio.nombre if item.servicio else None,
            "servicio_unidad_cobro": item.servicio.unidad_cobro if item.servicio else None,
        }
        items_response.append(item_dict)

    return items_response


@router.post("/listas-precios/{lista_id}/items", response_model=ItemListaPreciosResponse, status_code=status.HTTP_201_CREATED)
def agregar_item_lista(
    lista_id: UUID,
    data: ItemListaPreciosCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Agrega un item a una lista de precios."""
    # Verificar permisos
    if current_user.rol not in ["superadmin", "administrador"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para esta operación"
        )

    lista = servicio_service.get_lista_precios(db, lista_id)
    if not lista:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista de precios no encontrada"
        )

    # Verificar que el servicio existe
    servicio = servicio_service.get_servicio(db, data.servicio_id)
    if not servicio:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Servicio no encontrado"
        )

    # Verificar que no exista ya
    existente = servicio_service.get_item_por_servicio(db, lista_id, data.servicio_id)
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este servicio ya está en la lista"
        )

    item = servicio_service.create_item_lista(db, lista_id, data)

    return {
        "id": item.id,
        "lista_id": item.lista_id,
        "servicio_id": item.servicio_id,
        "precio": item.precio,
        "precio_minimo": item.precio_minimo,
        "cantidad_minima": item.cantidad_minima,
        "fecha_vigencia_desde": item.fecha_vigencia_desde,
        "fecha_vigencia_hasta": item.fecha_vigencia_hasta,
        "activo": item.activo,
        "servicio_codigo": servicio.codigo,
        "servicio_nombre": servicio.nombre,
        "servicio_unidad_cobro": servicio.unidad_cobro,
    }


@router.put("/listas-precios/{lista_id}/items/{item_id}", response_model=ItemListaPreciosResponse)
def actualizar_item_lista(
    lista_id: UUID,
    item_id: UUID,
    data: ItemListaPreciosUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Actualiza un item de una lista de precios."""
    # Verificar permisos
    if current_user.rol not in ["superadmin", "administrador"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para esta operación"
        )

    item = servicio_service.get_item_lista(db, item_id)
    if not item or item.lista_id != lista_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item no encontrado"
        )

    item = servicio_service.update_item_lista(db, item, data)

    # Obtener servicio para la respuesta
    servicio = servicio_service.get_servicio(db, item.servicio_id)

    return {
        "id": item.id,
        "lista_id": item.lista_id,
        "servicio_id": item.servicio_id,
        "precio": item.precio,
        "precio_minimo": item.precio_minimo,
        "cantidad_minima": item.cantidad_minima,
        "fecha_vigencia_desde": item.fecha_vigencia_desde,
        "fecha_vigencia_hasta": item.fecha_vigencia_hasta,
        "activo": item.activo,
        "servicio_codigo": servicio.codigo if servicio else None,
        "servicio_nombre": servicio.nombre if servicio else None,
        "servicio_unidad_cobro": servicio.unidad_cobro if servicio else None,
    }


@router.delete("/listas-precios/{lista_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_item_lista(
    lista_id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Elimina un item de una lista de precios."""
    # Verificar permisos
    if current_user.rol not in ["superadmin", "administrador"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para esta operación"
        )

    item = servicio_service.get_item_lista(db, item_id)
    if not item or item.lista_id != lista_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item no encontrado"
        )

    servicio_service.delete_item_lista(db, item)
    return None


# ==================== PRECIO DE SERVICIO ====================

@router.get("/precio/{servicio_id}", response_model=dict)
def obtener_precio_servicio(
    servicio_id: UUID,
    lista_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene el precio de un servicio (de una lista específica o precio base)."""
    servicio = servicio_service.get_servicio(db, servicio_id)
    if not servicio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado"
        )

    precio = servicio_service.obtener_precio_servicio(db, servicio_id, lista_id)

    return {
        "servicio_id": servicio_id,
        "servicio_codigo": servicio.codigo,
        "servicio_nombre": servicio.nombre,
        "unidad_cobro": servicio.unidad_cobro,
        "precio": precio,
        "precio_base": servicio.precio_base,
        "lista_id": lista_id,
        "es_precio_lista": lista_id is not None and precio != servicio.precio_base
    }
