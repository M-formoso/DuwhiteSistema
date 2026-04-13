/**
 * Lista de Productos de Lavado (Servicios)
 * Muestra el catálogo de productos que se pueden lavar
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Tag,
  Scale,
  MoreHorizontal,
  Filter,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

import { productoLavadoService } from '@/services/productoLavadoService';
import {
  ProductoLavado,
  ProductoLavadoCreate,
  CategoriaProductoLavado,
  CATEGORIAS_PRODUCTO_LAVADO,
} from '@/types/produccion-v2';

export default function ServiciosList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productoEditar, setProductoEditar] = useState<ProductoLavado | null>(null);
  const [productoEliminar, setProductoEliminar] = useState<ProductoLavado | null>(null);

  // Form state
  const [formData, setFormData] = useState<ProductoLavadoCreate>({
    codigo: '',
    nombre: '',
    descripcion: '',
    categoria: 'otros',
    peso_promedio_kg: undefined,
  });

  // Query productos
  const { data: productos = [], isLoading } = useQuery<ProductoLavado[]>({
    queryKey: ['productos-lavado', search, filtroCategoria],
    queryFn: () =>
      productoLavadoService.getAll({
        search: search || undefined,
        categoria: filtroCategoria !== 'all' ? (filtroCategoria as CategoriaProductoLavado) : undefined,
      }),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: productoLavadoService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos-lavado'] });
      toast.success('Producto creado correctamente');
      handleCloseModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al crear producto');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductoLavadoCreate> }) =>
      productoLavadoService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos-lavado'] });
      toast.success('Producto actualizado correctamente');
      handleCloseModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al actualizar');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: productoLavadoService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos-lavado'] });
      toast.success('Producto eliminado correctamente');
      setDeleteDialogOpen(false);
      setProductoEliminar(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al eliminar');
    },
  });

  const handleOpenModal = (producto?: ProductoLavado) => {
    if (producto) {
      setProductoEditar(producto);
      setFormData({
        codigo: producto.codigo,
        nombre: producto.nombre,
        descripcion: producto.descripcion || '',
        categoria: producto.categoria as CategoriaProductoLavado,
        peso_promedio_kg: producto.peso_promedio_kg || undefined,
      });
    } else {
      setProductoEditar(null);
      setFormData({
        codigo: '',
        nombre: '',
        descripcion: '',
        categoria: 'otros',
        peso_promedio_kg: undefined,
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setProductoEditar(null);
  };

  const handleSubmit = () => {
    if (!formData.codigo || !formData.nombre) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    const payload = {
      ...formData,
      codigo: formData.codigo.toUpperCase(),
    };

    if (productoEditar) {
      updateMutation.mutate({ id: productoEditar.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (producto: ProductoLavado) => {
    setProductoEliminar(producto);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (productoEliminar) {
      deleteMutation.mutate(productoEliminar.id);
    }
  };

  const getCategoriaLabel = (categoria: string) => {
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

  return (
    <div className="space-y-4">
      {/* Header con búsqueda y acciones */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Servicio
        </Button>
      </div>

      {/* Filtros */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-4">
              <div className="w-48">
                <Label>Categoría</Label>
                <Select
                  value={filtroCategoria}
                  onValueChange={setFiltroCategoria}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {CATEGORIAS_PRODUCTO_LAVADO.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : productos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay servicios registrados</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => handleOpenModal()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear primer servicio
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Peso Prom.</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productos.map((producto) => (
                  <TableRow key={producto.id}>
                    <TableCell className="font-mono font-medium">
                      {producto.codigo}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{producto.nombre}</p>
                        {producto.descripcion && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">
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
                      {producto.peso_promedio_kg ? (
                        <span className="flex items-center justify-end gap-1">
                          <Scale className="h-3 w-3 text-muted-foreground" />
                          {producto.peso_promedio_kg} kg
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={producto.activo ? 'default' : 'secondary'}>
                        {producto.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenModal(producto)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(producto)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de creación/edición */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {productoEditar ? 'Editar Servicio' : 'Nuevo Servicio'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código *</Label>
                <Input
                  value={formData.codigo}
                  onChange={(e) =>
                    setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
                  }
                  placeholder="TOA-001"
                />
              </div>
              <div>
                <Label>Categoría *</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(v) =>
                    setFormData({ ...formData, categoria: v as CategoriaProductoLavado })
                  }
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
              </div>
            </div>

            <div>
              <Label>Nombre *</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Toalla Grande"
              />
            </div>

            <div>
              <Label>Descripción</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) =>
                  setFormData({ ...formData, descripcion: e.target.value })
                }
                placeholder="Descripción del producto..."
                rows={2}
              />
            </div>

            <div>
              <Label>Peso Promedio (kg)</Label>
              <div className="relative">
                <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={formData.peso_promedio_kg || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      peso_promedio_kg: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                  className="pl-9"
                  placeholder="0.400"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Peso promedio por unidad para estimaciones
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {productoEditar ? 'Guardar Cambios' : 'Crear Servicio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación de eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Servicio</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar el servicio "{productoEliminar?.nombre}"? Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
