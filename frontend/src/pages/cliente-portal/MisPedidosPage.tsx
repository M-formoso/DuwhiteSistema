/**
 * Página de Mis Pedidos - Vista para clientes
 * Muestra solo los pedidos del cliente logueado
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  FileText,
  Eye,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useAuthStore } from '@/stores/authStore';
import { clienteService } from '@/services/clienteService';
import { formatCurrency, formatDate } from '@/utils/formatters';

const ESTADOS_PEDIDO = [
  { value: 'borrador', label: 'Borrador', color: 'secondary' },
  { value: 'confirmado', label: 'Confirmado', color: 'info' },
  { value: 'en_produccion', label: 'En Producción', color: 'warning' },
  { value: 'listo', label: 'Listo', color: 'success' },
  { value: 'entregado', label: 'Entregado', color: 'success' },
  { value: 'facturado', label: 'Facturado', color: 'primary' },
  { value: 'cancelado', label: 'Cancelado', color: 'destructive' },
];

const getEstadoBadge = (estado: string) => {
  const estadoInfo = ESTADOS_PEDIDO.find((e) => e.value === estado);
  return (
    <Badge variant={estadoInfo?.color as any || 'secondary'}>
      {estadoInfo?.label || estado}
    </Badge>
  );
};

const getEstadoIcon = (estado: string) => {
  switch (estado) {
    case 'borrador':
      return <FileText className="h-4 w-4 text-gray-500" />;
    case 'confirmado':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'en_produccion':
      return <Package className="h-4 w-4 text-amber-500" />;
    case 'listo':
    case 'entregado':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'cancelado':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-500" />;
  }
};

export default function MisPedidosPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [filtroEstado, setFiltroEstado] = useState<string>('');

  // Cargar pedidos del cliente
  const { data: pedidosData, isLoading } = useQuery({
    queryKey: ['mis-pedidos', user?.cliente_id, filtroEstado],
    queryFn: () =>
      clienteService.getPedidos({
        cliente_id: user?.cliente_id,
        estado: filtroEstado as any || undefined,
        limit: 100,
      }),
    enabled: !!user?.cliente_id,
  });

  const pedidos = pedidosData?.items || [];

  // Calcular estadísticas
  const totalPedidos = pedidos.length;
  const pedidosEnProceso = pedidos.filter(
    (p) => ['confirmado', 'en_produccion'].includes(p.estado)
  ).length;
  const pedidosListos = pedidos.filter((p) => p.estado === 'listo').length;

  if (!user?.cliente_id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          No tienes un cliente asociado
        </h2>
        <p className="text-gray-500">
          Contacta al administrador para vincular tu cuenta a un cliente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis Pedidos</h1>
        <p className="text-gray-500">Consulta el estado de tus pedidos</p>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pedidos</p>
                <p className="text-2xl font-bold">{totalPedidos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-100">
                <Package className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En Proceso</p>
                <p className="text-2xl font-bold">{pedidosEnProceso}</p>
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
                <p className="text-sm text-muted-foreground">Listos para Retirar</p>
                <p className="text-2xl font-bold">{pedidosListos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={filtroEstado || 'todos'} onValueChange={(v) => setFiltroEstado(v === 'todos' ? '' : v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {ESTADOS_PEDIDO.map((estado) => (
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

      {/* Lista de Pedidos */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Pedidos</CardTitle>
          <CardDescription>Todos tus pedidos ordenados por fecha</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pedidos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No tienes pedidos registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Pedido</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Entrega Solicitada</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidos.map((pedido) => (
                    <TableRow key={pedido.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getEstadoIcon(pedido.estado)}
                          <span className="font-mono font-medium">#{pedido.numero}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(pedido.fecha_pedido)}</TableCell>
                      <TableCell>
                        {pedido.fecha_entrega_estimada
                          ? formatDate(pedido.fecha_entrega_estimada)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {getEstadoBadge(pedido.estado)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(pedido.total || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/pedidos/${pedido.id}`)}
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
