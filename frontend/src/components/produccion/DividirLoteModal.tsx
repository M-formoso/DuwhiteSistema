/**
 * Modal de Dividir (router) en una etapa con bifurcación (ej. Estirado).
 *
 * Versión simplificada: dos botones grandes, uno por destino. El lote
 * completo se enruta a la etapa elegida — no se piden productos ni kg.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Split, ArrowRight, Loader2, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
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

interface EtapaBifurcacionInfo {
  permite_bifurcacion: boolean;
  etapa_destino_principal_id: string | null;
  etapa_destino_principal_nombre: string | null;
  etapa_destino_alternativa_id: string | null;
  etapa_destino_alternativa_nombre: string | null;
}

interface DividirLoteModalProps {
  open: boolean;
  onClose: () => void;
  loteId: string;
  loteNumero: string;
  etapaId: string;
  etapaNombre: string;
  // Mantengo la prop por compatibilidad con los lugares que llaman el modal
  pesoTotalKg: number;
}

export function DividirLoteModal({
  open,
  onClose,
  loteId,
  loteNumero,
  etapaId,
  etapaNombre,
}: DividirLoteModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: bifurcacionInfo, isLoading } = useQuery<EtapaBifurcacionInfo>({
    queryKey: ['bifurcacion-info', etapaId],
    queryFn: () => produccionService.getBifurcacionInfo(etapaId),
    enabled: open && !!etapaId,
  });

  const moverMutation = useMutation({
    mutationFn: (etapaDestinoId: string) =>
      produccionService.moverLote(loteId, etapaDestinoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      toast({ title: 'Lote enviado al destino elegido' });
      onClose();
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      const detail = error.response?.data?.detail || 'No se pudo mover el lote';
      toast({ title: 'Error', description: detail, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Dividir lote</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!bifurcacionInfo?.permite_bifurcacion) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Etapa sin bifurcación</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              La etapa "{etapaNombre}" no permite dividir el lote.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const destinoPrincipalId = bifurcacionInfo.etapa_destino_principal_id;
  const destinoPrincipalNombre =
    bifurcacionInfo.etapa_destino_principal_nombre || 'Principal';
  const destinoAlternativoId = bifurcacionInfo.etapa_destino_alternativa_id;
  const destinoAlternativoNombre =
    bifurcacionInfo.etapa_destino_alternativa_nombre || 'Alternativo';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5 text-primary" />
            Lote {loteNumero}
          </DialogTitle>
          <DialogDescription>
            ¿A qué sección mandás este lote desde <strong>{etapaNombre}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 py-2">
          <button
            type="button"
            disabled={moverMutation.isPending || !destinoPrincipalId}
            onClick={() => destinoPrincipalId && moverMutation.mutate(destinoPrincipalId)}
            className="w-full py-5 rounded-2xl border-2 border-green-500 bg-green-50 text-green-800
                       hover:bg-green-100 active:scale-[0.98] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-between px-5"
          >
            <span className="text-base sm:text-lg font-bold">
              Mandar a {destinoPrincipalNombre}
            </span>
            <ArrowRight className="h-5 w-5" />
          </button>

          <button
            type="button"
            disabled={moverMutation.isPending || !destinoAlternativoId}
            onClick={() =>
              destinoAlternativoId && moverMutation.mutate(destinoAlternativoId)
            }
            className="w-full py-5 rounded-2xl border-2 border-orange-500 bg-orange-50 text-orange-800
                       hover:bg-orange-100 active:scale-[0.98] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-between px-5"
          >
            <span className="text-base sm:text-lg font-bold">
              Mandar a {destinoAlternativoNombre}
            </span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={moverMutation.isPending}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          {moverMutation.isPending && (
            <div className="flex items-center text-sm text-gray-500">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Moviendo...
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
