"""
Modelo de Orden de Producción.
"""

from datetime import datetime, date
from decimal import Decimal
from enum import Enum

from sqlalchemy import Boolean, Column, DateTime, Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.db.base import Base
from app.models.base import BaseModelMixin, TimestampMixin


class EstadoOrdenProduccion(str, Enum):
    """Estados de una orden de producción."""
    BORRADOR = "borrador"
    PENDIENTE = "pendiente"
    EN_PROCESO = "en_proceso"
    PAUSADA = "pausada"
    COMPLETADA = "completada"
    CANCELADA = "cancelada"


class PrioridadOrden(str, Enum):
    """Prioridad de la orden de producción."""
    BAJA = "baja"
    NORMAL = "normal"
    ALTA = "alta"
    URGENTE = "urgente"


class OrdenProduccion(Base, BaseModelMixin):
    """
    Orden de Producción (OP-XXXX).

    Agrupa uno o más lotes de producción bajo un número de orden
    para su seguimiento y planificación.
    """

    __tablename__ = "ordenes_produccion"

    # Número de orden (formato OP-YYYY-NNNNN)
    numero = Column(String(20), unique=True, nullable=False, index=True)

    # Cliente
    cliente_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clientes.id"),
        nullable=True,
        index=True,
    )

    # Pedido origen (si la OP viene de un pedido)
    pedido_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pedidos.id"),
        nullable=True,
    )

    # Estado y prioridad
    estado = Column(String(20), nullable=False, default=EstadoOrdenProduccion.BORRADOR.value, index=True)
    prioridad = Column(String(20), nullable=False, default=PrioridadOrden.NORMAL.value)

    # Fechas de planificación
    fecha_emision = Column(Date, nullable=False, default=date.today)
    fecha_programada_inicio = Column(Date, nullable=True)
    fecha_programada_fin = Column(Date, nullable=True)
    fecha_inicio_real = Column(DateTime, nullable=True)
    fecha_fin_real = Column(DateTime, nullable=True)

    # Descripción del trabajo
    descripcion = Column(Text, nullable=True)
    instrucciones_especiales = Column(Text, nullable=True)

    # Cantidad estimada
    cantidad_prendas_estimada = Column(Integer, nullable=True)
    peso_estimado_kg = Column(Numeric(10, 2), nullable=True)

    # Cantidad real procesada
    cantidad_prendas_real = Column(Integer, nullable=True)
    peso_real_kg = Column(Numeric(10, 2), nullable=True)

    # Responsable asignado
    responsable_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=True,
    )

    # Usuario que creó la orden
    creado_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=False,
    )

    # Notas
    notas_internas = Column(Text, nullable=True)
    notas_produccion = Column(Text, nullable=True)

    # Estado activo
    activo = Column(Boolean, default=True, nullable=False)

    # Relaciones
    cliente = relationship("Cliente")
    pedido = relationship("Pedido")
    responsable = relationship("Usuario", foreign_keys=[responsable_id])
    creado_por = relationship("Usuario", foreign_keys=[creado_por_id])
    lotes = relationship("LoteProduccion", back_populates="orden_produccion")
    asignaciones_empleados = relationship("AsignacionEmpleadoOP", back_populates="orden")
    incidencias = relationship("IncidenciaProduccion", back_populates="orden")

    def __repr__(self) -> str:
        return f"<OrdenProduccion {self.numero}>"

    @property
    def porcentaje_avance(self) -> int:
        """Calcula el porcentaje de avance basado en los lotes."""
        if not self.lotes:
            return 0
        completados = sum(1 for l in self.lotes if l.estado == "completado")
        return int((completados / len(self.lotes)) * 100)

    @property
    def esta_atrasada(self) -> bool:
        """Indica si la orden está atrasada."""
        if not self.fecha_programada_fin:
            return False
        if self.estado == EstadoOrdenProduccion.COMPLETADA.value:
            return False
        return date.today() > self.fecha_programada_fin

    @property
    def dias_restantes(self) -> int:
        """Días restantes hasta la fecha programada de fin."""
        if not self.fecha_programada_fin:
            return 0
        delta = self.fecha_programada_fin - date.today()
        return delta.days


