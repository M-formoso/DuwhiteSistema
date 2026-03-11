/**
 * Modal para iniciar una etapa con validación de PIN y selección de máquina
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, User, Loader2, Settings2 } from 'lucide-react';

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

interface IniciarEtapaModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (operarioId: string, operarioNombre: string, maquinaId?: string) => void;
  title?: string;
  description?: string;
  showMachineSelection?: boolean;
  requiereMaquina?: boolean;  // Si es true, es obligatorio seleccionar máquina
  tipoMaquina?: string | null;  // Filtrar por tipo: lavadora, secadora, planchadora
  etapaNombre?: string;
  loteNumero?: string;
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
}: IniciarEtapaModalProps) {
  const [operarioId, setOperarioId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [maquinaId, setMaquinaId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

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

  // Reset estado cuando se abre/cierra
  useEffect(() => {
    if (open) {
      setOperarioId('');
      setPin('');
      setMaquinaId('');
      setError(null);
      refetchMaquinas();
    }
  }, [open, refetchMaquinas]);

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

    setValidating(true);
    setError(null);

    try {
      const result = await produccionService.validarPin(operarioId, pin);

      if (result.valido) {
        onConfirm(operarioId, result.operario_nombre, maquinaId || undefined);
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

  const isLoading = loadingOperarios || loadingMaquinas;

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
                <Select value={maquinaId} onValueChange={setMaquinaId}>
                  <SelectTrigger className={requiereMaquina && !maquinaId ? 'border-orange-400' : ''}>
                    <SelectValue placeholder={requiereMaquina ? 'Seleccionar máquina...' : 'Sin máquina asignada'} />
                  </SelectTrigger>
                  <SelectContent>
                    {!requiereMaquina && <SelectItem value="">Sin máquina</SelectItem>}
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
              (requiereMaquina && (!maquinaId || maquinas.length === 0))
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
