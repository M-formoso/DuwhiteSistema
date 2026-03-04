/**
 * Lista de Listas de Precios con CRUD
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  List,
  MoreHorizontal,
  Eye,
  Percent,
  RefreshCw,
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
  DropdownMenuSeparator,
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
import { Switch } from '@/components/ui/switch';
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
  ListaPrecios,
  ListaPreciosCreate,
  ListaPreciosUpdate,
} from '@/services/servicioService';

export default function ListasPreciosList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [listaEditar, setListaEditar] = useState<ListaPrecios | null>(null);
  const [listaEliminar, setListaEliminar] = useState<ListaPrecios | null>(null);

  // Form state
  const [formData, setFormData] = useState<ListaPreciosCreate>({
    codigo: '',
    nombre: '',
    descripcion: '',
    es_lista_base: false,
    lista_base_id: undefined,
    porcentaje_modificador: undefined,
    notas: '',
  });

  // Queries
  const { data: listasData, isLoading } = useQuery({
    queryKey: ['listas-precios', search],
    queryFn: () =>
      listaPreciosService.listar({
        search: search || undefined,
        limit: 100,
      }),
  });

  const { data: listasBase = [] } = useQuery({
    queryKey: ['listas-precios-base'],
    queryFn: async () => {
      const response = await listaPreciosService.listar({ es_lista_base: true });
      return response.items;
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: listaPreciosService.crear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listas-precios'] });
      toast.success('Lista de precios creada correctamente');
      handleCloseModal();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al crear lista de precios');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ListaPreciosUpdate }) =>
      listaPreciosService.actualizar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listas-precios'] });
      toast.success('Lista de precios actualizada correctamente');
      handleCloseModal();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar lista de precios');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: listaPreciosService.eliminar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listas-precios'] });
      toast.success('Lista de precios eliminada correctamente');
      setDeleteDialogOpen(false);
      setListaEliminar(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar lista de precios');
    },
  });

  const aplicarModificadorMutation = useMutation({
    mutationFn: listaPreciosService.aplicarModificador,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['listas-precios'] });
      toast.success(`Se actualizaron ${data.items_actualizados} items`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al aplicar modificador');
    },
  });

  const handleOpenModal = (lista?: ListaPrecios) => {
    if (lista) {
      setListaEditar(lista);
      setFormData({
        codigo: lista.codigo,
        nombre: lista.nombre,
        descripcion: lista.descripcion || '',
        es_lista_base: lista.es_lista_base,
        lista_base_id: lista.lista_base_id || undefined,
        porcentaje_modificador: lista.porcentaje_modificador || undefined,
        notas: lista.notas || '',
      });
    } else {
      setListaEditar(null);
      setFormData({
        codigo: '',
        nombre: '',
        descripcion: '',
        es_lista_base: false,
        lista_base_id: undefined,
        porcentaje_modificador: undefined,
        notas: '',
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setListaEditar(null);
  };

  const handleSubmit = () => {
    if (!formData.codigo || !formData.nombre) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    if (listaEditar) {
      updateMutation.mutate({ id: listaEditar.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (lista: ListaPrecios) => {
    setListaEliminar(lista);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (listaEliminar) {
      deleteMutation.mutate(listaEliminar.id);
    }
  };

  const handleAplicarModificador = (lista: ListaPrecios) => {
    aplicarModificadorMutation.mutate(lista.id);
  };

  const listas = listasData?.items || [];

  return (
    <div className="space-y-4">
      {/* Header con busqueda y acciones */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por codigo o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Lista
        </Button>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : listas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <List className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay listas de precios registradas</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => handleOpenModal()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear primera lista
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Modificador</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listas.map((lista) => (
                  <TableRow key={lista.id}>
                    <TableCell className="font-medium">{lista.codigo}</TableCell>
                    <TableCell>{lista.nombre}</TableCell>
                    <TableCell>
                      <Badge variant={lista.es_lista_base ? 'default' : 'outline'}>
                        {lista.es_lista_base ? 'Base' : 'Derivada'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lista.porcentaje_modificador !== null &&
                      lista.porcentaje_modificador !== undefined ? (
                        <span
                          className={
                            lista.porcentaje_modificador >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }
                        >
                          {lista.porcentaje_modificador >= 0 ? '+' : ''}
                          {lista.porcentaje_modificador}%
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{lista.cantidad_items}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={lista.activa ? 'success' : 'secondary'}>
                        {lista.activa ? 'Activa' : 'Inactiva'}
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
                          <DropdownMenuItem
                            onClick={() => navigate(`/servicios/listas/${lista.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalle
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenModal(lista)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          {!lista.es_lista_base && lista.lista_base_id && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleAplicarModificador(lista)}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Aplicar Modificador
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(lista)}
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

      {/* Modal de creacion/edicion */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {listaEditar ? 'Editar Lista de Precios' : 'Nueva Lista de Precios'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Codigo *</Label>
                <Input
                  value={formData.codigo}
                  onChange={(e) =>
                    setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
                  }
                  placeholder="LP001"
                />
              </div>
              <div className="flex items-center justify-between pt-6">
                <Label>Es Lista Base</Label>
                <Switch
                  checked={formData.es_lista_base}
                  onCheckedChange={(v) =>
                    setFormData({
                      ...formData,
                      es_lista_base: v,
                      lista_base_id: v ? undefined : formData.lista_base_id,
                      porcentaje_modificador: v
                        ? undefined
                        : formData.porcentaje_modificador,
                    })
                  }
                />
              </div>
            </div>

            <div>
              <Label>Nombre *</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Lista General"
              />
            </div>

            <div>
              <Label>Descripcion</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) =>
                  setFormData({ ...formData, descripcion: e.target.value })
                }
                placeholder="Descripcion de la lista..."
                rows={2}
              />
            </div>

            {!formData.es_lista_base && (
              <>
                <div>
                  <Label>Lista Base</Label>
                  <Select
                    value={formData.lista_base_id || 'none'}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
                        lista_base_id: v === 'none' ? undefined : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar lista base" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin lista base</SelectItem>
                      {listasBase.map((lb) => (
                        <SelectItem key={lb.id} value={lb.id}>
                          {lb.codigo} - {lb.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.lista_base_id && (
                  <div>
                    <Label>Porcentaje Modificador</Label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.porcentaje_modificador || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            porcentaje_modificador: e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          })
                        }
                        className="pl-9"
                        placeholder="Ej: 10 para +10%, -5 para -5%"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Valores positivos aumentan el precio, negativos lo reducen
                    </p>
                  </div>
                )}
              </>
            )}

            <div>
              <Label>Notas</Label>
              <Textarea
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Notas internas..."
                rows={2}
              />
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
              {listaEditar ? 'Guardar Cambios' : 'Crear Lista'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmacion de eliminacion */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Lista de Precios</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estas seguro de eliminar la lista "{listaEliminar?.nombre}"? Esta accion
              no se puede deshacer.
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
