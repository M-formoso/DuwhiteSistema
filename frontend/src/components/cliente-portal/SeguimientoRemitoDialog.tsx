/**
 * Mini mapa de seguimiento para el cliente: muestra solo el vehículo que
 * lleva SU remito, sin exponer el resto de la flota ni los otros clientes.
 *
 * El dialog se auto-refresca cada 20s mientras está abierto. Cuando el
 * remito pasa a entregado (o pierde el vehículo asignado) el mapa se
 * reemplaza por un mensaje contextual.
 */

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Loader2,
  Truck,
  Gauge,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { remitoService, SeguimientoRemitoResponse } from '@/services/remitoService';

// Fix clásico de Leaflet con bundlers (los PNG default no resuelven con Vite).
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
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    html: `
      <div style="
        width:38px;height:38px;border-radius:50%;
        background:${color};border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,.5);
        display:flex;align-items:center;justify-content:center;
        color:white;font-size:18px;
      ">🚐</div>`,
  });
}

/**
 * Mantiene el mapa centrado en el vehículo cuando cambia la posición.
 * Usamos `panTo` (en vez de `setView`) para que la animación sea suave y
 * no "salte" cada 20 segundos.
 */
function CentrarEnVehiculo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const primerPan = useRef(true);
  useEffect(() => {
    if (primerPan.current) {
      map.setView([lat, lng], 14);
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

interface Props {
  remitoId: string | null;
  remitoNumero?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SeguimientoRemitoDialog({
  remitoId,
  remitoNumero,
  open,
  onOpenChange,
}: Props) {
  const { data, isLoading, isError, error } = useQuery<SeguimientoRemitoResponse>({
    queryKey: ['seguimiento-mi-remito', remitoId],
    queryFn: () => remitoService.getSeguimientoMiRemito(remitoId!),
    enabled: open && !!remitoId,
    refetchInterval: open ? 20_000 : false,
    refetchOnWindowFocus: false,
  });

  const ubic = data?.ubicacion;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Seguimiento de entrega
          </DialogTitle>
          <DialogDescription>
            Remito{' '}
            <span className="font-mono">{remitoNumero || data?.remito_numero || '—'}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Estado / mensajes */}
        <div className="px-5 pb-3 space-y-2 text-sm">
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando seguimiento…
            </div>
          )}

          {isError && (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error instanceof Error ? error.message : 'No se pudo cargar el seguimiento.'}
            </div>
          )}

          {data?.vehiculo && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1 font-medium">
                <Truck className="h-4 w-4 text-primary" />
                {data.vehiculo.patente}
                {data.vehiculo.nombre && (
                  <span className="text-muted-foreground font-normal">
                    {' '}
                    · {data.vehiculo.nombre}
                  </span>
                )}
              </span>
              {ubic && (
                <>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Gauge className="h-4 w-4" />
                    {Math.round((ubic.velocidad ?? 0) * 10) / 10} km/h
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {formatFecha(ubic.fecha)}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Mensajes contextuales (sin vehículo, ya entregado, etc.) */}
          {data && !ubic && data.mensaje && (
            <div
              className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
                data.estado === 'entregado'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {data.estado === 'entregado' ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              ) : (
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              <span>{data.mensaje}</span>
            </div>
          )}
        </div>

        {/* Mapa — solo cuando hay posición */}
        <div className="w-full h-[360px] sm:h-[420px] bg-gray-100 border-t">
          {ubic ? (
            <MapContainer
              center={[ubic.lat, ubic.lng]}
              zoom={14}
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
                    <div>Velocidad: {Math.round((ubic.velocidad ?? 0) * 10) / 10} km/h</div>
                    <div>Última señal: {formatFecha(ubic.fecha)}</div>
                    {ubic.direccion && <div>{ubic.direccion}</div>}
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 text-muted-foreground">
              <MapPin className="h-10 w-10 opacity-30 mb-2" />
              <p className="text-sm">
                {data?.mensaje ||
                  'Todavía no podemos mostrar la ubicación de tu entrega.'}
              </p>
              <p className="text-xs mt-1">
                El mapa aparece cuando el pedido salió a entregarse con un vehículo asignado.
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 text-[11px] text-muted-foreground border-t bg-gray-50">
          La ubicación se actualiza automáticamente cada 20 segundos mientras esta ventana esté abierta.
        </div>
      </DialogContent>
    </Dialog>
  );
}
