/**
 * Tipos para la integración con GeoTrackers (flota).
 *
 * El frontend NUNCA habla directo con GeoTrackers — todo pasa por el
 * proxy del backend `/api/v1/geotrackers/*`.
 */

/** Última ubicación conocida de un vehículo (endpoint /ubicaciones). */
export interface UbicacionVehiculo {
  id: number;
  imei: string | number | null;
  patente: string;
  nombre: string | null;
  fecha: string | null; // "YYYY-MM-DD HH:MM:SS"
  latitud: number | null;
  longitud: number | null;
  velocidad: number | null;
}

/** Punto de un recorrido histórico. */
export interface PuntoHistorial {
  id: number;
  fecha: string;
  latitud: number;
  longitud: number;
  velocidad: number;
}

/** Créditos de la cuenta de GeoTrackers (siempre vienen al final). */
export interface CreditosGeoTrackers {
  disponibles: number;
  utilizados: number;
  ultima_recarga: string | null;
}

/** Paginación de los endpoints de listado/historial. */
export interface PaginacionGeoTrackers {
  count: number;
  limit: number;
  offset: number;
}

/** Envoltorio estándar de una respuesta exitosa de GeoTrackers. */
export interface GeoTrackersResponse<T> {
  success: boolean;
  data: T;
  creditos?: CreditosGeoTrackers;
  pagination?: PaginacionGeoTrackers;
}

/** Vehículo del catálogo LOCAL (tabla `vehiculos` de DUWHITE). */
export interface VehiculoLocal {
  id: string; // uuid
  geotrackers_id: number;
  patente: string;
  nombre: string | null;
  chofer_default: string | null;
  activo: boolean;
}

/** Resultado de POST /geotrackers/sincronizar. */
export interface SincronizarResponse {
  creados: number;
  actualizados: number;
  desactivados: number;
  total_remotos: number;
}

/** Un lote de recolección asignado a un vehículo. */
export interface AsignacionRecoleccion {
  lote_id: string;
  numero: string;
  cliente: string | null;
  estado: string;
  fecha_ingreso: string | null;
}

/** Un remito de entrega asignado a un vehículo. */
export interface AsignacionEntrega {
  remito_id: string;
  numero: string;
  cliente: string | null;
  estado: string;
  fecha_emision: string | null;
}

/** Resultado de GET /geotrackers/vehiculos/{gt_id}/asignaciones. */
export interface AsignacionesVehiculo {
  vehiculo: {
    id: string;
    geotrackers_id: number;
    patente: string;
    nombre: string | null;
  } | null;
  recolecciones: AsignacionRecoleccion[];
  entregas: AsignacionEntrega[];
  mensaje?: string;
}
