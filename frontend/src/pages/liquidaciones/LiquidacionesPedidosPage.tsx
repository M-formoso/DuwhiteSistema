/**
 * Página de Liquidaciones de Pedidos
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Eye,
  Check,
  DollarSign,
  FileText,
  Search,
  Filter,
  Calendar,
  User,
  Package,
  AlertTriangle,
  XCircle,
  Clock,
  FileCheck,
  TrendingUp,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

import liquidacionService from '@/services/liquidacionService';
import { formatNumber, formatDate } from '@/utils/formatters';
import { ESTADOS_LIQUIDACION, type EstadoLiquidacion, type LiquidacionList } from '@/types/liquidacion';

export default function LiquidacionesPedidosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('lista');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(0);
  const limite = 20;

  // Modal confirmar
  const [liquidacionConfirmar, setLiquidacionConfirmar] = useState<LiquidacionList | null>(null);
  const [notasConfirmacion, setNotasConfirmacion] = useState('');

  // Modal anular
  const [liquidacionAnular, setLiquidacionAnular] = useState<LiquidacionList | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');

  // Query liquidaciones
  const { data: liquidacionesData, isLoading } = useQuery({
    queryKey: ['liquidaciones-pedidos', filtroEstado, pagina],
    queryFn: () =>
      liquidacionService.listar({
        skip: pagina * limite,
        limit: limite,
        estado: filtroEstado !== 'todos' ? filtroEstado : undefined,
        incluir_anuladas: filtroEstado === 'anulada',
      }),
  });

  // Query resumen
  const { data: resumen } = useQuery({
    queryKey: ['liquidaciones-resumen'],
    queryFn: () => liquidacionService.obtenerResumen(),
  });

  // Mutations
  const confirmarMutation = useMutation({
    mutationFn: ({ id, notas }: { id: string; notas?: string }) =>
      liquidacionService.confirmar(id, { notas }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-resumen'] });
      toast({ title: 'Liquidación confirmada', description: 'Se generó el cargo en cuenta corriente.' });
      setLiquidacionConfirmar(null);
      setNotasConfirmacion('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo confirmar la liquidación.',
        variant: 'destructive',
      });
    },
  });

  const anularMutation = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      liquidacionService.anular(id, { motivo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-resumen'] });
      toast({ title: 'Liquidación anulada', description: 'Se revirtió el cargo en cuenta corriente.' });
      setLiquidacionAnular(null);
      setMotivoAnulacion('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo anular la liquidación.',
        variant: 'destructive',
      });
    },
  });

  const liquidaciones = liquidacionesData?.items || [];
  const total = liquidacionesData?.total || 0;

  const getEstadoBadge = (estado: EstadoLiquidacion, anulado: boolean) => {
    if (anulado) {
      return <Badge className="bg-red-100 text-red-800">Anulada</Badge>;
    }
    const config = ESTADOS_LIQUIDACION.find((e) => e.value === estado);
    const colors: Record<string, string> = {
      gray: 'bg-gray-100 text-gray-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
    };
    return <Badge className={colors[config?.color || 'gray']}>{config?.label || estado}</Badge>;
  };

  const handleConfirmar = () => {
    if (!liquidacionConfirmar) return;
    confirmarMutation.mutate({
      id: liquidacionConfirmar.id,
      notas: notasConfirmacion || undefined,
    });
  };

  const handleAnular = () => {
    if (!liquidacionAnular || !motivoAnulacion.trim()) return;
    anularMutation.mutate({
      id: liquidacionAnular.id,
      motivo: motivoAnulacion,
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Liquidaciones de Pedidos</h1>
          <p className="text-muted-foreground">
            Gestión de liquidaciones y cargos a cuenta corriente
          </p>
        </div>
        <Button onClick={() => navigate('/produccion/kanban')}>
          <Plus className="h-4 w-4 mr-2" />
          Liquidar desde Producción
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="lista">Liquidaciones</TabsTrigger>
        </TabsList>

        {/* Tab Resumen */}
        <TabsContent value="resumen" className="space-y-6">
          {/* Cards principales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">En Borrador</CardTitle>
                <FileText className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(resumen?.monto_borradores || 0, 'currency')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {resumen?.total_borradores || 0} liquidaciones
                </p>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-800">Confirmadas</CardTitle>
                <Check className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatNumber(resumen?.monto_confirmadas || 0, 'currency')}
                </div>
                <p className="text-xs text-blue-600">
                  {resumen?.total_confirmadas || 0} en cuenta corriente
                </p>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-800">Facturadas</CardTitle>
                <FileCheck className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatNumber(resumen?.monto_facturadas || 0, 'currency')}
                </div>
                <p className="text-xs text-green-600">
                  {resumen?.total_facturadas || 0} facturadas
                </p>
              </CardContent>
            </Card>

            <Card className="bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Activo</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {formatNumber(
                    (resumen?.monto_borradores || 0) +
                      (resumen?.monto_confirmadas || 0) +
                      (resumen?.monto_facturadas || 0),
                    'currency'
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(resumen?.total_borradores || 0) +
                    (resumen?.total_confirmadas || 0) +
                    (resumen?.total_facturadas || 0)}{' '}
                  liquidaciones
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Últimas liquidaciones confirmadas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Últimas Liquidaciones Confirmadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {liquidaciones.filter((l) => l.estado === 'confirmada').length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No hay liquidaciones confirmadas recientes
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liquidaciones
                      .filter((l) => l.estado === 'confirmada')
                      .slice(0, 5)
                      .map((liq) => (
                        <TableRow
                          key={liq.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => navigate(`/liquidaciones/${liq.id}`)}
                        >
                          <TableCell className="font-medium">{liq.numero}</TableCell>
                          <TableCell>{liq.cliente_nombre}</TableCell>
                          <TableCell>{liq.pedido_numero}</TableCell>
                          <TableCell>{formatDate(liq.fecha_liquidacion)}</TableCell>
                          <TableCell className="text-right font-bold text-blue-600">
                            {formatNumber(liq.total, 'currency')}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Borradores pendientes */}
          {(resumen?.total_borradores || 0) > 0 && (
            <Card className="border-amber-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                  Liquidaciones Pendientes de Confirmar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {liquidaciones
                    .filter((l) => l.estado === 'borrador')
                    .slice(0, 5)
                    .map((liq) => (
                      <div
                        key={liq.id}
                        className="flex items-center justify-between p-3 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100"
                        onClick={() => navigate(`/liquidaciones/${liq.id}`)}
                      >
                        <div>
                          <p className="font-medium">{liq.numero}</p>
                          <p className="text-sm text-amber-700">
                            {liq.cliente_nombre} - Pedido {liq.pedido_numero}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-amber-600">
                          {formatNumber(liq.total, 'currency')}
                        </p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Lista */}
        <TabsContent value="lista" className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por número, cliente o pedido..."
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
                      {ESTADOS_LIQUIDACION.map((estado) => (
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
              ) : liquidaciones.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay liquidaciones.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liquidaciones.map((liq: LiquidacionList) => (
                      <TableRow key={liq.id}>
                        <TableCell className="font-medium">{liq.numero}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {liq.cliente_nombre}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            {liq.pedido_numero}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(liq.fecha_liquidacion)}
                          </div>
                        </TableCell>
                        <TableCell>{getEstadoBadge(liq.estado, liq.anulado)}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(liq.subtotal, 'currency')}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatNumber(liq.total, 'currency')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/liquidaciones/${liq.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {liq.estado === 'borrador' && !liq.anulado && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLiquidacionConfirmar(liq)}
                              >
                                <Check className="h-4 w-4 text-blue-500" />
                              </Button>
                            )}
                            {(liq.estado === 'borrador' || liq.estado === 'confirmada') &&
                              !liq.anulado && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setLiquidacionAnular(liq)}
                                >
                                  <XCircle className="h-4 w-4 text-red-500" />
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
      </Tabs>

      {/* Modal de Confirmación */}
      <Dialog open={!!liquidacionConfirmar} onOpenChange={() => setLiquidacionConfirmar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Liquidación</DialogTitle>
            <DialogDescription>
              {liquidacionConfirmar?.numero} - {liquidacionConfirmar?.cliente_nombre}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Monto a cargar en cuenta corriente</p>
              <p className="text-3xl font-bold text-blue-600">
                {formatNumber(liquidacionConfirmar?.total || 0, 'currency')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notasConfirmacion}
                onChange={(e) => setNotasConfirmacion(e.target.value)}
                placeholder="Agregar notas a la confirmación..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLiquidacionConfirmar(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmar}
              disabled={confirmarMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Confirmar y Cargar a CC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Anulación */}
      <Dialog open={!!liquidacionAnular} onOpenChange={() => setLiquidacionAnular(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular Liquidación</DialogTitle>
            <DialogDescription>
              {liquidacionAnular?.numero} - {liquidacionAnular?.cliente_nombre}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Monto de la liquidación</p>
              <p className="text-3xl font-bold text-red-600">
                {formatNumber(liquidacionAnular?.total || 0, 'currency')}
              </p>
              {liquidacionAnular?.estado === 'confirmada' && (
                <p className="text-sm text-amber-600 mt-2">
                  Se revertirá el cargo en cuenta corriente
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Motivo de anulación *</Label>
              <Textarea
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
                placeholder="Indique el motivo de la anulación..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLiquidacionAnular(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAnular}
              disabled={anularMutation.isPending || !motivoAnulacion.trim()}
              variant="destructive"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Anular Liquidación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
