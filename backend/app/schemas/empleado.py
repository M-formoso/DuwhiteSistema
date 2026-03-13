"""
Schemas de Empleados para DUWHITE ERP
"""

from datetime import date, time, datetime
from decimal import Decimal
from typing import Optional, List, Union
from pydantic import BaseModel, Field, field_validator
from uuid import UUID


# ==================== ENUMS ====================

class TipoEmpleado:
    OPERARIO = "operario"
    ADMINISTRATIVO = "administrativo"
    SUPERVISOR = "supervisor"
    REPARTIDOR = "repartidor"
    GERENTE = "gerente"


class TipoContrato:
    PERMANENTE = "permanente"
    TEMPORAL = "temporal"
    MEDIO_TIEMPO = "medio_tiempo"
    POR_HORA = "por_hora"


class TipoContratacion:
    """Tipo de contratación fiscal/laboral"""
    BLANCO = "blanco"       # Registrado, con aportes legales
    NEGRO = "negro"         # Sin registración, sin aportes automáticos
    MONOTRIBUTO = "monotributo"  # Autónomo que factura


class EstadoEmpleado:
    ACTIVO = "activo"
    LICENCIA = "licencia"
    VACACIONES = "vacaciones"
    SUSPENDIDO = "suspendido"
    DESVINCULADO = "desvinculado"


# ==================== EMPLEADO ====================

class EmpleadoBase(BaseModel):
    """Schema base de empleado"""
    nombre: str = Field(..., min_length=2, max_length=100)
    apellido: str = Field(..., min_length=2, max_length=100)
    dni: str = Field(..., min_length=7, max_length=15)
    cuil: Optional[str] = Field(None, max_length=15)
    fecha_nacimiento: Optional[date] = None

    # Contacto
    email: Optional[str] = Field(None, max_length=150)
    telefono: Optional[str] = Field(None, max_length=30)
    telefono_emergencia: Optional[str] = Field(None, max_length=30)
    contacto_emergencia: Optional[str] = Field(None, max_length=100)

    # Dirección
    direccion: Optional[str] = Field(None, max_length=255)
    ciudad: Optional[str] = Field(None, max_length=100)
    codigo_postal: Optional[str] = Field(None, max_length=10)

    # Datos laborales
    tipo: str = Field(default=TipoEmpleado.OPERARIO)
    tipo_contrato: str = Field(default=TipoContrato.PERMANENTE)
    puesto: Optional[str] = Field(None, max_length=100)
    departamento: Optional[str] = Field(None, max_length=100)
    fecha_ingreso: date

    # Horario
    horario_entrada: Optional[time] = None
    horario_salida: Optional[time] = None
    dias_trabajo: Optional[str] = Field(None, max_length=50)

    # Salario y pago
    salario_base: Union[Decimal, float, int] = Field(default=0, ge=0)
    salario_hora: Optional[Union[Decimal, float, int]] = Field(None, ge=0)
    tipo_contratacion: str = Field(default=TipoContratacion.BLANCO)  # blanco, negro, monotributo
    dia_pago: Optional[int] = Field(default=5, ge=1, le=31)  # Día del mes para pago
    jornada_horas: Union[Decimal, float, int] = Field(default=8, ge=1, le=12)  # Horas de jornada diaria
    adelanto_maximo_porcentaje: Optional[int] = Field(default=50, ge=0, le=100)  # % máximo de adelanto

    # Datos bancarios
    banco: Optional[str] = Field(None, max_length=100)
    tipo_cuenta_banco: Optional[str] = Field(None, max_length=30)
    numero_cuenta_banco: Optional[str] = Field(None, max_length=50)
    cbu: Optional[str] = Field(None, max_length=30)
    alias_cbu: Optional[str] = Field(None, max_length=50)

    # Obra social / ART
    obra_social: Optional[str] = Field(None, max_length=100)
    numero_afiliado_os: Optional[str] = Field(None, max_length=50)
    art: Optional[str] = Field(None, max_length=100)

    # Observaciones
    notas: Optional[str] = None

    @field_validator('fecha_ingreso', 'fecha_nacimiento', mode='before')
    @classmethod
    def parse_date_without_timezone(cls, v):
        """Parsea fecha asegurando que no haya conversión de timezone"""
        if v is None:
            return None
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            # Si viene como YYYY-MM-DD, parsearlo directamente
            if len(v) == 10 and v[4] == '-' and v[7] == '-':
                return date.fromisoformat(v)
            # Si viene con tiempo (ISO format con T), tomar solo la parte de fecha
            if 'T' in v:
                return date.fromisoformat(v.split('T')[0])
        return v


