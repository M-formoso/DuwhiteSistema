/**
 * Página de Órdenes de Pago - Con gestión de proveedores y deudas
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Eye,
  Check,
  DollarSign,
  Building2,
  Calendar,
  Clock,
  Filter,
  FileText,
  Search,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Banknote,
  CreditCard,
  FileCheck,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

import { ordenesPagoService, cuentaCorrienteProveedorService } from '@/services/finanzasAvanzadasService';
import { proveedorService } from '@/services/proveedorService';
import { formatNumber, formatDate } from '@/utils/formatters';
import { ESTADOS_ORDEN_PAGO, MEDIOS_PAGO } from '@/types/finanzas-avanzadas';
import type { OrdenPagoList, EstadoOrdenPago, MedioPago } from '@/types/finanzas-avanzadas';

export default function OrdenesPagoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('resumen');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(0);
  const limite = 20;

  // Modal de pago
  const [ordenPagar, setOrdenPagar] = useState<OrdenPagoList | null>(null);
  const [medioPago, setMedioPago] = useState<MedioPago>('transferencia');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [chequeNumero, setChequeNumero] = useState('');

  // Query órdenes
  const { data: ordenesData, isLoading } = useQuery({
    queryKey: ['ordenes-pago', filtroEstado, pagina],
    queryFn: () =>
      ordenesPagoService.getOrdenes({
        skip: pagina * limite,
        limit: limite,
        estado: filtroEstado !== 'todos' ? filtroEstado : undefined,
      }),
  });

  // Query resumen
  const { data: resumen } = useQuery({
    queryKey: ['ordenes-pago-resumen'],
    queryFn: () => ordenesPagoService.getResumen(),
  });

  // Query proveedores con saldo
  const { data: proveedoresData } = useQuery({
    queryKey: ['proveedores-lista-saldo'],
    queryFn: () => proveedorService.getProveedores({ limit: 100, solo_activos: true }),
  });

  // Query análisis de vencimientos
  const { data: vencimientos } = useQuery({
    queryKey: ['analisis-vencimientos'],
    queryFn: () => cuentaCorrienteProveedorService.getAnalisisVencimientos(),
  });

  // Mutations
  const confirmarMutation = useMutation({
    mutationFn: (ordenId: string) => ordenesPagoService.confirmar(ordenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-pago'] });
      toast({ title: 'Orden confirmada', description: 'La orden de pago ha sido confirmada.' });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo confirmar la orden.',
        variant: 'destructive',
      });
    },
  });

  const pagarMutation = useMutation({
    mutationFn: ({ ordenId, data }: { ordenId: string; data: any }) =>
      ordenesPagoService.pagar(ordenId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-pago'] });
      queryClient.invalidateQueries({ queryKey: ['ordenes-pago-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['proveedores-lista-saldo'] });
      toast({ title: 'Pago registrado', description: 'El pago ha sido procesado correctamente.' });
      setOrdenPagar(null);
      setReferenciaPago('');
      setChequeNumero('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo procesar el pago.',
        variant: 'destructive',
      });
    },
  });

  const ordenes = ordenesData?.items || [];
  const total = ordenesData?.total || 0;

  // Filtrar proveedores con deuda
  const proveedoresConDeuda = proveedoresData?.items?.filter(
    (p) => (p.saldo_cuenta_corriente || 0) > 0
  ) || [];
  const totalDeudaProveedores = proveedoresConDeuda.reduce(
    (sum, p) => sum + (p.saldo_cuenta_corriente || 0),
    0
  );

  const getEstadoBadge = (estado: EstadoOrdenPago) => {
    const config = ESTADOS_ORDEN_PAGO.find((e) => e.value === estado);
    const colors: Record<string, string> = {
      gray: 'bg-gray-100 text-gray-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
    };
    return <Badge className={colors[config?.color || 'gray']}>{config?.label || estado}</Badge>;
  };

  const getMedioPagoIcon = (medio: string) => {
    switch (medio) {
      case 'efectivo':
        return <Banknote className="h-4 w-4 text-green-600" />;
      case 'transferencia':
        return <CreditCard className="h-4 w-4 text-blue-600" />;
      case 'cheque':
        return <FileCheck className="h-4 w-4 text-purple-600" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const handlePagar = () => {
    if (!ordenPagar) return;
    pagarMutation.mutate({
      ordenId: ordenPagar.id,
      data: {
        fecha_pago: new Date().toLocaleDateString('en-CA'),
        medio_pago: medioPago,
        referencia_pago: medioPago === 'cheque' ? chequeNumero : referenciaPago || undefined,
      },
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Órdenes de Pago</h1>
          <p className="text-muted-foreground">
            Gestión de pagos y deudas con proveedores
          </p>
        </div>
        <Button onClick={() => navigate('/finanzas/ordenes-pago/nueva')}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Orden de Pago
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="ordenes">Órdenes</TabsTrigger>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
        </TabsList>

        {/* Tab Resumen */}
        <TabsContent value="resumen" className="space-y-6">
          {/* Cards principales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-red-50 border-red-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-red-800">Deuda Total a Proveedores</CardTitle>
                <TrendingUp className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatNumber(totalDeudaProveedores, 'currency')}
                </div>
                <p className="text-xs text-red-600">
                  {proveedoresConDeuda.length} proveedor(es) con saldo
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendientes de Pago</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatNumber(resumen?.total_confirmadas || 0, 'currency')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {resumen?.cantidad_confirmadas || 0} órdenes confirmadas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pagado este Mes</CardTitle>
                <Check className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatNumber(resumen?.total_pagadas || 0, 'currency')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {resumen?.cantidad_pagadas || 0} órdenes pagadas
                </p>
              </CardContent>
            </Card>

            <Card className="bg-amber-50 border-amber-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-amber-800">Vencimientos Próximos</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {formatNumber(vencimientos?.monto_vencido || 0, 'currency')}
                </div>
                <p className="text-xs text-amber-600">
                  {vencimientos?.cantidad_vencidos || 0} vencido(s) | {vencimientos?.cantidad_proximos || 0} próximo(s)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Vencimientos */}
          {(vencimientos?.vencidos?.length || 0) > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  Pagos Vencidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {vencimientos?.vencidos?.slice(0, 5).map((v: any) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{v.proveedor_nombre}</p>
                        <p className="text-sm text-red-600">
                          Venció {formatDate(v.fecha_vencimiento)} - {v.concepto}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-red-600">
                        {formatNumber(v.monto, 'currency')}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Proveedores con mayor deuda */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Proveedores con Mayor Deuda
              </CardTitle>
            </CardHeader>
            <CardContent>
              {proveedoresConDeuda.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No hay deudas pendientes con proveedores
                </p>
              ) : (
                <div className="space-y-3">
                  {proveedoresConDeuda
                    .sort((a, b) => (b.saldo_cuenta_corriente || 0) - (a.saldo_cuenta_corriente || 0))
                    .slice(0, 5)
                    .map((prov) => (
                      <div
                        key={prov.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/finanzas/cuenta-corriente-proveedor/${prov.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <Building2 className="h-5 w-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium">{prov.razon_social}</p>
                            <p className="text-sm text-muted-foreground">
                              CUIT: {prov.cuit || '-'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-lg font-bold text-red-600">
                            {formatNumber(prov.saldo_cuenta_corriente || 0, 'currency')}
                          </p>
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Últimos pagos realizados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-green-600" />
                Últimos Pagos Realizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordenes.filter((o) => o.estado === 'pagada').length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No hay pagos registrados
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Medio</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordenes
                      .filter((o) => o.estado === 'pagada')
                      .slice(0, 5)
                      .map((orden) => (
                        <TableRow key={orden.id}>
                          <TableCell>{formatDate(orden.fecha_pago || orden.fecha_emision)}</TableCell>
                          <TableCell>{orden.proveedor_nombre}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getMedioPagoIcon(orden.medio_pago || 'efectivo')}
                              <span className="capitalize">{orden.medio_pago || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold text-green-600">
                            {formatNumber(orden.monto_total, 'currency')}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Órdenes */}
        <TabsContent value="ordenes" className="space-y-4">
          {/* Resumen rápido */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">En Borrador</CardTitle>
                <FileText className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(resumen?.total_borrador || 0, 'currency')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {resumen?.cantidad_borrador || 0} órdenes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Confirmadas</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatNumber(resumen?.total_confirmadas || 0, 'currency')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {resumen?.cantidad_confirmadas || 0} pendientes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pagadas</CardTitle>
                <Check className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatNumber(resumen?.total_pagadas || 0, 'currency')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {resumen?.cantidad_pagadas || 0} completadas
                </p>
              </CardContent>
            </Card>

            <Card className="bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Por Pagar</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {formatNumber(
                    (resumen?.total_borrador || 0) + (resumen?.total_confirmadas || 0),
                    'currency'
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Total pendiente</p>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por número o proveedor..."
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="w-48">
                  <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                    <SelectTrigger>
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los estados</SelectItem>
                      {ESTADOS_ORDEN_PAGO.map((estado) => (
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

          {/* Tabla */}
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="text-center py-8">Cargando...</div>
              ) : ordenes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay órdenes de pago.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Fecha Emisión</TableHead>
                      <TableHead>Fecha Pago</TableHead>
                      <TableHead>Medio</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordenes.map((orden: OrdenPagoList) => (
                      <TableRow key={orden.id}>
                        <TableCell className="font-medium">{orden.numero}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {orden.proveedor_nombre}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(orden.fecha_emision)}</TableCell>
                        <TableCell>
                          {orden.fecha_pago
                            ? formatDate(orden.fecha_pago)
                            : orden.fecha_pago_programada
                            ? formatDate(orden.fecha_pago_programada)
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {orden.medio_pago ? (
                            <div className="flex items-center gap-2">
                              {getMedioPagoIcon(orden.medio_pago)}
                              <span className="capitalize text-sm">{orden.medio_pago}</span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>{getEstadoBadge(orden.estado)}</TableCell>
                        <TableCell className="text-right font-bold">
                          {formatNumber(orden.monto_total, 'currency')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/finanzas/ordenes-pago/${orden.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {orden.estado === 'borrador' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => confirmarMutation.mutate(orden.id)}
                              >
                                <Check className="h-4 w-4 text-blue-500" />
                              </Button>
                            )}
                            {orden.estado === 'confirmada' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setOrdenPagar(orden)}
                              >
                                <DollarSign className="h-4 w-4 text-green-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Paginación */}
              {total > limite && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {pagina * limite + 1} - {Math.min((pagina + 1) * limite, total)} de{' '}
                    {total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagina((p) => Math.max(0, p - 1))}
                      disabled={pagina === 0}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagina((p) => p + 1)}
                      disabled={(pagina + 1) * limite >= total}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Proveedores */}
        <TabsContent value="proveedores" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Proveedores con Saldo Pendiente</CardTitle>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Deuda Total</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatNumber(totalDeudaProveedores, 'currency')}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {proveedoresConDeuda.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay proveedores con deuda pendiente
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>CUIT</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proveedoresConDeuda
                      .sort((a, b) => (b.saldo_cuenta_corriente || 0) - (a.saldo_cuenta_corriente || 0))
                      .map((prov) => (
                        <TableRow key={prov.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{prov.razon_social}</span>
                            </div>
                          </TableCell>
                          <TableCell>{prov.cuit || '-'}</TableCell>
                          <TableCell>
                            {prov.telefono || prov.email || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-bold text-red-600">
                              {formatNumber(prov.saldo_cuenta_corriente || 0, 'currency')}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/finanzas/cuenta-corriente-proveedor/${prov.id}`)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Ver Cuenta
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => navigate(`/finanzas/ordenes-pago/nueva?proveedor=${prov.id}`)}
                              >
                                <DollarSign className="h-4 w-4 mr-1" />
                                Pagar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Pago */}
      <Dialog open={!!ordenPagar} onOpenChange={() => setOrdenPagar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              Orden {ordenPagar?.numero} - {ordenPagar?.proveedor_nombre}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Monto a pagar</p>
              <p className="text-3xl font-bold">
                {formatNumber(ordenPagar?.monto_total || 0, 'currency')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Medio de Pago</Label>
              <Select value={medioPago} onValueChange={(v) => setMedioPago(v as MedioPago)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEDIOS_PAGO.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex items-center gap-2">
                        {getMedioPagoIcon(m.value)}
                        {m.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {medioPago === 'cheque' && (
              <div className="space-y-2">
                <Label>Número de Cheque</Label>
                <Input
                  value={chequeNumero}
                  onChange={(e) => setChequeNumero(e.target.value)}
                  placeholder="Ej: 00012345"
                />
              </div>
            )}

            {medioPago === 'transferencia' && (
              <div className="space-y-2">
                <Label>Referencia / Comprobante</Label>
                <Input
                  value={referenciaPago}
                  onChange={(e) => setReferenciaPago(e.target.value)}
                  placeholder="Nro. de transferencia..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrdenPagar(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handlePagar}
              disabled={pagarMutation.isPending || (medioPago === 'cheque' && !chequeNumero)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
