"""Modelo CategoriaGasto — categorías de gastos recurrentes de la casa.

Un egreso siempre va contra algo: un proveedor (compra concreta) o una
categoría de gasto (ARCA, EPEC, sindicato, seguros, obras varias, etc).
La casa venía manejando esto en una planilla; migramos esas categorías
tal cual, con un botón "+" para que la administradora pueda sumar más
sin tocar código.
"""

from sqlalchemy import Boolean, Column, String

from app.db.base import Base
from app.models.base import BaseModelMixin


class CategoriaGasto(Base, BaseModelMixin):
    __tablename__ = "categorias_gasto"

    nombre = Column(String(100), nullable=False, unique=True, index=True)
    activo = Column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<CategoriaGasto {self.nombre}>"
