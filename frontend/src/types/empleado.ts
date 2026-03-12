/**
 * Tipos para el módulo de Empleados
 */

// Estados y enums
export type TipoEmpleado = 'operario' | 'administrativo' | 'supervisor' | 'repartidor' | 'gerente';
export type TipoContrato = 'permanente' | 'temporal' | 'medio_tiempo' | 'por_hora';
export type TipoContratacion = 'blanco' | 'negro' | 'monotributo';
export type EstadoEmpleado = 'activo' | 'licencia' | 'vacaciones' | 'suspendido' | 'desvinculado';
export type TipoAsistencia = 'entrada' | 'salida' | 'inicio_break' | 'fin_break';
export type TipoMovimientoNomina =
  | 'salario'
  | 'hora_extra'
  | 'bono'
  | 'comision'
  | 'aguinaldo'
  | 'vacaciones'
  | 'descuento'
  | 'adelanto'
  | 'prestamo'
  | 'otro';

// Empleado
export interface Empleado {
  id: string;
  codigo: string;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  dni: string;
  cuil: string | null;
  fecha_nacimiento: string | null;

  // Contacto
  email: string | null;
  telefono: string | null;
  telefono_emergencia: string | null;
  contacto_emergencia: string | null;

  // Dirección
  direccion: string | null;
  ciudad: string | null;
  codigo_postal: string | null;

  // Datos laborales
  tipo: TipoEmpleado;
  tipo_contrato: TipoContrato;
  estado: EstadoEmpleado;
  puesto: string | null;
  departamento: string | null;
  fecha_ingreso: string;
  fecha_egreso: string | null;

  // Horario
  horario_entrada: string | null;
  horario_salida: string | null;
  dias_trabajo: string | null;

  // Salario y pago
  salario_base: number;
  salario_hora: number | null;
  tipo_contratacion: TipoContratacion;
  dia_pago: number | null;
  jornada_horas: number;
  adelanto_maximo_porcentaje: number | null;

  // Datos bancarios
  banco: string | null;
  tipo_cuenta_banco: string | null;
  numero_cuenta_banco: string | null;
  cbu: string | null;
  alias_cbu: string | null;

  // Obra social / ART
  obra_social: string | null;
  numero_afiliado_os: string | null;
  art: string | null;

  // Usuario vinculado
  user_id: string | null;

  // Meta
  notas: string | null;
  foto_url: string | null;
  activo: boolean;
  created_at: string;
}

export interface EmpleadoList {
  id: string;
  codigo: string;
  nombre_completo: string;
  dni: string;
  tipo: TipoEmpleado;
  estado: EstadoEmpleado;
  puesto: string | null;
  departamento: string | null;
  fecha_ingreso: string;
  telefono: string | null;
  email: string | null;
  tipo_contratacion: TipoContratacion;
  salario_base: number;
}

export interface EmpleadoCreate {
  nombre: string;
  apellido: string;
  dni: string;
  cuil?: string | null;
  fecha_nacimiento?: string | null;
  email?: string | null;
  telefono?: string | null;
  telefono_emergencia?: string | null;
  contacto_emergencia?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  codigo_postal?: string | null;
  tipo?: TipoEmpleado;
  tipo_contrato?: TipoContrato;
  puesto?: string | null;
  departamento?: string | null;
  fecha_ingreso: string;
  horario_entrada?: string | null;
  horario_salida?: string | null;
  dias_trabajo?: string | null;
  salario_base?: number;
  salario_hora?: number | null;
  tipo_contratacion?: TipoContratacion;
  dia_pago?: number | null;
  jornada_horas?: number;
  adelanto_maximo_porcentaje?: number | null;
  banco?: string | null;
  tipo_cuenta_banco?: string | null;
  numero_cuenta_banco?: string | null;
  cbu?: string | null;
  alias_cbu?: string | null;
  obra_social?: string | null;
  numero_afiliado_os?: string | null;
  art?: string | null;
  user_id?: string | null;
  notas?: string | null;
  codigo?: string | null;
}

