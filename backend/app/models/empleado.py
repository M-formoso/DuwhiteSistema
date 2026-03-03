"""
Modelos de Empleados para DUWHITE ERP
"""

from sqlalchemy import Column, String, Numeric, Date, Boolean, Text, ForeignKey, Integer, Time, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum

from app.db.base import Base
from app.models.base import BaseModelMixin


class TipoEmpleado(str, enum.Enum):
    """Tipos de empleado"""
    OPERARIO = "operario"
    ADMINISTRATIVO = "administrativo"
    SUPERVISOR = "supervisor"
    REPARTIDOR = "repartidor"
    GERENTE = "gerente"


class TipoContrato(str, enum.Enum):
    """Tipos de contrato laboral"""
    PERMANENTE = "permanente"
    TEMPORAL = "temporal"
    MEDIO_TIEMPO = "medio_tiempo"
    POR_HORA = "por_hora"


class EstadoEmpleado(str, enum.Enum):
    """Estados del empleado"""
    ACTIVO = "activo"
    LICENCIA = "licencia"
    VACACIONES = "vacaciones"
    SUSPENDIDO = "suspendido"
    DESVINCULADO = "desvinculado"


class TipoAsistencia(str, enum.Enum):
    """Tipos de registro de asistencia"""
    ENTRADA = "entrada"
    SALIDA = "salida"
    INICIO_BREAK = "inicio_break"
    FIN_BREAK = "fin_break"


class TipoMovimientoNomina(str, enum.Enum):
    """Tipos de movimientos en nómina"""
    SALARIO = "salario"
    HORA_EXTRA = "hora_extra"
    BONO = "bono"
    COMISION = "comision"
    AGUINALDO = "aguinaldo"
    VACACIONES = "vacaciones"
    DESCUENTO = "descuento"
    ADELANTO = "adelanto"
    PRESTAMO = "prestamo"
    OTRO = "otro"


class Empleado(Base, BaseModelMixin):
    """
    Modelo de Empleado
    """
    __tablename__ = "empleados"

    # Datos personales
    codigo = Column(String(20), unique=True, nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    dni = Column(String(15), unique=True, nullable=False, index=True)
    cuil = Column(String(15), unique=True, nullable=True)
    fecha_nacimiento = Column(Date, nullable=True)

    # Contacto
    email = Column(String(150), nullable=True)
    telefono = Column(String(30), nullable=True)
    telefono_emergencia = Column(String(30), nullable=True)
    contacto_emergencia = Column(String(100), nullable=True)

    # Dirección
    direccion = Column(String(255), nullable=True)
    ciudad = Column(String(100), nullable=True)
    codigo_postal = Column(String(10), nullable=True)

    # Datos laborales
    tipo = Column(String(30), nullable=False, default=TipoEmpleado.OPERARIO.value)
    tipo_contrato = Column(String(30), nullable=False, default=TipoContrato.PERMANENTE.value)
    estado = Column(String(30), nullable=False, default=EstadoEmpleado.ACTIVO.value)
    puesto = Column(String(100), nullable=True)
    departamento = Column(String(100), nullable=True)
    fecha_ingreso = Column(Date, nullable=False)
    fecha_egreso = Column(Date, nullable=True)

    # Horario
    horario_entrada = Column(Time, nullable=True)
    horario_salida = Column(Time, nullable=True)
    dias_trabajo = Column(String(50), nullable=True)  # "lun,mar,mie,jue,vie"

    # Salario
    salario_base = Column(Numeric(12, 2), nullable=False, default=0)
    salario_hora = Column(Numeric(10, 2), nullable=True)

    # Datos bancarios
    banco = Column(String(100), nullable=True)
    tipo_cuenta_banco = Column(String(30), nullable=True)  # caja_ahorro, cuenta_corriente
    numero_cuenta_banco = Column(String(50), nullable=True)
    cbu = Column(String(30), nullable=True)
    alias_cbu = Column(String(50), nullable=True)

    # Obra social / ART
    obra_social = Column(String(100), nullable=True)
    numero_afiliado_os = Column(String(50), nullable=True)
    art = Column(String(100), nullable=True)

    # Vinculación con usuario del sistema
    user_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True, unique=True)

    # Observaciones
    notas = Column(Text, nullable=True)

    # Foto
    foto_url = Column(String(500), nullable=True)

    # Relationships
    user = relationship("Usuario", back_populates="empleado", uselist=False, foreign_keys=[user_id])
    asistencias = relationship("Asistencia", back_populates="empleado", cascade="all, delete-orphan")
    movimientos_nomina = relationship("MovimientoNomina", back_populates="empleado", cascade="all, delete-orphan")

    @property
    def nombre_completo(self) -> str:
        return f"{self.nombre} {self.apellido}"


