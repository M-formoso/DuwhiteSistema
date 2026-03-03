/**
 * Página de Actividades/Tareas Internas
 * Vista con lista, Kanban y calendario
 */

import { useState, useMemo } from 'react';
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
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

import type {
  Actividad,
  ActividadCreate,
  PrioridadActividad,
  EstadoActividad,
  CategoriaActividad,
} from '@/services/actividadService';

// Datos de ejemplo (en producción vendrían del backend)
const ACTIVIDADES_EJEMPLO: Actividad[] = [
  {
    id: '1',
    titulo: 'Revisar máquina lavadora #3',
    descripcion: 'Realizar mantenimiento preventivo mensual',
    categoria: 'mantenimiento',
    prioridad: 'alta',
    estado: 'pendiente',
    fecha_limite: '2025-03-05',
    asignado_a_id: '1',
    asignado_a_nombre: 'Juan Pérez',
    creado_por_id: '1',
    creado_por_nombre: 'Admin',
    etiquetas: ['mantenimiento', 'urgente'],
    created_at: '2025-03-01T10:00:00',
    updated_at: '2025-03-01T10:00:00',
  },
  {
    id: '2',
    titulo: 'Llamar a cliente Hotel Central',
    descripcion: 'Confirmar entrega del pedido #P-2025-0045',
    categoria: 'comercial',
    prioridad: 'media',
    estado: 'en_progreso',
    fecha_limite: '2025-03-04',
    asignado_a_id: '2',
    asignado_a_nombre: 'María García',
    creado_por_id: '1',
    creado_por_nombre: 'Admin',
    etiquetas: ['cliente', 'seguimiento'],
    created_at: '2025-03-02T09:00:00',
    updated_at: '2025-03-02T09:00:00',
  },
  {
    id: '3',
    titulo: 'Actualizar lista de precios',
    descripcion: 'Revisar costos y actualizar precios para marzo',
    categoria: 'administrativa',
    prioridad: 'baja',
    estado: 'completada',
    fecha_limite: '2025-03-01',
    fecha_completada: '2025-03-01T15:00:00',
    asignado_a_id: '1',
    asignado_a_nombre: 'Admin',
    creado_por_id: '1',
    creado_por_nombre: 'Admin',
    etiquetas: ['precios', 'mensual'],
    created_at: '2025-02-28T10:00:00',
    updated_at: '2025-03-01T15:00:00',
  },
  {
    id: '4',
    titulo: 'Preparar lote especial Clínica Norte',
    descripcion: 'Lote de ropa quirúrgica con tratamiento especial',
    categoria: 'produccion',
    prioridad: 'urgente',
    estado: 'en_progreso',
    fecha_limite: '2025-03-03',
    asignado_a_id: '3',
    asignado_a_nombre: 'Carlos López',
    creado_por_id: '1',
    creado_por_nombre: 'Admin',
    etiquetas: ['produccion', 'prioritario'],
    created_at: '2025-03-02T08:00:00',
    updated_at: '2025-03-02T08:00:00',
  },
  {
    id: '5',
    titulo: 'Solicitar cotización químicos',
    descripcion: 'Pedir cotización a 3 proveedores para detergentes industriales',
    categoria: 'administrativa',
    prioridad: 'media',
    estado: 'pendiente',
    fecha_limite: '2025-03-06',
    creado_por_id: '1',
    creado_por_nombre: 'Admin',
    etiquetas: ['compras', 'proveedores'],
    created_at: '2025-03-02T11:00:00',
    updated_at: '2025-03-02T11:00:00',
  },
];

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
  { value: 'produccion', label: 'Producción' },
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
  const { toast } = useToast();
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('kanban');
  const [actividades, setActividades] = useState<Actividad[]>(ACTIVIDADES_EJEMPLO);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('all');
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('all');

  // Diálogos
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

  // Filtrar actividades
  const actividadesFiltradas = useMemo(() => {
    return actividades.filter((act) => {
      const matchBusqueda = act.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
        act.descripcion?.toLowerCase().includes(busqueda.toLowerCase());
      const matchCategoria = filtroCategoria === 'all' || act.categoria === filtroCategoria;
      const matchPrioridad = filtroPrioridad === 'all' || act.prioridad === filtroPrioridad;
      return matchBusqueda && matchCategoria && matchPrioridad;
    });
  }, [actividades, busqueda, filtroCategoria, filtroPrioridad]);

  // Agrupar por estado para Kanban
  const actividadesPorEstado = useMemo(() => {
    return {
      pendiente: actividadesFiltradas.filter((a) => a.estado === 'pendiente'),
      en_progreso: actividadesFiltradas.filter((a) => a.estado === 'en_progreso'),
      completada: actividadesFiltradas.filter((a) => a.estado === 'completada'),
    };
  }, [actividadesFiltradas]);

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
      toast({
        title: 'Error',
        description: 'El título es requerido',
        variant: 'destructive',
      });
      return;
    }

    if (actividadEditar) {
      // Editar
      setActividades((prev) =>
        prev.map((a) =>
          a.id === actividadEditar.id
            ? {
                ...a,
                ...formData,
                updated_at: new Date().toISOString(),
              }
            : a
        )
      );
      toast({
        title: 'Actividad actualizada',
        description: 'Los cambios se guardaron correctamente',
      });
    } else {
      // Crear
      const nuevaActividad: Actividad = {
        id: Date.now().toString(),
        ...formData,
        estado: 'pendiente',
        creado_por_id: '1',
        creado_por_nombre: 'Admin',
        etiquetas: formData.etiquetas || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setActividades((prev) => [nuevaActividad, ...prev]);
      toast({
        title: 'Actividad creada',
        description: 'La actividad se creó correctamente',
      });
    }

    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (actividadEliminar) {
      setActividades((prev) => prev.filter((a) => a.id !== actividadEliminar.id));
      toast({
        title: 'Actividad eliminada',
        description: 'La actividad se eliminó correctamente',
      });
      setDeleteDialogOpen(false);
      setActividadEliminar(null);
    }
  };

  const handleCambiarEstado = (actividadId: string, nuevoEstado: EstadoActividad) => {
    setActividades((prev) =>
      prev.map((a) =>
        a.id === actividadId
          ? {
              ...a,
              estado: nuevoEstado,
              fecha_completada: nuevoEstado === 'completada' ? new Date().toISOString() : undefined,
              updated_at: new Date().toISOString(),
            }
          : a
      )
    );
    toast({
      title: 'Estado actualizado',
      description: `La actividad pasó a "${ESTADOS.find((e) => e.value === nuevoEstado)?.label}"`,
    });
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
      {actividadesFiltradas.length === 0 ? (
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

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columnas.map((columna) => (
          <div key={columna.estado} className="space-y-3">
            <div className={cn('rounded-lg p-3', columna.color)}>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">{columna.titulo}</h3>
                <Badge variant="secondary" className="text-xs">
                  {actividadesPorEstado[columna.estado].length}
                </Badge>
              </div>
            </div>
            <div className="space-y-3 min-h-[200px]">
              {actividadesPorEstado[columna.estado].map((actividad: Actividad) => (
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
                Arrastra aquí
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
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    // Generar días del mes actual
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const diasDelMes: (Date | null)[] = [];

    // Días vacíos al inicio
    for (let i = 0; i < primerDia.getDay(); i++) {
      diasDelMes.push(null);
    }

    // Días del mes
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
                        +{actividadesDelDia.length - 2} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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

            {/* Búsqueda */}
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
                <SelectValue placeholder="Categoría" />
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
                <p className="text-2xl font-bold">{actividadesPorEstado.pendiente.length}</p>
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
                <p className="text-2xl font-bold">{actividadesPorEstado.en_progreso.length}</p>
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
                <p className="text-2xl font-bold">{actividadesPorEstado.completada.length}</p>
                <p className="text-sm text-muted-foreground">Completadas</p>
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
                <p className="text-2xl font-bold">
                  {actividadesFiltradas.filter((a) => isVencida(a.fecha_limite) && a.estado !== 'completada').length}
                </p>
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

      {/* Diálogo de crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actividadEditar ? 'Editar Actividad' : 'Nueva Actividad'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Título de la actividad"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripción opcional"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
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
              <Label>Fecha límite</Label>
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
            <Button onClick={handleSave}>
              {actividadEditar ? 'Guardar Cambios' : 'Crear Actividad'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar actividad?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La actividad "{actividadEliminar?.titulo}" será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
