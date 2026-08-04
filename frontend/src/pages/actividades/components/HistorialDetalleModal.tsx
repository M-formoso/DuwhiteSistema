/**
 * Modal con el detalle completo de un proceso de lavado (lote).
 * Muestra: datos generales, timeline de etapas, consumos e info de remitos.
 */

import { useQuery } from '@tanstack/react-query';
import { Clock, Package, User, Zap } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateAR } from '@/lib/utils';
import { formatNumber } from '@/utils/formatters';

import { historialLavadosService } from '@/services/historialLavadosService';

interface Props {
  loteId: string;
  open: boolean;
  onClose: () => void;
}

function formatearFechaHora(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${formatDateAR(iso)} ${d.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatearDuracion(min: number | null | undefined): string {
  if (min === null || min === undefined) return '-';
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  const restante = min % 60;
  return `${horas}h ${restante}m`;
}

export default function HistorialDetalleModal({ loteId, open, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['historial-lote-detalle', loteId],
    queryFn: () => historialLavadosService.getDetalleLote(loteId),
    enabled: open && !!loteId,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Detalle del lote {data?.numero_lote ?? '...'}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="py-16 text-center text-gray-500">Cargando detalle...</div>
        ) : (
          <div className="space-y-5">
            {/* Datos generales */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs uppercase">Cliente</p>
                    <p className="font-medium">{data.cliente?.razon_social ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase">Estado</p>
                    <Badge variant="secondary" className="capitalize">
                      {data.estado.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase">Tipo servicio</p>
                    <p className="capitalize">
                      {data.tipo_servicio ? data.tipo_servicio.replace(/_/g, ' ') : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase">Duración total</p>
                    <p>{formatearDuracion(data.duracion_minutos)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase">Fecha ingreso</p>
                    <p>{formatearFechaHora(data.fecha_ingreso)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase">Inicio proceso</p>
                    <p>{formatearFechaHora(data.fecha_inicio_proceso)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase">Fin proceso</p>
                    <p>{formatearFechaHora(data.fecha_fin_proceso)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase">Peso ingreso</p>
                    <p>
                      {data.peso_entrada_kg !== null
                        ? `${formatNumber(data.peso_entrada_kg, 1)} kg`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase">Peso salida</p>
                    <p>
                      {data.peso_salida_kg !== null
                        ? `${formatNumber(data.peso_salida_kg, 1)} kg`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase">Prendas</p>
                    <p>{data.cantidad_prendas ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase">Pedido</p>
                    <p className="font-mono">{data.pedido?.numero ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase">Prioridad</p>
                    <p className="capitalize">{data.prioridad}</p>
                  </div>
                </div>
                {data.descripcion && (
                  <p className="mt-3 text-sm">
                    <span className="text-gray-500">Descripción: </span>
                    {data.descripcion}
                  </p>
                )}
                {data.notas_cliente && (
                  <p className="mt-1 text-sm">
                    <span className="text-gray-500">Notas cliente: </span>
                    {data.notas_cliente}
                  </p>
                )}
                {data.observaciones_calidad && (
                  <p className="mt-1 text-sm">
                    <span className="text-gray-500">Observaciones calidad: </span>
                    {data.observaciones_calidad}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Etapas */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Etapas del proceso
              </h3>
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {data.etapas.length === 0 ? (
                      <p className="p-4 text-sm text-gray-500">
                        Sin etapas registradas
                      </p>
                    ) : (
                      data.etapas.map((e) => (
                        <div key={e.id} className="p-3 grid grid-cols-12 gap-2 text-sm">
                          <div className="col-span-2 font-mono text-xs text-gray-500">
                            #{e.orden} {e.codigo}
                          </div>
                          <div className="col-span-3 font-medium">{e.nombre ?? '—'}</div>
                          <div className="col-span-3 text-xs text-gray-600">
                            <div>Inicio: {formatearFechaHora(e.fecha_inicio)}</div>
                            <div>Fin: {formatearFechaHora(e.fecha_fin)}</div>
                          </div>
                          <div className="col-span-2 text-xs">
                            <Badge variant="outline" className="capitalize">
                              {e.estado.replace(/_/g, ' ')}
                            </Badge>
                            <div className="mt-1">{formatearDuracion(e.duracion_minutos)}</div>
                          </div>
                          <div className="col-span-2 text-xs text-gray-600">
                            {e.responsable_nombre && (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {e.responsable_nombre}
                              </div>
                            )}
                            {e.peso_kg !== null && (
                              <div>{formatNumber(e.peso_kg, 1)} kg</div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Consumos */}
            {data.consumos.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4" /> Consumos de insumo
                </h3>
                <Card>
                  <CardContent className="p-3">
                    <ul className="text-sm space-y-1">
                      {data.consumos.map((c) => (
                        <li key={c.id} className="flex justify-between">
                          <span>{c.insumo_nombre ?? '—'}</span>
                          <span className="font-mono">
                            {formatNumber(c.cantidad, 3)} {c.unidad}
                            {c.costo_total !== null && (
                              <> · ${formatNumber(c.costo_total, 2)}</>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Remitos */}
            {data.remitos.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Package className="h-4 w-4" /> Remitos emitidos
                </h3>
                {data.remitos.map((r) => (
                  <Card key={r.id} className="mb-2">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-mono font-medium">{r.numero}</span>
                          <Badge variant="outline" className="ml-2 capitalize">
                            {r.tipo}
                          </Badge>
                          <Badge variant="secondary" className="ml-1 capitalize">
                            {r.estado}
                          </Badge>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-500">Total: </span>
                          <span className="font-semibold">
                            ${formatNumber(r.total, 2)}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        Emisión: {formatDateAR(r.fecha_emision || '')}
                        {r.fecha_entrega && (
                          <> · Entrega: {formatearFechaHora(r.fecha_entrega)}</>
                        )}
                      </div>
                      {r.detalles.length > 0 && (
                        <div className="text-sm border-t pt-2">
                          <ul className="space-y-0.5">
                            {r.detalles.map((d, i) => (
                              <li key={i} className="flex justify-between">
                                <span>
                                  {d.cantidad}x {d.producto_nombre ?? '—'}
                                </span>
                                <span className="font-mono text-gray-600">
                                  ${formatNumber(d.subtotal, 2)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
