/**
 * Servicio de Recolección.
 *
 * Endpoint usado por el chico que retira la ropa del cliente: valida
 * su PIN y queda un pedido "en camino" listo para que recepción lo
 * pese cuando llega al lavadero.
 */

import api from './api';

export interface IniciarRecoleccionRequest {
  cliente_id: string;
  repartidor_id: string;
  pin: string;
  notas?: string;
}

export interface IniciarRecoleccionResponse {
  pedido_id: string;
  numero: string;
  cliente_id: string;
  cliente_nombre: string;
  repartidor_id: string;
  repartidor_nombre: string;
  hora_inicio_retiro: string;
  mensaje: string;
}

export interface RecoleccionItem {
  pedido_id: string;
  numero: string;
  cliente_id: string;
  cliente_nombre: string;
  direccion: string | null;
  hora_inicio_retiro: string | null;
  tiene_lote: boolean;
}

export const recoleccionService = {
  async iniciar(data: IniciarRecoleccionRequest): Promise<IniciarRecoleccionResponse> {
    const response = await api.post('/recoleccion/iniciar', data);
    return response.data;
  },

  async listarDelDia(params?: {
    fecha?: string;
    repartidor_id?: string;
  }): Promise<RecoleccionItem[]> {
    const response = await api.get('/recoleccion/del-dia', { params });
    return response.data;
  },
};

export default recoleccionService;
