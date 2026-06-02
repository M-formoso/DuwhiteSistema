/**
 * Modal para dividir un lote en una etapa con bifurcación (ej. Estirado).
 *
 * Versión simplificada: un slider de % decide cuánto peso del lote se
 * deriva al destino alternativo. El resto sigue al destino principal.
 * No se piden productos ni kg manuales.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Split, ArrowRight, Loader2, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  pesoTotalKg: number;
}

export function DividirLoteModal({
  open,
  onClose,
  loteId,
  loteNumero,
  etapaId,
  etapaNombre,
  pesoTotalKg,
}: DividirLoteModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // % del peso que se deriva al destino ALTERNATIVO (el resto va al principal)
  const [pctAlternativo, setPctAlternativo] = useState<number>(50);
  const [observaciones, setObservaciones] = useState('');

  // Cargar info de bifurcación de la etapa
  const { data: bifurcacionInfo, isLoading: loadingInfo } = useQuery<EtapaBifurcacionInfo>({
    queryKey: ['bifurcacion-info', etapaId],
    queryFn: () => produccionService.getBifurcacionInfo(etapaId),
    enabled: open && !!etapaId,
  });

  // Reset cuando se abre
  useEffect(() => {
    if (open) {
      setPctAlternativo(50);
      setObservaciones('');
    }
  }, [open]);

  const pesoBase = Number.isFinite(pesoTotalKg) && pesoTotalKg > 0 ? pesoTotalKg : 0;
  const pesoAlternativo = Math.round((pesoBase * pctAlternativo) / 100 * 10) / 10;
  const pesoPrincipal = Math.round((pesoBase - pesoAlternativo) * 10) / 10;

  const dividirMutation = useMutation({
    mutationFn: () => {
      return produccionService.dividirLote(loteId, etapaId, {
        peso_destino_principal_kg: pesoPrincipal,
        peso_destino_alternativo_kg: pesoAlternativo,
        observaciones_principal: observaciones || undefined,
        observaciones_alternativo: observaciones || undefined,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      toast({
        title: 'Lote dividido correctamente',
        description: data.mensaje,
      });
      onClose();
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      const detail = error.response?.data?.detail || 'Error al dividir el lote';
      toast({ title: 'Error', description: detail, variant: 'destructive' });
    },
  });

  if (loadingInfo) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-[500px]">
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
        <DialogContent className="sm:max-w-[500px]">
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

  const destinoPrincipalNombre = bifurcacionInfo.etapa_destino_principal_nombre || 'Principal';
  const destinoAlternativoNombre = bifurcacionInfo.etapa_destino_alternativa_nombre || 'Alternativo';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5 text-primary" />
            Dividir lote {loteNumero}
          </DialogTitle>
          <DialogDescription>
            Elegí qué porcentaje del lote se deriva a <strong>{destinoAlternativoNombre}</strong>.
            El resto sigue a <strong>{destinoPrincipalNombre}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Peso total */}
          <div className="text-sm text-gray-600">
            Peso total del lote:{' '}
            <span className="font-mono font-bold text-gray-900">
              {pesoBase.toFixed(1)} kg
            </span>
          </div>

          {/* Slider de % al alternativo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pct-alternativo">
                A {destinoAlternativoNombre}
              </Label>
              <span className="font-mono font-bold text-orange-600">{pctAlternativo}%</span>
            </div>
            <input
              id="pct-alternativo"
              type="range"
              min={0}
              max={100}
              step={5}
              value={pctAlternativo}
              onChange={(e) => setPctAlternativo(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-gradient-to-r from-green-200 to-orange-300 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Resumen de pesos */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowRight className="h-4 w-4 text-green-600" />
                  <Badge className="bg-green-600">{destinoPrincipalNombre}</Badge>
                </div>
                <div className="text-2xl font-bold font-mono text-green-700">
                  {pesoPrincipal.toFixed(1)} kg
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowRight className="h-4 w-4 text-orange-600" />
                  <Badge className="bg-orange-500">{destinoAlternativoNombre}</Badge>
                </div>
                <div className="text-2xl font-bold font-mono text-orange-700">
                  {pesoAlternativo.toFixed(1)} kg
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Observaciones opcionales */}
          <div className="space-y-1">
            <Label htmlFor="observaciones-div" className="text-xs text-gray-600">
              Observaciones (opcional)
            </Label>
            <Textarea
              id="observaciones-div"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Por ejemplo: separar manteles de toallas"
              rows={2}
              className="text-sm"
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={dividirMutation.isPending}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => dividirMutation.mutate()}
            disabled={
              dividirMutation.isPending ||
              pctAlternativo === 0 ||
              pctAlternativo === 100 ||
              pesoBase === 0
            }
            className="w-full sm:w-auto"
          >
            {dividirMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Dividiendo...
              </>
            ) : (
              <>
                <Split className="h-4 w-4 mr-2" />
                Dividir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
