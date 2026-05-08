/**
 * Lista de aplicaciones (pagos) sobre una factura, embebida en el detalle de la factura.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';

import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, formatDate } from '@/utils/formatters';

interface Aplicacion {
  id: string;
  factura_id: string;
  factura_numero: string | null;
  movimiento_pago_id: string;
  monto_aplicado: number;
  fecha_aplicacion: string;
  automatica: boolean;
  notas: string | null;
}

interface Props {
  facturaId: string;
}

export default function AplicacionesFactura({ facturaId }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: aplicaciones, isLoading } = useQuery<Aplicacion[]>({
    queryKey: ['factura-aplicaciones', facturaId],
    queryFn: async () => {
      const r = await api.get(`/facturas/${facturaId}/aplicaciones`);
      return r.data;
    },
  });

  const desaplicarMut = useMutation({
    mutationFn: (id: string) => api.delete(`/aplicaciones/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['factura-aplicaciones', facturaId] });
      queryClient.invalidateQueries({ queryKey: ['factura', facturaId] });
      toast({ title: 'Aplicación eliminada' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo desaplicar', variant: 'destructive' });
    },
  });

  if (isLoading) return null;
  if (!aplicaciones || aplicaciones.length === 0) {
    return (
      <div className="text-sm text-text-secondary border-t pt-3 mt-3">
        Esta factura todavía no recibió pagos aplicados.
      </div>
    );
  }

  return (
    <div className="border-t pt-4 mt-4">
      <h4 className="text-sm font-semibold mb-3">Pagos aplicados ({aplicaciones.length})</h4>
      <div className="space-y-2">
        {aplicaciones.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-3 flex-1">
              <span className="font-mono text-text-secondary">{formatDate(a.fecha_aplicacion)}</span>
              <span className="font-semibold">{formatCurrency(a.monto_aplicado)}</span>
              {a.automatica ? (
                <Badge variant="outline" className="text-xs">FIFO auto</Badge>
              ) : (
                <Badge variant="outline" className="text-xs">Manual</Badge>
              )}
              {a.notas && <span className="text-xs text-text-secondary truncate">{a.notas}</span>}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm('¿Eliminar esta aplicación? El monto vuelve a quedar como anticipo.')) {
                  desaplicarMut.mutate(a.id);
                }
              }}
              disabled={desaplicarMut.isPending}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
