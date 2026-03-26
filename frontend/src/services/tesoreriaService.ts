/**
 * Servicio de Tesorería
 */

import api from './api';
import type {
  Cheque,
  ChequeList,
  ChequeCreate,
  ChequeUpdate,
  DepositarChequeRequest,
  CobrarChequeRequest,
  RechazarChequeRequest,
  EntregarChequeRequest,
  MovimientoTesoreria,
  MovimientoTesoreriaList,
  MovimientoTesoreriaCreate,
  AnularMovimientoRequest,
  ResumenTesoreria,
} from '@/types/tesoreria';

// ==================== CONSTANTES ====================

export const tesoreriaConstantesService = {
  async getTiposCheque() {
    const response = await api.get<{ value: string; label: string }[]>(
      '/tesoreria/constantes/tipos-cheque'
    );
    return response.data;
  },

  async getOrigenesCheque() {
    const response = await api.get<{ value: string; label: string }[]>(
      '/tesoreria/constantes/origenes-cheque'
    );
    return response.data;
  },

  async getEstadosCheque() {
    const response = await api.get<{ value: string; label: string; color: string }[]>(
      '/tesoreria/constantes/estados-cheque'
    );
    return response.data;
  },

  async getMetodosPago() {
    const response = await api.get<{ value: string; label: string }[]>(
      '/tesoreria/constantes/metodos-pago'
    );
    return response.data;
  },

  async getBancos() {
    const response = await api.get<string[]>('/tesoreria/constantes/bancos');
    return response.data;
  },
};

// ==================== RESUMEN ====================

export const tesoreriaResumenService = {
  async getResumen(params?: { fecha_desde?: string; fecha_hasta?: string }) {
    const response = await api.get<ResumenTesoreria>('/tesoreria/resumen', { params });
    return response.data;
  },
};

// ==================== CHEQUES ====================

export const chequesService = {
  async getCheques(params?: {
    skip?: number;
    limit?: number;
    estado?: string;
    tipo?: string;
    origen?: string;
    cliente_id?: string;
    proveedor_id?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    buscar?: string;
    solo_en_cartera?: boolean;
    vencidos?: boolean;
    proximos_vencer?: boolean;
  }) {
    const response = await api.get<{
      items: ChequeList[];
      total: number;
      skip: number;
      limit: number;
    }>('/tesoreria/cheques', { params });
    return response.data;
  },

  async getCheque(chequeId: string) {
    const response = await api.get<Cheque>(`/tesoreria/cheques/${chequeId}`);
    return response.data;
  },

  async crearCheque(data: ChequeCreate) {
    const response = await api.post<Cheque>('/tesoreria/cheques', data);
    return response.data;
  },

  async actualizarCheque(chequeId: string, data: ChequeUpdate) {
    const response = await api.put<Cheque>(`/tesoreria/cheques/${chequeId}`, data);
    return response.data;
  },

  async depositarCheque(chequeId: string, data: DepositarChequeRequest) {
    const response = await api.post<Cheque>(`/tesoreria/cheques/${chequeId}/depositar`, data);
    return response.data;
  },

  async cobrarCheque(chequeId: string, data: CobrarChequeRequest) {
    const response = await api.post<Cheque>(`/tesoreria/cheques/${chequeId}/cobrar`, data);
    return response.data;
  },

  async rechazarCheque(chequeId: string, data: RechazarChequeRequest) {
    const response = await api.post<Cheque>(`/tesoreria/cheques/${chequeId}/rechazar`, data);
    return response.data;
  },

  async entregarCheque(chequeId: string, data: EntregarChequeRequest) {
    const response = await api.post<Cheque>(`/tesoreria/cheques/${chequeId}/entregar`, data);
    return response.data;
  },

  async eliminarCheque(chequeId: string) {
    await api.delete(`/tesoreria/cheques/${chequeId}`);
  },
};

// ==================== MOVIMIENTOS ====================

export const movimientosTesoreriaService = {
  async getMovimientos(params?: {
    skip?: number;
    limit?: number;
    tipo?: string;
    es_ingreso?: boolean;
    metodo_pago?: string;
    cliente_id?: string;
    proveedor_id?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    buscar?: string;
    incluir_anulados?: boolean;
  }) {
    const response = await api.get<{
      items: MovimientoTesoreriaList[];
      total: number;
      skip: number;
      limit: number;
    }>('/tesoreria/movimientos', { params });
    return response.data;
  },

  async getMovimiento(movimientoId: string) {
    const response = await api.get<MovimientoTesoreria>(
      `/tesoreria/movimientos/${movimientoId}`
    );
    return response.data;
  },

  async crearMovimiento(data: MovimientoTesoreriaCreate) {
    const response = await api.post<MovimientoTesoreria>('/tesoreria/movimientos', data);
    return response.data;
  },

  async anularMovimiento(movimientoId: string, data: AnularMovimientoRequest) {
    const response = await api.post<MovimientoTesoreria>(
      `/tesoreria/movimientos/${movimientoId}/anular`,
      data
    );
    return response.data;
  },
};

// Export all services
export const tesoreriaService = {
  constantes: tesoreriaConstantesService,
  resumen: tesoreriaResumenService,
  cheques: chequesService,
  movimientos: movimientosTesoreriaService,
};

export default tesoreriaService;
