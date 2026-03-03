/**
 * Servicio de Actividades/Tareas Internas
 */

import api from './api';
import type { PaginatedResponse } from '@/types/auth';

// Tipos
export type PrioridadActividad = 'baja' | 'media' | 'alta' | 'urgente';
export type EstadoActividad = 'pendiente' | 'en_progreso' | 'completada' | 'cancelada';
export type CategoriaActividad = 'produccion' | 'mantenimiento' | 'administrativa' | 'comercial' | 'otra';

export interface Actividad {
  id: string;
  titulo: string;
  descripcion?: string;
  categoria: CategoriaActividad;
  prioridad: PrioridadActividad;
  estado: EstadoActividad;
  fecha_limite?: string;
  fecha_completada?: string;
  asignado_a_id?: string;
  asignado_a_nombre?: string;
  creado_por_id: string;
  creado_por_nombre: string;
  etiquetas: string[];
  notas?: string;
  created_at: string;
  updated_at: string;
}

export interface ActividadCreate {
  titulo: string;
  descripcion?: string;
  categoria: CategoriaActividad;
  prioridad: PrioridadActividad;
  fecha_limite?: string;
  asignado_a_id?: string;
  etiquetas?: string[];
}

export interface ActividadUpdate {
  titulo?: string;
  descripcion?: string;
  categoria?: CategoriaActividad;
  prioridad?: PrioridadActividad;
  estado?: EstadoActividad;
  fecha_limite?: string;
  asignado_a_id?: string;
  etiquetas?: string[];
  notas?: string;
}

export interface ActividadFiltros {
  estado?: EstadoActividad;
  prioridad?: PrioridadActividad;
  categoria?: CategoriaActividad;
  asignado_a_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

// Funciones del servicio
export async function getActividades(params?: ActividadFiltros): Promise<PaginatedResponse<Actividad>> {
  const response = await api.get('/actividades', { params });
  return response.data;
}

export async function getActividad(actividadId: string): Promise<Actividad> {
  const response = await api.get(`/actividades/${actividadId}`);
  return response.data;
}

export async function createActividad(data: ActividadCreate): Promise<Actividad> {
  const response = await api.post('/actividades', data);
  return response.data;
}

export async function updateActividad(actividadId: string, data: ActividadUpdate): Promise<Actividad> {
  const response = await api.put(`/actividades/${actividadId}`, data);
  return response.data;
}

export async function deleteActividad(actividadId: string): Promise<void> {
  await api.delete(`/actividades/${actividadId}`);
}

export async function cambiarEstadoActividad(
  actividadId: string,
  estado: EstadoActividad
): Promise<Actividad> {
  const response = await api.patch(`/actividades/${actividadId}/estado`, { estado });
  return response.data;
}

export async function getActividadesPorEstado(): Promise<{
  pendiente: Actividad[];
  en_progreso: Actividad[];
  completada: Actividad[];
}> {
  const response = await api.get('/actividades/por-estado');
  return response.data;
}

export async function getResumenActividades(): Promise<{
  total: number;
  pendientes: number;
  en_progreso: number;
  completadas_hoy: number;
  vencidas: number;
  por_categoria: { categoria: string; cantidad: number }[];
}> {
  const response = await api.get('/actividades/resumen');
  return response.data;
}

export const actividadService = {
  getActividades,
  getActividad,
  createActividad,
  updateActividad,
  deleteActividad,
  cambiarEstadoActividad,
  getActividadesPorEstado,
  getResumenActividades,
};

export default actividadService;
