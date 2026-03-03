/**
 * Lista de Proveedores
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Truck,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Package,
  FileText,
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

import { proveedorService } from '@/services/proveedorService';
import { formatCuit } from '@/utils/formatters';
import { RUBROS_PROVEEDOR } from '@/types/proveedor';

export default function ProveedoresList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [rubro, setRubro] = useState<string>('');
  const [soloActivos, setSoloActivos] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Cargar proveedores
  const { data, isLoading } = useQuery({
    queryKey: ['proveedores', { page, search, rubro, soloActivos }],
    queryFn: () =>
      proveedorService.getProveedores({
        skip: (page - 1) * limit,
        limit,
        search: search || undefined,
        rubro: rubro || undefined,
        solo_activos: soloActivos,
      }),
  });

  // Eliminar proveedor
  const deleteMutation = useMutation({
    mutationFn: (id: string) => proveedorService.deleteProveedor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      toast({
        title: 'Proveedor eliminado',
        description: 'El proveedor ha sido eliminado correctamente.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el proveedor.',
        variant: 'destructive',
      });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-gray-500">Gestión de proveedores y catálogo de productos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/proveedores/ordenes')}>
            <FileText className="h-4 w-4 mr-2" />
            Órdenes de Compra
          </Button>
          <Button onClick={() => navigate('/proveedores/nuevo')}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Proveedor
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar por razón social, nombre o CUIT..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={rubro || "all"} onValueChange={(value) => setRubro(value === "all" ? "" : value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos los rubros" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los rubros</SelectItem>
                {RUBROS_PROVEEDOR.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant={soloActivos ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSoloActivos(!soloActivos)}
            >
              Solo Activos
            </Button>

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
                    Proveedor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    CUIT
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Contacto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Rubro
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Productos
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Cargando...
                    </td>
                  </tr>
                ) : data?.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      <Truck className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      No se encontraron proveedores
                    </td>
                  </tr>
                ) : (
                  data?.items.map((proveedor) => (
                    <tr key={proveedor.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{proveedor.razon_social}</p>
                          {proveedor.nombre_fantasia && (
                            <p className="text-sm text-gray-500">
                              {proveedor.nombre_fantasia}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {formatCuit(proveedor.cuit)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {proveedor.telefono && <p>{proveedor.telefono}</p>}
                          {proveedor.email && (
                            <p className="text-gray-500">{proveedor.email}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {proveedor.rubro || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Package className="h-4 w-4 text-gray-400" />
                          {proveedor.cantidad_productos || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={proveedor.activo ? 'success' : 'secondary'}>
                          {proveedor.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
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
                              onClick={() => navigate(`/proveedores/${proveedor.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalle
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => navigate(`/proveedores/${proveedor.id}/editar`)}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => navigate(`/proveedores/${proveedor.id}/productos`)}
                            >
                              <Package className="h-4 w-4 mr-2" />
                              Ver Productos
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                navigate(`/proveedores/ordenes/nueva?proveedor=${proveedor.id}`)
                              }
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Nueva Orden
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                if (confirm('¿Está seguro de eliminar este proveedor?')) {
                                  deleteMutation.mutate(proveedor.id);
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
                {Math.min(page * limit, data.total)} de {data.total} proveedores
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
