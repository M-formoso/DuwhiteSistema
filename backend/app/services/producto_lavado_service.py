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
