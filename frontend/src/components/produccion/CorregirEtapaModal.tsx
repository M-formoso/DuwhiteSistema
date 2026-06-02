/**
 * Modal para corregir datos de una etapa en proceso (peso del lote y máquinas asignadas)
 */

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Scale, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

import { produccionService } from '@/services/produccionService';

interface Maquina {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  estado: string;
  capacidad_kg: number | null;
}

interface CorregirEtapaModalProps {
  open: boolean;
  onClose: () => void;
  loteId: string;
  etapaId: string;
  loteNumero: string;
  etapaNombre: string;
  pesoActualKg: number | null;
  requiereMaquina: boolean;
  tipoMaquina: string | null;
  maquinasActuales: string[]; // IDs de máquinas asignadas hoy
}

export function CorregirEtapaModal({
  open,
  onClose,
  loteId,
  etapaId,
  loteNumero,
  etapaNombre,
  pesoActualKg,
  requiereMaquina,
  tipoMaquina,
  maquinasActuales,
}: CorregirEtapaModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [peso, setPeso] = useState<string>('');
  const [selectedMaquinas, setSelectedMaquinas] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setPeso(pesoActualKg !== null && pesoActualKg !== undefined ? String(pesoActualKg) : '');
      setSelectedMaquinas(maquinasActuales);
    }
  }, [open, pesoActualKg, maquinasActuales]);

  // Cargar disponibles del mismo tipo + incluir las actualmente asignadas
  const { data: disponibles = [] } = useQuery<Maquina[]>({
    queryKey: ['maquinas-disponibles', tipoMaquina],
    queryFn: () => produccionService.getMaquinasDisponibles(tipoMaquina || undefined),
    enabled: open && requiereMaquina,
  });

  // Listado completo a mostrar = disponibles + las que ya tiene asignadas (aunque no figuren como disponibles)
  const { data: todasMaquinas = [] } = useQuery<Maquina[]>({
    queryKey: ['maquinas-lista', tipoMaquina],
    queryFn: () => produccionService.getMaquinas({ tipo: tipoMaquina || undefined }),
    enabled: open && requiereMaquina && maquinasActuales.length > 0,
  });

  const opcionesMaquinas: Maquina[] = (() => {
    const map = new Map<string, Maquina>();
    disponibles.forEach((m) => map.set(m.id, m));
    todasMaquinas
      .filter((m) => maquinasActuales.includes(m.id))
      .forEach((m) => map.set(m.id, m));
    return Array.from(map.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
  })();

  const toggleMaquina = (id: string) => {
    setSelectedMaquinas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const corregirMutation = useMutation({
    mutationFn: () => {
      const payload: {
        peso_entrada_kg?: number | null;
        maquinas_ids?: string[];
      } = {};
      // Peso: si está vacío, no lo mando; si tiene valor (incluido 0), lo mando.
      if (peso.trim() !== '') {
        const n = parseFloat(peso);
        if (Number.isFinite(n)) payload.peso_entrada_kg = n;
      }
      if (requiereMaquina) {
        payload.maquinas_ids = selectedMaquinas;
      }
      return produccionService.corregirEtapaEnProceso(loteId, etapaId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['maquinas-disponibles'] });
      queryClient.invalidateQueries({ queryKey: ['lote', loteId] });
      toast({
        title: 'Lote actualizado',
        description: 'Los datos de la etapa en curso fueron corregidos.',
      });
      onClose();
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      const detail = error.response?.data?.detail || 'No se pudo corregir la etapa';
      toast({ title: 'Error', description: detail, variant: 'destructive' });
    },
  });

  const sinCambios =
    (peso.trim() === '' ||
      parseFloat(peso) === Number(pesoActualKg ?? NaN)) &&
    (!requiereMaquina ||
      (selectedMaquinas.length === maquinasActuales.length &&
        selectedMaquinas.every((id) => maquinasActuales.includes(id))));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Corregir lote {loteNumero}
          </DialogTitle>
          <DialogDescription>
            Etapa en curso: <strong>{etapaNombre}</strong>. Ajustá el peso o las máquinas si hubo un
            error al iniciar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="peso-correccion" className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Peso de entrada (kg)
            </Label>
            <Input
              id="peso-correccion"
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              placeholder="Ej: 45.5"
            />
            <p className="text-xs text-gray-500">
              Dejá vacío para no tocar el peso. Sobreescribe el valor actual del lote.
            </p>
          </div>

          {requiereMaquina && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Máquinas asignadas
                {tipoMaquina && (
                  <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs uppercase">
                    {tipoMaquina}
                  </span>
                )}
              </Label>
              {opcionesMaquinas.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No hay máquinas disponibles de este tipo y el lote no tiene ninguna asignada.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto border rounded p-2">
                  {opcionesMaquinas.map((m) => {
                    const seleccionada = selectedMaquinas.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMaquina(m.id)}
                        className={`text-left text-sm rounded border px-2 py-2 transition-colors ${
                          seleccionada
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-mono text-xs text-gray-500">{m.codigo}</div>
                        <div className="font-medium truncate">{m.nombre}</div>
                        {m.capacidad_kg && (
                          <div className="text-xs text-gray-400">{m.capacidad_kg} kg</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={corregirMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => corregirMutation.mutate()}
            disabled={corregirMutation.isPending || sinCambios}
          >
            {corregirMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar cambios'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
