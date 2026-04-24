/**
 * Panel de pedidos listos para facturar (cola de facturación).
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';

import { facturaService } from '@/services/facturaService';
import { getErrorMessage } from '@/services/api';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { TIPOS_COMPROBANTE_LABEL } from '@/types/factura';

export default function PedidosPendientesPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pedidos-pendientes-facturar', { fechaDesde, fechaHasta }],
    queryFn: () =>
      facturaService.listarPedidosPendientes({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        page: 1,
        page_size: 100,
      }),
  });

  const items = data?.items ?? [];
  const totalSeleccionado = useMemo(
    () =>
      items
        .filter((p) => seleccionados.has(p.id))
        .reduce((acc, p) => acc + Number(p.total), 0),
    [items, seleccionados],
  );

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
    mutationFn: (pedidoId: string) =>
      facturaService.crearDesdePedido({ pedido_id: pedidoId }),
    onSuccess: (factura) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-pendientes-facturar'] });
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      toast({
        title: 'Factura creada',
        description: 'Borrador listo para revisar y emitir a AFIP.',
      });
      navigate(`/facturacion/${factura.id}`);
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
    mutationFn: () => facturaService.facturarMasivo(Array.from(seleccionados)),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-pendientes-facturar'] });
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      setSeleccionados(new Set());
      if (res.errores.length === 0) {
        toast({
          title: `${res.creadas.length} facturas creadas`,
          description: 'Quedan en borrador, listas para emitir a AFIP.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: `${res.creadas.length} creadas, ${res.errores.length} con error`,
          description: res.errores
            .slice(0, 3)
            .map((e) => `${e.pedido_id.slice(0, 8)}…: ${e.detail}`)
            .join(' · '),
        });
      }
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

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex gap-2">
            <Input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              placeholder="Desde"
            />
            <Input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              placeholder="Hasta"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
          <div className="flex-1" />
          {algunoMarcado && (
            <>
              <div className="text-sm text-text-secondary">
                {seleccionados.size} seleccionados · {formatCurrency(totalSeleccionado)}
              </div>
              <Button
                onClick={() => facturarMasivo.mutate()}
                disabled={facturarMasivo.isPending}
                className="bg-primary hover:bg-primary-hover"
              >
                {facturarMasivo.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Receipt className="w-4 h-4 mr-2" />
                )}
                Facturar {seleccionados.size} seleccionados
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={todosMarcados}
                    onCheckedChange={(c) => toggleTodos(c === true)}
                    disabled={items.length === 0}
                  />
                </TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Sugerido</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha pedido</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10">
                    <div className="flex flex-col items-center gap-2 text-text-secondary">
                      <Receipt className="w-8 h-8" />
                      <p>No hay pedidos pendientes de facturar.</p>
                      <p className="text-xs">
                        Los pedidos aparecen acá cuando pasan a estado <b>listo</b> o <b>entregado</b>.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Checkbox
                        checked={seleccionados.has(p.id)}
                        onCheckedChange={(c) => toggleUno(p.id, c === true)}
                      />
                    </TableCell>
                    <TableCell className="font-mono">#{p.numero}</TableCell>
                    <TableCell>
                      <div>{p.cliente_razon_social}</div>
                      <div className="text-xs text-text-secondary">
                        {p.cliente_condicion_iva.replace(/_/g, ' ')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TIPOS_COMPROBANTE_LABEL[p.tipo_comprobante_sugerido]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          p.estado === 'entregado'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-green-100 text-green-700'
                        }
                      >
                        {p.estado}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(p.fecha_pedido)}</TableCell>
                    <TableCell>
                      {p.fecha_entrega_real ? (
                        formatDate(p.fecha_entrega_real)
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(Number(p.total))}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={facturarIndividual.isPending}
                        onClick={() => facturarIndividual.mutate(p.id)}
                      >
                        Facturar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {items.length === 0 && !isLoading && (
        <div className="text-center text-xs text-text-secondary flex items-center justify-center gap-2">
          <AlertTriangle className="w-3 h-3" />
          Si ves pedidos listos que no aparecen acá, puede ser que ya tengan un borrador creado
          (revisá la pestaña "Facturas").
        </div>
      )}
    </div>
  );
}
