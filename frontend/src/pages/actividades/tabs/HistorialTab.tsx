/**
 * Solapa "Historial" del módulo Historial de Lavados.
 * Lista lotes de producción con filtros por cliente, fechas, remito, tipo y producto.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Filter, RefreshCw, Search } from 'lucide-react';

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
import { Badge } from '@/components/ui/badge';

import { formatDateAR } from '@/lib/utils';
import { formatNumber } from '@/utils/formatters';

import { historialLavadosService } from '@/services/historialLavadosService';
import { getClientesLista } from '@/services/clienteService';
import { productoLavadoService } from '@/services/productoLavadoService';

import HistorialDetalleModal from '../components/HistorialDetalleModal';

const PAGE_SIZE = 25;

function formatearDuracion(min: number | null): string {
  if (!min && min !== 0) return '-';
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  const restante = min % 60;
  return `${horas}h ${restante}m`;
}

export default function HistorialTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loteAbierto, setLoteAbierto] = useState<string | null>(null);

  const clienteId = searchParams.get('cliente') || '';
  const fechaDesde = searchParams.get('desde') || '';
  const fechaHasta = searchParams.get('hasta') || '';
  const numeroRemito = searchParams.get('remito') || '';
  const tipoServicio = searchParams.get('tipo') || '';
  const productoId = searchParams.get('producto') || '';
  const estado = searchParams.get('estado') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    setSearchParams(params);
  };

  const goToPage = (nueva: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', nueva.toString());
    setSearchParams(params);
  };

  const limpiarFiltros = () => {
    const params = new URLSearchParams();
    if (searchParams.get('tab')) params.set('tab', searchParams.get('tab')!);
    setSearchParams(params);
  };

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-lista'],
    queryFn: getClientesLista,
    staleTime: 5 * 60 * 1000,
  });

  const { data: productos = [] } = useQuery({
    queryKey: ['productos-lavado-lista'],
    queryFn: () => productoLavadoService.getAll({ solo_activos: true }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: tiposServicio = [] } = useQuery({
    queryKey: ['historial-tipos-servicio'],
    queryFn: historialLavadosService.getTiposServicio,
    staleTime: 60 * 60 * 1000,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: [
      'historial-lavados',
      clienteId,
      fechaDesde,
      fechaHasta,
      numeroRemito,
      tipoServicio,
      productoId,
      estado,
      page,
    ],
    queryFn: () =>
      historialLavadosService.getHistorial({
        cliente_id: clienteId || undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        numero_remito: numeroRemito || undefined,
        tipo_servicio: tipoServicio || undefined,
        producto_id: productoId || undefined,
        estado: estado || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const lotes = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.total_pages || 0;

  const hayFiltros =
    !!clienteId ||
    !!fechaDesde ||
    !!fechaHasta ||
    !!numeroRemito ||
    !!tipoServicio ||
    !!productoId ||
    !!estado;

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
              onValueChange={(v) => updateFilter('cliente', v === 'all' ? '' : v)}
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
                onChange={(e) => updateFilter('desde', e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 hidden md:inline">Hasta:</span>
              <Input
                type="date"
                className="w-40"
                value={fechaHasta}
                onChange={(e) => updateFilter('hasta', e.target.value)}
              />
            </div>

            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                className="pl-8 w-40"
                placeholder="N° Remito"
                value={numeroRemito}
                onChange={(e) => updateFilter('remito', e.target.value)}
              />
            </div>

            <Select
              value={tipoServicio || 'all'}
              onValueChange={(v) => updateFilter('tipo', v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Tipo servicio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {tiposServicio.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={productoId || 'all'}
              onValueChange={(v) => updateFilter('producto', v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Producto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los productos</SelectItem>
                {productos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={estado || 'all'}
              onValueChange={(v) => updateFilter('estado', v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="completado">Completados</SelectItem>
                <SelectItem value="en_proceso">En proceso</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
              </SelectContent>
            </Select>

            {hayFiltros && (
              <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
                Limpiar
              </Button>
            )}

            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-gray-500">{total} resultados</span>
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
        <>
          {/* Tabla desktop */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Lote</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha ingreso</TableHead>
                  <TableHead>Tipo servicio</TableHead>
                  <TableHead className="text-right">Peso (kg)</TableHead>
                  <TableHead className="text-right">Prendas</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Remito(s)</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      No se encontraron procesos con esos filtros
                    </TableCell>
                  </TableRow>
                ) : (
                  lotes.map((l) => (
                    <TableRow
                      key={l.lote_id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setLoteAbierto(l.lote_id)}
                    >
                      <TableCell className="font-mono font-medium">{l.numero_lote}</TableCell>
                      <TableCell>{l.cliente_nombre || '-'}</TableCell>
                      <TableCell>{formatDateAR(l.fecha_ingreso || '')}</TableCell>
                      <TableCell className="capitalize">
                        {l.tipo_servicio ? l.tipo_servicio.replace(/_/g, ' ') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {l.peso_entrada_kg !== null ? formatNumber(l.peso_entrada_kg, 1) : '-'}
                      </TableCell>
                      <TableCell className="text-right">{l.cantidad_prendas ?? '-'}</TableCell>
                      <TableCell>{formatearDuracion(l.duracion_minutos)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {l.remitos.length > 0
                          ? l.remitos.map((r) => r.numero).join(', ')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className="capitalize" variant="secondary">
                          {l.estado.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Cards mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
            {lotes.length === 0 && (
              <p className="col-span-full text-center text-gray-500 py-8">
                No se encontraron procesos con esos filtros
              </p>
            )}
            {lotes.map((l) => (
              <Card
                key={l.lote_id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setLoteAbierto(l.lote_id)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-mono font-medium">{l.numero_lote}</span>
                    <Badge className="capitalize" variant="secondary">
                      {l.estado.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700">{l.cliente_nombre || '—'}</p>
                  <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Ingreso: {formatDateAR(l.fecha_ingreso || '')}</span>
                    <span>Duración: {formatearDuracion(l.duracion_minutos)}</span>
                    {l.peso_entrada_kg !== null && (
                      <span>{formatNumber(l.peso_entrada_kg, 1)} kg</span>
                    )}
                    {l.cantidad_prendas !== null && <span>{l.cantidad_prendas} prendas</span>}
                  </div>
                  {l.remitos.length > 0 && (
                    <p className="text-xs font-mono text-gray-600">
                      {l.remitos.map((r) => r.numero).join(', ')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

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
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {loteAbierto && (
        <HistorialDetalleModal
          loteId={loteAbierto}
          open={!!loteAbierto}
          onClose={() => setLoteAbierto(null)}
        />
      )}
    </div>
  );
}
