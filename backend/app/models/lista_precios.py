"""
Modelo de Lista de Precios y Servicios.
"""

from enum import Enum
from sqlalchemy import Column, String, Boolean, Numeric, Text, Date, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.db.base_class import Base, BaseModelMixin


class TipoServicio(str, Enum):
    """Tipos de servicio de lavandería."""
    LAVADO_NORMAL = "lavado_normal"
    LAVADO_DELICADO = "lavado_delicado"
    LAVADO_INDUSTRIAL = "lavado_industrial"
    LAVADO_SECO = "lavado_seco"
    PLANCHADO = "planchado"
    TINTORERIA = "tintoreria"
    DESMANCHADO = "desmanchado"
    ALMIDONADO = "almidonado"


class UnidadCobro(str, Enum):
    """Unidades de cobro."""
    KILOGRAMO = "kg"
    PRENDA = "prenda"
    UNIDAD = "unidad"
    DOCENA = "docena"
    METRO = "metro"


class ListaPrecios(Base, BaseModelMixin):
    """
    Modelo de Lista de Precios.
    Permite tener diferentes listas para distintos tipos de clientes.
    """
    __tablename__ = "listas_precios"

    # Identificación
    codigo = Column(String(20), unique=True, nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=True)

    # Tipo
    es_lista_base = Column(Boolean, default=False)  # Lista base de la cual derivan otras
    lista_base_id = Column(UUID(as_uuid=True), ForeignKey("listas_precios.id"), nullable=True)

    # Modificador (si deriva de lista base)
    porcentaje_modificador = Column(Numeric(5, 2), nullable=True)  # +10%, -5%, etc.

    # Vigencia
    fecha_vigencia_desde = Column(Date, nullable=True)
    fecha_vigencia_hasta = Column(Date, nullable=True)

    # Estado
    activa = Column(Boolean, default=True)

    # Notas
    notas = Column(Text, nullable=True)

    # Relaciones
    lista_base = relationship("ListaPrecios", remote_side="ListaPrecios.id")
    items = relationship("ItemListaPrecios", back_populates="lista", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<ListaPrecios {self.codigo}: {self.nombre}>"


class Servicio(Base, BaseModelMixin):
    """
    Modelo de Servicio.
    Catálogo de servicios ofrecidos por el lavadero.
    """
    __tablename__ = "servicios"

    # Identificación
    codigo = Column(String(20), unique=True, nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=True)

    # Categorización
    tipo = Column(String(30), nullable=False, default=TipoServicio.LAVADO_NORMAL.value)
    categoria = Column(String(50), nullable=True)  # Ropa blanca, colores, delicados, etc.

    # Cobro
    unidad_cobro = Column(String(20), nullable=False, default=UnidadCobro.KILOGRAMO.value)
    precio_base = Column(Numeric(12, 2), nullable=False)

    # Tiempo estimado
    tiempo_estimado_minutos = Column(Integer, nullable=True)

    # Estado
    activo = Column(Boolean, default=True)
    mostrar_en_web = Column(Boolean, default=False)

    # Orden de visualización
    orden = Column(Integer, default=0)

    # Notas
    notas = Column(Text, nullable=True)

    # Relaciones
    items_lista = relationship("ItemListaPrecios", back_populates="servicio")

    def __repr__(self) -> str:
        return f"<Servicio {self.codigo}: {self.nombre}>"


class ItemListaPrecios(Base):
    """
    Modelo de Item de Lista de Precios.
    Precio de un servicio en una lista específica.
    """
    __tablename__ = "items_lista_precios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Lista y Servicio
    lista_id = Column(UUID(as_uuid=True), ForeignKey("listas_precios.id"), nullable=False)
    servicio_id = Column(UUID(as_uuid=True), ForeignKey("servicios.id"), nullable=False)

    # Precio
    precio = Column(Numeric(12, 2), nullable=False)

    # Precio mínimo (para servicios por kg con mínimo)
    precio_minimo = Column(Numeric(12, 2), nullable=True)
    cantidad_minima = Column(Numeric(10, 2), nullable=True)

    # Vigencia específica (override de la lista)
    fecha_vigencia_desde = Column(Date, nullable=True)
    fecha_vigencia_hasta = Column(Date, nullable=True)

    # Estado
    activo = Column(Boolean, default=True)

    # Relaciones
    lista = relationship("ListaPrecios", back_populates="items")
    servicio = relationship("Servicio", back_populates="items_lista")

    def __repr__(self) -> str:
        return f"<ItemListaPrecios {self.servicio_id} en {self.lista_id}: ${self.precio}>"
