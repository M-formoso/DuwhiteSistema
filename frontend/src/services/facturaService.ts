/**
 * Servicio de Facturación.
 */

import api from './api';
import {
  Factura,
  FacturaListResponse,
  FacturaCreateDesdePedido,
  FacturaCreateDesdeRemito,
  FacturaCreateManual,
  NotaCreditoCreate,
  NotaDebitoCreate,
  EmitirFacturaResponse,
  FacturaFiltros,
  RegistrarCobroRequest,
  RegistrarCobroResponse,
  PedidosPendientesResponse,
  RemitosPendientesResponse,
  FacturarMasivoResponse,
  EstadoArcaResponse,
} from '@/types/factura';

const BASE_URL = '/facturas';

export const facturaService = {
  async listar(filtros?: FacturaFiltros): Promise<FacturaListResponse> {
    const response = await api.get(BASE_URL, { params: filtros });
    return response.data;
  },

  async obtener(id: string): Promise<Factura> {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response.data;
  },

  async crearDesdePedido(data: FacturaCreateDesdePedido): Promise<Factura> {
    const response = await api.post(`${BASE_URL}/desde-pedido`, data);
    return response.data;
  },

  async crearManual(data: FacturaCreateManual): Promise<Factura> {
    const response = await api.post(`${BASE_URL}/manual`, data);
    return response.data;
  },

  async emitir(id: string): Promise<EmitirFacturaResponse> {
    const response = await api.post(`${BASE_URL}/${id}/emitir`);
    return response.data;
  },

  async crearNotaCredito(facturaId: string, data: NotaCreditoCreate): Promise<Factura> {
    const response = await api.post(`${BASE_URL}/${facturaId}/notas-credito`, data);
    return response.data;
  },

  async crearNotaDebito(facturaId: string, data: NotaDebitoCreate): Promise<Factura> {
    const response = await api.post(`${BASE_URL}/${facturaId}/notas-debito`, data);
    return response.data;
  },

  async eliminarBorrador(id: string): Promise<void> {
    await api.delete(`${BASE_URL}/${id}`);
  },

  async registrarCobro(
    id: string,
    data: RegistrarCobroRequest,
  ): Promise<RegistrarCobroResponse> {
    const response = await api.post(`${BASE_URL}/${id}/cobros`, data);
    return response.data;
  },

  async descargarPdf(id: string): Promise<Blob> {
    const response = await api.get(`${BASE_URL}/${id}/pdf`, { responseType: 'blob' });
    return response.data;
  },

  async listarPedidosPendientes(params?: {
    cliente_id?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    solo_listos?: boolean;
    page?: number;
    page_size?: number;
  }): Promise<PedidosPendientesResponse> {
    const response = await api.get(`${BASE_URL}/pedidos-pendientes`, { params });
    return response.data;
  },

  async facturarMasivo(pedidoIds: string[]): Promise<FacturarMasivoResponse> {
    const response = await api.post(
      `${BASE_URL}/pedidos-pendientes/facturar-masivo`,
      { pedido_ids: pedidoIds },
    );
    return response.data;
  },

  async previewMesCliente(
    clienteId: string,
    mes: number,
    anio: number,
  ): Promise<{
    cliente_id: string;
    cliente_nombre: string;
    mes: number;
    anio: number;
    periodo_label: string;
    incluidos: Array<{
      id: string;
      numero: string;
      fecha: string;
      estado: string;
      total: number;
      cantidad_items: number;
    }>;
    excluidos: Array<{
      id: string;
      numero: string;
      fecha: string;
      estado: string;
      total: number;
      cantidad_items: number;
      motivo_exclusion: string;
    }>;
    total_a_facturar: number;
    cantidad_a_facturar: number;
    cantidad_excluidos: number;
  }> {
    const params = new URLSearchParams({
      cliente_id: clienteId,
      mes: String(mes),
      anio: String(anio),
    });
    const response = await api.get(`${BASE_URL}/preview-mes-cliente?${params.toString()}`);
    return response.data;
  },

  async facturarMesCliente(
    clienteId: string,
    mes: number,
    anio: number,
    fechaEmision?: string,
  ): Promise<{ factura_id: string; tipo: string; total: number; items: number; mensaje: string }> {
    const params = new URLSearchParams({
      cliente_id: clienteId,
      mes: String(mes),
      anio: String(anio),
    });
    if (fechaEmision) params.append('fecha_emision', fechaEmision);
    const response = await api.post(`${BASE_URL}/desde-mes-cliente?${params.toString()}`);
    return response.data;
  },

  async estadoArca(): Promise<EstadoArcaResponse> {
    const response = await api.get(`${BASE_URL}/estado-arca`);
    return response.data;
  },

  // ==================== REMITOS ====================

  async listarRemitosPendientes(params?: {
    cliente_id?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    page?: number;
    page_size?: number;
  }): Promise<RemitosPendientesResponse> {
    const response = await api.get(`${BASE_URL}/remitos-pendientes`, { params });
    return response.data;
  },

  async crearDesdeRemito(
    data: FacturaCreateDesdeRemito,
  ): Promise<{ factura_id: string; tipo: string; total: number; items: number; mensaje: string }> {
    const response = await api.post(`${BASE_URL}/desde-remito`, data);
    return response.data;
  },

  async previewMesRemitos(
    clienteId: string,
    mes: number,
    anio: number,
  ): Promise<{
    cliente_id: string;
    cliente_nombre: string;
    mes: number;
    anio: number;
    periodo_label: string;
    incluidos: Array<{
      id: string;
      numero: string;
      fecha: string;
      estado: string;
      total: number;
      lote_numero: string | null;
      cantidad_items: number;
    }>;
    excluidos: Array<{
      id: string;
      numero: string;
      fecha: string;
      estado: string;
      total: number;
      lote_numero: string | null;
      cantidad_items: number;
      motivo_exclusion: string;
    }>;
    total_a_facturar: number;
    cantidad_a_facturar: number;
    cantidad_excluidos: number;
  }> {
    const params = new URLSearchParams({
      cliente_id: clienteId,
      mes: String(mes),
      anio: String(anio),
    });
    const response = await api.get(`${BASE_URL}/preview-mes-remitos?${params.toString()}`);
    return response.data;
  },

  async facturarMesRemitos(
    clienteId: string,
    mes: number,
    anio: number,
    fechaEmision?: string,
  ): Promise<{ factura_id: string; tipo: string; total: number; items: number; mensaje: string }> {
    const params = new URLSearchParams({
      cliente_id: clienteId,
      mes: String(mes),
      anio: String(anio),
    });
    if (fechaEmision) params.append('fecha_emision', fechaEmision);
    const response = await api.post(`${BASE_URL}/desde-mes-remitos?${params.toString()}`);
    return response.data;
  },
};
