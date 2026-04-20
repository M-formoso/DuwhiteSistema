/**
 * Modal para iniciar una etapa con validación de PIN, selección de máquinas y canastos
 * V2: Soporte para múltiples canastos en etapas de lavado/secado
 * V3: Soporte para múltiples máquinas por etapa
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, User, Loader2, Settings2, Box, Check, Scale } from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

import { produccionService } from '@/services/produccionService';
import { canastoService } from '@/services/canastoService';
import { formatNumber } from '@/utils/formatters';

interface Operario {
  id: string;
  nombre: string;
  rol: string;
}

interface Maquina {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  estado: string;
  capacidad_kg: number | null;
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

interface IniciarEtapaModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (operarioId: string, operarioNombre: string, maquinasIds?: string[], canastosIds?: string[], pesoKg?: number) => void;
  title?: string;
  description?: string;
  showMachineSelection?: boolean;
  requiereMaquina?: boolean;  // Si es true, es obligatorio seleccionar al menos una máquina
  tipoMaquina?: string | null;  // Filtrar por tipo: lavadora, secadora, planchadora
  etapaNombre?: string;
  loteNumero?: string;
  loteId?: string;  // ID del lote para cargar canastos asignados
  showCanastosSelection?: boolean;  // Mostrar selección de canastos
  etapaCodigo?: string;  // Código de la etapa (LAV, SEC, etc.)
  showPesoInput?: boolean;  // Mostrar input de peso (para Recepción)
}

export function IniciarEtapaModal({
  open,
  onClose,
  onConfirm,
  title = 'Iniciar Etapa',
  description = 'Valida tu PIN para iniciar esta etapa',
  showMachineSelection = true,
  requiereMaquina = false,
  tipoMaquina = null,
  etapaNombre,
  loteNumero,
  loteId,
  showCanastosSelection = false,
  etapaCodigo,
  showPesoInput = false,
}: IniciarEtapaModalProps) {
  const [operarioId, setOperarioId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [selectedMaquinas, setSelectedMaquinas] = useState<string[]>([]);
  const [selectedCanastos, setSelectedCanastos] = useState<string[]>([]);
  const [pesoKg, setPesoKg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Determinar si esta etapa muestra canastos (REC, LAV o SEC)
  const muestraCanastos = showCanastosSelection || ['REC', 'LAV', 'SEC'].includes(etapaCodigo || '');

  // Solo es obligatorio seleccionar canastos en Recepción (REC) - primera etapa
  // En LAV y SEC, si ya tiene canastos asignados, no es obligatorio cambiarlos
  const esEtapaRecepcion = etapaCodigo === 'REC';

  // Determinar si esta etapa requiere peso (REC - Recepción y Pesaje)
  const requierePeso = showPesoInput || etapaCodigo === 'REC';

  // Cargar operarios con PIN
  const { data: operarios = [], isLoading: loadingOperarios } = useQuery<Operario[]>({
    queryKey: ['operarios-con-pin'],
    queryFn: () => produccionService.getOperariosConPin(),
    enabled: open,
  });

  // Cargar máquinas disponibles (filtradas por tipo si se especifica)
  const { data: maquinas = [], isLoading: loadingMaquinas, refetch: refetchMaquinas } = useQuery<Maquina[]>({
    queryKey: ['maquinas-disponibles', tipoMaquina],
    queryFn: () => produccionService.getMaquinasDisponibles(tipoMaquina || undefined),
    enabled: open && (showMachineSelection || requiereMaquina),
  });

  // Cargar canastos disponibles
  const { data: canastosDisponibles = [], isLoading: loadingCanastos, refetch: refetchCanastos } = useQuery<Canasto[]>({
    queryKey: ['canastos-disponibles'],
    queryFn: () => canastoService.getDisponibles(),
    enabled: open && muestraCanastos,
  });

  // Cargar canastos ya asignados al lote
  const { data: canastosDelLote = [], isLoading: loadingCanastosLote } = useQuery<CanastoAsignado[]>({
    queryKey: ['canastos-lote', loteId],
    queryFn: () => canastoService.getCanastosLote(loteId!),
    enabled: open && muestraCanastos && !!loteId && !esEtapaRecepcion,
  });

  // Reset estado cuando se abre/cierra
  useEffect(() => {
    if (open) {
      setOperarioId('');
      setPin('');
      setSelectedMaquinas([]);
      setSelectedCanastos([]);
      setPesoKg('');
      setError(null);
      refetchMaquinas();
      if (muestraCanastos) {
        refetchCanastos();
      }
    }
  }, [open, refetchMaquinas, refetchCanastos, muestraCanastos]);

  // Preseleccionar canastos ya asignados al lote (para LAV y SEC)
  useEffect(() => {
    if (canastosDelLote.length > 0 && !esEtapaRecepcion) {
      setSelectedCanastos(canastosDelLote.map(c => c.canasto_id));
    }
  }, [canastosDelLote, esEtapaRecepcion]);

  // Focus en PIN cuando se selecciona operario
  useEffect(() => {
    if (operarioId && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [operarioId]);

  const handleValidate = async () => {
    if (!operarioId || !pin) {
      setError('Selecciona un operario e ingresa el PIN');
      return;
    }

    // Validar que se seleccione al menos una máquina si es obligatorio
    if (requiereMaquina && selectedMaquinas.length === 0) {
      setError('Debes seleccionar al menos una máquina para esta etapa');
      return;
    }

    // Validar que se seleccionen canastos si es requerido
    // Solo obligatorio en Recepción (REC) - en otras etapas ya vienen con canastos
    if (esEtapaRecepcion && selectedCanastos.length === 0) {
      setError('Debes seleccionar al menos un canasto');
      return;
    }

    // Validar peso si es requerido
    if (requierePeso && (!pesoKg || parseFloat(pesoKg) <= 0)) {
      setError('Debes ingresar el peso del lote');
      return;
    }

    setValidating(true);
    setError(null);

    try {
      const result = await produccionService.validarPin(operarioId, pin);

      if (result.valido) {
        onConfirm(
          operarioId,
          result.operario_nombre,
          selectedMaquinas.length > 0 ? selectedMaquinas : undefined,
          selectedCanastos.length > 0 ? selectedCanastos : undefined,
          pesoKg ? parseFloat(pesoKg) : undefined
        );
        onClose();
      } else {
        setError(result.mensaje || 'PIN incorrecto');
        setPin('');
        pinInputRef.current?.focus();
      }
    } catch {
      setError('Error al validar el PIN');
    } finally {
      setValidating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && operarioId && pin.length >= 4) {
      handleValidate();
    }
  };

  const isLoading = loadingOperarios || loadingMaquinas || loadingCanastos || loadingCanastosLote;

  // Combinar canastos disponibles con los del lote (para mostrar todos)
  const canastosParaMostrar = esEtapaRecepcion
    ? canastosDisponibles
    : [
        // Primero los canastos ya asignados al lote
        ...canastosDelLote.map(c => ({
          id: c.canasto_id,
          numero: c.canasto_numero,
          codigo: c.canasto_codigo,
          estado: 'en_uso' as const,
          esDelLote: true,
        })),
        // Luego los disponibles
        ...canastosDisponibles.map(c => ({
          ...c,
          esDelLote: false,
        })),
      ];

  // Manejar selección de máquina (múltiple)
  const toggleMaquina = (maquinaId: string) => {
    setSelectedMaquinas((prev) =>
      prev.includes(maquinaId)
        ? prev.filter((id) => id !== maquinaId)
        : [...prev, maquinaId]
    );
  };

  // Manejar selección de canasto
  const toggleCanasto = (canastoId: string) => {
    setSelectedCanastos((prev) =>
      prev.includes(canastoId)
        ? prev.filter((id) => id !== canastoId)
        : [...prev, canastoId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
            {loteNumero && etapaNombre && (
              <span className="block mt-1 font-medium text-foreground">
                Lote {loteNumero} - {etapaNombre}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selector de operario */}
          <div className="space-y-2">
            <Label>Operario</Label>
            {loadingOperarios ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando operarios...
              </div>
            ) : operarios.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No hay operarios con PIN configurado. Configura el PIN en la sección de Usuarios.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={operarioId || undefined} onValueChange={setOperarioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar operario..." />
                </SelectTrigger>
                <SelectContent>
                  {operarios.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {op.nombre}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Input de PIN */}
          <div className="space-y-2">
            <Label>PIN</Label>
            <Input
              ref={pinInputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setPin(value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ingrese PIN de 4-6 dígitos"
              disabled={!operarioId}
              className="text-center text-2xl tracking-widest font-mono"
            />
          </div>

          {/* Input de peso (para Recepción y Pesaje) */}
          {requierePeso && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Peso de Entrada (kg) <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={pesoKg}
                onChange={(e) => setPesoKg(e.target.value)}
                placeholder="Ej: 45.5"
                className="text-lg"
              />
              <p className="text-xs text-muted-foreground">
                Ingresa el peso que marca la balanza
              </p>
            </div>
          )}

          {/* Selector de máquinas (múltiple) */}
          {(showMachineSelection || requiereMaquina) && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Máquinas {requiereMaquina ? <span className="text-red-500">*</span> : '(opcional)'}
                {tipoMaquina && (
                  <Badge variant="outline" className="ml-2 capitalize">
                    {tipoMaquina}
                  </Badge>
                )}
                {selectedMaquinas.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedMaquinas.length} seleccionada(s)
                  </Badge>
                )}
              </Label>
              {loadingMaquinas ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando máquinas...
                </div>
              ) : maquinas.length === 0 ? (
                <Alert variant={requiereMaquina ? 'destructive' : 'default'}>
                  <AlertDescription>
                    {requiereMaquina
                      ? `No hay ${tipoMaquina || 'máquinas'}s disponibles. Todas están en uso.`
                      : 'No hay máquinas disponibles en este momento'}
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                  <div className="grid grid-cols-2 gap-2">
                    {maquinas.map((m) => {
                      const isSelected = selectedMaquinas.includes(m.id);

                      return (
                        <div
                          key={m.id}
                          onClick={() => toggleMaquina(m.id)}
                          className={`
                            flex items-center gap-2 p-2 rounded-md cursor-pointer
                            border-2 transition-all text-sm
                            ${isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-gray-50 border-gray-200 hover:border-primary/50'
                            }
                          `}
                        >
                          {isSelected && (
                            <Check className="h-4 w-4 flex-shrink-0" />
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="font-mono font-medium truncate">{m.codigo}</span>
                            <span className={`text-xs truncate ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                              {m.nombre}
                              {m.capacidad_kg && ` - ${formatNumber(m.capacidad_kg, 0)} kg`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {maquinas.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {requiereMaquina
                    ? `Selecciona al menos una máquina. Hay ${maquinas.length} disponible(s).`
                    : `Puedes seleccionar múltiples máquinas. Hay ${maquinas.length} disponible(s).`
                  }
                </p>
              )}
            </div>
          )}

          {/* Selector de canastos */}
          {muestraCanastos && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Box className="h-4 w-4" />
                Canastos {esEtapaRecepcion && <span className="text-red-500">*</span>}
                {!esEtapaRecepcion && canastosDelLote.length > 0 && (
                  <Badge variant="outline" className="ml-2 text-blue-600 border-blue-300">
                    {canastosDelLote.length} asignados
                  </Badge>
                )}
                {selectedCanastos.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedCanastos.length} seleccionados
                  </Badge>
                )}
              </Label>
              {(loadingCanastos || loadingCanastosLote) ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando canastos...
                </div>
              ) : canastosParaMostrar.length === 0 ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    No hay canastos disponibles. Todos están en uso.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="max-h-32 overflow-y-auto border rounded-md p-2">
                  <div className="grid grid-cols-5 gap-2">
                    {canastosParaMostrar.map((canasto) => {
                      const isSelected = selectedCanastos.includes(canasto.id);
                      const isFromLote = 'esDelLote' in canasto && canasto.esDelLote;

                      return (
                        <div
                          key={canasto.id}
                          onClick={() => toggleCanasto(canasto.id)}
                          className={`
                            flex items-center justify-center p-2 rounded-md cursor-pointer
                            border-2 transition-all text-sm font-medium
                            ${isSelected
                              ? isFromLote
                                ? 'bg-blue-500 text-white border-blue-600'  // Azul para los del lote
                                : 'bg-primary text-primary-foreground border-primary'
                              : isFromLote
                                ? 'bg-blue-50 border-blue-300 hover:border-blue-500'  // Los del lote en azul claro
                                : 'bg-green-50 border-green-300 hover:border-green-500'
                            }
                          `}
                          title={isFromLote ? 'Ya asignado a este lote' : 'Disponible'}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3 mr-1" />
                          )}
                          #{canasto.numero}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {esEtapaRecepcion
                  ? 'Selecciona los canastos donde se colocará el lote'
                  : canastosDelLote.length > 0
                    ? 'Los canastos en azul ya están asignados al lote. Puedes cambiarlos si es necesario.'
                    : 'Selecciona los canastos para este lote'
                }
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={validating}>
            Cancelar
          </Button>
          <Button
            onClick={handleValidate}
            disabled={
              !operarioId ||
              pin.length < 4 ||
              validating ||
              isLoading ||
              (requiereMaquina && (selectedMaquinas.length === 0 || maquinas.length === 0)) ||
              (esEtapaRecepcion && selectedCanastos.length === 0) ||
              (requierePeso && (!pesoKg || parseFloat(pesoKg) <= 0))
            }
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validando...
              </>
            ) : (
              'Iniciar Etapa'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
