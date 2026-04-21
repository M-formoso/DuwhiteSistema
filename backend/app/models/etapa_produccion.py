"""
Modelo de Etapa de Producción.
"""

from sqlalchemy import Boolean, Column, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.db.base import Base
from app.models.base import TimestampMixin


class EtapaProduccion(Base, TimestampMixin):
    """
    Etapa del proceso productivo.

    Etapas predefinidas para lavandería industrial:
    - Recepción: Ingreso y pesaje de ropa
    - Clasificación: Separación por tipo/color
    - Lavado: Proceso de lavado
    - Secado: Secado industrial
    - Planchado: Planchado y doblado
    - Control de Calidad: Inspección final
    - Empaque: Preparación para entrega
    - Entrega: Listo para despacho
    """

    __tablename__ = "etapas_produccion"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Identificación
    codigo = Column(String(20), unique=True, nullable=False)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=True)

    # Orden en el flujo
    orden = Column(Integer, nullable=False, default=0)

    # Color para Kanban (hex)
    color = Column(String(7), default="#00BCD4")

    # Configuración
    es_inicial = Column(Boolean, default=False)  # Primera etapa
    es_final = Column(Boolean, default=False)    # Última etapa
    requiere_peso = Column(Boolean, default=False)  # Si requiere registrar peso
    requiere_maquina = Column(Boolean, default=False)  # Si usa máquina específica
    tiempo_estimado_minutos = Column(Integer, nullable=True)  # Tiempo promedio

    # Configuración de bifurcación (para etapas como Estirado)
    permite_bifurcacion = Column(Boolean, default=False)  # Si permite dividir el lote
    etapa_destino_principal_id = Column(
        UUID(as_uuid=True),
        nullable=True,
    )  # Etapa destino por defecto (ej: Secado)
    etapa_destino_alternativa_id = Column(
        UUID(as_uuid=True),
        nullable=True,
    )  # Etapa alternativa (ej: Lavado)

    # Siguiente etapa específica (para saltar etapas, ej: Secado -> Conteo, saltando Planchado)
    siguiente_etapa_id = Column(
        UUID(as_uuid=True),
        nullable=True,
    )

    # Estado
    activo = Column(Boolean, default=True, nullable=False)

    # Relaciones
    lotes_etapa = relationship("LoteEtapa", back_populates="etapa")

    def __repr__(self) -> str:
        return f"<EtapaProduccion {self.codigo}: {self.nombre}>"
