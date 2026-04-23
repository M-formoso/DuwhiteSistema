/**
 * Formulario de Nota de Débito.
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
import { useToast } from '@/components/ui/use-toast';

import { facturaService } from '@/services/facturaService';
import { getErrorMessage } from '@/services/api';
import { formatCurrency } from '@/utils/formatters';
import { FacturaDetalleCreate } from '@/types/factura';

export default function NotaDebitoFormPage() {
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
  const [detalles, setDetalles] = useState<FacturaDetalleCreate[]>([
    { descripcion: '', cantidad: 1, precio_unitario_neto: 0, iva_porcentaje: 21 },
  ]);

  const crear = useMutation({
    mutationFn: () =>
      facturaService.crearNotaDebito(id!, {
        motivo,
        observaciones: observaciones || undefined,
        detalles,
      }),
    onSuccess: (nd) => {
      toast({
        title: 'Nota de Débito creada',
        description: 'La ND quedó en borrador.',
      });
      navigate(`/facturacion/${nd.id}`);
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'No se pudo crear la ND',
        description: getErrorMessage(err),
      });
    },
  });

  const update = (i: number, campo: keyof FacturaDetalleCreate, valor: unknown) => {
    setDetalles((arr) => arr.map((d, idx) => (idx === i ? { ...d, [campo]: valor } : d)));
  };

  const add = () =>
    setDetalles([
      ...detalles,
      { descripcion: '', cantidad: 1, precio_unitario_neto: 0, iva_porcentaje: 21 },
    ]);

  const remove = (i: number) => setDetalles((arr) => arr.filter((_, idx) => idx !== i));

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
          <p>Solo se pueden emitir ND sobre facturas autorizadas.</p>
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
          <h1 className="text-2xl font-bold">Nueva Nota de Débito {original.letra}</h1>
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
              placeholder="Ej: intereses por mora, ajuste de precio..."
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Detalle</CardTitle>
          <Button size="sm" variant="outline" onClick={add}>
            Agregar línea
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {detalles.map((d, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                <Label className="text-xs">Descripción</Label>
                <Input
                  value={d.descripcion}
                  onChange={(e) => update(i, 'descripcion', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Cantidad</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={d.cantidad}
                  onChange={(e) => update(i, 'cantidad', Number(e.target.value))}
                />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Precio unit. neto</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={d.precio_unitario_neto}
                  onChange={(e) => update(i, 'precio_unitario_neto', Number(e.target.value))}
                />
              </div>
              <div className="col-span-1">
                <Label className="text-xs">IVA%</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={d.iva_porcentaje ?? 21}
                  onChange={(e) => update(i, 'iva_porcentaje', Number(e.target.value))}
                />
              </div>
              <div className="col-span-1">
                {detalles.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => remove(i)}
                    className="text-destructive"
                  >
                    ×
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(`/facturacion/${id}`)}>
          Cancelar
        </Button>
        <Button
          onClick={() => crear.mutate()}
          disabled={
            crear.isPending || !motivo.trim() || detalles.length === 0 ||
            detalles.some((d) => !d.descripcion.trim())
          }
        >
          {crear.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Crear ND en borrador
        </Button>
      </div>
    </div>
  );
}
