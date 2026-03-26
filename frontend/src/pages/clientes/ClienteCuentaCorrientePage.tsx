/**
 * Detalle de Cuenta Corriente de Cliente
 * Vista completa con movimientos paginados, filtros y acciones
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  RefreshCw,
  DollarSign,
  CreditCard,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileText,
  TrendingUp,
  TrendingDown,
  Package,
  Receipt,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

import { clienteService } from '@/services/clienteService';
import {
  cuentaCorrienteClienteService,
  type RegistrarCobranzaRequest,
} from '@/services/finanzasAvanzadasService';
import { formatNumber, formatDate, getLocalDateString } from '@/utils/formatters';
import { MEDIOS_PAGO } from '@/types/cliente';
import type { MedioPago } from '@/types/cliente';

const ESTADOS_FACTURACION = [
  { value: 'sin_facturar', label: 'Sin Facturar' },
  { value: 'factura_a', label: 'Factura A' },
  { value: 'factura_b', label: 'Factura B' },
  { value: 'factura_c', label: 'Factura C' },
  { value: 'ticket', label: 'Ticket' },
];

const ITEMS_PER_PAGE = 20;

export default function ClienteCuentaCorrientePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Estados de filtros
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos');
  const [page, setPage] = useState(0);

  // Estados del modal de cobranza completo
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [cobranzaMonto, setCobranzaMonto] = useState('');
  const [cobranzaMedio, setCobranzaMedio] = useState<MedioPago>('efectivo');
  const [cobranzaReferencia, setCobranzaReferencia] = useState('');
  const [cobranzaConcepto, setCobranzaConcepto] = useState('');
  const [cobranzaNotas, setCobranzaNotas] = useState('');
  const [cobranzaEstadoFacturacion, setCobranzaEstadoFacturacion] = useState('sin_facturar');
  const [cobranzaFacturaNumero, setCobranzaFacturaNumero] = useState('');
  const [cobranzaPedidoId, setCobranzaPedidoId] = useState<string>('');
  const [cobranzaLoteId, setCobranzaLoteId] = useState<string>('');

  // Query del cliente
  const { data: cliente, isLoading: loadingCliente } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => clienteService.getCliente(id!),
    enabled: Boolean(id),
  });

  // Query del estado de cuenta
  const { data: estadoCuenta } = useQuery({
    queryKey: ['cliente-estado-cuenta', id],
    queryFn: () => clienteService.getEstadoCuenta(id!),
    enabled: Boolean(id),
  });

  // Query de movimientos con paginación y filtros
  const { data: movimientosData, isLoading: loadingMovimientos } = useQuery({
    queryKey: ['cliente-movimientos', id, page, fechaDesde, fechaHasta],
    queryFn: () =>
      clienteService.getMovimientosCuenta(id!, {
        skip: page * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      }),
    enabled: Boolean(id),
  });

  // Query pedidos pendientes del cliente (para asociar cobranza)
  const { data: pedidosPendientes } = useQuery({
    queryKey: ['cc-pedidos-pendientes', id],
    queryFn: () => cuentaCorrienteClienteService.getPedidosPendientes(id!),
    enabled: Boolean(id) && showPagoModal,
  });

  // Query lotes del cliente (para asociar cobranza)
  const { data: lotesCliente } = useQuery({
    queryKey: ['cc-lotes-cliente', id],
    queryFn: () => cuentaCorrienteClienteService.getLotesCliente(id!),
    enabled: Boolean(id) && showPagoModal,
  });

  // Filtrar localmente por tipo si es necesario
  const movimientosFiltrados = movimientosData?.items?.filter((mov) => {
    if (tipoFiltro === 'todos') return true;
    return mov.tipo === tipoFiltro;
  });

  // Mutation para registrar cobranza completa
  const cobranzaMutation = useMutation({
    mutationFn: (data: RegistrarCobranzaRequest) =>
      cuentaCorrienteClienteService.registrarCobranza(id!, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['cliente', id] });
      queryClient.invalidateQueries({ queryKey: ['cliente-estado-cuenta', id] });
      queryClient.invalidateQueries({ queryKey: ['cliente-movimientos', id] });
      queryClient.invalidateQueries({ queryKey: ['cc-clientes-deuda'] });
      queryClient.invalidateQueries({ queryKey: ['cc-clientes-resumen'] });
      toast({
        title: 'Cobranza registrada',
        description: `Recibo ${result.recibo_numero} generado correctamente.`,
      });
      cerrarModalCobranza();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo registrar la cobranza.',
        variant: 'destructive',
      });
    },
  });

  const abrirModalCobranza = () => {
    setCobranzaMonto(cliente?.saldo_cuenta_corriente?.toString() || '');
    setCobranzaMedio('efectivo');
    setCobranzaReferencia('');
    setCobranzaConcepto('');
    setCobranzaNotas('');
    setCobranzaEstadoFacturacion('sin_facturar');
    setCobranzaFacturaNumero('');
    setCobranzaPedidoId('');
    setCobranzaLoteId('');
    setShowPagoModal(true);
  };

  const cerrarModalCobranza = () => {
    setShowPagoModal(false);
    setCobranzaMonto('');
    setCobranzaReferencia('');
    setCobranzaConcepto('');
    setCobranzaNotas('');
    setCobranzaEstadoFacturacion('sin_facturar');
    setCobranzaFacturaNumero('');
    setCobranzaPedidoId('');
    setCobranzaLoteId('');
  };

  const handleRegistrarCobranza = () => {
    if (!cobranzaMonto) return;

    cobranzaMutation.mutate({
      monto: parseFloat(cobranzaMonto),
      fecha: getLocalDateString(),
      medio_pago: cobranzaMedio,
      concepto: cobranzaConcepto || undefined,
      referencia_pago: cobranzaReferencia || undefined,
      notas: cobranzaNotas || undefined,
      pedido_id: cobranzaPedidoId || undefined,
      lote_id: cobranzaLoteId || undefined,
      estado_facturacion: cobranzaEstadoFacturacion,
      factura_numero: cobranzaFacturaNumero || undefined,
    });
  };

  const limpiarFiltros = () => {
    setFechaDesde('');
    setFechaHasta('');
    setTipoFiltro('todos');
    setPage(0);
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'cargo':
        return <Badge className="bg-red-100 text-red-700">Cargo</Badge>;
      case 'pago':
        return <Badge className="bg-green-100 text-green-700">Pago</Badge>;
      case 'ajuste':
        return <Badge className="bg-purple-100 text-purple-700">Ajuste</Badge>;
      default:
        return <Badge variant="outline">{tipo}</Badge>;
    }
  };

  const totalPages = Math.ceil((movimientosData?.total || 0) / ITEMS_PER_PAGE);

  if (loadingCliente) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cliente no encontrado</p>
        <Button variant="link" onClick={() => navigate('/clientes')}>
          Volver a la lista
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/clientes/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cuenta Corriente</h1>
            <p className="text-gray-500">
              {cliente.nombre_fantasia || cliente.razon_social} - {cliente.codigo}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              // TODO: Exportar a Excel/PDF
              toast({
                title: 'Próximamente',
                description: 'La exportación estará disponible pronto.',
              });
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={abrirModalCobranza} disabled={!cliente.tiene_deuda}>
            <CreditCard className="h-4 w-4 mr-2" />
            Registrar Pago
          </Button>
        </div>
      </div>

      {/* Cards de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={cliente.tiene_deuda ? 'border-orange-300' : 'border-green-300'}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Saldo Actual</p>
                <p
                  className={`text-2xl font-bold ${
                    cliente.tiene_deuda ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {formatNumber(cliente.saldo_cuenta_corriente, 'currency')}
                </p>
              </div>
              <DollarSign
                className={`h-10 w-10 ${
                  cliente.tiene_deuda ? 'text-red-200' : 'text-green-200'
                }`}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Facturado este mes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(estadoCuenta?.total_facturado_mes || 0, 'currency')}
                </p>
              </div>
              <TrendingUp className="h-10 w-10 text-red-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pagado este mes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(estadoCuenta?.total_pagado_mes || 0, 'currency')}
                </p>
              </div>
              <TrendingDown className="h-10 w-10 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Crédito disponible</p>
                <p
                  className={`text-2xl font-bold ${
                    (estadoCuenta?.credito_disponible || 0) < 0 ? 'text-red-600' : 'text-gray-900'
                  }`}
                >
                  {estadoCuenta?.limite_credito
                    ? formatNumber(estadoCuenta.credito_disponible || 0, 'currency')
                    : 'Sin límite'}
                </p>
              </div>
              <CreditCard className="h-10 w-10 text-blue-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Desde</Label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value);
                  setPage(0);
                }}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value);
                  setPage(0);
                }}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={tipoFiltro}
                onValueChange={(v) => {
                  setTipoFiltro(v);
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="cargo">Cargos</SelectItem>
                  <SelectItem value="pago">Pagos</SelectItem>
                  <SelectItem value="nota_credito">Notas de crédito</SelectItem>
                  <SelectItem value="nota_debito">Notas de débito</SelectItem>
                  <SelectItem value="ajuste">Ajustes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" onClick={limpiarFiltros}>
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de movimientos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Movimientos
            </CardTitle>
            <span className="text-sm text-gray-500">
              {movimientosData?.total || 0} movimientos
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMovimientos ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : movimientosFiltrados && movimientosFiltrados.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Fecha</TableHead>
                      <TableHead className="w-[100px]">Tipo</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead className="text-right">Debe</TableHead>
                      <TableHead className="text-right">Haber</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimientosFiltrados.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="font-mono text-sm">
                          {formatDate(mov.fecha_movimiento)}
                        </TableCell>
                        <TableCell>{getTipoBadge(mov.tipo)}</TableCell>
                        <TableCell>{mov.concepto}</TableCell>
                        <TableCell className="text-gray-500 text-sm">
                          {mov.referencia_pago || mov.factura_numero || mov.recibo_numero || '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {mov.tipo === 'cargo'
                            ? formatNumber(mov.monto, 'currency')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {mov.tipo === 'pago'
                            ? formatNumber(mov.monto, 'currency')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatNumber(mov.saldo_posterior, 'currency')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-gray-500">
                    Página {page + 1} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay movimientos registrados</p>
              {(fechaDesde || fechaHasta || tipoFiltro !== 'todos') && (
                <Button variant="link" onClick={limpiarFiltros}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Cobranza Completo */}
      {showPagoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-4">
          <Card className="w-full max-w-2xl m-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Registrar Cobranza
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Info del cliente */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium">{cliente.nombre_fantasia || cliente.razon_social}</p>
                <p className="text-sm text-gray-500">
                  Deuda actual: <span className="font-semibold text-red-600">{formatNumber(cliente.saldo_cuenta_corriente, 'currency')}</span>
                </p>
              </div>

              <Tabs defaultValue="basico" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basico">Datos Básicos</TabsTrigger>
                  <TabsTrigger value="asociar">Asociar a</TabsTrigger>
                  <TabsTrigger value="facturacion">Facturación</TabsTrigger>
                </TabsList>

                <TabsContent value="basico" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Monto a cobrar *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={cobranzaMonto}
                        onChange={(e) => setCobranzaMonto(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Medio de Pago *</Label>
                      <Select value={cobranzaMedio} onValueChange={(v) => setCobranzaMedio(v as MedioPago)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MEDIOS_PAGO.map((mp) => (
                            <SelectItem key={mp.value} value={mp.value}>
                              {mp.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Referencia de Pago</Label>
                    <Input
                      value={cobranzaReferencia}
                      onChange={(e) => setCobranzaReferencia(e.target.value)}
                      placeholder="Nro. transferencia, cheque, etc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Concepto (opcional)</Label>
                    <Input
                      value={cobranzaConcepto}
                      onChange={(e) => setCobranzaConcepto(e.target.value)}
                      placeholder="Se genera automáticamente si no se especifica"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Textarea
                      value={cobranzaNotas}
                      onChange={(e) => setCobranzaNotas(e.target.value)}
                      placeholder="Observaciones adicionales..."
                      rows={2}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="asociar" className="space-y-4 mt-4">
                  <p className="text-sm text-gray-500">
                    Opcionalmente podés asociar esta cobranza a un pedido o lote específico.
                  </p>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Pedido
                    </Label>
                    <Select value={cobranzaPedidoId || "_none"} onValueChange={(v) => setCobranzaPedidoId(v === "_none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin asociar a pedido" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Sin asociar a pedido</SelectItem>
                        {pedidosPendientes?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.numero} - {formatNumber(p.saldo_pendiente, 'currency')} pendiente
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {pedidosPendientes?.length === 0 && (
                      <p className="text-xs text-gray-400">No hay pedidos con saldo pendiente</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Lote de Producción
                    </Label>
                    <Select value={cobranzaLoteId || "_none"} onValueChange={(v) => setCobranzaLoteId(v === "_none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin asociar a lote" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Sin asociar a lote</SelectItem>
                        {lotesCliente?.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.numero} - {l.descripcion || l.estado}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {lotesCliente?.length === 0 && (
                      <p className="text-xs text-gray-400">No hay lotes registrados para este cliente</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="facturacion" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Estado de Facturación
                    </Label>
                    <Select value={cobranzaEstadoFacturacion} onValueChange={setCobranzaEstadoFacturacion}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS_FACTURACION.map((ef) => (
                          <SelectItem key={ef.value} value={ef.value}>
                            {ef.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {cobranzaEstadoFacturacion !== 'sin_facturar' && (
                    <div className="space-y-2">
                      <Label>Número de Factura/Ticket</Label>
                      <Input
                        value={cobranzaFacturaNumero}
                        onChange={(e) => setCobranzaFacturaNumero(e.target.value)}
                        placeholder="Ej: 0001-00001234"
                      />
                    </div>
                  )}

                  <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm">
                    <p className="font-medium">Nota sobre facturación</p>
                    <p className="mt-1">
                      Podés registrar el cobro ahora y facturarlo después, o indicar que ya está facturado
                      ingresando el número de comprobante.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="ghost" onClick={cerrarModalCobranza}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleRegistrarCobranza}
                  disabled={!cobranzaMonto || parseFloat(cobranzaMonto) <= 0 || cobranzaMutation.isPending}
                >
                  {cobranzaMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  Registrar Cobranza
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
