/**
 * Lista de Órdenes de Compra
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  RefreshCw,
  ShoppingCart,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Building2,
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

import { proveedorService } from '@/services/proveedorService';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { EstadoOrdenCompra } from '@/types/proveedor';

const ESTADOS_ORDEN: { value: EstadoOrdenCompra; label: string }[] = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'enviada', label: 'Enviada' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'completada', label: 'Completada' },
  { value: 'cancelada', label: 'Cancelada' },
];

const ESTADO_COLORS: Record<EstadoOrdenCompra, string> = {
  borrador: 'bg-gray-100 text-gray-700',
  pendiente: 'bg-yellow-100 text-yellow-700',
  aprobada: 'bg-blue-100 text-blue-700',
  enviada: 'bg-purple-100 text-purple-700',
  parcial: 'bg-orange-100 text-orange-700',
  completada: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
};

export default function OrdenesCompraList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filtros desde URL
  const proveedorId = searchParams.get('proveedor');
  const estado = searchParams.get('estado') as EstadoOrdenCompra | null;
  const fechaDesde = searchParams.get('desde');
  const fechaHasta = searchParams.get('hasta');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;

  // Query de órdenes
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ordenes-compra', proveedorId, estado, fechaDesde, fechaHasta, page],
    queryFn: () =>
      proveedorService.getOrdenesCompra({
        skip: (page - 1) * limit,
        limit,
        proveedor_id: proveedorId || undefined,
        estado: estado || undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      }),
  });

  const ordenes = data?.items || [];
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

  const getEstadoLabel = (est: EstadoOrdenCompra) => {
    return ESTADOS_ORDEN.find((e) => e.value === est)?.label || est;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Órdenes de Compra</h1>
          <p className="text-gray-500">{total} órdenes en total</p>
        </div>
        <Button onClick={() => navigate('/proveedores/ordenes/nueva')}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Orden
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
                {ESTADOS_ORDEN.map((est) => (
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

            {(estado || fechaDesde || fechaHasta || proveedorId) && (
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
                <TableHead>Proveedor</TableHead>
                <TableHead>Fecha Emisión</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordenes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No se encontraron órdenes de compra
                  </TableCell>
                </TableRow>
              ) : (
                ordenes.map((orden) => (
                  <TableRow
                    key={orden.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/proveedores/ordenes/${orden.id}`)}
                  >
                    <TableCell className="font-mono font-medium">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-gray-400" />
                        {orden.numero}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        {orden.proveedor_nombre || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        {formatDate(orden.fecha_emision)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={ESTADO_COLORS[orden.estado]}>
                        {getEstadoLabel(orden.estado)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(orden.total)}
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
