/**
 * Control de Asistencia de Empleados
 */

import { useState, useMemo } from 'react';
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
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// Tipos
interface Empleado {
  id: string;
  nombre: string;
  apellido: string;
  departamento: string;
  turno: string;
}

interface RegistroAsistencia {
  id: string;
  empleado_id: string;
  empleado_nombre: string;
  empleado_departamento: string;
  fecha: string;
  hora_entrada?: string;
  hora_salida?: string;
  estado: 'presente' | 'ausente' | 'tardanza' | 'licencia' | 'vacaciones';
  horas_trabajadas?: number;
  justificacion?: string;
  observaciones?: string;
}

// Datos de ejemplo
const EMPLEADOS_EJEMPLO: Empleado[] = [
  { id: '1', nombre: 'Juan', apellido: 'Pérez', departamento: 'Producción', turno: 'Mañana' },
  { id: '2', nombre: 'María', apellido: 'García', departamento: 'Producción', turno: 'Mañana' },
  { id: '3', nombre: 'Carlos', apellido: 'López', departamento: 'Producción', turno: 'Tarde' },
  { id: '4', nombre: 'Ana', apellido: 'Martínez', departamento: 'Administración', turno: 'Mañana' },
  { id: '5', nombre: 'Roberto', apellido: 'Sánchez', departamento: 'Logística', turno: 'Mañana' },
];

const generarAsistenciasMes = (): RegistroAsistencia[] => {
  const registros: RegistroAsistencia[] = [];
  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  for (let d = 1; d <= hoy.getDate(); d++) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), d);
    const diaSemana = fecha.getDay();

    // Saltar fines de semana
    if (diaSemana === 0 || diaSemana === 6) continue;

    EMPLEADOS_EJEMPLO.forEach((emp) => {
      const random = Math.random();
      let estado: RegistroAsistencia['estado'] = 'presente';
      let horaEntrada = '08:00';
      let horaSalida = '17:00';

      if (random < 0.05) {
        estado = 'ausente';
        horaEntrada = undefined as any;
        horaSalida = undefined as any;
      } else if (random < 0.15) {
        estado = 'tardanza';
        horaEntrada = `08:${Math.floor(Math.random() * 45 + 15).toString().padStart(2, '0')}`;
      } else if (random < 0.18) {
        estado = 'licencia';
        horaEntrada = undefined as any;
        horaSalida = undefined as any;
      }

      registros.push({
        id: `${emp.id}-${fecha.toISOString().split('T')[0]}`,
        empleado_id: emp.id,
        empleado_nombre: `${emp.nombre} ${emp.apellido}`,
        empleado_departamento: emp.departamento,
        fecha: fecha.toISOString().split('T')[0],
        hora_entrada: horaEntrada,
        hora_salida: horaSalida,
        estado,
        horas_trabajadas: estado === 'presente' || estado === 'tardanza' ? 8 : 0,
      });
    });
  }

  return registros;
};

const ASISTENCIAS_EJEMPLO = generarAsistenciasMes();

const ESTADOS_ASISTENCIA = [
  { value: 'presente', label: 'Presente', color: 'bg-green-100 text-green-700' },
  { value: 'ausente', label: 'Ausente', color: 'bg-red-100 text-red-700' },
  { value: 'tardanza', label: 'Tardanza', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'licencia', label: 'Licencia', color: 'bg-blue-100 text-blue-700' },
  { value: 'vacaciones', label: 'Vacaciones', color: 'bg-purple-100 text-purple-700' },
];

