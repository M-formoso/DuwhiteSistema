/**
 * Página de Caja
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Plus,
  Minus,
  DollarSign,
  Lock,
  Unlock,
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  Ban,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

import { finanzasService } from '@/services/finanzasService';
import { formatNumber } from '@/utils/formatters';
import {
  CATEGORIAS_INGRESO,
  CATEGORIAS_EGRESO,
  MEDIOS_PAGO_CAJA,
} from '@/types/finanzas';
import type { TipoMovimientoCaja, CategoriaMovimiento, MovimientoCaja } from '@/types/finanzas';

export default function CajaPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Estados para modales
  const [showAbrirModal, setShowAbrirModal] = useState(false);
  const [showCerrarModal, setShowCerrarModal] = useState(false);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimientoCaja>('ingreso');

  // Estados del form de apertura
  const [saldoInicial, setSaldoInicial] = useState('');
  const [obsApertura, setObsApertura] = useState('');

  // Estados del form de cierre
  const [saldoReal, setSaldoReal] = useState('');
  const [obsCierre, setObsCierre] = useState('');

  // Estados del form de movimiento
  const [movCategoria, setMovCategoria] = useState<CategoriaMovimiento>('venta');
  const [movConcepto, setMovConcepto] = useState('');
  const [movMonto, setMovMonto] = useState('');
  const [movMedioPago, setMovMedioPago] = useState('efectivo');
  const [movReferencia, setMovReferencia] = useState('');

  // Query de caja actual
  const { data: caja, isLoading: loadingCaja } = useQuery({
    queryKey: ['caja-actual'],
    queryFn: () => finanzasService.getCajaActual(),
  });

  // Query de movimientos
  const { data: movimientos, isLoading: loadingMovimientos } = useQuery({
    queryKey: ['caja-movimientos', caja?.id],
    queryFn: () => finanzasService.getMovimientosCaja({ caja_id: caja?.id, limit: 50 }),
    enabled: Boolean(caja?.id),
  });

  // Mutations
  const abrirMutation = useMutation({
    mutationFn: () =>
      finanzasService.abrirCaja({
        saldo_inicial: parseFloat(saldoInicial),
        observaciones_apertura: obsApertura || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] });
      toast({ title: 'Caja abierta', description: 'La caja ha sido abierta correctamente.' });
      setShowAbrirModal(false);
      setSaldoInicial('');
      setObsApertura('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo abrir la caja.',
        variant: 'destructive',
      });
    },
  });

  const cerrarMutation = useMutation({
    mutationFn: () =>
      finanzasService.cerrarCaja(caja!.id, {
        saldo_real: parseFloat(saldoReal),
        observaciones_cierre: obsCierre || undefined,
      }),
    onSuccess: (cajaCerrada) => {
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] });
      toast({
        title: 'Caja cerrada',
        description: `Diferencia: $${formatNumber(cajaCerrada.diferencia || 0, 2)}`,
      });
      setShowCerrarModal(false);
      setSaldoReal('');
      setObsCierre('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo cerrar la caja.',
        variant: 'destructive',
      });
    },
  });

  const movimientoMutation = useMutation({
    mutationFn: () =>
      finanzasService.registrarMovimientoCaja({
        tipo: tipoMovimiento,
        categoria: movCategoria,
        concepto: movConcepto,
        monto: parseFloat(movMonto),
        medio_pago: movMedioPago,
        referencia: movReferencia || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] });
      queryClient.invalidateQueries({ queryKey: ['caja-movimientos'] });
      toast({
        title: tipoMovimiento === 'ingreso' ? 'Ingreso registrado' : 'Egreso registrado',
      });
      setShowMovimientoModal(false);
      resetMovimientoForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo registrar el movimiento.',
        variant: 'destructive',
      });
    },
  });

  const anularMutation = useMutation({
    mutationFn: (movimientoId: string) =>
      finanzasService.anularMovimientoCaja(movimientoId, 'Anulado por el usuario'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] });
      queryClient.invalidateQueries({ queryKey: ['caja-movimientos'] });
      toast({ title: 'Movimiento anulado' });
    },
  });

  const resetMovimientoForm = () => {
    setMovCategoria(tipoMovimiento === 'ingreso' ? 'venta' : 'gasto_operativo');
    setMovConcepto('');
    setMovMonto('');
    setMovMedioPago('efectivo');
    setMovReferencia('');
  };

  const openMovimientoModal = (tipo: TipoMovimientoCaja) => {
    setTipoMovimiento(tipo);
    setMovCategoria(tipo === 'ingreso' ? 'venta' : 'gasto_operativo');
    setShowMovimientoModal(true);
  };

  const categorias = tipoMovimiento === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;

  if (loadingCaja) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caja</h1>
          <p className="text-gray-500">
            {caja ? `Caja #${caja.numero} - ${new Date(caja.fecha).toLocaleDateString('es-AR')}` : 'Sin caja abierta'}
          </p>
        </div>
        <div className="flex gap-2">
          {!caja ? (
            <Button onClick={() => setShowAbrirModal(true)}>
              <Unlock className="h-4 w-4 mr-2" />
              Abrir Caja
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => openMovimientoModal('ingreso')}>
                <Plus className="h-4 w-4 mr-2" />
                Ingreso
              </Button>
              <Button variant="outline" onClick={() => openMovimientoModal('egreso')}>
                <Minus className="h-4 w-4 mr-2" />
                Egreso
              </Button>
              <Button variant="destructive" onClick={() => setShowCerrarModal(true)}>
                <Lock className="h-4 w-4 mr-2" />
                Cerrar Caja
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Resumen de Caja */}
      {caja && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Saldo Inicial</p>
                  <p className="text-2xl font-bold">${formatNumber(caja.saldo_inicial, 2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">Total Ingresos</p>
                  <p className="text-2xl font-bold text-green-700">
                    +${formatNumber(caja.total_ingresos, 2)}
                  </p>
                </div>
                <ArrowUpCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">Total Egresos</p>
                  <p className="text-2xl font-bold text-red-700">
                    -${formatNumber(caja.total_egresos, 2)}
                  </p>
                </div>
                <ArrowDownCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-primary">Saldo Actual</p>
                  <p className="text-2xl font-bold text-primary">
                    ${formatNumber(caja.saldo_calculado, 2)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista de Movimientos */}
      {caja && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Movimientos del Día
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMovimientos ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : movimientos?.items && movimientos.items.length > 0 ? (
              <div className="space-y-2">
                {movimientos.items.map((mov) => (
                  <div
                    key={mov.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      mov.anulado
                        ? 'bg-gray-100 opacity-50'
                        : mov.tipo === 'ingreso'
                        ? 'bg-green-50'
                        : 'bg-red-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {mov.tipo === 'ingreso' ? (
                        <ArrowUpCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <ArrowDownCircle className="h-5 w-5 text-red-600" />
                      )}
                      <div>
                        <p className="font-medium">{mov.concepto}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Badge variant="outline">{mov.categoria}</Badge>
                          <span>{mov.medio_pago}</span>
                          <span>
                            {new Date(mov.created_at).toLocaleTimeString('es-AR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-lg font-bold ${
                          mov.anulado
                            ? 'text-gray-400 line-through'
                            : mov.tipo === 'ingreso'
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {mov.tipo === 'ingreso' ? '+' : '-'}${formatNumber(mov.monto, 2)}
                      </span>
                      {!mov.anulado && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('¿Está seguro de anular este movimiento?')) {
                              anularMutation.mutate(mov.id);
                            }
                          }}
                        >
                          <Ban className="h-4 w-4 text-gray-400 hover:text-red-500" />
                        </Button>
                      )}
                      {mov.anulado && (
                        <Badge variant="destructive">Anulado</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">Sin movimientos registrados</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal Abrir Caja */}
      {showAbrirModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle>Abrir Caja</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Saldo Inicial *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={saldoInicial}
                  onChange={(e) => setSaldoInicial(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Textarea
                  value={obsApertura}
                  onChange={(e) => setObsApertura(e.target.value)}
                  placeholder="Observaciones de apertura..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={() => setShowAbrirModal(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => abrirMutation.mutate()}
                  disabled={!saldoInicial || abrirMutation.isPending}
                >
                  Abrir Caja
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Cerrar Caja */}
      {showCerrarModal && caja && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle>Cerrar Caja</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Saldo Calculado:</span>
                  <span className="font-bold">${formatNumber(caja.saldo_calculado, 2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Saldo Real (conteo físico) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={saldoReal}
                  onChange={(e) => setSaldoReal(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              {saldoReal && (
                <div
                  className={`p-3 rounded-lg ${
                    parseFloat(saldoReal) === caja.saldo_calculado
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  <p className="text-sm font-medium">
                    Diferencia: ${formatNumber(parseFloat(saldoReal) - caja.saldo_calculado, 2)}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Textarea
                  value={obsCierre}
                  onChange={(e) => setObsCierre(e.target.value)}
                  placeholder="Observaciones de cierre..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={() => setShowCerrarModal(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => cerrarMutation.mutate()}
                  disabled={!saldoReal || cerrarMutation.isPending}
                >
                  Cerrar Caja
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Registrar Movimiento */}
      {showMovimientoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle>
                {tipoMovimiento === 'ingreso' ? 'Registrar Ingreso' : 'Registrar Egreso'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Categoría *</Label>
                <Select
                  value={movCategoria}
                  onValueChange={(v) => setMovCategoria(v as CategoriaMovimiento)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Concepto *</Label>
                <Input
                  value={movConcepto}
                  onChange={(e) => setMovConcepto(e.target.value)}
                  placeholder="Descripción del movimiento"
                />
              </div>

              <div className="space-y-2">
                <Label>Monto *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={movMonto}
                  onChange={(e) => setMovMonto(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Medio de Pago</Label>
                  <Select value={movMedioPago} onValueChange={setMovMedioPago}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEDIOS_PAGO_CAJA.map((mp) => (
                        <SelectItem key={mp.value} value={mp.value}>
                          {mp.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Referencia</Label>
                  <Input
                    value={movReferencia}
                    onChange={(e) => setMovReferencia(e.target.value)}
                    placeholder="Nro. comprobante"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={() => setShowMovimientoModal(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => movimientoMutation.mutate()}
                  disabled={!movConcepto || !movMonto || movimientoMutation.isPending}
                  className={tipoMovimiento === 'ingreso' ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  {tipoMovimiento === 'ingreso' ? 'Registrar Ingreso' : 'Registrar Egreso'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
