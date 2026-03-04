/**
 * Lista de Servicios con CRUD
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Tag,
  Clock,
  DollarSign,
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
  servicioService,
  Servicio,
  ServicioCreate,
  ServicioUpdate,
  TipoServicio,
  UnidadCobro,
} from '@/services/servicioService';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
};

export default function ServiciosList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [showFilters, setShowFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [servicioEditar, setServicioEditar] = useState<Servicio | null>(null);
  const [servicioEliminar, setServicioEliminar] = useState<Servicio | null>(null);

  // Form state
  const [formData, setFormData] = useState<ServicioCreate>({
    codigo: '',
    nombre: '',
    descripcion: '',
    tipo: 'lavado_normal',
    categoria: '',
    unidad_cobro: 'kg',
    precio_base: 0,
    tiempo_estimado_minutos: undefined,
    mostrar_en_web: false,
    orden: 0,
    notas: '',
  });

  // Queries
  const { data: serviciosData, isLoading } = useQuery({
    queryKey: ['servicios', search, filtroTipo],
    queryFn: () =>
      servicioService.listar({
        search: search || undefined,
        tipo: filtroTipo !== 'todos' ? filtroTipo : undefined,
        limit: 100,
      }),
  });

  const { data: tipos = [] } = useQuery({
    queryKey: ['tipos-servicio'],
    queryFn: () => servicioService.getTipos(),
  });

  const { data: unidadesCobro = [] } = useQuery({
    queryKey: ['unidades-cobro'],
    queryFn: () => servicioService.getUnidadesCobro(),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: servicioService.crear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicios'] });
      toast.success('Servicio creado correctamente');
      handleCloseModal();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al crear servicio');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ServicioUpdate }) =>
      servicioService.actualizar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicios'] });
      toast.success('Servicio actualizado correctamente');
      handleCloseModal();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar servicio');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: servicioService.eliminar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicios'] });
      toast.success('Servicio eliminado correctamente');
      setDeleteDialogOpen(false);
      setServicioEliminar(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar servicio');
    },
  });

  const handleOpenModal = (servicio?: Servicio) => {
    if (servicio) {
      setServicioEditar(servicio);
      setFormData({
        codigo: servicio.codigo,
        nombre: servicio.nombre,
        descripcion: servicio.descripcion || '',
        tipo: servicio.tipo,
        categoria: servicio.categoria || '',
        unidad_cobro: servicio.unidad_cobro,
        precio_base: servicio.precio_base,
        tiempo_estimado_minutos: servicio.tiempo_estimado_minutos,
        mostrar_en_web: servicio.mostrar_en_web,
        orden: servicio.orden,
        notas: servicio.notas || '',
      });
    } else {
      setServicioEditar(null);
      setFormData({
        codigo: '',
        nombre: '',
        descripcion: '',
        tipo: 'lavado_normal',
        categoria: '',
        unidad_cobro: 'kg',
        precio_base: 0,
        tiempo_estimado_minutos: undefined,
        mostrar_en_web: false,
        orden: 0,
        notas: '',
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setServicioEditar(null);
  };

  const handleSubmit = () => {
    if (!formData.codigo || !formData.nombre || formData.precio_base <= 0) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    if (servicioEditar) {
      updateMutation.mutate({ id: servicioEditar.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (servicio: Servicio) => {
    setServicioEliminar(servicio);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (servicioEliminar) {
      deleteMutation.mutate(servicioEliminar.id);
    }
  };

  const getTipoLabel = (tipo: string) => {
    const found = tipos.find((t) => t.value === tipo);
    return found?.label || tipo;
  };

  const getUnidadLabel = (unidad: string) => {
    const found = unidadesCobro.find((u) => u.value === unidad);
    return found?.label || unidad;
  };

  const servicios = serviciosData?.items || [];

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
                <Label>Tipo</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {tipos.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
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
          ) : servicios.length === 0 ? (
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
                  <TableHead>Tipo</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Precio Base</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicios.map((servicio) => (
                  <TableRow key={servicio.id}>
                    <TableCell className="font-medium">{servicio.codigo}</TableCell>
                    <TableCell>{servicio.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTipoLabel(servicio.tipo)}</Badge>
                    </TableCell>
                    <TableCell>{getUnidadLabel(servicio.unidad_cobro)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(servicio.precio_base)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={servicio.activo ? 'success' : 'secondary'}>
                        {servicio.activo ? 'Activo' : 'Inactivo'}
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
                          <DropdownMenuItem onClick={() => handleOpenModal(servicio)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(servicio)}
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
              {servicioEditar ? 'Editar Servicio' : 'Nuevo Servicio'}
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
                  placeholder="SRV001"
                />
              </div>
              <div>
                <Label>Orden</Label>
                <Input
                  type="number"
                  value={formData.orden}
                  onChange={(e) =>
                    setFormData({ ...formData, orden: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div>
              <Label>Nombre *</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Lavado Normal"
              />
            </div>

            <div>
              <Label>Descripcion</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) =>
                  setFormData({ ...formData, descripcion: e.target.value })
                }
                placeholder="Descripcion del servicio..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(v) => setFormData({ ...formData, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tipos.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Input
                  value={formData.categoria}
                  onChange={(e) =>
                    setFormData({ ...formData, categoria: e.target.value })
                  }
                  placeholder="Ej: Ropa blanca"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Unidad de Cobro</Label>
                <Select
                  value={formData.unidad_cobro}
                  onValueChange={(v) => setFormData({ ...formData, unidad_cobro: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {unidadesCobro.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Precio Base *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precio_base}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        precio_base: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Tiempo Estimado (minutos)</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  value={formData.tiempo_estimado_minutos || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tiempo_estimado_minutos: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  className="pl-9"
                  placeholder="Ej: 60"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Mostrar en Web</Label>
              <Switch
                checked={formData.mostrar_en_web}
                onCheckedChange={(v) =>
                  setFormData({ ...formData, mostrar_en_web: v })
                }
              />
            </div>

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
              {servicioEditar ? 'Guardar Cambios' : 'Crear Servicio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmacion de eliminacion */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Servicio</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estas seguro de eliminar el servicio "{servicioEliminar?.nombre}"? Esta
              accion no se puede deshacer.
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