export default function AsistenciaPage() {
  const { toast } = useToast();
  const [asistencias, setAsistencias] = useState<RegistroAsistencia[]>(ASISTENCIAS_EJEMPLO);
  const [vista, setVista] = useState<'diaria' | 'mensual'>('diaria');
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [mesSeleccionado, setMesSeleccionado] = useState<Date>(new Date());
  const [busqueda, setBusqueda] = useState('');
  const [filtroDepartamento, setFiltroDepartamento] = useState<string>('all');
  const [filtroEstado, setFiltroEstado] = useState<string>('all');

  // Diálogos
  const [dialogRegistro, setDialogRegistro] = useState(false);
  const [empleadoRegistro, setEmpleadoRegistro] = useState<Empleado | null>(null);
  const [tipoRegistro, setTipoRegistro] = useState<'entrada' | 'salida'>('entrada');
  const [horaRegistro, setHoraRegistro] = useState('');

  // Departamentos únicos
  const departamentos = useMemo(() => {
    const deps = new Set(EMPLEADOS_EJEMPLO.map((e) => e.departamento));
    return Array.from(deps);
  }, []);

  // Asistencias filtradas por fecha
  const asistenciasDia = useMemo(() => {
    return asistencias.filter((a) => a.fecha === fechaSeleccionada);
  }, [asistencias, fechaSeleccionada]);

  // Resumen del día
  const resumenDia = useMemo(() => {
    const presentes = asistenciasDia.filter((a) => a.estado === 'presente').length;
    const ausentes = asistenciasDia.filter((a) => a.estado === 'ausente').length;
    const tardanzas = asistenciasDia.filter((a) => a.estado === 'tardanza').length;
    const licencias = asistenciasDia.filter((a) => a.estado === 'licencia' || a.estado === 'vacaciones').length;
    return { presentes, ausentes, tardanzas, licencias, total: EMPLEADOS_EJEMPLO.length };
  }, [asistenciasDia]);

  // Filtrar para la tabla
  const asistenciasFiltradas = useMemo(() => {
    return asistenciasDia.filter((a) => {
      const matchBusqueda = a.empleado_nombre.toLowerCase().includes(busqueda.toLowerCase());
      const matchDepartamento = filtroDepartamento === 'all' || a.empleado_departamento === filtroDepartamento;
      const matchEstado = filtroEstado === 'all' || a.estado === filtroEstado;
      return matchBusqueda && matchDepartamento && matchEstado;
    });
  }, [asistenciasDia, busqueda, filtroDepartamento, filtroEstado]);

  // Calcular estadísticas mensuales por empleado
  const estadisticasMensuales = useMemo(() => {
    const stats: Record<string, {
      empleado: string;
      departamento: string;
      presentes: number;
      ausentes: number;
      tardanzas: number;
      licencias: number;
      horasTotales: number;
    }> = {};

    const mesInicio = new Date(mesSeleccionado.getFullYear(), mesSeleccionado.getMonth(), 1);
    const mesFin = new Date(mesSeleccionado.getFullYear(), mesSeleccionado.getMonth() + 1, 0);

    asistencias
      .filter((a) => {
        const fecha = new Date(a.fecha);
        return fecha >= mesInicio && fecha <= mesFin;
      })
      .forEach((a) => {
        if (!stats[a.empleado_id]) {
          stats[a.empleado_id] = {
            empleado: a.empleado_nombre,
            departamento: a.empleado_departamento,
            presentes: 0,
            ausentes: 0,
            tardanzas: 0,
            licencias: 0,
            horasTotales: 0,
          };
        }

        if (a.estado === 'presente') stats[a.empleado_id].presentes++;
        if (a.estado === 'ausente') stats[a.empleado_id].ausentes++;
        if (a.estado === 'tardanza') stats[a.empleado_id].tardanzas++;
        if (a.estado === 'licencia' || a.estado === 'vacaciones') stats[a.empleado_id].licencias++;
        stats[a.empleado_id].horasTotales += a.horas_trabajadas || 0;
      });

    return Object.values(stats);
  }, [asistencias, mesSeleccionado]);

  const handleRegistrarAsistencia = () => {
    if (!empleadoRegistro || !horaRegistro) {
      toast({
        title: 'Error',
        description: 'Complete todos los campos',
        variant: 'destructive',
      });
      return;
    }

    // En producción esto iría al backend
    const asistenciaExistente = asistencias.find(
      (a) => a.empleado_id === empleadoRegistro.id && a.fecha === fechaSeleccionada
    );

    if (asistenciaExistente) {
      setAsistencias((prev) =>
        prev.map((a) =>
          a.id === asistenciaExistente.id
            ? {
                ...a,
                [tipoRegistro === 'entrada' ? 'hora_entrada' : 'hora_salida']: horaRegistro,
                estado: tipoRegistro === 'entrada' && horaRegistro > '08:15' ? 'tardanza' : 'presente',
              }
            : a
        )
      );
    } else {
      const nuevoRegistro: RegistroAsistencia = {
        id: `${empleadoRegistro.id}-${fechaSeleccionada}`,
        empleado_id: empleadoRegistro.id,
        empleado_nombre: `${empleadoRegistro.nombre} ${empleadoRegistro.apellido}`,
        empleado_departamento: empleadoRegistro.departamento,
        fecha: fechaSeleccionada,
        hora_entrada: tipoRegistro === 'entrada' ? horaRegistro : undefined,
        estado: tipoRegistro === 'entrada' && horaRegistro > '08:15' ? 'tardanza' : 'presente',
      };
      setAsistencias((prev) => [...prev, nuevoRegistro]);
    }

    toast({
      title: 'Asistencia registrada',
      description: `${tipoRegistro === 'entrada' ? 'Entrada' : 'Salida'} registrada para ${empleadoRegistro.nombre} a las ${horaRegistro}`,
    });

    setDialogRegistro(false);
    setEmpleadoRegistro(null);
    setHoraRegistro('');
  };

  const cambiarMes = (direccion: 'anterior' | 'siguiente') => {
    setMesSeleccionado((prev) => {
      const nuevoMes = new Date(prev);
      nuevoMes.setMonth(prev.getMonth() + (direccion === 'siguiente' ? 1 : -1));
      return nuevoMes;
    });
  };

  const getEstadoBadge = (estado: string) => {
    const config = ESTADOS_ASISTENCIA.find((e) => e.value === estado);
    return config || ESTADOS_ASISTENCIA[0];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Control de Asistencia</h1>
          <p className="text-gray-500">Registro y seguimiento de asistencia del personal</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
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
                  {mesSeleccionado.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                </span>
                <Button variant="outline" size="icon" onClick={() => cambiarMes('siguiente')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
                    <p className="text-2xl font-bold">{resumenDia.licencias}</p>
                    <p className="text-sm text-muted-foreground">Licencias</p>
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
                  Asistencia del {new Date(fechaSeleccionada).toLocaleDateString('es-AR', {
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
                  <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {ESTADOS_ASISTENCIA.map((est) => (
                        <SelectItem key={est.value} value={est.value}>
                          {est.label}
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
                        No hay registros de asistencia para esta fecha
                      </TableCell>
                    </TableRow>
                  ) : (
                    asistenciasFiltradas.map((asistencia) => {
                      const estadoConfig = getEstadoBadge(asistencia.estado);
                      return (
                        <TableRow key={asistencia.id}>
                          <TableCell className="font-medium">{asistencia.empleado_nombre}</TableCell>
                          <TableCell>{asistencia.empleado_departamento}</TableCell>
                          <TableCell>
                            {asistencia.hora_entrada || '-'}
                          </TableCell>
                          <TableCell>
                            {asistencia.hora_salida || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn('text-xs', estadoConfig.color)}>
                              {estadoConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {asistencia.horas_trabajadas ? `${asistencia.horas_trabajadas}h` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {!asistencia.hora_entrada && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const emp = EMPLEADOS_EJEMPLO.find((e) => e.id === asistencia.empleado_id);
                                    if (emp) {
                                      setEmpleadoRegistro(emp);
                                      setTipoRegistro('entrada');
                                      setHoraRegistro(new Date().toTimeString().slice(0, 5));
                                      setDialogRegistro(true);
                                    }
                                  }}
                                >
                                  <LogIn className="h-4 w-4" />
                                </Button>
                              )}
                              {asistencia.hora_entrada && !asistencia.hora_salida && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const emp = EMPLEADOS_EJEMPLO.find((e) => e.id === asistencia.empleado_id);
                                    if (emp) {
                                      setEmpleadoRegistro(emp);
                                      setTipoRegistro('salida');
                                      setHoraRegistro(new Date().toTimeString().slice(0, 5));
                                      setDialogRegistro(true);
                                    }
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

          {/* Empleados sin registro */}
          {fechaSeleccionada === new Date().toISOString().split('T')[0] && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Registrar Asistencia</CardTitle>
                <CardDescription>Empleados que aún no registraron entrada hoy</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {EMPLEADOS_EJEMPLO.filter(
                    (emp) => !asistenciasDia.find((a) => a.empleado_id === emp.id)
                  ).map((emp) => (
                    <Card key={emp.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{emp.nombre} {emp.apellido}</p>
                          <p className="text-xs text-muted-foreground">{emp.departamento}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setEmpleadoRegistro(emp);
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
                  {EMPLEADOS_EJEMPLO.filter(
                    (emp) => !asistenciasDia.find((a) => a.empleado_id === emp.id)
                  ).length === 0 && (
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
              Resumen de {mesSeleccionado.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
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
                  <TableHead className="text-center">Licencias</TableHead>
                  <TableHead className="text-center">Horas Totales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estadisticasMensuales.map((stat, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{stat.empleado}</TableCell>
                    <TableCell>{stat.departamento}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-green-100 text-green-700">{stat.presentes}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-red-100 text-red-700">{stat.ausentes}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-yellow-100 text-yellow-700">{stat.tardanzas}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-blue-100 text-blue-700">{stat.licencias}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">{stat.horasTotales}h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
                value={empleadoRegistro ? `${empleadoRegistro.nombre} ${empleadoRegistro.apellido}` : ''}
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
            <Button onClick={handleRegistrarAsistencia}>
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
