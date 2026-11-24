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

import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
  MapPin,
  Check,
  X,
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
import { formatDateAR } from '@/lib/utils';

const PAGE_SIZE = 25;

function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  const formateado = formatDateAR(fecha);
  return formateado === '-' ? '—' : formateado;
}

function formatTiempo(minutos: number): string {
  if (!minutos || minutos < 1) return '—';
  if (minutos < 60) return `${Math.round(minutos)} min`;
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ============================================================
// Stepper horizontal por lote (vista principal del cliente)
// ============================================================
// Reemplaza al carrusel de columnas: por cada lote del cliente dibuja
// una línea de pasos numerados; el paso actual se marca en azul y los
// anteriores con check. Tocar un paso abre el modal con el detalle.
function LoteStepper({
  lote,
  etapaIdxActual,
  columnas,
  onEtapaClick,
}: {
  lote: KanbanLote;
  etapaIdxActual: number;
  columnas: KanbanColumna[];
  onEtapaClick: (idx: number) => void;
}) {
  const columnaActual = columnas[etapaIdxActual];
  return (
    <div
      className={`rounded-xl border bg-white shadow-sm p-4 ${
        lote.esta_atrasado ? 'border-red-300 bg-red-50/40' : 'border-gray-200'
      }`}
    >
      {/* Header: nro de lote + badge de estado + "Ver seguimiento" */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm">{lote.numero}</span>
            {lote.etapa_en_proceso ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                EN PROCESO
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                EN ESPERA
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-gray-600">
            Etapa <span className="font-semibold">{etapaIdxActual + 1}</span> de{' '}
            <span className="font-semibold">{columnas.length}</span>:{' '}
            <span className="text-gray-900">{columnaActual?.etapa_nombre}</span>
          </div>
        </div>
        <Link
          to={`/mi-produccion/seguimiento/${lote.id}`}
          className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-primary border border-primary/30 rounded-md px-2 py-1 hover:bg-primary/5 transition"
        >
          <MapPin className="h-3 w-3" />
          Ver seguimiento
        </Link>
      </div>

      {/* Chips rápidas */}
      <div className="flex flex-wrap gap-1.5 mb-3 text-xs">
        {lote.peso_entrada_kg && (
          <span className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
            <Scale className="h-3 w-3 text-gray-500" />
            <span className="font-medium">
              {formatNumber(Number(lote.peso_entrada_kg), 1)} kg
            </span>
          </span>
        )}
        {lote.cantidad_prendas != null && (
          <span className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1">
            <Shirt className="h-3 w-3 text-gray-500" />
            <span className="font-medium">{lote.cantidad_prendas} prendas</span>
          </span>
        )}
        {lote.fecha_compromiso && !lote.esta_atrasado && (
          <span className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1 text-gray-600">
            <Calendar className="h-3 w-3" />
            Entrega: {formatearFecha(lote.fecha_compromiso)}
          </span>
        )}
        {lote.esta_atrasado && (
          <span className="flex items-center gap-1 bg-red-50 text-red-700 rounded px-2 py-1 font-medium">
            <AlertTriangle className="h-3 w-3" />
            Compromiso vencido
          </span>
        )}
      </div>

      {/* Línea de steps horizontal con scroll en mobile si son muchas etapas */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex items-start min-w-max">
          {columnas.map((col, idx) => {
            const estado =
              idx < etapaIdxActual
                ? 'completado'
                : idx === etapaIdxActual
                ? 'activo'
                : 'pendiente';
            return (
              <Fragment key={col.etapa_id}>
                {idx > 0 && (
                  <div
                    className={`h-0.5 min-w-[28px] flex-1 mt-5 ${
                      idx <= etapaIdxActual ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => onEtapaClick(idx)}
                  className="group flex flex-col items-center gap-1.5 min-w-[64px] px-1 focus:outline-none"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-transform group-hover:scale-105 ${
                      estado === 'activo'
                        ? 'bg-primary text-white ring-4 ring-primary/20'
                        : estado === 'completado'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-100 text-gray-400 border border-gray-200'
                    }`}
                  >
                    {estado === 'completado' ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={`text-[10px] leading-tight text-center max-w-[70px] truncate ${
                      estado === 'activo'
                        ? 'text-gray-900 font-semibold'
                        : estado === 'completado'
                        ? 'text-emerald-700'
                        : 'text-gray-400'
                    }`}
                    title={col.etapa_nombre}
                  >
                    {col.etapa_nombre}
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Modal: detalle de una etapa al tocar un punto del stepper
// ============================================================
function EtapaDetalleModal({
  lote,
  columna,
  etapaIdx,
  etapaIdxActual,
  totalEtapas,
  onClose,
}: {
  lote: KanbanLote;
  columna: KanbanColumna;
  etapaIdx: number;
  etapaIdxActual: number;
  totalEtapas: number;
  onClose: () => void;
}) {
  const estado =
    etapaIdx < etapaIdxActual
      ? 'completado'
      : etapaIdx === etapaIdxActual
      ? 'activo'
      : 'pendiente';

  const tiempoExcedido =
    estado === 'activo' &&
    columna.tiempo_estimado_minutos != null &&
    lote.tiempo_en_etapa_minutos > columna.tiempo_estimado_minutos;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
              Etapa {etapaIdx + 1} de {totalEtapas}
            </div>
            <h3 className="font-semibold text-lg mt-0.5">{columna.etapa_nombre}</h3>
            <div className="font-mono text-xs text-gray-500 mt-0.5">{lote.numero}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {estado === 'completado' && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              <Check className="h-4 w-4" />
              <span>Esta etapa ya se completó.</span>
            </div>
          )}
          {estado === 'pendiente' && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              <Clock className="h-4 w-4" />
              <span>Esta etapa todavía no comenzó.</span>
            </div>
          )}
          {estado === 'activo' && (
            <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span>
                {lote.etapa_en_proceso
                  ? 'En proceso en este momento.'
                  : 'En espera para procesarse.'}
              </span>
            </div>
          )}

          {/* Datos del lote (relevantes siempre) */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {lote.peso_entrada_kg && (
              <div className="flex items-center gap-1.5 bg-gray-50 rounded px-2 py-1.5">
                <Scale className="h-3.5 w-3.5 text-gray-500" />
                <span className="font-medium">
                  {formatNumber(Number(lote.peso_entrada_kg), 1)} kg
                </span>
              </div>
            )}
            {lote.cantidad_prendas != null && (
              <div className="flex items-center gap-1.5 bg-gray-50 rounded px-2 py-1.5">
                <Shirt className="h-3.5 w-3.5 text-gray-500" />
                <span className="font-medium">{lote.cantidad_prendas} prendas</span>
              </div>
            )}
          </div>

          {/* Tiempo en la etapa (solo si es la actual) */}
          {estado === 'activo' && lote.tiempo_en_etapa_minutos > 0 && (
            <div
              className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-xs ${
                tiempoExcedido ? 'bg-amber-50 text-amber-700' : 'bg-gray-50'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span className="font-medium">
                {formatTiempo(lote.tiempo_en_etapa_minutos)} en esta etapa
                {columna.tiempo_estimado_minutos && (
                  <span className="ml-1 text-gray-500 font-normal">
                    · estimado {formatTiempo(columna.tiempo_estimado_minutos)}
                  </span>
                )}
              </span>
            </div>
          )}

          {estado !== 'activo' && columna.tiempo_estimado_minutos != null && (
            <div className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs bg-gray-50 text-gray-600">
              <Clock className="h-3.5 w-3.5" />
              <span>Duración estimada {formatTiempo(columna.tiempo_estimado_minutos)}</span>
            </div>
          )}

          {lote.fecha_compromiso && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Calendar className="h-3.5 w-3.5" />
              <span>Entrega comprometida: {formatearFecha(lote.fecha_compromiso)}</span>
            </div>
          )}
          {lote.esta_atrasado && (
            <div className="flex items-center gap-1.5 text-xs text-red-700 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              Compromiso vencido
            </div>
          )}
        </div>

        <div className="p-4 pt-0 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
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

  // Mostramos TODAS las etapas del proceso (no solo las que tienen lotes)
  // para que el cliente vea el recorrido completo y sepa por cuál pasó su
  // lote, en cuál está y cuáles le faltan.
  const columnas = useMemo(() => kanban?.columnas ?? [], [kanban]);
  const columnasConLotes = useMemo(
    () => columnas.filter((c) => c.lotes.length > 0),
    [columnas],
  );

  // Vista stepper: colapsamos el kanban en una lista de lotes únicos, cada
  // uno con su etapa_idx actual. Un lote solo puede estar en UNA columna.
  const lotesConEtapa = useMemo(() => {
    const items: { lote: KanbanLote; etapaIdx: number; columna: KanbanColumna }[] = [];
    columnas.forEach((col, idx) => {
      col.lotes.forEach((lote) => {
        items.push({ lote, etapaIdx: idx, columna: col });
      });
    });
    return items;
  }, [columnas]);

  // Modal de detalle de etapa (abierto al tocar un punto del stepper).
  const [etapaModal, setEtapaModal] = useState<{
    lote: KanbanLote;
    etapaIdx: number;
    etapaIdxActual: number;
  } | null>(null);

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

      {/* Progreso por lote: cada lote como stepper horizontal con los
          estados del proceso. Tocar un punto abre el modal con el detalle
          de esa etapa. */}
      {loadingKanban ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : columnas.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Todavía no hay etapas configuradas</p>
            <p className="text-sm text-muted-foreground mt-1">
              Cuando tus pedidos entren a la planta van a aparecer acá con su avance.
            </p>
          </CardContent>
        </Card>
      ) : lotesConEtapa.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No tenés pedidos en producción en este momento</p>
            <p className="text-sm text-muted-foreground mt-1">
              Cuando ingrese un nuevo pedido vas a ver su avance acá.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {lotesConEtapa.map(({ lote, etapaIdx }) => (
            <LoteStepper
              key={lote.id}
              lote={lote}
              etapaIdxActual={etapaIdx}
              columnas={columnas}
              onEtapaClick={(idx) =>
                setEtapaModal({ lote, etapaIdx: idx, etapaIdxActual: etapaIdx })
              }
            />
          ))}
        </div>
      )}

      {/* Modal de detalle de etapa — abre al tocar un punto del stepper */}
      {etapaModal && columnas[etapaModal.etapaIdx] && (
        <EtapaDetalleModal
          lote={etapaModal.lote}
          columna={columnas[etapaModal.etapaIdx]}
          etapaIdx={etapaModal.etapaIdx}
          etapaIdxActual={etapaModal.etapaIdxActual}
          totalEtapas={columnas.length}
          onClose={() => setEtapaModal(null)}
        />
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
