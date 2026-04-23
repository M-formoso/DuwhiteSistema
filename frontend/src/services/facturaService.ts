/**
 * Servicio de Facturación.
 */

import api from './api';
import {
  Factura,
  FacturaListResponse,
  FacturaCreateDesdePedido,
  FacturaCreateManual,
  NotaCreditoCreate,
  NotaDebitoCreate,
  EmitirFacturaResponse,
  FacturaFiltros,
  RegistrarCobroRequest,
  RegistrarCobroResponse,
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
};