class Asistencia(Base, BaseModelMixin):
    """
    Modelo de Registro de Asistencia
    """
    __tablename__ = "asistencias"

    empleado_id = Column(UUID(as_uuid=True), ForeignKey("empleados.id"), nullable=False, index=True)
    fecha = Column(Date, nullable=False, index=True)
    tipo = Column(String(20), nullable=False)  # entrada, salida, inicio_break, fin_break
    hora = Column(Time, nullable=False)

    # Ubicación (si se registra desde móvil)
    latitud = Column(Numeric(10, 8), nullable=True)
    longitud = Column(Numeric(11, 8), nullable=True)

    # Registro manual o automático
    es_manual = Column(Boolean, default=False)
    registrado_por_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    observaciones = Column(Text, nullable=True)

    # Relationships
    empleado = relationship("Empleado", back_populates="asistencias")


class JornadaLaboral(Base, BaseModelMixin):
    """
    Modelo de Jornada Laboral calculada
    """
    __tablename__ = "jornadas_laborales"

    empleado_id = Column(UUID(as_uuid=True), ForeignKey("empleados.id"), nullable=False, index=True)
    fecha = Column(Date, nullable=False, index=True)

    hora_entrada = Column(Time, nullable=True)
    hora_salida = Column(Time, nullable=True)

    # Horas calculadas
    horas_trabajadas = Column(Numeric(5, 2), nullable=True)
    horas_extra = Column(Numeric(5, 2), nullable=True, default=0)
    minutos_break = Column(Integer, nullable=True, default=0)

    # Estado
    llegada_tarde = Column(Boolean, default=False)
    salida_temprano = Column(Boolean, default=False)
    ausente = Column(Boolean, default=False)
    justificado = Column(Boolean, default=False)
    motivo_justificacion = Column(String(255), nullable=True)

    observaciones = Column(Text, nullable=True)

    # Relationships
    empleado = relationship("Empleado")


class MovimientoNomina(Base, BaseModelMixin):
    """
    Modelo de Movimientos de Nómina (pagos, descuentos, adelantos)
    """
    __tablename__ = "movimientos_nomina"

    empleado_id = Column(UUID(as_uuid=True), ForeignKey("empleados.id"), nullable=False, index=True)

    tipo = Column(String(30), nullable=False)  # salario, hora_extra, bono, descuento, adelanto
    concepto = Column(String(200), nullable=False)
    descripcion = Column(Text, nullable=True)

    # Período
    periodo_mes = Column(Integer, nullable=False)  # 1-12
    periodo_anio = Column(Integer, nullable=False)

    # Montos
    monto = Column(Numeric(12, 2), nullable=False)
    es_debito = Column(Boolean, default=False)  # True si resta del salario

    # Estado de pago
    pagado = Column(Boolean, default=False)
    fecha_pago = Column(Date, nullable=True)
    medio_pago = Column(String(50), nullable=True)  # efectivo, transferencia
    comprobante = Column(String(100), nullable=True)

    # Vinculación con caja
    movimiento_caja_id = Column(UUID(as_uuid=True), ForeignKey("movimientos_caja.id"), nullable=True)

    # Registro
    registrado_por_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Relationships
    empleado = relationship("Empleado", back_populates="movimientos_nomina")


class Liquidacion(Base, BaseModelMixin):
    """
    Modelo de Liquidación de Sueldo
    """
    __tablename__ = "liquidaciones"

    numero = Column(Integer, unique=True, nullable=False, index=True)
    empleado_id = Column(UUID(as_uuid=True), ForeignKey("empleados.id"), nullable=False, index=True)

    # Período
    periodo_mes = Column(Integer, nullable=False)
    periodo_anio = Column(Integer, nullable=False)
    fecha_liquidacion = Column(Date, nullable=False)

    # Haberes
    salario_base = Column(Numeric(12, 2), nullable=False)
    horas_extra_cantidad = Column(Numeric(5, 2), nullable=True, default=0)
    horas_extra_monto = Column(Numeric(12, 2), nullable=True, default=0)
    bonificaciones = Column(Numeric(12, 2), nullable=True, default=0)
    otros_haberes = Column(Numeric(12, 2), nullable=True, default=0)
    total_haberes = Column(Numeric(12, 2), nullable=False)

    # Deducciones
    jubilacion = Column(Numeric(12, 2), nullable=True, default=0)  # 11%
    obra_social = Column(Numeric(12, 2), nullable=True, default=0)  # 3%
    sindicato = Column(Numeric(12, 2), nullable=True, default=0)
    ganancias = Column(Numeric(12, 2), nullable=True, default=0)
    adelantos = Column(Numeric(12, 2), nullable=True, default=0)
    otras_deducciones = Column(Numeric(12, 2), nullable=True, default=0)
    total_deducciones = Column(Numeric(12, 2), nullable=False)

    # Neto
    neto_a_pagar = Column(Numeric(12, 2), nullable=False)

    # Estado
    pagada = Column(Boolean, default=False)
    fecha_pago = Column(Date, nullable=True)

    # Observaciones
    observaciones = Column(Text, nullable=True)

    # Registro
    generada_por_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Relationships
    empleado = relationship("Empleado")
