/**
 * Página de Nómina - Movimientos de pago a empleados
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Loader2,
  DollarSign,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  Filter,
  CreditCard,
  TrendingUp,
  TrendingDown,
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
import { useToast } from '@/components/ui/use-toast';

import { empleadoService } from '@/services/empleadoService';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { MovimientoNomina, MovimientoNominaCreate, EmpleadoList } from '@/types/empleado';
import { TIPOS_MOVIMIENTO_NOMINA } from '@/types/empleado';

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

const MEDIOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cheque', label: 'Cheque' },
];

interface MovimientoFormData {
  empleado_id: string;
  tipo: string;
  concepto: string;
  descripcion: string;
  periodo_mes: number;
  periodo_anio: number;
  monto: string;
  es_debito: boolean;
}

interface PagoFormData {
  fecha_pago: string;
  medio_pago: string;
  comprobante: string;
  registrar_en_caja: boolean;
}

const currentDate = new Date();

export default function NominaPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Filtros
  const [filtroMes, setFiltroMes] = useState<number>(currentDate.getMonth() + 1);
  const [filtroAnio, setFiltroAnio] = useState<number>(currentDate.getFullYear());
  const [filtroEmpleado, setFiltroEmpleado] = useState<string>('');
  const [filtroPagado, setFiltroPagado] = useState<string>('all');

  // Dialogs
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPagoDialogOpen, setIsPagoDialogOpen] = useState(false);
  const [selectedMovimiento, setSelectedMovimiento] = useState<MovimientoNomina | null>(null);

  // Form state
  const [formData, setFormData] = useState<MovimientoFormData>({
    empleado_id: '',
    tipo: 'salario',
    concepto: '',
    descripcion: '',
    periodo_mes: currentDate.getMonth() + 1,
    periodo_anio: currentDate.getFullYear(),
    monto: '',
    es_debito: false,
  });

  const [pagoData, setPagoData] = useState<PagoFormData>({
    fecha_pago: currentDate.toISOString().split('T')[0],
    medio_pago: 'efectivo',
    comprobante: '',
    registrar_en_caja: true,
  });

  // Cargar empleados activos
  const { data: empleadosData } = useQuery({
    queryKey: ['empleados-nomina'],
    queryFn: () => empleadoService.getEmpleados({ solo_activos: true, limit: 200 }),
  });

  // Cargar movimientos
  const { data: movimientosData, isLoading } = useQuery({
    queryKey: ['movimientos-nomina', filtroMes, filtroAnio, filtroEmpleado, filtroPagado],
    queryFn: () =>
      empleadoService.getMovimientosNomina({
        periodo_mes: filtroMes,
        periodo_anio: filtroAnio,
        empleado_id: filtroEmpleado || undefined,
        pagado: filtroPagado === 'all' ? undefined : filtroPagado === 'true',
        limit: 200,
      }),
  });

  // Crear movimiento
  const createMutation = useMutation({
    mutationFn: (data: MovimientoNominaCreate) => empleadoService.createMovimientoNomina(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientos-nomina'] });
      toast({ title: 'Movimiento creado', description: 'El movimiento se registró correctamente.' });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear el movimiento.',
        variant: 'destructive',
      });
    },
  });

  // Pagar movimiento
  const pagarMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PagoFormData }) =>
      empleadoService.pagarMovimientoNomina(id, {
        fecha_pago: data.fecha_pago,
        medio_pago: data.medio_pago,
        comprobante: data.comprobante || undefined,
        registrar_en_caja: data.registrar_en_caja,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientos-nomina'] });
      toast({ title: 'Pago registrado', description: 'El pago se registró correctamente.' });
      setIsPagoDialogOpen(false);
      setSelectedMovimiento(null);
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
      tipo: 'salario',
      concepto: '',
      descripcion: '',
      periodo_mes: currentDate.getMonth() + 1,
      periodo_anio: currentDate.getFullYear(),
      monto: '',
      es_debito: false,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.empleado_id) {
      toast({ title: 'Error', description: 'Selecciona un empleado.', variant: 'destructive' });
      return;
    }
    if (!formData.concepto.trim()) {
      toast({ title: 'Error', description: 'Ingresa un concepto.', variant: 'destructive' });
      return;
    }
    if (!formData.monto || parseFloat(formData.monto) <= 0) {
      toast({ title: 'Error', description: 'Ingresa un monto válido.', variant: 'destructive' });
      return;
    }

    createMutation.mutate({
      empleado_id: formData.empleado_id,
      tipo: formData.tipo as any,
      concepto: formData.concepto,
      descripcion: formData.descripcion || undefined,
      periodo_mes: formData.periodo_mes,
      periodo_anio: formData.periodo_anio,
      monto: parseFloat(formData.monto),
      es_debito: formData.es_debito,
    });
  };

  const handlePago = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovimiento) return;

    pagarMutation.mutate({
      id: selectedMovimiento.id,
      data: pagoData,
    });
  };

  const handleOpenPagoDialog = (movimiento: MovimientoNomina) => {
    setSelectedMovimiento(movimiento);
    setPagoData({
      fecha_pago: currentDate.toISOString().split('T')[0],
      medio_pago: 'efectivo',
      comprobante: '',
      registrar_en_caja: true,
    });
    setIsPagoDialogOpen(true);
  };

  // Calcular totales
  const movimientos = movimientosData?.items || [];
  const totalHaberes = movimientos.filter((m) => !m.es_debito).reduce((sum, m) => sum + m.monto, 0);
  const totalDescuentos = movimientos.filter((m) => m.es_debito).reduce((sum, m) => sum + m.monto, 0);
  const totalPendiente = movimientos.filter((m) => !m.pagado).reduce((sum, m) => sum + m.monto, 0);
  const totalPagado = movimientos.filter((m) => m.pagado).reduce((sum, m) => sum + m.monto, 0);

  const empleados = empleadosData?.items || [];

  // Generar años disponibles
  const anios = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nómina</h1>
          <p className="text-gray-500">Gestión de movimientos de nómina y pagos</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Movimiento
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
              <Select value={filtroPagado} onValueChange={setFiltroPagado}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="false">Pendientes</SelectItem>
                  <SelectItem value="true">Pagados</SelectItem>
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
              <div className="p-3 rounded-full bg-green-100">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Haberes</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalHaberes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-100">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Descuentos</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDescuentos)}</p>
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
                <p className="text-sm text-muted-foreground">Pendiente de Pago</p>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalPendiente)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ya Pagado</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalPagado)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Movimientos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Movimientos de Nómina
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
          ) : movimientos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay movimientos para el período seleccionado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead>Fecha Pago</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{mov.empleado_nombre || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {TIPOS_MOVIMIENTO_NOMINA.find((t) => t.value === mov.tipo)?.label ||
                            mov.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{mov.concepto}</p>
                          {mov.descripcion && (
                            <p className="text-xs text-muted-foreground">{mov.descripcion}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-medium ${mov.es_debito ? 'text-red-600' : 'text-green-600'}`}
                        >
                          {mov.es_debito ? '-' : '+'}
                          {formatCurrency(mov.monto)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={mov.pagado ? 'success' : 'warning'}>
                          {mov.pagado ? 'Pagado' : 'Pendiente'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {mov.fecha_pago ? formatDate(mov.fecha_pago) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {!mov.pagado && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPagoDialog(mov)}
                          >
                            <CreditCard className="h-4 w-4 mr-1" />
                            Pagar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Crear Movimiento */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Movimiento de Nómina</DialogTitle>
            <DialogDescription>
              Registra un haber o descuento para un empleado
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="periodo_mes">Mes</Label>
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
                <Label htmlFor="periodo_anio">Año</Label>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(v) => setFormData({ ...formData, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_MOVIMIENTO_NOMINA.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Es Descuento</Label>
                <Select
                  value={formData.es_debito ? 'true' : 'false'}
                  onValueChange={(v) => setFormData({ ...formData, es_debito: v === 'true' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">No (Haber)</SelectItem>
                    <SelectItem value="true">Sí (Descuento)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="concepto">
                Concepto <span className="text-destructive">*</span>
              </Label>
              <Input
                id="concepto"
                value={formData.concepto}
                onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
                placeholder="Ej: Salario Febrero 2024"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monto">
                Monto <span className="text-destructive">*</span>
              </Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                min="0"
                value={formData.monto}
                onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción (opcional)</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
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
                Crear Movimiento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Registrar Pago */}
      <Dialog open={isPagoDialogOpen} onOpenChange={setIsPagoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              {selectedMovimiento && (
                <>
                  {selectedMovimiento.empleado_nombre} - {selectedMovimiento.concepto}
                  <br />
                  Monto: <strong>{formatCurrency(selectedMovimiento.monto)}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePago} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fecha_pago">Fecha de Pago</Label>
              <Input
                id="fecha_pago"
                type="date"
                value={pagoData.fecha_pago}
                onChange={(e) => setPagoData({ ...pagoData, fecha_pago: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="medio_pago">Medio de Pago</Label>
              <Select
                value={pagoData.medio_pago}
                onValueChange={(v) => setPagoData({ ...pagoData, medio_pago: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEDIOS_PAGO.map((medio) => (
                    <SelectItem key={medio.value} value={medio.value}>
                      {medio.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comprobante">N° Comprobante (opcional)</Label>
              <Input
                id="comprobante"
                value={pagoData.comprobante}
                onChange={(e) => setPagoData({ ...pagoData, comprobante: e.target.value })}
                placeholder="N° de recibo o comprobante"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="registrar_en_caja"
                checked={pagoData.registrar_en_caja}
                onChange={(e) =>
                  setPagoData({ ...pagoData, registrar_en_caja: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <Label htmlFor="registrar_en_caja" className="text-sm">
                Registrar egreso en caja
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPagoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pagarMutation.isPending}>
                {pagarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Pago
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
