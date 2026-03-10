/**
 * Control de Asistencia de Empleados
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Calendar,
  User,
  LogIn,
  LogOut,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

import { empleadoService } from '@/services/empleadoService';
import type { EmpleadoList, JornadaLaboral, TipoAsistencia } from '@/types/empleado';

const ESTADOS_JORNADA = [
  { value: 'presente', label: 'Presente', color: 'bg-green-100 text-green-700' },
  { value: 'ausente', label: 'Ausente', color: 'bg-red-100 text-red-700' },
  { value: 'tardanza', label: 'Tardanza', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'justificado', label: 'Justificado', color: 'bg-blue-100 text-blue-700' },
];

function getEstadoJornada(jornada: JornadaLaboral): { value: string; label: string; color: string } {
  if (jornada.ausente && jornada.justificado) {
    return ESTADOS_JORNADA[3]; // justificado
  }
  if (jornada.ausente) {
    return ESTADOS_JORNADA[1]; // ausente
  }
  if (jornada.llegada_tarde) {
    return ESTADOS_JORNADA[2]; // tardanza
  }
  return ESTADOS_JORNADA[0]; // presente
}

export default function AsistenciaPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [vista, setVista] = useState<'diaria' | 'mensual'>('diaria');
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [mesSeleccionado, setMesSeleccionado] = useState<Date>(new Date());
  const [busqueda, setBusqueda] = useState('');
  const [filtroDepartamento, setFiltroDepartamento] = useState<string>('all');

  // Diálogos
  const [dialogRegistro, setDialogRegistro] = useState(false);
  const [empleadoRegistro, setEmpleadoRegistro] = useState<EmpleadoList | null>(null);
  const [tipoRegistro, setTipoRegistro] = useState<TipoAsistencia>('entrada');
  const [horaRegistro, setHoraRegistro] = useState('');

  // Query de empleados activos
  const { data: empleadosData, isLoading: loadingEmpleados } = useQuery({
    queryKey: ['empleados-asistencia'],
    queryFn: () => empleadoService.getEmpleados({ solo_activos: true, limit: 200 }),
  });

  const empleados = empleadosData?.items || [];

  // Departamentos únicos
  const departamentos = useMemo(() => {
    const deps = new Set(empleados.map((e) => e.departamento).filter(Boolean));
    return Array.from(deps) as string[];
  }, [empleados]);

  // Query de jornadas del día
  const { data: jornadasDiaData, isLoading: loadingJornadasDia } = useQuery({
    queryKey: ['jornadas-dia', fechaSeleccionada],
    queryFn: () =>
      empleadoService.getJornadas({
        fecha_desde: fechaSeleccionada,
        fecha_hasta: fechaSeleccionada,
        limit: 200,
      }),
    enabled: vista === 'diaria',
  });

  const jornadasDia = jornadasDiaData?.items || [];

  // Query de jornadas del mes
  const mesInicio = useMemo(() => {
    return new Date(mesSeleccionado.getFullYear(), mesSeleccionado.getMonth(), 1)
      .toISOString()
      .split('T')[0];
  }, [mesSeleccionado]);

  const mesFin = useMemo(() => {
    return new Date(mesSeleccionado.getFullYear(), mesSeleccionado.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];
  }, [mesSeleccionado]);

  const { data: jornadasMesData, isLoading: loadingJornadasMes } = useQuery({
    queryKey: ['jornadas-mes', mesInicio, mesFin],
    queryFn: () =>
      empleadoService.getJornadas({
        fecha_desde: mesInicio,
        fecha_hasta: mesFin,
        limit: 1000,
      }),
    enabled: vista === 'mensual',
  });

  const jornadasMes = jornadasMesData?.items || [];

  // Mutation para registrar asistencia
  const registrarMutation = useMutation({
    mutationFn: (data: { empleado_id: string; tipo: TipoAsistencia; hora: string }) =>
      empleadoService.registrarAsistencia(
        {
          empleado_id: data.empleado_id,
          tipo: data.tipo,
          fecha: fechaSeleccionada,
          hora: data.hora,
        },
        true
      ),
    onSuccess: () => {
      toast({
        title: 'Asistencia registrada',
        description: `${tipoRegistro === 'entrada' ? 'Entrada' : 'Salida'} registrada correctamente`,
      });
      queryClient.invalidateQueries({ queryKey: ['jornadas-dia'] });
      setDialogRegistro(false);
      setEmpleadoRegistro(null);
      setHoraRegistro('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo registrar la asistencia',
        variant: 'destructive',
      });
    },
  });

  // Combinar empleados con sus jornadas del día
  const asistenciasDia = useMemo(() => {
    return empleados.map((emp) => {
      const jornada = jornadasDia.find((j) => j.empleado_id === emp.id);
      return {
        empleado: emp,
        jornada,
      };
    });
  }, [empleados, jornadasDia]);

  // Filtrar asistencias
  const asistenciasFiltradas = useMemo(() => {
    return asistenciasDia.filter((a) => {
      const matchBusqueda = a.empleado.nombre_completo
        .toLowerCase()
        .includes(busqueda.toLowerCase());
      const matchDepartamento =
        filtroDepartamento === 'all' || a.empleado.departamento === filtroDepartamento;
      return matchBusqueda && matchDepartamento;
    });
  }, [asistenciasDia, busqueda, filtroDepartamento]);

  // Resumen del día
  const resumenDia = useMemo(() => {
    const presentes = jornadasDia.filter((j) => !j.ausente && !j.llegada_tarde).length;
    const ausentes = jornadasDia.filter((j) => j.ausente && !j.justificado).length;
    const tardanzas = jornadasDia.filter((j) => j.llegada_tarde).length;
    const justificados = jornadasDia.filter((j) => j.ausente && j.justificado).length;
    return { presentes, ausentes, tardanzas, justificados, total: empleados.length };
  }, [jornadasDia, empleados]);

  // Estadísticas mensuales por empleado
  const estadisticasMensuales = useMemo(() => {
    const stats: Record<
      string,
      {
        empleado_id: string;
        empleado: string;
        departamento: string;
        presentes: number;
        ausentes: number;
        tardanzas: number;
        justificados: number;
        horasTotales: number;
      }
    > = {};

    empleados.forEach((emp) => {
      stats[emp.id] = {
        empleado_id: emp.id,
        empleado: emp.nombre_completo,
        departamento: emp.departamento || 'Sin departamento',
        presentes: 0,
        ausentes: 0,
        tardanzas: 0,
        justificados: 0,
        horasTotales: 0,
      };
    });

    jornadasMes.forEach((j) => {
      if (stats[j.empleado_id]) {
        if (j.ausente && j.justificado) {
          stats[j.empleado_id].justificados++;
        } else if (j.ausente) {
          stats[j.empleado_id].ausentes++;
        } else if (j.llegada_tarde) {
          stats[j.empleado_id].tardanzas++;
          stats[j.empleado_id].horasTotales += j.horas_trabajadas || 0;
        } else {
          stats[j.empleado_id].presentes++;
          stats[j.empleado_id].horasTotales += j.horas_trabajadas || 0;
        }
      }
    });

    return Object.values(stats);
  }, [empleados, jornadasMes]);

  const handleRegistrarAsistencia = () => {
    if (!empleadoRegistro || !horaRegistro) {
      toast({
        title: 'Error',
        description: 'Complete todos los campos',
        variant: 'destructive',
      });
      return;
    }

    registrarMutation.mutate({
      empleado_id: empleadoRegistro.id,
      tipo: tipoRegistro,
      hora: horaRegistro,
    });
  };

  const cambiarMes = (direccion: 'anterior' | 'siguiente') => {
    setMesSeleccionado((prev) => {
      const nuevoMes = new Date(prev);
      nuevoMes.setMonth(prev.getMonth() + (direccion === 'siguiente' ? 1 : -1));
      return nuevoMes;
    });
  };

  const isLoading = loadingEmpleados || (vista === 'diaria' ? loadingJornadasDia : loadingJornadasMes);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Control de Asistencia</h1>
          <p className="text-gray-500">Registro y seguimiento de asistencia del personal</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Selector de vista */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center border rounded-lg">
              <Button
                variant={vista === 'diaria' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setVista('diaria')}
                className="rounded-r-none"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Vista Diaria
              </Button>
              <Button
                variant={vista === 'mensual' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setVista('mensual')}
                className="rounded-l-none"
              >
                <Clock className="h-4 w-4 mr-2" />
                Vista Mensual
              </Button>
            </div>

            {vista === 'diaria' && (
              <div className="flex items-center gap-2">
                <Label>Fecha:</Label>
                <Input
                  type="date"
                  value={fechaSeleccionada}
                  onChange={(e) => setFechaSeleccionada(e.target.value)}
                  className="w-40"
                />
              </div>
            )}

            {vista === 'mensual' && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => cambiarMes('anterior')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium min-w-[150px] text-center">
                  {mesSeleccionado.toLocaleDateString('es-AR', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                <Button variant="outline" size="icon" onClick={() => cambiarMes('siguiente')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="py-4">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="py-8">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {/* Vista Diaria */}
          {vista === 'diaria' && (
            <>
              {/* Resumen del día */}
              <div className="grid gap-4 md:grid-cols-5">
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <User className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{resumenDia.total}</p>
                        <p className="text-sm text-muted-foreground">Total</p>
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
                        <p className="text-2xl font-bold">{resumenDia.presentes}</p>
                        <p className="text-sm text-muted-foreground">Presentes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                        <XCircle className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{resumenDia.ausentes}</p>
                        <p className="text-sm text-muted-foreground">Ausentes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{resumenDia.tardanzas}</p>
                        <p className="text-sm text-muted-foreground">Tardanzas</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{resumenDia.justificados}</p>
                        <p className="text-sm text-muted-foreground">Justificados</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filtros y tabla */}
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <CardTitle className="text-base">
                      Asistencia del{' '}
                      {new Date(fechaSeleccionada + 'T12:00:00').toLocaleDateString('es-AR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar empleado..."
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                          className="pl-10 w-[200px]"
                        />
                      </div>
                      <Select value={filtroDepartamento} onValueChange={setFiltroDepartamento}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Departamento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {departamentos.map((dep) => (
                            <SelectItem key={dep} value={dep}>
                              {dep}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empleado</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead>Entrada</TableHead>
                        <TableHead>Salida</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Horas</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {asistenciasFiltradas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No hay empleados que coincidan con los filtros
                          </TableCell>
                        </TableRow>
                      ) : (
                        asistenciasFiltradas.map(({ empleado, jornada }) => {
                          const estado = jornada
                            ? getEstadoJornada(jornada)
                            : { value: 'sin_registro', label: 'Sin registro', color: 'bg-gray-100 text-gray-700' };
                          return (
                            <TableRow key={empleado.id}>
                              <TableCell className="font-medium">
                                {empleado.nombre_completo}
                              </TableCell>
                              <TableCell>{empleado.departamento || '-'}</TableCell>
                              <TableCell>{jornada?.hora_entrada || '-'}</TableCell>
                              <TableCell>{jornada?.hora_salida || '-'}</TableCell>
                              <TableCell>
                                <Badge className={cn('text-xs', estado.color)}>
                                  {estado.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {jornada?.horas_trabajadas
                                  ? `${jornada.horas_trabajadas.toFixed(1)}h`
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  {!jornada?.hora_entrada && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEmpleadoRegistro(empleado);
                                        setTipoRegistro('entrada');
                                        setHoraRegistro(new Date().toTimeString().slice(0, 5));
                                        setDialogRegistro(true);
                                      }}
                                    >
                                      <LogIn className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {jornada?.hora_entrada && !jornada?.hora_salida && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEmpleadoRegistro(empleado);
                                        setTipoRegistro('salida');
                                        setHoraRegistro(new Date().toTimeString().slice(0, 5));
                                        setDialogRegistro(true);
                                      }}
                                    >
                                      <LogOut className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Empleados sin registro hoy */}
              {fechaSeleccionada === new Date().toISOString().split('T')[0] && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Registrar Asistencia</CardTitle>
                    <CardDescription>
                      Empleados que aún no registraron entrada hoy
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {asistenciasDia
                        .filter(({ jornada }) => !jornada?.hora_entrada)
                        .map(({ empleado }) => (
                          <Card key={empleado.id} className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{empleado.nombre_completo}</p>
                                <p className="text-xs text-muted-foreground">
                                  {empleado.departamento || 'Sin departamento'}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setEmpleadoRegistro(empleado);
                                  setTipoRegistro('entrada');
                                  setHoraRegistro(new Date().toTimeString().slice(0, 5));
                                  setDialogRegistro(true);
                                }}
                              >
                                <LogIn className="h-4 w-4 mr-1" />
                                Entrada
                              </Button>
                            </div>
                          </Card>
                        ))}
                      {asistenciasDia.filter(({ jornada }) => !jornada?.hora_entrada).length ===
                        0 && (
                        <p className="text-muted-foreground col-span-full text-center py-4">
                          Todos los empleados ya tienen registro de asistencia hoy
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Vista Mensual */}
          {vista === 'mensual' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Resumen de{' '}
                  {mesSeleccionado.toLocaleDateString('es-AR', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead className="text-center">Presentes</TableHead>
                      <TableHead className="text-center">Ausentes</TableHead>
                      <TableHead className="text-center">Tardanzas</TableHead>
                      <TableHead className="text-center">Justificados</TableHead>
                      <TableHead className="text-center">Horas Totales</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {estadisticasMensuales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No hay registros de asistencia para este período
                        </TableCell>
                      </TableRow>
                    ) : (
                      estadisticasMensuales.map((stat) => (
                        <TableRow key={stat.empleado_id}>
                          <TableCell className="font-medium">{stat.empleado}</TableCell>
                          <TableCell>{stat.departamento}</TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-green-100 text-green-700">{stat.presentes}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-red-100 text-red-700">{stat.ausentes}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-yellow-100 text-yellow-700">
                              {stat.tardanzas}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-blue-100 text-blue-700">
                              {stat.justificados}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {stat.horasTotales.toFixed(1)}h
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Diálogo de registro */}
      <Dialog open={dialogRegistro} onOpenChange={setDialogRegistro}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Registrar {tipoRegistro === 'entrada' ? 'Entrada' : 'Salida'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Empleado</Label>
              <Input
                value={empleadoRegistro ? empleadoRegistro.nombre_completo : ''}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Hora de {tipoRegistro === 'entrada' ? 'entrada' : 'salida'}</Label>
              <Input
                type="time"
                value={horaRegistro}
                onChange={(e) => setHoraRegistro(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogRegistro(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRegistrarAsistencia} disabled={registrarMutation.isPending}>
              {registrarMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                'Registrar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
