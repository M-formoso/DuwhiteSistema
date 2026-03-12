/**
 * Página de Liquidaciones de Sueldo
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Loader2,
  FileText,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  DollarSign,
  Receipt,
  Eye,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';

import { empleadoService } from '@/services/empleadoService';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { Liquidacion, LiquidacionCreate, EmpleadoList, Empleado } from '@/types/empleado';

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

interface LiquidacionFormData {
  empleado_id: string;
  periodo_mes: number;
  periodo_anio: number;
  fecha_liquidacion: string;
  bonificaciones: string;
  otros_haberes: string;
  otras_deducciones: string;
  observaciones: string;
}

const currentDate = new Date();

export default function LiquidacionesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Filtros
  const [filtroMes, setFiltroMes] = useState<number>(currentDate.getMonth() + 1);
  const [filtroAnio, setFiltroAnio] = useState<number>(currentDate.getFullYear());
  const [filtroEmpleado, setFiltroEmpleado] = useState<string>('');
  const [filtroPagada, setFiltroPagada] = useState<string>('all');

  // Dialogs
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPagoDialogOpen, setIsPagoDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedLiquidacion, setSelectedLiquidacion] = useState<Liquidacion | null>(null);
  const [fechaPago, setFechaPago] = useState(currentDate.toISOString().split('T')[0]);

  // Form state
  const [formData, setFormData] = useState<LiquidacionFormData>({
    empleado_id: '',
    periodo_mes: currentDate.getMonth() + 1,
    periodo_anio: currentDate.getFullYear(),
    fecha_liquidacion: currentDate.toISOString().split('T')[0],
    bonificaciones: '0',
    otros_haberes: '0',
    otras_deducciones: '0',
    observaciones: '',
  });

  // Cargar empleados activos
  const { data: empleadosData } = useQuery({
    queryKey: ['empleados-liquidaciones'],
    queryFn: () => empleadoService.getEmpleados({ solo_activos: true, limit: 200 }),
  });

  // Cargar liquidaciones
  const { data: liquidacionesData, isLoading } = useQuery({
    queryKey: ['liquidaciones', filtroMes, filtroAnio, filtroEmpleado, filtroPagada],
    queryFn: () =>
      empleadoService.getLiquidaciones({
        periodo_mes: filtroMes,
        periodo_anio: filtroAnio,
        empleado_id: filtroEmpleado || undefined,
        pagada: filtroPagada === 'all' ? undefined : filtroPagada === 'true',
        limit: 200,
      }),
  });

  // Obtener empleado seleccionado para el formulario
  const selectedEmpleado = empleadosData?.items?.find(
    (e) => e.id === formData.empleado_id
  ) as EmpleadoList | undefined;

  // Crear liquidación
  const createMutation = useMutation({
    mutationFn: (data: LiquidacionCreate) => empleadoService.createLiquidacion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidaciones'] });
      toast({ title: 'Liquidación generada', description: 'La liquidación se generó correctamente.' });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo generar la liquidación.',
        variant: 'destructive',
      });
    },
  });

  // Pagar liquidación
  const pagarMutation = useMutation({
    mutationFn: ({ id, fecha }: { id: string; fecha: string }) =>
      empleadoService.pagarLiquidacion(id, fecha),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidaciones'] });
      toast({ title: 'Pago registrado', description: 'El pago de la liquidación se registró correctamente.' });
      setIsPagoDialogOpen(false);
      setSelectedLiquidacion(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo registrar el pago.',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      empleado_id: '',
      periodo_mes: currentDate.getMonth() + 1,
      periodo_anio: currentDate.getFullYear(),
      fecha_liquidacion: currentDate.toISOString().split('T')[0],
      bonificaciones: '0',
      otros_haberes: '0',
      otras_deducciones: '0',
      observaciones: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.empleado_id) {
      toast({ title: 'Error', description: 'Selecciona un empleado.', variant: 'destructive' });
      return;
    }

    createMutation.mutate({
      empleado_id: formData.empleado_id,
      periodo_mes: formData.periodo_mes,
      periodo_anio: formData.periodo_anio,
      fecha_liquidacion: formData.fecha_liquidacion,
      bonificaciones: parseFloat(formData.bonificaciones) || 0,
      otros_haberes: parseFloat(formData.otros_haberes) || 0,
      otras_deducciones: parseFloat(formData.otras_deducciones) || 0,
      observaciones: formData.observaciones || undefined,
    });
  };

  const handlePago = () => {
    if (!selectedLiquidacion) return;
    pagarMutation.mutate({
      id: selectedLiquidacion.id,
      fecha: fechaPago,
    });
  };

  const handleOpenPagoDialog = (liquidacion: Liquidacion) => {
    setSelectedLiquidacion(liquidacion);
    setFechaPago(currentDate.toISOString().split('T')[0]);
    setIsPagoDialogOpen(true);
  };

  const handleVerDetalle = (liquidacion: Liquidacion) => {
    setSelectedLiquidacion(liquidacion);
    setIsDetailDialogOpen(true);
  };

  // Calcular totales
  const liquidaciones = liquidacionesData?.items || [];
  const totalNeto = liquidaciones.reduce((sum, l) => sum + l.neto_a_pagar, 0);
  const totalPendiente = liquidaciones.filter((l) => !l.pagada).reduce((sum, l) => sum + l.neto_a_pagar, 0);
  const totalPagado = liquidaciones.filter((l) => l.pagada).reduce((sum, l) => sum + l.neto_a_pagar, 0);
  const cantidadLiquidaciones = liquidaciones.length;

  const empleados = empleadosData?.items || [];

  // Generar años disponibles
  const anios = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Liquidaciones</h1>
          <p className="text-gray-500">Gestión de liquidaciones de sueldo</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Liquidación
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Mes</Label>
              <Select
                value={filtroMes.toString()}
                onValueChange={(v) => setFiltroMes(parseInt(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((mes) => (
                    <SelectItem key={mes.value} value={mes.value.toString()}>
                      {mes.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Año</Label>
              <Select
                value={filtroAnio.toString()}
                onValueChange={(v) => setFiltroAnio(parseInt(v))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anios.map((anio) => (
                    <SelectItem key={anio} value={anio.toString()}>
                      {anio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Empleado</Label>
              <Select value={filtroEmpleado || 'all'} onValueChange={(v) => setFiltroEmpleado(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {empleados.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nombre_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={filtroPagada} onValueChange={setFiltroPagada}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="false">Pendientes</SelectItem>
                  <SelectItem value="true">Pagadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Liquidaciones</p>
                <p className="text-2xl font-bold">{cantidadLiquidaciones}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Neto</p>
                <p className="text-2xl font-bold">{formatCurrency(totalNeto)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-100">
                <XCircle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendiente</p>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalPendiente)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pagado</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPagado)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Liquidaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Liquidaciones de Sueldo
          </CardTitle>
          <CardDescription>
            {MESES.find((m) => m.value === filtroMes)?.label} {filtroAnio}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : liquidaciones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay liquidaciones para el período seleccionado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Haberes</TableHead>
                    <TableHead className="text-right">Deducciones</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liquidaciones.map((liq) => (
                    <TableRow key={liq.id}>
                      <TableCell>
                        <span className="font-mono text-sm">#{liq.numero}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{liq.empleado_nombre || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(liq.fecha_liquidacion)}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(liq.total_haberes)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(liq.total_deducciones)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(liq.neto_a_pagar)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={liq.pagada ? 'success' : 'warning'}>
                          {liq.pagada ? 'Pagada' : 'Pendiente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleVerDetalle(liq)}
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {!liq.pagada && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenPagoDialog(liq)}
                            >
                              Pagar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Crear Liquidación */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva Liquidación de Sueldo</DialogTitle>
            <DialogDescription>
              Genera una liquidación para un empleado
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="empleado_id">
                Empleado <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.empleado_id}
                onValueChange={(v) => setFormData({ ...formData, empleado_id: v })}
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

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Mes</Label>
                <Select
                  value={formData.periodo_mes.toString()}
                  onValueChange={(v) =>
                    setFormData({ ...formData, periodo_mes: parseInt(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((mes) => (
                      <SelectItem key={mes.value} value={mes.value.toString()}>
                        {mes.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Año</Label>
                <Select
                  value={formData.periodo_anio.toString()}
                  onValueChange={(v) =>
                    setFormData({ ...formData, periodo_anio: parseInt(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anios.map((anio) => (
                      <SelectItem key={anio} value={anio.toString()}>
                        {anio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={formData.fecha_liquidacion}
                  onChange={(e) =>
                    setFormData({ ...formData, fecha_liquidacion: e.target.value })
                  }
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Bonificaciones</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.bonificaciones}
                  onChange={(e) =>
                    setFormData({ ...formData, bonificaciones: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Otros Haberes</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.otros_haberes}
                  onChange={(e) =>
                    setFormData({ ...formData, otros_haberes: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Otras Deducciones</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.otras_deducciones}
                  onChange={(e) =>
                    setFormData({ ...formData, otras_deducciones: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observaciones (opcional)</Label>
              <Textarea
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                placeholder="Notas adicionales"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generar Liquidación
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Pago */}
      <Dialog open={isPagoDialogOpen} onOpenChange={setIsPagoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago de Liquidación</DialogTitle>
            <DialogDescription>
              {selectedLiquidacion && (
                <>
                  {selectedLiquidacion.empleado_nombre} - Liquidación #{selectedLiquidacion.numero}
                  <br />
                  Neto a pagar: <strong>{formatCurrency(selectedLiquidacion.neto_a_pagar)}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fecha_pago">Fecha de Pago</Label>
              <Input
                id="fecha_pago"
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPagoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePago} disabled={pagarMutation.isPending}>
              {pagarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalle */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de Liquidación</DialogTitle>
            <DialogDescription>
              {selectedLiquidacion && (
                <>
                  {selectedLiquidacion.empleado_nombre} - Liquidación #{selectedLiquidacion.numero}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedLiquidacion && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Período</p>
                  <p className="font-medium">
                    {MESES.find((m) => m.value === selectedLiquidacion.periodo_mes)?.label}{' '}
                    {selectedLiquidacion.periodo_anio}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha Liquidación</p>
                  <p className="font-medium">{formatDate(selectedLiquidacion.fecha_liquidacion)}</p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="font-medium mb-2">Haberes</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Salario Base</span>
                    <span>{formatCurrency(selectedLiquidacion.salario_base)}</span>
                  </div>
                  {selectedLiquidacion.horas_extra_monto && (
                    <div className="flex justify-between">
                      <span>
                        Horas Extra ({selectedLiquidacion.horas_extra_cantidad}hs)
                      </span>
                      <span>{formatCurrency(selectedLiquidacion.horas_extra_monto)}</span>
                    </div>
                  )}
                  {selectedLiquidacion.bonificaciones && (
                    <div className="flex justify-between">
                      <span>Bonificaciones</span>
                      <span>{formatCurrency(selectedLiquidacion.bonificaciones)}</span>
                    </div>
                  )}
                  {selectedLiquidacion.otros_haberes && (
                    <div className="flex justify-between">
                      <span>Otros Haberes</span>
                      <span>{formatCurrency(selectedLiquidacion.otros_haberes)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium pt-1 border-t">
                    <span>Total Haberes</span>
                    <span className="text-green-600">
                      {formatCurrency(selectedLiquidacion.total_haberes)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p className="font-medium mb-2">Deducciones</p>
                <div className="space-y-1 text-sm">
                  {selectedLiquidacion.jubilacion && (
                    <div className="flex justify-between">
                      <span>Jubilación</span>
                      <span>{formatCurrency(selectedLiquidacion.jubilacion)}</span>
                    </div>
                  )}
                  {selectedLiquidacion.obra_social && (
                    <div className="flex justify-between">
                      <span>Obra Social</span>
                      <span>{formatCurrency(selectedLiquidacion.obra_social)}</span>
                    </div>
                  )}
                  {selectedLiquidacion.sindicato && (
                    <div className="flex justify-between">
                      <span>Sindicato</span>
                      <span>{formatCurrency(selectedLiquidacion.sindicato)}</span>
                    </div>
                  )}
                  {selectedLiquidacion.ganancias && (
                    <div className="flex justify-between">
                      <span>Ganancias</span>
                      <span>{formatCurrency(selectedLiquidacion.ganancias)}</span>
                    </div>
                  )}
                  {selectedLiquidacion.adelantos && (
                    <div className="flex justify-between">
                      <span>Adelantos</span>
                      <span>{formatCurrency(selectedLiquidacion.adelantos)}</span>
                    </div>
                  )}
                  {selectedLiquidacion.otras_deducciones && (
                    <div className="flex justify-between">
                      <span>Otras Deducciones</span>
                      <span>{formatCurrency(selectedLiquidacion.otras_deducciones)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium pt-1 border-t">
                    <span>Total Deducciones</span>
                    <span className="text-red-600">
                      {formatCurrency(selectedLiquidacion.total_deducciones)}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span>Neto a Pagar</span>
                <span>{formatCurrency(selectedLiquidacion.neto_a_pagar)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Estado</span>
                <Badge variant={selectedLiquidacion.pagada ? 'success' : 'warning'}>
                  {selectedLiquidacion.pagada ? 'Pagada' : 'Pendiente'}
                </Badge>
              </div>

              {selectedLiquidacion.pagada && selectedLiquidacion.fecha_pago && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fecha de Pago</span>
                  <span>{formatDate(selectedLiquidacion.fecha_pago)}</span>
                </div>
              )}

              {selectedLiquidacion.observaciones && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Observaciones</p>
                  <p className="text-sm">{selectedLiquidacion.observaciones}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
