/**
 * Centro de Reportes - Vista con estadísticas y gráficos en tiempo real
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  Factory,
  Users,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  Clock,
  Loader2,
  PauseCircle,
  Search,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';

import { reporteService, getProduccionPorUsuarioPosta, getClientesProduccion, getTiempoMuertoProduccion, type Agrupacion } from '@/services/reporteService';
import { clienteService } from '@/services/clienteService';
import { getLocalDateString } from '@/utils/formatters';
import { AnaliticasProduccionSection } from '@/pages/reportes/AnaliticasProduccionSection';
import { Combobox } from '@/components/ui/combobox';

const COLORS = ['#00BCD4', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-AR').format(value);
}

// Default: el día actual — el usuario abre y ve la producción del día
function getDefaultDates() {
  const hoy = getLocalDateString(new Date());
  return { desde: hoy, hasta: hoy };
}

export default function ReportesPage() {
  const defaultDates = getDefaultDates();
  const [fechaDesde, setFechaDesde] = useState(defaultDates.desde);
  const [fechaHasta, setFechaHasta] = useState(defaultDates.hasta);
  const [agrupacion, setAgrupacion] = useState<Agrupacion>('dia');
  const [activeTab, setActiveTab] = useState('resumen');
  const [clienteFiltroId, setClienteFiltroId] = useState<string | null>(null);

  // Query de estadísticas rápidas
  const { data: estadisticas, isLoading: loadingEstadisticas } = useQuery({
    queryKey: ['estadisticas-rapidas'],
    queryFn: reporteService.getEstadisticasRapidas,
  });

  // Query de resumen general
  const { data: resumen, isLoading: loadingResumen } = useQuery({
    queryKey: ['resumen-general', fechaDesde, fechaHasta],
    queryFn: () =>
      reporteService.getResumenGeneral({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      }),
    enabled: !!fechaDesde && !!fechaHasta,
  });

  // Query de ventas por período
  const { data: ventasPeriodo, isLoading: loadingVentas } = useQuery({
    queryKey: ['ventas-periodo', fechaDesde, fechaHasta, agrupacion],
    queryFn: () =>
      reporteService.getVentasPorPeriodo({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        agrupacion,
      }),
    enabled: !!fechaDesde && !!fechaHasta,
  });

  // Query de ventas por cliente
  const { data: ventasClientes } = useQuery({
    queryKey: ['ventas-clientes', fechaDesde, fechaHasta],
    queryFn: () =>
      reporteService.getVentasPorCliente({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        limit: 10,
      }),
    enabled: !!fechaDesde && !!fechaHasta,
  });

  // Query de ventas por servicio
  const { data: ventasServicios } = useQuery({
    queryKey: ['ventas-servicios', fechaDesde, fechaHasta],
    queryFn: () =>
      reporteService.getVentasPorServicio({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      }),
    enabled: !!fechaDesde && !!fechaHasta,
  });

  // Query de producción por período
  const { data: produccionPeriodo } = useQuery({
    queryKey: ['produccion-periodo', fechaDesde, fechaHasta, agrupacion],
    queryFn: () =>
      reporteService.getProduccionPorPeriodo({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        agrupacion,
      }),
    enabled: !!fechaDesde && !!fechaHasta,
  });

  // Query de producción por etapa
  const { data: produccionEtapas } = useQuery({
    queryKey: ['produccion-etapas', fechaDesde, fechaHasta],
    queryFn: () =>
      reporteService.getProduccionPorEtapa({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      }),
    enabled: !!fechaDesde && !!fechaHasta,
  });

  // Producción por usuario/posta
  const { data: produccionUsuarioPosta, isLoading: loadingUsuarioPosta } = useQuery({
    queryKey: ['produccion-usuario-posta', fechaDesde, fechaHasta],
    queryFn: () => getProduccionPorUsuarioPosta({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta }),
    enabled: !!fechaDesde && !!fechaHasta && activeTab === 'produccion',
  });

  // Clientes por producción
  const { data: clientesProduccion, isLoading: loadingClientesProduccion } = useQuery({
    queryKey: ['clientes-produccion', fechaDesde, fechaHasta, clienteFiltroId],
    queryFn: () => getClientesProduccion({
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      cliente_id: clienteFiltroId || undefined,
    }),
    enabled: !!fechaDesde && !!fechaHasta && activeTab === 'produccion',
  });

  // Lista de clientes para el combobox
  const { data: clientesLista = [] } = useQuery({
    queryKey: ['clientes-lista'],
    queryFn: clienteService.getClientesLista,
    enabled: activeTab === 'produccion',
  });

  // Tiempo muerto
  const { data: tiempoMuerto, isLoading: loadingTiempoMuerto } = useQuery({
    queryKey: ['tiempo-muerto', fechaDesde, fechaHasta],
    queryFn: () => getTiempoMuertoProduccion({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta }),
    enabled: !!fechaDesde && !!fechaHasta && activeTab === 'produccion',
  });

  // Query de flujo de caja
  const { data: flujoCaja } = useQuery({
    queryKey: ['flujo-caja', fechaDesde, fechaHasta, agrupacion],
    queryFn: () =>
      reporteService.getFlujoCaja({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        agrupacion,
      }),
    enabled: !!fechaDesde && !!fechaHasta,
  });

  // Query de movimientos por categoría
  const { data: movimientosCategorias } = useQuery({
    queryKey: ['movimientos-categorias', fechaDesde, fechaHasta],
    queryFn: () =>
      reporteService.getMovimientosPorCategoria({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      }),
    enabled: !!fechaDesde && !!fechaHasta,
  });

  // Query de stock actual
  const { data: stockActual } = useQuery({
    queryKey: ['stock-actual'],
    queryFn: reporteService.getStockActual,
  });

  // Query de stock bajo mínimo
  const { data: stockBajo } = useQuery({
    queryKey: ['stock-bajo-minimo'],
    queryFn: reporteService.getStockBajoMinimo,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Centro de Reportes</h1>
          <p className="text-gray-500">Estadísticas y análisis en tiempo real</p>
        </div>
      </div>

      {/* KPIs Rápidos */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {loadingEstadisticas ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))
        ) : estadisticas ? (
          <>
            <Card>
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground leading-tight">Ventas Hoy</p>
                    <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(estadisticas.hoy.total)}</p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground">
                      {estadisticas.hoy.pedidos} pedidos
                    </p>
                  </div>
                  <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground leading-tight">Ventas del Mes</p>
                    <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(estadisticas.mes.total)}</p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground">
                      {estadisticas.mes.pedidos} pedidos
                    </p>
                  </div>
                  <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-4 w-4 sm:h-6 sm:w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground leading-tight">En Producción</p>
                    <p className="text-lg sm:text-2xl font-bold">
                      {estadisticas.produccion.lotes_en_proceso}
                    </p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground">lotes activos</p>
                  </div>
                  <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Factory className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground leading-tight">Stock Crítico</p>
                    <p className="text-lg sm:text-2xl font-bold">{estadisticas.stock.critico}</p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground">insumos bajo mínimo</p>
                  </div>
                  <div
                    className={`h-9 w-9 sm:h-12 sm:w-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      estadisticas.stock.critico > 0 ? 'bg-red-100' : 'bg-green-100'
                    }`}
                  >
                    <AlertTriangle
                      className={`h-4 w-4 sm:h-6 sm:w-6 ${
                        estadisticas.stock.critico > 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Filtros de Fecha */}
      <Card>
        <CardContent className="py-4 space-y-3">
          {/* Botón Hoy destacado + atajos rápidos */}
          {(() => {
            const hoyStr = getLocalDateString(new Date());
            const esHoy = fechaDesde === hoyStr && fechaHasta === hoyStr;
            return (
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  variant={esHoy ? 'default' : 'outline'}
                  size="sm"
                  className="font-semibold"
                  onClick={() => {
                    setFechaDesde(hoyStr);
                    setFechaHasta(hoyStr);
                  }}
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Hoy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const hoy = new Date();
                    const inicioSemana = new Date(hoy);
                    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
                    setFechaDesde(getLocalDateString(inicioSemana));
                    setFechaHasta(getLocalDateString(hoy));
                  }}
                >
                  Esta semana
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const hoy = new Date();
                    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                    setFechaDesde(getLocalDateString(inicioMes));
                    setFechaHasta(getLocalDateString(hoy));
                  }}
                >
                  Este mes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const hoy = new Date();
                    const hace30 = new Date(hoy);
                    hace30.setDate(hoy.getDate() - 30);
                    setFechaDesde(getLocalDateString(hace30));
                    setFechaHasta(getLocalDateString(hoy));
                  }}
                >
                  Últimos 30
                </Button>
              </div>
            );
          })()}

          {/* Período personalizado + agrupación */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 sm:items-end">
            <div className="space-y-1.5 w-full sm:w-auto">
              <Label className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Período personalizado
              </Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="flex-1 sm:w-40 sm:flex-none"
                />
                <span className="text-muted-foreground text-sm">a</span>
                <Input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="flex-1 sm:w-40 sm:flex-none"
                />
              </div>
            </div>

            <div className="space-y-1.5 w-full sm:w-auto">
              <Label className="text-xs sm:text-sm text-muted-foreground">Agrupar por</Label>
              <Select value={agrupacion} onValueChange={(v) => setAgrupacion(v as Agrupacion)}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dia">Día</SelectItem>
                  <SelectItem value="semana">Semana</SelectItem>
                  <SelectItem value="mes">Mes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de Reportes */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="resumen" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-2 text-[11px] sm:text-sm">
            <BarChart3 className="h-4 w-4" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="ventas" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-2 text-[11px] sm:text-sm">
            <DollarSign className="h-4 w-4" />
            Ventas
          </TabsTrigger>
          <TabsTrigger value="produccion" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-2 text-[11px] sm:text-sm">
            <Factory className="h-4 w-4" />
            Producción
          </TabsTrigger>
          <TabsTrigger value="finanzas" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-2 text-[11px] sm:text-sm">
            <TrendingUp className="h-4 w-4" />
            Finanzas
          </TabsTrigger>
          <TabsTrigger value="stock" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 py-2 text-[11px] sm:text-sm">
            <Package className="h-4 w-4" />
            Stock
          </TabsTrigger>
        </TabsList>

        {/* Tab: Resumen */}
        <TabsContent value="resumen" className="space-y-6">
          {loadingResumen ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : resumen ? (
            <>
              {/* Cards de Resumen */}
              <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Total Ventas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                    <div className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(resumen.ventas.total)}</div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground">
                      {resumen.ventas.cantidad_pedidos} pedidos en el período
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Producción
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                    <div className="text-lg sm:text-2xl font-bold">
                      {formatNumber(resumen.produccion.kg_procesados)} kg
                    </div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground">
                      {resumen.produccion.lotes_completados} de {resumen.produccion.cantidad_lotes}{' '}
                      lotes
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Balance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                    <div
                      className={`text-lg sm:text-2xl font-bold truncate ${
                        resumen.finanzas.balance >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(resumen.finanzas.balance)}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] sm:text-xs">
                      <span className="text-green-600">
                        +{formatCurrency(resumen.finanzas.ingresos)}
                      </span>
                      <span className="text-red-600">
                        -{formatCurrency(resumen.finanzas.egresos)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                      Clientes Nuevos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                    <div className="text-lg sm:text-2xl font-bold">{resumen.clientes_nuevos}</div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground">
                      {resumen.stock_critico > 0 ? (
                        <span className="text-red-600">
                          {resumen.stock_critico} alertas de stock
                        </span>
                      ) : (
                        'Sin alertas de stock'
                      )}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Gráfico de Tendencia */}
              {ventasPeriodo && ventasPeriodo.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Tendencia de Ventas</CardTitle>
                    <CardDescription>Evolución de ventas en el período seleccionado</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={ventasPeriodo}>
                          <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00BCD4" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#00BCD4" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="periodo_label" fontSize={12} />
                          <YAxis
                            fontSize={12}
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                          />
                          <Tooltip
                            formatter={(value: number) => [formatCurrency(value), 'Total']}
                            labelFormatter={(label) => `Fecha: ${label}`}
                          />
                          <Area
                            type="monotone"
                            dataKey="total"
                            stroke="#00BCD4"
                            fillOpacity={1}
                            fill="url(#colorTotal)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Selecciona un período para ver el resumen
            </div>
          )}
        </TabsContent>

        {/* Tab: Ventas */}
        <TabsContent value="ventas" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Ventas por Período */}
            <Card>
              <CardHeader>
                <CardTitle>Ventas por Período</CardTitle>
                <CardDescription>
                  Total de ventas agrupado por {agrupacion === 'dia' ? 'día' : agrupacion}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ventasPeriodo && ventasPeriodo.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ventasPeriodo}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="periodo_label" fontSize={12} />
                        <YAxis
                          fontSize={12}
                          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value), 'Total']}
                        />
                        <Bar dataKey="total" fill="#00BCD4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No hay datos de ventas para el período
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Clientes */}
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Clientes</CardTitle>
                <CardDescription>Clientes con mayor facturación</CardDescription>
              </CardHeader>
              <CardContent>
                {ventasClientes && ventasClientes.length > 0 ? (
                  <div className="space-y-3">
                    {ventasClientes.map((cliente, index) => (
                      <div key={cliente.cliente_id} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{cliente.cliente_nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {cliente.cantidad_pedidos} pedidos
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(cliente.total)}</p>
                          <p className="text-xs text-muted-foreground">
                            Prom: {formatCurrency(cliente.promedio_pedido)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No hay datos de clientes
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ventas por Servicio */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Ventas por Servicio</CardTitle>
                <CardDescription>Distribución de ingresos por tipo de servicio</CardDescription>
              </CardHeader>
              <CardContent>
                {ventasServicios && ventasServicios.length > 0 ? (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={ventasServicios}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="total"
                            nameKey="servicio_nombre"
                          >
                            {ventasServicios.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {ventasServicios.map((servicio, index) => (
                        <div
                          key={servicio.servicio_id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="font-medium">{servicio.servicio_nombre}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(servicio.total)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatNumber(servicio.unidades_vendidas)} unidades
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No hay datos de servicios
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Producción */}
        <TabsContent value="produccion" className="space-y-6">
          {/* Analíticas en tiempo real + rendimiento por producto */}
          <AnaliticasProduccionSection
            fechaDesde={fechaDesde}
            fechaHasta={fechaHasta}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Producción por Período */}
            <Card>
              <CardHeader>
                <CardTitle>Lotes por Período</CardTitle>
                <CardDescription>Cantidad de lotes procesados</CardDescription>
              </CardHeader>
              <CardContent>
                {produccionPeriodo && produccionPeriodo.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={produccionPeriodo}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="periodo" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Bar
                          dataKey="lotes_completados"
                          fill="#22C55E"
                          name="Completados"
                          stackId="a"
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="lotes_en_proceso"
                          fill="#F59E0B"
                          name="En proceso"
                          stackId="a"
                          radius={[4, 4, 0, 0]}
                        />
                        <Legend />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No hay datos de producción
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Kilos Procesados */}
            <Card>
              <CardHeader>
                <CardTitle>Kilos Procesados</CardTitle>
                <CardDescription>Peso total procesado por período</CardDescription>
              </CardHeader>
              <CardContent>
                {produccionPeriodo && produccionPeriodo.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={produccionPeriodo}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="periodo" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip formatter={(value: number) => [`${formatNumber(value)} kg`, 'Kg']} />
                        <Line
                          type="monotone"
                          dataKey="kg_total"
                          stroke="#3B82F6"
                          strokeWidth={2}
                          dot={{ fill: '#3B82F6' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No hay datos de producción
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tiempo por Etapa */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Tiempo Promedio por Etapa</CardTitle>
                <CardDescription>Horas promedio de procesamiento en cada etapa</CardDescription>
              </CardHeader>
              <CardContent>
                {produccionEtapas && produccionEtapas.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={produccionEtapas} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" fontSize={12} unit="h" />
                        <YAxis type="category" dataKey="etapa_nombre" fontSize={12} width={120} />
                        <Tooltip
                          formatter={(value: number) => [`${value.toFixed(1)} horas`, 'Promedio']}
                        />
                        <Bar dataKey="promedio_horas" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No hay datos de etapas de producción
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tiempo Muerto */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PauseCircle className="h-5 w-5 text-amber-500" />
                Tiempo Muerto
              </CardTitle>
              <CardDescription>
                Tiempo que los lotes estuvieron sin ser procesados en ninguna posta
                (desde el inicio de la primera hasta el fin de la última etapa, descontando el tiempo activo)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTiempoMuerto ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculando...
                </div>
              ) : tiempoMuerto && tiempoMuerto.lotes_analizados > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <div className="text-center p-2 sm:p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="text-lg sm:text-2xl font-bold text-amber-700">
                        {Math.round(tiempoMuerto.promedio_tiempo_muerto_minutos)} min
                      </div>
                      <div className="text-[10px] sm:text-xs text-amber-600 mt-1">Promedio por lote</div>
                    </div>
                    <div className="text-center p-2 sm:p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="text-lg sm:text-2xl font-bold text-blue-700">
                        {tiempoMuerto.lotes_analizados}
                      </div>
                      <div className="text-[10px] sm:text-xs text-blue-600 mt-1">Lotes analizados</div>
                    </div>
                    <div className="text-center p-2 sm:p-3 rounded-lg bg-red-50 border border-red-200">
                      <div className="text-lg sm:text-2xl font-bold text-red-700">
                        {Math.round(tiempoMuerto.total_tiempo_muerto_minutos / 60)} h
                      </div>
                      <div className="text-[10px] sm:text-xs text-red-600 mt-1">Total acumulado</div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium text-muted-foreground">Lote</th>
                          <th className="pb-2 font-medium text-muted-foreground">Cliente</th>
                          <th className="pb-2 font-medium text-muted-foreground text-right">Tiempo total</th>
                          <th className="pb-2 font-medium text-muted-foreground text-right">Tiempo activo</th>
                          <th className="pb-2 font-medium text-muted-foreground text-right">Tiempo muerto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tiempoMuerto.detalle.slice(0, 10).map((row) => (
                          <tr key={row.lote_id} className="border-b last:border-0">
                            <td className="py-2 font-mono text-xs">{row.numero}</td>
                            <td className="py-2 text-muted-foreground">{row.cliente_nombre ?? '-'}</td>
                            <td className="py-2 text-right">{Math.round(row.tiempo_total_minutos)} min</td>
                            <td className="py-2 text-right text-green-700">{Math.round(row.tiempo_activo_minutos)} min</td>
                            <td className="py-2 text-right font-semibold text-amber-700">
                              {Math.round(row.tiempo_muerto_minutos)} min
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {tiempoMuerto.detalle.length > 10 && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Mostrando los 10 lotes con mayor tiempo muerto de {tiempoMuerto.detalle.length} totales
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 text-muted-foreground">
                  No hay lotes con etapas completadas en el período
                </div>
              )}
            </CardContent>
          </Card>

          {/* Producción por Operario y Posta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Producción por Operario y Posta
              </CardTitle>
              <CardDescription>
                Kg procesados y lotes completados por cada operario en cada etapa
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUsuarioPosta ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando...
                </div>
              ) : produccionUsuarioPosta && produccionUsuarioPosta.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium text-muted-foreground">Operario</th>
                        <th className="pb-2 font-medium text-muted-foreground">Posta</th>
                        <th className="pb-2 font-medium text-muted-foreground text-right">Lotes</th>
                        <th className="pb-2 font-medium text-muted-foreground text-right">Kg procesados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produccionUsuarioPosta.map((row, i) => (
                        <tr key={`${row.usuario_id}-${row.etapa_id}`} className="border-b last:border-0">
                          <td className="py-2 font-medium">{row.usuario_nombre}</td>
                          <td className="py-2">
                            <Badge variant="outline" className="text-xs">{row.etapa_nombre}</Badge>
                          </td>
                          <td className="py-2 text-right">{row.lotes_distintos}</td>
                          <td className="py-2 text-right font-semibold text-primary">
                            {formatNumber(row.kg_procesados)} kg
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 text-muted-foreground">
                  No hay datos de producción por operario en el período
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mejores Clientes por Producción */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-primary" />
                    Clientes por Kg Lavados
                  </CardTitle>
                  <CardDescription>
                    Filtrá por cliente para ver el desglose de lotes
                  </CardDescription>
                </div>
                <div className="w-full sm:w-64">
                  <Combobox
                    options={clientesLista.map((c) => ({ value: c.id, label: c.nombre }))}
                    value={clienteFiltroId}
                    onChange={setClienteFiltroId}
                    placeholder="Todos los clientes"
                    searchPlaceholder="Buscar cliente..."
                    emptyText="No encontrado"
                    allowClear
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingClientesProduccion ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando...
                </div>
              ) : clienteFiltroId && clientesProduccion?.detalle_lotes && clientesProduccion.detalle_lotes.length > 0 ? (
                <div className="space-y-3">
                  {clientesProduccion.clientes[0] && (
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div>
                        <div className="font-semibold">{clientesProduccion.clientes[0].cliente_nombre}</div>
                        <div className="text-sm text-muted-foreground">
                          {clientesProduccion.clientes[0].cantidad_lotes} lotes ·{' '}
                          <span className="font-medium text-primary">
                            {formatNumber(clientesProduccion.clientes[0].kg_total)} kg totales
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium text-muted-foreground">Lote</th>
                          <th className="pb-2 font-medium text-muted-foreground">Estado</th>
                          <th className="pb-2 font-medium text-muted-foreground">Ingreso</th>
                          <th className="pb-2 font-medium text-muted-foreground text-right">Kg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientesProduccion.detalle_lotes.map((lote) => (
                          <tr key={lote.lote_id} className="border-b last:border-0">
                            <td className="py-2 font-mono text-xs">{lote.numero}</td>
                            <td className="py-2">
                              <Badge variant="outline" className="text-xs capitalize">
                                {lote.estado.replace('_', ' ')}
                              </Badge>
                            </td>
                            <td className="py-2 text-muted-foreground text-xs">
                              {lote.fecha_ingreso
                                ? new Date(lote.fecha_ingreso).toLocaleDateString('es-AR')
                                : '-'}
                            </td>
                            <td className="py-2 text-right font-semibold">
                              {lote.peso_kg > 0 ? `${formatNumber(lote.peso_kg)} kg` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : !clienteFiltroId && clientesProduccion?.clientes && clientesProduccion.clientes.length > 0 ? (
                (() => {
                  const totalKg = clientesProduccion.clientes.reduce((s, c) => s + c.kg_total, 0);
                  const totalLotes = clientesProduccion.clientes.reduce((s, c) => s + c.cantidad_lotes, 0);
                  const promedioPorCliente = clientesProduccion.clientes.length > 0
                    ? totalKg / clientesProduccion.clientes.length
                    : 0;
                  const diasRango = (() => {
                    const d1 = new Date(fechaDesde).getTime();
                    const d2 = new Date(fechaHasta).getTime();
                    return Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
                  })();
                  const promedioPorDia = totalKg / diasRango;
                  const topN = clientesProduccion.clientes.slice(0, 10);
                  const chartData = [...topN]
                    .map((c) => ({
                      nombre:
                        c.cliente_nombre.length > 22
                          ? c.cliente_nombre.slice(0, 22) + '…'
                          : c.cliente_nombre,
                      kg: Math.round(c.kg_total * 10) / 10,
                      lotes: c.cantidad_lotes,
                    }))
                    .reverse();

                  return (
                    <div className="space-y-4">
                      {/* Acumuladores */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                        <div className="bg-cyan-50 border border-cyan-100 rounded-lg p-2 sm:p-3">
                          <p className="text-[10px] text-cyan-700 uppercase tracking-wide">
                            Total kg
                          </p>
                          <p className="text-base sm:text-xl font-bold text-cyan-700 truncate">
                            {formatNumber(totalKg)} kg
                          </p>
                          <p className="text-[10px] sm:text-[11px] text-cyan-600 mt-0.5">
                            {totalLotes} lotes · {clientesProduccion.clientes.length} clientes
                          </p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 sm:p-3">
                          <p className="text-[10px] text-emerald-700 uppercase tracking-wide">
                            Prom. cliente
                          </p>
                          <p className="text-base sm:text-xl font-bold text-emerald-700 truncate">
                            {formatNumber(Math.round(promedioPorCliente))} kg
                          </p>
                          <p className="text-[10px] sm:text-[11px] text-emerald-600 mt-0.5">
                            sobre {clientesProduccion.clientes.length} clientes
                          </p>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 sm:p-3">
                          <p className="text-[10px] text-blue-700 uppercase tracking-wide">
                            Prom. día
                          </p>
                          <p className="text-base sm:text-xl font-bold text-blue-700 truncate">
                            {formatNumber(Math.round(promedioPorDia))} kg
                          </p>
                          <p className="text-[10px] sm:text-[11px] text-blue-600 mt-0.5">
                            sobre {diasRango} día{diasRango === 1 ? '' : 's'}
                          </p>
                        </div>
                        <div className="bg-purple-50 border border-purple-100 rounded-lg p-2 sm:p-3">
                          <p className="text-[10px] text-purple-700 uppercase tracking-wide">
                            Top cliente
                          </p>
                          <p className="text-xs sm:text-sm font-bold text-purple-700 truncate">
                            {clientesProduccion.clientes[0].cliente_nombre}
                          </p>
                          <p className="text-[10px] sm:text-[11px] text-purple-600 mt-0.5">
                            {formatNumber(clientesProduccion.clientes[0].kg_total)} kg
                          </p>
                        </div>
                      </div>

                      {/* Gráfico + tabla */}
                      <div className="grid gap-4 lg:grid-cols-12">
                        {/* Gráfico de barras horizontales */}
                        <div className="lg:col-span-7">
                          <p className="text-xs font-semibold text-gray-700 uppercase mb-2">
                            Top {topN.length} clientes por kg lavados
                          </p>
                          <div className="h-[300px] sm:h-[360px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={chartData}
                                layout="vertical"
                                margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                  type="number"
                                  fontSize={10}
                                  tickFormatter={(v) => `${formatNumber(v)}`}
                                />
                                <YAxis
                                  type="category"
                                  dataKey="nombre"
                                  fontSize={10}
                                  width={100}
                                  tick={{ fill: '#374151' }}
                                />
                                <Tooltip
                                  formatter={(value: number, name) => {
                                    if (name === 'kg') return [`${formatNumber(value)} kg`, 'Kg lavados'];
                                    return [value, name];
                                  }}
                                />
                                <Bar dataKey="kg" fill="#00BCD4" radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Tabla lateral */}
                        <div className="lg:col-span-5 overflow-x-auto">
                          <p className="text-xs font-semibold text-gray-700 uppercase mb-2">
                            Detalle (clic para filtrar)
                          </p>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-left">
                                <th className="pb-2 font-medium text-muted-foreground">#</th>
                                <th className="pb-2 font-medium text-muted-foreground">Cliente</th>
                                <th className="pb-2 font-medium text-muted-foreground text-right">Lotes</th>
                                <th className="pb-2 font-medium text-muted-foreground text-right">Kg</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clientesProduccion.clientes.map((c, idx) => (
                                <tr
                                  key={c.cliente_id}
                                  className="border-b last:border-0 cursor-pointer hover:bg-muted/50"
                                  onClick={() => setClienteFiltroId(c.cliente_id)}
                                >
                                  <td className="py-2 text-muted-foreground">{idx + 1}</td>
                                  <td className="py-2 font-medium">{c.cliente_nombre}</td>
                                  <td className="py-2 text-right">{c.cantidad_lotes}</td>
                                  <td className="py-2 text-right font-semibold text-primary">
                                    {formatNumber(c.kg_total)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center justify-center h-24 text-muted-foreground">
                  No hay datos de clientes en el período
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Finanzas */}
        <TabsContent value="finanzas" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Flujo de Caja */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Flujo de Caja</CardTitle>
                <CardDescription>Ingresos vs Egresos por período</CardDescription>
              </CardHeader>
              <CardContent>
                {flujoCaja && flujoCaja.length > 0 ? (
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={flujoCaja}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="periodo" fontSize={12} />
                        <YAxis
                          fontSize={12}
                          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Bar dataKey="ingresos" fill="#22C55E" name="Ingresos" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="egresos" fill="#EF4444" name="Egresos" radius={[4, 4, 0, 0]} />
                        <Legend />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                    No hay datos de flujo de caja
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ingresos por Categoría */}
            <Card>
              <CardHeader>
                <CardTitle>Ingresos por Categoría</CardTitle>
              </CardHeader>
              <CardContent>
                {movimientosCategorias ? (
                  <div className="space-y-3">
                    {movimientosCategorias
                      .filter((m) => m.tipo === 'ingreso')
                      .map((mov, index) => (
                        <div key={`${mov.categoria}-${mov.tipo}`} className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <div className="flex-1">
                            <p className="font-medium capitalize">{mov.categoria || 'Sin categoría'}</p>
                            <p className="text-xs text-muted-foreground">
                              {mov.cantidad} movimientos
                            </p>
                          </div>
                          <p className="font-semibold text-green-600">
                            +{formatCurrency(mov.total)}
                          </p>
                        </div>
                      ))}
                    {movimientosCategorias.filter((m) => m.tipo === 'ingreso').length === 0 && (
                      <p className="text-muted-foreground text-center py-4">Sin ingresos registrados</p>
                    )}
                  </div>
                ) : (
                  <Skeleton className="h-[200px]" />
                )}
              </CardContent>
            </Card>

            {/* Egresos por Categoría */}
            <Card>
              <CardHeader>
                <CardTitle>Egresos por Categoría</CardTitle>
              </CardHeader>
              <CardContent>
                {movimientosCategorias ? (
                  <div className="space-y-3">
                    {movimientosCategorias
                      .filter((m) => m.tipo === 'egreso')
                      .map((mov, index) => (
                        <div key={`${mov.categoria}-${mov.tipo}`} className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <div className="flex-1">
                            <p className="font-medium capitalize">{mov.categoria || 'Sin categoría'}</p>
                            <p className="text-xs text-muted-foreground">
                              {mov.cantidad} movimientos
                            </p>
                          </div>
                          <p className="font-semibold text-red-600">
                            -{formatCurrency(mov.total)}
                          </p>
                        </div>
                      ))}
                    {movimientosCategorias.filter((m) => m.tipo === 'egreso').length === 0 && (
                      <p className="text-muted-foreground text-center py-4">Sin egresos registrados</p>
                    )}
                  </div>
                ) : (
                  <Skeleton className="h-[200px]" />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Stock */}
        <TabsContent value="stock" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Stock Bajo Mínimo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Stock Bajo Mínimo
                </CardTitle>
                <CardDescription>Insumos que requieren reposición</CardDescription>
              </CardHeader>
              <CardContent>
                {stockBajo && stockBajo.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {stockBajo.map((insumo) => (
                      <div
                        key={insumo.insumo_id}
                        className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200"
                      >
                        <div>
                          <p className="font-medium">{insumo.nombre}</p>
                          <p className="text-xs text-muted-foreground">Código: {insumo.codigo}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-red-600">
                            {formatNumber(insumo.stock_actual)} {insumo.unidad_medida}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Mín: {formatNumber(insumo.stock_minimo)} ({insumo.porcentaje.toFixed(0)}%)
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mb-2 opacity-50" />
                    <p>No hay insumos con stock bajo</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resumen de Stock */}
            <Card>
              <CardHeader>
                <CardTitle>Estado General del Stock</CardTitle>
                <CardDescription>Distribución de insumos por estado</CardDescription>
              </CardHeader>
              <CardContent>
                {stockActual ? (
                  <>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              {
                                name: 'OK',
                                value: stockActual.filter((i) => i.estado === 'ok').length,
                                color: '#22C55E',
                              },
                              {
                                name: 'Bajo',
                                value: stockActual.filter((i) => i.estado === 'bajo').length,
                                color: '#F59E0B',
                              },
                              {
                                name: 'Crítico',
                                value: stockActual.filter((i) => i.estado === 'critico').length,
                                color: '#EF4444',
                              },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {[
                              { color: '#22C55E' },
                              { color: '#F59E0B' },
                              { color: '#EF4444' },
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {stockActual.filter((i) => i.estado === 'ok').length}
                        </p>
                        <p className="text-xs text-muted-foreground">Stock OK</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-600">
                          {stockActual.filter((i) => i.estado === 'bajo').length}
                        </p>
                        <p className="text-xs text-muted-foreground">Stock Bajo</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">
                          {stockActual.filter((i) => i.estado === 'critico').length}
                        </p>
                        <p className="text-xs text-muted-foreground">Crítico</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <Skeleton className="h-[300px]" />
                )}
              </CardContent>
            </Card>

            {/* Valor del Inventario */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Valor del Inventario por Categoría</CardTitle>
                <CardDescription>Valorización del stock actual</CardDescription>
              </CardHeader>
              <CardContent>
                {stockActual ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(
                          stockActual.reduce((acc, item) => {
                            const cat = item.categoria || 'Sin categoría';
                            acc[cat] = (acc[cat] || 0) + item.valor_total;
                            return acc;
                          }, {} as Record<string, number>)
                        )
                          .map(([categoria, valor]) => ({ categoria, valor }))
                          .sort((a, b) => b.valor - a.valor)}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          type="number"
                          fontSize={12}
                          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        />
                        <YAxis type="category" dataKey="categoria" fontSize={12} width={120} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Bar dataKey="valor" fill="#00BCD4" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Skeleton className="h-[300px]" />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
