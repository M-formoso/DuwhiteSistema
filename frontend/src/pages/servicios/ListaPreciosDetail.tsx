/**
 * Detalle de Lista de Precios con gestión de productos de lavado
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  Tag,
  Scale,
} from 'lucide-react';

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

import { listaPreciosService, ListaPreciosConItems } from '@/services/servicioService';
import { productoLavadoService } from '@/services/productoLavadoService';
import {
  ProductoLavado,
  PrecioProductoLavado,
  CATEGORIAS_PRODUCTO_LAVADO,
} from '@/types/produccion-v2';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
};

interface PrecioConProducto extends PrecioProductoLavado {
  producto?: ProductoLavado;
}

export default function ListaPreciosDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [precioEditar, setPrecioEditar] = useState<PrecioConProducto | null>(null);
  const [precioEliminar, setPrecioEliminar] = useState<PrecioConProducto | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    producto_id: '',
    precio_unitario: 0,
  });

  // Query lista de precios (datos básicos)
  const { data: lista, isLoading: isLoadingLista } = useQuery<ListaPreciosConItems>({
    queryKey: ['lista-precios', id],
    queryFn: () => listaPreciosService.obtener(id!),
    enabled: !!id,
  });

  // Query todos los productos de lavado
  const { data: productos = [] } = useQuery<ProductoLavado[]>({
    queryKey: ['productos-lavado'],
    queryFn: () => productoLavadoService.getAll({ solo_activos: true }),
  });

  // Query precios de productos para esta lista
  const { data: precios = [], isLoading: isLoadingPrecios } = useQuery<PrecioProductoLavado[]>({
    queryKey: ['precios-productos-lavado', id],
    queryFn: () => productoLavadoService.getPreciosLista(id!),
    enabled: !!id,
  });

  // Combinar precios con datos del producto
  const preciosConProducto: PrecioConProducto[] = precios.map((precio) => ({
    ...precio,
    producto: productos.find((p) => p.id === precio.producto_id),
  }));

  // Productos que aún no tienen precio en esta lista
  const productosConPrecio = new Set(precios.map((p) => p.producto_id));
  const productosSinPrecio = productos.filter((p) => !productosConPrecio.has(p.id));

  // Mutation: Establecer/actualizar precio
  const setPrecioMutation = useMutation({
    mutationFn: (data: { lista_precios_id: string; producto_id: string; precio_unitario: number }) =>
      productoLavadoService.setPrecio(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['precios-productos-lavado', id] });
      toast.success(precioEditar ? 'Precio actualizado' : 'Precio agregado');
      handleCloseModal();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al guardar precio');
    },
  });

  // Mutation: Eliminar precio (soft delete en backend)
  const deletePrecioMutation = useMutation({
    mutationFn: async (precioId: string) => {
      // El backend hace soft delete al establecer precio en 0 o desactivar
      // Por ahora solo invalidamos y recargamos
      // Idealmente se necesitaría un endpoint DELETE /precios/{id}
      toast.info('Funcionalidad de eliminar precio no disponible aún');
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['precios-productos-lavado', id] });
      setDeleteDialogOpen(false);
      setPrecioEliminar(null);
    },
  });

  const handleOpenModal = (precio?: PrecioConProducto) => {
    if (precio) {
      setPrecioEditar(precio);
      setFormData({
        producto_id: precio.producto_id,
        precio_unitario: Number(precio.precio_unitario),
      });
    } else {
      setPrecioEditar(null);
      setFormData({
        producto_id: '',
        precio_unitario: 0,
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setPrecioEditar(null);
  };

  const handleSubmit = () => {
    if (!formData.producto_id || formData.precio_unitario <= 0) {
      toast.error('Selecciona un producto y define un precio válido');
      return;
    }

    setPrecioMutation.mutate({
      lista_precios_id: id!,
      producto_id: formData.producto_id,
      precio_unitario: formData.precio_unitario,
    });
  };

  const handleDelete = (precio: PrecioConProducto) => {
    setPrecioEliminar(precio);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (precioEliminar) {
      deletePrecioMutation.mutate(precioEliminar.id);
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

  const isLoading = isLoadingLista || isLoadingPrecios;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!lista) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Lista de precios no encontrada</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/servicios')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">{lista.nombre}</h1>
          <p className="text-text-secondary">
            {lista.codigo} - {lista.es_lista_base ? 'Lista Base' : 'Lista Derivada'}
          </p>
        </div>
      </div>

      {/* Info de la lista */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Tipo</p>
              <Badge variant={lista.es_lista_base ? 'default' : 'outline'}>
                {lista.es_lista_base ? 'Base' : 'Derivada'}
              </Badge>
            </div>
            {lista.lista_base_nombre && (
              <div>
                <p className="text-sm text-muted-foreground">Lista Base</p>
                <p className="font-medium">{lista.lista_base_nombre}</p>
              </div>
            )}
            {lista.porcentaje_modificador !== null &&
              lista.porcentaje_modificador !== undefined && (
                <div>
                  <p className="text-sm text-muted-foreground">Modificador</p>
                  <p
                    className={`font-medium ${
                      lista.porcentaje_modificador >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {lista.porcentaje_modificador >= 0 ? '+' : ''}
                    {lista.porcentaje_modificador}%
                  </p>
                </div>
              )}
            <div>
              <p className="text-sm text-muted-foreground">Productos con Precio</p>
              <p className="font-medium">{precios.length} / {productos.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              <Badge variant={lista.activa ? 'default' : 'secondary'}>
                {lista.activa ? 'Activa' : 'Inactiva'}
              </Badge>
            </div>
          </div>
          {lista.descripcion && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Descripción</p>
              <p>{lista.descripcion}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Precios de Productos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Precios de Productos de Lavado</CardTitle>
          <Button onClick={() => handleOpenModal()} disabled={productosSinPrecio.length === 0}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar Producto
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {preciosConProducto.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay productos con precio en esta lista</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => handleOpenModal()}
                disabled={productosSinPrecio.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar primer producto
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Peso Prom.</TableHead>
                  <TableHead className="text-right">Precio Unitario</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preciosConProducto.map((precio) => (
                  <TableRow key={precio.id}>
                    <TableCell className="font-mono font-medium">
                      {precio.producto?.codigo || '-'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{precio.producto?.nombre || 'Producto eliminado'}</p>
                        {precio.producto?.descripcion && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">
                            {precio.producto.descripcion}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {precio.producto && (
                        <Badge variant="outline" className={getCategoriaColor(precio.producto.categoria)}>
                          {getCategoriaLabel(precio.producto.categoria)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {precio.producto?.peso_promedio_kg ? (
                        <span className="flex items-center justify-end gap-1">
                          <Scale className="h-3 w-3 text-muted-foreground" />
                          {precio.producto.peso_promedio_kg} kg
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {formatCurrency(Number(precio.precio_unitario))}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenModal(precio)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal agregar/editar precio */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {precioEditar ? 'Editar Precio' : 'Agregar Producto a la Lista'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!precioEditar ? (
              <div>
                <Label>Producto *</Label>
                <Select
                  value={formData.producto_id || 'none'}
                  onValueChange={(v) => {
                    setFormData({
                      ...formData,
                      producto_id: v === 'none' ? '' : v,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>
                      Seleccionar producto
                    </SelectItem>
                    {productosSinPrecio.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo} - {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {productosSinPrecio.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Todos los productos ya tienen precio asignado
                  </p>
                )}
              </div>
            ) : (
              <div>
                <Label>Producto</Label>
                <Input
                  value={`${precioEditar.producto?.codigo} - ${precioEditar.producto?.nombre}`}
                  disabled
                />
              </div>
            )}

            <div>
              <Label>Precio Unitario *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.precio_unitario}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      precio_unitario: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="pl-9"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Precio por unidad de producto
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={setPrecioMutation.isPending}
            >
              {setPrecioMutation.isPending
                ? 'Guardando...'
                : precioEditar
                ? 'Guardar Cambios'
                : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación de eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Precio</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar el precio del producto "{precioEliminar?.producto?.nombre}"
              de esta lista?
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
