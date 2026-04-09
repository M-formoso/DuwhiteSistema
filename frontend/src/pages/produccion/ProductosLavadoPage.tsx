/**
 * Página de Catálogo de Productos de Lavado
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { productoLavadoService } from '@/services/productoLavadoService';
import {
  ProductoLavado,
  ProductoLavadoCreate,
  CategoriaProductoLavado,
  CATEGORIAS_PRODUCTO_LAVADO,
} from '@/types/produccion-v2';

const productoSchema = z.object({
  codigo: z.string().min(1, 'Código requerido').max(20),
  nombre: z.string().min(1, 'Nombre requerido').max(100),
  descripcion: z.string().optional(),
  categoria: z.string().min(1, 'Categoría requerida'),
  peso_promedio_kg: z.coerce.number().min(0).optional(),
});

type ProductoFormData = z.infer<typeof productoSchema>;

export default function ProductosLavadoPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingProducto, setEditingProducto] = useState<ProductoLavado | null>(null);
  const [deleteProducto, setDeleteProducto] = useState<ProductoLavado | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductoFormData>({
    resolver: zodResolver(productoSchema),
    defaultValues: {
      categoria: 'otros',
    },
  });

  // Query: Lista de productos
  const { data: productos = [], isLoading } = useQuery<ProductoLavado[]>({
    queryKey: ['productos-lavado', search, categoriaFiltro],
    queryFn: () =>
      productoLavadoService.getAll({
        search: search || undefined,
        categoria: categoriaFiltro as CategoriaProductoLavado || undefined,
      }),
  });

  // Mutation: Crear producto
  const createMutation = useMutation({
    mutationFn: (data: ProductoLavadoCreate) => productoLavadoService.create(data),
    onSuccess: () => {
      toast.success('Producto creado');
      queryClient.invalidateQueries({ queryKey: ['productos-lavado'] });
      handleCloseModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al crear producto');
    },
  });

  // Mutation: Actualizar producto
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductoLavadoCreate> }) =>
      productoLavadoService.update(id, data),
    onSuccess: () => {
      toast.success('Producto actualizado');
      queryClient.invalidateQueries({ queryKey: ['productos-lavado'] });
      handleCloseModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al actualizar');
    },
  });

  // Mutation: Eliminar producto
  const deleteMutation = useMutation({
    mutationFn: (id: string) => productoLavadoService.delete(id),
    onSuccess: () => {
      toast.success('Producto eliminado');
      queryClient.invalidateQueries({ queryKey: ['productos-lavado'] });
      setDeleteProducto(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al eliminar');
    },
  });

  const handleOpenCreate = () => {
    setEditingProducto(null);
    reset({
      codigo: '',
      nombre: '',
      descripcion: '',
      categoria: 'otros',
      peso_promedio_kg: undefined,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (producto: ProductoLavado) => {
    setEditingProducto(producto);
    reset({
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      categoria: producto.categoria,
      peso_promedio_kg: producto.peso_promedio_kg || undefined,
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProducto(null);
    reset();
  };

  const onSubmit = (data: ProductoFormData) => {
    const payload: ProductoLavadoCreate = {
      codigo: data.codigo.toUpperCase(),
      nombre: data.nombre,
      descripcion: data.descripcion || undefined,
      categoria: data.categoria as CategoriaProductoLavado,
      peso_promedio_kg: data.peso_promedio_kg || undefined,
    };

    if (editingProducto) {
      updateMutation.mutate({ id: editingProducto.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getCategoriaLabel = (categoria: string): string => {
    return CATEGORIAS_PRODUCTO_LAVADO.find((c) => c.value === categoria)?.label || categoria;
  };

  const getCategoriaColor = (categoria: string): string => {
    const colors: Record<string, string> = {
      toallas: 'bg-blue-100 text-blue-800',
      ropa_cama: 'bg-purple-100 text-purple-800',
      manteleria: 'bg-green-100 text-green-800',
      alfombras: 'bg-amber-100 text-amber-800',
      cortinas: 'bg-pink-100 text-pink-800',
      otros: 'bg-gray-100 text-gray-800',
    };
    return colors[categoria] || colors.otros;
  };

  // Agrupar productos por categoría para mostrar
  const productosPorCategoria = CATEGORIAS_PRODUCTO_LAVADO.map((cat) => ({
    ...cat,
    productos: productos.filter((p) => p.categoria === cat.value),
    count: productos.filter((p) => p.categoria === cat.value).length,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos de Lavado</h1>
          <p className="text-gray-500 text-sm mt-1">
            Catálogo de prendas para el proceso de conteo y facturación
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Producto
        </Button>
      </div>

      {/* Resumen por categoría */}
      <div className="grid grid-cols-6 gap-3">
        {productosPorCategoria.map((cat) => (
          <Card
            key={cat.value}
            className={`cursor-pointer transition-all ${
              categoriaFiltro === cat.value ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setCategoriaFiltro(categoriaFiltro === cat.value ? '' : cat.value)}
          >
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{cat.count}</p>
              <p className="text-xs text-gray-500">{cat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por código o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas las categorías</SelectItem>
                {CATEGORIAS_PRODUCTO_LAVADO.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de productos */}
      <Card>
        <CardHeader>
          <CardTitle>Productos ({productos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-32">Categoría</TableHead>
                <TableHead className="w-32 text-right">Peso Prom.</TableHead>
                <TableHead className="w-20 text-center">Estado</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : productos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No se encontraron productos
                  </TableCell>
                </TableRow>
              ) : (
                productos.map((producto) => (
                  <TableRow key={producto.id}>
                    <TableCell className="font-mono font-medium">{producto.codigo}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{producto.nombre}</p>
                        {producto.descripcion && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">
                            {producto.descripcion}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getCategoriaColor(producto.categoria)}>
                        {getCategoriaLabel(producto.categoria)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {producto.peso_promedio_kg
                        ? `${producto.peso_promedio_kg} kg`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={producto.activo ? 'default' : 'secondary'}>
                        {producto.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(producto)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setDeleteProducto(producto)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Crear/Editar */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProducto ? 'Editar Producto' : 'Nuevo Producto'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código *</Label>
                <Input
                  {...register('codigo')}
                  placeholder="TOA-GR"
                  className="uppercase"
                />
                {errors.codigo && (
                  <p className="text-sm text-red-500 mt-1">{errors.codigo.message}</p>
                )}
              </div>
              <div>
                <Label>Categoría *</Label>
                <Select
                  value={watch('categoria')}
                  onValueChange={(v) => setValue('categoria', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_PRODUCTO_LAVADO.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.categoria && (
                  <p className="text-sm text-red-500 mt-1">{errors.categoria.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label>Nombre *</Label>
              <Input {...register('nombre')} placeholder="Toalla grande" />
              {errors.nombre && (
                <p className="text-sm text-red-500 mt-1">{errors.nombre.message}</p>
              )}
            </div>

            <div>
              <Label>Descripción</Label>
              <Textarea
                {...register('descripcion')}
                placeholder="Descripción opcional del producto"
                rows={2}
              />
            </div>

            <div>
              <Label>Peso Promedio (kg)</Label>
              <Input
                {...register('peso_promedio_kg')}
                type="number"
                step="0.001"
                min="0"
                placeholder="0.350"
              />
              <p className="text-xs text-gray-500 mt-1">
                Peso aproximado para estimaciones
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Guardando...'
                  : editingProducto
                  ? 'Actualizar'
                  : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmación de Eliminación */}
      <AlertDialog open={!!deleteProducto} onOpenChange={() => setDeleteProducto(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se desactivará el producto "{deleteProducto?.nombre}" ({deleteProducto?.codigo}).
              Esta acción se puede revertir desde la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteProducto && deleteMutation.mutate(deleteProducto.id)}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