class EmpleadoCreate(EmpleadoBase):
    """Schema para crear empleado"""
    codigo: Optional[str] = Field(None, max_length=20)
    user_id: Optional[UUID] = None


class EmpleadoUpdate(BaseModel):
    """Schema para actualizar empleado"""
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    apellido: Optional[str] = Field(None, min_length=2, max_length=100)
    cuil: Optional[str] = Field(None, max_length=15)
    fecha_nacimiento: Optional[date] = None

    # Contacto
    email: Optional[str] = Field(None, max_length=150)
    telefono: Optional[str] = Field(None, max_length=30)
    telefono_emergencia: Optional[str] = Field(None, max_length=30)
    contacto_emergencia: Optional[str] = Field(None, max_length=100)

    # Dirección
    direccion: Optional[str] = Field(None, max_length=255)
    ciudad: Optional[str] = Field(None, max_length=100)
    codigo_postal: Optional[str] = Field(None, max_length=10)

    # Datos laborales
    tipo: Optional[str] = None
    tipo_contrato: Optional[str] = None
    estado: Optional[str] = None
    puesto: Optional[str] = Field(None, max_length=100)
    departamento: Optional[str] = Field(None, max_length=100)
    fecha_ingreso: Optional[date] = None
    fecha_egreso: Optional[date] = None

    @field_validator('fecha_ingreso', 'fecha_egreso', 'fecha_nacimiento', mode='before')
    @classmethod
    def parse_date_without_timezone(cls, v):
        """Parsea fecha asegurando que no haya conversión de timezone"""
        if v is None:
            return None
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            # Si viene como YYYY-MM-DD, parsearlo directamente
            if len(v) == 10 and v[4] == '-' and v[7] == '-':
                return date.fromisoformat(v)
            # Si viene con tiempo (ISO format con T), tomar solo la parte de fecha
            if 'T' in v:
                return date.fromisoformat(v.split('T')[0])
        return v

    # Horario
    horario_entrada: Optional[time] = None
    horario_salida: Optional[time] = None
    dias_trabajo: Optional[str] = Field(None, max_length=50)

    # Salario y pago
    salario_base: Optional[Decimal] = Field(None, ge=0)
    salario_hora: Optional[Decimal] = Field(None, ge=0)
    tipo_contratacion: Optional[str] = None  # blanco, negro, monotributo
    dia_pago: Optional[int] = Field(None, ge=1, le=31)
    jornada_horas: Optional[Decimal] = Field(None, ge=1, le=12)
    adelanto_maximo_porcentaje: Optional[int] = Field(None, ge=0, le=100)

    # Datos bancarios
    banco: Optional[str] = Field(None, max_length=100)
    tipo_cuenta_banco: Optional[str] = Field(None, max_length=30)
    numero_cuenta_banco: Optional[str] = Field(None, max_length=50)
    cbu: Optional[str] = Field(None, max_length=30)
    alias_cbu: Optional[str] = Field(None, max_length=50)

    # Obra social / ART
    obra_social: Optional[str] = Field(None, max_length=100)
    numero_afiliado_os: Optional[str] = Field(None, max_length=50)
    art: Optional[str] = Field(None, max_length=100)

    # Usuario vinculado
    user_id: Optional[UUID] = None

    # Observaciones
    notas: Optional[str] = None


