/**
 * Servicio de Configuración del Sistema (singleton).
 */

import api from './api';

export interface ConfiguracionSistema {
  id: string;
  empresa_nombre: string;
  empresa_razon_social: string;
  empresa_cuit: string;
  empresa_condicion_iva: string;
  empresa_direccion: string;
  empresa_localidad: string;
  empresa_provincia: string;
  empresa_codigo_postal: string;
  empresa_telefono: string;
  empresa_email: string;
  empresa_sitio_web: string;
  created_at: string;
  updated_at?: string;
}

export interface ConfiguracionUpdate {
  empresa_nombre?: string;
  empresa_razon_social?: string;
  empresa_cuit?: string;
  empresa_direccion?: string;
  empresa_localidad?: string;
  empresa_provincia?: string;
  empresa_codigo_postal?: string;
  empresa_telefono?: string;
  empresa_email?: string;
  empresa_sitio_web?: string;
}

export const configuracionService = {
  async obtener(): Promise<ConfiguracionSistema> {
    const response = await api.get('/configuracion/');
    return response.data;
  },

  async actualizar(data: ConfiguracionUpdate): Promise<ConfiguracionSistema> {
    const response = await api.put('/configuracion/', data);
    return response.data;
  },
};
