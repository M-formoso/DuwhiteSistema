/**
 * Service para hablar con los endpoints proxy de GeoTrackers en el backend
 * DUWHITE. La API Key de GeoTrackers vive en el server; acá solo pasamos
 * el JWT del usuario autenticado (lo agrega el interceptor de axios).
 */

import api from './api';
import type {
  AsignacionesVehiculo,
  GeoTrackersResponse,
  PuntoHistorial,
  SincronizarResponse,
  UbicacionVehiculo,
  VehiculoLocal,
} from '@/types/geotrackers';

export const geotrackersService = {
  /** Última ubicación de TODOS los vehículos de la flota (mapa principal). */
  async getUbicaciones(): Promise<GeoTrackersResponse<UbicacionVehiculo[]>> {
    const r = await api.get('/geotrackers/ubicaciones', {
      params: { limit: 200, offset: 0 },
    });
    return r.data;
  },

  /** Datos de un vehículo por ID (dispositivo GeoTrackers). */
  async getVehiculo(dispositivoId: number) {
    const r = await api.get(`/geotrackers/vehiculos/${dispositivoId}`);
    return r.data;
  },

  /** Última ubicación de un vehículo específico. */
  async getUbicacionVehiculo(dispositivoId: number) {
    const r = await api.get(`/geotrackers/vehiculos/${dispositivoId}/ubicacion`);
    return r.data;
  },

  /** Recorrido histórico entre dos fechas (YYYY-MM-DD o con hora). */
  async getHistorial(
    dispositivoId: number,
    desde: string,
    hasta: string,
    limit = 200,
    offset = 0,
  ): Promise<GeoTrackersResponse<PuntoHistorial[]>> {
    const r = await api.get(`/geotrackers/vehiculos/${dispositivoId}/historial`, {
      params: { desde, hasta, limit, offset },
    });
    return r.data;
  },

  /** Catálogo local sincronizado (alimenta los selectores). */
  async getVehiculosLocales(soloActivos = true): Promise<VehiculoLocal[]> {
    const r = await api.get('/geotrackers/local', {
      params: { solo_activos: soloActivos },
    });
    return r.data;
  },

  /** Trae lo de GeoTrackers y actualiza la tabla local. Solo admin. */
  async sincronizar(): Promise<SincronizarResponse> {
    const r = await api.post('/geotrackers/sincronizar');
    return r.data;
  },

  /** Qué está llevando el vehículo ahora (lotes recolección + remitos entrega). */
  async getAsignaciones(geotrackersId: number): Promise<AsignacionesVehiculo> {
    const r = await api.get(`/geotrackers/vehiculos/${geotrackersId}/asignaciones`);
    return r.data;
  },

  /** Reasigna el vehículo de recolección de un lote (pasa null para desvincular). */
  async asignarVehiculoLote(loteId: string, vehiculoId: string | null) {
    const r = await api.patch(`/produccion/lotes/${loteId}/vehiculo-recoleccion`, {
      vehiculo_id: vehiculoId,
    });
    return r.data as { mensaje: string; lote_id: string; vehiculo_id: string | null };
  },

  /** Reasigna el vehículo de entrega de un remito (pasa null para desvincular). */
  async asignarVehiculoRemito(remitoId: string, vehiculoId: string | null) {
    const r = await api.patch(`/remitos/${remitoId}/vehiculo`, {
      vehiculo_id: vehiculoId,
    });
    return r.data as { mensaje: string; remito_id: string; vehiculo_id: string | null };
  },
};

export default geotrackersService;