class EmpleadoResponse(BaseModel):
    """Schema de respuesta de empleado"""
    id: UUID
    codigo: str
    nombre: str
    apellido: str
    nombre_completo: str
    dni: str
    cuil: Optional[str]
    fecha_nacimiento: Optional[date]

    # Contacto
    email: Optional[str]
    telefono: Optional[str]
    telefono_emergencia: Optional[str]
    contacto_emergencia: Optional[str]

    # Dirección
    direccion: Optional[str]
    ciudad: Optional[str]
    codigo_postal: Optional[str]

    # Datos laborales
    tipo: str
    tipo_contrato: str
    estado: str
    puesto: Optional[str]
    departamento: Optional[str]
    fecha_ingreso: date
    fecha_egreso: Optional[date]

    # Horario
    horario_entrada: Optional[time]
    horario_salida: Optional[time]
    dias_trabajo: Optional[str]

    # Salario y pago
    salario_base: Decimal
    salario_hora: Optional[Decimal]
    tipo_contratacion: str
    dia_pago: Optional[int]
    jornada_horas: Decimal
    adelanto_maximo_porcentaje: Optional[int]

    # Datos bancarios
    banco: Optional[str]
    tipo_cuenta_banco: Optional[str]
    numero_cuenta_banco: Optional[str]
    cbu: Optional[str]
    alias_cbu: Optional[str]

    # Obra social / ART
    obra_social: Optional[str]
    numero_afiliado_os: Optional[str]
    art: Optional[str]

    # Usuario vinculado
    user_id: Optional[UUID]

    # Meta
    notas: Optional[str]
    foto_url: Optional[str]
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True


class EmpleadoList(BaseModel):
    """Schema para lista de empleados"""
    id: UUID
    codigo: str
    nombre_completo: str
    dni: str
    tipo: str
    estado: str
    puesto: Optional[str]
    departamento: Optional[str]
    fecha_ingreso: date
    telefono: Optional[str]
    email: Optional[str]
    tipo_contratacion: str
    salario_base: Decimal

    class Config:
        from_attributes = True


# ==================== ASISTENCIA ====================

class AsistenciaCreate(BaseModel):
    """Schema para registrar asistencia"""
    empleado_id: UUID
    tipo: str  # entrada, salida, inicio_break, fin_break
    fecha: Optional[date] = None  # Si no se pasa, usa fecha actual
    hora: Optional[time] = None  # Si no se pasa, usa hora actual
    latitud: Optional[Decimal] = None
    longitud: Optional[Decimal] = None
    observaciones: Optional[str] = None


class AsistenciaResponse(BaseModel):
    """Schema de respuesta de asistencia"""
    id: UUID
    empleado_id: UUID
    fecha: date
    tipo: str
    hora: time
    latitud: Optional[Decimal]
    longitud: Optional[Decimal]
    es_manual: bool
    registrado_por_id: Optional[UUID]
    observaciones: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== JORNADA LABORAL ====================

class JornadaLaboralResponse(BaseModel):
    """Schema de respuesta de jornada laboral"""
    id: UUID
    empleado_id: UUID
    fecha: date
    hora_entrada: Optional[time]
    hora_salida: Optional[time]
    horas_trabajadas: Optional[Decimal]
    horas_extra: Optional[Decimal]
    minutos_break: Optional[int]
    llegada_tarde: bool
    salida_temprano: bool
    ausente: bool
    justificado: bool
    motivo_justificacion: Optional[str]
    observaciones: Optional[str]

    # Campos calculados
    empleado_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class JornadaJustificacion(BaseModel):
    """Schema para justificar ausencia/tardanza"""
    justificado: bool = True
    motivo_justificacion: str = Field(..., min_length=5, max_length=255)


# ==================== MOVIMIENTO NOMINA ====================

