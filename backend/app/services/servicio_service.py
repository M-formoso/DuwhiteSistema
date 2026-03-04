"""
Servicio de Servicios y Listas de Precios.
"""

from datetime import date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session, joinedload

from app.models.lista_precios import Servicio, ListaPrecios, ItemListaPrecios
from app.schemas.servicio import (
    ServicioCreate, ServicioUpdate,
    ListaPreciosCreate, ListaPreciosUpdate,
    ItemListaPreciosCreate, ItemListaPreciosUpdate
)


# ==================== SERVICIOS ====================

def get_servicio(db: Session, servicio_id: UUID) -> Optional[Servicio]:
    """Obtiene un servicio por ID."""
    return db.query(Servicio).filter(
        Servicio.id == servicio_id,
        Servicio.activo == True
    ).first()


def get_servicio_by_codigo(db: Session, codigo: str) -> Optional[Servicio]:
    """Obtiene un servicio por código."""
    return db.query(Servicio).filter(
        Servicio.codigo == codigo,
        Servicio.activo == True
    ).first()


def get_servicios(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    tipo: Optional[str] = None,
    categoria: Optional[str] = None,
    activo: Optional[bool] = True,
    mostrar_en_web: Optional[bool] = None
) -> List[Servicio]:
    """Lista servicios con filtros."""
    query = db.query(Servicio)

    if activo is not None:
        query = query.filter(Servicio.activo == activo)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Servicio.codigo.ilike(search_term),
                Servicio.nombre.ilike(search_term),
                Servicio.descripcion.ilike(search_term)
            )
        )

    if tipo:
        query = query.filter(Servicio.tipo == tipo)

    if categoria:
        query = query.filter(Servicio.categoria == categoria)

    if mostrar_en_web is not None:
        query = query.filter(Servicio.mostrar_en_web == mostrar_en_web)

    return query.order_by(Servicio.orden, Servicio.nombre).offset(skip).limit(limit).all()


def count_servicios(
    db: Session,
    search: Optional[str] = None,
    tipo: Optional[str] = None,
    categoria: Optional[str] = None,
    activo: Optional[bool] = True,
    mostrar_en_web: Optional[bool] = None
) -> int:
    """Cuenta servicios con filtros."""
    query = db.query(func.count(Servicio.id))

    if activo is not None:
        query = query.filter(Servicio.activo == activo)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Servicio.codigo.ilike(search_term),
                Servicio.nombre.ilike(search_term)
            )
        )

    if tipo:
        query = query.filter(Servicio.tipo == tipo)

    if categoria:
        query = query.filter(Servicio.categoria == categoria)

    if mostrar_en_web is not None:
        query = query.filter(Servicio.mostrar_en_web == mostrar_en_web)

    return query.scalar()


def create_servicio(db: Session, data: ServicioCreate) -> Servicio:
    """Crea un nuevo servicio."""
    servicio = Servicio(
        codigo=data.codigo,
        nombre=data.nombre,
        descripcion=data.descripcion,
        tipo=data.tipo,
        categoria=data.categoria,
        unidad_cobro=data.unidad_cobro,
        precio_base=data.precio_base,
        tiempo_estimado_minutos=data.tiempo_estimado_minutos,
        mostrar_en_web=data.mostrar_en_web,
        orden=data.orden,
        notas=data.notas,
        activo=True
    )
    db.add(servicio)
    db.commit()
    db.refresh(servicio)
    return servicio


def update_servicio(db: Session, servicio: Servicio, data: ServicioUpdate) -> Servicio:
    """Actualiza un servicio."""
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(servicio, field, value)

    db.commit()
    db.refresh(servicio)
    return servicio


def delete_servicio(db: Session, servicio: Servicio) -> None:
    """Elimina (soft delete) un servicio."""
    servicio.activo = False
    db.commit()


def get_tipos_servicio() -> List[Dict[str, str]]:
    """Retorna los tipos de servicio disponibles."""
    return [
        {"value": "lavado_normal", "label": "Lavado Normal"},
        {"value": "lavado_delicado", "label": "Lavado Delicado"},
        {"value": "lavado_industrial", "label": "Lavado Industrial"},
        {"value": "lavado_seco", "label": "Lavado en Seco"},
        {"value": "planchado", "label": "Planchado"},
        {"value": "tintoreria", "label": "Tintorería"},
        {"value": "desmanchado", "label": "Desmanchado"},
        {"value": "almidonado", "label": "Almidonado"},
    ]


