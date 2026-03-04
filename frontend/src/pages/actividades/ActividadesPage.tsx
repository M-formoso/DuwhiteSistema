/**
 * Página de Actividades/Tareas Internas
 * Vista con lista, Kanban y calendario
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  List,
  LayoutGrid,
  Calendar as CalendarIcon,
  Search,
  Clock,
  CheckCircle2,
  Circle,
  AlertTriangle,
  X,
  MoreVertical,
  Edit,
  Trash2,
  User,
  Loader2,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { cn } from '@/lib/utils';

import {
  actividadService,
  type Actividad,
  type ActividadCreate,
  type PrioridadActividad,
  type EstadoActividad,
  type CategoriaActividad,
} from '@/services/actividadService';

type VistaActiva = 'lista' | 'kanban' | 'calendario';

const PRIORIDADES: { value: PrioridadActividad; label: string; color: string }[] = [
  { value: 'baja', label: 'Baja', color: 'bg-gray-100 text-gray-700' },
  { value: 'media', label: 'Media', color: 'bg-blue-100 text-blue-700' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgente', label: 'Urgente', color: 'bg-red-100 text-red-700' },
];

const ESTADOS: { value: EstadoActividad; label: string; icon: React.ElementType }[] = [
  { value: 'pendiente', label: 'Pendiente', icon: Circle },
  { value: 'en_progreso', label: 'En Progreso', icon: Clock },
  { value: 'completada', label: 'Completada', icon: CheckCircle2 },
  { value: 'cancelada', label: 'Cancelada', icon: X },
];

const CATEGORIAS: { value: CategoriaActividad; label: string }[] = [
  { value: 'produccion', label: 'Produccion' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'administrativa', label: 'Administrativa' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'otra', label: 'Otra' },
];

const getPrioridadBadge = (prioridad: PrioridadActividad) => {
  const config = PRIORIDADES.find((p) => p.value === prioridad);
  return config || PRIORIDADES[0];
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('es-AR');
};

const isVencida = (fechaLimite?: string) => {
  if (!fechaLimite) return false;
  return new Date(fechaLimite) < new Date() && new Date(fechaLimite).toDateString() !== new Date().toDateString();
};

export default function ActividadesPage() {
  const queryClient = useQueryClient();
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('kanban');
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('all');
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('all');

  // Dialogos
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actividadEditar, setActividadEditar] = useState<Actividad | null>(null);
  const [actividadEliminar, setActividadEliminar] = useState<Actividad | null>(null);

  // Formulario
  const [formData, setFormData] = useState<ActividadCreate>({
    titulo: '',
    descripcion: '',
    categoria: 'otra',
    prioridad: 'media',
    fecha_limite: '',
    etiquetas: [],
  });

  // Query para actividades
  const { data: actividadesData, isLoading: loadingActividades } = useQuery({
    queryKey: ['actividades', busqueda, filtroCategoria, filtroPrioridad],
    queryFn: () => actividadService.getActividades({
      search: busqueda || undefined,
      categoria: filtroCategoria !== 'all' ? filtroCategoria as CategoriaActividad : undefined,
      prioridad: filtroPrioridad !== 'all' ? filtroPrioridad as PrioridadActividad : undefined,
      limit: 200,
    }),
  });

  // Query para resumen
  const { data: resumen } = useQuery({
    queryKey: ['actividades-resumen'],
    queryFn: () => actividadService.getResumenActividades(),
  });

  // Query para Kanban (por estado)
  const { data: actividadesPorEstado, isLoading: loadingKanban } = useQuery({
    queryKey: ['actividades-por-estado'],
    queryFn: () => actividadService.getActividadesPorEstado(),
    enabled: vistaActiva === 'kanban',
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: actividadService.createActividad,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actividades'] });
      queryClient.invalidateQueries({ queryKey: ['actividades-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['actividades-por-estado'] });
      toast.success('Actividad creada correctamente');
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al crear actividad');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ActividadCreate> }) =>
      actividadService.updateActividad(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actividades'] });
      queryClient.invalidateQueries({ queryKey: ['actividades-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['actividades-por-estado'] });
      toast.success('Actividad actualizada correctamente');
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar actividad');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: actividadService.deleteActividad,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actividades'] });
      queryClient.invalidateQueries({ queryKey: ['actividades-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['actividades-por-estado'] });
      toast.success('Actividad eliminada correctamente');
      setDeleteDialogOpen(false);
      setActividadEliminar(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar actividad');
    },
  });

  const cambiarEstadoMutation = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoActividad }) =>
      actividadService.cambiarEstadoActividad(id, estado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actividades'] });
      queryClient.invalidateQueries({ queryKey: ['actividades-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['actividades-por-estado'] });
      toast.success('Estado actualizado');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al cambiar estado');
    },
  });

  const actividades = actividadesData?.items || [];

  // Filtrar actividades (ya filtradas por backend, pero filtro local adicional si es necesario)
  const actividadesFiltradas = actividades;

  const handleOpenDialog = (actividad?: Actividad) => {
    if (actividad) {
      setActividadEditar(actividad);
      setFormData({
        titulo: actividad.titulo,
        descripcion: actividad.descripcion || '',
        categoria: actividad.categoria,
        prioridad: actividad.prioridad,
        fecha_limite: actividad.fecha_limite || '',
        etiquetas: actividad.etiquetas,
      });
    } else {
      setActividadEditar(null);
      setFormData({
        titulo: '',
        descripcion: '',
        categoria: 'otra',
        prioridad: 'media',
        fecha_limite: '',
        etiquetas: [],
      });
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.titulo.trim()) {
      toast.error('El titulo es requerido');
      return;
    }

    if (actividadEditar) {
      updateMutation.mutate({ id: actividadEditar.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = () => {
    if (actividadEliminar) {
      deleteMutation.mutate(actividadEliminar.id);
    }
  };

  const handleCambiarEstado = (actividadId: string, nuevoEstado: EstadoActividad) => {
    cambiarEstadoMutation.mutate({ id: actividadId, estado: nuevoEstado });
  };

  // Componente de tarjeta de actividad
  const ActividadCard = ({ actividad }: { actividad: Actividad }) => {
    const prioridadConfig = getPrioridadBadge(actividad.prioridad);
    const vencida = isVencida(actividad.fecha_limite) && actividad.estado !== 'completada';

    return (
      <Card className={cn('hover:shadow-md transition-shadow', vencida && 'border-red-300 bg-red-50/50')}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={cn('text-xs', prioridadConfig.color)}>
                  {prioridadConfig.label}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {CATEGORIAS.find((c) => c.value === actividad.categoria)?.label}
                </Badge>
              </div>
              <h4 className="font-medium text-sm truncate">{actividad.titulo}</h4>
              {actividad.descripcion && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {actividad.descripcion}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {actividad.fecha_limite && (
                  <span className={cn('flex items-center gap-1', vencida && 'text-red-600 font-medium')}>
                    <CalendarIcon className="h-3 w-3" />
                    {formatDate(actividad.fecha_limite)}
                    {vencida && <AlertTriangle className="h-3 w-3" />}
                  </span>
                )}
                {actividad.asignado_a_nombre && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {actividad.asignado_a_nombre}
                  </span>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleOpenDialog(actividad)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                {actividad.estado !== 'completada' && (
                  <DropdownMenuItem onClick={() => handleCambiarEstado(actividad.id, 'completada')}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Marcar completada
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => {
                    setActividadEliminar(actividad);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Vista Lista
  const VistaLista = () => (
    <div className="space-y-3">
      {loadingActividades ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : actividadesFiltradas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Circle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No hay actividades que coincidan con los filtros</p>
        </div>
      ) : (
        actividadesFiltradas.map((actividad) => (
          <ActividadCard key={actividad.id} actividad={actividad} />
        ))
      )}
    </div>
  );

  // Vista Kanban
  const VistaKanban = () => {
    type EstadoKanban = 'pendiente' | 'en_progreso' | 'completada';
    const columnas: { estado: EstadoKanban; titulo: string; color: string }[] = [
      { estado: 'pendiente', titulo: 'Pendiente', color: 'bg-gray-100' },
      { estado: 'en_progreso', titulo: 'En Progreso', color: 'bg-blue-100' },
      { estado: 'completada', titulo: 'Completada', color: 'bg-green-100' },
    ];

    const actividadesKanban = actividadesPorEstado || {
      pendiente: [],
      en_progreso: [],
      completada: [],
    };

    if (loadingKanban) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columnas.map((columna) => (
          <div key={columna.estado} className="space-y-3">
            <div className={cn('rounded-lg p-3', columna.color)}>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">{columna.titulo}</h3>
                <Badge variant="secondary" className="text-xs">
                  {actividadesKanban[columna.estado]?.length || 0}
                </Badge>
              </div>
            </div>
            <div className="space-y-3 min-h-[200px]">
              {actividadesKanban[columna.estado]?.map((actividad: Actividad) => (
                <div
                  key={actividad.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('actividadId', actividad.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const actividadId = e.dataTransfer.getData('actividadId');
                    if (actividadId) {
                      handleCambiarEstado(actividadId, columna.estado);
                    }
                  }}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <ActividadCard actividad={actividad} />
                </div>
              ))}
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-muted-foreground text-sm"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const actividadId = e.dataTransfer.getData('actividadId');
                  if (actividadId) {
                    handleCambiarEstado(actividadId, columna.estado);
                  }
                }}
              >
                Arrastra aqui
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Vista Calendario (simplificada)
  const VistaCalendario = () => {
    const hoy = new Date();
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

    // Generar dias del mes actual
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const diasDelMes: (Date | null)[] = [];

    // Dias vacios al inicio
    for (let i = 0; i < primerDia.getDay(); i++) {
      diasDelMes.push(null);
    }

    // Dias del mes
    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      diasDelMes.push(new Date(hoy.getFullYear(), hoy.getMonth(), d));
    }

    const getActividadesDelDia = (fecha: Date) => {
      const fechaStr = fecha.toISOString().split('T')[0];
      return actividadesFiltradas.filter((a) => a.fecha_limite === fechaStr);
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {hoy.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingActividades ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {diasSemana.map((dia) => (
                <div key={dia} className="text-center text-sm font-medium text-muted-foreground p-2">
                  {dia}
                </div>
              ))}
              {diasDelMes.map((fecha, index) => {
                if (!fecha) {
                  return <div key={`empty-${index}`} className="p-2" />;
                }
                const actividadesDelDia = getActividadesDelDia(fecha);
                const esHoy = fecha.toDateString() === hoy.toDateString();

                return (
                  <div
                    key={fecha.toISOString()}
                    className={cn(
                      'min-h-[80px] p-1 border rounded-md',
                      esHoy && 'bg-primary/10 border-primary'
                    )}
                  >
                    <span className={cn('text-sm', esHoy && 'font-bold text-primary')}>
                      {fecha.getDate()}
                    </span>
                    <div className="space-y-1 mt-1">
                      {actividadesDelDia.slice(0, 2).map((act) => (
                        <div
                          key={act.id}
                          className={cn(
                            'text-xs p-1 rounded truncate cursor-pointer',
                            getPrioridadBadge(act.prioridad).color
                          )}
                          title={act.titulo}
                          onClick={() => handleOpenDialog(act)}
                        >
                          {act.titulo}
                        </div>
                      ))}
                      {actividadesDelDia.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{actividadesDelDia.length - 2} mas
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Actividades</h1>
          <p className="text-gray-500">Gestiona las tareas internas del equipo</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Actividad
        </Button>
      </div>

      {/* Controles */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Selector de vista */}
            <div className="flex items-center border rounded-lg">
              <Button
                variant={vistaActiva === 'lista' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setVistaActiva('lista')}
                className="rounded-r-none"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={vistaActiva === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setVistaActiva('kanban')}
                className="rounded-none border-x"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={vistaActiva === 'calendario' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setVistaActiva('calendario')}
                className="rounded-l-none"
              >
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* Busqueda */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar actividades..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filtros */}
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {CATEGORIAS.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroPrioridad} onValueChange={setFiltroPrioridad}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {PRIORIDADES.map((pri) => (
                  <SelectItem key={pri.value} value={pri.value}>
                    {pri.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Circle className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resumen?.pendientes || 0}</p>
                <p className="text-sm text-muted-foreground">Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resumen?.en_progreso || 0}</p>
                <p className="text-sm text-muted-foreground">En Progreso</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resumen?.completadas_hoy || 0}</p>
                <p className="text-sm text-muted-foreground">Completadas Hoy</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resumen?.vencidas || 0}</p>
                <p className="text-sm text-muted-foreground">Vencidas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vista seleccionada */}
      {vistaActiva === 'lista' && <VistaLista />}
      {vistaActiva === 'kanban' && <VistaKanban />}
      {vistaActiva === 'calendario' && <VistaCalendario />}

      {/* Dialogo de crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actividadEditar ? 'Editar Actividad' : 'Nueva Actividad'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Titulo *</Label>
              <Input
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Titulo de la actividad"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripcion</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripcion opcional"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(value: CategoriaActividad) =>
                    setFormData({ ...formData, categoria: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select
                  value={formData.prioridad}
                  onValueChange={(value: PrioridadActividad) =>
                    setFormData({ ...formData, prioridad: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((pri) => (
                      <SelectItem key={pri.value} value={pri.value}>
                        {pri.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fecha limite</Label>
              <Input
                type="date"
                value={formData.fecha_limite}
                onChange={(e) => setFormData({ ...formData, fecha_limite: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {actividadEditar ? 'Guardar Cambios' : 'Crear Actividad'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogo de confirmacion de eliminacion */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar actividad?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. La actividad "{actividadEliminar?.titulo}" sera eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
