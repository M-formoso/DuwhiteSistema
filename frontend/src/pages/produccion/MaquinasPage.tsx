/**
 * Página de Máquinas
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Cog,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Droplets,
  Scale,
  Calendar,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

import { produccionService } from '@/services/produccionService';
import { formatDate, formatCurrency } from '@/utils/formatters';
import type { Maquina } from '@/types/produccion';

interface FormData {
  codigo: string;
  nombre: string;
  tipo: string;
  marca: string;
  modelo: string;
  numero_serie: string;
  capacidad_kg: string;
  estado: string;
  ubicacion: string;
  costo_hora: string;
  consumo_energia_kwh: string;
  consumo_agua_litros: string;
  fecha_ultimo_mantenimiento: string;
  fecha_proximo_mantenimiento: string;
  horas_uso_totales: string;
  notas: string;
}

const initialFormData: FormData = {
  codigo: '',
  nombre: '',
  tipo: 'lavadora',
  marca: '',
  modelo: '',
  numero_serie: '',
  capacidad_kg: '',
  estado: 'disponible',
  ubicacion: '',
  costo_hora: '',
  consumo_energia_kwh: '',
  consumo_agua_litros: '',
  fecha_ultimo_mantenimiento: '',
  fecha_proximo_mantenimiento: '',
  horas_uso_totales: '0',
  notas: '',
};

const TIPOS_MAQUINA = [
  { value: 'lavadora', label: 'Lavadora' },
  { value: 'secadora', label: 'Secadora' },
  { value: 'centrifuga', label: 'Centrífuga' },
  { value: 'plancha', label: 'Plancha' },
  { value: 'caldera', label: 'Caldera' },
  { value: 'otro', label: 'Otro' },
];

const ESTADOS_MAQUINA = [
  { value: 'disponible', label: 'Disponible', color: 'success', icon: CheckCircle2 },
  { value: 'en_uso', label: 'En Uso', color: 'default', icon: Cog },
  { value: 'mantenimiento', label: 'En Mantenimiento', color: 'warning', icon: Wrench },
  { value: 'fuera_servicio', label: 'Fuera de Servicio', color: 'destructive', icon: XCircle },
];

export default function MaquinasPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMaquina, setEditingMaquina] = useState<Maquina | null>(null);
  const [deleteMaquina, setDeleteMaquina] = useState<Maquina | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [filterTipo, setFilterTipo] = useState<string>('');
  const [filterEstado, setFilterEstado] = useState<string>('');

  // Cargar máquinas
  const { data: maquinas, isLoading } = useQuery({
    queryKey: ['maquinas', filterTipo, filterEstado],
    queryFn: () =>
      produccionService.getMaquinas({
        tipo: filterTipo || undefined,
        estado: filterEstado || undefined,
      }),
  });

  // Crear máquina
  const createMutation = useMutation({
    mutationFn: (data: Partial<Maquina>) => produccionService.createMaquina(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maquinas'] });
      toast({ title: 'Máquina creada', description: 'La máquina se creó correctamente.' });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear la máquina.',
        variant: 'destructive',
      });
    },
  });

  // Actualizar máquina
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Maquina> }) =>
      produccionService.updateMaquina(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maquinas'] });
      toast({ title: 'Máquina actualizada', description: 'La máquina se actualizó correctamente.' });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar la máquina.',
        variant: 'destructive',
      });
    },
  });

  const handleOpenCreate = () => {
    setEditingMaquina(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (maquina: Maquina) => {
    setEditingMaquina(maquina);
    setFormData({
      codigo: maquina.codigo,
      nombre: maquina.nombre,
      tipo: maquina.tipo,
      marca: maquina.marca || '',
      modelo: maquina.modelo || '',
      numero_serie: maquina.numero_serie || '',
      capacidad_kg: maquina.capacidad_kg?.toString() || '',
      estado: maquina.estado,
      ubicacion: maquina.ubicacion || '',
      costo_hora: maquina.costo_hora?.toString() || '',
      consumo_energia_kwh: maquina.consumo_energia_kwh?.toString() || '',
      consumo_agua_litros: maquina.consumo_agua_litros?.toString() || '',
      fecha_ultimo_mantenimiento: maquina.fecha_ultimo_mantenimiento || '',
      fecha_proximo_mantenimiento: maquina.fecha_proximo_mantenimiento || '',
      horas_uso_totales: maquina.horas_uso_totales?.toString() || '0',
      notas: maquina.notas || '',
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingMaquina(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.codigo.trim()) {
      toast({ title: 'Error', description: 'El código es requerido.', variant: 'destructive' });
      return;
    }
    if (!formData.nombre.trim()) {
      toast({ title: 'Error', description: 'El nombre es requerido.', variant: 'destructive' });
      return;
    }

    const data: Partial<Maquina> = {
      codigo: formData.codigo.trim().toUpperCase(),
      nombre: formData.nombre.trim(),
      tipo: formData.tipo,
      marca: formData.marca.trim() || null,
      modelo: formData.modelo.trim() || null,
      numero_serie: formData.numero_serie.trim() || null,
      capacidad_kg: formData.capacidad_kg ? parseFloat(formData.capacidad_kg) : null,
      estado: formData.estado,
      ubicacion: formData.ubicacion.trim() || null,
      costo_hora: formData.costo_hora ? parseFloat(formData.costo_hora) : null,
      consumo_energia_kwh: formData.consumo_energia_kwh
        ? parseFloat(formData.consumo_energia_kwh)
        : null,
      consumo_agua_litros: formData.consumo_agua_litros
        ? parseFloat(formData.consumo_agua_litros)
        : null,
      fecha_ultimo_mantenimiento: formData.fecha_ultimo_mantenimiento || null,
      fecha_proximo_mantenimiento: formData.fecha_proximo_mantenimiento || null,
      horas_uso_totales: parseInt(formData.horas_uso_totales) || 0,
      notas: formData.notas.trim() || null,
    };

    if (editingMaquina) {
      updateMutation.mutate({ id: editingMaquina.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (deleteMaquina) {
      updateMutation.mutate({ id: deleteMaquina.id, data: { estado: 'fuera_servicio' } });
      setDeleteMaquina(null);
    }
  };

  const getEstadoConfig = (estado: string) => {
    return ESTADOS_MAQUINA.find((e) => e.value === estado) || ESTADOS_MAQUINA[0];
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Estadísticas
  const stats = {
    total: maquinas?.length || 0,
    disponibles: maquinas?.filter((m) => m.estado === 'disponible').length || 0,
    enUso: maquinas?.filter((m) => m.estado === 'en_uso').length || 0,
    mantenimiento: maquinas?.filter((m) => m.estado === 'mantenimiento').length || 0,
    requierenMantenimiento: maquinas?.filter((m) => m.requiere_mantenimiento).length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Máquinas</h1>
          <p className="text-gray-500">Gestiona el equipamiento de producción</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Máquina
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Máquinas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.disponibles}</div>
            <p className="text-xs text-muted-foreground">Disponibles</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{stats.enUso}</div>
            <p className="text-xs text-muted-foreground">En Uso</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.mantenimiento}</div>
            <p className="text-xs text-muted-foreground">En Mantenimiento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats.requierenMantenimiento}</div>
            <p className="text-xs text-muted-foreground">Requieren Mant.</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="w-48">
              <Select value={filterTipo || 'all'} onValueChange={(v) => setFilterTipo(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {TIPOS_MAQUINA.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={filterEstado || 'all'} onValueChange={(v) => setFilterEstado(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {ESTADOS_MAQUINA.map((estado) => (
                    <SelectItem key={estado.value} value={estado.value}>
                      {estado.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Máquinas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cog className="h-5 w-5" />
            Equipamiento
          </CardTitle>
          <CardDescription>{maquinas?.length || 0} máquinas registradas</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !maquinas || maquinas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Cog className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay máquinas registradas</p>
              <Button variant="outline" className="mt-4" onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Primera Máquina
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Capacidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Mantenimiento</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maquinas.map((maquina) => {
                    const estadoConfig = getEstadoConfig(maquina.estado);
                    const Icon = estadoConfig.icon;
                    return (
                      <TableRow key={maquina.id}>
                        <TableCell className="font-mono font-medium">{maquina.codigo}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{maquina.nombre}</p>
                            {maquina.marca && (
                              <p className="text-sm text-muted-foreground">
                                {maquina.marca} {maquina.modelo}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {TIPOS_MAQUINA.find((t) => t.value === maquina.tipo)?.label ||
                            maquina.tipo}
                        </TableCell>
                        <TableCell>
                          {maquina.capacidad_kg ? (
                            <span className="flex items-center gap-1">
                              <Scale className="h-3 w-3 text-muted-foreground" />
                              {maquina.capacidad_kg} kg
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={estadoConfig.color as any} className="gap-1">
                            <Icon className="h-3 w-3" />
                            {estadoConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {maquina.requiere_mantenimiento ? (
                            <Badge variant="warning" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Pendiente
                            </Badge>
                          ) : maquina.fecha_proximo_mantenimiento ? (
                            <span className="text-sm text-muted-foreground">
                              {formatDate(maquina.fecha_proximo_mantenimiento)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(maquina)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteMaquina(maquina)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Crear/Editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMaquina ? 'Editar Máquina' : 'Nueva Máquina'}</DialogTitle>
            <DialogDescription>
              {editingMaquina ? 'Modifica los datos de la máquina' : 'Registra una nueva máquina'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">
                  Código <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) =>
                    setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
                  }
                  placeholder="LAV-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_MAQUINA.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Lavadora Industrial 1"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="marca">Marca</Label>
                <Input
                  id="marca"
                  value={formData.marca}
                  onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modelo">Modelo</Label>
                <Input
                  id="modelo"
                  value={formData.modelo}
                  onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numero_serie">N° Serie</Label>
                <Input
                  id="numero_serie"
                  value={formData.numero_serie}
                  onChange={(e) => setFormData({ ...formData, numero_serie: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacidad_kg">Capacidad (kg)</Label>
                <Input
                  id="capacidad_kg"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.capacidad_kg}
                  onChange={(e) => setFormData({ ...formData, capacidad_kg: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Select
                  value={formData.estado}
                  onValueChange={(value) => setFormData({ ...formData, estado: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_MAQUINA.map((estado) => (
                      <SelectItem key={estado.value} value={estado.value}>
                        {estado.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ubicacion">Ubicación</Label>
                <Input
                  id="ubicacion"
                  value={formData.ubicacion}
                  onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                  placeholder="Sector A"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="costo_hora" className="flex items-center gap-1">
                  Costo/Hora
                </Label>
                <Input
                  id="costo_hora"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.costo_hora}
                  onChange={(e) => setFormData({ ...formData, costo_hora: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="consumo_energia" className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Consumo kWh
                </Label>
                <Input
                  id="consumo_energia"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.consumo_energia_kwh}
                  onChange={(e) =>
                    setFormData({ ...formData, consumo_energia_kwh: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="consumo_agua" className="flex items-center gap-1">
                  <Droplets className="h-3 w-3" />
                  Consumo L/ciclo
                </Label>
                <Input
                  id="consumo_agua"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.consumo_agua_litros}
                  onChange={(e) =>
                    setFormData({ ...formData, consumo_agua_litros: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha_ultimo_mant" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Último Mant.
                </Label>
                <Input
                  id="fecha_ultimo_mant"
                  type="date"
                  value={formData.fecha_ultimo_mantenimiento}
                  onChange={(e) =>
                    setFormData({ ...formData, fecha_ultimo_mantenimiento: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_proximo_mant" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Próximo Mant.
                </Label>
                <Input
                  id="fecha_proximo_mant"
                  type="date"
                  value={formData.fecha_proximo_mantenimiento}
                  onChange={(e) =>
                    setFormData({ ...formData, fecha_proximo_mantenimiento: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="horas_uso">Horas de Uso</Label>
                <Input
                  id="horas_uso"
                  type="number"
                  min="0"
                  value={formData.horas_uso_totales}
                  onChange={(e) => setFormData({ ...formData, horas_uso_totales: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Observaciones adicionales..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingMaquina ? 'Guardar Cambios' : 'Crear Máquina'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog Eliminar */}
      <AlertDialog open={!!deleteMaquina} onOpenChange={() => setDeleteMaquina(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja máquina?</AlertDialogTitle>
            <AlertDialogDescription>
              La máquina "{deleteMaquina?.nombre}" será marcada como fuera de servicio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Dar de Baja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
