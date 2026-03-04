"""
Modelo de Lote de Producción.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.db.base import Base
from app.models.base import BaseModelMixin, TimestampMixin


class EstadoLote(str, Enum):
    """Estados de un lote de producción."""
    PENDIENTE = "pendiente"
    EN_PROCESO = "en_proceso"
    PAUSADO = "pausado"
    COMPLETADO = "completado"
    CANCELADO = "cancelado"


class PrioridadLote(str, Enum):
    """Prioridad del lote."""
    BAJA = "baja"
    NORMAL = "normal"
    ALTA = "alta"
    URGENTE = "urgente"


class TipoServicio(str, Enum):
    """Tipo de servicio de lavado."""
    LAVADO_NORMAL = "lavado_normal"
    LAVADO_DELICADO = "lavado_delicado"
    LAVADO_INDUSTRIAL = "lavado_industrial"
    LAVADO_SECO = "lavado_seco"
    PLANCHADO_SOLO = "planchado_solo"
    TINTORERIA = "tintoreria"


class LoteProduccion(Base, BaseModelMixin):
    """
    Lote de producción (conjunto de prendas a procesar).

    Representa un conjunto de prendas que se procesan juntas
    a través de las distintas etapas de producción.
    """

    __tablename__ = "lotes_produccion"

    # Número de lote (autogenerado)
    numero = Column(String(20), unique=True, nullable=False, index=True)

    # Cliente (opcional, puede ser lote interno)
    cliente_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clientes.id"),
        nullable=True,
        index=True,
    )

    # Pedido asociado (opcional)
    pedido_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pedidos.id"),
        nullable=True,
    )

    # Orden de producción (opcional)
    orden_produccion_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ordenes_produccion.id"),
        nullable=True,
        index=True,
    )

    # Tipo de servicio
    tipo_servicio = Column(String(30), nullable=False, default=TipoServicio.LAVADO_NORMAL.value)

    # Estado y prioridad
    estado = Column(String(20), nullable=False, default=EstadoLote.PENDIENTE.value, index=True)
    prioridad = Column(String(20), nullable=False, default=PrioridadLote.NORMAL.value)

    # Etapa actual
    etapa_actual_id = Column(
        UUID(as_uuid=True),
        ForeignKey("etapas_produccion.id"),
        nullable=True,
    )

    # Pesos
    peso_entrada_kg = Column(Numeric(10, 2), nullable=True)  # Peso al ingresar
    peso_salida_kg = Column(Numeric(10, 2), nullable=True)   # Peso al finalizar

    # Cantidad de prendas
    cantidad_prendas = Column(Integer, nullable=True)

    # Fechas
    fecha_ingreso = Column(DateTime, nullable=False, default=datetime.utcnow)
    fecha_compromiso = Column(DateTime, nullable=True)  # Fecha prometida al cliente
    fecha_inicio_proceso = Column(DateTime, nullable=True)
    fecha_fin_proceso = Column(DateTime, nullable=True)

    # Usuario que creó el lote
    creado_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=False,
    )

    # Descripción y notas
    descripcion = Column(Text, nullable=True)  # Descripción de las prendas
    notas_internas = Column(Text, nullable=True)
    notas_cliente = Column(Text, nullable=True)  # Instrucciones del cliente

    # Observaciones de calidad
    observaciones_calidad = Column(Text, nullable=True)
    tiene_manchas = Column(Boolean, default=False)
    tiene_roturas = Column(Boolean, default=False)

    # Relaciones
    cliente = relationship("Cliente", back_populates="lotes")
    pedido = relationship("Pedido", back_populates="lotes")
    orden_produccion = relationship("OrdenProduccion", back_populates="lotes")
    etapa_actual = relationship("EtapaProduccion")
    creado_por = relationship("Usuario")
    etapas = relationship(
        "LoteEtapa",
        back_populates="lote",
        order_by="LoteEtapa.orden",
        cascade="all, delete-orphan",
    )
    consumos_insumo = relationship("ConsumoInsumoLote", back_populates="lote")

    def __repr__(self) -> str:
        return f"<LoteProduccion {self.numero}>"

    @property
    def tiempo_en_proceso(self) -> int:
        """Minutos transcurridos desde inicio del proceso."""
        if not self.fecha_inicio_proceso:
            return 0
        fin = self.fecha_fin_proceso or datetime.utcnow()
        delta = fin - self.fecha_inicio_proceso
        return int(delta.total_seconds() / 60)

    @property
    def esta_atrasado(self) -> bool:
        """Indica si el lote está atrasado respecto a la fecha compromiso."""
        if not self.fecha_compromiso:
            return False
        if self.estado == EstadoLote.COMPLETADO.value:
            return self.fecha_fin_proceso and self.fecha_fin_proceso > self.fecha_compromiso
        return datetime.utcnow() > self.fecha_compromiso

    @property
    def porcentaje_avance(self) -> int:
        """Calcula el porcentaje de avance basado en etapas completadas."""
        if not self.etapas:
            return 0
        completadas = sum(1 for e in self.etapas if e.fecha_fin is not None)
        return int((completadas / len(self.etapas)) * 100)


class LoteEtapa(Base, TimestampMixin):
    """
    Registro del paso de un lote por una etapa.

    Mantiene el historial de cada etapa por la que pasa el lote,
    incluyendo tiempos, responsables y observaciones.
    """

    __tablename__ = "lotes_etapas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Lote y Etapa
    lote_id = Column(
        UUID(as_uuid=True),
        ForeignKey("lotes_produccion.id"),
        nullable=False,
        index=True,
    )
    etapa_id = Column(
        UUID(as_uuid=True),
        ForeignKey("etapas_produccion.id"),
        nullable=False,
    )

    # Orden en el flujo del lote
    orden = Column(Integer, nullable=False)

    # Estado de esta etapa para el lote
    estado = Column(String(20), default="pendiente")  # pendiente, en_proceso, completado, saltado

    # Fechas
    fecha_inicio = Column(DateTime, nullable=True)
    fecha_fin = Column(DateTime, nullable=True)

    # Responsable
    responsable_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=True,
    )

    # Máquina utilizada (si aplica)
    maquina_id = Column(
        UUID(as_uuid=True),
        ForeignKey("maquinas.id"),
        nullable=True,
    )

    # Peso registrado en esta etapa (si aplica)
    peso_kg = Column(Numeric(10, 2), nullable=True)

    # Observaciones
    observaciones = Column(Text, nullable=True)

    # Relaciones
    lote = relationship("LoteProduccion", back_populates="etapas")
    etapa = relationship("EtapaProduccion", back_populates="lotes_etapa")
    responsable = relationship("Usuario")
    maquina = relationship("Maquina")

    def __repr__(self) -> str:
        return f"<LoteEtapa {self.lote_id} - {self.etapa_id}>"

    @property
    def duracion_minutos(self) -> int:
        """Duración de la etapa en minutos."""
        if not self.fecha_inicio or not self.fecha_fin:
            return 0
        delta = self.fecha_fin - self.fecha_inicio
        return int(delta.total_seconds() / 60)


class ConsumoInsumoLote(Base, TimestampMixin):
    """
    Registro de consumo de insumos por lote.
    """

    __tablename__ = "consumos_insumo_lote"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Lote
    lote_id = Column(
        UUID(as_uuid=True),
        ForeignKey("lotes_produccion.id"),
        nullable=False,
        index=True,
    )

    # Insumo consumido
    insumo_id = Column(
        UUID(as_uuid=True),
        ForeignKey("insumos.id"),
        nullable=False,
    )

    # Etapa donde se consumió
    etapa_id = Column(
        UUID(as_uuid=True),
        ForeignKey("etapas_produccion.id"),
        nullable=True,
    )

    # Cantidad
    cantidad = Column(Numeric(10, 3), nullable=False)
    unidad = Column(String(20), nullable=False)

    # Costo (al momento del consumo)
    costo_unitario = Column(Numeric(12, 2), nullable=True)
    costo_total = Column(Numeric(12, 2), nullable=True)

    # Usuario que registró
    registrado_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=False,
    )

    # Notas
    notas = Column(Text, nullable=True)

    # Relaciones
    lote = relationship("LoteProduccion", back_populates="consumos_insumo")
    insumo = relationship("Insumo")
    etapa = relationship("EtapaProduccion")
    registrado_por = relationship("Usuario")

    def __repr__(self) -> str:
        return f"<ConsumoInsumoLote {self.lote_id}: {self.cantidad} {self.unidad}>"


# Importar TimestampMixin para LoteEtapa y ConsumoInsumoLote
from app.models.base import TimestampMixin