class MovimientoNominaCreate(BaseModel):
    """Schema para crear movimiento de nómina"""
    empleado_id: UUID
    tipo: str  # salario, hora_extra, bono, descuento, adelanto
    concepto: str = Field(..., min_length=3, max_length=200)
    descripcion: Optional[str] = None
    periodo_mes: int = Field(..., ge=1, le=12)
    periodo_anio: int = Field(..., ge=2020)
    monto: Decimal = Field(..., gt=0)
    es_debito: bool = False


class MovimientoNominaUpdate(BaseModel):
    """Schema para actualizar movimiento de nómina"""
    concepto: Optional[str] = Field(None, min_length=3, max_length=200)
    descripcion: Optional[str] = None
    monto: Optional[Decimal] = Field(None, gt=0)


class MovimientoNominaResponse(BaseModel):
    """Schema de respuesta de movimiento de nómina"""
    id: UUID
    empleado_id: UUID
    tipo: str
    concepto: str
    descripcion: Optional[str]
    periodo_mes: int
    periodo_anio: int
    monto: Decimal
    es_debito: bool
    pagado: bool
    fecha_pago: Optional[date]
    medio_pago: Optional[str]
    comprobante: Optional[str]
    movimiento_caja_id: Optional[UUID]
    registrado_por_id: UUID
    created_at: datetime

    # Campos calculados
    empleado_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class PagarMovimientoRequest(BaseModel):
    """Schema para marcar pago de movimiento"""
    fecha_pago: date
    medio_pago: str = Field(..., max_length=50)
    comprobante: Optional[str] = Field(None, max_length=100)
    registrar_en_caja: bool = True


# ==================== LIQUIDACION ====================

class LiquidacionCreate(BaseModel):
    """Schema para crear liquidación"""
    empleado_id: UUID
    periodo_mes: int = Field(..., ge=1, le=12)
    periodo_anio: int = Field(..., ge=2020)
    fecha_liquidacion: date

    # Haberes adicionales
    bonificaciones: Decimal = Field(default=Decimal("0"), ge=0)
    otros_haberes: Decimal = Field(default=Decimal("0"), ge=0)

    # Deducciones adicionales
    otras_deducciones: Decimal = Field(default=Decimal("0"), ge=0)

    observaciones: Optional[str] = None


class LiquidacionResponse(BaseModel):
    """Schema de respuesta de liquidación"""
    id: UUID
    numero: int
    empleado_id: UUID
    periodo_mes: int
    periodo_anio: int
    fecha_liquidacion: date

    # Haberes
    salario_base: Decimal
    horas_extra_cantidad: Optional[Decimal]
    horas_extra_monto: Optional[Decimal]
    bonificaciones: Optional[Decimal]
    otros_haberes: Optional[Decimal]
    total_haberes: Decimal

    # Deducciones
    jubilacion: Optional[Decimal]
    obra_social: Optional[Decimal]
    sindicato: Optional[Decimal]
    ganancias: Optional[Decimal]
    adelantos: Optional[Decimal]
    otras_deducciones: Optional[Decimal]
    total_deducciones: Decimal

    # Neto
    neto_a_pagar: Decimal

    # Estado
    pagada: bool
    fecha_pago: Optional[date]

    observaciones: Optional[str]
    generada_por_id: UUID
    created_at: datetime

    # Campos calculados
    empleado_nombre: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== RESUMEN ====================

class ResumenAsistencia(BaseModel):
    """Resumen de asistencia de un empleado"""
    empleado_id: UUID
    empleado_nombre: str
    dias_trabajados: int
    dias_ausentes: int
    dias_justificados: int
    llegadas_tarde: int
    horas_trabajadas_total: Decimal
    horas_extra_total: Decimal


class ResumenNomina(BaseModel):
    """Resumen de nómina del período"""
    periodo_mes: int
    periodo_anio: int
    total_empleados: int
    total_haberes: Decimal
    total_deducciones: Decimal
    total_neto: Decimal
    liquidaciones_pagadas: int
    liquidaciones_pendientes: int
