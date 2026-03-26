/**
 * Lista de Insumos (Stock)
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Package,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  ArrowUpDown,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

import { stockService } from '@/services/stockService';
import { formatNumber, formatCurrency } from '@/utils/formatters';
import type { Insumo, InsumoFilters } from '@/types/stock';

export default function InsumosList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<InsumoFilters>({
    solo_activos: true,
    solo_stock_bajo: false,
    solo_sin_stock: false,
  });
  const [page, setPage] = useState(1);
  const limit = 20;

  // Cargar categorías para filtro
  const { data: categorias } = useQuery({
    queryKey: ['categorias-lista'],
    queryFn: () => stockService.getCategoriasLista(),
  });

  // Cargar insumos
  const { data, isLoading } = useQuery({
    queryKey: ['insumos', { page, search, ...filters }],
    queryFn: () =>
      stockService.getInsumos({
        skip: (page - 1) * limit,
        limit,
        search: search || undefined,
        ...filters,
      }),
  });

  // Cargar alertas
  const { data: alertas } = useQuery({
    queryKey: ['alertas-stock'],
    queryFn: () => stockService.getAlertasStock(),
  });

  // Eliminar insumo
  const deleteMutation = useMutation({
    mutationFn: (id: string) => stockService.deleteInsumo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      toast({
        title: 'Insumo eliminado',
        description: 'El insumo ha sido eliminado correctamente.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el insumo.',
        variant: 'destructive',
      });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const getStockBadge = (insumo: Insumo) => {
    if (insumo.sin_stock) {
      return <Badge variant="destructive">Sin Stock</Badge>;
    }
    if (insumo.stock_bajo) {
      return <Badge variant="warning">Stock Bajo</Badge>;
    }
    if (insumo.sobrestock) {
      return <Badge variant="secondary">Sobrestock</Badge>;
    }
    return <Badge variant="success">OK</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock de Insumos</h1>
          <p className="text-gray-500">Gestión de inventario de insumos y materiales</p>
        </div>
        <Button onClick={() => navigate('/stock/insumos/nuevo')}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Insumo
        </Button>
      </div>

      {/* Alertas */}
      {alertas && alertas.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center text-yellow-800">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alertas de Stock ({alertas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {alertas.slice(0, 5).map((alerta) => (
                <Badge
                  key={alerta.id}
                  variant={alerta.tipo_alerta === 'sin_stock' ? 'destructive' : 'warning'}
                  className="cursor-pointer"
                  onClick={() => navigate(`/stock/insumos/${alerta.id}`)}
                >
                  {alerta.codigo}: {alerta.mensaje}
                </Badge>
              ))}
              {alertas.length > 5 && (
                <Badge variant="outline">+{alertas.length - 5} más</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar por código o nombre..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select
              value={filters.categoria_id || 'all'}
              onValueChange={(value) =>
                setFilters({ ...filters, categoria_id: value === 'all' ? undefined : value })
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categorias?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={filters.solo_stock_bajo ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  setFilters({
                    ...filters,
                    solo_stock_bajo: !filters.solo_stock_bajo,
                    solo_sin_stock: false,
                  })
                }
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                Stock Bajo
              </Button>
              <Button
                type="button"
                variant={filters.solo_sin_stock ? 'destructive' : 'outline'}
                size="sm"
                onClick={() =>
                  setFilters({
                    ...filters,
                    solo_sin_stock: !filters.solo_sin_stock,
                    solo_stock_bajo: false,
                  })
                }
              >
                Sin Stock
              </Button>
            </div>

            <Button type="submit">
              <Filter className="h-4 w-4 mr-2" />
              Filtrar
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Código
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Categoría
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Stock Actual
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Stock Mín.
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Valor
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      Cargando...
                    </td>
                  </tr>
                ) : data?.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      No se encontraron insumos
                    </td>
                  </tr>
                ) : (
                  data?.items.map((insumo) => (
                    <tr key={insumo.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/stock/insumos/${insumo.id}`)}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm">{insumo.codigo}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{insumo.nombre}</p>
                          {insumo.ubicacion_deposito && (
                            <p className="text-xs text-gray-500">
                              Ubicación: {insumo.ubicacion_deposito}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {insumo.categoria_nombre || '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatNumber(insumo.stock_actual, 2)} {insumo.unidad}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {formatNumber(insumo.stock_minimo, 2)} {insumo.unidad}
                      </td>
                      <td className="px-4 py-3 text-center">{getStockBadge(insumo)}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        {formatCurrency(insumo.valor_stock)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate(`/stock/insumos/${insumo.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalle
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => navigate(`/stock/insumos/${insumo.id}/editar`)}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => navigate(`/stock/insumos/${insumo.id}/ajuste`)}
                            >
                              <ArrowUpDown className="h-4 w-4 mr-2" />
                              Ajustar Stock
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                if (confirm('¿Está seguro de eliminar este insumo?')) {
                                  deleteMutation.mutate(insumo.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {data && data.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-gray-500">
                Mostrando {(page - 1) * limit + 1} a{' '}
                {Math.min(page * limit, data.total)} de {data.total} insumos
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === data.pages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
