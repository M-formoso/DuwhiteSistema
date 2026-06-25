"""
Servicio de Productos de Lavado.
"""

from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.producto_lavado import ProductoLavado, PrecioProductoLavado, CategoriaProductoLavado
from app.schemas.producto_lavado import (
    ProductoLavadoCreate,
    ProductoLavadoUpdate,
    PrecioProductoLavadoCreate,
    PrecioProductoLavadoUpdate,
)
from app.services.log_service import LogService


class ProductoLavadoService:
    """Servicio para gestión de productos de lavado."""

    # ==================== PRODUCTOS ====================

    @staticmethod
    def get_all(
        db: Session,
        categoria: Optional[str] = None,
        solo_activos: bool = True,
        search: Optional[str] = None
    ) -> List[ProductoLavado]:
        """Obtiene todos los productos de lavado."""
        query = db.query(ProductoLavado)

        if solo_activos:
            query = query.filter(ProductoLavado.activo == True)

        if categoria:
            query = query.filter(ProductoLavado.categoria == categoria)

        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                (ProductoLavado.codigo.ilike(search_filter)) |
                (ProductoLavado.nombre.ilike(search_filter))
            )

        return query.order_by(ProductoLavado.categoria, ProductoLavado.nombre).all()

    @staticmethod
    def get_by_id(db: Session, producto_id: UUID) -> Optional[ProductoLavado]:
        """Obtiene un producto por ID."""
        return db.query(ProductoLavado).filter(ProductoLavado.id == producto_id).first()

    @staticmethod
    def get_by_codigo(db: Session, codigo: str) -> Optional[ProductoLavado]:
        """Obtiene un producto por código."""
        return db.query(ProductoLavado).filter(ProductoLavado.codigo == codigo).first()

    @staticmethod
    def create(
        db: Session,
        data: ProductoLavadoCreate,
        usuario_id: UUID
    ) -> ProductoLavado:
        """Crea un nuevo producto de lavado."""
        # Verificar código único
        if ProductoLavadoService.get_by_codigo(db, data.codigo):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe un producto con el código {data.codigo}"
            )

        # Validar categoría
        categorias_validas = [c.value for c in CategoriaProductoLavado]
        if data.categoria not in categorias_validas:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Categoría inválida. Debe ser una de: {categorias_validas}"
            )

        producto = ProductoLavado(
            codigo=data.codigo.upper(),
            nombre=data.nombre,
            descripcion=data.descripcion,
            categoria=data.categoria,
            peso_promedio_kg=data.peso_promedio_kg,
            activo=True
        )

        db.add(producto)
        db.commit()
        db.refresh(producto)

        # Log
        LogService.log(
            db=db,
            usuario_id=usuario_id,
            accion="crear",
            modulo="productos_lavado",
            descripcion=f"Producto {producto.codigo}: {producto.nombre} creado",
            entidad_tipo="producto_lavado",
            entidad_id=producto.id
        )

        return producto

    @staticmethod
    def update(
        db: Session,
        producto_id: UUID,
        data: ProductoLavadoUpdate,
        usuario_id: UUID
    ) -> ProductoLavado:
        """Actualiza un producto de lavado."""
        producto = ProductoLavadoService.get_by_id(db, producto_id)
        if not producto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Producto no encontrado"
            )

        # Verificar código único si se cambia
        if data.codigo and data.codigo != producto.codigo:
            existente = ProductoLavadoService.get_by_codigo(db, data.codigo)
            if existente:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ya existe un producto con el código {data.codigo}"
                )

        # Validar categoría si se cambia
        if data.categoria:
            categorias_validas = [c.value for c in CategoriaProductoLavado]
            if data.categoria not in categorias_validas:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Categoría inválida. Debe ser una de: {categorias_validas}"
                )

        # Actualizar campos
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field == "codigo" and value:
                value = value.upper()
            setattr(producto, field, value)

        db.commit()
        db.refresh(producto)

        # Log
        LogService.log(
            db=db,
            usuario_id=usuario_id,
            accion="actualizar",
            modulo="productos_lavado",
            descripcion=f"Producto {producto.codigo} actualizado",
            entidad_tipo="producto_lavado",
            entidad_id=producto.id
        )

        return producto

    @staticmethod
    def delete(db: Session, producto_id: UUID, usuario_id: UUID) -> bool:
        """Desactiva un producto de lavado (soft delete)."""
        producto = ProductoLavadoService.get_by_id(db, producto_id)
        if not producto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Producto no encontrado"
            )

        producto.activo = False
        db.commit()

        # Log
        LogService.log(
            db=db,
            usuario_id=usuario_id,
            accion="eliminar",
            modulo="productos_lavado",
            descripcion=f"Producto {producto.codigo} desactivado",
            entidad_tipo="producto_lavado",
            entidad_id=producto.id
        )

        return True

    @staticmethod
    def get_categorias() -> List[dict]:
        """Obtiene las categorías disponibles."""
        return [
            {"value": c.value, "label": c.value.replace("_", " ").title()}
            for c in CategoriaProductoLavado
        ]

    # ==================== PRECIOS ====================

    @staticmethod
    def get_precios_lista(
        db: Session,
        lista_precios_id: UUID,
        solo_activos: bool = True
    ) -> List[PrecioProductoLavado]:
        """Obtiene los precios de productos para una lista de precios."""
        query = db.query(PrecioProductoLavado).filter(
            PrecioProductoLavado.lista_precios_id == lista_precios_id
        )

        if solo_activos:
            query = query.filter(PrecioProductoLavado.activo == True)

        return query.all()

    @staticmethod
    def get_precio_producto(
        db: Session,
        lista_precios_id: UUID,
        producto_id: UUID
    ) -> Optional[PrecioProductoLavado]:
        """Obtiene el precio de un producto en una lista específica."""
        return db.query(PrecioProductoLavado).filter(
            PrecioProductoLavado.lista_precios_id == lista_precios_id,
            PrecioProductoLavado.producto_id == producto_id,
            PrecioProductoLavado.activo == True
        ).first()

    @staticmethod
    def set_precio(
        db: Session,
        data: PrecioProductoLavadoCreate,
        usuario_id: UUID
    ) -> PrecioProductoLavado:
        """Establece o actualiza el precio de un producto en una lista."""
        # Verificar producto existe
        producto = ProductoLavadoService.get_by_id(db, data.producto_id)
        if not producto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Producto no encontrado"
            )

        # Buscar precio existente
        precio_existente = ProductoLavadoService.get_precio_producto(
            db, data.lista_precios_id, data.producto_id
        )

        if precio_existente:
            # Actualizar
            precio_existente.precio_unitario = data.precio_unitario
            db.commit()
            db.refresh(precio_existente)
            return precio_existente
        else:
            # Crear nuevo
            precio = PrecioProductoLavado(
                lista_precios_id=data.lista_precios_id,
                producto_id=data.producto_id,
                precio_unitario=data.precio_unitario,
                activo=True
            )
            db.add(precio)
            db.commit()
            db.refresh(precio)

            # Log
            LogService.log(
                db=db,
                usuario_id=usuario_id,
                accion="crear",
                modulo="precios_productos_lavado",
                descripcion=f"Precio ${data.precio_unitario} para producto {producto.codigo}",
                entidad_tipo="precio_producto_lavado",
                entidad_id=precio.id
            )

            return precio

    # ==================== MATRIZ DE PRECIOS ====================

    @staticmethod
    def get_matriz_precios(
        db: Session,
        categoria: Optional[str] = None,
        search: Optional[str] = None,
    ) -> dict:
        """
        Devuelve una matriz productos × listas de precios para edición masiva.
        Cada producto trae todos los precios indexados por lista_precios_id.
        """
        from app.models.lista_precios import ListaPrecios

        listas = (
            db.query(ListaPrecios)
            .filter(ListaPrecios.activa == True)
            .order_by(ListaPrecios.codigo)
            .all()
        )
        lista_ids = [l.id for l in listas]

        productos = ProductoLavadoService.get_all(
            db, categoria=categoria, solo_activos=True, search=search
        )

        # Cargar todos los precios activos en una sola query
        precios_rows = (
            db.query(PrecioProductoLavado)
            .filter(
                PrecioProductoLavado.activo == True,
                PrecioProductoLavado.lista_precios_id.in_(lista_ids) if lista_ids else False,
            )
            .all()
        )
        precios_por_clave: dict = {}
        for p in precios_rows:
            clave = (str(p.producto_id), str(p.lista_precios_id))
            precios_por_clave[clave] = float(p.precio_unitario)

        productos_out = []
        for prod in productos:
            precios_dict = {}
            for lista in listas:
                clave = (str(prod.id), str(lista.id))
                precios_dict[str(lista.id)] = precios_por_clave.get(clave)  # None si no tiene
            productos_out.append({
                "producto_id": str(prod.id),
                "producto_codigo": prod.codigo,
                "producto_nombre": prod.nombre,
                "categoria": prod.categoria,
                "peso_promedio_kg": float(prod.peso_promedio_kg) if prod.peso_promedio_kg else None,
                "precios": precios_dict,
            })

        listas_out = [
            {
                "id": str(l.id),
                "codigo": l.codigo,
                "nombre": l.nombre,
                "es_lista_base": l.es_lista_base,
            }
            for l in listas
        ]

        return {
            "listas": listas_out,
            "productos": productos_out,
        }

    @staticmethod
    def bulk_set_precios(
        db: Session,
        precios: List[dict],
        usuario_id: UUID,
    ) -> int:
        """
        Aplica varios precios de una sola vez.
        `precios` es una lista de dicts con {lista_precios_id, producto_id, precio_unitario}.
        Crea o actualiza según corresponda. Devuelve la cantidad de cambios.
        """
        cambios = 0
        for item in precios:
            try:
                lista_id = UUID(str(item["lista_precios_id"]))
                producto_id = UUID(str(item["producto_id"]))
                precio = Decimal(str(item["precio_unitario"]))
            except (KeyError, ValueError, TypeError):
                continue
            if precio < 0:
                continue

            existente = (
                db.query(PrecioProductoLavado)
                .filter(
                    PrecioProductoLavado.lista_precios_id == lista_id,
                    PrecioProductoLavado.producto_id == producto_id,
                )
                .first()
            )
            if existente:
                if existente.precio_unitario != precio or not existente.activo:
                    existente.precio_unitario = precio
                    existente.activo = True
                    cambios += 1
            else:
                db.add(PrecioProductoLavado(
                    lista_precios_id=lista_id,
                    producto_id=producto_id,
                    precio_unitario=precio,
                    activo=True,
                ))
                cambios += 1

        if cambios > 0:
            db.commit()
            LogService.log(
                db=db,
                usuario_id=usuario_id,
                accion="bulk_actualizar",
                modulo="precios_productos_lavado",
                descripcion=f"Bulk update de {cambios} precios",
                entidad_tipo="precio_producto_lavado",
                entidad_id=None,
            )
        return cambios

    @staticmethod
    def aplicar_incremento_porcentaje(
        db: Session,
        porcentaje: Decimal,
        lista_ids: Optional[List[UUID]],
        producto_ids: Optional[List[UUID]],
        usuario_id: UUID,
        redondeo: int = 2,
    ) -> int:
        """
        Aplica un porcentaje (+/-) a los precios filtrados por listas y/o productos.
        Si lista_ids es None/vacío: aplica a TODAS las listas activas.
        Si producto_ids es None/vacío: aplica a TODOS los productos.
        Devuelve la cantidad de precios actualizados.
        """
        factor = Decimal(1) + (Decimal(porcentaje) / Decimal(100))
        if factor < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El porcentaje resultaría en precios negativos",
            )

        query = db.query(PrecioProductoLavado).filter(
            PrecioProductoLavado.activo == True
        )
        if lista_ids:
            query = query.filter(PrecioProductoLavado.lista_precios_id.in_(lista_ids))
        if producto_ids:
            query = query.filter(PrecioProductoLavado.producto_id.in_(producto_ids))

        precios = query.all()
        cuantizador = Decimal(10) ** (-redondeo)
        actualizados = 0
        for p in precios:
            nuevo = (Decimal(p.precio_unitario) * factor).quantize(cuantizador)
            if nuevo != p.precio_unitario:
                p.precio_unitario = nuevo
                actualizados += 1

        if actualizados > 0:
            db.commit()
            LogService.log(
                db=db,
                usuario_id=usuario_id,
                accion="aplicar_incremento",
                modulo="precios_productos_lavado",
                descripcion=(
                    f"Incremento {porcentaje}% aplicado a {actualizados} precios "
                    f"(listas: {len(lista_ids) if lista_ids else 'todas'}, "
                    f"productos: {len(producto_ids) if producto_ids else 'todos'})"
                ),
                entidad_tipo="precio_producto_lavado",
                entidad_id=None,
            )
        return actualizados

    @staticmethod
    def get_productos_con_precios(
        db: Session,
        lista_precios_id: UUID,
        categoria: Optional[str] = None
    ) -> List[dict]:
        """
        Obtiene todos los productos con sus precios para una lista.
        Útil para el formulario de conteo y finalización.
        """
        productos = ProductoLavadoService.get_all(db, categoria=categoria, solo_activos=True)

        result = []
        for producto in productos:
            precio = ProductoLavadoService.get_precio_producto(db, lista_precios_id, producto.id)

            result.append({
                "producto_id": producto.id,
                "producto_codigo": producto.codigo,
                "producto_nombre": producto.nombre,
                "categoria": producto.categoria,
                "peso_promedio_kg": float(producto.peso_promedio_kg) if producto.peso_promedio_kg else None,
                "precio_unitario": float(precio.precio_unitario) if precio else 0,
                "tiene_precio": precio is not None
            })

        return result
