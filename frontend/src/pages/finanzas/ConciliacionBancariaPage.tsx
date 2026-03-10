/**
 * Página de Conciliación Bancaria
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Building,
  Calendar,
  DollarSign,
  Percent,
  ArrowLeft,
  Check,
  X,
  FileText,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

import { conciliacionBancariaService } from '@/services/finanzasAvanzadasService';
import { finanzasService } from '@/services/finanzasService';
import { formatNumber, formatDate } from '@/utils/formatters';
import { ESTADOS_CONCILIACION } from '@/types/finanzas-avanzadas';
import type {
  ConciliacionBancaria,
  ConciliacionBancariaList,
  ItemConciliacion,
  EstadoConciliacion,
} from '@/types/finanzas-avanzadas';

function ListaConciliaciones() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showNuevaModal, setShowNuevaModal] = useState(false);
  const [cuentaId, setCuentaId] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [pagina, setPagina] = useState(0);
  const limite = 20;

  // Query cuentas bancarias
  const { data: cuentas } = useQuery({
    queryKey: ['cuentas-bancarias'],
    queryFn: () => finanzasService.getCuentasBancarias(),
  });

  // Query conciliaciones
  const { data: conciliacionesData, isLoading } = useQuery({
    queryKey: ['conciliaciones', pagina],
    queryFn: () =>
      conciliacionBancariaService.getConciliaciones({
        skip: pagina * limite,
        limit: limite,
      }),
  });

  // Mutation crear
  const crearMutation = useMutation({
    mutationFn: () =>
      conciliacionBancariaService.iniciar({
        cuenta_id: cuentaId,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conciliaciones'] });
      toast({ title: 'Conciliación iniciada', description: 'Puede comenzar a conciliar movimientos.' });
      navigate(`/finanzas/conciliacion/${data.id}`);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo iniciar la conciliación.',
        variant: 'destructive',
      });
    },
  });

  const conciliaciones = conciliacionesData?.items || [];
  const total = conciliacionesData?.total || 0;

  const getEstadoBadge = (estado: EstadoConciliacion) => {
    const config = ESTADOS_CONCILIACION.find((e) => e.value === estado);
    const colors: Record<string, string> = {
      yellow: 'bg-yellow-100 text-yellow-800',
      green: 'bg-green-100 text-green-800',
    };
    return <Badge className={colors[config?.color || 'gray']}>{config?.label || estado}</Badge>;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conciliación Bancaria</h1>
          <p className="text-muted-foreground">
            Concilie movimientos bancarios con extractos
          </p>
        </div>
        <Button onClick={() => setShowNuevaModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Conciliación
        </Button>
      </div>

      {/* Lista de conciliaciones */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8">Cargando...</div>
          ) : conciliaciones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay conciliaciones registradas.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Conciliados</TableHead>
                  <TableHead className="text-center">Pendientes</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conciliaciones.map((conc: ConciliacionBancariaList) => (
                  <TableRow key={conc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        {conc.cuenta_nombre}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDate(conc.fecha_desde)} - {formatDate(conc.fecha_hasta)}
                    </TableCell>
                    <TableCell>{getEstadoBadge(conc.estado)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-green-50">
                        {conc.cantidad_conciliados}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-yellow-50">
                        {conc.cantidad_pendientes}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right ${
                        conc.diferencia && conc.diferencia !== 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {conc.diferencia !== null ? formatNumber(conc.diferencia, 'currency') : '-'}
                    </TableCell>
                    <TableCell>{formatDate(conc.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/finanzas/conciliacion/${conc.id}`)}
                      >
                        {conc.estado === 'en_proceso' ? 'Continuar' : 'Ver'}
                      </Button>
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

      {/* Modal Nueva Conciliación */}
      <Dialog open={showNuevaModal} onOpenChange={setShowNuevaModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Conciliación Bancaria</DialogTitle>
            <DialogDescription>
              Seleccione la cuenta y el período a conciliar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cuenta Bancaria</label>
              <Select value={cuentaId} onValueChange={setCuentaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione una cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {cuentas?.map((cuenta: any) => (
                    <SelectItem key={cuenta.id} value={cuenta.id}>
                      {cuenta.nombre} - {cuenta.banco}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha Desde</label>
                <Input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha Hasta</label>
                <Input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNuevaModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => crearMutation.mutate()}
              disabled={!cuentaId || !fechaDesde || !fechaHasta || crearMutation.isPending}
            >
              Iniciar Conciliación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetalleConciliacion() {
  const { conciliacionId } = useParams<{ conciliacionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [saldoExtracto, setSaldoExtracto] = useState('');
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  // Query conciliación
  const { data: conciliacion, isLoading } = useQuery({
    queryKey: ['conciliacion', conciliacionId],
    queryFn: () => conciliacionBancariaService.getConciliacion(conciliacionId!),
    enabled: Boolean(conciliacionId),
  });

  // Mutations
  const conciliarMutation = useMutation({
    mutationFn: ({ movimientoId }: { movimientoId: string }) =>
      conciliacionBancariaService.conciliarMovimiento(conciliacionId!, {
        movimiento_bancario_id: movimientoId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conciliacion', conciliacionId] });
    },
  });

  const desconciliarMutation = useMutation({
    mutationFn: (movimientoId: string) =>
      conciliacionBancariaService.desconciliarMovimiento(conciliacionId!, movimientoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conciliacion', conciliacionId] });
    },
  });

  const conciliarVariosMutation = useMutation({
    mutationFn: (ids: string[]) =>
      conciliacionBancariaService.conciliarVarios(
        conciliacionId!,
        ids.map((id) => ({ movimiento_bancario_id: id }))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conciliacion', conciliacionId] });
      setSeleccionados(new Set());
      toast({ title: 'Movimientos conciliados', description: 'Los movimientos seleccionados han sido conciliados.' });
    },
  });

  const finalizarMutation = useMutation({
    mutationFn: () =>
      conciliacionBancariaService.finalizar(conciliacionId!, {
        saldo_extracto_bancario: parseFloat(saldoExtracto),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conciliacion', conciliacionId] });
      toast({ title: 'Conciliación finalizada', description: 'La conciliación ha sido completada.' });
      setShowFinalizarModal(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo finalizar.',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return <div className="container mx-auto py-6 text-center">Cargando...</div>;
  }

  if (!conciliacion) {
    return <div className="container mx-auto py-6 text-center">Conciliación no encontrada.</div>;
  }

  const items = conciliacion.items || [];
  const pendientes = items.filter((i) => !i.conciliado);
  const conciliados = items.filter((i) => i.conciliado);
  const porcentaje =
    items.length > 0 ? (conciliados.length / items.length) * 100 : 0;

  const toggleSeleccion = (id: string) => {
    const nuevos = new Set(seleccionados);
    if (nuevos.has(id)) {
      nuevos.delete(id);
    } else {
      nuevos.add(id);
    }
    setSeleccionados(nuevos);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/finanzas/conciliacion')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              Conciliación - {conciliacion.cuenta_nombre}
            </h1>
            <p className="text-muted-foreground">
              {formatDate(conciliacion.fecha_desde)} - {formatDate(conciliacion.fecha_hasta)}
            </p>
          </div>
        </div>
        {!conciliacion.esta_finalizada && (
          <Button onClick={() => setShowFinalizarModal(true)}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Finalizar Conciliación
          </Button>
        )}
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progreso</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{porcentaje.toFixed(0)}%</div>
            <Progress value={porcentaje} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conciliados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{conciliados.length}</div>
            <p className="text-sm text-muted-foreground">
              {formatNumber(conciliacion.monto_conciliado, 'currency')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendientes.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Sistema</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(conciliacion.saldo_sistema || 0, 'currency')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Acciones masivas */}
      {!conciliacion.esta_finalizada && seleccionados.size > 0 && (
        <Card className="bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {seleccionados.size} movimiento(s) seleccionado(s)
              </p>
              <Button
                size="sm"
                onClick={() => conciliarVariosMutation.mutate(Array.from(seleccionados))}
                disabled={conciliarVariosMutation.isPending}
              >
                <Check className="h-4 w-4 mr-2" />
                Conciliar Seleccionados
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla de movimientos */}
      <Card>
        <CardHeader>
          <CardTitle>Movimientos del Período</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {!conciliacion.esta_finalizada && <TableHead className="w-12"></TableHead>}
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                {!conciliacion.esta_finalizada && <TableHead>Acción</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: ItemConciliacion) => (
                <TableRow key={item.id} className={item.conciliado ? 'bg-green-50' : ''}>
                  {!conciliacion.esta_finalizada && (
                    <TableCell>
                      {!item.conciliado && (
                        <Checkbox
                          checked={seleccionados.has(item.movimiento_bancario_id)}
                          onCheckedChange={() => toggleSeleccion(item.movimiento_bancario_id)}
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    {item.fecha_movimiento ? formatDate(item.fecha_movimiento) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.tipo_movimiento}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{item.concepto}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(item.monto || 0, 'currency')}
                  </TableCell>
                  <TableCell>
                    {item.conciliado ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Conciliado
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-800">
                        <Clock className="h-3 w-3 mr-1" />
                        Pendiente
                      </Badge>
                    )}
                  </TableCell>
                  {!conciliacion.esta_finalizada && (
                    <TableCell>
                      {item.conciliado ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => desconciliarMutation.mutate(item.movimiento_bancario_id)}
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            conciliarMutation.mutate({
                              movimientoId: item.movimiento_bancario_id,
                            })
                          }
                        >
                          <Check className="h-4 w-4 text-green-500" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Finalizar */}
      <Dialog open={showFinalizarModal} onOpenChange={setShowFinalizarModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar Conciliación</DialogTitle>
            <DialogDescription>
              Ingrese el saldo del extracto bancario para calcular la diferencia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Saldo según Extracto Bancario</label>
              <Input
                type="number"
                step="0.01"
                value={saldoExtracto}
                onChange={(e) => setSaldoExtracto(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Saldo del sistema: {formatNumber(conciliacion.saldo_sistema || 0, 'currency')}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinalizarModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => finalizarMutation.mutate()}
              disabled={!saldoExtracto || finalizarMutation.isPending}
            >
              Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ConciliacionBancariaPage() {
  const { conciliacionId } = useParams<{ conciliacionId: string }>();

  if (conciliacionId) {
    return <DetalleConciliacion />;
  }

  return <ListaConciliaciones />;
}
