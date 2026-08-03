/**
 * Servicio de Remitos
 */

import api from './api';
import {
  Remito,
  RemitoListItem,
  GenerarRemitoRequest,
  GenerarRemitoResponse,
  TipoRemito,
  EstadoRemito,
} from '@/types/produccion-v2';

const BASE_URL = '/remitos';

export interface MiRemitoListItem {
  id: string;
  numero: string;
  tipo: string;
  estado: string;
  fecha_emision: string | null;
  fecha_entrega: string | null;
  lote_numero: string | null;
  total: number;
}

export interface MiRemitoDetalleItem {
  id: string;
  producto_id: string | null;
  producto_codigo: string | null;
  producto_nombre: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  descripcion?: string | null;
}

export interface MiRemitoDetalle extends MiRemitoListItem {
  peso_total_kg: number | null;
  subtotal: number;
  descuento: number;
  notas: string | null;
  detalles: MiRemitoDetalleItem[];
}

export const remitoService = {
  /**
   * Lista remitos con filtros
   */
  async getAll(params?: {
    cliente_id?: string;
    lote_id?: string;
    estado?: EstadoRemito;
    tipo?: TipoRemito;
    fecha_desde?: string;
    fecha_hasta?: string;
    skip?: number;
    limit?: number;
  }): Promise<RemitoListItem[]> {
    const response = await api.get(BASE_URL, { params });
    return response.data;
  },

  /**
   * Obtiene tipos de remito
   */
  async getTipos(): Promise<{ value: string; label: string }[]> {
    const response = await api.get(`${BASE_URL}/tipos`);
    return response.data;
  },

  /**
   * Obtiene estados de remito
   */
  async getEstados(): Promise<{ value: string; label: string; color: string }[]> {
    const response = await api.get(`${BASE_URL}/estados`);
    return response.data;
  },

  /**
   * Obtiene un remito por ID
   */
  async getById(id: string): Promise<Remito> {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response.data;
  },

  /**
   * Devuelve la URL absoluta del PDF del remito (puede abrirse en una
   * ventana nueva o pasarse a un <iframe> para imprimir automáticamente).
   */
  getPdfUrl(remitoId: string, conPrecios: boolean = false): string {
    const base = api.defaults.baseURL || '';
    const sep = base.endsWith('/') ? '' : '';
    const qs = conPrecios ? '?con_precios=true' : '';
    return `${base}${sep}${BASE_URL}/${remitoId}/pdf${qs}`;
  },

  /**
   * Descarga el PDF del remito como Blob (para enviar a print() vía iframe).
   */
  async getPdfBlob(remitoId: string, conPrecios: boolean = false): Promise<Blob> {
    const response = await api.get(`${BASE_URL}/${remitoId}/pdf`, {
      responseType: 'blob',
      params: conPrecios ? { con_precios: true } : undefined,
    });
    return response.data;
  },

  /**
   * Portal cliente: lista los remitos del cliente logueado con filtros de fecha.
   */
  async getMisRemitos(params?: {
    fecha_desde?: string;
    fecha_hasta?: string;
    skip?: number;
    limit?: number;
  }): Promise<MiRemitoListItem[]> {
    const response = await api.get(`${BASE_URL}/mis-remitos`, { params });
    return response.data;
  },

  /**
   * Portal cliente: detalle de un remito propio (con productos).
   */
  async getMiRemito(remitoId: string): Promise<MiRemitoDetalle> {
    const response = await api.get(`${BASE_URL}/mis-remitos/${remitoId}`);
    return response.data;
  },

  /**
   * Genera remito desde la etapa de conteo
   */
  async generarDesdeLote(
    loteId: string,
    request: GenerarRemitoRequest
  ): Promise<GenerarRemitoResponse> {
    const response = await api.post(`${BASE_URL}/lotes/${loteId}/generar`, request);
    return response.data;
  },

  /**
   * Genera un remito manual (sin flujo de producción). Backend crea un
   * lote sombra internamente y sigue el flujo normal.
   */
  async generarManual(request: {
    cliente_id: string;
    detalles: Array<{
      producto_id: string;
      cantidad: number;
      precio_unitario: number;
      descripcion?: string;
    }>;
    peso_total_kg?: number;
    notas?: string;
  }): Promise<GenerarRemitoResponse> {
    const response = await api.post(`${BASE_URL}/manual`, request);
    return response.data;
  },

  /**
   * Genera remito complementario (para lotes de relevado)
   */
  async generarComplementario(
    loteId: string,
    request: GenerarRemitoRequest
  ): Promise<GenerarRemitoResponse> {
    const response = await api.post(
      `${BASE_URL}/lotes/${loteId}/generar-complementario`,
      request
    );
    return response.data;
  },

  /**
   * Marca remito como entregado
   */
  async marcarEntregado(
    id: string,
    notas_entrega?: string
  ): Promise<{
    mensaje: string;
    remito_id: string;
    estado: string;
    fecha_entrega: string;
  }> {
    const response = await api.post(`${BASE_URL}/${id}/entregar`, { notas_entrega });
    return response.data;
  },

  /**
   * Anula un remito
   */
  async anular(
    id: string,
    motivo: string
  ): Promise<{
    mensaje: string;
    remito_id: string;
    estado: string;
    motivo: string;
  }> {
    const response = await api.post(`${BASE_URL}/${id}/anular`, { motivo });
    return response.data;
  },

  /**
   * Obtiene remitos de un cliente
   */
  async getByCliente(
    clienteId: string,
    params?: { skip?: number; limit?: number }
  ): Promise<RemitoListItem[]> {
    const response = await api.get(`${BASE_URL}/cliente/${clienteId}`, { params });
    return response.data;
  },

  /**
   * Obtiene remitos de un lote
   */
  async getByLote(loteId: string): Promise<RemitoListItem[]> {
    const response = await api.get(`${BASE_URL}/lote/${loteId}`);
    return response.data;
  },
};

export default remitoService;