export interface EmpleadoUpdate {
  nombre?: string;
  apellido?: string;
  cuil?: string | null;
  fecha_nacimiento?: string | null;
  email?: string | null;
  telefono?: string | null;
  telefono_emergencia?: string | null;
  contacto_emergencia?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  codigo_postal?: string | null;
  tipo?: TipoEmpleado;
  tipo_contrato?: TipoContrato;
  estado?: EstadoEmpleado;
  puesto?: string | null;
  departamento?: string | null;
  fecha_egreso?: string | null;
  horario_entrada?: string | null;
  horario_salida?: string | null;
  dias_trabajo?: string | null;
  salario_base?: number;
  salario_hora?: number | null;
  tipo_contratacion?: TipoContratacion;
  dia_pago?: number | null;
  jornada_horas?: number;
  adelanto_maximo_porcentaje?: number | null;
  banco?: string | null;
  tipo_cuenta_banco?: string | null;
  numero_cuenta_banco?: string | null;
  cbu?: string | null;
  alias_cbu?: string | null;
  obra_social?: string | null;
  numero_afiliado_os?: string | null;
  art?: string | null;
  user_id?: string | null;
  notas?: string | null;
}

// Asistencia
export interface Asistencia {
  id: string;
  empleado_id: string;
  fecha: string;
  tipo: TipoAsistencia;
  hora: string;
  latitud: number | null;
  longitud: number | null;
  es_manual: boolean;
  registrado_por_id: string | null;
  observaciones: string | null;
  created_at: string;
}

export interface AsistenciaCreate {
  empleado_id: string;
  tipo: TipoAsistencia;
  fecha?: string | null;
  hora?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  observaciones?: string | null;
}

// Jornada Laboral
export interface JornadaLaboral {
  id: string;
  empleado_id: string;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  horas_trabajadas: number | null;
  horas_extra: number | null;
  minutos_break: number | null;
  llegada_tarde: boolean;
  salida_temprano: boolean;
  ausente: boolean;
  justificado: boolean;
  motivo_justificacion: string | null;
  observaciones: string | null;
  empleado_nombre?: string | null;
}

// Movimiento Nómina
export interface MovimientoNomina {
  id: string;
  empleado_id: string;
  tipo: TipoMovimientoNomina;
  concepto: string;
  descripcion: string | null;
  periodo_mes: number;
  periodo_anio: number;
  monto: number;
  es_debito: boolean;
  pagado: boolean;
  fecha_pago: string | null;
  medio_pago: string | null;
  comprobante: string | null;
  movimiento_caja_id: string | null;
  registrado_por_id: string;
  created_at: string;
  empleado_nombre?: string | null;
}

export interface MovimientoNominaCreate {
  empleado_id: string;
  tipo: TipoMovimientoNomina;
  concepto: string;
  descripcion?: string | null;
  periodo_mes: number;
  periodo_anio: number;
  monto: number;
  es_debito?: boolean;
}

// Liquidación
export interface Liquidacion {
  id: string;
  numero: number;
  empleado_id: string;
  periodo_mes: number;
  periodo_anio: number;
  fecha_liquidacion: string;

  // Haberes
  salario_base: number;
  horas_extra_cantidad: number | null;
  horas_extra_monto: number | null;
  bonificaciones: number | null;
  otros_haberes: number | null;
  total_haberes: number;

  // Deducciones
  jubilacion: number | null;
  obra_social: number | null;
  sindicato: number | null;
  ganancias: number | null;
  adelantos: number | null;
  otras_deducciones: number | null;
  total_deducciones: number;

  // Neto
  neto_a_pagar: number;

  // Estado
  pagada: boolean;
  fecha_pago: string | null;

  observaciones: string | null;
  generada_por_id: string;
  created_at: string;
  empleado_nombre?: string | null;
}

export interface LiquidacionCreate {
  empleado_id: string;
  periodo_mes: number;
  periodo_anio: number;
  fecha_liquidacion: string;
  bonificaciones?: number;
  otros_haberes?: number;
  otras_deducciones?: number;
  observaciones?: string | null;
}

