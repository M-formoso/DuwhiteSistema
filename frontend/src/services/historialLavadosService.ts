/**
 * Servicio del módulo Historial de Lavados.
 */

import api from './api';
import type {
  EliminadosFiltros,
  HistorialFiltros,
  HistorialListResponse,
  HistorialLoteDetalle,
  RemitosEliminadosResponse,
  TipoServicioOpcion,
} from '@/types/historialLavados';

export async function getHistorial(
  params?: HistorialFiltros
): Promise<HistorialListResponse> {
  const response = await api.get('/historial-lavados/', { params });
  return response.data;
}

export async function getDetalleLote(loteId: string): Promise<HistorialLoteDetalle> {
  const response = await api.get(`/historial-lavados/${loteId}`);
  return response.data;
}

export async function getTiposServicio(): Promise<TipoServicioOpcion[]> {
  const response = await api.get('/historial-lavados/tipos-servicio');
  return response.data;
}

export async function getRemitosEliminados(
  params?: EliminadosFiltros
): Promise<RemitosEliminadosResponse> {
  const response = await api.get('/historial-lavados/eliminados/remitos', {
    params,
  });
  return response.data;
}

export async function deleteRemito(
  clienteId: string,
  remitoId: string,
  motivo?: string
): Promise<{
  mensaje: string;
  remito_id: string;
  numero: string;
  saldo_posterior_cliente: number | null;
}> {
  const response = await api.delete(
    `/clientes/cuenta-corriente/${clienteId}/remitos/${remitoId}`,
    { data: motivo ? { motivo } : {} }
  );
  return response.data;
}

export const historialLavadosService = {
  getHistorial,
  getDetalleLote,
  getTiposServicio,
  getRemitosEliminados,
  deleteRemito,
};

export default historialLavadosService;
