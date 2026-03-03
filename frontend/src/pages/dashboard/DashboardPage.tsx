/**
 * Página del Dashboard Principal
 */

import { useQuery } from '@tanstack/react-query';
import {
  Package,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle,
  Loader2,
  Factory,
  Wallet,
  AlertCircle,
  Info,
  ShoppingCart,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Link } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/authStore';
import { getDashboardCompleto } from '@/services/dashboardService';
import type { Alerta } from '@/types/dashboard';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-AR');
};

const getAlertIcon = (nivel: Alerta['nivel']) => {
  switch (nivel) {
    case 'error':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    default:
      return <Info className="h-4 w-4 text-info" />;
  }
};

const getAlertBgColor = (nivel: Alerta['nivel']) => {
  switch (nivel) {
    case 'error':
      return 'bg-destructive/10 border-destructive/20';
    case 'warning':
      return 'bg-warning/10 border-warning/20';
    default:
      return 'bg-info/10 border-info/20';
  }
};

const getEstadoBadge = (estado: string) => {
  const estados: Record<string, { color: string; label: string }> = {
    pendiente: { color: 'bg-amber-500/10 text-amber-500', label: 'Pendiente' },
    en_proceso: { color: 'bg-blue-500/10 text-blue-500', label: 'En Proceso' },
    completado: { color: 'bg-emerald-500/10 text-emerald-500', label: 'Completado' },
    entregado: { color: 'bg-purple-500/10 text-purple-500', label: 'Entregado' },
    cancelado: { color: 'bg-red-500/10 text-red-500', label: 'Cancelado' },
  };
  const info = estados[estado] || { color: 'bg-zinc-500/10 text-zinc-500', label: estado };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${info.color}`}>
      {info.label}
    </span>
  );
};

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardCompleto,
    refetchInterval: 60000, // Refrescar cada minuto
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <p>Error al cargar el dashboard</p>
      </div>
    );
  }

  const { kpis, grafico_ventas_semana, pedidos_recientes, lotes_en_proceso, alertas, movimientos_hoy } = dashboard;

  return (
    <div className="space-y-6">
      {/* Bienvenida */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Bienvenido, {user?.nombre}
        </h1>
        <p className="text-muted-foreground">
          Aquí tienes un resumen de la operación del día
        </p>
      </div>

      {/* KPIs Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Ventas del Mes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ventas del Mes
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.ventas.mes.total)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-success" />
              {kpis.ventas.mes.cantidad} pedidos
            </p>
          </CardContent>
        </Card>

        {/* Producción */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Producción
            </CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.produccion.lotes_en_proceso}</div>
            <p className="text-xs text-muted-foreground">
              lotes en proceso • {kpis.produccion.lotes_completados_hoy} completados hoy
            </p>
          </CardContent>
        </Card>

        {/* Caja */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo en Caja
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.finanzas.saldo_caja)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {kpis.finanzas.caja_abierta ? (
                <>
                  <CheckCircle className="h-3 w-3 text-success" />
                  Caja abierta
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 text-warning" />
                  Caja cerrada
                </>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Operación */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Operación
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.operacion.clientes_activos}</div>
            <p className="text-xs text-muted-foreground">
              clientes • {kpis.operacion.empleados_activos} empleados
            </p>
            {kpis.operacion.insumos_bajo_minimo > 0 && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3" />
                {kpis.operacion.insumos_bajo_minimo} insumos bajo mínimo
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Ventas y Alertas */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Gráfico de Ventas de la Semana */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ventas de la Semana</CardTitle>
            <CardDescription>Total facturado por día</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafico_ventas_semana}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="dia"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Total']}
                    labelFormatter={(label) => `Día: ${label}`}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Alertas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Alertas
            </CardTitle>
            <CardDescription>Requieren tu atención</CardDescription>
          </CardHeader>
          <CardContent>
            {alertas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
                <p>Sin alertas pendientes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alertas.slice(0, 5).map((alerta, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${getAlertBgColor(alerta.nivel)}`}
                  >
                    <div className="flex items-start gap-2">
                      {getAlertIcon(alerta.nivel)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">
                          {alerta.titulo}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {alerta.mensaje}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pedidos Recientes y Lotes en Proceso */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pedidos Recientes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Pedidos Recientes
              </CardTitle>
              <CardDescription>Últimos pedidos ingresados</CardDescription>
            </div>
            <Link
              to="/pedidos"
              className="text-sm text-primary hover:underline"
            >
              Ver todos
            </Link>
          </CardHeader>
          <CardContent>
            {pedidos_recientes.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">
                No hay pedidos recientes
              </p>
            ) : (
              <div className="space-y-3">
                {pedidos_recientes.map((pedido) => (
                  <Link
                    key={pedido.id}
                    to={`/pedidos/${pedido.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">
                          #{pedido.numero}
                        </span>
                        {getEstadoBadge(pedido.estado)}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {pedido.cliente}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-text-primary">
                        {formatCurrency(pedido.total)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(pedido.fecha)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lotes en Proceso */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Factory className="h-5 w-5 text-primary" />
                Lotes en Proceso
              </CardTitle>
              <CardDescription>Producción activa</CardDescription>
            </div>
            <Link
              to="/produccion"
              className="text-sm text-primary hover:underline"
            >
              Ver Kanban
            </Link>
          </CardHeader>
          <CardContent>
            {lotes_en_proceso.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">
                No hay lotes en proceso
              </p>
            ) : (
              <div className="space-y-3">
                {lotes_en_proceso.map((lote) => (
                  <Link
                    key={lote.id}
                    to={`/produccion/lotes/${lote.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">
                          {lote.codigo}
                        </span>
                        {lote.prioridad === 'urgente' && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-destructive/10 text-destructive">
                            Urgente
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground capitalize">
                        {lote.tipo_servicio.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-text-primary">
                        {lote.peso_total} kg
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(lote.fecha_ingreso)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumen de Movimientos del Día */}
      <Card>
        <CardHeader>
          <CardTitle>Movimientos del Día</CardTitle>
          <CardDescription>Resumen de caja del día</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 rounded-lg bg-emerald-500/10">
              <p className="text-3xl font-bold text-emerald-500">
                {formatCurrency(movimientos_hoy.ingresos)}
              </p>
              <p className="text-sm text-muted-foreground">Ingresos</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-500/10">
              <p className="text-3xl font-bold text-red-500">
                {formatCurrency(movimientos_hoy.egresos)}
              </p>
              <p className="text-sm text-muted-foreground">Egresos</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-primary/10">
              <p className={`text-3xl font-bold ${movimientos_hoy.balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(movimientos_hoy.balance)}
              </p>
              <p className="text-sm text-muted-foreground">Balance</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-3xl font-bold text-text-primary">
                {movimientos_hoy.cantidad_movimientos}
              </p>
              <p className="text-sm text-muted-foreground">Movimientos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
