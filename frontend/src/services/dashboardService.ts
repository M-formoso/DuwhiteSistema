/**
 * Servicio de Dashboard
 */

import api from './api';
import type {
  DashboardCompleto,
  DashboardKPIs,
  VentaSemana,
  PedidoReciente,
  LoteEnProceso,
  Alerta,
  MovimientosHoy,
} from '@/types/dashboard';

export async function getDashboardCompleto(): Promise<DashboardCompleto> {
  const response = await api.get('/dashboard');
  return response.data;
}

export async function getKPIs(): Promise<DashboardKPIs> {
  const response = await api.get('/dashboard/kpis');
  return response.data;
}

export async function getVentasSemana(): Promise<VentaSemana[]> {
  const response = await api.get('/dashboard/ventas-semana');
  return response.data;
}

export async function getPedidosRecientes(limit: number = 5): Promise<PedidoReciente[]> {
  const response = await api.get('/dashboard/pedidos-recientes', {
    params: { limit },
  });
  return response.data;
}

export async function getLotesEnProceso(limit: number = 5): Promise<LoteEnProceso[]> {
  const response = await api.get('/dashboard/lotes-proceso', {
    params: { limit },
  });
  return response.data;
}

export async function getAlertas(): Promise<Alerta[]> {
  const response = await api.get('/dashboard/alertas');
  return response.data;
}

export async function getMovimientosHoy(): Promise<MovimientosHoy> {
  const response = await api.get('/dashboard/movimientos-hoy');
  return response.data;
}

export const dashboardService = {
  getDashboardCompleto,
  getKPIs,
  getVentasSemana,
  getPedidosRecientes,
  getLotesEnProceso,
  getAlertas,
  getMovimientosHoy,
};

export default dashboardService;
