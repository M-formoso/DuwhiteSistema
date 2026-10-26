/**
 * Mapa en vivo de la flota (GeoTrackers).
 *
 * Diseño pensado como "pantalla completa": el mapa ocupa casi todo el
 * viewport (menos la altura del header de DUWHITE). Arriba a la
 * izquierda hay chips flotantes para abrir paneles con la lista de
 * vehículos / opciones; arriba a la derecha el estado de créditos.
 *
 * Toda la data pesada (asignaciones por vehículo) vive en el popup del
 * marker, que es donde el admin lee "¿este auto qué pedido lleva?".
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  X,
  Settings,
  Zap,
  List,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

/** Elige color según velocidad. */
function colorVelocidad(velocidad: number | null): string {
  const v = velocidad ?? 0;
  if (v === 0) return '#6b7280'; // gris quieto
  if (v < 40) return '#2563eb'; // azul lento
  if (v < 80) return '#16a34a'; // verde ritmo
  return '#dc2626'; // rojo rápido
}

function iconoPorEstado(velocidad: number | null) {
  const color = colorVelocidad(velocidad);
  return L.divIcon({
    className: 'gt-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `
      <div style="
        width:32px;height:32px;border-radius:50%;
        background:${color};border:3px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,.5);
        display:flex;align-items:center;justify-content:center;
        color:white;font-size:14px;
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
    if (bounds) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
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
  const parts = fecha.split(' ');
  if (parts.length === 2) return `${parts[0].slice(5)} ${parts[1].slice(0, 5)}`;
  return fecha;
}

type PanelAbierto = null | 'vehiculos' | 'opciones';

export default function GeolocalizacionPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [panel, setPanel] = useState<PanelAbierto>(null);
  const queryClient = useQueryClient();

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
      queryClient.invalidateQueries({ queryKey: ['gt-asignaciones'] });
      queryClient.invalidateQueries({ queryKey: ['gt-vehiculos-locales'] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al sincronizar';
      alert(msg);
    } finally {
      setSyncLoading(false);
    }
  };

  const togglePanel = (p: Exclude<PanelAbierto, null>) =>
    setPanel((prev) => (prev === p ? null : p));

  return (
    // El contenido escapa al padding del MainLayout para ocupar toda la pantalla.
    // El header fijo mide 4rem (ver Header.tsx), por eso restamos esa altura.
    <div
      className="relative -mx-4 -my-4 lg:-mx-6 lg:-my-6"
      style={{ height: 'calc(100vh - 4rem - env(safe-area-inset-top))' }}
    >
      {/* === MAPA === */}
      <MapContainer
        center={centroDefault}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
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

      {/* === CHIPS FLOTANTES: top-left === */}
      <div className="absolute top-3 left-3 flex flex-wrap gap-2" style={{ zIndex: 1000 }}>
        <button
          onClick={() => togglePanel('vehiculos')}
          className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg text-sm font-medium transition
            ${
              panel === 'vehiculos'
                ? 'bg-primary text-white'
                : 'bg-white text-gray-800 hover:bg-gray-50'
            }`}
        >
          <List className="h-4 w-4" />
          Vehículos
          <span
            className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold
              ${panel === 'vehiculos' ? 'bg-white/20' : 'bg-gray-100'}`}
          >
            {vehiculos.length}
          </span>
        </button>

        <button
          onClick={() => togglePanel('opciones')}
          className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg text-sm font-medium transition
            ${
              panel === 'opciones'
                ? 'bg-primary text-white'
                : 'bg-white text-gray-800 hover:bg-gray-50'
            }`}
        >
          <Settings className="h-4 w-4" />
          Opciones
        </button>
      </div>

      {/* === TOP-RIGHT: créditos (siempre visible, es contexto importante) === */}
      <div
        className="absolute top-3 right-3 flex items-center gap-2 px-3 py-2 rounded-full bg-white shadow-lg text-sm"
        style={{ zIndex: 1000 }}
      >
        <Zap className="h-4 w-4 text-amber-500" />
        <span className="font-semibold">{data?.creditos?.disponibles ?? '—'}</span>
        <span className="text-xs text-muted-foreground">créditos</span>
      </div>

      {/* === ESTADO: cargando / error === */}
      {isError && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-destructive text-white text-sm flex items-center gap-2 shadow-lg"
          style={{ zIndex: 1000 }}
        >
          <AlertCircle className="h-4 w-4" />
          {error instanceof Error ? error.message : 'No se pudo cargar la flota'}
        </div>
      )}

      {isLoading && !data && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-white text-sm flex items-center gap-2 shadow-lg"
          style={{ zIndex: 1000 }}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando flota…
        </div>
      )}

      {/* === DRAWER LATERAL === */}
      {panel && (
        <div
          className="absolute top-0 right-0 h-full bg-white shadow-2xl flex flex-col"
          style={{ zIndex: 999, width: 'min(360px, 92vw)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              {panel === 'vehiculos' ? (
                <>
                  <List className="h-4 w-4" />
                  Vehículos ({vehiculos.length})
                </>
              ) : (
                <>
                  <Settings className="h-4 w-4" />
                  Opciones
                </>
              )}
            </h2>
            <button
              onClick={() => setPanel(null)}
              className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {panel === 'vehiculos' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {vehiculos.length === 0 && !isLoading && (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  No hay vehículos con posición reciente.
                </p>
              )}
              {vehiculos.map((v) => {
                const color = colorVelocidad(v.velocidad);
                return (
                  <div
                    key={v.id}
                    className="rounded-lg border p-3 text-sm hover:bg-muted/50 transition"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="font-semibold flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ background: color }}
                        />
                        {v.patente}
                      </div>
                      <span className="text-sm font-mono">
                        {Math.round((v.velocidad ?? 0) * 10) / 10} km/h
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{v.nombre || '—'}</span>
                      <span>{formatFechaCorta(v.fecha)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {panel === 'opciones' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <div>
                    <div className="text-sm font-medium">Auto-refresh</div>
                    <div className="text-xs text-muted-foreground">
                      Actualizar posiciones cada 15 segundos.
                    </div>
                  </div>
                </label>
              </div>

              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refrescar posiciones
                </Button>
              </div>

              <div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSync}
                  disabled={syncLoading}
                >
                  {syncLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Sincronizar flota con GeoTrackers
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  Trae de GeoTrackers y actualiza el catálogo local
                  (alimenta los selectores de recolección y remito).
                </p>
              </div>

              <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Créditos disponibles:</span>
                  <strong>{data?.creditos?.disponibles ?? '—'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Créditos usados:</span>
                  <strong>{data?.creditos?.utilizados ?? '—'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Última recarga:</span>
                  <strong>{data?.creditos?.ultima_recarga ?? '—'}</strong>
                </div>
                {dataUpdatedAt > 0 && (
                  <div className="flex justify-between pt-1 border-t">
                    <span>Última actualización:</span>
                    <strong>
                      {new Date(dataUpdatedAt).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
