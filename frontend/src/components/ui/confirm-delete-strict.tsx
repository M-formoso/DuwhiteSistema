/**
 * Modal de doble confirmación para acciones destructivas.
 * Requiere que el usuario tipee un texto exacto (ej. el número del recurso)
 * y luego reconfirme antes de disparar `onConfirm`.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (motivo?: string) => Promise<void> | void;
  title: string;
  description?: string;
  /** Texto exacto que el usuario debe tipear para habilitar el botón. */
  confirmationText: string;
  /** Label del botón principal. Default: "Eliminar definitivamente". */
  confirmLabel?: string;
  /** Si true, muestra un textarea para pedir motivo. Default: true. */
  requireMotivo?: boolean;
  /** Elementos adicionales a mostrar debajo de la descripción (ej. detalle). */
  extraContent?: React.ReactNode;
}

export default function ConfirmDeleteStrict({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmationText,
  confirmLabel = 'Eliminar definitivamente',
  requireMotivo = true,
  extraContent,
}: Props) {
  const [texto, setTexto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [step, setStep] = useState<'input' | 'reconfirm'>('input');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (open) {
      setTexto('');
      setMotivo('');
      setStep('input');
      setEnviando(false);
    }
  }, [open]);

  const textoOk = texto.trim() === confirmationText.trim();

  const handleContinuar = () => {
    if (!textoOk) return;
    setStep('reconfirm');
  };

  const handleConfirmar = async () => {
    setEnviando(true);
    try {
      await onConfirm(motivo.trim() || undefined);
      onClose();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !enviando && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {extraContent}

        {step === 'input' ? (
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Escribí{' '}
                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                  {confirmationText}
                </span>{' '}
                para habilitar la eliminación
              </label>
              <Input
                autoFocus
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={confirmationText}
              />
            </div>
            {requireMotivo && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Motivo (opcional)
                </label>
                <Textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={2}
                  placeholder="Describí brevemente por qué se elimina..."
                />
              </div>
            )}
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={!textoOk}
                onClick={handleContinuar}
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              ¿Estás completamente seguro? Esta acción no se puede deshacer.
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('input')}
                disabled={enviando}
              >
                No, volver
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmar}
                disabled={enviando}
              >
                {enviando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Eliminando...
                  </>
                ) : (
                  'Sí, eliminar'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
