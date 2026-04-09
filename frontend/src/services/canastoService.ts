/**
 * Servicio de Canastos
 */

import api from './api';
import {
  Canasto,
  CanastoGridItem,
  CanastosGridResponse,
  LoteCanasto,
  AsignarCanastosRequest,
  LiberarCanastosRequest,
  EstadoCanasto,
} from '@/types/produccion-v2';

const BASE_URL = '/produccion/canastos';

export const canastoService = {
  /**
   * Lista todos los canastos
   */
  async getAll(params?: {
    estado?: EstadoCanasto;
    solo_disponibles?: boolean;
  }): Promise<Canasto[]> {
    const response = await api.get(BASE_URL, { params });
    return response.data;
  },

  /**
   * Obtiene el grid visual de canastos
   */
  async getGrid(): Promise<CanastosGridResponse> {
    const response = await api.get(`${BASE_URL}/grid`);
    return response.data;
  },

  /**
   * Lista canastos disponibles
   */
  async getDisponibles(): Promise<Canasto[]> {
    const response = await api.get(`${BASE_URL}/disponibles`);
    return response.data;
  },

  /**
   * Cuenta canastos disponibles
   */
  async getDisponiblesCount(): Promise<number> {
    const response = await api.get(`${BASE_URL}/disponibles/count`);
    return response.data.count;
  },

  /**
   * Obtiene un canasto por ID
   */
  async getById(id: string): Promise<Canasto> {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response.data;
  },

  /**
   * Actualiza un canasto
   */
  async update(
    id: string,
    data: { ubicacion?: string; notas?: string; estado?: EstadoCanasto }
  ): Promise<Canasto> {
    const response = await api.put(`${BASE_URL}/${id}`, data);
    return response.data;
  },

  /**
   * Cambia el estado de un canasto
   */
  async cambiarEstado(
    id: string,
    estado: EstadoCanasto
  ): Promise<{ mensaje: string; canasto_id: string; estado: string }> {
    const response = await api.post(`${BASE_URL}/${id}/estado`, null, {
      params: { estado },
    });
    return response.data;
  },

  /**
   * Obtiene el historial de uso de un canasto
   */
  async getHistorial(id: string, limit = 50): Promise<LoteCanasto[]> {
    const response = await api.get(`${BASE_URL}/${id}/historial`, {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Asigna canastos a un lote
   */
  async asignarALote(
    loteId: string,
    request: AsignarCanastosRequest
  ): Promise<{
    mensaje: string;
    lote_id: string;
    canastos_asignados: number;
    canastos: { id: string; codigo: string }[];
  }> {
    const response = await api.post(`${BASE_URL}/lotes/${loteId}/asignar`, request);
    return response.data;
  },

  /**
   * Libera canastos de un lote
   */
  async liberarDeLote(
    loteId: string,
    request: LiberarCanastosRequest
  ): Promise<{
    mensaje: string;
    lote_id: string;
    canastos_liberados: number;
    canastos: { id: string; codigo: string }[];
  }> {
    const response = await api.post(`${BASE_URL}/lotes/${loteId}/liberar`, request);
    return response.data;
  },

  /**
   * Obtiene canastos asignados a un lote
   */
  async getCanastosLote(loteId: string): Promise<LoteCanasto[]> {
    const response = await api.get(`${BASE_URL}/lotes/${loteId}/canastos`);
    return response.data;
  },

  /**
   * Obtiene los estados de canasto disponibles
   */
  async getEstados(): Promise<{ value: string; label: string; color: string }[]> {
    const response = await api.get(`${BASE_URL}/estados`);
    return response.data;
  },
};

export default canastoService;
