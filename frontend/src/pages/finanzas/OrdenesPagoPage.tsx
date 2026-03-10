/**
 * Página de Órdenes de Pago
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Eye,
  Check,
  DollarSign,
  Ban,
  Building2,
  Calendar,
  Clock,
  Filter,
  FileText,
  Search,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

import { ordenesPagoService } from '@/services/finanzasAvanzadasService';
import { formatNumber, formatDate } from '@/utils/formatters';
import { ESTADOS_ORDEN_PAGO, MEDIOS_PAGO } from '@/types/finanzas-avanzadas';
import type { OrdenPagoList, EstadoOrdenPago, MedioPago } from '@/types/finanzas-avanzadas';

export default function OrdenesPagoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(0);
  const limite = 20;

  // Modal de pago
  const [ordenPagar, setOrdenPagar] = useState<OrdenPagoList | null>(null);
  const [medioPago, setMedioPago] = useState<MedioPago>('transferencia');
  const [referenciaPago, setReferenciaPago] = useState('');

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
      toast({ title: 'Pago registrado', description: 'El pago ha sido procesado correctamente.' });
      setOrdenPagar(null);
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

  const handlePagar = () => {
    if (!ordenPagar) return;
    pagarMutation.mutate({
      ordenId: ordenPagar.id,
      data: {
        fecha_pago: new Date().toISOString().split('T')[0],
        medio_pago: medioPago,
        referencia_pago: referenciaPago || undefined,
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
            Gestión de pagos a proveedores
          </p>
        </div>
        <Button onClick={() => navigate('/finanzas/ordenes-pago/nueva')}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Orden de Pago
        </Button>
      </div>

      {/* Resumen */}
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
              {resumen?.cantidad_confirmadas || 0} pendientes de pago
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
            <p className="text-xs text-muted-foreground">
              Total pendiente
            </p>
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
                  <TableHead>Fecha Pago Prog.</TableHead>
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
                      {orden.fecha_pago_programada
                        ? formatDate(orden.fecha_pago_programada)
                        : '-'}
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
              <label className="text-sm font-medium">Medio de Pago</label>
              <Select value={medioPago} onValueChange={(v) => setMedioPago(v as MedioPago)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEDIOS_PAGO.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Referencia / Comprobante</label>
              <Input
                value={referenciaPago}
                onChange={(e) => setReferenciaPago(e.target.value)}
                placeholder="Número de transferencia, cheque, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrdenPagar(null)}>
              Cancelar
            </Button>
            <Button onClick={handlePagar} disabled={pagarMutation.isPending}>
              <DollarSign className="h-4 w-4 mr-2" />
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
