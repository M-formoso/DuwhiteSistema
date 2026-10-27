/**
 * Modal reutilizable para asignar / cambiar / desvincular el vehículo
 * de un lote (recolección) o de un remito (entrega).
 *
 * Al confirmar llama al endpoint PATCH correspondiente y dispara el
 * callback onSaved para que el caller invalide sus queries.
 */

import { useEffect, useState } from 'react';
import { Loader2, Truck } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SelectorVehiculo } from './SelectorVehiculo';
import { geotrackersService } from '@/services/geotrackersService';

type Tipo = 'lote' | 'remito';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: Tipo;
  /** UUID del lote o del remito. */
  entidadId: string;
  /** Número operativo que ve el usuario (ej: numero de lote / numero de remito). */
  entidadNumero?: string;
  /** vehiculoId actualmente asignado (uuid local), para pre-seleccionar. */
  valorInicial?: string | null;
  onSaved?: () => void;
}

export function AsignarVehiculoDialog({
  open,
  onOpenChange,
  tipo,
  entidadId,
  entidadNumero,
  valorInicial,
  onSaved,
}: Props) {
  const [vehiculoId, setVehiculoId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setVehiculoId(valorInicial ?? '');
  }, [open, valorInicial]);

  const label =
    tipo === 'lote'
      ? 'Vehículo que hace la recolección'
      : 'Vehículo que hace la entrega';

  const title = tipo === 'lote' ? 'Asignar vehículo (recolección)' : 'Asignar vehículo (entrega)';
  const subject = tipo === 'lote' ? 'lote' : 'remito';

  const handleSave = async () => {
    try {
      setSaving(true);
      const valor = vehiculoId || null;
      if (tipo === 'lote') {
        await geotrackersService.asignarVehiculoLote(entidadId, valor);
      } else {
        await geotrackersService.asignarVehiculoRemito(entidadId, valor);
      }
      toast.success(
        valor === null
          ? `Vehículo desvinculado del ${subject}.`
          : `Vehículo asignado al ${subject}.`,
      );
      onSaved?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        'No se pudo guardar el cambio';
      toast.error(detail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {entidadNumero && (
              <>
                <span className="font-mono">{entidadNumero}</span> ·{' '}
              </>
            )}
            Elegí el vehículo de la flota (sincronizado desde GeoTrackers). Si
            seleccionás "sin asignar" el {subject} queda sin vehículo.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <SelectorVehiculo
            value={vehiculoId}
            onChange={setVehiculoId}
            label={label}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AsignarVehiculoDialog;
