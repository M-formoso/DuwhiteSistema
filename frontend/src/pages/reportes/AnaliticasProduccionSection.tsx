/**
 * Sección de Analíticas de Producción para insertar dentro del módulo
 * de Reportes (tab "Producción").
 *
 * - Sumatorias del día (kg en proceso, kg finalizados hoy, lotes activos / finalizados)
 * - Grid por posta con dos columnas: en proceso y finalizados hoy
 * - Throughput kg/h por posta
 * - Tabla de rendimiento por producto + proyección a 8h
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Factory,
  Flame,
  Gauge,
  Hourglass,
  Loader2,
  Package,
  RefreshCw,
  Scale,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatNumber } from '@/utils/formatters';
import {
  getAnaliticaProduccion,
  getRendimientoProductos,
  type AnaliticaPosta,
} from '@/services/reporteService';

function formatMinutos(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return '–';
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function PostaCard({ posta }: { posta: AnaliticaPosta }) {
  const tiempoEstimadoExcedido = (min: number) =>
    posta.tiempo_estimado_minutos != null &&
    min > (posta.tiempo_estimado_minutos as number);

  return (
    <Card className="flex flex-col h-[460px]">
      <div
        className="rounded-t-xl px-4 py-3 text-white"
        style={{ backgroundColor: posta.etapa_color }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg leading-none">{posta.etapa_nombre}</h3>
            {posta.tiempo_estimado_minutos ? (
              <p className="text-xs text-white/80 mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Est: {formatMinutos(posta.tiempo_estimado_minutos)}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold leading-none">
              {posta.lotes_en_proceso.length}
            </div>
            <div className="text-[10px] text-white/80 uppercase tracking-wide">
              en proceso
            </div>
          </div>
        </div>
      </div>

      <CardContent className="pt-3 flex flex-col flex-1 min-h-0 space-y-3">
        {/* Métricas de la posta */}
        <div className="grid grid-cols-3 gap-2 text-center flex-shrink-0">
          <div className="bg-blue-50 rounded p-2">
            <div className="text-[10px] text-blue-700 uppercase">En proceso</div>
            <div className="text-sm font-bold text-blue-700">
              {formatNumber(posta.kg_en_proceso, 1)} kg
            </div>
          </div>
          <div className="bg-emerald-50 rounded p-2">
            <div className="text-[10px] text-emerald-700 uppercase">Finalizado</div>
            <div className="text-sm font-bold text-emerald-700">
              {formatNumber(posta.kg_finalizado_hoy, 1)} kg
            </div>
          </div>
          <div className="bg-purple-50 rounded p-2">
            <div className="text-[10px] text-purple-700 uppercase">kg/h</div>
            <div className="text-sm font-bold text-purple-700">
              {formatNumber(posta.throughput_kg_hora, 1)}
            </div>
          </div>
        </div>

        {/* Lotes en proceso */}
        <div className="flex flex-col min-h-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase mb-1 flex-shrink-0">
            <Activity className="h-3 w-3 text-blue-500 animate-pulse" />
            Procesando
            <span className="text-gray-400 normal-case font-normal">
              ({posta.lotes_en_proceso.length})
            </span>
          </div>
          {posta.lotes_en_proceso.length === 0 ? (
            <p className="text-xs text-gray-400 italic px-1">Sin lotes en curso</p>
          ) : (
            <ul className="space-y-1 overflow-y-auto pr-1 flex-1">
              {posta.lotes_en_proceso.map((l) => (
                <li
                  key={l.lote_id}
                  className={`text-xs rounded border px-2 py-1.5 ${
                    tiempoEstimadoExcedido(l.minutos_en_etapa)
                      ? 'border-orange-300 bg-orange-50'
                      : 'border-blue-200 bg-blue-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold truncate">{l.lote_numero}</span>
                    <span className="font-mono text-[11px] text-gray-600 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatMinutos(l.minutos_en_etapa)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5 text-[11px] text-gray-600">
                    <span className="truncate">{l.cliente_nombre || '–'}</span>
                    <span className="font-mono">{formatNumber(l.kg, 1)} kg</span>
                  </div>
                  {l.responsable && (
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-500">
                      <User className="h-2.5 w-2.5" />
                      {l.responsable}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Lotes finalizados hoy */}
        <div className="flex flex-col min-h-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase mb-1 flex-shrink-0">
            <CheckCircle className="h-3 w-3 text-emerald-500" />
            Finalizados
            <span className="text-gray-400 normal-case font-normal">
              ({posta.lotes_finalizados_hoy.length})
            </span>
          </div>
          {posta.lotes_finalizados_hoy.length === 0 ? (
            <p className="text-xs text-gray-400 italic px-1">Sin movimiento en el rango</p>
          ) : (
            <ul className="space-y-1 overflow-y-auto pr-1 flex-1">
              {posta.lotes_finalizados_hoy.map((l) => (
                <li
                  key={l.lote_id}
                  className="text-xs rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold truncate">{l.lote_numero}</span>
                    <span className="font-mono text-[11px] text-gray-600">
                      {formatMinutos(l.duracion_minutos)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5 text-[11px] text-gray-600">
                    <span className="truncate">{l.cliente_nombre || '–'}</span>
                    <span className="font-mono">{formatNumber(l.kg, 1)} kg</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface AnaliticasProduccionSectionProps {
  fechaDesde?: string;
  fechaHasta?: string;
}

export function AnaliticasProduccionSection({
  fechaDesde,
  fechaHasta,
}: AnaliticasProduccionSectionProps = {}) {
  // Si la página exterior pasa fechas las usamos; si no caemos a "hoy" + ventana móvil.
  const tieneRangoExterno = Boolean(fechaDesde && fechaHasta);
  const [diasAtras, setDiasAtras] = useState<number>(30);

  const {
    data: analitica,
    isLoading: loadingAnalitica,
    refetch: refetchAnalitica,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['analitica-produccion', fechaDesde, fechaHasta],
    queryFn: () =>
      getAnaliticaProduccion(
        tieneRangoExterno
          ? { fecha_desde: fechaDesde, fecha_hasta: fechaHasta }
          : undefined
      ),
    refetchInterval: 10_000,
  });

  const { data: rendimiento, isLoading: loadingRendimiento } = useQuery({
    queryKey: ['rendimiento-productos', fechaDesde, fechaHasta, diasAtras],
    queryFn: () =>
      tieneRangoExterno
        ? getRendimientoProductos({
            fecha_desde: fechaDesde,
            fecha_hasta: fechaHasta,
          })
        : getRendimientoProductos({ dias_atras: diasAtras }),
  });

  const totales = analitica?.totales;
  const rangoLabel = (() => {
    if (!fechaDesde || !fechaHasta) return 'Hoy';
    if (fechaDesde === fechaHasta) {
      return new Date(fechaDesde).toLocaleDateString('es-AR');
    }
    return `${new Date(fechaDesde).toLocaleDateString('es-AR')} → ${new Date(
      fechaHasta
    ).toLocaleDateString('es-AR')}`;
  })();

  return (
    <div className="space-y-6">
      {/* Sub-header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            Tiempo real por posta
            <Badge variant="outline" className="font-normal">
              {rangoLabel}
            </Badge>
          </h2>
          <p className="text-xs text-gray-500">
            "En proceso" siempre es ahora; los kg / lotes finalizados y kg/h corresponden al rango.
            {dataUpdatedAt > 0 && (
              <span className="text-gray-400 ml-2">
                · actualizado {new Date(dataUpdatedAt).toLocaleTimeString('es-AR')}
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchAnalitica()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Tiles de totales */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Lotes en proceso</p>
                <p className="text-2xl font-bold text-blue-600">
                  {totales?.lotes_en_proceso ?? '–'}
                </p>
              </div>
              <Factory className="h-7 w-7 text-blue-300" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">kg en proceso</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatNumber(totales?.kg_en_proceso || 0, 1)}
                </p>
              </div>
              <Scale className="h-7 w-7 text-blue-300" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Lotes finalizados</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {totales?.lotes_finalizados_hoy ?? '–'}
                </p>
              </div>
              <CheckCircle className="h-7 w-7 text-emerald-300" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">kg finalizados</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatNumber(totales?.kg_finalizado_hoy || 0, 1)}
                </p>
              </div>
              <Scale className="h-7 w-7 text-emerald-300" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Horas planta</p>
                <p className="text-2xl font-bold text-purple-700">
                  {formatNumber(totales?.horas_planta_hoy || 0, 1)} h
                </p>
              </div>
              <Clock className="h-7 w-7 text-purple-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ciclo de lotes completados (entrada → salida) */}
      {analitica?.ciclo_lotes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Ciclo de lotes completados en el rango
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-blue-50 rounded p-3 text-center">
                <p className="text-[10px] text-blue-700 uppercase">Lotes</p>
                <p className="text-xl font-bold text-blue-700">
                  {analitica.ciclo_lotes.lotes_completados}
                </p>
              </div>
              <div className="bg-emerald-50 rounded p-3 text-center">
                <p className="text-[10px] text-emerald-700 uppercase">kg producidos</p>
                <p className="text-xl font-bold text-emerald-700">
                  {formatNumber(analitica.ciclo_lotes.kg_total_completado, 1)}
                </p>
              </div>
              <div className="bg-purple-50 rounded p-3 text-center">
                <p className="text-[10px] text-purple-700 uppercase">Duración promedio</p>
                <p className="text-xl font-bold text-purple-700">
                  {formatMinutos(analitica.ciclo_lotes.duracion_promedio_minutos)}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-3 text-center">
                <p className="text-[10px] text-gray-600 uppercase">Más rápido</p>
                <p className="text-lg font-bold text-gray-700">
                  {analitica.ciclo_lotes.duracion_min_minutos != null
                    ? formatMinutos(analitica.ciclo_lotes.duracion_min_minutos)
                    : '–'}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-3 text-center">
                <p className="text-[10px] text-gray-600 uppercase">Más lento</p>
                <p className="text-lg font-bold text-gray-700">
                  {analitica.ciclo_lotes.duracion_max_minutos != null
                    ? formatMinutos(analitica.ciclo_lotes.duracion_max_minutos)
                    : '–'}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Medido desde la primera etapa iniciada hasta la última finalizada.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Grid por posta */}
      {loadingAnalitica ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : analitica && analitica.postas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {analitica.postas.map((p) => (
            <PostaCard key={p.etapa_id} posta={p} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p>No hay postas activas para mostrar.</p>
          </CardContent>
        </Card>
      )}

      {/* Gráficos visuales por posta */}
      {analitica && analitica.postas.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bar chart kg por posta */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Factory className="h-4 w-4 text-primary" />
                Kg por posta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analitica.postas.map((p) => ({
                      nombre:
                        p.etapa_nombre.length > 12
                          ? p.etapa_nombre.slice(0, 12) + '…'
                          : p.etapa_nombre,
                      'En proceso': p.kg_en_proceso,
                      Finalizado: p.kg_finalizado_hoy,
                      color: p.etapa_color,
                    }))}
                    margin={{ top: 6, right: 10, left: -10, bottom: 0 }}
                  >
                    <XAxis dataKey="nombre" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip
                      formatter={(v: number) => [`${formatNumber(v, 1)} kg`, '']}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="En proceso" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Finalizado" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Pie de distribución de kg finalizados */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                Distribución de kg finalizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analitica.postas
                        .filter((p) => p.kg_finalizado_hoy > 0)
                        .map((p) => ({
                          name: p.etapa_nombre,
                          value: p.kg_finalizado_hoy,
                          fill: p.etapa_color,
                        }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {analitica.postas
                        .filter((p) => p.kg_finalizado_hoy > 0)
                        .map((p) => (
                          <Cell key={p.etapa_id} fill={p.etapa_color} />
                        ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => `${formatNumber(v, 1)} kg`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cuellos de botella + Tiempo de espera */}
      {analitica && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Cuellos de botella */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                Cuellos de botella
              </CardTitle>
              <p className="text-xs text-gray-500">
                Tiempo estimado para drenar lo acumulado al ritmo actual.
              </p>
            </CardHeader>
            <CardContent>
              {!analitica.cuellos_de_botella || analitica.cuellos_de_botella.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Sin datos suficientes.</p>
              ) : (
                <ul className="space-y-2">
                  {(() => {
                    const max = Math.max(
                      ...analitica.cuellos_de_botella.map((c) => c.saturacion_minutos),
                      1,
                    );
                    return analitica.cuellos_de_botella.slice(0, 8).map((c) => {
                      const pct = (c.saturacion_minutos / max) * 100;
                      return (
                        <li key={c.etapa_id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 truncate font-medium">
                              <span
                                className="inline-block w-2 h-2 rounded-full"
                                style={{ backgroundColor: c.etapa_color }}
                              />
                              {c.etapa_nombre}
                            </span>
                            <span className="font-mono text-gray-700">
                              {c.saturacion_minutos > 0
                                ? formatMinutos(c.saturacion_minutos)
                                : '–'}
                              <span className="text-gray-400 ml-1">
                                · {formatNumber(c.kg_en_proceso, 0)} kg
                              </span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded">
                            <div
                              className="h-1.5 rounded"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: c.etapa_color,
                                opacity: pct > 0 ? 0.85 : 0,
                              }}
                            />
                          </div>
                        </li>
                      );
                    });
                  })()}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Tiempo de espera entre postas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Hourglass className="h-4 w-4 text-amber-500" />
                Tiempo de espera entre postas
              </CardTitle>
              <p className="text-xs text-gray-500">
                Tiempo promedio del lote desde que termina una etapa hasta que
                arranca la siguiente.
                {typeof analitica.espera_global_promedio_minutos === 'number' && (
                  <>
                    {' · '}global:{' '}
                    <strong>
                      {formatMinutos(analitica.espera_global_promedio_minutos)}
                    </strong>
                  </>
                )}
              </p>
            </CardHeader>
            <CardContent>
              {!analitica.tiempos_espera_postas ||
              analitica.tiempos_espera_postas.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                  Sin transiciones registradas en el rango.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(() => {
                    const arr = analitica.tiempos_espera_postas.filter(
                      (t) => t.muestras > 0,
                    );
                    if (arr.length === 0) {
                      return (
                        <li className="text-sm text-gray-400 italic">
                          Sin transiciones registradas en el rango.
                        </li>
                      );
                    }
                    const max = Math.max(
                      ...arr.map((c) => c.espera_promedio_minutos),
                      1,
                    );
                    return arr.map((c) => {
                      const pct = (c.espera_promedio_minutos / max) * 100;
                      return (
                        <li key={c.etapa_id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 truncate font-medium">
                              <span
                                className="inline-block w-2 h-2 rounded-full"
                                style={{ backgroundColor: c.etapa_color }}
                              />
                              {c.etapa_nombre} →
                            </span>
                            <span className="font-mono text-gray-700">
                              {formatMinutos(c.espera_promedio_minutos)}
                              <span className="text-gray-400 ml-1">
                                · {c.muestras} muestras
                              </span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded">
                            <div
                              className="h-1.5 rounded bg-amber-400"
                              style={{ width: `${pct}%`, opacity: 0.8 }}
                            />
                          </div>
                        </li>
                      );
                    });
                  })()}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Productividad por operario */}
      {analitica?.productividad_operarios && analitica.productividad_operarios.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Productividad por operario
            </CardTitle>
            <p className="text-xs text-gray-500">
              kg procesados, lotes intervenidos y horas trabajadas dentro del rango.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operario</TableHead>
                    <TableHead className="text-right">Etapas</TableHead>
                    <TableHead className="text-right">Lotes</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-right">kg procesados</TableHead>
                    <TableHead className="text-right bg-primary/5">kg/h</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analitica.productividad_operarios.map((op) => (
                    <TableRow key={op.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                            {op.nombre
                              .split(' ')
                              .map((n) => n.charAt(0))
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <span className="font-medium">{op.nombre}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {op.cantidad_etapas}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {op.lotes_distintos}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatNumber(op.horas_trabajadas, 1)} h
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(op.kg_procesados, 1)} kg
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary bg-primary/5">
                        {formatNumber(op.kg_por_hora, 1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rendimiento por producto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Rendimiento por producto
            </span>
            {tieneRangoExterno ? (
              <Badge variant="outline" className="font-normal text-xs">
                {rangoLabel}
              </Badge>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Histórico:</span>
                <Select
                  value={String(diasAtras)}
                  onValueChange={(v) => setDiasAtras(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Últimos 7 días</SelectItem>
                    <SelectItem value="14">Últimos 14 días</SelectItem>
                    <SelectItem value="30">Últimos 30 días</SelectItem>
                    <SelectItem value="60">Últimos 60 días</SelectItem>
                    <SelectItem value="90">Últimos 90 días</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRendimiento ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : rendimiento && rendimiento.productos.length > 0 ? (
            <>
              <div className="mb-3 text-xs text-gray-500">
                {rendimiento.productos.length} productos · Horas de planta en el período:{' '}
                <strong>{formatNumber(rendimiento.horas_planta, 1)} h</strong>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Código</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Peso unit.</TableHead>
                      <TableHead className="text-right">Procesado</TableHead>
                      <TableHead className="text-right">kg estimados</TableHead>
                      <TableHead className="text-right">u/h</TableHead>
                      <TableHead className="text-right bg-primary/5">
                        Proyección 8h
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rendimiento.productos.map((p) => (
                      <TableRow key={p.producto_id}>
                        <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{p.nombre}</span>
                            <Badge variant="outline" className="w-fit text-[10px]">
                              {p.categoria}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {p.peso_promedio_kg
                            ? `${formatNumber(p.peso_promedio_kg, 2)} kg`
                            : '–'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {p.unidades_totales}
                        </TableCell>
                        <TableCell className="text-right text-gray-600">
                          {p.kg_estimados ? `${formatNumber(p.kg_estimados, 1)} kg` : '–'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(p.unidades_por_hora, 1)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary bg-primary/5">
                          {p.proyeccion_8h}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p>No hay datos suficientes para calcular rendimiento.</p>
              <p className="text-xs mt-1">Se calcula a partir de remitos emitidos.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
