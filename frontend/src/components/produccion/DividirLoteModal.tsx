/**
 * Modal de División de lote (etapa División/Estirado).
 * Tres opciones:
 *  1. Todo al destino principal (ej: Secado)
 *  2. Todo al destino alternativo (ej: Planchado)
 *  3. Dividir: una parte a cada destino, con kg y canastos por branch
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Split,
  ArrowRight,
  Loader2,
  AlertTriangle,
  GitBranch,
  Check,
  Box,
} from 'lucide-react';

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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

import { produccionService } from '@/services/produccionService';
import { canastoService } from '@/services/canastoService';

interface EtapaBifurcacionInfo {
  permite_bifurcacion: boolean;
  etapa_destino_principal_id: string | null;
  etapa_destino_principal_nombre: string | null;
  etapa_destino_alternativa_id: string | null;
  etapa_destino_alternativa_nombre: string | null;
}

interface Canasto {
  id: string;
  numero: number;
  codigo: string;
  estado: string;
}

interface CanastoAsignado {
  id: string;
  canasto_id: string;
  canasto_numero: number;
  canasto_codigo: string;
}

type Modo = 'principal' | 'alternativo' | 'dividir' | null;

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

  const [modo, setModo] = useState<Modo>(null);
  const [canastosPrincipal, setCanastosPrincipal] = useState<string[]>([]);
  const [canastosAlternativo, setCanastosAlternativo] = useState<string[]>([]);
  const [pesoPrincipal, setPesoPrincipal] = useState('');
  const [pesoAlternativo, setPesoAlternativo] = useState('');

  const { data: bifurcacionInfo, isLoading: loadingBifurcacion } = useQuery<EtapaBifurcacionInfo>({
    queryKey: ['bifurcacion-info', etapaId],
    queryFn: () => produccionService.getBifurcacionInfo(etapaId),
    enabled: open && !!etapaId,
  });

  const { data: canastosDelLote = [] } = useQuery<CanastoAsignado[]>({
    queryKey: ['canastos-lote', loteId],
    queryFn: () => canastoService.getCanastosLote(loteId),
    enabled: open && !!loteId,
  });

  const { data: canastosDisponibles = [] } = useQuery<Canasto[]>({
    queryKey: ['canastos-disponibles'],
    queryFn: () => canastoService.getDisponibles(),
    enabled: open,
  });

  // Reset when modal opens/closes
  useEffect(() => {
    if (open) {
      setModo(null);
      setCanastosPrincipal([]);
      setCanastosAlternativo([]);
      setPesoPrincipal('');
      setPesoAlternativo('');
    }
  }, [open]);

  // When modo changes, pre-select all current canastos for the chosen branch
  useEffect(() => {
    const ids = canastosDelLote.map(c => c.canasto_id);
    if (modo === 'principal') {
      setCanastosPrincipal(ids);
      setCanastosAlternativo([]);
    } else if (modo === 'alternativo') {
      setCanastosAlternativo(ids);
      setCanastosPrincipal([]);
    } else if (modo === 'dividir') {
      setCanastosPrincipal(ids); // default: all go to principal
      setCanastosAlternativo([]);
      const peso = pesoTotalKg > 0 ? pesoTotalKg : 0;
      const mitad = Math.round(peso / 2 * 100) / 100;
      const resto = Math.round((peso - mitad) * 100) / 100;
      setPesoPrincipal(String(mitad));
      setPesoAlternativo(String(resto));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  const moverMutation = useMutation({
    mutationFn: ({ etapaDestinoId, canastosIds }: { etapaDestinoId: string; canastosIds: string[] }) =>
      produccionService.moverLote(loteId, etapaDestinoId, undefined, undefined, canastosIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['canastos-disponibles'] });
      queryClient.invalidateQueries({ queryKey: ['canastos-lote', loteId] });
      toast({ title: 'Lote enviado al destino elegido' });
      onClose();
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      toast({ title: 'Error', description: error.response?.data?.detail || 'No se pudo mover el lote', variant: 'destructive' });
    },
  });

  const dividirMutation = useMutation({
    mutationFn: () => {
      const ppkg = parseFloat(pesoPrincipal);
      const pakg = parseFloat(pesoAlternativo);
      if (!ppkg || ppkg <= 0) throw new Error('Peso principal inválido');
      return produccionService.dividirLote(loteId, etapaId, {
        peso_destino_principal_kg: ppkg,
        peso_destino_alternativo_kg: pakg > 0 ? pakg : 0,
        canastos_ids_principal: canastosPrincipal.length > 0 ? canastosPrincipal : undefined,
        canastos_ids_alternativo: canastosAlternativo.length > 0 ? canastosAlternativo : undefined,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['canastos-disponibles'] });
      queryClient.invalidateQueries({ queryKey: ['canastos-lote', loteId] });
      toast({ title: 'Lote dividido', description: data.mensaje || 'Dos branches creados.' });
      onClose();
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      toast({ title: 'Error', description: error.response?.data?.detail || 'No se pudo dividir el lote', variant: 'destructive' });
    },
  });

  const pending = moverMutation.isPending || dividirMutation.isPending;

  // Canastos para mostrar en la selección: del lote + disponibles
  const idsDelLote = new Set(canastosDelLote.map(c => c.canasto_id));
  const todosCanastos = [
    ...canastosDelLote.map(c => ({ id: c.canasto_id, numero: c.canasto_numero, codigo: c.canasto_codigo, esDelLote: true })),
    ...canastosDisponibles.filter(c => !idsDelLote.has(c.id)).map(c => ({ ...c, esDelLote: false })),
  ];

  const togglePrincipal = (id: string) =>
    setCanastosPrincipal(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAlternativo = (id: string) =>
    setCanastosAlternativo(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  if (loadingBifurcacion) {
    return (
      <Dialog open={open} onOpenChange={o => !o && onClose()}>
        <DialogContent className="sm:max-w-[520px] w-[95vw]">
          <DialogHeader><DialogTitle>División</DialogTitle></DialogHeader>
          <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!bifurcacionInfo?.permite_bifurcacion) {
    return (
      <Dialog open={open} onOpenChange={o => !o && onClose()}>
        <DialogContent className="sm:max-w-[480px] w-[95vw]">
          <DialogHeader><DialogTitle>Sin bifurcación</DialogTitle></DialogHeader>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>La etapa "{etapaNombre}" no permite dividir el lote.</AlertDescription>
          </Alert>
          <DialogFooter><Button onClick={onClose}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const destPrinId = bifurcacionInfo.etapa_destino_principal_id;
  const destPrinNombre = bifurcacionInfo.etapa_destino_principal_nombre || 'Destino A';
  const destAltId = bifurcacionInfo.etapa_destino_alternativa_id;
  const destAltNombre = bifurcacionInfo.etapa_destino_alternativa_nombre || 'Destino B';

  const handleConfirm = () => {
    if (modo === 'principal' && destPrinId) {
      moverMutation.mutate({ etapaDestinoId: destPrinId, canastosIds: canastosPrincipal });
    } else if (modo === 'alternativo' && destAltId) {
      moverMutation.mutate({ etapaDestinoId: destAltId, canastosIds: canastosAlternativo });
    } else if (modo === 'dividir') {
      dividirMutation.mutate();
    }
  };

  const canConfirm = (() => {
    if (!modo || pending) return false;
    if (modo === 'principal') return !!destPrinId;
    if (modo === 'alternativo') return !!destAltId;
    if (modo === 'dividir') {
      const p = parseFloat(pesoPrincipal);
      return p > 0;
    }
    return false;
  })();

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[540px] w-[95vw] max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5 text-primary" />
            División — Lote {loteNumero}
          </DialogTitle>
          <DialogDescription>
            ¿A dónde va este lote desde <strong>{etapaNombre}</strong>?
            {pesoTotalKg > 0 && <span className="block text-sm font-medium mt-1">Peso total: {pesoTotalKg} kg</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-3 py-2">

          {/* Opciones de routing */}
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              disabled={pending || !destPrinId}
              onClick={() => setModo(modo === 'principal' ? null : 'principal')}
              className={`w-full py-4 rounded-2xl border-2 flex items-center justify-between px-5 transition-all active:scale-[0.98]
                ${modo === 'principal' ? 'border-green-600 bg-green-600 text-white' : 'border-green-500 bg-green-50 text-green-800 hover:bg-green-100'}
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="text-base font-bold">Todo a {destPrinNombre}</span>
              {modo === 'principal' ? <Check className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
            </button>

            <button
              type="button"
              disabled={pending || !destAltId}
              onClick={() => setModo(modo === 'alternativo' ? null : 'alternativo')}
              className={`w-full py-4 rounded-2xl border-2 flex items-center justify-between px-5 transition-all active:scale-[0.98]
                ${modo === 'alternativo' ? 'border-orange-600 bg-orange-600 text-white' : 'border-orange-500 bg-orange-50 text-orange-800 hover:bg-orange-100'}
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="text-base font-bold">Todo a {destAltNombre}</span>
              {modo === 'alternativo' ? <Check className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
            </button>

            <button
              type="button"
              disabled={pending || !destPrinId || !destAltId}
              onClick={() => setModo(modo === 'dividir' ? null : 'dividir')}
              className={`w-full py-4 rounded-2xl border-2 flex items-center justify-between px-5 transition-all active:scale-[0.98]
                ${modo === 'dividir' ? 'border-purple-600 bg-purple-600 text-white' : 'border-purple-500 bg-purple-50 text-purple-800 hover:bg-purple-100'}
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex flex-col items-start text-left">
                <span className="text-base font-bold flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Dividir entre los dos
                </span>
                <span className="text-xs opacity-80 mt-0.5">Dos branches con kg y canastos propios</span>
              </div>
              {modo === 'dividir' ? <Check className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
            </button>
          </div>

          {/* Sección de canastos y kg según modo */}
          {modo && (
            <div className="border rounded-xl p-3 space-y-3 bg-muted/30">

              {/* Modo: Solo A o Solo B */}
              {(modo === 'principal' || modo === 'alternativo') && todosCanastos.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Box className="h-4 w-4" />
                    Canastos que van a {modo === 'principal' ? destPrinNombre : destAltNombre}
                    <span className="text-xs text-muted-foreground">(los no seleccionados quedan libres)</span>
                  </Label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {todosCanastos.map(c => {
                      const sel = modo === 'principal'
                        ? canastosPrincipal.includes(c.id)
                        : canastosAlternativo.includes(c.id);
                      const toggle = modo === 'principal' ? togglePrincipal : toggleAlternativo;
                      return (
                        <div
                          key={c.id}
                          onClick={() => toggle(c.id)}
                          className={`flex items-center justify-center p-2 rounded-md cursor-pointer border-2 text-sm font-medium transition-all
                            ${sel ? 'bg-primary text-primary-foreground border-primary' : 'bg-white border-gray-300 hover:border-primary/60'}
                            ${c.esDelLote ? 'border-blue-300' : ''}`}
                          title={c.esDelLote ? 'Ya asignado' : 'Disponible'}
                        >
                          {sel && <Check className="h-3 w-3 mr-0.5" />}
                          #{c.numero}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modo: Dividir */}
              {modo === 'dividir' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Branch Principal */}
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-green-700">→ {destPrinNombre}</div>
                      <div>
                        <Label className="text-xs">Kg</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max={pesoTotalKg || undefined}
                          value={pesoPrincipal}
                          onChange={e => setPesoPrincipal(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      {todosCanastos.length > 0 && (
                        <div>
                          <Label className="text-xs flex items-center gap-1">
                            <Box className="h-3 w-3" /> Canastos
                          </Label>
                          <div className="grid grid-cols-3 gap-1 mt-1">
                            {todosCanastos.map(c => {
                              const sel = canastosPrincipal.includes(c.id);
                              const inAlt = canastosAlternativo.includes(c.id);
                              return (
                                <div
                                  key={c.id}
                                  onClick={() => {
                                    if (inAlt) return; // can't be in both
                                    togglePrincipal(c.id);
                                  }}
                                  className={`flex items-center justify-center p-1.5 rounded cursor-pointer border text-xs font-medium transition-all
                                    ${sel ? 'bg-green-500 text-white border-green-600' : inAlt ? 'bg-gray-100 border-gray-200 opacity-40 cursor-not-allowed' : 'bg-white border-gray-300 hover:border-green-400'}
                                  `}
                                  title={inAlt ? 'Ya asignado al otro branch' : `#${c.numero}`}
                                >
                                  {sel && <Check className="h-2.5 w-2.5 mr-0.5" />}
                                  #{c.numero}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Branch Alternativo */}
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-orange-700">→ {destAltNombre}</div>
                      <div>
                        <Label className="text-xs">Kg</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          value={pesoAlternativo}
                          onChange={e => setPesoAlternativo(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      {todosCanastos.length > 0 && (
                        <div>
                          <Label className="text-xs flex items-center gap-1">
                            <Box className="h-3 w-3" /> Canastos
                          </Label>
                          <div className="grid grid-cols-3 gap-1 mt-1">
                            {todosCanastos.map(c => {
                              const sel = canastosAlternativo.includes(c.id);
                              const inPrinc = canastosPrincipal.includes(c.id);
                              return (
                                <div
                                  key={c.id}
                                  onClick={() => {
                                    if (inPrinc) return;
                                    toggleAlternativo(c.id);
                                  }}
                                  className={`flex items-center justify-center p-1.5 rounded cursor-pointer border text-xs font-medium transition-all
                                    ${sel ? 'bg-orange-500 text-white border-orange-600' : inPrinc ? 'bg-gray-100 border-gray-200 opacity-40 cursor-not-allowed' : 'bg-white border-gray-300 hover:border-orange-400'}
                                  `}
                                  title={inPrinc ? 'Ya asignado al otro branch' : `#${c.numero}`}
                                >
                                  {sel && <Check className="h-2.5 w-2.5 mr-0.5" />}
                                  #{c.numero}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Validación de pesos */}
                  {pesoPrincipal && pesoAlternativo && pesoTotalKg > 0 && (
                    (() => {
                      const suma = (parseFloat(pesoPrincipal) || 0) + (parseFloat(pesoAlternativo) || 0);
                      const diff = Math.abs(suma - pesoTotalKg);
                      if (diff > 0.1) {
                        return (
                          <p className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            La suma ({suma.toFixed(1)} kg) no coincide con el peso total ({pesoTotalKg} kg)
                          </p>
                        );
                      }
                      return null;
                    })()
                  )}

                  {/* Canastos sin asignar */}
                  {todosCanastos.filter(c => !canastosPrincipal.includes(c.id) && !canastosAlternativo.includes(c.id)).length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Canastos sin asignar ({todosCanastos.filter(c => !canastosPrincipal.includes(c.id) && !canastosAlternativo.includes(c.id)).length}):
                      {' '}quedarán libres
                      {todosCanastos.filter(c => !canastosPrincipal.includes(c.id) && !canastosAlternativo.includes(c.id)).map(c => (
                        <Badge key={c.id} variant="outline" className="ml-1 text-xs">#{c.numero}</Badge>
                      ))}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-3 gap-2 flex-col-reverse sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={pending} className="w-full sm:w-auto">
            Cancelar
          </Button>
          {pending && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Procesando...
            </div>
          )}
          {modo && (
            <Button onClick={handleConfirm} disabled={!canConfirm} className="w-full sm:w-auto">
              Confirmar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