def get_unidades_cobro() -> List[Dict[str, str]]:
    """Retorna las unidades de cobro disponibles."""
    return [
        {"value": "kg", "label": "Kilogramo"},
        {"value": "prenda", "label": "Prenda"},
        {"value": "unidad", "label": "Unidad"},
        {"value": "docena", "label": "Docena"},
        {"value": "metro", "label": "Metro"},
    ]


def get_categorias_servicio(db: Session) -> List[str]:
    """Retorna las categorías únicas de servicios."""
    result = db.query(Servicio.categoria).filter(
        Servicio.activo == True,
        Servicio.categoria.isnot(None)
    ).distinct().all()
    return [r[0] for r in result if r[0]]


# ==================== LISTAS DE PRECIOS ====================

def get_lista_precios(db: Session, lista_id: UUID) -> Optional[ListaPrecios]:
    """Obtiene una lista de precios por ID."""
    return db.query(ListaPrecios).filter(
        ListaPrecios.id == lista_id
    ).first()


def get_lista_precios_by_codigo(db: Session, codigo: str) -> Optional[ListaPrecios]:
    """Obtiene una lista de precios por código."""
    return db.query(ListaPrecios).filter(
        ListaPrecios.codigo == codigo
    ).first()


def get_listas_precios(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    activa: Optional[bool] = True,
    es_lista_base: Optional[bool] = None
) -> List[ListaPrecios]:
    """Lista listas de precios con filtros."""
    query = db.query(ListaPrecios)

    if activa is not None:
        query = query.filter(ListaPrecios.activa == activa)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                ListaPrecios.codigo.ilike(search_term),
                ListaPrecios.nombre.ilike(search_term)
            )
        )

    if es_lista_base is not None:
        query = query.filter(ListaPrecios.es_lista_base == es_lista_base)

    return query.order_by(ListaPrecios.nombre).offset(skip).limit(limit).all()


def count_listas_precios(
    db: Session,
    search: Optional[str] = None,
    activa: Optional[bool] = True,
    es_lista_base: Optional[bool] = None
) -> int:
    """Cuenta listas de precios."""
    query = db.query(func.count(ListaPrecios.id))

    if activa is not None:
        query = query.filter(ListaPrecios.activa == activa)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                ListaPrecios.codigo.ilike(search_term),
                ListaPrecios.nombre.ilike(search_term)
            )
        )

    if es_lista_base is not None:
        query = query.filter(ListaPrecios.es_lista_base == es_lista_base)

    return query.scalar()


def create_lista_precios(db: Session, data: ListaPreciosCreate) -> ListaPrecios:
    """Crea una nueva lista de precios."""
    lista = ListaPrecios(
        codigo=data.codigo,
        nombre=data.nombre,
        descripcion=data.descripcion,
        es_lista_base=data.es_lista_base,
        lista_base_id=data.lista_base_id,
        porcentaje_modificador=data.porcentaje_modificador,
        fecha_vigencia_desde=data.fecha_vigencia_desde,
        fecha_vigencia_hasta=data.fecha_vigencia_hasta,
        notas=data.notas,
        activa=True
    )
    db.add(lista)
    db.commit()
    db.refresh(lista)
    return lista


def update_lista_precios(db: Session, lista: ListaPrecios, data: ListaPreciosUpdate) -> ListaPrecios:
    """Actualiza una lista de precios."""
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lista, field, value)

    db.commit()
    db.refresh(lista)
    return lista


def delete_lista_precios(db: Session, lista: ListaPrecios) -> None:
    """Elimina (soft delete) una lista de precios."""
    lista.activa = False
    db.commit()


def get_lista_precios_con_items(db: Session, lista_id: UUID) -> Optional[ListaPrecios]:
    """Obtiene una lista de precios con sus items."""
    return db.query(ListaPrecios).options(
        joinedload(ListaPrecios.items).joinedload(ItemListaPrecios.servicio)
    ).filter(ListaPrecios.id == lista_id).first()


def contar_items_lista(db: Session, lista_id: UUID) -> int:
    """Cuenta los items de una lista."""
    return db.query(func.count(ItemListaPrecios.id)).filter(
        ItemListaPrecios.lista_id == lista_id,
        ItemListaPrecios.activo == True
    ).scalar()


# ==================== ITEMS LISTA DE PRECIOS ====================

