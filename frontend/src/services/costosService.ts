/**
 * Servicio de Costos
 */

import api from './api';
import type { PaginatedResponse } from '@/types/auth';

// ==================== TYPES ====================

export interface CostoFijo {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  monto_mensual: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  dias_mes: number;
  notas: string | null;
  is_active: boolean;
  created_at: string;
  costo_diario: number | null;
  vigente: boolean;
}

export interface CostoVariable {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  costo_por_unidad: number;
  unidad_medida: string;
  consumo_por_kg: number | null;
  insumo_id: string | null;
  notas: string | null;
  is_active: boolean;
  created_at: string;
  insumo_nombre: string | null;
  costo_por_kg: number | null;
}

export interface ResumenCostosMes {
  periodo_mes: number;
  periodo_anio: number;
  total_costos_fijos: number;
  costos_fijos_por_categoria: Record<string, number>;
  total_costos_variables: number;
  costos_variables_por_categoria: Record<string, number>;
  total_kg_procesados: number;
  costo_promedio_por_kg: number;
  total_ingresos: number;
  margen_bruto: number;
  margen_porcentaje: number;
}

export interface RentabilidadCliente {
  cliente_id: string;
  cliente_nombre: string;
  cantidad_pedidos: number;
  kg_procesados: number;
  costo_total: number;
  ingreso_total: number;
  margen_bruto: number;
  margen_porcentaje: number;
}

export const CATEGORIAS_COSTO = [
  { value: 'mano_obra', label: 'Mano de Obra' },
  { value: 'insumos', label: 'Insumos' },
  { value: 'energia', label: 'Energía' },
  { value: 'alquiler', label: 'Alquiler' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'impuestos', label: 'Impuestos' },
  { value: 'depreciacion', label: 'Depreciación' },
  { value: 'otros', label: 'Otros' },
];

// ==================== API CALLS ====================

// Costos Fijos
export async function getCostosFijos(params?: {
  skip?: number;
  limit?: number;
  categoria?: string;
  solo_vigentes?: boolean;
}): Promise<PaginatedResponse<CostoFijo>> {
  const response = await api.get('/costos/fijos', { params });
  return response.data;
}

export async function createCostoFijo(data: {
  nombre: string;
  descripcion?: string;
  categoria: string;
  monto_mensual: number;
  fecha_inicio: string;
  fecha_fin?: string | null;
  dias_mes?: number;
  notas?: string;
}): Promise<CostoFijo> {
  const response = await api.post('/costos/fijos', data);
  return response.data;
}

export async function updateCostoFijo(
  id: string,
  data: Partial<{
    nombre: string;
    descripcion: string;
    categoria: string;
    monto_mensual: number;
    fecha_fin: string | null;
    dias_mes: number;
    notas: string;
  }>
): Promise<CostoFijo> {
  const response = await api.put(`/costos/fijos/${id}`, data);
  return response.data;
}

export async function deleteCostoFijo(id: string): Promise<void> {
  await api.delete(`/costos/fijos/${id}`);
}

// Costos Variables
export async function getCostosVariables(params?: {
  skip?: number;
  limit?: number;
  categoria?: string;
}): Promise<PaginatedResponse<CostoVariable>> {
  const response = await api.get('/costos/variables', { params });
  return response.data;
}

export async function createCostoVariable(data: {
  nombre: string;
  descripcion?: string;
  categoria: string;
  costo_por_unidad: number;
  unidad_medida: string;
  consumo_por_kg?: number | null;
  insumo_id?: string | null;
  notas?: string;
}): Promise<CostoVariable> {
  const response = await api.post('/costos/variables', data);
  return response.data;
}

export async function updateCostoVariable(
  id: string,
  data: Partial<{
    nombre: string;
    descripcion: string;
    categoria: string;
    costo_por_unidad: number;
    unidad_medida: string;
    consumo_por_kg: number | null;
    insumo_id: string | null;
    notas: string;
  }>
): Promise<CostoVariable> {
  const response = await api.put(`/costos/variables/${id}`, data);
  return response.data;
}

export async function deleteCostoVariable(id: string): Promise<void> {
  await api.delete(`/costos/variables/${id}`);
}

// Resumen
export async function getResumenCostosMes(
  mes: number,
  anio: number
): Promise<ResumenCostosMes> {
  const response = await api.get('/costos/resumen/mes', {
    params: { mes, anio },
  });
  return response.data;
}

// Rentabilidad
export async function getRentabilidadClientes(params?: {
  fecha_desde?: string;
  fecha_hasta?: string;
  limit?: number;
}): Promise<RentabilidadCliente[]> {
  const response = await api.get('/costos/rentabilidad/clientes', { params });
  return response.data;
}

// ==================== EXPORTS ====================

export const costosService = {
  getCostosFijos,
  createCostoFijo,
  updateCostoFijo,
  deleteCostoFijo,
  getCostosVariables,
  createCostoVariable,
  updateCostoVariable,
  deleteCostoVariable,
  getResumenCostosMes,
  getRentabilidadClientes,
};

export default costosService;