// Constantes
export const TIPOS_EMPLEADO = [
  { value: 'operario', label: 'Operario' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'repartidor', label: 'Repartidor' },
  { value: 'gerente', label: 'Gerente' },
];

export const TIPOS_CONTRATO = [
  { value: 'permanente', label: 'Permanente' },
  { value: 'temporal', label: 'Temporal' },
  { value: 'medio_tiempo', label: 'Medio Tiempo' },
  { value: 'por_hora', label: 'Por Hora' },
];

export const TIPOS_CONTRATACION = [
  { value: 'blanco', label: 'En Blanco', description: 'Registrado con aportes legales' },
  { value: 'negro', label: 'Sin Registrar', description: 'Sin aportes automáticos' },
  { value: 'monotributo', label: 'Monotributo', description: 'Autónomo que factura' },
];

export const ESTADOS_EMPLEADO = [
  { value: 'activo', label: 'Activo' },
  { value: 'licencia', label: 'En Licencia' },
  { value: 'vacaciones', label: 'De Vacaciones' },
  { value: 'suspendido', label: 'Suspendido' },
  { value: 'desvinculado', label: 'Desvinculado' },
];

export const TIPOS_MOVIMIENTO_NOMINA = [
  { value: 'salario', label: 'Salario' },
  { value: 'hora_extra', label: 'Hora Extra' },
  { value: 'bono', label: 'Bono' },
  { value: 'comision', label: 'Comisión' },
  { value: 'aguinaldo', label: 'Aguinaldo' },
  { value: 'vacaciones', label: 'Vacaciones' },
  { value: 'descuento', label: 'Descuento' },
  { value: 'adelanto', label: 'Adelanto' },
  { value: 'prestamo', label: 'Préstamo' },
  { value: 'otro', label: 'Otro' },
];

export const DIAS_SEMANA = [
  { value: 'lun', label: 'Lunes' },
  { value: 'mar', label: 'Martes' },
  { value: 'mie', label: 'Miércoles' },
  { value: 'jue', label: 'Jueves' },
  { value: 'vie', label: 'Viernes' },
  { value: 'sab', label: 'Sábado' },
  { value: 'dom', label: 'Domingo' },
];

// Helpers
export const getEstadoBadgeColor = (estado: EstadoEmpleado): string => {
  const colors: Record<EstadoEmpleado, string> = {
    activo: 'bg-emerald-500/10 text-emerald-500',
    licencia: 'bg-amber-500/10 text-amber-500',
    vacaciones: 'bg-blue-500/10 text-blue-500',
    suspendido: 'bg-red-500/10 text-red-500',
    desvinculado: 'bg-zinc-500/10 text-zinc-500',
  };
  return colors[estado] || 'bg-zinc-500/10 text-zinc-500';
};

export const getTipoBadgeColor = (tipo: TipoEmpleado): string => {
  const colors: Record<TipoEmpleado, string> = {
    operario: 'bg-cyan-500/10 text-cyan-500',
    administrativo: 'bg-purple-500/10 text-purple-500',
    supervisor: 'bg-amber-500/10 text-amber-500',
    repartidor: 'bg-blue-500/10 text-blue-500',
    gerente: 'bg-emerald-500/10 text-emerald-500',
  };
  return colors[tipo] || 'bg-zinc-500/10 text-zinc-500';
};

export const getTipoContratacionBadgeColor = (tipo: TipoContratacion): string => {
  const colors: Record<TipoContratacion, string> = {
    blanco: 'bg-emerald-500/10 text-emerald-500',
    negro: 'bg-red-500/10 text-red-500',
    monotributo: 'bg-blue-500/10 text-blue-500',
  };
  return colors[tipo] || 'bg-zinc-500/10 text-zinc-500';
};

export const getTipoContratacionLabel = (tipo: TipoContratacion): string => {
  const labels: Record<TipoContratacion, string> = {
    blanco: 'En Blanco',
    negro: 'Sin Registrar',
    monotributo: 'Monotributo',
  };
  return labels[tipo] || tipo;
};
