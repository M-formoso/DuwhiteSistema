/**
 * Formulario de Nota de Crédito (total o por líneas).
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

import { facturaService } from '@/services/facturaService';
import { getErrorMessage } from '@/services/api';
import { formatCurrency } from '@/utils/formatters';
import { NotaCreditoItem } from '@/types/factura';

export default function NotaCreditoFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: original, isLoading } = useQuery({
    queryKey: ['factura', id],
    queryFn: () => facturaService.obtener(id!),
    enabled: !!id,
  });

  const [motivo, setMotivo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [total, setTotal] = useState(true);
  const [detalles, setDetalles] = useState<NotaCreditoItem[]>([]);

  const crear = useMutation({
    mutationFn: () =>
      facturaService.crearNotaCredito(id!, {
        motivo,
        observaciones: observaciones || undefined,
        total,
        detalles: total ? undefined : detalles,
      }),
    onSuccess: (nc) => {
      toast({
        title: 'Nota de Crédito creada',
        description: 'La NC quedó en borrador. Emitila a AFIP para obtener el CAE.',
      });
      navigate(`/facturacion/${nc.id}`);
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'No se pudo crear la NC',
        description: getErrorMessage(err),
      });
    },
  });

  const addDetalle = () => {
    if (!original) return;
    setDetalles([
      ...detalles,
      {
        descripcion: '',
        cantidad: 1,
        precio_unitario_neto: 0,
        iva_porcentaje: 21,
      },
    ]);
  };

  const updateDetalle = (i: number, campo: keyof NotaCreditoItem, valor: unknown) => {
    setDetalles((arr) =>
      arr.map((d, idx) => (idx === i ? { ...d, [campo]: valor } : d)),
    );
  };

  const removeDetalle = (i: number) => {
    setDetalles((arr) => arr.filter((_, idx) => idx !== i));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!original) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-2" />
          <p>Factura original no encontrada</p>
        </CardContent>
      </Card>
    );
  }

  if (original.estado !== 'autorizada') {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-2" />
          <p>Solo se pueden emitir NC sobre facturas autorizadas.</p>
          <Button variant="link" onClick={() => navigate(`/facturacion/${id}`)}>
            Volver
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/facturacion/${id}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nueva Nota de Crédito {original.letra}</h1>
          <p className="text-text-secondary">
            Asociada a {original.numero_completo} · Total original{' '}
            <span className="font-semibold">{formatCurrency(Number(original.total))}</span>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la nota</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="motivo">Motivo *</Label>
            <Input
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: devolución de mercadería, error en facturación, descuento comercial..."
            />
          </div>

          <div>
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <Label htmlFor="total" className="font-semibold">
                NC por el total de la factura
              </Label>
              <p className="text-sm text-text-secondary">
                Si está activo, la NC anula la factura original. Sino, podés cargar ítems parciales.
              </p>
            </div>
            <Switch id="total" checked={total} onCheckedChange={setTotal} />
          </div>
        </CardContent>
      </Card>

      {!total && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Detalle a creditar</CardTitle>
            <Button size="sm" variant="outline" onClick={addDetalle}>
              Agregar línea
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {detalles.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-4">
                Sin líneas. Agregá al menos una.
              </p>
            ) : (
              detalles.map((d, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Label className="text-xs">Descripción</Label>
                    <Input
                      value={d.descripcion}
                      onChange={(e) => updateDetalle(i, 'descripcion', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Cantidad</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={d.cantidad}
                      onChange={(e) => updateDetalle(i, 'cantidad', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Precio unit. neto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={d.precio_unitario_neto}
                      onChange={(e) =>
                        updateDetalle(i, 'precio_unitario_neto', Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="text-xs">IVA%</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={d.iva_porcentaje ?? 21}
                      onChange={(e) => updateDetalle(i, 'iva_porcentaje', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeDetalle(i)}
                      className="text-destructive"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(`/facturacion/${id}`)}>
          Cancelar
        </Button>
        <Button
          onClick={() => crear.mutate()}
          disabled={
            crear.isPending || !motivo.trim() || (!total && detalles.length === 0)
          }
        >
          {crear.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Crear NC en borrador
        </Button>
      </div>
    </div>
  );
}
