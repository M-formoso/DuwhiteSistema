/**
 * Gráficos del dashboard de Tesorería.
 *
 * Tres visualizaciones a partir de los movimientos ya cargados en la página
 * (no hace fetch propio para no duplicar llamadas):
 * - Barras: ingresos vs egresos por día (últimos 30 días con actividad).
 * - Donut: composición de ingresos y egresos por método de pago.
 * - Barras horizontales: saldo actual por cuenta bancaria.
 */

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, PieChart as PieChartIcon, TrendingUp } from 'lucide-react';
import { formatNumber } from '@/utils/formatters';
import type { MovimientoConsolidado } from '@/types/tesoreria';
import type { CuentaBancaria } from '@/types/finanzas';

interface Props {
  movimientos: MovimientoConsolidado[];
  cuentas: CuentaBancaria[];
}

const COLORES_METODO: Record<string, string> = {
  efectivo: '#22C55E',
  transferencia: '#3B82F6',
  cheque: '#F59E0B',
};

export function TesoreriaGraficos({ movimientos, cuentas }: Props) {
  // Agrupo movimientos por fecha (YYYY-MM-DD) y los últimos 30 días.
  const serieDiaria = useMemo(() => {
    const porDia = new Map<string, { fecha: string; ingresos: number; egresos: number }>();
    for (const m of movimientos) {
      const fecha = (m.fecha || '').slice(0, 10);
      if (!fecha) continue;
      if (!porDia.has(fecha)) {
        porDia.set(fecha, { fecha, ingresos: 0, egresos: 0 });
      }
      const bucket = porDia.get(fecha)!;
      const monto = Number(m.monto || 0);
      if (m.es_ingreso) bucket.ingresos += monto;
      else bucket.egresos += monto;
    }
    return Array.from(porDia.values())
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(-30)
      .map((d) => ({
        ...d,
        // Label corto DD/MM para el eje X.
        label: `${d.fecha.slice(8, 10)}/${d.fecha.slice(5, 7)}`,
      }));
  }, [movimientos]);

  // Composición por método de pago (solo cuenta movimientos de tesorería/caja,
  // no los cheques listados como registro suelto para no duplicar).
  const porMetodoIngreso = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of movimientos) {
      if (!m.es_ingreso) continue;
      const metodo = (m as any).metodo_pago || 'otro';
      map.set(metodo, (map.get(metodo) || 0) + Number(m.monto || 0));
    }
    return Array.from(map.entries()).map(([metodo, total]) => ({
      name: metodo.charAt(0).toUpperCase() + metodo.slice(1),
      value: total,
      metodo,
    }));
  }, [movimientos]);

  const porMetodoEgreso = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of movimientos) {
      if (m.es_ingreso) continue;
      const metodo = (m as any).metodo_pago || 'otro';
      map.set(metodo, (map.get(metodo) || 0) + Number(m.monto || 0));
    }
    return Array.from(map.entries()).map(([metodo, total]) => ({
      name: metodo.charAt(0).toUpperCase() + metodo.slice(1),
      value: total,
      metodo,
    }));
  }, [movimientos]);

  // Saldos por cuenta — barras horizontales.
  const dataCuentas = useMemo(
    () =>
      cuentas.map((c) => ({
        nombre: `${c.banco} ${c.alias || c.numero_cuenta}`.slice(0, 25),
        saldo: Number(c.saldo_actual || 0),
      })),
    [cuentas],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Barras ingresos vs egresos por día */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5 text-primary" />
            Ingresos vs Egresos por día
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={serieDiaria}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `$${formatNumber(Number(v), 0)}`}
              />
              <Tooltip
                formatter={(v: number) => `$${formatNumber(v, 2)}`}
                labelFormatter={(l) => `Día ${l}`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ingresos" fill="#22C55E" name="Ingresos" radius={[4, 4, 0, 0]} />
              <Bar dataKey="egresos" fill="#EF4444" name="Egresos" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Donut composición ingresos por método */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChartIcon className="h-5 w-5 text-green-600" />
            Ingresos por método
          </CardTitle>
        </CardHeader>
        <CardContent>
          {porMetodoIngreso.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              Sin ingresos en el período.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={porMetodoIngreso}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {porMetodoIngreso.map((entry, idx) => (
                    <Cell
                      key={`in-${idx}`}
                      fill={COLORES_METODO[entry.metodo] || '#6b7280'}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `$${formatNumber(v, 2)}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Donut composición egresos por método */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChartIcon className="h-5 w-5 text-red-600" />
            Egresos por método
          </CardTitle>
        </CardHeader>
        <CardContent>
          {porMetodoEgreso.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              Sin egresos en el período.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={porMetodoEgreso}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {porMetodoEgreso.map((entry, idx) => (
                    <Cell
                      key={`out-${idx}`}
                      fill={COLORES_METODO[entry.metodo] || '#6b7280'}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `$${formatNumber(v, 2)}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Saldos por cuenta — barras horizontales */}
      {dataCuentas.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              Saldo actual por cuenta bancaria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(140, dataCuentas.length * 50)}>
              <BarChart data={dataCuentas} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `$${formatNumber(Number(v), 0)}`}
                />
                <YAxis dataKey="nombre" type="category" tick={{ fontSize: 11 }} width={160} />
                <Tooltip formatter={(v: number) => `$${formatNumber(v, 2)}`} />
                <Bar
                  dataKey="saldo"
                  fill="#8B5CF6"
                  radius={[0, 4, 4, 0]}
                  // Negativos en rojo, positivos en violeta.
                  shape={(props: any) => {
                    const color = props.saldo < 0 ? '#EF4444' : '#8B5CF6';
                    return <rect {...props} fill={color} />;
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