def get_item_lista(db: Session, item_id: UUID) -> Optional[ItemListaPrecios]:
    """Obtiene un item de lista por ID."""
    return db.query(ItemListaPrecios).filter(
        ItemListaPrecios.id == item_id
    ).first()


def get_items_lista(db: Session, lista_id: UUID, activo: Optional[bool] = True) -> List[ItemListaPrecios]:
    """Obtiene los items de una lista."""
    query = db.query(ItemListaPrecios).options(
        joinedload(ItemListaPrecios.servicio)
    ).filter(ItemListaPrecios.lista_id == lista_id)

    if activo is not None:
        query = query.filter(ItemListaPrecios.activo == activo)

    return query.all()


def get_item_por_servicio(db: Session, lista_id: UUID, servicio_id: UUID) -> Optional[ItemListaPrecios]:
    """Obtiene el precio de un servicio en una lista específica."""
    return db.query(ItemListaPrecios).filter(
        ItemListaPrecios.lista_id == lista_id,
        ItemListaPrecios.servicio_id == servicio_id,
        ItemListaPrecios.activo == True
    ).first()


def create_item_lista(db: Session, lista_id: UUID, data: ItemListaPreciosCreate) -> ItemListaPrecios:
    """Crea un item en una lista de precios."""
    item = ItemListaPrecios(
        lista_id=lista_id,
        servicio_id=data.servicio_id,
        precio=data.precio,
        precio_minimo=data.precio_minimo,
        cantidad_minima=data.cantidad_minima,
        fecha_vigencia_desde=data.fecha_vigencia_desde,
        fecha_vigencia_hasta=data.fecha_vigencia_hasta,
        activo=True
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_item_lista(db: Session, item: ItemListaPrecios, data: ItemListaPreciosUpdate) -> ItemListaPrecios:
    """Actualiza un item de lista."""
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


def delete_item_lista(db: Session, item: ItemListaPrecios) -> None:
    """Elimina (soft delete) un item de lista."""
    item.activo = False
    db.commit()


def aplicar_modificador_lista(
    db: Session,
    lista: ListaPrecios,
    incluir_servicios_ids: Optional[List[UUID]] = None
) -> int:
    """
    Aplica el porcentaje modificador de una lista derivada
    para crear/actualizar sus items basándose en la lista base.
    Retorna el número de items actualizados.
    """
    if not lista.lista_base_id or lista.porcentaje_modificador is None:
        return 0

    # Obtener items de la lista base
    items_base = get_items_lista(db, lista.lista_base_id)

    count = 0
    for item_base in items_base:
        # Filtrar si se especifican servicios
        if incluir_servicios_ids and item_base.servicio_id not in incluir_servicios_ids:
            continue

        # Calcular nuevo precio
        modificador = 1 + (lista.porcentaje_modificador / 100)
        nuevo_precio = item_base.precio * modificador

        # Buscar si ya existe el item
        item_existente = get_item_por_servicio(db, lista.id, item_base.servicio_id)

        if item_existente:
            item_existente.precio = nuevo_precio
            if item_base.precio_minimo:
                item_existente.precio_minimo = item_base.precio_minimo * modificador
        else:
            nuevo_item = ItemListaPrecios(
                lista_id=lista.id,
                servicio_id=item_base.servicio_id,
                precio=nuevo_precio,
                precio_minimo=item_base.precio_minimo * modificador if item_base.precio_minimo else None,
                cantidad_minima=item_base.cantidad_minima,
                activo=True
            )
            db.add(nuevo_item)

        count += 1

    db.commit()
    return count


# ==================== UTILIDADES ====================

def obtener_precio_servicio(
    db: Session,
    servicio_id: UUID,
    lista_id: Optional[UUID] = None
) -> Optional[Decimal]:
    """
    Obtiene el precio de un servicio.
    Si se especifica lista_id, busca en esa lista.
    Si no, retorna el precio base del servicio.
    """
    if lista_id:
        item = get_item_por_servicio(db, lista_id, servicio_id)
        if item:
            return item.precio

    servicio = get_servicio(db, servicio_id)
    if servicio:
        return servicio.precio_base

    return None


def buscar_servicios_por_texto(db: Session, texto: str, limit: int = 10) -> List[Servicio]:
    """Búsqueda rápida de servicios por texto."""
    search_term = f"%{texto}%"
    return db.query(Servicio).filter(
        Servicio.activo == True,
        or_(
            Servicio.codigo.ilike(search_term),
            Servicio.nombre.ilike(search_term)
        )
    ).order_by(Servicio.nombre).limit(limit).all()
