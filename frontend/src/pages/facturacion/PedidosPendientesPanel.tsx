/**
 * Panel de remitos listos para facturar (cola de facturación).
 *
 * La unidad de facturación natural de DUWHITE es el remito generado por
 * el conteo del lote (no el pedido). Cada remito carga la cuenta corriente
 * del cliente y queda pendiente hasta que se factura.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Receipt, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';

import { facturaService } from '@/services/facturaService';
import { clienteService } from '@/services/clienteService';
import { getErrorMessage } from '@/services/api';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { TIPOS_COMPROBANTE_LABEL } from '@/types/factura';

const ESTADO_REMITO_LABEL: Record<string, string> = {
  emitido: 'Emitido',
  entregado: 'Entregado',
};

const ESTADO_REMITO_COLOR: Record<string, string> = {
  emitido: 'bg-blue-100 text-blue-700',
  entregado: 'bg-purple-100 text-purple-700',
};

export default function PedidosPendientesPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [clienteId, setClienteId] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  const { data: clientesLista } = useQuery({
    queryKey: ['clientes-lista'],
    queryFn: () => clienteService.getClientesLista(),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['remitos-pendientes-facturar', { fechaDesde, fechaHasta, clienteId }],
    queryFn: () =>
      facturaService.listarRemitosPendientes({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        cliente_id: clienteId === 'todos' ? undefined : clienteId,
        page: 1,
        page_size: 100,
      }),
  });

  const itemsRaw = data?.items ?? [];
  const items = busqueda.trim()
    ? itemsRaw.filter((r) => {
        const q = busqueda.toLowerCase();
        return (
          String(r.numero || '').toLowerCase().includes(q) ||
          String(r.lote_numero || '').toLowerCase().includes(q) ||
          (r.cliente_razon_social || '').toLowerCase().includes(q)
        );
      })
    : itemsRaw;

  const totalSeleccionado = useMemo(
    () =>
      items
        .filter((r) => seleccionados.has(r.id))
        .reduce((acc, r) => acc + Number(r.total), 0),
    [items, seleccionados],
  );

  // Verifica si todos los seleccionados son del mismo cliente (para facturar masivo)
  const clientesSeleccionados = useMemo(() => {
    const set = new Set<string>();
    items.filter((r) => seleccionados.has(r.id)).forEach((r) => set.add(r.cliente_id));
    return set;
  }, [items, seleccionados]);

  const toggleTodos = (check: boolean) => {
    setSeleccionados(check ? new Set(items.map((i) => i.id)) : new Set());
  };

  const toggleUno = (id: string, check: boolean) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (check) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const facturarIndividual = useMutation({
    mutationFn: (remitoId: string) =>
      facturaService.crearDesdeRemito({ remito_ids: [remitoId] }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['remitos-pendientes-facturar'] });
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      queryClient.invalidateQueries({ queryKey: ['cuenta-corriente'] });
      toast({
        title: 'Factura creada',
        description: 'Borrador listo para revisar y emitir a AFIP.',
      });
      navigate(`/facturacion/${res.factura_id}`);
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'No se pudo crear la factura',
        description: getErrorMessage(err),
      });
    },
  });

  const facturarMasivo = useMutation({
    mutationFn: () =>
      facturaService.crearDesdeRemito({ remito_ids: Array.from(seleccionados) }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['remitos-pendientes-facturar'] });
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      queryClient.invalidateQueries({ queryKey: ['cuenta-corriente'] });
      setSeleccionados(new Set());
      toast({
        title: 'Factura consolidada creada',
        description: `${seleccionados.size} remitos en 1 factura. Total ${formatCurrency(Number(res.total))}.`,
      });
      navigate(`/facturacion/${res.factura_id}`);
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Error al facturar',
        description: getErrorMessage(err),
      });
    },
  });

  const todosMarcados =
    items.length > 0 && items.every((i) => seleccionados.has(i.id));
  const algunoMarcado = seleccionados.size > 0;
  const mezclaClientes = clientesSeleccionados.size > 1;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              placeholder="Buscar por número de remito, lote o cliente..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los clientes</SelectItem>
                {(clientesLista || []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}{c.cuit ? ` · ${c.cuit}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2">
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-[150px]"
              />
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-[150px]"
              />
              <Button variant="outline" size="icon" onClick={() => refetch()} title="Actualizar">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1" />
            {algunoMarcado && (
              <>
                <div className="text-sm text-text-secondary whitespace-nowrap">
                  {seleccionados.size} sel. · {formatCurrency(totalSeleccionado)}
                </div>
                <Button
                  onClick={() => facturarMasivo.mutate()}
                  disabled={facturarMasivo.isPending || mezclaClientes}
                  className="bg-primary hover:bg-primary-hover"
                  title={
                    mezclaClientes
                      ? 'Solo podés consolidar remitos del mismo cliente'
                      : `Crear una factura con ${seleccionados.size} remitos`
                  }
                >
                  {facturarMasivo.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Receipt className="w-4 h-4 mr-2" />
                  )}
                  {seleccionados.size === 1 ? 'Facturar 1' : `Consolidar ${seleccionados.size}`}
                </Button>
              </>
            )}
          </div>
          {algunoMarcado && mezclaClientes && (
            <p className="text-xs text-amber-600 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" />
              Hay remitos de distintos clientes seleccionados. Solo se puede consolidar dentro de un mismo cliente.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[960px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={todosMarcados}
                      onCheckedChange={(c) => toggleTodos(c === true)}
                      disabled={items.length === 0}
                    />
                  </TableHead>
                  <TableHead className="w-[110px]">Remito</TableHead>
                  <TableHead className="w-[100px]">Lote</TableHead>
                  <TableHead className="min-w-[200px]">Cliente</TableHead>
                  <TableHead className="w-[130px]">Sugerido</TableHead>
                  <TableHead className="w-[110px]">Estado</TableHead>
                  <TableHead className="w-[120px]">F. emisión</TableHead>
                  <TableHead className="w-[80px] text-right">Ítems</TableHead>
                  <TableHead className="w-[120px] text-right">Total</TableHead>
                  <TableHead className="w-[110px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10">
                      <div className="flex flex-col items-center gap-2 text-text-secondary">
                        <Receipt className="w-8 h-8" />
                        <p>No hay remitos pendientes de facturar.</p>
                        <p className="text-xs">
                          Los remitos generados desde el conteo de lotes aparecen acá hasta que se facturan.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox
                          checked={seleccionados.has(r.id)}
                          onCheckedChange={(c) => toggleUno(r.id, c === true)}
                        />
                      </TableCell>
                      <TableCell className="font-mono whitespace-nowrap">#{r.numero}</TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap text-text-secondary">
                        {r.lote_numero || '—'}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <div className="truncate" title={r.cliente_razon_social}>
                          {r.cliente_razon_social}
                        </div>
                        <div className="text-xs text-text-secondary truncate">
                          {r.cliente_condicion_iva.replace(/_/g, ' ')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="whitespace-nowrap">
                          {TIPOS_COMPROBANTE_LABEL[r.tipo_comprobante_sugerido]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={ESTADO_REMITO_COLOR[r.estado] || 'bg-gray-100 text-gray-700'}>
                          {ESTADO_REMITO_LABEL[r.estado] || r.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(r.fecha_emision)}
                      </TableCell>
                      <TableCell className="text-right">{r.cantidad_items}</TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">
                        {formatCurrency(Number(r.total))}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={facturarIndividual.isPending}
                          onClick={() => facturarIndividual.mutate(r.id)}
                        >
                          Facturar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {items.length === 0 && !isLoading && (
        <div className="text-center text-xs text-text-secondary flex items-center justify-center gap-2">
          <AlertTriangle className="w-3 h-3" />
          Si ves un lote terminado cuyo remito no aparece acá, puede ser que el conteo no se haya emitido o que ya esté facturado (revisá "Facturas").
        </div>
      )}
    </div>
  );
}
