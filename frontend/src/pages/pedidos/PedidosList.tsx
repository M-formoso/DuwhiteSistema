/**
 * Lista de Pedidos
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  RefreshCw,
  Package,
  Calendar,
  DollarSign,
  Truck,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { clienteService } from '@/services/clienteService';
import { formatNumber } from '@/utils/formatters';
import type { EstadoPedido } from '@/types/cliente';
import { ESTADOS_PEDIDO, TIPOS_ENTREGA } from '@/types/cliente';

const ESTADO_COLORS: Record<EstadoPedido, string> = {
  borrador: 'bg-gray-100 text-gray-700',
  confirmado: 'bg-blue-100 text-blue-700',
  en_proceso: 'bg-yellow-100 text-yellow-700',
  listo: 'bg-green-100 text-green-700',
  entregado: 'bg-purple-100 text-purple-700',
  facturado: 'bg-teal-100 text-teal-700',
  cancelado: 'bg-red-100 text-red-700',
};

export default function PedidosListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filtros desde URL
  const clienteId = searchParams.get('cliente');
  const estado = searchParams.get('estado') as EstadoPedido | null;
  const fechaDesde = searchParams.get('desde');
  const fechaHasta = searchParams.get('hasta');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;

  // Query de pedidos
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pedidos', clienteId, estado, fechaDesde, fechaHasta, page],
    queryFn: () =>
      clienteService.getPedidos({
        skip: (page - 1) * limit,
        limit,
        cliente_id: clienteId || undefined,
        estado: estado || undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      }),
  });

  const pedidos = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const updateFilter = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const goToPage = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    setSearchParams(newParams);
  };

  const getEstadoLabel = (est: EstadoPedido) => {
    return ESTADOS_PEDIDO.find((e) => e.value === est)?.label || est;
  };

  const getTipoEntregaLabel = (tipo: string) => {
    return TIPOS_ENTREGA.find((t) => t.value === tipo)?.label || tipo;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-gray-500">{total} pedidos en total</p>
        </div>
        <Button onClick={() => navigate('/pedidos/nuevo')}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Pedido
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filtros:</span>
            </div>

            <Select
              value={estado || 'all'}
              onValueChange={(v) => updateFilter('estado', v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {ESTADOS_PEDIDO.map((est) => (
                  <SelectItem key={est.value} value={est.value}>
                    {est.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Desde:</span>
              <Input
                type="date"
                className="w-40"
                value={fechaDesde || ''}
                onChange={(e) => updateFilter('desde', e.target.value || null)}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Hasta:</span>
              <Input
                type="date"
                className="w-40"
                value={fechaHasta || ''}
                onChange={(e) => updateFilter('hasta', e.target.value || null)}
              />
            </div>

            {(estado || fechaDesde || fechaHasta || clienteId) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )}

            <div className="ml-auto">
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Entrega Est.</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No se encontraron pedidos
                  </TableCell>
                </TableRow>
              ) : (
                pedidos.map((pedido) => (
                  <TableRow
                    key={pedido.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/pedidos/${pedido.id}`)}
                  >
                    <TableCell className="font-mono font-medium">{pedido.numero}</TableCell>
                    <TableCell>{pedido.cliente_nombre || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        {new Date(pedido.fecha_pedido).toLocaleDateString('es-AR')}
                      </div>
                    </TableCell>
                    <TableCell>
                      {pedido.fecha_entrega_estimada
                        ? new Date(pedido.fecha_entrega_estimada).toLocaleDateString('es-AR')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={ESTADO_COLORS[pedido.estado]}>
                        {getEstadoLabel(pedido.estado)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Truck className="h-3 w-3 text-gray-400" />
                        {getTipoEntregaLabel(pedido.tipo_entrega)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${formatNumber(pedido.total, 2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          pedido.saldo_pendiente > 0 ? 'text-red-600 font-medium' : 'text-green-600'
                        }
                      >
                        ${formatNumber(pedido.saldo_pendiente, 2)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => goToPage(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
