/**
 * Detalle de Orden de Compra
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
  Building2,
  Calendar,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Loader2,
  AlertTriangle,
  Send,
  PackageCheck,
  Truck,
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
import { useToast } from '@/components/ui/use-toast';
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

import { proveedorService } from '@/services/proveedorService';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/formatters';
import type { EstadoOrdenCompra } from '@/types/proveedor';

const ESTADO_COLORS: Record<EstadoOrdenCompra, string> = {
  borrador: 'bg-gray-100 text-gray-700',
  pendiente: 'bg-yellow-100 text-yellow-700',
  aprobada: 'bg-blue-100 text-blue-700',
  enviada: 'bg-purple-100 text-purple-700',
  parcial: 'bg-orange-100 text-orange-700',
  completada: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
};

const ESTADO_ICONS: Record<EstadoOrdenCompra, React.ReactNode> = {
  borrador: <FileText className="h-4 w-4" />,
  pendiente: <Clock className="h-4 w-4" />,
  aprobada: <CheckCircle className="h-4 w-4" />,
  enviada: <Send className="h-4 w-4" />,
  parcial: <PackageCheck className="h-4 w-4" />,
  completada: <Truck className="h-4 w-4" />,
  cancelada: <XCircle className="h-4 w-4" />,
};

const ESTADO_LABELS: Record<EstadoOrdenCompra, string> = {
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  enviada: 'Enviada',
  parcial: 'Parcial',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export default function OrdenCompraDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Cargar orden
  const { data: orden, isLoading, error } = useQuery({
    queryKey: ['orden-compra', id],
    queryFn: () => proveedorService.getOrdenCompra(id!),
    enabled: Boolean(id),
  });

  // Aprobar orden
  const aprobarMutation = useMutation({
    mutationFn: () => proveedorService.aprobarOrdenCompra(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] });
      queryClient.invalidateQueries({ queryKey: ['orden-compra', id] });
      toast({
        title: 'Orden aprobada',
        description: 'La orden ha sido aprobada correctamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo aprobar la orden.',
        variant: 'destructive',
      });
    },
  });

  // Enviar orden
  const enviarMutation = useMutation({
    mutationFn: () => proveedorService.enviarOrdenCompra(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] });
      queryClient.invalidateQueries({ queryKey: ['orden-compra', id] });
      toast({
        title: 'Orden enviada',
        description: 'La orden ha sido marcada como enviada.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo enviar la orden.',
        variant: 'destructive',
      });
    },
  });

  // Cancelar orden
  const cancelarMutation = useMutation({
    mutationFn: () => proveedorService.cancelarOrdenCompra(id!, 'Cancelada por usuario'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] });
      toast({
        title: 'Orden cancelada',
        description: 'La orden ha sido cancelada.',
      });
      navigate('/proveedores/ordenes');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo cancelar la orden.',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !orden) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <p>No se encontró la orden de compra</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/proveedores/ordenes')}>
          Volver a Órdenes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/proveedores/ordenes')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                Orden #{orden.numero}
              </h1>
              <Badge className={ESTADO_COLORS[orden.estado]}>
                {ESTADO_ICONS[orden.estado]}
                <span className="ml-1">{ESTADO_LABELS[orden.estado]}</span>
              </Badge>
            </div>
            <p className="text-gray-500">
              {orden.proveedor_nombre} - {formatDate(orden.fecha_emision)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          {orden.puede_editar && (
            <Button
              variant="outline"
              onClick={() => navigate(`/proveedores/ordenes/${id}/editar`)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          {orden.puede_cancelar && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={cancelarMutation.isPending}>
                  {cancelarMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Cancelar
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Cancelar orden de compra?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. La orden será marcada como cancelada.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>No, mantener</AlertDialogCancel>
                  <AlertDialogAction onClick={() => cancelarMutation.mutate()}>
                    Sí, cancelar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Acciones de Estado */}
      {(orden.puede_aprobar || orden.estado === 'aprobada') && (
        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
            <CardDescription>Gestione el estado de la orden</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {orden.puede_aprobar && (
                <Button
                  onClick={() => aprobarMutation.mutate()}
                  disabled={aprobarMutation.isPending}
                >
                  {aprobarMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aprobar Orden
                </Button>
              )}
              {orden.estado === 'aprobada' && (
                <Button
                  onClick={() => enviarMutation.mutate()}
                  disabled={enviarMutation.isPending}
                >
                  {enviarMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Send className="h-4 w-4 mr-2" />
                  Marcar como Enviada
                </Button>
              )}
              {(orden.estado === 'enviada' || orden.estado === 'parcial') && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/proveedores/ordenes/${id}/recepcion`)}
                >
                  <PackageCheck className="h-4 w-4 mr-2" />
                  Registrar Recepción
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Proveedor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Proveedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted"
              onClick={() => navigate(`/proveedores/${orden.proveedor_id}`)}
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{orden.proveedor_nombre}</p>
                <p className="text-sm text-muted-foreground">Ver perfil</p>
              </div>
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
              <span className="text-muted-foreground">Emisión:</span>
              <span>{formatDate(orden.fecha_emision)}</span>
            </div>
            {orden.fecha_entrega_estimada && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entrega est.:</span>
                <span>{formatDate(orden.fecha_entrega_estimada)}</span>
              </div>
            )}
            {orden.fecha_entrega_real && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entrega real:</span>
                <span>{formatDate(orden.fecha_entrega_real)}</span>
              </div>
            )}
            {orden.fecha_aprobacion && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aprobación:</span>
                <span>{formatDate(orden.fecha_aprobacion)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Condiciones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Condiciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {orden.condicion_pago && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pago:</span>
                <span>{orden.condicion_pago}</span>
              </div>
            )}
            {orden.plazo_pago_dias && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plazo:</span>
                <span>{orden.plazo_pago_dias} días</span>
              </div>
            )}
            {orden.lugar_entrega && (
              <div>
                <span className="text-muted-foreground text-sm">Lugar entrega:</span>
                <p className="text-sm">{orden.lugar_entrega}</p>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Moneda:</span>
              <span>{orden.moneda}</span>
            </div>
          </CardContent>
        </Card>

        {/* Detalle de Items */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Items de la Orden
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Recibido</TableHead>
                  <TableHead className="text-right">Precio Unit.</TableHead>
                  <TableHead className="text-right">Descuento</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orden.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">
                      {item.numero_linea}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {item.insumo_nombre || item.descripcion}
                        </p>
                        {item.insumo_codigo && (
                          <p className="text-sm text-muted-foreground font-mono">
                            {item.insumo_codigo}
                          </p>
                        )}
                        {item.notas && (
                          <p className="text-sm text-muted-foreground">{item.notas}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.cantidad} {item.unidad}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          item.completamente_recibido
                            ? 'text-green-600'
                            : item.cantidad_recibida > 0
                            ? 'text-orange-600'
                            : 'text-muted-foreground'
                        }
                      >
                        {item.cantidad_recibida} {item.unidad}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.precio_unitario)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.descuento_porcentaje > 0
                        ? `${item.descuento_porcentaje}%`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.subtotal)}
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
                  <span>{formatCurrency(orden.subtotal)}</span>
                </div>
                {orden.descuento_monto > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Descuento ({orden.descuento_porcentaje}%):</span>
                    <span>-{formatCurrency(orden.descuento_monto)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA (21%):</span>
                  <span>{formatCurrency(orden.iva)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-primary">{formatCurrency(orden.total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notas */}
        {(orden.notas || orden.notas_internas) && (
          <>
            {orden.notas && (
              <Card>
                <CardHeader>
                  <CardTitle>Notas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{orden.notas}</p>
                </CardContent>
              </Card>
            )}
            {orden.notas_internas && (
              <Card>
                <CardHeader>
                  <CardTitle>Notas Internas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {orden.notas_internas}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Aprobación */}
        {orden.aprobada_por_nombre && (
          <Card>
            <CardHeader>
              <CardTitle>Aprobación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aprobada por:</span>
                <span>{orden.aprobada_por_nombre}</span>
              </div>
              {orden.fecha_aprobacion && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha:</span>
                  <span>{formatDateTime(orden.fecha_aprobacion)}</span>
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
                <span className="text-foreground">{orden.creado_por_nombre}</span>
              </div>
              <div>
                <span>Creado:</span>{' '}
                <span className="text-foreground">{formatDateTime(orden.created_at)}</span>
              </div>
              {orden.updated_at && (
                <div>
                  <span>Última actualización:</span>{' '}
                  <span className="text-foreground">{formatDateTime(orden.updated_at)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
