"""
Schemas de Lote de Producción.
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.lote_produccion import EstadoLote, PrioridadLote, TipoServicio


# ==================== LOTE ETAPA MAQUINA ====================

class LoteEtapaMaquinaBase(BaseModel):
    """Base schema para máquina asignada a una etapa."""
    maquina_id: UUID


class LoteEtapaMaquinaResponse(LoteEtapaMaquinaBase):
    """Schema de respuesta para máquina asignada."""
    id: UUID
    lote_etapa_id: UUID
    fecha_asignacion: datetime
    fecha_liberacion: Optional[datetime] = None
    maquina_codigo: Optional[str] = None
    maquina_nombre: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== LOTE ETAPA ====================

class LoteEtapaBase(BaseModel):
    """Base schema para etapa de lote."""
    etapa_id: UUID
    orden: int = Field(..., ge=0)
    estado: str = Field(default="pendiente")
    responsable_id: Optional[UUID] = None
    maquina_id: Optional[UUID] = None  # Mantener por compatibilidad
    maquinas_ids: Optional[List[UUID]] = None  # Nuevo: múltiples máquinas
    peso_kg: Optional[Decimal] = Field(None, ge=0)
    observaciones: Optional[str] = None


class LoteEtapaCreate(LoteEtapaBase):
    """Schema para crear etapa de lote."""
    pass


class LoteEtapaUpdate(BaseModel):
    """Schema para actualizar etapa de lote."""
    estado: Optional[str] = None
    responsable_id: Optional[UUID] = None
    maquina_id: Optional[UUID] = None  # Mantener por compatibilidad
    maquinas_ids: Optional[List[UUID]] = None  # Nuevo: múltiples máquinas
    peso_kg: Optional[Decimal] = Field(None, ge=0)
    observaciones: Optional[str] = None


class LoteEtapaInDB(LoteEtapaBase):
    """Schema de etapa de lote en BD."""
    id: UUID
    lote_id: UUID
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LoteEtapaResponse(LoteEtapaInDB):
    """Schema de respuesta de etapa de lote."""
    etapa_codigo: Optional[str] = None
    etapa_nombre: Optional[str] = None
    etapa_color: Optional[str] = None
    responsable_nombre: Optional[str] = None
    maquina_nombre: Optional[str] = None  # Primera máquina (compatibilidad)
    maquinas: List[LoteEtapaMaquinaResponse] = []  # Todas las máquinas
    duracion_minutos: int = 0


# ==================== CONSUMO INSUMO ====================

class ConsumoInsumoLoteBase(BaseModel):
    """Base schema para consumo de insumo."""
    insumo_id: UUID
    etapa_id: Optional[UUID] = None
    cantidad: Decimal = Field(..., gt=0)
    unidad: str = Field(..., max_length=20)
    notas: Optional[str] = None


class ConsumoInsumoLoteCreate(ConsumoInsumoLoteBase):
    """Schema para crear consumo."""
    pass


class ConsumoInsumoLoteResponse(ConsumoInsumoLoteBase):
    """Schema de respuesta de consumo."""
    id: UUID
    lote_id: UUID
    costo_unitario: Optional[Decimal] = None
    costo_total: Optional[Decimal] = None
    registrado_por_id: UUID
    registrado_por_nombre: Optional[str] = None
    insumo_codigo: Optional[str] = None
    insumo_nombre: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== LOTE PRODUCCIÓN ====================

class LoteProduccionBase(BaseModel):
    """Base schema para lote de producción."""
    cliente_id: Optional[UUID] = None
    pedido_id: Optional[UUID] = None
    tipo_servicio: TipoServicio = TipoServicio.LAVADO_NORMAL
    prioridad: PrioridadLote = PrioridadLote.NORMAL
    peso_entrada_kg: Optional[Decimal] = Field(None, ge=0)
    cantidad_prendas: Optional[int] = Field(None, ge=0)
    fecha_compromiso: Optional[datetime] = None
    descripcion: Optional[str] = None
    notas_internas: Optional[str] = None
    notas_cliente: Optional[str] = None
    tiene_manchas: bool = False
    tiene_roturas: bool = False


class LoteProduccionCreate(LoteProduccionBase):
    """Schema para crear lote."""
    pass


class LoteProduccionUpdate(BaseModel):
    """Schema para actualizar lote."""
    cliente_id: Optional[UUID] = None
    pedido_id: Optional[UUID] = None
    tipo_servicio: Optional[TipoServicio] = None
    prioridad: Optional[PrioridadLote] = None
    peso_entrada_kg: Optional[Decimal] = Field(None, ge=0)
    peso_salida_kg: Optional[Decimal] = Field(None, ge=0)
    cantidad_prendas: Optional[int] = Field(None, ge=0)
    fecha_compromiso: Optional[datetime] = None
    descripcion: Optional[str] = None
    notas_internas: Optional[str] = None
    notas_cliente: Optional[str] = None
    observaciones_calidad: Optional[str] = None
    tiene_manchas: Optional[bool] = None
    tiene_roturas: Optional[bool] = None


class LoteProduccionInDB(LoteProduccionBase):
    """Schema de lote en BD."""
    id: UUID
    numero: str
    estado: EstadoLote
    etapa_actual_id: Optional[UUID] = None
    peso_salida_kg: Optional[Decimal] = None
    fecha_ingreso: datetime
    fecha_inicio_proceso: Optional[datetime] = None
    fecha_fin_proceso: Optional[datetime] = None
    creado_por_id: UUID
    observaciones_calidad: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool = True

    class Config:
        from_attributes = True


class LoteProduccionResponse(LoteProduccionInDB):
    """Schema de respuesta de lote."""
    cliente_nombre: Optional[str] = None
    pedido_numero: Optional[str] = None
    etapa_actual_nombre: Optional[str] = None
    etapa_actual_color: Optional[str] = None
    creado_por_nombre: Optional[str] = None
    tiempo_en_proceso: int = 0
    esta_atrasado: bool = False
    porcentaje_avance: int = 0
    etapas: List[LoteEtapaResponse] = []


class LoteProduccionList(BaseModel):
    """Schema para lista de lotes."""
    id: UUID
    numero: str
    cliente_nombre: Optional[str] = None
    tipo_servicio: TipoServicio
    estado: EstadoLote
    prioridad: PrioridadLote
    etapa_actual_nombre: Optional[str] = None
    etapa_actual_color: Optional[str] = None
    peso_entrada_kg: Optional[Decimal] = None
    fecha_ingreso: datetime
    fecha_compromiso: Optional[datetime] = None
    esta_atrasado: bool = False
    porcentaje_avance: int = 0

    class Config:
        from_attributes = True


# ==================== KANBAN ====================

class KanbanCanasto(BaseModel):
    """Schema para canasto en el Kanban."""
    id: UUID
    numero: int
    codigo: str


class KanbanLote(BaseModel):
    """Schema para lote en el Kanban."""
    id: UUID
    numero: str
    cliente_nombre: Optional[str] = None
    tipo_servicio: TipoServicio
    prioridad: PrioridadLote
    peso_entrada_kg: Optional[Decimal] = None
    cantidad_prendas: Optional[int] = None
    fecha_compromiso: Optional[datetime] = None
    esta_atrasado: bool = False
    tiempo_en_etapa_minutos: int = 0
    etapa_en_proceso: bool = False  # True si la etapa actual tiene fecha_inicio pero no fecha_fin
    fecha_inicio_etapa: Optional[datetime] = None  # Para timer en tiempo real
    tipo_lote: str = "normal"  # normal o relevado
    lote_padre_numero: Optional[str] = None  # Si es relevado, número del lote padre
    canastos: List[KanbanCanasto] = []  # Canastos asignados al lote

    class Config:
        from_attributes = True


class KanbanColumna(BaseModel):
    """Schema para columna del Kanban."""
    etapa_id: UUID
    etapa_codigo: str
    etapa_nombre: str
    etapa_color: str
    orden: int
    tiempo_estimado_minutos: Optional[int] = None
    requiere_maquina: bool = False
    tipo_maquina: Optional[str] = None  # lavadora, secadora, planchadora según código de etapa
    permite_bifurcacion: bool = False  # Si la etapa permite dividir lotes
    lotes: List[KanbanLote] = []


class KanbanBoard(BaseModel):
    """Schema para tablero Kanban completo."""
    columnas: List[KanbanColumna] = []
    total_lotes: int = 0
    lotes_atrasados: int = 0


# ==================== ACCIONES ====================

class IniciarEtapaRequest(BaseModel):
    """Schema para iniciar una etapa."""
    responsable_id: Optional[UUID] = None
    maquina_id: Optional[UUID] = None  # Mantener por compatibilidad
    maquinas_ids: Optional[List[UUID]] = None  # Nuevo: múltiples máquinas
    observaciones: Optional[str] = None
    # Para validación con PIN del operario
    operario_id: Optional[UUID] = None
    pin: Optional[str] = Field(None, min_length=4, max_length=6)
    # Peso de entrada (para etapa Recepción y Pesaje)
    peso_kg: Optional[Decimal] = Field(None, ge=0)
    # Canastos asignados (para etapas LAV, SEC)
    canastos_ids: Optional[List[UUID]] = None


class FinalizarEtapaRequest(BaseModel):
    """Schema para finalizar una etapa."""
    peso_kg: Optional[Decimal] = Field(None, ge=0)
    observaciones: Optional[str] = None
    # Para validación con PIN del operario
    operario_id: Optional[UUID] = None
    pin: Optional[str] = Field(None, min_length=4, max_length=6)
    # Campos para cargo en cuenta corriente (solo aplican si es la última etapa)
    monto_cobro: Optional[Decimal] = Field(
        None, ge=0,
        description="Monto a cobrar al cliente. Solo aplica si es la última etapa y el lote tiene cliente."
    )
    estado_facturacion: Optional[str] = Field(
        default="sin_facturar",
        description="Estado de facturación: sin_facturar, factura_a, factura_b, ticket"
    )


class MoverLoteRequest(BaseModel):
    """Schema para mover lote a otra etapa."""
    etapa_destino_id: UUID
    responsable_id: Optional[UUID] = None
    observaciones: Optional[str] = None
    # Para validación con PIN del operario
    operario_id: Optional[UUID] = None
    pin: Optional[str] = Field(None, min_length=4, max_length=6)


class CambiarEstadoLoteRequest(BaseModel):
    """Schema para cambiar estado del lote."""
    estado: EstadoLote
    observaciones: Optional[str] = None
    # Para validación con PIN del operario
    operario_id: Optional[UUID] = None
    pin: Optional[str] = Field(None, min_length=4, max_length=6)


class ValidarPinRequest(BaseModel):
    """Schema para validar PIN de operario."""
    operario_id: UUID
    pin: str = Field(..., min_length=4, max_length=6)


class ValidarPinResponse(BaseModel):
    """Schema de respuesta de validación de PIN."""
    valido: bool
    operario_id: UUID
    operario_nombre: str
    mensaje: Optional[str] = None


# ==================== LOTE DIRECTO (con cargo automático a CC) ====================

class LoteDirectoCreate(BaseModel):
    """Schema para crear un lote directo con cargo automático a cuenta corriente."""
    cliente_id: UUID
    tipo_servicio: TipoServicio = TipoServicio.LAVADO_NORMAL
    peso_entrada_kg: Optional[Decimal] = Field(None, ge=0)
    cantidad_prendas: Optional[int] = Field(None, ge=0)
    descripcion: Optional[str] = None
    notas_cliente: Optional[str] = None
    # Datos para el cargo en cuenta corriente
    monto_cobro: Decimal = Field(..., gt=0, description="Monto a cobrar al cliente")
    estado_facturacion: str = Field(
        default="sin_facturar",
        description="Estado de facturación: sin_facturar, factura_a, factura_b, ticket"
    )
    concepto: Optional[str] = Field(
        None,
        description="Concepto del cargo. Si no se proporciona, se genera automáticamente"
    )


class LoteDirectoResponse(BaseModel):
    """Schema de respuesta para lote directo creado."""
    lote: LoteProduccionResponse
    movimiento_cc_id: UUID
    mensaje: str


# ==================== DIVISIÓN DE LOTES (Bifurcación) ====================

class DividirLoteRequest(BaseModel):
    """
    Schema para dividir un lote en la etapa de Estirado.
    Permite enviar parte del lote a Secado y otra parte de vuelta a Lavado.
    """
    # Peso que va a la etapa destino principal (ej: Secado)
    peso_destino_principal_kg: Decimal = Field(
        ..., gt=0,
        description="Peso en kg que continúa al destino principal (ej: Secado)"
    )
    # Peso que va a la etapa alternativa (ej: Lavado) - si es 0, no se crea sub-lote
    peso_destino_alternativo_kg: Decimal = Field(
        default=Decimal("0"), ge=0,
        description="Peso en kg que va al destino alternativo (ej: vuelve a Lavado)"
    )
    # Observaciones para el lote que continúa
    observaciones_principal: Optional[str] = None
    # Observaciones para el sub-lote (si se crea)
    observaciones_alternativo: Optional[str] = None
    # PIN de validación
    operario_id: Optional[UUID] = None
    pin: Optional[str] = Field(None, min_length=4, max_length=6)


class DividirLoteResponse(BaseModel):
    """Schema de respuesta para división de lote."""
    lote_principal: LoteProduccionList
    lote_secundario: Optional[LoteProduccionList] = None  # Solo si se creó un sub-lote
    mensaje: str
    etapa_destino_principal: str
    etapa_destino_alternativo: Optional[str] = None


class EtapaBifurcacionInfo(BaseModel):
    """Schema con información de bifurcación de una etapa."""
    permite_bifurcacion: bool = False
    etapa_destino_principal_id: Optional[UUID] = None
    etapa_destino_principal_nombre: Optional[str] = None
    etapa_destino_alternativa_id: Optional[UUID] = None
    etapa_destino_alternativa_nombre: Optional[str] = None
