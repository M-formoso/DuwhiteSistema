/**
 * Selector del vehículo (flota GeoTrackers) para asignar a una
 * recolección o a un remito de entrega. Opcional — si el usuario no
 * elige nada, el flujo sigue como antes.
 *
 * El `value` que maneja es el `id` (uuid) del catálogo LOCAL de
 * vehículos (`vehiculos.id`), no el `geotrackers_id`. Eso es lo que
 * los endpoints del backend persisten en lote/remito.
 */

import { useQuery } from '@tanstack/react-query';
import { Truck } from 'lucide-react';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { geotrackersService } from '@/services/geotrackersService';

interface Props {
  value: string;
  onChange: (uuidLocal: string) => void;
  label?: string;
  className?: string;
}

export function SelectorVehiculo({
  value,
  onChange,
  label = 'Vehículo asignado (opcional)',
  className,
}: Props) {
  const { data: vehiculos = [], isLoading } = useQuery({
    queryKey: ['gt-vehiculos-locales', true],
    queryFn: () => geotrackersService.getVehiculosLocales(true),
    staleTime: 60_000,
  });

  // Normalizamos "" ↔ "_none" para que shadcn Select no rompa (no admite "" como SelectItem value).
  const selectValue = value || '_none';
  const handle = (v: string) => onChange(v === '_none' ? '' : v);

  return (
    <div className={className}>
      <Label className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
        <Truck className="h-3.5 w-3.5" />
        {label}
      </Label>
      <Select value={selectValue} onValueChange={handle} disabled={isLoading}>
        <SelectTrigger>
          <SelectValue placeholder="— sin asignar —" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_none">— sin asignar —</SelectItem>
          {vehiculos.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.patente}
              {v.nombre ? ` · ${v.nombre}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {vehiculos.length === 0 && !isLoading && (
        <p className="text-[10px] text-amber-600 mt-1">
          No hay vehículos cargados. Sincronizá la flota desde /geolocalización.
        </p>
      )}
    </div>
  );
}

export default SelectorVehiculo;
