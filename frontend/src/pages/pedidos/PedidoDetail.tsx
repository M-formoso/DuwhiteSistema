/**
 * Detalle de Pedido
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Printer,
  Package,
  User,
  Calendar,
  Truck,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Loader2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { useToast } from '@/components/ui/use-toast';

import { clienteService } from '@/services/clienteService';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/formatters';
import { ESTADOS_PEDIDO, TIPOS_ENTREGA } from '@/types/cliente';
import type { EstadoPedido } from '@/types/cliente';

const ESTADO_COLORS: Record<EstadoPedido, string> = {
  borrador: 'bg-gray-100 text-gray-700',
  confirmado: 'bg-blue-100 text-blue-700',
  en_proceso: 'bg-yellow-100 text-yellow-700',
  listo: 'bg-green-100 text-green-700',
  entregado: 'bg-purple-100 text-purple-700',
  facturado: 'bg-teal-100 text-teal-700',
  cancelado: 'bg-red-100 text-red-700',
};

const ESTADO_ICONS: Record<EstadoPedido, React.ReactNode> = {
  borrador: <FileText className="h-4 w-4" />,
  confirmado: <CheckCircle className="h-4 w-4" />,
  en_proceso: <Clock className="h-4 w-4" />,
  listo: <Package className="h-4 w-4" />,
  entregado: <Truck className="h-4 w-4" />,
  facturado: <DollarSign className="h-4 w-4" />,
  cancelado: <XCircle className="h-4 w-4" />,
};

export default function PedidoDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [cambioEstado, setCambioEstado] = useState<EstadoPedido | null>(null);

  // Cargar pedido
  const { data: pedido, isLoading, error } = useQuery({
    queryKey: ['pedido', id],
    queryFn: () => clienteService.getPedido(id!),
    enabled: Boolean(id),
  });

  // Cambiar estado
  const cambiarEstadoMutation = useMutation({
    mutationFn: (nuevoEstado: EstadoPedido) =>
      clienteService.cambiarEstadoPedido(id!, nuevoEstado),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedido', id] });
      toast({
        title: 'Estado actualizado',
        description: `El pedido ahora está ${data.estado}.`,
      });
      setCambioEstado(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo cambiar el estado.',
        variant: 'destructive',
      });
    },
  });

  // Cancelar pedido
  const cancelarMutation = useMutation({
    mutationFn: () => clienteService.cancelarPedido(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast({
        title: 'Pedido cancelado',
        description: 'El pedido ha sido cancelado.',
      });
      navigate('/pedidos');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo cancelar el pedido.',
        variant: 'destructive',
      });
    },
  });

  const handleCancelar = () => {
    if (confirm('¿Está seguro de cancelar este pedido? Esta acción no se puede deshacer.')) {
      cancelarMutation.mutate();
    }
  };

  const getEstadoLabel = (est: EstadoPedido) => {
    return ESTADOS_PEDIDO.find((e) => e.value === est)?.label || est;
  };

  const getTipoEntregaLabel = (tipo: string) => {
    return TIPOS_ENTREGA.find((t) => t.value === tipo)?.label || tipo;
  };

  // Estados disponibles para cambiar
  const getEstadosDisponibles = (estadoActual: EstadoPedido): EstadoPedido[] => {
    const flujo: Record<EstadoPedido, EstadoPedido[]> = {
      borrador: ['confirmado', 'cancelado'],
      confirmado: ['en_proceso', 'cancelado'],
      en_proceso: ['listo', 'cancelado'],
      listo: ['entregado'],
      entregado: ['facturado'],
      facturado: [],
      cancelado: [],
    };
    return flujo[estadoActual] || [];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !pedido) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <p>No se encontró el pedido</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/pedidos')}>
          Volver a Pedidos
        </Button>
      </div>
    );
  }

  const estadosDisponibles = getEstadosDisponibles(pedido.estado);
  const puedeEditar = ['borrador', 'confirmado'].includes(pedido.estado);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/pedidos')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                Pedido #{pedido.numero}
              </h1>
              <Badge className={ESTADO_COLORS[pedido.estado]}>
                {ESTADO_ICONS[pedido.estado]}
                <span className="ml-1">{getEstadoLabel(pedido.estado)}</span>
              </Badge>
            </div>
            <p className="text-gray-500">
              {pedido.cliente_nombre} - {formatDate(pedido.fecha_pedido)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          {puedeEditar && (
            <Button
              variant="outline"
              onClick={() => navigate(`/pedidos/${id}/editar`)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          {pedido.estado !== 'cancelado' && pedido.estado !== 'facturado' && (
            <Button
              variant="destructive"
              onClick={handleCancelar}
              disabled={cancelarMutation.isPending}
            >
              {cancelarMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Cancelar
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Información del Cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted"
              onClick={() => navigate(`/clientes/${pedido.cliente_id}`)}
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{pedido.cliente_nombre}</p>
                <p className="text-sm text-muted-foreground">Ver perfil</p>
              </div>
              <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Fechas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Fechas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pedido:</span>
              <span>{formatDate(pedido.fecha_pedido)}</span>
            </div>
            {pedido.fecha_retiro && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Retiro:</span>
                <span>{formatDate(pedido.fecha_retiro)}</span>
              </div>
            )}
            {pedido.fecha_entrega_estimada && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entrega est.:</span>
                <span>{formatDate(pedido.fecha_entrega_estimada)}</span>
              </div>
            )}
            {pedido.fecha_entrega_real && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entrega real:</span>
                <span>{formatDate(pedido.fecha_entrega_real)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Entrega */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Entrega
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo:</span>
              <span>{getTipoEntregaLabel(pedido.tipo_entrega)}</span>
            </div>
            {pedido.direccion_entrega && (
              <div>
                <span className="text-muted-foreground text-sm">Dirección:</span>
                <p className="text-sm">{pedido.direccion_entrega}</p>
              </div>
            )}
            {pedido.horario_entrega && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Horario:</span>
                <span>{pedido.horario_entrega}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cambiar Estado */}
        {estadosDisponibles.length > 0 && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Cambiar Estado</CardTitle>
              <CardDescription>
                Actualice el estado del pedido según su progreso
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Select
                  value={cambioEstado || ''}
                  onValueChange={(v) => setCambioEstado(v as EstadoPedido)}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Seleccionar nuevo estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {estadosDisponibles.map((est) => (
                      <SelectItem key={est} value={est}>
                        {getEstadoLabel(est)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => cambioEstado && cambiarEstadoMutation.mutate(cambioEstado)}
                  disabled={!cambioEstado || cambiarEstadoMutation.isPending}
                >
                  {cambiarEstadoMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Actualizar Estado
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detalle de Items */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Items del Pedido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio Unit.</TableHead>
                  <TableHead className="text-right">Descuento</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedido.detalles.map((detalle) => (
                  <TableRow key={detalle.id}>
                    <TableCell>
                      <p className="font-medium">{detalle.descripcion}</p>
                      {detalle.notas && (
                        <p className="text-sm text-muted-foreground">{detalle.notas}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {detalle.cantidad} {detalle.unidad}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(detalle.precio_unitario)}
                    </TableCell>
                    <TableCell className="text-right">
                      {detalle.descuento_porcentaje
                        ? `${detalle.descuento_porcentaje}%`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(detalle.subtotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Totales */}
            <div className="mt-6 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>{formatCurrency(pedido.subtotal)}</span>
                </div>
                {pedido.descuento_monto && pedido.descuento_monto > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Descuento ({pedido.descuento_porcentaje}%):</span>
                    <span>-{formatCurrency(pedido.descuento_monto)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA (21%):</span>
                  <span>{formatCurrency(pedido.iva)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-primary">{formatCurrency(pedido.total)}</span>
                </div>
                {pedido.saldo_pendiente > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Saldo Pendiente:</span>
                    <span className="font-medium">
                      {formatCurrency(pedido.saldo_pendiente)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notas */}
        {(pedido.notas || pedido.observaciones_entrega) && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pedido.notas && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Notas del pedido:</p>
                  <p className="whitespace-pre-wrap">{pedido.notas}</p>
                </div>
              )}
              {pedido.observaciones_entrega && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Observaciones de entrega:</p>
                  <p className="whitespace-pre-wrap">{pedido.observaciones_entrega}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notas Internas */}
        {pedido.notas_internas && (
          <Card>
            <CardHeader>
              <CardTitle>Notas Internas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {pedido.notas_internas}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Información de Facturación */}
        {pedido.factura_numero && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Facturación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Factura:</span>
                <span className="font-mono">{pedido.factura_numero}</span>
              </div>
              {pedido.factura_tipo && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo:</span>
                  <span>{pedido.factura_tipo}</span>
                </div>
              )}
              {pedido.fecha_facturacion && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha:</span>
                  <span>{formatDate(pedido.fecha_facturacion)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Información del Sistema */}
        <Card className="lg:col-span-3">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div>
                <span>Creado por:</span>{' '}
                <span className="text-foreground">{pedido.creado_por_nombre}</span>
              </div>
              <div>
                <span>Creado:</span>{' '}
                <span className="text-foreground">{formatDateTime(pedido.created_at)}</span>
              </div>
              {pedido.updated_at && (
                <div>
                  <span>Última actualización:</span>{' '}
                  <span className="text-foreground">{formatDateTime(pedido.updated_at)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
