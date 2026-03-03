"""
Modelos de Costos para DUWHITE ERP
"""

from sqlalchemy import Column, String, Numeric, Date, Boolean, Text, ForeignKey, Integer, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from decimal import Decimal

from app.db.base import Base
from app.models.base import BaseModelMixin


class TipoCosto(str, enum.Enum):
    """Tipos de costo"""
    FIJO = "fijo"  # Alquiler, sueldos fijos, seguros
    VARIABLE = "variable"  # Insumos, energía por uso
    SEMIVARIABLE = "semivariable"  # Parte fija + parte variable


class CategoriaCosto(str, enum.Enum):
    """Categorías de costos"""
    MANO_OBRA = "mano_obra"
    INSUMOS = "insumos"
    ENERGIA = "energia"
    ALQUILER = "alquiler"
    MANTENIMIENTO = "mantenimiento"
    TRANSPORTE = "transporte"
    ADMINISTRATIVO = "administrativo"
    IMPUESTOS = "impuestos"
    DEPRECIACION = "depreciacion"
    OTROS = "otros"


class CostoFijo(Base, BaseModelMixin):
    """
    Modelo de Costos Fijos Mensuales
    Representa gastos recurrentes que no varían con la producción
    """
    __tablename__ = "costos_fijos"

    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=True)
    categoria = Column(String(30), nullable=False, default=CategoriaCosto.OTROS.value)

    # Monto mensual
    monto_mensual = Column(Numeric(12, 2), nullable=False)

    # Período de vigencia
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=True)  # NULL = vigente indefinidamente

    # Para prorrateo
    dias_mes = Column(Integer, default=30)  # Para calcular costo diario

    notas = Column(Text, nullable=True)


class CostoVariable(Base, BaseModelMixin):
    """
    Modelo de Costos Variables por Unidad
    Representa costos que varían según la producción
    """
    __tablename__ = "costos_variables"

    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=True)
    categoria = Column(String(30), nullable=False, default=CategoriaCosto.INSUMOS.value)

    # Costo por unidad de medida
    costo_por_unidad = Column(Numeric(10, 4), nullable=False)
    unidad_medida = Column(String(20), nullable=False)  # kg, litro, unidad, kwh

    # Consumo promedio por kg procesado (para cálculos)
    consumo_por_kg = Column(Numeric(10, 4), nullable=True)

    # Vinculación con insumo (si aplica)
    insumo_id = Column(UUID(as_uuid=True), ForeignKey("insumos.id"), nullable=True)

    notas = Column(Text, nullable=True)

    # Relationships
    insumo = relationship("Insumo")


class TarifaServicio(Base, BaseModelMixin):
    """
    Modelo de Tarifas y Costos por Servicio
    Vincula servicios con sus costos estimados y precios
    """
    __tablename__ = "tarifas_servicios"

    servicio_id = Column(UUID(as_uuid=True), ForeignKey("servicios.id"), nullable=False, index=True)

    # Costos estimados por unidad de servicio
    costo_mano_obra = Column(Numeric(10, 2), nullable=False, default=0)
    costo_insumos = Column(Numeric(10, 2), nullable=False, default=0)
    costo_energia = Column(Numeric(10, 2), nullable=False, default=0)
    costo_otros = Column(Numeric(10, 2), nullable=False, default=0)

    # Costo total calculado
    costo_total = Column(Numeric(10, 2), nullable=False, default=0)

    # Precio de venta sugerido
    precio_sugerido = Column(Numeric(10, 2), nullable=True)
    margen_objetivo = Column(Numeric(5, 2), nullable=True)  # Porcentaje: 30 = 30%

    # Tiempo estimado de proceso (minutos por unidad)
    tiempo_proceso = Column(Integer, nullable=True)

    # Vigencia
    fecha_vigencia = Column(Date, nullable=False)

    notas = Column(Text, nullable=True)

    # Relationships
    servicio = relationship("Servicio")

    @property
    def margen_real(self) -> Decimal:
        """Calcula el margen real basado en precio y costo"""
        if self.precio_sugerido and self.costo_total and self.costo_total > 0:
            return ((self.precio_sugerido - self.costo_total) / self.precio_sugerido) * 100
        return Decimal("0")


class AnalisisCostoLote(Base, BaseModelMixin):
    """
    Modelo de Análisis de Costo por Lote de Producción
    Registra los costos reales de cada lote procesado
    """
    __tablename__ = "analisis_costos_lotes"

    lote_id = Column(UUID(as_uuid=True), ForeignKey("lotes_produccion.id"), nullable=False, unique=True, index=True)

    # Costos directos registrados
    costo_insumos = Column(Numeric(12, 2), nullable=False, default=0)
    costo_mano_obra = Column(Numeric(12, 2), nullable=False, default=0)
    costo_energia = Column(Numeric(12, 2), nullable=False, default=0)

    # Prorrateo de costos fijos
    costo_fijos_prorrateado = Column(Numeric(12, 2), nullable=False, default=0)

    # Otros costos
    costo_otros = Column(Numeric(12, 2), nullable=False, default=0)

    # Totales
    costo_total = Column(Numeric(12, 2), nullable=False, default=0)

    # Métricas
    kg_procesados = Column(Numeric(10, 2), nullable=True)
    costo_por_kg = Column(Numeric(10, 4), nullable=True)

    # Ingresos del lote (si está vinculado a pedido)
    ingreso_total = Column(Numeric(12, 2), nullable=True)
    margen_bruto = Column(Numeric(12, 2), nullable=True)
    margen_porcentaje = Column(Numeric(5, 2), nullable=True)

    # Comparación con estimado
    costo_estimado = Column(Numeric(12, 2), nullable=True)
    variacion = Column(Numeric(12, 2), nullable=True)  # Diferencia real vs estimado

    notas = Column(Text, nullable=True)

    # Relationships
    lote = relationship("LoteProduccion")


class ParametroCosto(Base, BaseModelMixin):
    """
    Modelo de Parámetros de Costo del Sistema
    Almacena configuraciones para cálculos de costos
    """
    __tablename__ = "parametros_costos"

    clave = Column(String(50), unique=True, nullable=False, index=True)
    valor = Column(String(100), nullable=False)
    descripcion = Column(Text, nullable=True)
    tipo_dato = Column(String(20), nullable=False, default="decimal")  # decimal, entero, texto
    categoria = Column(String(50), nullable=True)


# Parámetros predefinidos que se crearán en la migración:
# - costo_kwh: Costo por kWh de energía
# - costo_m3_agua: Costo por m3 de agua
# - costo_m3_gas: Costo por m3 de gas
# - horas_trabajo_mes: Horas laborales mensuales promedio
# - capacidad_kg_dia: Capacidad de procesamiento diaria en kg
# - margen_minimo: Margen mínimo objetivo (%)
# - factor_mano_obra: Factor de costo de mano de obra por hora
