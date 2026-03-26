/**
 * Servicio de Liquidaciones
 */

import api from './api';
import {
  Liquidacion,
  LiquidacionList,
  LiquidacionCreate,
  LiquidacionUpdate,
  LiquidacionConfirmar,
  LiquidacionAnular,
  LiquidacionDesdeControl,
  ListaPreciosParaLiquidacion,
  ResumenLiquidaciones,
} from '@/types/liquidacion';

export interface LiquidacionesListParams {
  skip?: number;
  limit?: number;
  estado?: string;
  cliente_id?: string;
  pedido_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  incluir_anuladas?: boolean;
}

export interface LiquidacionesListResponse {
  items: LiquidacionList[];
  total: number;
  skip: number;
  limit: number;
}

const liquidacionService = {
  /**
   * Lista liquidaciones con filtros
   */
  async listar(params: LiquidacionesListParams = {}): Promise<LiquidacionesListResponse> {
    const response = await api.get('/liquidaciones/', { params });
    return response.data;
  },

  /**
   * Obtiene una liquidación por ID
   */
  async obtener(id: string): Promise<Liquidacion> {
    const response = await api.get(`/liquidaciones/${id}`);
    return response.data;
  },

  /**
   * Obtiene liquidación por pedido
   */
  async obtenerPorPedido(pedidoId: string): Promise<Liquidacion | null> {
    const response = await api.get(`/liquidaciones/por-pedido/${pedidoId}`);
    return response.data;
  },

  /**
   * Obtiene resumen de liquidaciones
   */
  async obtenerResumen(params: { fecha_desde?: string; fecha_hasta?: string } = {}): Promise<ResumenLiquidaciones> {
    const response = await api.get('/liquidaciones/resumen', { params });
    return response.data;
  },

  /**
   * Obtiene precios de una lista para liquidación
   */
  async obtenerPreciosLista(listaId: string): Promise<ListaPreciosParaLiquidacion> {
    const response = await api.get(`/liquidaciones/precios-lista/${listaId}`);
    return response.data;
  },

  /**
   * Crea una nueva liquidación
   */
  async crear(data: LiquidacionCreate): Promise<Liquidacion> {
    const response = await api.post('/liquidaciones/', data);
    return response.data;
  },

  /**
   * Crea liquidación desde control de producción
   */
  async crearDesdeControl(data: LiquidacionDesdeControl): Promise<Liquidacion> {
    const response = await api.post('/liquidaciones/desde-control', data);
    return response.data;
  },

  /**
   * Actualiza una liquidación
   */
  async actualizar(id: string, data: LiquidacionUpdate): Promise<Liquidacion> {
    const response = await api.put(`/liquidaciones/${id}`, data);
    return response.data;
  },

  /**
   * Confirma una liquidación (genera cargo en cuenta corriente)
   */
  async confirmar(id: string, data?: LiquidacionConfirmar): Promise<Liquidacion> {
    const response = await api.post(`/liquidaciones/${id}/confirmar`, data || {});
    return response.data;
  },

  /**
   * Anula una liquidación
   */
  async anular(id: string, data: LiquidacionAnular): Promise<Liquidacion> {
    const response = await api.post(`/liquidaciones/${id}/anular`, data);
    return response.data;
  },

  /**
   * Elimina una liquidación en borrador
   */
  async eliminar(id: string): Promise<void> {
    await api.delete(`/liquidaciones/${id}`);
  },
};

export default liquidacionService;
