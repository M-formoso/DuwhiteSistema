/**
 * Página de Jornales - Adelantos y Horas Extras
 * Similar a la estructura del Excel de ADELANTO + HS. EXTRAS
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  DollarSign,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Users,
  AlertTriangle,
  Banknote,
  Timer,
  X,
  Save,
  Settings,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

import {
  getResumenMensualJornales,
  registrarJornal,
  getEmpleados,
  actualizarValorHoraExtra,
  getMovimientosNomina,
  updateJornal,
  deleteJornal,
} from '@/services/empleadoService';
import { formatNumber } from '@/utils/formatters';
import type { RegistroJornalCreate, ResumenMensualGeneral, EmpleadoList, MovimientoNomina } from '@/types/empleado';
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

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

export default function JornalesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentDate = new Date();

  const [mes, setMes] = useState(currentDate.getMonth() + 1);
  const [anio, setAnio] = useState(currentDate.getFullYear());
  const [showRegistroModal, setShowRegistroModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedEmpleado, setSelectedEmpleado] = useState<EmpleadoList | null>(null);
  const [expandedEmpleado, setExpandedEmpleado] = useState<string | null>(null);
  const [selectedJornal, setSelectedJornal] = useState<MovimientoNomina | null>(null);
  const [editForm, setEditForm] = useState({ monto: '', cantidad_horas: '' });

  // Form para nuevo registro
  const [registroForm, setRegistroForm] = useState<{
    empleado_id: string;
    fecha: string;
    tipo: 'adelanto' | 'hora_extra';
    monto: string;
    cantidad_horas: string;
    notas: string;
  }>({
    empleado_id: '',
    fecha: currentDate.toISOString().split('T')[0],
    tipo: 'adelanto',
    monto: '',
    cantidad_horas: '',
    notas: '',
  });

  // Form para config
  const [configForm, setConfigForm] = useState({
    valor_hora_extra: '',
  });

  // Query resumen mensual
  const { data: resumen, isLoading } = useQuery({
    queryKey: ['jornales-resumen', mes, anio],
    queryFn: () => getResumenMensualJornales(mes, anio),
  });

  // Query empleados
  const { data: empleadosData } = useQuery({
    queryKey: ['empleados-lista'],
    queryFn: () => getEmpleados({ limit: 100, solo_activos: true }),
  });

  const empleados = empleadosData?.items || [];

  // Query movimientos del empleado expandido
  const { data: movimientosData } = useQuery({
    queryKey: ['movimientos-empleado', expandedEmpleado, mes, anio],
    queryFn: () =>
      getMovimientosNomina({
        empleado_id: expandedEmpleado!,
        periodo_mes: mes,
        periodo_anio: anio,
        limit: 200,
      }),
    enabled: !!expandedEmpleado,
  });

  // Mutation registrar jornal
  const registrarMutation = useMutation({
    mutationFn: (data: RegistroJornalCreate) => registrarJornal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jornales-resumen'] });
      toast({ title: 'Registro guardado correctamente' });
      setShowRegistroModal(false);
      resetRegistroForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo guardar el registro',
        variant: 'destructive',
      });
    },
  });

  // Mutation actualizar valor hora extra
  const actualizarValorMutation = useMutation({
    mutationFn: ({ empleadoId, valor }: { empleadoId: string; valor: number }) =>
      actualizarValorHoraExtra(empleadoId, valor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jornales-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['empleados'] });
      toast({ title: 'Valor hora extra actualizado' });
      setShowConfigModal(false);
      setSelectedEmpleado(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo actualizar',
        variant: 'destructive',
      });
    },
  });

  // Mutation editar jornal
  const editarJornalMutation = useMutation({
    mutationFn: ({ id, params }: { id: string; params: { monto?: number; cantidad_horas?: number } }) =>
      updateJornal(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jornales-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos-empleado'] });
      toast({ title: 'Jornal actualizado correctamente' });
      setShowEditModal(false);
      setSelectedJornal(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo actualizar el jornal',
        variant: 'destructive',
      });
    },
  });

  // Mutation eliminar jornal
  const eliminarJornalMutation = useMutation({
    mutationFn: (id: string) => deleteJornal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jornales-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos-empleado'] });
      toast({ title: 'Jornal eliminado correctamente' });
      setShowDeleteDialog(false);
      setSelectedJornal(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo eliminar el jornal',
        variant: 'destructive',
      });
    },
  });

  const resetRegistroForm = () => {
    setRegistroForm({
      empleado_id: '',
      fecha: currentDate.toISOString().split('T')[0],
      tipo: 'adelanto',
      monto: '',
      cantidad_horas: '',
      notas: '',
    });
  };

  const handleRegistrar = () => {
    const data: RegistroJornalCreate = {
      empleado_id: registroForm.empleado_id,
      fecha: registroForm.fecha,
      tipo: registroForm.tipo,
    };

    if (registroForm.tipo === 'adelanto') {
      data.monto = parseFloat(registroForm.monto);
    } else {
      data.cantidad_horas = parseFloat(registroForm.cantidad_horas);
    }

    if (registroForm.notas) {
      data.notas = registroForm.notas;
    }

    registrarMutation.mutate(data);
  };

  const handleMesAnterior = () => {
    if (mes === 1) {
      setMes(12);
      setAnio(anio - 1);
    } else {
      setMes(mes - 1);
    }
  };

  const handleMesSiguiente = () => {
    if (mes === 12) {
      setMes(1);
      setAnio(anio + 1);
    } else {
      setMes(mes + 1);
    }
  };

  const openConfigModal = (emp: EmpleadoList) => {
    setSelectedEmpleado(emp);
    // Buscar valor actual en el resumen
    const empResumen = resumen?.empleados.find((e) => e.empleado_id === emp.id);
    setConfigForm({
      valor_hora_extra: empResumen?.valor_hora_extra?.toString() || '',
    });
    setShowConfigModal(true);
  };

  const openEditModal = (jornal: MovimientoNomina) => {
    setSelectedJornal(jornal);
    setEditForm({
      monto: jornal.tipo === 'adelanto' ? jornal.monto?.toString() || '' : '',
      cantidad_horas: jornal.tipo === 'hora_extra' ? jornal.cantidad_horas?.toString() || '' : '',
    });
    setShowEditModal(true);
  };

  const handleEditar = () => {
    if (!selectedJornal) return;
    const params: { monto?: number; cantidad_horas?: number } = {};
    if (selectedJornal.tipo === 'adelanto' && editForm.monto) {
      params.monto = parseFloat(editForm.monto);
    } else if (selectedJornal.tipo === 'hora_extra' && editForm.cantidad_horas) {
      params.cantidad_horas = parseFloat(editForm.cantidad_horas);
    }
    editarJornalMutation.mutate({ id: selectedJornal.id, params });
  };

  const toggleExpandEmpleado = (empleadoId: string) => {
    setExpandedEmpleado(expandedEmpleado === empleadoId ? null : empleadoId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jornales</h1>
          <p className="text-muted-foreground">
            Adelantos y Horas Extras - {MESES.find((m) => m.value === mes)?.label} {anio}
          </p>
        </div>
        <Button onClick={() => setShowRegistroModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Registro
        </Button>
      </div>

      {/* Navegación de mes */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={handleMesAnterior}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex gap-2">
                <Select value={mes.toString()} onValueChange={(v) => setMes(parseInt(v))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={anio.toString()} onValueChange={(v) => setAnio(parseInt(v))}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map((a) => (
                      <SelectItem key={a} value={a.toString()}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="icon" onClick={handleMesSiguiente}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['jornales-resumen'] })}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumen general */}
      {resumen && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Adelantos</CardTitle>
              <Banknote className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatNumber(resumen.total_adelantos, 'currency')}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total HS Extras</CardTitle>
              <Timer className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {Number(resumen.total_horas_extras || 0).toFixed(1)} hs
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monto HS Extras</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatNumber(resumen.total_monto_extras, 'currency')}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total General</CardTitle>
              <DollarSign className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {formatNumber(resumen.total_general, 'currency')}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabla de empleados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Detalle por Empleado
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !resumen || resumen.empleados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No hay registros para este período
            </div>
          ) : (
            <div className="overflow-auto max-h-[600px] relative">
              <Table className="jornales-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-20 min-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Empleado</TableHead>
                    <TableHead className="sticky left-[180px] z-20 text-right min-w-[80px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">$/Hora</TableHead>
                    <TableHead className="text-center min-w-[100px]">Sem 1</TableHead>
                    <TableHead className="text-center min-w-[100px]">Sem 2</TableHead>
                    <TableHead className="text-center min-w-[100px]">Sem 3</TableHead>
                    <TableHead className="text-center min-w-[100px]">Sem 4</TableHead>
                    <TableHead className="text-center min-w-[100px]">Sem 5</TableHead>
                    <TableHead className="text-right min-w-[100px]">Total Adel.</TableHead>
                    <TableHead className="text-right min-w-[90px]">Total HS</TableHead>
                    <TableHead className="text-right min-w-[100px]">Total $</TableHead>
                    <TableHead className="text-right min-w-[120px]">Sueldo Final</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumen.empleados.map((emp) => (
                    <>
                      <TableRow key={emp.empleado_id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpandEmpleado(emp.empleado_id)}>
                        <TableCell className="sticky left-0 z-10 bg-background font-medium min-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <div className="flex items-center gap-2">
                            {expandedEmpleado === emp.empleado_id ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                            {emp.empleado_nombre}
                          </div>
                        </TableCell>
                        <TableCell className="sticky left-[180px] z-10 bg-background text-right min-w-[80px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          {emp.valor_hora_extra ? (
                            <Badge variant="outline">${formatNumber(emp.valor_hora_extra, 0)}</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              Sin config
                            </Badge>
                          )}
                        </TableCell>
                        {emp.semanas.map((sem) => (
                          <TableCell key={sem.semana} className="text-center">
                            {Number(sem.total_adelantos || 0) > 0 || Number(sem.total_horas_extras || 0) > 0 ? (
                              <div className="text-xs space-y-1">
                                {Number(sem.total_adelantos || 0) > 0 && (
                                  <div className="text-red-600 font-medium">
                                    Adel: ${formatNumber(sem.total_adelantos, 0)}
                                  </div>
                                )}
                                {Number(sem.total_horas_extras || 0) > 0 && (
                                  <div className="text-blue-600">
                                    <span className="font-medium">{Number(sem.total_horas_extras || 0)} hs</span>
                                    <span className="text-blue-400 block">
                                      (${formatNumber(Number(sem.total_horas_extras || 0) * Number(emp.valor_hora_extra || 0), 0)})
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-medium text-red-600">
                          {emp.total_adelantos > 0
                            ? formatNumber(emp.total_adelantos, 'currency')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-blue-600">
                          {Number(emp.total_horas_extras || 0) > 0 ? (
                            <div>
                              <div>{Number(emp.total_horas_extras || 0)} hs</div>
                              <div className="text-xs text-blue-400">
                                ${formatNumber(Number(emp.total_horas_extras || 0) * Number(emp.valor_hora_extra || 0), 0)}
                              </div>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatNumber(emp.total_general, 'currency')}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {emp.salario_base > 0 ? (
                            <div className={emp.sueldo_final >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatNumber(emp.sueldo_final, 'currency')}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Sin salario</span>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const empData = empleados.find((e) => e.id === emp.empleado_id);
                              if (empData) openConfigModal(empData);
                            }}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {/* Fila expandible con detalle de jornales */}
                      {expandedEmpleado === emp.empleado_id && (
                        <TableRow>
                          <TableCell colSpan={12} className="bg-muted/30 p-0">
                            <div className="p-4">
                              <h4 className="font-medium mb-3 flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Detalle de registros - {emp.empleado_nombre}
                              </h4>
                              {movimientosData?.items && movimientosData.items.length > 0 ? (
                                <div className="overflow-auto max-h-[300px]">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-24">Fecha</TableHead>
                                        <TableHead className="w-20">Semana</TableHead>
                                        <TableHead className="w-28">Tipo</TableHead>
                                        <TableHead className="text-right w-24">Monto</TableHead>
                                        <TableHead className="text-right w-20">Horas</TableHead>
                                        <TableHead className="w-32">Acciones</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {movimientosData.items.map((mov) => (
                                        <TableRow key={mov.id}>
                                          <TableCell>
                                            {mov.fecha
                                              ? new Date(mov.fecha).toLocaleDateString('es-AR')
                                              : '-'}
                                          </TableCell>
                                          <TableCell>Sem {mov.semana || '-'}</TableCell>
                                          <TableCell>
                                            {mov.tipo === 'adelanto' ? (
                                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                                <Banknote className="h-3 w-3 mr-1" />
                                                Adelanto
                                              </Badge>
                                            ) : (
                                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                                <Timer className="h-3 w-3 mr-1" />
                                                HS Extra
                                              </Badge>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-right font-medium">
                                            {formatNumber(mov.monto, 'currency')}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            {mov.tipo === 'hora_extra' ? `${mov.cantidad_horas} hs` : '-'}
                                          </TableCell>
                                          <TableCell>
                                            <div className="flex gap-1">
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => openEditModal(mov)}
                                                disabled={mov.pagado}
                                                title={mov.pagado ? 'No se puede editar un movimiento pagado' : 'Editar'}
                                              >
                                                <Pencil className="h-4 w-4" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => {
                                                  setSelectedJornal(mov);
                                                  setShowDeleteDialog(true);
                                                }}
                                                disabled={mov.pagado}
                                                title={mov.pagado ? 'No se puede eliminar un movimiento pagado' : 'Eliminar'}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Cargando registros...
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                  {/* Fila de totales */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell className="sticky left-0 z-10 bg-muted/50 min-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">TOTAL</TableCell>
                    <TableCell className="sticky left-[180px] z-10 bg-muted/50 min-w-[80px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"></TableCell>
                    <TableCell colSpan={5}></TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatNumber(resumen.total_adelantos, 'currency')}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      <div>{Number(resumen.total_horas_extras || 0)} hs</div>
                      <div className="text-xs text-blue-400">
                        {formatNumber(resumen.total_monto_extras, 'currency')}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-lg">
                      {formatNumber(resumen.total_general, 'currency')}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estilos para sticky header */}
      <style>{`
        .jornales-table thead {
          position: sticky;
          top: 0;
          z-index: 10;
          background: hsl(var(--background));
        }
        .jornales-table thead th {
          background: hsl(var(--background));
        }
      `}</style>

      {/* Modal Nuevo Registro */}
      <Dialog open={showRegistroModal} onOpenChange={setShowRegistroModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nuevo Registro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Empleado *</Label>
              <Select
                value={registroForm.empleado_id}
                onValueChange={(v) => setRegistroForm({ ...registroForm, empleado_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleado" />
                </SelectTrigger>
                <SelectContent>
                  {empleados.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nombre_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={registroForm.fecha}
                onChange={(e) => setRegistroForm({ ...registroForm, fecha: e.target.value })}
              />
            </div>

            <div>
              <Label>Tipo *</Label>
              <Tabs
                value={registroForm.tipo}
                onValueChange={(v) =>
                  setRegistroForm({ ...registroForm, tipo: v as 'adelanto' | 'hora_extra' })
                }
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="adelanto">
                    <Banknote className="h-4 w-4 mr-2" />
                    Adelanto
                  </TabsTrigger>
                  <TabsTrigger value="hora_extra">
                    <Timer className="h-4 w-4 mr-2" />
                    HS Extras
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {registroForm.tipo === 'adelanto' ? (
              <div>
                <Label>Monto ($) *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={registroForm.monto}
                  onChange={(e) => setRegistroForm({ ...registroForm, monto: e.target.value })}
                />
              </div>
            ) : (
              <div>
                <Label>Cantidad de Horas *</Label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="0"
                  value={registroForm.cantidad_horas}
                  onChange={(e) =>
                    setRegistroForm({ ...registroForm, cantidad_horas: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  El monto se calcula automáticamente según el valor hora del empleado
                </p>
              </div>
            )}

            <div>
              <Label>Notas (opcional)</Label>
              <Input
                placeholder="Observaciones..."
                value={registroForm.notas}
                onChange={(e) => setRegistroForm({ ...registroForm, notas: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setShowRegistroModal(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleRegistrar}
                disabled={
                  !registroForm.empleado_id ||
                  !registroForm.fecha ||
                  (registroForm.tipo === 'adelanto' && !registroForm.monto) ||
                  (registroForm.tipo === 'hora_extra' && !registroForm.cantidad_horas) ||
                  registrarMutation.isPending
                }
              >
                {registrarMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Config Valor Hora Extra */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurar Valor Hora Extra
            </DialogTitle>
          </DialogHeader>
          {selectedEmpleado && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{selectedEmpleado.nombre_completo}</p>
                <p className="text-sm text-muted-foreground">
                  Salario base: {formatNumber(selectedEmpleado.salario_base, 'currency')}
                </p>
              </div>

              <div>
                <Label>Valor Hora Extra ($)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={configForm.valor_hora_extra}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, valor_hora_extra: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Este valor se usará para calcular el monto de las horas extras
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={() => setShowConfigModal(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() =>
                    actualizarValorMutation.mutate({
                      empleadoId: selectedEmpleado.id,
                      valor: parseFloat(configForm.valor_hora_extra),
                    })
                  }
                  disabled={!configForm.valor_hora_extra || actualizarValorMutation.isPending}
                >
                  {actualizarValorMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Guardar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Editar Jornal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar {selectedJornal?.tipo === 'adelanto' ? 'Adelanto' : 'Horas Extras'}
            </DialogTitle>
          </DialogHeader>
          {selectedJornal && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Fecha: {selectedJornal.fecha ? new Date(selectedJornal.fecha).toLocaleDateString('es-AR') : '-'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Tipo: {selectedJornal.tipo === 'adelanto' ? 'Adelanto' : 'Horas Extras'}
                </p>
              </div>

              {selectedJornal.tipo === 'adelanto' ? (
                <div>
                  <Label>Monto ($)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={editForm.monto}
                    onChange={(e) => setEditForm({ ...editForm, monto: e.target.value })}
                  />
                </div>
              ) : (
                <div>
                  <Label>Cantidad de Horas</Label>
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="0"
                    value={editForm.cantidad_horas}
                    onChange={(e) => setEditForm({ ...editForm, cantidad_horas: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    El monto se recalcula automáticamente según el valor hora
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={() => setShowEditModal(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleEditar}
                  disabled={
                    (selectedJornal.tipo === 'adelanto' && !editForm.monto) ||
                    (selectedJornal.tipo === 'hora_extra' && !editForm.cantidad_horas) ||
                    editarJornalMutation.isPending
                  }
                >
                  {editarJornalMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Guardar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo Confirmar Eliminación */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar este{' '}
              {selectedJornal?.tipo === 'adelanto' ? 'adelanto' : 'registro de horas extras'}?
              {selectedJornal && (
                <div className="mt-2 p-3 bg-muted rounded-lg text-sm">
                  <p>Fecha: {selectedJornal.fecha ? new Date(selectedJornal.fecha).toLocaleDateString('es-AR') : '-'}</p>
                  <p>Monto: {formatNumber(selectedJornal.monto, 'currency')}</p>
                  {selectedJornal.tipo === 'hora_extra' && (
                    <p>Horas: {selectedJornal.cantidad_horas}</p>
                  )}
                </div>
              )}
              <p className="mt-2 text-destructive font-medium">Esta acción no se puede deshacer.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => selectedJornal && eliminarJornalMutation.mutate(selectedJornal.id)}
              disabled={eliminarJornalMutation.isPending}
            >
              {eliminarJornalMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
