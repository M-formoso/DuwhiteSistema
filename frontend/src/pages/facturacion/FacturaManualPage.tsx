/**
 * Crear Factura Manual (sin pedido asociado).
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { formatCurrency } from '@/utils/formatters';
import type { FacturaDetalleCreate } from '@/types/factura';

interface ItemLocal {
  descripcion: string;
  cantidad: number;
  unidad_medida: string;
  precio_unitario_neto: number;
  iva_porcentaje: number;
}

const ITEM_VACIO: ItemLocal = {
  descripcion: '',
  cantidad: 1,
  unidad_medida: 'unidad',
  precio_unitario_neto: 0,
  iva_porcentaje: 21,
};

export default function FacturaManualPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [clienteId, setClienteId] = useState('');
  const [fechaEmision, setFechaEmision] = useState(new Date().toLocaleDateString('en-CA'));
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState<ItemLocal[]>([{ ...ITEM_VACIO }]);

  const { data: clientes } = useQuery({
    queryKey: ['clientes-lista'],
    queryFn: () => clienteService.getClientesLista(),
  });

  const subtotal = items.reduce(
    (s, i) => s + (Number(i.cantidad) || 0) * (Number(i.precio_unitario_neto) || 0),
    0,
  );
  const ivaTotal = items.reduce(
    (s, i) =>
      s +
      ((Number(i.cantidad) || 0) * (Number(i.precio_unitario_neto) || 0) *
        (Number(i.iva_porcentaje) || 0)) /
        100,
    0,
  );
  const total = subtotal + ivaTotal;

  const crearMut = useMutation({
    mutationFn: () =>
      facturaService.crearManual({
        cliente_id: clienteId,
        fecha_emision: fechaEmision || undefined,
        observaciones: observaciones || undefined,
        detalles: items.map<FacturaDetalleCreate>((i) => ({
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          unidad_medida: i.unidad_medida,
          precio_unitario_neto: i.precio_unitario_neto,
          iva_porcentaje: i.iva_porcentaje,
        })),
      }),
    onSuccess: (f) => {
      toast({
        title: 'Factura BORRADOR creada',
        description: 'Revisá los datos y emití a AFIP.',
      });
      navigate(`/facturacion/${f.id}`);
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'No se pudo crear la factura',
        description: getErrorMessage(err),
      });
    },
  });

  const valido =
    clienteId &&
    items.length > 0 &&
    items.every((i) => i.descripcion.trim() && i.cantidad > 0 && i.precio_unitario_neto >= 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/facturacion')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Factura manual</h1>
          <p className="text-text-secondary text-sm">
            Crear factura sin pedido previo (venta suelta, servicio especial, ajuste, etc.).
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la factura</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2 md:col-span-2">
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
          <div className="space-y-2">
            <Label>Fecha emisión</Label>
            <Input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label>Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Aparecen en el PDF de la factura"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Ítems</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setItems([...items, { ...ITEM_VACIO }])}
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar ítem
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, idx) => (
            <div
              key={idx}
              className="grid grid-cols-12 gap-2 items-end border rounded p-3 bg-muted/30"
            >
              <div className="col-span-12 md:col-span-4 space-y-1">
                <Label className="text-xs">Descripción</Label>
                <Input
                  value={it.descripcion}
                  onChange={(e) => {
                    const v = [...items];
                    v[idx].descripcion = e.target.value;
                    setItems(v);
                  }}
                  placeholder="Ej: Lavado especial 50 manteles"
                />
              </div>
              <div className="col-span-4 md:col-span-1 space-y-1">
                <Label className="text-xs">Cant.</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={it.cantidad}
                  onChange={(e) => {
                    const v = [...items];
                    v[idx].cantidad = Number(e.target.value);
                    setItems(v);
                  }}
                />
              </div>
              <div className="col-span-4 md:col-span-2 space-y-1">
                <Label className="text-xs">Unidad</Label>
                <Select
                  value={it.unidad_medida}
                  onValueChange={(val) => {
                    const v = [...items];
                    v[idx].unidad_medida = val;
                    setItems(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unidad">Unidad</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="metro">Metro</SelectItem>
                    <SelectItem value="servicio">Servicio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-4 md:col-span-2 space-y-1">
                <Label className="text-xs">Precio unit. (neto)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={it.precio_unitario_neto}
                  onChange={(e) => {
                    const v = [...items];
                    v[idx].precio_unitario_neto = Number(e.target.value);
                    setItems(v);
                  }}
                />
              </div>
              <div className="col-span-4 md:col-span-1 space-y-1">
                <Label className="text-xs">IVA %</Label>
                <Select
                  value={String(it.iva_porcentaje)}
                  onValueChange={(val) => {
                    const v = [...items];
                    v[idx].iva_porcentaje = Number(val);
                    setItems(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="21">21%</SelectItem>
                    <SelectItem value="10.5">10.5%</SelectItem>
                    <SelectItem value="0">0%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-4 md:col-span-1 text-right text-sm">
                <Label className="text-xs">Subtotal</Label>
                <p className="font-mono">
                  {formatCurrency((it.cantidad || 0) * (it.precio_unitario_neto || 0))}
                </p>
              </div>
              <div className="col-span-12 md:col-span-1 flex justify-end">
                {items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-text-secondary">Subtotal (neto)</p>
            <p className="text-lg font-semibold">{formatCurrency(subtotal)}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">IVA</p>
            <p className="text-lg font-semibold">{formatCurrency(ivaTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Total</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(total)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => navigate('/facturacion')}>
          Cancelar
        </Button>
        <Button onClick={() => crearMut.mutate()} disabled={!valido || crearMut.isPending}>
          {crearMut.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Crear borrador
        </Button>
      </div>
    </div>
  );
}
