/**
 * Página de Detalle de Liquidación
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  XCircle,
  Edit,
  Trash2,
  Calendar,
  User,
  Package,
  DollarSign,
  FileText,
  Printer,
  Clock,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

import liquidacionService from '@/services/liquidacionService';
import { formatNumber, formatDate, formatDateTime } from '@/utils/formatters';
import { ESTADOS_LIQUIDACION, type EstadoLiquidacion } from '@/types/liquidacion';
import { useState } from 'react';

export default function LiquidacionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showConfirmarDialog, setShowConfirmarDialog] = useState(false);
  const [showAnularDialog, setShowAnularDialog] = useState(false);
  const [notasConfirmacion, setNotasConfirmacion] = useState('');
  const [motivoAnulacion, setMotivoAnulacion] = useState('');

  // Query liquidación
  const { data: liquidacion, isLoading } = useQuery({
    queryKey: ['liquidacion', id],
    queryFn: () => liquidacionService.obtener(id!),
    enabled: !!id,
  });

  // Mutations
  const confirmarMutation = useMutation({
    mutationFn: ({ notas }: { notas?: string }) =>
      liquidacionService.confirmar(id!, { notas }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidacion', id] });
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-pedidos'] });
      toast({ title: 'Liquidación confirmada', description: 'Se generó el cargo en cuenta corriente.' });
      setShowConfirmarDialog(false);
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
    mutationFn: ({ motivo }: { motivo: string }) =>
      liquidacionService.anular(id!, { motivo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidacion', id] });
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-pedidos'] });
      toast({ title: 'Liquidación anulada', description: 'Se revirtió el cargo en cuenta corriente.' });
      setShowAnularDialog(false);
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

  const eliminarMutation = useMutation({
    mutationFn: () => liquidacionService.eliminar(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-pedidos'] });
      toast({ title: 'Liquidación eliminada' });
      navigate('/liquidaciones');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la liquidación.',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">Cargando...</div>
      </div>
    );
  }

  if (!liquidacion) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">Liquidación no encontrada</div>
      </div>
    );
  }

  const getEstadoBadge = (estado: EstadoLiquidacion, anulado: boolean) => {
    if (anulado) {
      return <Badge className="bg-red-100 text-red-800 text-lg px-4 py-1">Anulada</Badge>;
    }
    const config = ESTADOS_LIQUIDACION.find((e) => e.value === estado);
    const colors: Record<string, string> = {
      gray: 'bg-gray-100 text-gray-800',
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
    };
    return <Badge className={`${colors[config?.color || 'gray']} text-lg px-4 py-1`}>{config?.label || estado}</Badge>;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/liquidaciones')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{liquidacion.numero}</h1>
              {getEstadoBadge(liquidacion.estado, liquidacion.anulado)}
            </div>
            <p className="text-muted-foreground">
              Liquidación del pedido {liquidacion.pedido_numero}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {liquidacion.puede_editar && (
            <>
              <Button variant="outline" onClick={() => navigate(`/liquidaciones/${id}/editar`)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar Liquidación</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Se eliminará permanentemente la liquidación.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => eliminarMutation.mutate()}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {liquidacion.puede_confirmar && (
            <Button onClick={() => setShowConfirmarDialog(true)} className="bg-blue-600 hover:bg-blue-700">
              <Check className="h-4 w-4 mr-2" />
              Confirmar
            </Button>
          )}
          {liquidacion.puede_anular && (
            <Button variant="destructive" onClick={() => setShowAnularDialog(true)}>
              <XCircle className="h-4 w-4 mr-2" />
              Anular
            </Button>
          )}
          <Button variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos del cliente y pedido */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Información General
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-medium">{liquidacion.cliente_nombre}</p>
                    {liquidacion.cliente_cuit && (
                      <p className="text-sm text-muted-foreground">CUIT: {liquidacion.cliente_cuit}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Pedido</p>
                    <p className="font-medium">{liquidacion.pedido_numero}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha Liquidación</p>
                    <p className="font-medium">{formatDate(liquidacion.fecha_liquidacion)}</p>
                  </div>
                </div>
                {liquidacion.lista_precios_nombre && (
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Lista de Precios</p>
                      <p className="font-medium">{liquidacion.lista_precios_nombre}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detalles de la liquidación */}
          <Card>
            <CardHeader>
              <CardTitle>Detalle de Servicios</CardTitle>
              <CardDescription>
                Servicios incluidos en esta liquidación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Precio Unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liquidacion.detalles.map((detalle) => (
                    <TableRow key={detalle.id}>
                      <TableCell className="text-muted-foreground">{detalle.numero_linea}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{detalle.servicio_nombre}</p>
                          {detalle.descripcion && (
                            <p className="text-sm text-muted-foreground">{detalle.descripcion}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(detalle.cantidad, 2)}</TableCell>
                      <TableCell>{detalle.unidad}</TableCell>
                      <TableCell className="text-right">{formatNumber(detalle.precio_unitario, 'currency')}</TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(detalle.subtotal, 'currency')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="text-right font-medium">
                      Subtotal
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatNumber(liquidacion.subtotal, 'currency')}
                    </TableCell>
                  </TableRow>
                  {liquidacion.descuento_porcentaje && liquidacion.descuento_porcentaje > 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-right font-medium text-red-600">
                        Descuento ({liquidacion.descuento_porcentaje}%)
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        -{formatNumber(liquidacion.descuento_monto || 0, 'currency')}
                      </TableCell>
                    </TableRow>
                  )}
                  {liquidacion.iva_porcentaje && liquidacion.iva_porcentaje > 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-right font-medium">
                        IVA ({liquidacion.iva_porcentaje}%)
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatNumber(liquidacion.iva_monto || 0, 'currency')}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-primary/5">
                    <TableCell colSpan={5} className="text-right font-bold text-lg">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg text-primary">
                      {formatNumber(liquidacion.total, 'currency')}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {/* Notas */}
          {liquidacion.notas && (
            <Card>
              <CardHeader>
                <CardTitle>Notas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{liquidacion.notas}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Totales */}
          <Card className="bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Resumen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatNumber(liquidacion.subtotal, 'currency')}</span>
              </div>
              {liquidacion.descuento_monto && liquidacion.descuento_monto > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Descuento</span>
                  <span>-{formatNumber(liquidacion.descuento_monto, 'currency')}</span>
                </div>
              )}
              {liquidacion.iva_monto && liquidacion.iva_monto > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA</span>
                  <span className="font-medium">{formatNumber(liquidacion.iva_monto, 'currency')}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-bold">Total</span>
                <span className="font-bold text-primary">{formatNumber(liquidacion.total, 'currency')}</span>
              </div>
            </CardContent>
          </Card>

          {/* Historial */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Historial
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-gray-400 mt-2" />
                <div>
                  <p className="font-medium">Creada</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(liquidacion.created_at)}
                  </p>
                  {liquidacion.liquidado_por_nombre && (
                    <p className="text-sm text-muted-foreground">
                      Por {liquidacion.liquidado_por_nombre}
                    </p>
                  )}
                </div>
              </div>

              {liquidacion.fecha_confirmacion && (
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
                  <div>
                    <p className="font-medium">Confirmada</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(liquidacion.fecha_confirmacion)}
                    </p>
                    {liquidacion.confirmado_por_nombre && (
                      <p className="text-sm text-muted-foreground">
                        Por {liquidacion.confirmado_por_nombre}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {liquidacion.anulado && liquidacion.fecha_anulacion && (
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-red-500 mt-2" />
                  <div>
                    <p className="font-medium text-red-600">Anulada</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(liquidacion.fecha_anulacion)}
                    </p>
                    {liquidacion.motivo_anulacion && (
                      <p className="text-sm text-red-600">
                        Motivo: {liquidacion.motivo_anulacion}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cuenta Corriente */}
          {liquidacion.movimiento_cc_id && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <DollarSign className="h-5 w-5" />
                  Cuenta Corriente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-blue-700">
                  Esta liquidación generó un cargo en la cuenta corriente del cliente por{' '}
                  <span className="font-bold">{formatNumber(liquidacion.total, 'currency')}</span>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate(`/clientes/${liquidacion.cliente_id}/cuenta-corriente`)}
                >
                  Ver Cuenta Corriente
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal Confirmar */}
      <Dialog open={showConfirmarDialog} onOpenChange={setShowConfirmarDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Liquidación</DialogTitle>
            <DialogDescription>
              Se generará un cargo en la cuenta corriente del cliente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Monto a cargar</p>
              <p className="text-3xl font-bold text-blue-600">
                {formatNumber(liquidacion.total, 'currency')}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notasConfirmacion}
                onChange={(e) => setNotasConfirmacion(e.target.value)}
                placeholder="Agregar notas..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmarDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => confirmarMutation.mutate({ notas: notasConfirmacion || undefined })}
              disabled={confirmarMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Anular */}
      <Dialog open={showAnularDialog} onOpenChange={setShowAnularDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular Liquidación</DialogTitle>
            <DialogDescription>
              Se revertirá el cargo en cuenta corriente si existe
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Monto de la liquidación</p>
              <p className="text-3xl font-bold text-red-600">
                {formatNumber(liquidacion.total, 'currency')}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Motivo de anulación *</Label>
              <Textarea
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
                placeholder="Indique el motivo..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnularDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => anularMutation.mutate({ motivo: motivoAnulacion })}
              disabled={anularMutation.isPending || !motivoAnulacion.trim()}
              variant="destructive"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Anular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
