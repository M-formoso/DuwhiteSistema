/**
 * Modal de validación de PIN para operarios
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, User, Loader2 } from 'lucide-react';

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

import { produccionService } from '@/services/produccionService';

interface Operario {
  id: string;
  nombre: string;
  rol: string;
}

interface PinValidationModalProps {
  open: boolean;
  onClose: () => void;
  onValidated: (operarioId: string, operarioNombre: string) => void;
  title?: string;
  description?: string;
}

export function PinValidationModal({
  open,
  onClose,
  onValidated,
  title = 'Validar Operario',
  description = 'Selecciona el operario e ingresa su PIN para continuar',
}: PinValidationModalProps) {
  const [operarioId, setOperarioId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Cargar operarios con PIN
  const { data: operarios = [], isLoading } = useQuery<Operario[]>({
    queryKey: ['operarios-con-pin'],
    queryFn: () => produccionService.getOperariosConPin(),
    enabled: open,
  });

  // Reset estado cuando se abre/cierra
  useEffect(() => {
    if (open) {
      setOperarioId('');
      setPin('');
      setError(null);
    }
  }, [open]);

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

    setValidating(true);
    setError(null);

    try {
      const result = await produccionService.validarPin(operarioId, pin);

      if (result.valido) {
        onValidated(operarioId, result.operario_nombre);
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

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px] w-[95vw] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selector de operario */}
          <div className="space-y-2">
            <Label>Operario</Label>
            {isLoading ? (
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

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={validating} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={handleValidate}
            className="w-full sm:w-auto"
            disabled={!operarioId || pin.length < 4 || validating}
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validando...
              </>
            ) : (
              'Validar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
