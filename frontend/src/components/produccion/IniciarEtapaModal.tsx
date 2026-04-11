/**
 * Modal para iniciar una etapa con validación de PIN, selección de máquina y canastos
 * V2: Soporte para múltiples canastos en etapas de lavado/secado
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

interface IniciarEtapaModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (operarioId: string, operarioNombre: string, maquinaId?: string, canastosIds?: string[], pesoKg?: number) => void;
  title?: string;
  description?: string;
  showMachineSelection?: boolean;
  requiereMaquina?: boolean;  // Si es true, es obligatorio seleccionar máquina
  tipoMaquina?: string | null;  // Filtrar por tipo: lavadora, secadora, planchadora
  etapaNombre?: string;
  loteNumero?: string;
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
  showCanastosSelection = false,
  etapaCodigo,
  showPesoInput = false,
}: IniciarEtapaModalProps) {
  const [operarioId, setOperarioId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [maquinaId, setMaquinaId] = useState<string>('');
  const [selectedCanastos, setSelectedCanastos] = useState<string[]>([]);
  const [pesoKg, setPesoKg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Determinar si esta etapa requiere canastos (LAV o SEC)
  const requiereCanastos = showCanastosSelection || ['LAV', 'SEC'].includes(etapaCodigo || '');

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
  const { data: canastos = [], isLoading: loadingCanastos, refetch: refetchCanastos } = useQuery<Canasto[]>({
    queryKey: ['canastos-disponibles'],
    queryFn: () => canastoService.getDisponibles(),
    enabled: open && requiereCanastos,
  });

  // Reset estado cuando se abre/cierra
  useEffect(() => {
    if (open) {
      setOperarioId('');
      setPin('');
      setMaquinaId('');
      setSelectedCanastos([]);
      setPesoKg('');
      setError(null);
      refetchMaquinas();
      if (requiereCanastos) {
        refetchCanastos();
      }
    }
  }, [open, refetchMaquinas, refetchCanastos, requiereCanastos]);

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

    // Validar que se seleccione máquina si es obligatorio
    if (requiereMaquina && !maquinaId) {
      setError('Debes seleccionar una máquina para esta etapa');
      return;
    }

    // Validar que se seleccionen canastos si es requerido
    if (requiereCanastos && selectedCanastos.length === 0) {
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
          maquinaId || undefined,
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

  const isLoading = loadingOperarios || loadingMaquinas || loadingCanastos;

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
              <Select value={operarioId} onValueChange={setOperarioId}>
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

          {/* Selector de máquina */}
          {(showMachineSelection || requiereMaquina) && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Máquina {requiereMaquina ? <span className="text-red-500">*</span> : '(opcional)'}
                {tipoMaquina && (
                  <Badge variant="outline" className="ml-2 capitalize">
                    {tipoMaquina}
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
                <Select value={maquinaId || 'none'} onValueChange={(v) => setMaquinaId(v === 'none' ? '' : v)}>
                  <SelectTrigger className={requiereMaquina && !maquinaId ? 'border-orange-400' : ''}>
                    <SelectValue placeholder={requiereMaquina ? 'Seleccionar máquina...' : 'Sin máquina asignada'} />
                  </SelectTrigger>
                  <SelectContent>
                    {!requiereMaquina && <SelectItem value="none">Sin máquina</SelectItem>}
                    {maquinas.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="font-mono">{m.codigo}</span>
                          <span className="text-muted-foreground">{m.nombre}</span>
                          {m.capacidad_kg && (
                            <Badge variant="outline" className="ml-2">
                              {formatNumber(m.capacidad_kg, 0)} kg
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {requiereMaquina && maquinas.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Hay {maquinas.length} {tipoMaquina || 'máquina'}(s) disponible(s)
                </p>
              )}
            </div>
          )}

          {/* Selector de canastos */}
          {requiereCanastos && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Box className="h-4 w-4" />
                Canastos <span className="text-red-500">*</span>
                {selectedCanastos.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedCanastos.length} seleccionados
                  </Badge>
                )}
              </Label>
              {loadingCanastos ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando canastos...
                </div>
              ) : canastos.length === 0 ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    No hay canastos disponibles. Todos están en uso.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="max-h-32 overflow-y-auto border rounded-md p-2">
                  <div className="grid grid-cols-5 gap-2">
                    {canastos.map((canasto) => (
                      <div
                        key={canasto.id}
                        onClick={() => toggleCanasto(canasto.id)}
                        className={`
                          flex items-center justify-center p-2 rounded-md cursor-pointer
                          border-2 transition-all text-sm font-medium
                          ${selectedCanastos.includes(canasto.id)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-green-50 border-green-300 hover:border-green-500'
                          }
                        `}
                      >
                        {selectedCanastos.includes(canasto.id) && (
                          <Check className="h-3 w-3 mr-1" />
                        )}
                        #{canasto.numero}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Selecciona los canastos donde se colocará el lote
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
              (requiereMaquina && (!maquinaId || maquinas.length === 0)) ||
              (requiereCanastos && (selectedCanastos.length === 0 || canastos.length === 0)) ||
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
