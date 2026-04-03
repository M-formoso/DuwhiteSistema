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
  Coffee,
  PartyPopper,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// No usar shadcn Table para poder hacer sticky header correctamente
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
import { formatNumber, formatDate, getLocalDateString } from '@/utils/formatters';
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
  const [editForm, setEditForm] = useState({ monto: '', cantidad_horas: '', fecha: '' });

  // Form para nuevo registro
  const [registroForm, setRegistroForm] = useState<{
    empleado_id: string;
    fecha: string;
    tipo: 'adelanto' | 'hora_extra' | 'franco' | 'feriado';
    monto: string;
    cantidad_horas: string;
    notas: string;
  }>({
    empleado_id: '',
    fecha: getLocalDateString(currentDate),
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
    mutationFn: ({ id, params }: { id: string; params: { monto?: number; cantidad_horas?: number; fecha?: string } }) =>
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
      fecha: getLocalDateString(currentDate),
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
    } else if (registroForm.tipo === 'hora_extra' || registroForm.tipo === 'franco' || registroForm.tipo === 'feriado') {
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
      fecha: jornal.fecha || '',
    });
    setShowEditModal(true);
  };

  const handleEditar = () => {
    if (!selectedJornal) return;
    const params: { monto?: number; cantidad_horas?: number; fecha?: string } = {};
    if (selectedJornal.tipo === 'adelanto' && editForm.monto) {
      params.monto = parseFloat(editForm.monto);
    } else if (selectedJornal.tipo === 'hora_extra' && editForm.cantidad_horas) {
      params.cantidad_horas = parseFloat(editForm.cantidad_horas);
    }
    // Si la fecha cambió, incluirla en params
    if (editForm.fecha && editForm.fecha !== selectedJornal.fecha) {
      params.fecha = editForm.fecha;
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Adelantos</CardTitle>
              <Banknote className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-red-600">
                {formatNumber(resumen.total_adelantos, 'currency')}
              </div>
              <p className="text-xs text-muted-foreground">Descuenta del sueldo</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">HS Extras</CardTitle>
              <Timer className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-blue-600">
                {formatNumber(Number(resumen.total_monto_extras || 0), 'currency')}
              </div>
              <p className="text-xs text-muted-foreground">{Number(resumen.total_horas_extras || 0).toFixed(1)} horas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Francos</CardTitle>
              <Coffee className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-amber-600">
                {formatNumber(Number(resumen.total_monto_francos || 0), 'currency')}
              </div>
              <p className="text-xs text-muted-foreground">{Number(resumen.total_francos || 0).toFixed(1)} horas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Feriados</CardTitle>
              <PartyPopper className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-purple-600">
                {formatNumber(Number(resumen.total_monto_feriados || 0), 'currency')}
              </div>
              <p className="text-xs text-muted-foreground">{Number(resumen.total_feriados || 0).toFixed(1)} horas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Extras</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-green-600">
                {formatNumber(
                  Number(resumen.total_monto_extras || 0) +
                  Number(resumen.total_monto_francos || 0) +
                  Number(resumen.total_monto_feriados || 0),
                  'currency'
                )}
              </div>
              <p className="text-xs text-muted-foreground">Suma al sueldo</p>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-xl font-bold ${resumen.total_general >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatNumber(resumen.total_general, 'currency')}
              </div>
              <p className="text-xs text-muted-foreground">Extras - Adelantos</p>
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
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !resumen || resumen.empleados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No hay registros para este período
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full border-collapse text-sm">
                {/* Header con 2 filas */}
                <thead className="sticky top-0 z-20">
                  {/* Fila 1: Grupos principales */}
                  <tr className="bg-muted/80">
                    <th rowSpan={2} className="sticky left-0 z-30 bg-muted/80 px-4 py-3 text-left font-semibold border-b border-r border-border min-w-[200px]">
                      Empleado
                    </th>
                    <th rowSpan={2} className="bg-muted/80 px-3 py-3 text-center font-semibold border-b border-r border-border min-w-[80px]">
                      $/Hora
                    </th>
                    {/* Adelantos - 1 columna */}
                    <th className="bg-red-100 px-3 py-2 text-center font-semibold text-red-800 border-b border-red-200 min-w-[120px]">
                      <div className="flex items-center justify-center gap-2">
                        <Banknote className="h-4 w-4" />
                        Adelantos
                      </div>
                    </th>
                    {/* HS Extras - 2 columnas */}
                    <th colSpan={2} className="bg-blue-100 px-3 py-2 text-center font-semibold text-blue-800 border-b border-blue-200 min-w-[180px]">
                      <div className="flex items-center justify-center gap-2">
                        <Timer className="h-4 w-4" />
                        Horas Extras
                      </div>
                    </th>
                    {/* Francos - 2 columnas */}
                    <th colSpan={2} className="bg-amber-100 px-3 py-2 text-center font-semibold text-amber-800 border-b border-amber-200 min-w-[180px]">
                      <div className="flex items-center justify-center gap-2">
                        <Coffee className="h-4 w-4" />
                        Francos
                      </div>
                    </th>
                    {/* Feriados - 2 columnas */}
                    <th colSpan={2} className="bg-purple-100 px-3 py-2 text-center font-semibold text-purple-800 border-b border-purple-200 min-w-[180px]">
                      <div className="flex items-center justify-center gap-2">
                        <PartyPopper className="h-4 w-4" />
                        Feriados
                      </div>
                    </th>
                    {/* Totales */}
                    <th rowSpan={2} className="bg-green-100 px-3 py-3 text-center font-semibold text-green-800 border-b border-l border-green-200 min-w-[120px]">
                      <div className="flex items-center justify-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        Total +
                      </div>
                    </th>
                    <th rowSpan={2} className="bg-slate-200 px-3 py-3 text-center font-semibold border-b border-l border-slate-300 min-w-[130px]">
                      Sueldo Final
                    </th>
                    <th rowSpan={2} className="bg-muted/80 px-2 py-3 border-b border-border w-12"></th>
                  </tr>
                  {/* Fila 2: Subcolumnas */}
                  <tr className="bg-muted/50">
                    {/* Adelantos - sub */}
                    <th className="bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700 border-b border-red-200">
                      Monto
                    </th>
                    {/* HS Extras - sub */}
                    <th className="bg-blue-50 px-3 py-2 text-center text-xs font-medium text-blue-700 border-b border-l border-blue-200">
                      Horas
                    </th>
                    <th className="bg-blue-50 px-3 py-2 text-center text-xs font-medium text-blue-700 border-b border-blue-200">
                      Monto
                    </th>
                    {/* Francos - sub */}
                    <th className="bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-700 border-b border-l border-amber-200">
                      Horas
                    </th>
                    <th className="bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-700 border-b border-amber-200">
                      Monto
                    </th>
                    {/* Feriados - sub */}
                    <th className="bg-purple-50 px-3 py-2 text-center text-xs font-medium text-purple-700 border-b border-l border-purple-200">
                      Horas
                    </th>
                    <th className="bg-purple-50 px-3 py-2 text-center text-xs font-medium text-purple-700 border-b border-purple-200">
                      Monto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.empleados.map((emp) => {
                    const totalSuma = Number(emp.total_monto_extras || 0) + Number(emp.total_monto_francos || 0) + Number(emp.total_monto_feriados || 0);
                    return (
                    <>
                      <tr
                        key={emp.empleado_id}
                        className="cursor-pointer hover:bg-muted/30 border-b border-border transition-colors"
                        onClick={() => toggleExpandEmpleado(emp.empleado_id)}
                      >
                        {/* Empleado */}
                        <td className="sticky left-0 z-10 bg-background px-4 py-4 font-medium border-r border-border">
                          <div className="flex items-center gap-3">
                            <div className={`p-1 rounded ${expandedEmpleado === emp.empleado_id ? 'bg-primary/10' : 'bg-muted'}`}>
                              {expandedEmpleado === emp.empleado_id ? (
                                <ChevronUp className="h-4 w-4 text-primary" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <span className="truncate">{emp.empleado_nombre}</span>
                          </div>
                        </td>
                        {/* $/Hora */}
                        <td className="px-3 py-4 text-center border-r border-border">
                          {emp.valor_hora_extra ? (
                            <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                              ${formatNumber(emp.valor_hora_extra, 0)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </td>
                        {/* Adelantos */}
                        <td className="bg-red-50/30 px-3 py-4 text-center">
                          {Number(emp.total_adelantos || 0) > 0 ? (
                            <span className="font-semibold text-red-600">
                              -{formatNumber(emp.total_adelantos, 'currency')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        {/* HS Extras - Horas */}
                        <td className="bg-blue-50/30 px-3 py-4 text-center border-l border-blue-100">
                          {Number(emp.total_horas_extras || 0) > 0 ? (
                            <span className="font-medium text-blue-700">{Number(emp.total_horas_extras || 0)} hs</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        {/* HS Extras - Monto */}
                        <td className="bg-blue-50/30 px-3 py-4 text-center">
                          {Number(emp.total_monto_extras || 0) > 0 ? (
                            <span className="font-semibold text-blue-700">{formatNumber(emp.total_monto_extras, 'currency')}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        {/* Francos - Horas */}
                        <td className="bg-amber-50/30 px-3 py-4 text-center border-l border-amber-100">
                          {Number(emp.total_francos || 0) > 0 ? (
                            <span className="font-medium text-amber-700">{Number(emp.total_francos || 0)} hs</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        {/* Francos - Monto */}
                        <td className="bg-amber-50/30 px-3 py-4 text-center">
                          {Number(emp.total_monto_francos || 0) > 0 ? (
                            <span className="font-semibold text-amber-700">{formatNumber(emp.total_monto_francos, 'currency')}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        {/* Feriados - Horas */}
                        <td className="bg-purple-50/30 px-3 py-4 text-center border-l border-purple-100">
                          {Number(emp.total_feriados || 0) > 0 ? (
                            <span className="font-medium text-purple-700">{Number(emp.total_feriados || 0)} hs</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        {/* Feriados - Monto */}
                        <td className="bg-purple-50/30 px-3 py-4 text-center">
                          {Number(emp.total_monto_feriados || 0) > 0 ? (
                            <span className="font-semibold text-purple-700">{formatNumber(emp.total_monto_feriados, 'currency')}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        {/* Total Suma */}
                        <td className="bg-green-50/50 px-3 py-4 text-center border-l border-green-200">
                          {totalSuma > 0 ? (
                            <span className="font-bold text-green-700">+{formatNumber(totalSuma, 'currency')}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        {/* Sueldo Final */}
                        <td className="bg-slate-50 px-3 py-4 text-center border-l border-slate-200">
                          {emp.salario_base > 0 ? (
                            <span className={`font-bold text-lg ${emp.sueldo_final >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {formatNumber(emp.sueldo_final, 'currency')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Sin salario</span>
                          )}
                        </td>
                        {/* Config */}
                        <td className="px-2 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const empData = empleados.find((e) => e.id === emp.empleado_id);
                              if (empData) openConfigModal(empData);
                            }}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                      {/* Fila expandible con detalle de jornales */}
                      {expandedEmpleado === emp.empleado_id && (
                        <tr>
                          <td colSpan={13} className="bg-muted/20 p-0 border-b-2 border-primary/20">
                            <div className="p-5">
                              <h4 className="font-semibold mb-4 flex items-center gap-2 text-base">
                                <Calendar className="h-5 w-5 text-primary" />
                                Detalle de registros - {emp.empleado_nombre}
                              </h4>
                              {movimientosData?.items && movimientosData.items.length > 0 ? (
                                <div className="bg-background rounded-lg border border-border overflow-hidden">
                                  <table className="w-full">
                                    <thead>
                                      <tr className="bg-muted/50 border-b border-border">
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Fecha</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Semana</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Tipo</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Horas</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Monto</th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Acciones</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {movimientosData.items.map((mov) => (
                                        <tr key={mov.id} className="border-b border-border hover:bg-muted/30">
                                          <td className="px-4 py-3 text-sm font-medium">
                                            {mov.fecha ? formatDate(mov.fecha) : '-'}
                                          </td>
                                          <td className="px-4 py-3 text-sm">
                                            <Badge variant="outline" className="text-xs">Sem {mov.semana || '-'}</Badge>
                                          </td>
                                          <td className="px-4 py-3">
                                            {mov.tipo === 'adelanto' && (
                                              <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                                                <Banknote className="h-3 w-3 mr-1" />
                                                Adelanto
                                              </Badge>
                                            )}
                                            {mov.tipo === 'hora_extra' && (
                                              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                                                <Timer className="h-3 w-3 mr-1" />
                                                HS Extra
                                              </Badge>
                                            )}
                                            {mov.tipo === 'franco' && (
                                              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                                                <Coffee className="h-3 w-3 mr-1" />
                                                Franco
                                              </Badge>
                                            )}
                                            {mov.tipo === 'feriado' && (
                                              <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
                                                <PartyPopper className="h-3 w-3 mr-1" />
                                                Feriado
                                              </Badge>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-right text-sm">
                                            {(mov.tipo === 'hora_extra' || mov.tipo === 'franco' || mov.tipo === 'feriado')
                                              ? <span className="font-medium">{mov.cantidad_horas} hs</span>
                                              : <span className="text-muted-foreground">-</span>}
                                          </td>
                                          <td className="px-4 py-3 text-right">
                                            <span className={`font-semibold ${mov.tipo === 'adelanto' ? 'text-red-600' : 'text-green-600'}`}>
                                              {mov.tipo === 'adelanto' ? '-' : '+'}{formatNumber(mov.monto, 'currency')}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3">
                                            <div className="flex justify-center gap-1">
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
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground py-4 text-center">
                                  No hay registros para este empleado en este período
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {/* Fila de totales */}
                  <tr className="bg-muted font-bold sticky bottom-0">
                    <td className="sticky left-0 z-10 bg-muted px-4 py-4 border-r border-border text-base">
                      TOTALES
                    </td>
                    <td className="bg-muted px-3 py-4 text-center border-r border-border"></td>
                    {/* Adelantos */}
                    <td className="bg-red-200/50 px-3 py-4 text-center">
                      <span className="text-red-800 font-bold">-{formatNumber(resumen.total_adelantos, 'currency')}</span>
                    </td>
                    {/* HS Extras */}
                    <td className="bg-blue-200/50 px-3 py-4 text-center border-l border-blue-200">
                      <span className="text-blue-800 font-bold">{Number(resumen.total_horas_extras || 0)} hs</span>
                    </td>
                    <td className="bg-blue-200/50 px-3 py-4 text-center">
                      <span className="text-blue-800 font-bold">{formatNumber(resumen.total_monto_extras, 'currency')}</span>
                    </td>
                    {/* Francos */}
                    <td className="bg-amber-200/50 px-3 py-4 text-center border-l border-amber-200">
                      <span className="text-amber-800 font-bold">{Number(resumen.total_francos || 0)} hs</span>
                    </td>
                    <td className="bg-amber-200/50 px-3 py-4 text-center">
                      <span className="text-amber-800 font-bold">{formatNumber(resumen.total_monto_francos, 'currency')}</span>
                    </td>
                    {/* Feriados */}
                    <td className="bg-purple-200/50 px-3 py-4 text-center border-l border-purple-200">
                      <span className="text-purple-800 font-bold">{Number(resumen.total_feriados || 0)} hs</span>
                    </td>
                    <td className="bg-purple-200/50 px-3 py-4 text-center">
                      <span className="text-purple-800 font-bold">{formatNumber(resumen.total_monto_feriados, 'currency')}</span>
                    </td>
                    {/* Total Suma */}
                    <td className="bg-green-200/50 px-3 py-4 text-center border-l border-green-200">
                      <span className="text-green-800 font-bold text-lg">
                        +{formatNumber(
                          Number(resumen.total_monto_extras || 0) +
                          Number(resumen.total_monto_francos || 0) +
                          Number(resumen.total_monto_feriados || 0),
                          'currency'
                        )}
                      </span>
                    </td>
                    {/* Sueldo Final */}
                    <td className="bg-slate-200/50 px-3 py-4 text-center border-l border-slate-300">
                      <span className="text-muted-foreground">-</span>
                    </td>
                    <td className="bg-muted px-2 py-4"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
                  setRegistroForm({ ...registroForm, tipo: v as 'adelanto' | 'hora_extra' | 'franco' | 'feriado' })
                }
              >
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="adelanto" className="text-xs px-2">
                    <Banknote className="h-3 w-3 mr-1" />
                    Adelanto
                  </TabsTrigger>
                  <TabsTrigger value="hora_extra" className="text-xs px-2">
                    <Timer className="h-3 w-3 mr-1" />
                    HS Extra
                  </TabsTrigger>
                  <TabsTrigger value="franco" className="text-xs px-2">
                    <Coffee className="h-3 w-3 mr-1" />
                    Franco
                  </TabsTrigger>
                  <TabsTrigger value="feriado" className="text-xs px-2">
                    <PartyPopper className="h-3 w-3 mr-1" />
                    Feriado
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
                <p className="text-xs text-muted-foreground mt-1">
                  Este monto se descuenta del sueldo
                </p>
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
                  {registroForm.tipo === 'hora_extra' && 'El monto se calcula según el valor hora del empleado'}
                  {registroForm.tipo === 'franco' && 'Franco trabajado - se suma al sueldo'}
                  {registroForm.tipo === 'feriado' && 'Feriado trabajado - se suma al sueldo (generalmente x2)'}
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
                  ((registroForm.tipo === 'hora_extra' || registroForm.tipo === 'franco' || registroForm.tipo === 'feriado') && !registroForm.cantidad_horas) ||
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
                  Tipo: {selectedJornal.tipo === 'adelanto' ? 'Adelanto' : 'Horas Extras'}
                </p>
              </div>

              <div>
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={editForm.fecha}
                  onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  La semana se actualiza automáticamente según la fecha
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
                  <p>Fecha: {selectedJornal.fecha ? formatDate(selectedJornal.fecha) : '-'}</p>
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
