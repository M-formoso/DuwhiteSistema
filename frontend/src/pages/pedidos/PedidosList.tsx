/**
 * Lista de Pedidos
 */

import { useState, useEffect } from 'react';
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
  LayoutGrid,
  List,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { clienteService } from '@/services/clienteService';
import { formatNumber } from '@/utils/formatters';
import { formatDateAR } from '@/lib/utils';
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

const PEDIDOS_VIEW_KEY = 'duwhite:pedidos:view-mode';

function getInitialPedidosViewMode(): 'table' | 'cards' {
  if (typeof window === 'undefined') return 'table';
  const stored = window.localStorage.getItem(PEDIDOS_VIEW_KEY);
  if (stored === 'table' || stored === 'cards') return stored as 'table' | 'cards';
  if (window.matchMedia('(max-width: 767px)').matches) return 'cards';
  return 'table';
}

export default function PedidosListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(getInitialPedidosViewMode);
  useEffect(() => {
    window.localStorage.setItem(PEDIDOS_VIEW_KEY, viewMode);
  }, [viewMode]);

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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-sm text-gray-500">{total} pedidos en total</p>
        </div>
        <Button onClick={() => navigate('/pedidos/nuevo')} className="sm:flex-initial">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Pedido
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="py-3 sm:py-4">
          <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
            <div className="hidden sm:flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filtros:</span>
            </div>

            <Select
              value={estado || 'all'}
              onValueChange={(v) => updateFilter('estado', v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-full xs:w-36 sm:w-40">
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
              <span className="text-sm text-gray-500 hidden xs:inline">Desde:</span>
              <Input
                type="date"
                className="w-36 sm:w-40"
                value={fechaDesde || ''}
                onChange={(e) => updateFilter('desde', e.target.value || null)}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 hidden xs:inline">Hasta:</span>
              <Input
                type="date"
                className="w-36 sm:w-40"
                value={fechaHasta || ''}
                onChange={(e) => updateFilter('hasta', e.target.value || null)}
              />
            </div>

            {(estado || fechaDesde || fechaHasta || clienteId) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpiar
              </Button>
            )}

            <div className="ml-auto flex gap-1 sm:gap-2">
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="icon"
                className="hidden md:inline-flex"
                onClick={() => setViewMode('table')}
                title="Vista tabla"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                size="icon"
                className="hidden md:inline-flex"
                onClick={() => setViewMode('cards')}
                title="Vista cards"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contenido */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : viewMode === 'table' ? (
        <Card className="hidden md:block">
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
                        {formatDateAR(pedido.fecha_pedido)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {pedido.fecha_entrega_estimada
                        ? formatDateAR(pedido.fecha_entrega_estimada)
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
      ) : null}

      {/* Cards: siempre en mobile, opcional en desktop */}
      {!isLoading && (
        <div
          className={
            viewMode === 'cards'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4'
              : 'grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden'
          }
        >
          {pedidos.length === 0 && (
            <p className="col-span-full text-center text-gray-500 py-8">
              No se encontraron pedidos
            </p>
          )}
          {pedidos.map((pedido) => (
            <Card
              key={pedido.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/pedidos/${pedido.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-mono">{pedido.numero}</CardTitle>
                  <Badge className={ESTADO_COLORS[pedido.estado]}>
                    {getEstadoLabel(pedido.estado)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {pedido.cliente_nombre && (
                  <p className="text-sm font-medium text-gray-700 truncate">{pedido.cliente_nombre}</p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDateAR(pedido.fecha_pedido)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    {getTipoEntregaLabel(pedido.tipo_entrega)}
                  </span>
                </div>
                {pedido.fecha_entrega_estimada && (
                  <div className="text-xs text-gray-500">
                    Entrega est.: {formatDateAR(pedido.fecha_entrega_estimada)}
                  </div>
                )}
                <div className="flex items-end justify-between pt-2 border-t">
                  <div>
                    <p className="text-[10px] uppercase text-gray-400">Total</p>
                    <p className="text-sm font-semibold">${formatNumber(pedido.total, 2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-400">Saldo</p>
                    <p className={`text-sm font-semibold ${pedido.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${formatNumber(pedido.saldo_pendiente, 2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