class AsignacionEmpleadoOP(Base, TimestampMixin):
    """
    Asignación de empleados a órdenes de producción por etapa.
    """

    __tablename__ = "asignaciones_empleado_op"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Orden de producción
    orden_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ordenes_produccion.id"),
        nullable=False,
        index=True,
    )

    # Empleado asignado
    empleado_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=False,
    )

    # Etapa asignada (opcional, puede ser asignación general)
    etapa_id = Column(
        UUID(as_uuid=True),
        ForeignKey("etapas_produccion.id"),
        nullable=True,
    )

    # Fecha de asignación
    fecha_asignacion = Column(Date, nullable=False, default=date.today)
    fecha_fin_asignacion = Column(Date, nullable=True)

    # Turno (mañana, tarde, noche)
    turno = Column(String(20), nullable=True)

    # Horas estimadas
    horas_estimadas = Column(Numeric(5, 2), nullable=True)
    horas_trabajadas = Column(Numeric(5, 2), nullable=True)

    # Notas
    notas = Column(Text, nullable=True)

    # Estado activo
    activo = Column(Boolean, default=True, nullable=False)

    # Relaciones
    orden = relationship("OrdenProduccion", back_populates="asignaciones_empleados")
    empleado = relationship("Usuario")
    etapa = relationship("EtapaProduccion")

    def __repr__(self) -> str:
        return f"<AsignacionEmpleadoOP {self.orden_id} - {self.empleado_id}>"


class IncidenciaProduccion(Base, TimestampMixin):
    """
    Registro de incidencias en producción con soporte para fotos.
    """

    __tablename__ = "incidencias_produccion"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Orden de producción
    orden_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ordenes_produccion.id"),
        nullable=True,
        index=True,
    )

    # Lote específico (opcional)
    lote_id = Column(
        UUID(as_uuid=True),
        ForeignKey("lotes_produccion.id"),
        nullable=True,
    )

    # Etapa donde ocurrió
    etapa_id = Column(
        UUID(as_uuid=True),
        ForeignKey("etapas_produccion.id"),
        nullable=True,
    )

    # Tipo de incidencia
    tipo = Column(String(50), nullable=False)  # averia_maquina, defecto_calidad, falta_insumo, accidente, otro

    # Severidad
    severidad = Column(String(20), nullable=False, default="media")  # baja, media, alta, critica

    # Descripción
    titulo = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=True)

    # Fechas
    fecha_incidencia = Column(DateTime, nullable=False, default=datetime.utcnow)
    fecha_resolucion = Column(DateTime, nullable=True)

    # Estado
    estado = Column(String(20), nullable=False, default="abierta")  # abierta, en_proceso, resuelta, cerrada

    # Fotos (almacena rutas de archivos, separadas por coma)
    fotos = Column(Text, nullable=True)

    # Usuario que reportó
    reportado_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=False,
    )

    # Usuario que resolvió
    resuelto_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id"),
        nullable=True,
    )

    # Acciones tomadas
    acciones_tomadas = Column(Text, nullable=True)

    # Impacto en producción
    tiempo_perdido_minutos = Column(Integer, nullable=True)
    costo_estimado = Column(Numeric(12, 2), nullable=True)

    # Relaciones
    orden = relationship("OrdenProduccion", back_populates="incidencias")
    lote = relationship("LoteProduccion")
    etapa = relationship("EtapaProduccion")
    reportado_por = relationship("Usuario", foreign_keys=[reportado_por_id])
    resuelto_por = relationship("Usuario", foreign_keys=[resuelto_por_id])

    def __repr__(self) -> str:
        return f"<IncidenciaProduccion {self.id}: {self.titulo}>"

    @property
    def fotos_lista(self) -> list:
        """Devuelve las fotos como lista."""
        if not self.fotos:
            return []
        return [f.strip() for f in self.fotos.split(",") if f.strip()]

    def agregar_foto(self, ruta: str) -> None:
        """Agrega una foto a la lista."""
        fotos_actuales = self.fotos_lista
        fotos_actuales.append(ruta)
        self.fotos = ",".join(fotos_actuales)
