/**
 * Página de Cuenta Corriente de Proveedores
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  TrendingDown,
  TrendingUp,
  Calendar,
  AlertTriangle,
  DollarSign,
  Clock,
  Search,
  Filter,
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Receipt, Loader2 } from 'lucide-react';

import { cuentaCorrienteProveedorService } from '@/services/finanzasAvanzadasService';
import { proveedorService } from '@/services/proveedorService';
import { formatNumber, formatDate } from '@/utils/formatters';
import { TIPOS_MOVIMIENTO_CC_PROVEEDOR } from '@/types/finanzas-avanzadas';
import type {
  MovimientoCCProveedorList,
  TipoMovimientoCCProveedor,
  EstadoPagoProveedor,
} from '@/types/finanzas-avanzadas';

export default function CuentaCorrienteProveedorPage() {
  const navigate = useNavigate();
  const { proveedorId } = useParams<{ proveedorId: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(0);
  const limite = 20;

  // Nota de crédito modal
  const [ncOpen, setNcOpen] = useState(false);
  const [ncMonto, setNcMonto] = useState('');
  const [ncConcepto, setNcConcepto] = useState('');
  const [ncFactura, setNcFactura] = useState('');
  const [ncFecha, setNcFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [ncCargoId, setNcCargoId] = useState<string>('_none');
  const [ncNotas, setNcNotas] = useState('');

  // Query comprobantes pendientes para imputar la NC
  const { data: comprobantesPendientes = [] } = useQuery({
    queryKey: ['cc-proveedor-pendientes', proveedorId],
    queryFn: () => cuentaCorrienteProveedorService.getComprobantesPendientes(proveedorId!),
    enabled: Boolean(proveedorId) && ncOpen,
  });

  const resetNcForm = () => {
    setNcMonto('');
    setNcConcepto('');
    setNcFactura('');
    setNcFecha(new Date().toISOString().slice(0, 10));
    setNcCargoId('_none');
    setNcNotas('');
  };

  const ncMutation = useMutation({
    mutationFn: () =>
      cuentaCorrienteProveedorService.registrarNotaCredito(proveedorId!, {
        monto: parseFloat(ncMonto),
        concepto: ncConcepto.trim(),
        fecha_movimiento: ncFecha,
        factura_numero: ncFactura.trim() || null,
        movimiento_cargo_id: ncCargoId === '_none' ? null : ncCargoId,
        notas: ncNotas.trim() || null,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['cc-proveedor-estado', proveedorId] });
      queryClient.invalidateQueries({ queryKey: ['cc-proveedor-movimientos', proveedorId] });
      queryClient.invalidateQueries({ queryKey: ['cc-proveedor-pendientes', proveedorId] });
      toast({
        title: 'Nota de crédito registrada',
        description: `Saldo posterior: ${formatNumber(res.saldo_posterior, 'currency')}`,
      });
      resetNcForm();
      setNcOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err?.response?.data?.detail || err?.message || 'No se pudo registrar la NC.',
        variant: 'destructive',
      });
    },
  });

  const ncMontoNum = parseFloat(ncMonto) || 0;
  const ncValid = ncMontoNum > 0 && ncConcepto.trim().length > 0 && !!ncFecha;

  // Query proveedor
  const { data: proveedor } = useQuery({
    queryKey: ['proveedor', proveedorId],
    queryFn: () => proveedorService.getProveedor(proveedorId!),
    enabled: Boolean(proveedorId),
  });

  // Query estado de cuenta
  const { data: estadoCuenta, isLoading } = useQuery({
    queryKey: ['cc-proveedor-estado', proveedorId],
    queryFn: () => cuentaCorrienteProveedorService.getEstadoCuenta(proveedorId!),
    enabled: Boolean(proveedorId),
  });

  // Query movimientos
  const { data: movimientosData } = useQuery({
    queryKey: ['cc-proveedor-movimientos', proveedorId, filtroTipo, pagina],
    queryFn: () =>
      cuentaCorrienteProveedorService.getMovimientos(proveedorId!, {
        skip: pagina * limite,
        limit: limite,
        tipo: filtroTipo !== 'todos' ? filtroTipo : undefined,
      }),
    enabled: Boolean(proveedorId),
  });

  const movimientos = movimientosData?.items || [];
  const total = movimientosData?.total || 0;

  const getTipoBadge = (tipo: TipoMovimientoCCProveedor) => {
    const config = TIPOS_MOVIMIENTO_CC_PROVEEDOR.find((t) => t.value === tipo);
    const colors: Record<string, string> = {
      red: 'bg-red-100 text-red-800',
      green: 'bg-green-100 text-green-800',
      blue: 'bg-blue-100 text-blue-800',
      orange: 'bg-orange-100 text-orange-800',
    };
    return (
      <Badge className={colors[config?.color || 'gray']}>
        {config?.label || tipo}
      </Badge>
    );
  };

  const getEstadoPagoBadge = (estado: EstadoPagoProveedor | null) => {
    if (!estado) return null;
    const colors: Record<string, string> = {
      pendiente: 'bg-yellow-100 text-yellow-800',
      parcial: 'bg-blue-100 text-blue-800',
      pagado: 'bg-green-100 text-green-800',
    };
    const labels: Record<string, string> = {
      pendiente: 'Pendiente',
      parcial: 'Parcial',
      pagado: 'Pagado',
    };
    return <Badge className={colors[estado]}>{labels[estado]}</Badge>;
  };

  if (!proveedorId) {
    return (
      <div className="container mx-auto py-6 text-center">
        <p>Seleccione un proveedor para ver su cuenta corriente.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Cuenta Corriente</h1>
            <p className="text-muted-foreground">
              {proveedor?.razon_social || 'Proveedor'} - CUIT: {proveedor?.cuit || '-'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog
            open={ncOpen}
            onOpenChange={(open) => {
              setNcOpen(open);
              if (!open) resetNcForm();
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <Receipt className="h-4 w-4 mr-2" />
                Nota de Crédito
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Registrar Nota de Crédito</DialogTitle>
                <DialogDescription>
                  Disminuye la deuda con el proveedor. Si imputás contra un cargo específico,
                  se descuenta de su saldo pendiente.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Monto *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={ncMonto}
                      onChange={(e) => setNcMonto(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Fecha *</Label>
                    <Input
                      type="date"
                      value={ncFecha}
                      onChange={(e) => setNcFecha(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Concepto *</Label>
                  <Input
                    value={ncConcepto}
                    onChange={(e) => setNcConcepto(e.target.value)}
                    placeholder="Ej: NC N° 0001-00000012 por devolución"
                    maxLength={255}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Nº de factura de la NC (opcional)</Label>
                  <Input
                    value={ncFactura}
                    onChange={(e) => setNcFactura(e.target.value)}
                    placeholder="Ej: 0001-00000012"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Imputar contra cargo (opcional)</Label>
                  <Select value={ncCargoId} onValueChange={setNcCargoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="— no imputar —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— no imputar —</SelectItem>
                      {comprobantesPendientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.factura_numero || c.concepto} · pendiente{' '}
                          {formatNumber(Number(c.saldo_comprobante || 0), 'currency')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Si elegís un cargo, el monto se descuenta de su saldo pendiente (no puede
                    superarlo).
                  </p>
                </div>

                <div className="space-y-1">
                  <Label>Notas internas</Label>
                  <Textarea
                    value={ncNotas}
                    onChange={(e) => setNcNotas(e.target.value)}
                    rows={2}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setNcOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  disabled={!ncValid || ncMutation.isPending}
                  onClick={() => ncMutation.mutate()}
                >
                  {ncMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Registrar NC
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            onClick={() => navigate(`/finanzas/ordenes-pago/nueva?proveedor=${proveedorId}`)}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Nueva Orden de Pago
          </Button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Actual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                (estadoCuenta?.saldo_actual || 0) > 0 ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {formatNumber(estadoCuenta?.saldo_actual || 0, 'currency')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(estadoCuenta?.saldo_actual || 0) > 0 ? 'Debemos al proveedor' : 'A favor'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cargos</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatNumber(estadoCuenta?.total_cargos || 0, 'currency')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pagos</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatNumber(estadoCuenta?.total_pagos || 0, 'currency')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comprobantes Pend.</CardTitle>
            <FileText className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {estadoCuenta?.comprobantes_pendientes || 0}
            </div>
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
                  placeholder="Buscar por concepto o factura..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="w-48">
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  {TIPOS_MOVIMIENTO_CC_PROVEEDOR.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de movimientos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Movimientos ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Cargando...</div>
          ) : movimientos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay movimientos registrados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Factura</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimientos.map((mov: MovimientoCCProveedorList) => (
                  <TableRow key={mov.id}>
                    <TableCell>{formatDate(mov.fecha_movimiento)}</TableCell>
                    <TableCell>{getTipoBadge(mov.tipo)}</TableCell>
                    <TableCell className="max-w-xs truncate">{mov.concepto}</TableCell>
                    <TableCell>{mov.factura_numero || '-'}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        mov.tipo === 'cargo' || mov.tipo === 'ajuste_debito'
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      {mov.tipo === 'cargo' || mov.tipo === 'ajuste_debito' ? '+' : '-'}
                      {formatNumber(mov.monto, 'currency')}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(mov.saldo_posterior, 'currency')}
                    </TableCell>
                    <TableCell>{getEstadoPagoBadge(mov.estado_pago)}</TableCell>
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
    </div>
  );
}
