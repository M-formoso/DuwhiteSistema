/**
 * Servicio de Empleados
 */

import api from './api';
import type {
  Empleado,
  EmpleadoList,
  EmpleadoCreate,
  EmpleadoUpdate,
  Asistencia,
  AsistenciaCreate,
  JornadaLaboral,
  MovimientoNomina,
  MovimientoNominaCreate,
  Liquidacion,
  LiquidacionCreate,
} from '@/types/empleado';
import type { PaginatedResponse } from '@/types/auth';

// ==================== EMPLEADOS ====================

export async function getEmpleados(params?: {
  skip?: number;
  limit?: number;
  tipo?: string;
  estado?: string;
  departamento?: string;
  search?: string;
  solo_activos?: boolean;
}): Promise<PaginatedResponse<EmpleadoList>> {
  const response = await api.get('/empleados', { params });
  return response.data;
}

export async function getEmpleado(empleadoId: string): Promise<Empleado> {
  const response = await api.get(`/empleados/${empleadoId}`);
  return response.data;
}

export async function createEmpleado(data: EmpleadoCreate): Promise<Empleado> {
  const response = await api.post('/empleados', data);
  return response.data;
}

export async function updateEmpleado(empleadoId: string, data: EmpleadoUpdate): Promise<Empleado> {
  const response = await api.put(`/empleados/${empleadoId}`, data);
  return response.data;
}

export async function deleteEmpleado(empleadoId: string): Promise<void> {
  await api.delete(`/empleados/${empleadoId}`);
}

export async function getDepartamentos(): Promise<string[]> {
  const response = await api.get('/empleados/departamentos');
  return response.data;
}

export async function getTiposEmpleado(): Promise<{
  tipos_empleado: { value: string; label: string }[];
  tipos_contrato: { value: string; label: string }[];
  estados_empleado: { value: string; label: string }[];
  tipos_movimiento_nomina: { value: string; label: string }[];
}> {
  const response = await api.get('/empleados/tipos');
  return response.data;
}

// ==================== ASISTENCIA ====================

export async function registrarAsistencia(
  data: AsistenciaCreate,
  esManual: boolean = false
): Promise<Asistencia> {
  const response = await api.post('/empleados/asistencia', data, {
    params: { es_manual: esManual },
  });
  return response.data;
}

export async function getAsistencias(params?: {
  empleado_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  skip?: number;
  limit?: number;
}): Promise<PaginatedResponse<Asistencia>> {
  const response = await api.get('/empleados/asistencia/listado', { params });
  return response.data;
}

// ==================== JORNADAS ====================

export async function getJornadas(params?: {
  empleado_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  skip?: number;
  limit?: number;
}): Promise<PaginatedResponse<JornadaLaboral>> {
  const response = await api.get('/empleados/jornadas', { params });
  return response.data;
}

export async function justificarJornada(
  jornadaId: string,
  data: { justificado: boolean; motivo_justificacion: string }
): Promise<JornadaLaboral> {
  const response = await api.post(`/empleados/jornadas/${jornadaId}/justificar`, data);
  return response.data;
}

// ==================== MOVIMIENTOS NOMINA ====================

export async function createMovimientoNomina(data: MovimientoNominaCreate): Promise<MovimientoNomina> {
  const response = await api.post('/empleados/nomina/movimientos', data);
  return response.data;
}

export async function getMovimientosNomina(params?: {
  empleado_id?: string;
  periodo_mes?: number;
  periodo_anio?: number;
  tipo?: string;
  pagado?: boolean;
  skip?: number;
  limit?: number;
}): Promise<PaginatedResponse<MovimientoNomina>> {
  const response = await api.get('/empleados/nomina/movimientos', { params });
  return response.data;
}

export async function pagarMovimientoNomina(
  movimientoId: string,
  data: {
    fecha_pago: string;
    medio_pago: string;
    comprobante?: string;
    registrar_en_caja?: boolean;
  }
): Promise<MovimientoNomina> {
  const response = await api.post(`/empleados/nomina/movimientos/${movimientoId}/pagar`, data);
  return response.data;
}

// ==================== LIQUIDACIONES ====================

export async function createLiquidacion(data: LiquidacionCreate): Promise<Liquidacion> {
  const response = await api.post('/empleados/liquidaciones', data);
  return response.data;
}

export async function getLiquidaciones(params?: {
  empleado_id?: string;
  periodo_mes?: number;
  periodo_anio?: number;
  pagada?: boolean;
  skip?: number;
  limit?: number;
}): Promise<PaginatedResponse<Liquidacion>> {
  const response = await api.get('/empleados/liquidaciones', { params });
  return response.data;
}

export async function pagarLiquidacion(
  liquidacionId: string,
  fechaPago: string
): Promise<Liquidacion> {
  const response = await api.post(`/empleados/liquidaciones/${liquidacionId}/pagar`, null, {
    params: { fecha_pago: fechaPago },
  });
  return response.data;
}

// ==================== EXPORTS ====================

export const empleadoService = {
  getEmpleados,
  getEmpleado,
  createEmpleado,
  updateEmpleado,
  deleteEmpleado,
  getDepartamentos,
  getTiposEmpleado,
  registrarAsistencia,
  getAsistencias,
  getJornadas,
  justificarJornada,
  createMovimientoNomina,
  getMovimientosNomina,
  pagarMovimientoNomina,
  createLiquidacion,
  getLiquidaciones,
  pagarLiquidacion,
};

export default empleadoService;
