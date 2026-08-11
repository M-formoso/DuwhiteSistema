/**
 * Página Mi Cuenta Corriente - Vista para clientes
 * Muestra saldo pendiente, total del período y tabs con remitos, productos
 * entregados y deuda pendiente. Todo filtrable por rango de fechas.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  Wallet,
  AlertCircle,
  FileText,
  Receipt,
  Eye,
  Package,
  X,
  CalendarClock,
  CalendarRange,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useAuthStore } from '@/stores/authStore';
import { clienteService } from '@/services/clienteService';
import {
  remitoService,
  type MiRemitoListItem,
  type MiRemitoDetalle,
  type MisProductosEntregadosResponse,
} from '@/services/remitoService';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { MovimientoCuentaCorriente } from '@/types/cliente';

const TIPOS_MOVIMIENTO: Record<string, { label: string; color: string }> = {
  cargo: { label: 'Cargo', color: 'destructive' },
  factura: { label: 'Factura', color: 'destructive' },
  pago: { label: 'Pago', color: 'success' },
  nota_credito: { label: 'Nota de Crédito', color: 'info' },
  nota_debito: { label: 'Nota de Débito', color: 'warning' },
  ajuste: { label: 'Ajuste', color: 'secondary' },
};

function primerDiaMesActualISO(): string {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function hoyISO(): string {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const d = String(hoy.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function MiCuentaCorrientePage() {
  const user = useAuthStore((state) => state.user);
  const vePrecios = user?.ve_precios !== false;
  // Default: mes actual (desde el 1 hasta hoy)
  const [fechaDesde, setFechaDesde] = useState<string>(() => primerDiaMesActualISO());
  const [fechaHasta, setFechaHasta] = useState<string>(() => hoyISO());
  const [movimientoDetalle, setMovimientoDetalle] = useState<MovimientoCuentaCorriente | null>(null);
  const [remitoDetalleId, setRemitoDetalleId] = useState<string | null>(null);

  const clienteId = user?.cliente_id;
  const rangoFechas = {
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  };

  const { data: estadoCuenta } = useQuery({
    queryKey: ['mi-estado-cuenta', clienteId, fechaDesde, fechaHasta],
    queryFn: () =>
      clienteService.getEstadoCuenta(clienteId!, {
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      }),
    enabled: !!clienteId,
  });

  const { data: movimientosData, isLoading: isLoadingMovimientos } = useQuery({
    queryKey: ['mis-movimientos', clienteId, fechaDesde, fechaHasta],
    queryFn: () =>
      clienteService.getMovimientosCuenta(clienteId!, { ...rangoFechas, limit: 200 }),
    enabled: !!clienteId,
  });

  const { data: misRemitos = [], isLoading: isLoadingRemitos } = useQuery<MiRemitoListItem[]>({
    queryKey: ['mis-remitos', clienteId, fechaDesde, fechaHasta],
    queryFn: () => remitoService.getMisRemitos({ ...rangoFechas, limit: 200 }),
    enabled: !!clienteId,
  });

  const { data: productosEntregados, isLoading: isLoadingProductos } = useQuery<MisProductosEntregadosResponse>({
    queryKey: ['mis-productos-entregados', clienteId, fechaDesde, fechaHasta],
    queryFn: () => remitoService.getMisProductosEntregados(rangoFechas),
    enabled: !!clienteId,
  });

  const { data: remitoDetalle, isLoading: isLoadingRemitoDetalle } = useQuery<MiRemitoDetalle>({
    queryKey: ['mi-remito-detalle', remitoDetalleId],
    queryFn: () => remitoService.getMiRemito(remitoDetalleId!),
    enabled: !!remitoDetalleId,
  });

  const movimientos = movimientosData?.items || [];
  const deudaPendiente = movimientos.filter((m) => ['cargo', 'factura', 'nota_debito'].includes(m.tipo));


  if (!clienteId) {
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi Cuenta Corriente</h1>
        <p className="text-gray-500">Consulta tu saldo, remitos y productos entregados</p>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-40 h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-40 h-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFechaDesde(primerDiaMesActualISO());
                setFechaHasta(hoyISO());
              }}
              title="Volver al mes actual"
            >
              Mes actual
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFechaDesde('');
                setFechaHasta('');
              }}
              title="Ver todo el histórico"
            >
              Ver todo
            </Button>
          </div>
        </CardContent>
      </Card>

      {vePrecios && <div className="grid gap-3 sm:grid-cols-3">
        {/* Deuda vencida (meses anteriores impagos) */}
        <Card className={(estadoCuenta?.deuda_vencida || 0) > 0 ? 'border-red-300 bg-red-50/40' : ''}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-full ${
                  (estadoCuenta?.deuda_vencida || 0) > 0 ? 'bg-red-100' : 'bg-gray-100'
                }`}
              >
                <CalendarClock
                  className={`h-6 w-6 ${
                    (estadoCuenta?.deuda_vencida || 0) > 0 ? 'text-red-600' : 'text-gray-500'
                  }`}
                />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deuda vencida</p>
                <p
                  className={`text-2xl font-bold ${
                    (estadoCuenta?.deuda_vencida || 0) > 0 ? 'text-red-600' : 'text-gray-700'
                  }`}
                >
                  {formatCurrency(estadoCuenta?.deuda_vencida || 0)}
                </p>
                <p className="text-xs text-gray-500">Meses anteriores sin pagar</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Consumo del mes en curso */}
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-blue-100">
                <CalendarRange className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Consumo del mes</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(
                    estadoCuenta?.consumo_mes_bruto ?? estadoCuenta?.consumo_mes_actual ?? 0,
                  )}
                </p>
                <p className="text-xs text-gray-500">Total de cargos del 1° a hoy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total adeudado */}
        <Card
          className={
            (estadoCuenta?.total_adeudado || 0) > 0 ? 'border-orange-300' : 'border-green-300'
          }
        >
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-full ${
                  (estadoCuenta?.total_adeudado || 0) > 0 ? 'bg-orange-100' : 'bg-green-100'
                }`}
              >
                <Wallet
                  className={`h-6 w-6 ${
                    (estadoCuenta?.total_adeudado || 0) > 0 ? 'text-orange-600' : 'text-green-600'
                  }`}
                />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total adeudado</p>
                <p
                  className={`text-2xl font-bold ${
                    (estadoCuenta?.total_adeudado || 0) > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {formatCurrency(estadoCuenta?.total_adeudado || 0)}
                </p>
                <p className="text-xs text-gray-500">Vencida + consumo del mes − pagos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>}

      {vePrecios && estadoCuenta?.factura_mas_antigua_dias && estadoCuenta.factura_mas_antigua_dias > 30 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800">
                Tenés deuda con más de {estadoCuenta.factura_mas_antigua_dias} días. Regularizá lo antes posible.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="remitos" className="space-y-4">
        <TabsList className={`grid w-full ${vePrecios ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="remitos">Remitos</TabsTrigger>
          <TabsTrigger value="productos">Productos entregados</TabsTrigger>
          {vePrecios && <TabsTrigger value="deuda">Deuda pendiente</TabsTrigger>}
        </TabsList>

        <TabsContent value="remitos">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                Remitos del período
              </CardTitle>
              <CardDescription>
                Click en el ojo para ver los productos de cada remito.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingRemitos ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : misRemitos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay remitos en el período seleccionado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº Remito</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Lote</TableHead>
                        <TableHead>Estado</TableHead>
                        {vePrecios && <TableHead className="text-right">Total</TableHead>}
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {misRemitos.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono">{r.numero}</TableCell>
                          <TableCell>{r.fecha_emision ? formatDate(r.fecha_emision) : '-'}</TableCell>
                          <TableCell className="font-mono text-xs text-gray-600">{r.lote_numero || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">{r.estado}</Badge>
                          </TableCell>
                          {vePrecios && (
                            <TableCell className="text-right font-mono font-semibold">
                              {formatCurrency(r.total)}
                            </TableCell>
                          )}
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setRemitoDetalleId(r.id)}
                              title="Ver productos"
                            >
                              <Eye className="h-4 w-4 text-gray-500" />
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
        </TabsContent>

        <TabsContent value="productos">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                Productos entregados
              </CardTitle>
              <CardDescription>
                Total de productos lavados y entregados en el período. Se agrupa por producto sumando todos los remitos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingProductos ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : !productosEntregados || productosEntregados.items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay productos entregados en el período</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        {vePrecios && <TableHead className="text-right">Subtotal</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productosEntregados.items.map((p, idx) => (
                        <TableRow key={p.producto_id || `sin-${idx}`}>
                          <TableCell className="font-mono text-xs">{p.producto_codigo || '-'}</TableCell>
                          <TableCell>{p.producto_nombre || '-'}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{p.cantidad}</TableCell>
                          {vePrecios && (
                            <TableCell className="text-right font-mono">{formatCurrency(p.subtotal)}</TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                    <tfoot className="bg-gray-50">
                      <TableRow>
                        <TableCell colSpan={2} className="font-semibold">Total</TableCell>
                        <TableCell className="text-right font-mono font-bold">{productosEntregados.total_cantidad}</TableCell>
                        {vePrecios && (
                          <TableCell className="text-right font-mono font-bold">{formatCurrency(productosEntregados.total_subtotal)}</TableCell>
                        )}
                      </TableRow>
                    </tfoot>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {vePrecios && <TabsContent value="deuda">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4" />
                Deuda pendiente
              </CardTitle>
              <CardDescription>
                Cargos y facturas del período que suman a tu saldo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingMovimientos ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : deudaPendiente.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay cargos en el período</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Comprobante</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deudaPendiente.map((mov) => {
                        const tipoInfo = TIPOS_MOVIMIENTO[mov.tipo] || { label: mov.tipo, color: 'secondary' };
                        return (
                          <TableRow key={mov.id}>
                            <TableCell>{formatDate(mov.fecha_movimiento)}</TableCell>
                            <TableCell>
                              <Badge variant={tipoInfo.color as any}>{tipoInfo.label}</Badge>
                            </TableCell>
                            <TableCell>{mov.concepto}</TableCell>
                            <TableCell className="text-xs text-gray-600 font-mono">
                              {mov.factura_numero || mov.recibo_numero || mov.remito?.numero || '-'}
                            </TableCell>
                            <TableCell className="text-right text-red-600 font-mono font-semibold">
                              {formatCurrency(mov.monto)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setMovimientoDetalle(mov)}
                                title="Ver detalle"
                              >
                                <Eye className="h-4 w-4 text-gray-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>}
      </Tabs>

      {movimientoDetalle && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-4"
          onClick={() => setMovimientoDetalle(null)}
        >
          <Card className="w-full max-w-2xl m-4" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detalle del movimiento
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setMovimientoDetalle(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Fecha</p>
                  <p className="font-mono">{formatDate(movimientoDetalle.fecha_movimiento)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Tipo</p>
                  <Badge variant={(TIPOS_MOVIMIENTO[movimientoDetalle.tipo]?.color || 'secondary') as any}>
                    {TIPOS_MOVIMIENTO[movimientoDetalle.tipo]?.label || movimientoDetalle.tipo}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 text-xs">Concepto</p>
                  <p className="font-medium">{movimientoDetalle.concepto || '-'}</p>
                </div>
                {vePrecios && (
                  <>
                    <div>
                      <p className="text-gray-500 text-xs">Monto</p>
                      <p className="font-mono font-semibold">{formatCurrency(movimientoDetalle.monto)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Saldo posterior</p>
                      <p className="font-mono font-bold">{formatCurrency(movimientoDetalle.saldo_posterior)}</p>
                    </div>
                  </>
                )}
                {(movimientoDetalle.factura_numero || movimientoDetalle.recibo_numero || movimientoDetalle.remito?.numero) && (
                  <div className="col-span-2">
                    <p className="text-gray-500 text-xs">Comprobante</p>
                    <p className="font-mono">
                      {movimientoDetalle.factura_numero ||
                        movimientoDetalle.recibo_numero ||
                        movimientoDetalle.remito?.numero}
                    </p>
                  </div>
                )}
              </div>

              {movimientoDetalle.remito && (
                <div className="pt-3 border-t space-y-2">
                  <p className="text-gray-700 text-sm font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Productos del remito {movimientoDetalle.remito.numero}
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 text-xs">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium">Código</th>
                          <th className="px-2 py-1.5 text-left font-medium">Producto</th>
                          <th className="px-2 py-1.5 text-right font-medium">Cant.</th>
                          {vePrecios && <th className="px-2 py-1.5 text-right font-medium">Subtotal</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {movimientoDetalle.remito.detalles?.length ? (
                          movimientoDetalle.remito.detalles.map((d) => (
                            <tr key={d.id} className="border-t">
                              <td className="px-2 py-1.5 font-mono text-xs">{d.producto_codigo || '-'}</td>
                              <td className="px-2 py-1.5">{d.producto_nombre || '-'}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{d.cantidad}</td>
                              {vePrecios && (
                                <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatCurrency(d.subtotal)}</td>
                              )}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={vePrecios ? 4 : 3} className="px-2 py-3 text-center text-gray-400 text-xs">
                              El remito no tiene productos cargados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {vePrecios && (
                        <tfoot className="bg-gray-50 text-xs">
                          <tr className="border-t">
                            <td colSpan={3} className="px-2 py-1.5 text-right text-gray-600">Subtotal</td>
                            <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(movimientoDetalle.remito.subtotal)}</td>
                          </tr>
                          {movimientoDetalle.remito.descuento > 0 && (
                            <tr>
                              <td colSpan={3} className="px-2 py-1.5 text-right text-gray-600">Descuento</td>
                              <td className="px-2 py-1.5 text-right font-mono text-red-600">- {formatCurrency(movimientoDetalle.remito.descuento)}</td>
                            </tr>
                          )}
                          <tr className="border-t">
                            <td colSpan={3} className="px-2 py-1.5 text-right font-semibold">Total</td>
                            <td className="px-2 py-1.5 text-right font-mono font-bold">{formatCurrency(movimientoDetalle.remito.total)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                  {movimientoDetalle.remito.peso_total_kg != null && movimientoDetalle.remito.peso_total_kg > 0 && (
                    <p className="text-xs text-gray-500">
                      Peso total: <span className="font-mono">{movimientoDetalle.remito.peso_total_kg} kg</span>
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-3 border-t">
                <Button onClick={() => setMovimientoDetalle(null)}>Cerrar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {remitoDetalleId && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-4"
          onClick={() => setRemitoDetalleId(null)}
        >
          <Card className="w-full max-w-2xl m-4" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {remitoDetalle ? `Remito ${remitoDetalle.numero}` : 'Detalle de remito'}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setRemitoDetalleId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingRemitoDetalle || !remitoDetalle ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Fecha emisión</p>
                      <p className="font-mono">
                        {remitoDetalle.fecha_emision ? formatDate(remitoDetalle.fecha_emision) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Estado</p>
                      <Badge variant="secondary" className="capitalize">
                        {remitoDetalle.estado}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Lote</p>
                      <p className="font-mono text-xs">{remitoDetalle.lote_numero || '-'}</p>
                    </div>
                    {vePrecios && (
                      <div>
                        <p className="text-gray-500 text-xs">Total</p>
                        <p className="font-mono font-bold">{formatCurrency(remitoDetalle.total)}</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 space-y-2">
                    <p className="text-gray-700 text-sm font-semibold">Productos</p>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600 text-xs">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-medium">Código</th>
                            <th className="px-2 py-1.5 text-left font-medium">Producto</th>
                            <th className="px-2 py-1.5 text-right font-medium">Cant.</th>
                            {vePrecios && <th className="px-2 py-1.5 text-right font-medium">Subtotal</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {remitoDetalle.detalles?.length ? (
                            remitoDetalle.detalles.map((d) => (
                              <tr key={d.id} className="border-t">
                                <td className="px-2 py-1.5 font-mono text-xs">{d.producto_codigo || '-'}</td>
                                <td className="px-2 py-1.5">{d.producto_nombre || '-'}</td>
                                <td className="px-2 py-1.5 text-right font-mono">{d.cantidad}</td>
                                {vePrecios && (
                                  <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatCurrency(d.subtotal)}</td>
                                )}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={vePrecios ? 4 : 3} className="px-2 py-3 text-center text-gray-400 text-xs">
                                El remito no tiene productos cargados.
                              </td>
                            </tr>
                          )}
                        </tbody>
                        {vePrecios && (
                          <tfoot className="bg-gray-50 text-xs">
                            <tr className="border-t">
                              <td colSpan={3} className="px-2 py-1.5 text-right text-gray-600">Subtotal</td>
                              <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(remitoDetalle.subtotal)}</td>
                            </tr>
                            {remitoDetalle.descuento > 0 && (
                              <tr>
                                <td colSpan={3} className="px-2 py-1.5 text-right text-gray-600">Descuento</td>
                                <td className="px-2 py-1.5 text-right font-mono text-red-600">- {formatCurrency(remitoDetalle.descuento)}</td>
                              </tr>
                            )}
                            <tr className="border-t">
                              <td colSpan={3} className="px-2 py-1.5 text-right font-semibold">Total</td>
                              <td className="px-2 py-1.5 text-right font-mono font-bold">{formatCurrency(remitoDetalle.total)}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                    {remitoDetalle.peso_total_kg != null && remitoDetalle.peso_total_kg > 0 && (
                      <p className="text-xs text-gray-500">
                        Peso total: <span className="font-mono">{remitoDetalle.peso_total_kg} kg</span>
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="flex justify-end pt-3 border-t">
                <Button onClick={() => setRemitoDetalleId(null)}>Cerrar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
