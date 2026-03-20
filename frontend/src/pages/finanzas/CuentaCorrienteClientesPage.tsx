/**
 * Página de Cuentas Corrientes de Clientes
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Search,
  Phone,
  Mail,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  CreditCard,
  FileText,
  ArrowUpDown,
  Package,
  Receipt,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

import {
  cuentaCorrienteClienteService,
  type ClienteConDeuda,
  type RegistrarCobranzaRequest,
} from '@/services/finanzasAvanzadasService';
import { formatNumber } from '@/utils/formatters';
import { MEDIOS_PAGO } from '@/types/cliente';

const ESTADOS_FACTURACION = [
  { value: 'sin_facturar', label: 'Sin Facturar' },
  { value: 'factura_a', label: 'Factura A' },
  { value: 'factura_b', label: 'Factura B' },
  { value: 'factura_c', label: 'Factura C' },
  { value: 'ticket', label: 'Ticket' },
];

export default function CuentaCorrienteClientesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<'saldo_desc' | 'saldo_asc' | 'nombre' | 'antiguedad'>('saldo_desc');
  const [pagina, setPagina] = useState(0);
  const limite = 20;

  // Modal de cobranza
  const [clienteCobranza, setClienteCobranza] = useState<ClienteConDeuda | null>(null);
  const [cobranzaMonto, setCobranzaMonto] = useState('');
  const [cobranzaMedio, setCobranzaMedio] = useState('efectivo');
  const [cobranzaReferencia, setCobranzaReferencia] = useState('');
  const [cobranzaConcepto, setCobranzaConcepto] = useState('');
  const [cobranzaNotas, setCobranzaNotas] = useState('');
  const [cobranzaEstadoFacturacion, setCobranzaEstadoFacturacion] = useState('sin_facturar');
  const [cobranzaFacturaNumero, setCobranzaFacturaNumero] = useState('');
  const [cobranzaPedidoId, setCobranzaPedidoId] = useState<string>('');
  const [cobranzaLoteId, setCobranzaLoteId] = useState<string>('');

  // Query resumen
  const { data: resumen } = useQuery({
    queryKey: ['cc-clientes-resumen'],
    queryFn: () => cuentaCorrienteClienteService.getResumen(),
  });

  // Query clientes con deuda
  const { data: clientesData, isLoading } = useQuery({
    queryKey: ['cc-clientes-deuda', busqueda, orden, pagina],
    queryFn: () =>
      cuentaCorrienteClienteService.getClientesConDeuda({
        skip: pagina * limite,
        limit: limite,
        buscar: busqueda || undefined,
        orden,
      }),
  });

  // Query pedidos pendientes del cliente seleccionado
  const { data: pedidosPendientes } = useQuery({
    queryKey: ['cc-pedidos-pendientes', clienteCobranza?.id],
    queryFn: () => cuentaCorrienteClienteService.getPedidosPendientes(clienteCobranza!.id),
    enabled: !!clienteCobranza,
  });

  // Query lotes del cliente seleccionado
  const { data: lotesCliente } = useQuery({
    queryKey: ['cc-lotes-cliente', clienteCobranza?.id],
    queryFn: () => cuentaCorrienteClienteService.getLotesCliente(clienteCobranza!.id),
    enabled: !!clienteCobranza,
  });

  const clientes = clientesData?.items || [];
  const total = clientesData?.total || 0;
  const totalDeuda = clientesData?.total_deuda || 0;
  const totalPages = Math.ceil(total / limite);

  // Mutation para registrar cobranza
  const cobranzaMutation = useMutation({
    mutationFn: (data: { clienteId: string; cobranza: RegistrarCobranzaRequest }) =>
      cuentaCorrienteClienteService.registrarCobranza(data.clienteId, data.cobranza),
    onSuccess: (result) => {
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

  const handleBuscar = () => {
    setPagina(0);
  };

  const abrirModalCobranza = (cliente: ClienteConDeuda) => {
    setClienteCobranza(cliente);
    setCobranzaMonto(cliente.saldo.toString());
    setCobranzaMedio('efectivo');
    setCobranzaReferencia('');
    setCobranzaConcepto('');
    setCobranzaNotas('');
    setCobranzaEstadoFacturacion('sin_facturar');
    setCobranzaFacturaNumero('');
    setCobranzaPedidoId('');
    setCobranzaLoteId('');
  };

  const cerrarModalCobranza = () => {
    setClienteCobranza(null);
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
    if (!clienteCobranza || !cobranzaMonto) return;

    cobranzaMutation.mutate({
      clienteId: clienteCobranza.id,
      cobranza: {
        monto: parseFloat(cobranzaMonto),
        fecha: new Date().toISOString().split('T')[0],
        medio_pago: cobranzaMedio,
        concepto: cobranzaConcepto || undefined,
        referencia_pago: cobranzaReferencia || undefined,
        notas: cobranzaNotas || undefined,
        pedido_id: cobranzaPedidoId || undefined,
        lote_id: cobranzaLoteId || undefined,
        estado_facturacion: cobranzaEstadoFacturacion,
        factura_numero: cobranzaFacturaNumero || undefined,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cuentas Corrientes - Clientes</h1>
          <p className="text-gray-500">Gestión de deudas y cobranzas de clientes</p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes con Deuda</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resumen?.clientes_con_deuda || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total a Cobrar</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${formatNumber(resumen?.total_deuda || 0, 2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facturado este Mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${formatNumber(resumen?.total_facturado_mes || 0, 2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cobrado este Mes</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${formatNumber(resumen?.total_cobrado_mes || 0, 2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px] max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre, CUIT, código..."
                  className="pl-10"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
                />
              </div>
            </div>

            <Select value={orden} onValueChange={(v) => setOrden(v as typeof orden)}>
              <SelectTrigger className="w-48">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saldo_desc">Mayor deuda primero</SelectItem>
                <SelectItem value="saldo_asc">Menor deuda primero</SelectItem>
                <SelectItem value="nombre">Nombre A-Z</SelectItem>
                <SelectItem value="antiguedad">Más antiguo primero</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ['cc-clientes-deuda'] })}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Clientes con Deuda ({total})
            {totalDeuda > 0 && (
              <Badge variant="destructive" className="ml-2">
                Total: ${formatNumber(totalDeuda, 2)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : clientes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay clientes con deuda pendiente</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="text-right">Deuda</TableHead>
                  <TableHead className="text-right">Límite</TableHead>
                  <TableHead>Antigüedad</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((cliente) => (
                  <TableRow
                    key={cliente.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/clientes/${cliente.id}`)}
                  >
                    <TableCell className="font-mono font-medium">{cliente.codigo}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {cliente.nombre_fantasia || cliente.razon_social}
                        </p>
                        {cliente.cuit && (
                          <p className="text-xs text-gray-500">CUIT: {cliente.cuit}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {cliente.telefono && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Phone className="h-3 w-3" />
                            {cliente.telefono}
                          </div>
                        )}
                        {cliente.email && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Mail className="h-3 w-3" />
                            {cliente.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-red-600">
                        ${formatNumber(cliente.saldo, 2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {cliente.limite_credito ? (
                        <span className={cliente.saldo > cliente.limite_credito ? 'text-red-600' : ''}>
                          ${formatNumber(cliente.limite_credito, 2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {cliente.dias_antiguedad !== null ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <span className={cliente.dias_antiguedad > 30 ? 'text-orange-600 font-medium' : ''}>
                            {cliente.dias_antiguedad} días
                          </span>
                          {cliente.dias_antiguedad > 60 && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirModalCobranza(cliente);
                        }}
                      >
                        <CreditCard className="h-4 w-4 mr-1" />
                        Cobrar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina === 0}
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600">
                Página {pagina + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagina + 1 >= totalPages}
                onClick={() => setPagina((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Cobranza Completo */}
      {clienteCobranza && (
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
                <p className="font-medium">{clienteCobranza.nombre_fantasia || clienteCobranza.razon_social}</p>
                <p className="text-sm text-gray-500">
                  Deuda actual: <span className="font-semibold text-red-600">${formatNumber(clienteCobranza.saldo, 2)}</span>
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
                      <Select value={cobranzaMedio} onValueChange={setCobranzaMedio}>
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
                    <Select value={cobranzaPedidoId} onValueChange={setCobranzaPedidoId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin asociar a pedido" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sin asociar a pedido</SelectItem>
                        {pedidosPendientes?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.numero} - ${formatNumber(p.saldo_pendiente, 2)} pendiente
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
                    <Select value={cobranzaLoteId} onValueChange={setCobranzaLoteId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin asociar a lote" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sin asociar a lote</SelectItem>
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
