/**
 * Detalle de Factura.
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Send,
  Printer,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Trash2,
  Loader2,
  FilePlus,
  FileMinus,
  DollarSign,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

import { facturaService } from '@/services/facturaService';
import { getErrorMessage } from '@/services/api';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/formatters';
import {
  TIPOS_COMPROBANTE_LABEL,
  ESTADOS_FACTURA_COLOR,
  ESTADOS_FACTURA_LABEL,
  ESTADOS_PAGO_COLOR,
  ESTADOS_PAGO_LABEL,
  MEDIOS_PAGO,
} from '@/types/factura';

export default function FacturaDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showEmitirConfirm, setShowEmitirConfirm] = useState(false);
  const [showEliminarConfirm, setShowEliminarConfirm] = useState(false);
  const [showCobroDialog, setShowCobroDialog] = useState(false);
  const [cobroMonto, setCobroMonto] = useState('');
  const [cobroMedio, setCobroMedio] = useState('efectivo');
  const [cobroFecha, setCobroFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [cobroReferencia, setCobroReferencia] = useState('');
  const [cobroObservaciones, setCobroObservaciones] = useState('');

  const { data: factura, isLoading } = useQuery({
    queryKey: ['factura', id],
    queryFn: () => facturaService.obtener(id!),
    enabled: !!id,
  });

  const emitirMutation = useMutation({
    mutationFn: () => facturaService.emitir(id!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['factura', id] });
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      if (res.estado === 'autorizada') {
        toast({
          title: 'Factura autorizada',
          description: `CAE ${res.cae} · ${res.numero_completo}`,
        });
      } else if (res.estado === 'rechazada') {
        toast({
          variant: 'destructive',
          title: 'AFIP rechazó la factura',
          description: res.observaciones || res.errores || 'Revisá los datos e intentá de nuevo.',
        });
      }
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Error al emitir',
        description: getErrorMessage(err),
      });
    },
  });

  const cobroMutation = useMutation({
    mutationFn: () =>
      facturaService.registrarCobro(id!, {
        monto: Number(cobroMonto),
        medio_pago: cobroMedio,
        fecha_cobro: cobroFecha || undefined,
        referencia_pago: cobroReferencia || undefined,
        observaciones: cobroObservaciones || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['factura', id] });
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      queryClient.invalidateQueries({ queryKey: ['cuenta-corriente'] });
      setShowCobroDialog(false);
      setCobroMonto('');
      setCobroReferencia('');
      setCobroObservaciones('');
      toast({
        title: 'Cobro registrado',
        description:
          res.estado_pago === 'pagada'
            ? 'La factura quedó totalmente pagada.'
            : `Adeudado: ${res.monto_adeudado}`,
      });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'No se pudo registrar el cobro',
        description: getErrorMessage(err),
      });
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: () => facturaService.eliminarBorrador(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      toast({ title: 'Borrador eliminado' });
      navigate('/facturacion');
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'No se pudo eliminar',
        description: getErrorMessage(err),
      });
    },
  });

  const descargarPdf = async () => {
    if (!factura) return;
    try {
      const blob = await facturaService.descargarPdf(factura.id);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo generar el PDF',
        description: getErrorMessage(err),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!factura) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-2" />
          <p className="text-text-primary">Factura no encontrada</p>
          <Button variant="link" onClick={() => navigate('/facturacion')}>
            Volver al listado
          </Button>
        </CardContent>
      </Card>
    );
  }

  const esBorrador = factura.estado === 'borrador';
  const esAutorizada = factura.estado === 'autorizada';
  const total = Number(factura.total);
  const pagado = Number(factura.monto_pagado || 0);
  const adeudado = Math.max(total - pagado, 0);
  const puedeCobrar =
    esAutorizada &&
    !factura.factura_original_id &&
    factura.estado_pago !== 'pagada' &&
    factura.estado_pago !== 'no_aplica';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/facturacion')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              {TIPOS_COMPROBANTE_LABEL[factura.tipo]}
              {factura.letra && (
                <Badge variant="outline" className="font-mono text-base">
                  {factura.letra}
                </Badge>
              )}
            </h1>
            <p className="text-text-secondary font-mono">
              {factura.numero_completo || '(sin número — borrador)'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {esBorrador && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowEliminarConfirm(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
              <Button
                onClick={() => setShowEmitirConfirm(true)}
                disabled={emitirMutation.isPending}
                className="bg-primary hover:bg-primary-hover"
              >
                {emitirMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Emitir a AFIP
              </Button>
            </>
          )}
          {esAutorizada && (
            <>
              <Button onClick={descargarPdf} variant="outline">
                <Printer className="w-4 h-4 mr-2" />
                Descargar PDF
              </Button>
              {puedeCobrar && (
                <Button
                  onClick={() => {
                    setCobroMonto(adeudado.toFixed(2));
                    setShowCobroDialog(true);
                  }}
                  className="bg-primary hover:bg-primary-hover"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Registrar cobro
                </Button>
              )}
              {!factura.factura_original_id && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/facturacion/${factura.id}/nota-credito`)}
                  >
                    <FileMinus className="w-4 h-4 mr-2" />
                    Nota de Crédito
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/facturacion/${factura.id}/nota-debito`)}
                  >
                    <FilePlus className="w-4 h-4 mr-2" />
                    Nota de Débito
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Estado y CAE */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-text-secondary">Estado</p>
            <Badge className={ESTADOS_FACTURA_COLOR[factura.estado] + ' mt-1'}>
              {ESTADOS_FACTURA_LABEL[factura.estado]}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-text-secondary">Fecha emisión</p>
            <p className="font-semibold mt-1">{formatDate(factura.fecha_emision)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-text-secondary">CAE</p>
            <p className="font-mono mt-1 text-sm">
              {factura.cae || <span className="text-text-secondary">—</span>}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-text-secondary">Vto CAE</p>
            <p className="font-semibold mt-1">
              {factura.cae_vencimiento ? (
                formatDate(factura.cae_vencimiento)
              ) : (
                <span className="text-text-secondary">—</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Estado de cobranza (solo facturas autorizadas que aplican) */}
      {esAutorizada && factura.estado_pago !== 'no_aplica' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Estado de cobranza</span>
              <Badge className={ESTADOS_PAGO_COLOR[factura.estado_pago]}>
                {ESTADOS_PAGO_LABEL[factura.estado_pago]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-text-secondary">Total factura</p>
              <p className="text-lg font-semibold">{formatCurrency(total)}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">Cobrado</p>
              <p className="text-lg font-semibold text-green-700">
                {formatCurrency(pagado)}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">Adeudado</p>
              <p
                className={
                  'text-lg font-semibold ' +
                  (adeudado > 0 ? 'text-red-700' : 'text-text-secondary')
                }
              >
                {formatCurrency(adeudado)}
              </p>
              {factura.fecha_ultimo_cobro && (
                <p className="text-xs text-text-secondary mt-1">
                  Último cobro: {formatDate(factura.fecha_ultimo_cobro)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Errores / Observaciones AFIP */}
      {(factura.afip_errores || factura.afip_observaciones) && (
        <Card
          className={
            factura.estado === 'rechazada'
              ? 'border-destructive'
              : 'border-warning'
          }
        >
          <CardContent className="pt-6 space-y-2">
            {factura.afip_errores && (
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-destructive mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Errores AFIP</p>
                  <p className="text-sm text-text-primary whitespace-pre-wrap">
                    {factura.afip_errores}
                  </p>
                </div>
              </div>
            )}
            {factura.afip_observaciones && (
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-warning">Observaciones AFIP</p>
                  <p className="text-sm text-text-primary whitespace-pre-wrap">
                    {factura.afip_observaciones}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cliente */}
      <Card>
        <CardHeader>
          <CardTitle>Cliente</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-text-secondary">Razón social</p>
            <p className="font-semibold">{factura.cliente_razon_social_snap}</p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Condición IVA</p>
            <p>{factura.cliente_condicion_iva_snap}</p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">
              {factura.cliente_documento_tipo_snap || 'Documento'}
            </p>
            <p className="font-mono">
              {factura.cliente_documento_nro_snap || <span className="text-text-secondary">—</span>}
            </p>
          </div>
          <div>
            <p className="text-sm text-text-secondary">Domicilio</p>
            <p>{factura.cliente_domicilio_snap || '—'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Detalle */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">P. Unit. (neto)</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Subtotal neto</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {factura.detalles.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.descripcion}</TableCell>
                  <TableCell className="text-right">
                    {Number(d.cantidad)} {d.unidad_medida}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(d.precio_unitario_neto))}
                  </TableCell>
                  <TableCell className="text-right">{Number(d.iva_porcentaje)}%</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(d.subtotal_neto))}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(Number(d.total_linea))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Totales */}
      <Card>
        <CardHeader>
          <CardTitle>Totales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md ml-auto space-y-1">
            {Number(factura.neto_gravado_21) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Neto gravado 21%</span>
                <span>{formatCurrency(Number(factura.neto_gravado_21))}</span>
              </div>
            )}
            {Number(factura.neto_gravado_105) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Neto gravado 10,5%</span>
                <span>{formatCurrency(Number(factura.neto_gravado_105))}</span>
              </div>
            )}
            {Number(factura.neto_no_gravado) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">No gravado</span>
                <span>{formatCurrency(Number(factura.neto_no_gravado))}</span>
              </div>
            )}
            {factura.letra === 'A' && (
              <>
                {Number(factura.iva_21) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">IVA 21%</span>
                    <span>{formatCurrency(Number(factura.iva_21))}</span>
                  </div>
                )}
                {Number(factura.iva_105) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">IVA 10,5%</span>
                    <span>{formatCurrency(Number(factura.iva_105))}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between pt-2 border-t mt-2">
              <span className="text-base font-bold">Total</span>
              <span className="text-base font-bold">
                {formatCurrency(Number(factura.total))}
              </span>
            </div>
            {factura.letra === 'B' && Number(factura.total) > 0 && (
              <p className="text-xs text-text-secondary text-right">(IVA incluido)</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      {(factura.observaciones || factura.motivo || factura.emitido_at) && (
        <Card>
          <CardContent className="pt-6 space-y-2 text-sm">
            {factura.motivo && (
              <div>
                <p className="text-text-secondary">Motivo</p>
                <p>{factura.motivo}</p>
              </div>
            )}
            {factura.observaciones && (
              <div>
                <p className="text-text-secondary">Observaciones</p>
                <p className="whitespace-pre-wrap">{factura.observaciones}</p>
              </div>
            )}
            {factura.emitido_at && (
              <div>
                <p className="text-text-secondary">Emitida</p>
                <p>{formatDateTime(factura.emitido_at)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog confirmar emisión */}
      <AlertDialog open={showEmitirConfirm} onOpenChange={setShowEmitirConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir factura a AFIP</AlertDialogTitle>
            <AlertDialogDescription>
              Se solicitará el CAE a AFIP ({factura.letra ? `Factura ${factura.letra}` : 'comprobante'}).
              Una vez autorizada, la factura no se puede modificar. Para anularla habrá que emitir
              una Nota de Crédito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowEmitirConfirm(false);
                emitirMutation.mutate();
              }}
            >
              Emitir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog registrar cobro */}
      <Dialog open={showCobroDialog} onOpenChange={setShowCobroDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar cobro</DialogTitle>
            <DialogDescription>
              Saldo adeudado: <span className="font-semibold">{formatCurrency(adeudado)}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="cobro-monto">Monto *</Label>
              <Input
                id="cobro-monto"
                type="number"
                step="0.01"
                min="0"
                max={adeudado}
                value={cobroMonto}
                onChange={(e) => setCobroMonto(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="cobro-medio">Medio de pago</Label>
              <Select value={cobroMedio} onValueChange={setCobroMedio}>
                <SelectTrigger id="cobro-medio">
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
            <div>
              <Label htmlFor="cobro-fecha">Fecha</Label>
              <Input
                id="cobro-fecha"
                type="date"
                value={cobroFecha}
                onChange={(e) => setCobroFecha(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="cobro-ref">Referencia (opcional)</Label>
              <Input
                id="cobro-ref"
                placeholder="Nro de transferencia, cheque, etc."
                value={cobroReferencia}
                onChange={(e) => setCobroReferencia(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="cobro-obs">Observaciones (opcional)</Label>
              <Textarea
                id="cobro-obs"
                value={cobroObservaciones}
                onChange={(e) => setCobroObservaciones(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCobroDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => cobroMutation.mutate()}
              disabled={
                cobroMutation.isPending ||
                !cobroMonto ||
                Number(cobroMonto) <= 0 ||
                Number(cobroMonto) > adeudado + 0.01
              }
            >
              {cobroMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <DollarSign className="w-4 h-4 mr-2" />
              )}
              Confirmar cobro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmar eliminación */}
      <AlertDialog open={showEliminarConfirm} onOpenChange={setShowEliminarConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar borrador</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción solo está disponible para facturas en borrador (sin CAE).
              ¿Confirmás la eliminación?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowEliminarConfirm(false);
                eliminarMutation.mutate();
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
