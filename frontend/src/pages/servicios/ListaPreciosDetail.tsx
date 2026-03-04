/**
 * Detalle de Lista de Precios con gestion de items
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
  Search,
  RefreshCw,
  Tag,
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

import {
  listaPreciosService,
  servicioService,
  ItemListaPrecios,
  ItemListaPreciosCreate,
  ItemListaPreciosUpdate,
  Servicio,
} from '@/services/servicioService';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
};

export default function ListaPreciosDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchServicio, setSearchServicio] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemEditar, setItemEditar] = useState<ItemListaPrecios | null>(null);
  const [itemEliminar, setItemEliminar] = useState<ItemListaPrecios | null>(null);

  // Form state
  const [formData, setFormData] = useState<ItemListaPreciosCreate>({
    servicio_id: '',
    precio: 0,
    precio_minimo: undefined,
    cantidad_minima: undefined,
  });

  // Queries
  const { data: lista, isLoading } = useQuery({
    queryKey: ['lista-precios', id],
    queryFn: () => listaPreciosService.obtener(id!),
    enabled: !!id,
  });

  const { data: serviciosDisponibles = [] } = useQuery({
    queryKey: ['servicios-busqueda', searchServicio],
    queryFn: () => servicioService.buscar(searchServicio || '', 20),
    enabled: modalOpen && !itemEditar,
  });

  const { data: todosServicios = { items: [] } } = useQuery({
    queryKey: ['servicios-todos'],
    queryFn: () => servicioService.listar({ limit: 500 }),
  });

  // Mutations
  const agregarItemMutation = useMutation({
    mutationFn: (data: ItemListaPreciosCreate) =>
      listaPreciosService.agregarItem(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lista-precios', id] });
      toast.success('Item agregado correctamente');
      handleCloseModal();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al agregar item');
    },
  });

  const actualizarItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: ItemListaPreciosUpdate }) =>
      listaPreciosService.actualizarItem(id!, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lista-precios', id] });
      toast.success('Item actualizado correctamente');
      handleCloseModal();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar item');
    },
  });

  const eliminarItemMutation = useMutation({
    mutationFn: (itemId: string) => listaPreciosService.eliminarItem(id!, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lista-precios', id] });
      toast.success('Item eliminado correctamente');
      setDeleteDialogOpen(false);
      setItemEliminar(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar item');
    },
  });

  const aplicarModificadorMutation = useMutation({
    mutationFn: () => listaPreciosService.aplicarModificador(id!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lista-precios', id] });
      toast.success(`Se actualizaron ${data.items_actualizados} items`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al aplicar modificador');
    },
  });

  const handleOpenModal = (item?: ItemListaPrecios) => {
    if (item) {
      setItemEditar(item);
      setFormData({
        servicio_id: item.servicio_id,
        precio: item.precio,
        precio_minimo: item.precio_minimo || undefined,
        cantidad_minima: item.cantidad_minima || undefined,
      });
    } else {
      setItemEditar(null);
      setFormData({
        servicio_id: '',
        precio: 0,
        precio_minimo: undefined,
        cantidad_minima: undefined,
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setItemEditar(null);
    setSearchServicio('');
  };

  const handleSubmit = () => {
    if (!formData.servicio_id || formData.precio <= 0) {
      toast.error('Selecciona un servicio y define un precio');
      return;
    }

    if (itemEditar) {
      actualizarItemMutation.mutate({
        itemId: itemEditar.id,
        data: {
          precio: formData.precio,
          precio_minimo: formData.precio_minimo,
          cantidad_minima: formData.cantidad_minima,
        },
      });
    } else {
      agregarItemMutation.mutate(formData);
    }
  };

  const handleDelete = (item: ItemListaPrecios) => {
    setItemEliminar(item);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (itemEliminar) {
      eliminarItemMutation.mutate(itemEliminar.id);
    }
  };

  // Filtrar servicios que ya estan en la lista
  const serviciosEnLista = new Set(lista?.items.map((i) => i.servicio_id) || []);
  const serviciosFiltrados = serviciosDisponibles.filter(
    (s) => !serviciosEnLista.has(s.id)
  );

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
        {!lista.es_lista_base && lista.lista_base_id && (
          <Button
            variant="outline"
            onClick={() => aplicarModificadorMutation.mutate()}
            disabled={aplicarModificadorMutation.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Aplicar Modificador
          </Button>
        )}
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
              <p className="text-sm text-muted-foreground">Items</p>
              <p className="font-medium">{lista.items.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              <Badge variant={lista.activa ? 'success' : 'secondary'}>
                {lista.activa ? 'Activa' : 'Inactiva'}
              </Badge>
            </div>
          </div>
          {lista.descripcion && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Descripcion</p>
              <p>{lista.descripcion}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Precios de Servicios</CardTitle>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar Servicio
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {lista.items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay servicios en esta lista</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => handleOpenModal()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar primer servicio
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Precio Minimo</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.servicio_codigo}
                    </TableCell>
                    <TableCell>{item.servicio_nombre}</TableCell>
                    <TableCell>{item.servicio_unidad_cobro}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.precio)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.precio_minimo ? formatCurrency(item.precio_minimo) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenModal(item)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(item)}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Modal agregar/editar item */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {itemEditar ? 'Editar Precio' : 'Agregar Servicio a la Lista'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!itemEditar && (
              <div>
                <Label>Servicio *</Label>
                <Select
                  value={formData.servicio_id || 'none'}
                  onValueChange={(v) => {
                    const servicio = todosServicios.items.find((s) => s.id === v);
                    setFormData({
                      ...formData,
                      servicio_id: v === 'none' ? '' : v,
                      precio: servicio?.precio_base || 0,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>
                      Seleccionar servicio
                    </SelectItem>
                    {todosServicios.items
                      .filter((s) => !serviciosEnLista.has(s.id))
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.codigo} - {s.nombre} ({formatCurrency(s.precio_base)})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {itemEditar && (
              <div>
                <Label>Servicio</Label>
                <Input
                  value={`${itemEditar.servicio_codigo} - ${itemEditar.servicio_nombre}`}
                  disabled
                />
              </div>
            )}

            <div>
              <Label>Precio *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.precio}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      precio: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Precio Minimo</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precio_minimo || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        precio_minimo: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                    className="pl-9"
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div>
                <Label>Cantidad Minima</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cantidad_minima || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cantidad_minima: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="Opcional"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                agregarItemMutation.isPending || actualizarItemMutation.isPending
              }
            >
              {itemEditar ? 'Guardar Cambios' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmacion de eliminacion */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Item</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estas seguro de eliminar el servicio "{itemEliminar?.servicio_nombre}" de
              esta lista?
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
