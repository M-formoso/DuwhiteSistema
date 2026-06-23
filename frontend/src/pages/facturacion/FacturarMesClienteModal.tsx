/**
 * Modal para emitir UNA factura consolidada de TODOS los remitos
 * del mes de un cliente. Con preview de qué remitos entran y cuáles
 * se excluyen (ya facturados, anulados, sin ítems).
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

import { facturaService } from '@/services/facturaService';
import { clienteService } from '@/services/clienteService';
import { getErrorMessage } from '@/services/api';
import { formatCurrency, formatDate } from '@/utils/formatters';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function FacturarMesClienteModal({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const ahora = new Date();
  const [clienteId, setClienteId] = useState('');
  const [mes, setMes] = useState<number>(ahora.getMonth() + 1);
  const [anio, setAnio] = useState<number>(ahora.getFullYear());
  const [fechaEmision, setFechaEmision] = useState(new Date().toLocaleDateString('en-CA'));

  const { data: clientes } = useQuery({
    queryKey: ['clientes-lista'],
    queryFn: () => clienteService.getClientesLista(),
    enabled: open,
  });

  // Preview: se dispara automáticamente cuando hay cliente + mes + año
  const { data: preview, isLoading: loadingPreview, error: errorPreview } = useQuery({
    queryKey: ['factura-mes-preview-remitos', clienteId, mes, anio],
    queryFn: () => facturaService.previewMesRemitos(clienteId, mes, anio),
    enabled: Boolean(clienteId && mes && anio && open),
  });

  const facturarMut = useMutation({
    mutationFn: () =>
      facturaService.facturarMesRemitos(clienteId, mes, anio, fechaEmision || undefined),
    onSuccess: (r) => {
      toast({
        title: 'Factura BORRADOR creada',
        description: `${r.items} ítems consolidados. Revisá y emití a AFIP.`,
      });
      onOpenChange(false);
      navigate(`/facturacion/${r.factura_id}`);
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'No se pudo crear la factura mensual',
        description: getErrorMessage(err),
      });
    },
  });

  const aniosDisponibles = (() => {
    const out: number[] = [];
    for (let y = ahora.getFullYear() + 1; y >= ahora.getFullYear() - 3; y--) out.push(y);
    return out;
  })();

  const puedeFacturar = preview && preview.cantidad_a_facturar > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Factura mensual por cliente</DialogTitle>
          <DialogDescription>
            Consolida todos los remitos no facturados del cliente en el período
            seleccionado en UNA sola factura BORRADOR.
          </DialogDescription>
        </DialogHeader>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 py-2">
          <div className="md:col-span-4 space-y-1">
            <Label>Cliente *</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí un cliente" />
              </SelectTrigger>
              <SelectContent>
                {(clientes || []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre} {c.cuit ? `· ${c.cuit}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Mes</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Año</Label>
            <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {aniosDisponibles.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label>Fecha de emisión</Label>
            <Input
              type="date"
              value={fechaEmision}
              onChange={(e) => setFechaEmision(e.target.value)}
            />
          </div>
        </div>

        {/* Preview */}
        {clienteId && (
          <div className="space-y-3 border-t pt-4">
            {loadingPreview ? (
              <div className="flex items-center justify-center py-6 text-text-secondary">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Calculando previsualización…
              </div>
            ) : errorPreview ? (
              <div className="text-sm text-red-600">
                No se pudo cargar la previsualización: {getErrorMessage(errorPreview)}
              </div>
            ) : preview ? (
              <>
                {/* Resumen */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <p className="text-xs text-green-700 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      A facturar
                    </p>
                    <p className="text-lg font-bold text-green-800">
                      {preview.cantidad_a_facturar} remito{preview.cantidad_a_facturar !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className={`border rounded p-3 ${preview.cantidad_excluidos > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50'}`}>
                    <p className={`text-xs flex items-center gap-1 ${preview.cantidad_excluidos > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
                      <AlertTriangle className="h-3 w-3" />
                      Excluidos
                    </p>
                    <p className={`text-lg font-bold ${preview.cantidad_excluidos > 0 ? 'text-amber-800' : 'text-gray-700'}`}>
                      {preview.cantidad_excluidos} remito{preview.cantidad_excluidos !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-xs text-blue-700">Total a facturar</p>
                    <p className="text-lg font-bold text-blue-800">
                      {formatCurrency(preview.total_a_facturar)}
                    </p>
                  </div>
                </div>

                {/* Remitos a incluir */}
                {preview.incluidos.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2 text-green-800">
                      Se incluirán {preview.incluidos.length} remito(s):
                    </p>
                    <div className="border rounded divide-y max-h-60 overflow-y-auto">
                      {preview.incluidos.map((r) => (
                        <div key={r.id} className="flex justify-between items-center px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-text-secondary">#{r.numero}</span>
                            {r.lote_numero && (
                              <>
                                <span className="text-text-secondary">·</span>
                                <span className="text-xs text-text-secondary">Lote {r.lote_numero}</span>
                              </>
                            )}
                            <span className="text-text-secondary">·</span>
                            <span>{formatDate(r.fecha)}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-text-secondary">{r.cantidad_items} ítems</span>
                            <span className="font-mono font-semibold">{formatCurrency(r.total)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Excluidos */}
                {preview.excluidos.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2 text-amber-800 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      Se omitirán {preview.excluidos.length} remito(s):
                    </p>
                    <div className="border rounded divide-y max-h-40 overflow-y-auto bg-amber-50/30">
                      {preview.excluidos.map((r) => (
                        <div key={r.id} className="flex justify-between items-center px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-text-secondary">#{r.numero}</span>
                            <span className="text-text-secondary">·</span>
                            <span>{formatDate(r.fecha)}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono">{formatCurrency(r.total)}</span>
                            <Badge variant="outline" className="text-xs text-amber-700 border-amber-400">
                              {r.motivo_exclusion}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {preview.cantidad_a_facturar === 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                    No hay remitos para facturar en este período. {preview.cantidad_excluidos > 0
                      ? 'Todos los remitos están excluidos (ver detalle arriba).'
                      : 'Probá con otro mes/año o asegurate que el cliente tenga remitos generados desde el conteo.'}
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => facturarMut.mutate()}
            disabled={!puedeFacturar || facturarMut.isPending}
          >
            {facturarMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {puedeFacturar
              ? `Generar BORRADOR · ${formatCurrency(preview.total_a_facturar)}`
              : 'Generar factura BORRADOR'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
