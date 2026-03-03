/**
 * Servicio de Stock (Insumos y Movimientos)
 */

import api from './api';
import type {
  CategoriaInsumo,
  CategoriaInsumoCreate,
  CategoriaInsumoUpdate,
  Insumo,
  InsumoCreate,
  InsumoUpdate,
  InsumoFilters,
  MovimientoStock,
  MovimientoFilters,
  AjusteStockRequest,
  ResumenMovimientos,
  AlertaStock,
} from '@/types/stock';
import type { PaginatedResponse } from '@/types/auth';

// ==================== CATEGORÍAS ====================

export async function getCategorias(params?: {
  skip?: number;
  limit?: number;
  solo_activas?: boolean;
}): Promise<PaginatedResponse<CategoriaInsumo>> {
  const response = await api.get('/categorias-insumo', { params });
  return response.data;
}

export async function getCategoriasLista(): Promise<{ id: string; nombre: string }[]> {
  const response = await api.get('/categorias-insumo/lista');
  return response.data;
}

export async function getCategoria(id: string): Promise<CategoriaInsumo> {
  const response = await api.get(`/categorias-insumo/${id}`);
  return response.data;
}

export async function createCategoria(data: CategoriaInsumoCreate): Promise<CategoriaInsumo> {
  const response = await api.post('/categorias-insumo', data);
  return response.data;
}

export async function updateCategoria(id: string, data: CategoriaInsumoUpdate): Promise<CategoriaInsumo> {
  const response = await api.put(`/categorias-insumo/${id}`, data);
  return response.data;
}

export async function deleteCategoria(id: string): Promise<void> {
  await api.delete(`/categorias-insumo/${id}`);
}

// ==================== INSUMOS ====================

export async function getInsumos(params?: {
  skip?: number;
  limit?: number;
} & InsumoFilters): Promise<PaginatedResponse<Insumo>> {
  const response = await api.get('/insumos', { params });
  return response.data;
}

export async function getInsumosLista(search?: string): Promise<{
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
  stock_actual: number;
  stock_minimo: number;
  stock_bajo: boolean;
}[]> {
  const response = await api.get('/insumos/lista', { params: { search } });
  return response.data;
}

export async function getInsumo(id: string): Promise<Insumo> {
  const response = await api.get(`/insumos/${id}`);
  return response.data;
}

export async function createInsumo(data: InsumoCreate): Promise<Insumo> {
  const response = await api.post('/insumos', data);
  return response.data;
}

export async function updateInsumo(id: string, data: InsumoUpdate): Promise<Insumo> {
  const response = await api.put(`/insumos/${id}`, data);
  return response.data;
}

export async function deleteInsumo(id: string): Promise<void> {
  await api.delete(`/insumos/${id}`);
}

// ==================== ALERTAS ====================

export async function getAlertasStock(): Promise<AlertaStock[]> {
  const response = await api.get('/insumos/alertas');
  return response.data;
}

// ==================== MOVIMIENTOS ====================

export async function getMovimientosInsumo(
  insumoId: string,
  params?: { skip?: number; limit?: number }
): Promise<PaginatedResponse<MovimientoStock>> {
  const response = await api.get(`/insumos/${insumoId}/movimientos`, { params });
  return response.data;
}

export async function getResumenMovimientos(insumoId: string): Promise<ResumenMovimientos> {
  const response = await api.get(`/insumos/${insumoId}/resumen`);
  return response.data;
}

export async function ajustarStock(insumoId: string, data: AjusteStockRequest): Promise<MovimientoStock> {
  const response = await api.post(`/insumos/${insumoId}/ajuste`, data);
  return response.data;
}

// ==================== EXPORTS ====================

export const stockService = {
  // Categorías
  getCategorias,
  getCategoriasLista,
  getCategoria,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  // Insumos
  getInsumos,
  getInsumosLista,
  getInsumo,
  createInsumo,
  updateInsumo,
  deleteInsumo,
  // Alertas
  getAlertasStock,
  // Movimientos
  getMovimientosInsumo,
  getResumenMovimientos,
  ajustarStock,
};

export default stockService;
