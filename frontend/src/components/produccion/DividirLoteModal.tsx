/**
 * Modal para dividir un lote en la etapa de Estirado (bifurcación)
 * Permite enviar parte del lote a Secado y otra parte de vuelta a Lavado
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Split, Scale, ArrowRight, Loader2, Info, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

import { produccionService } from '@/services/produccionService';
import { formatNumber } from '@/utils/formatters';

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

  // Estado del formulario
  const [pesoPrincipal, setPesoPrincipal] = useState(pesoTotalKg);
  const [pesoAlternativo, setPesoAlternativo] = useState(0);
  const [observacionesPrincipal, setObservacionesPrincipal] = useState('');
  const [observacionesAlternativo, setObservacionesAlternativo] = useState('');

  // Cargar info de bifurcación de la etapa
  const { data: bifurcacionInfo, isLoading: loadingInfo } = useQuery<EtapaBifurcacionInfo>({
    queryKey: ['bifurcacion-info', etapaId],
    queryFn: () => produccionService.getBifurcacionInfo(etapaId),
    enabled: open && !!etapaId,
  });

  // Reset cuando se abre el modal
  useEffect(() => {
    if (open) {
      setPesoPrincipal(pesoTotalKg);
      setPesoAlternativo(0);
      setObservacionesPrincipal('');
      setObservacionesAlternativo('');
    }
  }, [open, pesoTotalKg]);

  // Mutation para dividir el lote
  const dividirMutation = useMutation({
    mutationFn: () =>
      produccionService.dividirLote(loteId, etapaId, {
        peso_destino_principal_kg: pesoPrincipal,
        peso_destino_alternativo_kg: pesoAlternativo,
        observaciones_principal: observacionesPrincipal || undefined,
        observaciones_alternativo: observacionesAlternativo || undefined,
      }),
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
      toast({
        title: 'Error',
        description: detail,
        variant: 'destructive',
      });
    },
  });

  // Calcular porcentaje para la barra de progreso
  const porcentajePrincipal = pesoTotalKg > 0 ? (pesoPrincipal / pesoTotalKg) * 100 : 100;

  const handlePesoPrincipalChange = (value: string) => {
    const num = parseFloat(value) || 0;
    const clamped = Math.min(Math.max(0, num), pesoTotalKg);
    setPesoPrincipal(clamped);
    setPesoAlternativo(Math.round((pesoTotalKg - clamped) * 10) / 10);
  };

  const handlePesoAlternativoChange = (value: string) => {
    const num = parseFloat(value) || 0;
    const clamped = Math.min(Math.max(0, num), pesoTotalKg);
    setPesoAlternativo(clamped);
    setPesoPrincipal(Math.round((pesoTotalKg - clamped) * 10) / 10);
  };

  const handleSubmit = () => {
    if (pesoPrincipal <= 0) {
      toast({
        title: 'Error',
        description: 'El peso del destino principal debe ser mayor a 0',
        variant: 'destructive',
      });
      return;
    }
    dividirMutation.mutate();
  };

  if (!bifurcacionInfo?.permite_bifurcacion && !loadingInfo) {
    return (
      <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Etapa sin bifurcación</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              La etapa "{etapaNombre}" no permite bifurcación de lotes.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5 text-primary" />
            Dividir Lote - {loteNumero}
          </DialogTitle>
          <DialogDescription>
            Divide el lote en {etapaNombre} para enviar parte a cada destino
          </DialogDescription>
        </DialogHeader>

        {loadingInfo ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Info del lote */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Peso total del lote: <strong>{formatNumber(pesoTotalKg, 1)} kg</strong>
              </AlertDescription>
            </Alert>

            {/* Barra de distribución visual */}
            <div className="space-y-2">
              <Label>Distribución del peso</Label>
              <Progress value={porcentajePrincipal} className="h-3" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span className="text-green-600">{formatNumber(porcentajePrincipal, 0)}% a {bifurcacionInfo?.etapa_destino_principal_nombre || 'Secado'}</span>
                <span className="text-orange-600">{formatNumber(100 - porcentajePrincipal, 0)}% a {bifurcacionInfo?.etapa_destino_alternativa_nombre || 'Lavado'}</span>
              </div>
            </div>

            {/* Cards de destino */}
            <div className="grid grid-cols-2 gap-4">
              {/* Destino Principal */}
              <Card className="border-green-200 bg-green-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-green-600" />
                    <Badge variant="outline" className="bg-green-100 text-green-700">
                      {bifurcacionInfo?.etapa_destino_principal_nombre || 'Secado'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Peso (kg)</Label>
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-green-600" />
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max={pesoTotalKg}
                        value={pesoPrincipal}
                        onChange={(e) => handlePesoPrincipalChange(e.target.value)}
                        className="text-lg font-semibold"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Observaciones</Label>
                    <Textarea
                      value={observacionesPrincipal}
                      onChange={(e) => setObservacionesPrincipal(e.target.value)}
                      placeholder="Opcional..."
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Destino Alternativo */}
              <Card className={`border-orange-200 ${pesoAlternativo > 0 ? 'bg-orange-50' : 'bg-gray-50 opacity-60'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-orange-600" />
                    <Badge variant="outline" className="bg-orange-100 text-orange-700">
                      {bifurcacionInfo?.etapa_destino_alternativa_nombre || 'Lavado'}
                    </Badge>
                    {pesoAlternativo > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Sub-lote
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Peso (kg)</Label>
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-orange-600" />
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max={pesoTotalKg}
                        value={pesoAlternativo}
                        onChange={(e) => handlePesoAlternativoChange(e.target.value)}
                        className="text-lg font-semibold"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Observaciones</Label>
                    <Textarea
                      value={observacionesAlternativo}
                      onChange={(e) => setObservacionesAlternativo(e.target.value)}
                      placeholder="Opcional..."
                      rows={2}
                      className="text-xs"
                      disabled={pesoAlternativo === 0}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Resumen */}
            {pesoAlternativo > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Se creará un <strong>sub-lote ({loteNumero}-B)</strong> con {formatNumber(pesoAlternativo, 1)} kg
                  que volverá a <strong>{bifurcacionInfo?.etapa_destino_alternativa_nombre || 'Lavado'}</strong>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={dividirMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={dividirMutation.isPending || pesoPrincipal <= 0 || loadingInfo}
          >
            {dividirMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Dividiendo...
              </>
            ) : (
              <>
                <Split className="h-4 w-4 mr-2" />
                Dividir Lote
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
