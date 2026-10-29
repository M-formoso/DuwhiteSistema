/**
 * Página de seguimiento (full-screen) del lote del cliente.
 *
 * Mobile-first: el mapa ocupa toda la pantalla menos un header angosto.
 * Decide automáticamente si está mostrando la fase de RECOLECCIÓN (vamos
 * a buscar el pedido) o de ENTREGA (vamos a dejar el pedido) según lo que
 * devuelve el backend. Auto-refresca cada 20s mientras la página esté
 * abierta.
 */

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft,
  Loader2,
  Truck,
  Gauge,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Info,
  Package,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { produccionService, SeguimientoLoteResponse } from '@/services/produccionService';

// Fix clásico de Leaflet con bundlers (Vite no resuelve los PNG por defecto).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function colorVelocidad(velocidad: number | null): string {
  const v = velocidad ?? 0;
  if (v === 0) return '#6b7280';
  if (v < 40) return '#2563eb';
  if (v < 80) return '#16a34a';
  return '#dc2626';
}

function iconoCamion(velocidad: number | null) {
  const color = colorVelocidad(velocidad);
  return L.divIcon({
    className: 'gt-seguimiento-marker',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    html: `
      <div style="
        width:42px;height:42px;border-radius:50%;
        background:${color};border:3px solid white;
        box-shadow:0 2px 10px rgba(0,0,0,.5);
        display:flex;align-items:center;justify-content:center;
        color:white;font-size:20px;
      ">🚐</div>`,
  });
}

/**
 * Pan suave al centro del vehículo cada vez que llega una posición nueva.
 * El primer render usa setView; los siguientes animan con panTo para no
 * marear al usuario cada 20 segundos.
 */
function CentrarEnVehiculo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const primerPan = useRef(true);
  useEffect(() => {
    if (primerPan.current) {
      map.setView([lat, lng], 15);
      primerPan.current = false;
    } else {
      map.panTo([lat, lng], { animate: true, duration: 0.8 });
    }
  }, [lat, lng, map]);
  return null;
}

function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  const parts = fecha.split(' ');
  if (parts.length === 2) return `${parts[0].slice(5)} ${parts[1].slice(0, 5)}`;
  return fecha;
}

export default function MiSeguimientoPage() {
  const { loteId } = useParams<{ loteId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery<SeguimientoLoteResponse>({
    queryKey: ['seguimiento-mi-lote', loteId],
    queryFn: () => produccionService.getSeguimientoMiLote(loteId!),
    enabled: !!loteId,
    refetchInterval: 20_000,
    refetchOnWindowFocus: false,
  });

  const ubic = data?.ubicacion;
  const tituloFase =
    data?.tipo_seguimiento === 'recoleccion'
      ? 'Camino a buscar tu pedido'
      : data?.tipo_seguimiento === 'entrega'
      ? 'En camino a entregar tu pedido'
      : 'Seguimiento del pedido';

  return (
    // Escapa al padding del MainLayout para ocupar toda la pantalla menos
    // la altura del header (4rem).
    <div
      className="relative -mx-4 -my-4 lg:-mx-6 lg:-my-6 flex flex-col"
      style={{ height: 'calc(100vh - 4rem - env(safe-area-inset-top))' }}
    >
      {/* === HEADER === */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-white flex-shrink-0 z-10 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label="Volver"
          className="flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
            {tituloFase}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            Lote <span className="font-mono">{data?.lote_numero || '—'}</span>
            {data?.vehiculo && (
              <>
                {' · '}
                <Truck className="inline h-3 w-3 mb-0.5" /> {data.vehiculo.patente}
              </>
            )}
          </div>
        </div>
        {ubic && (
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0 pr-2">
            <span className="flex items-center gap-1">
              <Gauge className="h-3.5 w-3.5" />
              {Math.round((ubic.velocidad ?? 0) * 10) / 10} km/h
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatFecha(ubic.fecha)}
            </span>
          </div>
        )}
      </div>

      {/* === CONTENIDO: MAPA o MENSAJE === */}
      <div className="flex-1 relative bg-gray-100">
        {isLoading && !data && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando seguimiento…
            </div>
          </div>
        )}

        {isError && (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="flex items-center gap-2 text-sm text-destructive text-center">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error instanceof Error ? error.message : 'No se pudo cargar el seguimiento.'}
            </div>
          </div>
        )}

        {data && !ubic && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-3">
            <div
              className={`p-4 rounded-full ${
                data.estado === 'completado'
                  ? 'bg-emerald-100 text-emerald-700'
                  : data.estado === 'cancelado'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {data.estado === 'completado' ? (
                <CheckCircle2 className="h-10 w-10" />
              ) : data.estado === 'cancelado' ? (
                <AlertCircle className="h-10 w-10" />
              ) : (
                <Package className="h-10 w-10" />
              )}
            </div>
            <div className="max-w-sm">
              <p className="text-sm text-gray-800 font-medium">
                {data.mensaje || 'No hay seguimiento disponible todavía.'}
              </p>
              <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                <Info className="h-3 w-3" />
                La vista se actualiza automáticamente cada 20 segundos.
              </p>
            </div>
          </div>
        )}

        {ubic && (
          <MapContainer
            center={[ubic.lat, ubic.lng]}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CentrarEnVehiculo lat={ubic.lat} lng={ubic.lng} />
            <Marker
              position={[ubic.lat, ubic.lng]}
              icon={iconoCamion(ubic.velocidad)}
            >
              <Popup>
                <div className="text-xs space-y-0.5">
                  <div className="font-semibold">
                    {data?.vehiculo?.patente ?? 'Vehículo'}
                  </div>
                  {data?.vehiculo?.nombre && (
                    <div className="text-muted-foreground">{data.vehiculo.nombre}</div>
                  )}
                  <div>
                    Velocidad: {Math.round((ubic.velocidad ?? 0) * 10) / 10} km/h
                  </div>
                  <div>Última señal: {formatFecha(ubic.fecha)}</div>
                  {ubic.direccion && <div>{ubic.direccion}</div>}
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        )}

        {/* Chip inferior con velocidad / fecha para mobile (donde no entra en el header). */}
        {ubic && (
          <div
            className="sm:hidden absolute bottom-3 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-lg px-3 py-1.5 flex items-center gap-3 text-xs"
            style={{ zIndex: 1000 }}
          >
            <span className="flex items-center gap-1 font-medium">
              <Gauge className="h-3.5 w-3.5 text-gray-500" />
              {Math.round((ubic.velocidad ?? 0) * 10) / 10} km/h
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {formatFecha(ubic.fecha)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
