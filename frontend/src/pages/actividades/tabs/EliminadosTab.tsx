/**
 * Solapa "Eliminados" — muestra el historial de remitos eliminados
 * (leído desde LogActividad).
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Eye, Filter, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { formatDateAR } from '@/lib/utils';
import { formatNumber } from '@/utils/formatters';

import { historialLavadosService } from '@/services/historialLavadosService';
import { getClientesLista } from '@/services/clienteService';
import type { RemitoEliminadoRow } from '@/types/historialLavados';

const PAGE_SIZE = 25;

function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export default function EliminadosTab() {
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [page, setPage] = useState(1);
  const [detalleAbierto, setDetalleAbierto] = useState<RemitoEliminadoRow | null>(null);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-lista'],
    queryFn: getClientesLista,
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['remitos-eliminados', fechaDesde, fechaHasta, clienteId, page],
    queryFn: () =>
      historialLavadosService.getRemitosEliminados({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        cliente_id: clienteId || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.total_pages || 0;

  const limpiar = () => {
    setFechaDesde('');
    setFechaHasta('');
    setClienteId('');
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
            <div className="hidden sm:flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filtros:</span>
            </div>

            <Select
              value={clienteId || 'all'}
              onValueChange={(v) => {
                setClienteId(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 hidden md:inline">Desde:</span>
              <Input
                type="date"
                className="w-40"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 hidden md:inline">Hasta:</span>
              <Input
                type="date"
                className="w-40"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {(fechaDesde || fechaHasta || clienteId) && (
              <Button variant="ghost" size="sm" onClick={limpiar}>
                Limpiar
              </Button>
            )}

            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-gray-500">{total} registros</span>
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>N° Remito</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No hay remitos eliminados en el período
                  </TableCell>
                </TableRow>
              ) : (
                items.map((r) => (
                  <TableRow key={r.log_id}>
                    <TableCell>{formatDateAR(r.fecha || '')}</TableCell>
                    <TableCell className="font-mono text-xs">{r.hora ?? '-'}</TableCell>
                    <TableCell>{r.usuario_nombre ?? '-'}</TableCell>
                    <TableCell className="font-mono">{r.numero_remito ?? '-'}</TableCell>
                    <TableCell>{r.cliente_nombre ?? '-'}</TableCell>
                    <TableCell className="text-right">
                      ${formatNumber(toNumber(r.monto), 2)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={r.motivo || ''}>
                      {r.motivo ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDetalleAbierto(r)}
                        title="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={!!detalleAbierto} onOpenChange={(o) => !o && setDetalleAbierto(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Remito eliminado {detalleAbierto?.numero_remito ?? ''}
            </DialogTitle>
          </DialogHeader>
          {detalleAbierto && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Eliminado por</p>
                  <p className="font-medium">{detalleAbierto.usuario_nombre ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Fecha / hora</p>
                  <p>
                    {formatDateAR(detalleAbierto.fecha || '')} {detalleAbierto.hora}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Cliente</p>
                  <p>{detalleAbierto.cliente_nombre ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Monto revertido</p>
                  <p className="font-semibold">
                    ${formatNumber(toNumber(detalleAbierto.monto), 2)}
                  </p>
                </div>
              </div>
              {detalleAbierto.motivo && (
                <div>
                  <p className="text-xs text-gray-500 uppercase">Motivo</p>
                  <p>{detalleAbierto.motivo}</p>
                </div>
              )}

              {Array.isArray(detalleAbierto.datos?.detalles) &&
                detalleAbierto.datos.detalles.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Productos del remito</p>
                    <div className="border rounded">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-2">Producto</th>
                            <th className="text-right p-2">Cant.</th>
                            <th className="text-right p-2">P. Unit.</th>
                            <th className="text-right p-2">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {detalleAbierto.datos.detalles.map((d: any, i: number) => (
                            <tr key={i}>
                              <td className="p-2">{d.producto_nombre ?? '-'}</td>
                              <td className="text-right p-2">{d.cantidad}</td>
                              <td className="text-right p-2">
                                ${formatNumber(toNumber(d.precio_unitario), 2)}
                              </td>
                              <td className="text-right p-2 font-medium">
                                ${formatNumber(toNumber(d.subtotal), 2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
