/**
 * Servicio de Finanzas
 */

import api from './api';
import type {
  Caja,
  CajaList,
  AbrirCajaRequest,
  CerrarCajaRequest,
  MovimientoCaja,
  MovimientoCajaCreate,
  CuentaBancaria,
  MovimientoBancario,
  ResumenFinanciero,
  TipoMovimientoCaja,
  CategoriaMovimiento,
} from '@/types/finanzas';
import type { PaginatedResponse } from '@/types/auth';

// ==================== CAJA ====================

export async function getCajaActual(): Promise<Caja | null> {
  const response = await api.get('/finanzas/caja/actual');
  return response.data;
}

export async function getCajas(params?: {
  skip?: number;
  limit?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  estado?: string;
}): Promise<PaginatedResponse<CajaList>> {
  const response = await api.get('/finanzas/cajas', { params });
  return response.data;
}

export async function abrirCaja(data: AbrirCajaRequest): Promise<Caja> {
  const response = await api.post('/finanzas/caja/abrir', data);
  return response.data;
}

export async function cerrarCaja(cajaId: string, data: CerrarCajaRequest): Promise<Caja> {
  const response = await api.post(`/finanzas/caja/${cajaId}/cerrar`, data);
  return response.data;
}

// ==================== MOVIMIENTOS CAJA ====================

export async function getMovimientosCaja(params?: {
  caja_id?: string;
  skip?: number;
  limit?: number;
  tipo?: TipoMovimientoCaja;
  categoria?: CategoriaMovimiento;
  incluir_anulados?: boolean;
}): Promise<PaginatedResponse<MovimientoCaja>> {
  const response = await api.get('/finanzas/caja/movimientos', { params });
  return response.data;
}

export async function registrarMovimientoCaja(data: MovimientoCajaCreate): Promise<MovimientoCaja> {
  const response = await api.post('/finanzas/caja/movimientos', data);
  return response.data;
}

export async function anularMovimientoCaja(
  movimientoId: string,
  motivo: string
): Promise<{ message: string }> {
  const response = await api.post(`/finanzas/caja/movimientos/${movimientoId}/anular`, { motivo });
  return response.data;
}

export async function getCategorias(): Promise<{
  ingresos: { value: string; label: string }[];
  egresos: { value: string; label: string }[];
}> {
  const response = await api.get('/finanzas/caja/categorias');
  return response.data;
}

// ==================== CUENTAS BANCARIAS ====================

export async function getCuentasBancarias(soloActivas: boolean = true): Promise<CuentaBancaria[]> {
  const response = await api.get('/finanzas/bancos/cuentas', {
    params: { solo_activas: soloActivas },
  });
  return response.data;
}

export async function createCuentaBancaria(data: Partial<CuentaBancaria>): Promise<CuentaBancaria> {
  const response = await api.post('/finanzas/bancos/cuentas', data);
  return response.data;
}

export async function getMovimientosBancarios(
  cuentaId: string,
  params?: {
    skip?: number;
    limit?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
  }
): Promise<PaginatedResponse<MovimientoBancario>> {
  const response = await api.get(`/finanzas/bancos/cuentas/${cuentaId}/movimientos`, { params });
  return response.data;
}

export async function createMovimientoBancario(data: {
  cuenta_id: string;
  tipo: string;
  monto: number;
  fecha: string;
  descripcion?: string;
  numero_comprobante?: string;
  categoria?: string;
}): Promise<MovimientoBancario> {
  const response = await api.post('/finanzas/bancos/movimientos', data);
  return response.data;
}

export async function getTiposCuenta(): Promise<{ value: string; label: string }[]> {
  const response = await api.get('/finanzas/bancos/tipos-cuenta');
  return response.data;
}

export async function getTiposMovimientoBancario(): Promise<{ value: string; label: string }[]> {
  const response = await api.get('/finanzas/bancos/tipos-movimiento');
  return response.data;
}

// ==================== RESUMEN ====================

export async function getResumenFinanciero(params?: {
  fecha_desde?: string;
  fecha_hasta?: string;
}): Promise<ResumenFinanciero> {
  const response = await api.get('/finanzas/resumen', { params });
  return response.data;
}

// ==================== EXPORTS ====================

export const finanzasService = {
  getCajaActual,
  getCajas,
  abrirCaja,
  cerrarCaja,
  getMovimientosCaja,
  registrarMovimientoCaja,
  anularMovimientoCaja,
  getCategorias,
  getCuentasBancarias,
  createCuentaBancaria,
  getMovimientosBancarios,
  createMovimientoBancario,
  getTiposCuenta,
  getTiposMovimientoBancario,
  getResumenFinanciero,
};

export default finanzasService;
