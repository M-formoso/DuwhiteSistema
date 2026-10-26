"""
Modelo Vehiculo — catálogo local sincronizado con GeoTrackers.

GeoTrackers tiene la telemetría (dónde está, qué velocidad). DUWHITE tiene
la lógica de negocio (qué vehículo lleva qué lote o qué remito). Esta
tabla local es el puente: guardamos una fila por vehículo con
``geotrackers_id`` como identificador externo estable, y desde Lote y
Remito referenciamos por ``vehiculo_id`` (FK a esta tabla).

El `nombre` y `patente` se duplican desde GeoTrackers para que los
selectores de UI funcionen sin tener que hacer un roundtrip extra a la
API externa cada vez.
"""

from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.base import BaseModelMixin


class Vehiculo(Base, BaseModelMixin):
    __tablename__ = "vehiculos"

    # Identificador en GeoTrackers (el `id` que devuelve su API).
    # Es la fuente de verdad para hacer el join con la telemetría.
    geotrackers_id = Column(Integer, unique=True, nullable=False, index=True)

    # Snapshot de datos de GeoTrackers (se refresca con sincronizar).
    patente = Column(String(20), nullable=False, index=True)
    nombre = Column(String(100), nullable=True)
    imei = Column(String(30), nullable=True)

    # Metadatos operativos propios de DUWHITE (opcionales).
    chofer_default = Column(String(100), nullable=True)
    notas = Column(String(500), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Vehiculo {self.patente} ({self.nombre})>"
