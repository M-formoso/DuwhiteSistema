/**
 * Vista read-only del progreso de producción para el cliente logueado.
 *
 * Muestra un Kanban simplificado con solo los lotes del propio cliente,
 * sin acciones (iniciar, finalizar, dividir). Abajo, un historial con
 * todos los lotes ya entregados/completados, filtrable por fecha.
 *
 * El backend garantiza que /produccion/mi-kanban y /produccion/mi-historial
 * solo devuelvan lotes del cliente asociado al usuario logueado.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Factory,
  Package,
  Clock,
  Scale,
  Shirt,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Filter,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { produccionService, MiHistorialLote } from '@/services/produccionService';
import type { KanbanLote, KanbanColumna } from '@/types/produccion';
import { formatNumber, getLocalDateString } from '@/utils/formatters';

const PAGE_SIZE = 25;

function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTiempo(minutos: number): string {
  if (!minutos || minutos < 1) return '—';
  if (minutos < 60) return `${Math.round(minutos)} min`;
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ============================================================
// Tarjeta de lote (read-only, sin acciones)
// ============================================================
function LoteCardReadOnly({ lote, columna }: { lote: KanbanLote; columna: KanbanColumna }) {
  const tiempoExcedido =
    columna.tiempo_estimado_minutos != null &&
    lote.tiempo_en_etapa_minutos > columna.tiempo_estimado_minutos;

  return (
    <div
      className={`rounded-xl border p-3 bg-white shadow-sm transition-all ${
        lote.esta_atrasado ? 'border-red-300 bg-red-50/60' : 'border-gray-200'
      } ${lote.etapa_en_proceso ? 'ring-1 ring-primary/30' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-mono font-bold text-sm">{lote.numero}</div>
        </div>
        {lote.etapa_en_proceso ? (
          <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            EN PROCESO
          </span>
        ) : (
          <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
            EN ESPERA
          </span>
        )}
      </div>

      {/* Datos */}
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {lote.peso_entrada_kg && (
          <div className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
            <Scale className="h-3 w-3 text-gray-500 flex-shrink-0" />
            <span className="font-medium">
              {formatNumber(Number(lote.peso_entrada_kg), 1)} kg
            </span>
          </div>
        )}
        {lote.cantidad_prendas != null && (
          <div className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
            <Shirt className="h-3 w-3 text-gray-500 flex-shrink-0" />
            <span className="font-medium">{lote.cantidad_prendas}</span>
          </div>
        )}
        {lote.tiempo_en_etapa_minutos > 0 && (
          <div
            className={`flex items-center gap-1 rounded px-2 py-1 col-span-2 ${
              tiempoExcedido ? 'bg-amber-50 text-amber-700' : 'bg-gray-50'
            }`}
          >
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span className="font-medium">
              {formatTiempo(lote.tiempo_en_etapa_minutos)}
              {columna.tiempo_estimado_minutos && (
                <span className="ml-1 text-gray-500 font-normal">
                  · est. {formatTiempo(columna.tiempo_estimado_minutos)}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {lote.esta_atrasado && (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-red-700">
          <AlertTriangle className="h-3 w-3" />
          <span>Compromiso vencido</span>
        </div>
      )}
      {lote.fecha_compromiso && !lote.esta_atrasado && (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-gray-500">
          <Calendar className="h-3 w-3" />
          <span>Entrega: {formatearFecha(lote.fecha_compromiso)}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Página principal
// ============================================================
export default function MiProduccionPage() {
  const {
    data: kanban,
    isLoading: loadingKanban,
    refetch: refetchKanban,
  } = useQuery({
    queryKey: ['mi-kanban'],
    queryFn: () => produccionService.getMiKanban(),
    refetchInterval: 30000, // Actualizar cada 30s
  });

  // Historial: fechas por defecto = últimos 30 días
  const hoy = getLocalDateString(new Date());
  const hace30 = getLocalDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  const [fechaDesde, setFechaDesde] = useState<string>(hace30);
  const [fechaHasta, setFechaHasta] = useState<string>(hoy);
  const [historialSkip, setHistorialSkip] = useState(0);

  const { data: historial, isLoading: loadingHistorial } = useQuery({
    queryKey: ['mi-historial', fechaDesde, fechaHasta, historialSkip],
    queryFn: () =>
      produccionService.getMiHistorial({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        skip: historialSkip,
        limit: PAGE_SIZE,
      }),
  });

  const columnasConLotes = useMemo(
    () => (kanban?.columnas ?? []).filter((c) => c.lotes.length > 0),
    [kanban],
  );

  const totalKgActivos = useMemo(
    () =>
      (kanban?.columnas ?? []).reduce(
        (acc, col) =>
          acc + col.lotes.reduce((s, l) => s + (Number(l.peso_entrada_kg) || 0), 0),
        0,
      ),
    [kanban],
  );

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Factory className="h-6 w-6 text-primary" />
            Mi Producción
          </h1>
          <p className="text-sm text-muted-foreground">
            Progreso en tiempo real de tus lotes por etapa. Se actualiza automáticamente.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchKanban()}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refrescar
        </Button>
      </div>

      {/* Resumen rápido */}
      {kanban && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase font-semibold">
                Lotes activos
              </div>
              <div className="text-2xl font-bold text-primary">{kanban.total_lotes}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Kg en curso</div>
              <div className="text-2xl font-bold">{formatNumber(totalKgActivos, 1)}</div>
            </CardContent>
          </Card>
          <Card className={kanban.lotes_atrasados > 0 ? 'border-red-300 bg-red-50/50' : ''}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Atrasados</div>
              <div
                className={`text-2xl font-bold ${
                  kanban.lotes_atrasados > 0 ? 'text-red-600' : 'text-gray-500'
                }`}
              >
                {kanban.lotes_atrasados}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Etapas activas</div>
              <div className="text-2xl font-bold">{columnasConLotes.length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Kanban */}
      {loadingKanban ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : columnasConLotes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No tenés lotes en producción por ahora</p>
            <p className="text-sm text-muted-foreground mt-1">
              Cuando tus pedidos entren a la planta van a aparecer acá con su avance.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory md:snap-none">
          {columnasConLotes.map((columna) => (
            <div
              key={columna.etapa_id}
              className="flex-shrink-0 w-[85vw] sm:w-72 md:w-64 lg:w-72 snap-start"
            >
              <div
                className="rounded-t-xl px-3 py-2.5 text-white"
                style={{ backgroundColor: columna.etapa_color }}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm truncate">{columna.etapa_nombre}</h3>
                    {columna.tiempo_estimado_minutos && (
                      <p className="text-[10px] text-white/80 flex items-center gap-1 mt-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        Est. {formatTiempo(columna.tiempo_estimado_minutos)}
                      </p>
                    )}
                  </div>
                  <span className="text-lg font-bold flex-shrink-0 ml-2">
                    {columna.lotes.length}
                  </span>
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-b-xl p-2 space-y-2 min-h-[100px]">
                {columna.lotes.map((lote) => (
                  <LoteCardReadOnly key={lote.id} lote={lote} columna={columna} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Historial */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Historial de pedidos entregados
          </CardTitle>
          <div className="flex items-end gap-3 flex-wrap mt-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Desde</label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value);
                  setHistorialSkip(0);
                }}
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Hasta</label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value);
                  setHistorialSkip(0);
                }}
                className="w-40"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFechaDesde('');
                setFechaHasta('');
                setHistorialSkip(0);
              }}
            >
              <Filter className="h-3.5 w-3.5 mr-1" />
              Limpiar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingHistorial ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !historial || historial.items.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>No hay pedidos entregados en el rango elegido.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lote</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Peso</TableHead>
                      <TableHead className="text-right">Prendas</TableHead>
                      <TableHead>Ingreso</TableHead>
                      <TableHead>Entrega</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historial.items.map((lote: MiHistorialLote) => (
                      <TableRow key={lote.id}>
                        <TableCell className="font-mono font-medium text-sm">
                          {lote.numero}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-sm text-gray-600">
                          {lote.descripcion || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {lote.peso_entrada_kg
                            ? `${formatNumber(Number(lote.peso_entrada_kg), 1)} kg`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {lote.cantidad_prendas ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatearFecha(lote.fecha_ingreso)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatearFecha(lote.fecha_fin_proceso)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {historial.total > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-3 text-sm">
                  <span className="text-muted-foreground">
                    Mostrando {historialSkip + 1}–
                    {Math.min(historialSkip + PAGE_SIZE, historial.total)} de {historial.total}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={historialSkip === 0}
                      onClick={() => setHistorialSkip(Math.max(0, historialSkip - PAGE_SIZE))}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={historialSkip + PAGE_SIZE >= historial.total}
                      onClick={() => setHistorialSkip(historialSkip + PAGE_SIZE)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
