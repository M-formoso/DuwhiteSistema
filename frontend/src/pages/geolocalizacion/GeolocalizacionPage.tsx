/**
 * Mapa en vivo de la flota (GeoTrackers).
 *
 * Muestra todos los vehículos en un mapa de Leaflet con tiles de
 * OpenStreetMap. Auto-refresh cada 15s (el cache del backend
 * garantiza que no se queman créditos cuando varios usuarios tienen la
 * pantalla abierta a la vez).
 *
 * Al clickear un marker se abre un popup con las asignaciones activas
 * de ese vehículo: qué lotes está yendo a recolectar y qué remitos
 * tiene asignados para entregar.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Gauge,
  Truck,
  Package as PackageIcon,
  Receipt,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { geotrackersService } from '@/services/geotrackersService';
import type { UbicacionVehiculo, AsignacionesVehiculo } from '@/types/geotrackers';

// === Fix clásico de Leaflet con bundlers (los PNG de los íconos no
// resuelven bien con Vite). Usamos íconos de CDN. ===
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Marker custom con color según velocidad (gris quieto / azul despacio / rojo rápido)
function iconoPorEstado(velocidad: number | null) {
  const v = velocidad ?? 0;
  let color = '#6b7280'; // gris
  if (v > 0 && v < 40) color = '#2563eb'; // azul
  else if (v >= 40 && v < 80) color = '#16a34a'; // verde
  else if (v >= 80) color = '#dc2626'; // rojo
  return L.divIcon({
    className: 'gt-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `
      <div style="
        width:28px;height:28px;border-radius:50%;
        background:${color};border:3px solid white;
        box-shadow:0 1px 4px rgba(0,0,0,.4);
        display:flex;align-items:center;justify-content:center;
        color:white;font-size:11px;font-weight:700;
      ">🚐</div>`,
  });
}

function fitBoundsAll(vehiculos: UbicacionVehiculo[]) {
  const pts = vehiculos
    .filter((v) => v.latitud != null && v.longitud != null)
    .map((v) => [v.latitud!, v.longitud!] as [number, number]);
  if (pts.length === 0) return undefined;
  return L.latLngBounds(pts.map(([a, b]) => L.latLng(a, b)));
}

function AjustarZoom({ vehiculos }: { vehiculos: UbicacionVehiculo[] }) {
  const map = useMap();
  useEffect(() => {
    const bounds = fitBoundsAll(vehiculos);
    if (bounds) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [vehiculos, map]);
  return null;
}

function PopupAsignaciones({ geotrackersId }: { geotrackersId: number }) {
  const { data, isLoading } = useQuery<AsignacionesVehiculo>({
    queryKey: ['gt-asignaciones', geotrackersId],
    queryFn: () => geotrackersService.getAsignaciones(geotrackersId),
    staleTime: 10_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Cargando asignaciones…
      </div>
    );
  }

  if (!data) return null;

  if (data.mensaje && !data.vehiculo) {
    return <p className="text-xs text-amber-700">{data.mensaje}</p>;
  }

  if (data.recolecciones.length === 0 && data.entregas.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Sin pedidos asignados actualmente.
      </p>
    );
  }

  return (
    <div className="space-y-2 min-w-[220px]">
      {data.recolecciones.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            <PackageIcon className="h-3 w-3" />
            Recolección ({data.recolecciones.length})
          </div>
          <ul className="mt-1 space-y-0.5 text-xs">
            {data.recolecciones.map((r) => (
              <li key={r.lote_id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  <span className="font-mono text-[10px] text-muted-foreground">{r.numero}</span>
                  {' · '}
                  {r.cliente ?? '—'}
                </span>
                <Badge variant="secondary" className="text-[9px] capitalize">
                  {r.estado.replace(/_/g, ' ')}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.entregas.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            <Receipt className="h-3 w-3" />
            Entregas ({data.entregas.length})
          </div>
          <ul className="mt-1 space-y-0.5 text-xs">
            {data.entregas.map((r) => (
              <li key={r.remito_id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  <span className="font-mono text-[10px] text-muted-foreground">{r.numero}</span>
                  {' · '}
                  {r.cliente ?? '—'}
                </span>
                <Badge variant="secondary" className="text-[9px] capitalize">
                  {r.estado.replace(/_/g, ' ')}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatFechaCorta(fecha: string | null): string {
  if (!fecha) return '—';
  // "YYYY-MM-DD HH:MM:SS" → "HH:MM"
  const parts = fecha.split(' ');
  if (parts.length === 2) return `${parts[0].slice(5)} ${parts[1].slice(0, 5)}`;
  return fecha;
}

export default function GeolocalizacionPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);

  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['gt-ubicaciones'],
    queryFn: () => geotrackersService.getUbicaciones(),
    refetchInterval: autoRefresh ? 15_000 : false,
    refetchOnWindowFocus: false,
    staleTime: 10_000,
  });

  const vehiculos: UbicacionVehiculo[] = useMemo(
    () => (data?.data ?? []).filter((v) => v.latitud != null && v.longitud != null),
    [data],
  );

  // Centro por default: Córdoba. Si hay vehículos, el map se auto-ajusta.
  const centroDefault: [number, number] = [-31.4201, -64.1888];

  const handleSync = async () => {
    try {
      setSyncLoading(true);
      const res = await geotrackersService.sincronizar();
      alert(
        `Sincronizado:\n+ ${res.creados} nuevos\n~ ${res.actualizados} actualizados\n- ${res.desactivados} desactivados`,
      );
      refetch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al sincronizar';
      alert(msg);
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            Geolocalización de flota
          </h1>
          <p className="text-sm text-muted-foreground">
            Posición en vivo de los vehículos (GeoTrackers).
            {data?.creditos && (
              <>
                {' '}· Créditos disponibles: <strong>{data.creditos.disponibles}</strong>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4"
            />
            Auto-refresh (15s)
          </label>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Refrescar
          </Button>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncLoading}>
            {syncLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Sincronizar flota
          </Button>
        </div>
      </div>

      {isError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error instanceof Error ? error.message : 'No se pudo cargar la ubicación de la flota.'}
          </CardContent>
        </Card>
      )}

      {/* Grid: mapa a la izquierda, panel lateral a la derecha en lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <Card className="overflow-hidden">
          <div style={{ height: '70vh', width: '100%' }}>
            <MapContainer
              center={centroDefault}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <AjustarZoom vehiculos={vehiculos} />
              {vehiculos.map((v) => (
                <Marker
                  key={v.id}
                  position={[v.latitud!, v.longitud!]}
                  icon={iconoPorEstado(v.velocidad)}
                >
                  <Popup>
                    <div className="space-y-1">
                      <div className="font-semibold flex items-center gap-2">
                        <Truck className="h-4 w-4 text-primary" />
                        {v.patente}
                      </div>
                      {v.nombre && (
                        <div className="text-xs text-muted-foreground">{v.nombre}</div>
                      )}
                      <div className="text-xs flex items-center gap-1">
                        <Gauge className="h-3 w-3" />
                        {Math.round((v.velocidad ?? 0) * 10) / 10} km/h
                        {' · últ: '}
                        {formatFechaCorta(v.fecha)}
                      </div>
                      <div className="pt-2 border-t mt-2">
                        <PopupAsignaciones geotrackersId={v.id} />
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </Card>

        {/* Panel lateral: lista de vehículos */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Vehículos ({vehiculos.length})</CardTitle>
          </CardHeader>
          <CardContent className="py-2 max-h-[66vh] overflow-y-auto space-y-2">
            {vehiculos.length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground italic">
                No hay vehículos con posición reciente.
              </p>
            )}
            {vehiculos.map((v) => {
              const vel = v.velocidad ?? 0;
              const colorBullet =
                vel === 0
                  ? 'bg-gray-400'
                  : vel < 40
                    ? 'bg-blue-500'
                    : vel < 80
                      ? 'bg-emerald-500'
                      : 'bg-red-500';
              return (
                <div
                  key={v.id}
                  className="rounded-md border p-2 text-sm hover:bg-muted/50 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${colorBullet}`} />
                      {v.patente}
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">
                      {Math.round(vel * 10) / 10} km/h
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{v.nombre || '—'}</span>
                    <span>{formatFechaCorta(v.fecha)}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {dataUpdatedAt > 0 && (
        <p className="text-[10px] text-muted-foreground text-right">
          Última actualización local: {new Date(dataUpdatedAt).toLocaleTimeString('es-AR')}
        </p>
      )}
    </div>
  );
}
