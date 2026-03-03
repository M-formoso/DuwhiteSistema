/**
 * Detalle de Lote de Producción
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit,
  RefreshCw,
  Play,
  CheckCircle,
  Pause,
  XCircle,
  Package,
  Clock,
  User,
  AlertTriangle,
  ChevronRight,
  Calendar,
  FileText,
  Settings,
} from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

import { produccionService } from '@/services/produccionService';
import { formatNumber } from '@/utils/formatters';
import type { EstadoLote, PrioridadLote, LoteEtapa } from '@/types/produccion';
import { TIPOS_SERVICIO, ESTADOS_LOTE, PRIORIDADES } from '@/types/produccion';

const ESTADO_COLORS: Record<EstadoLote, string> = {
  pendiente: 'bg-gray-100 text-gray-700 border-gray-300',
  en_proceso: 'bg-blue-100 text-blue-700 border-blue-300',
  pausado: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  completado: 'bg-green-100 text-green-700 border-green-300',
  cancelado: 'bg-red-100 text-red-700 border-red-300',
};

const PRIORIDAD_COLORS: Record<PrioridadLote, string> = {
  baja: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
};

const ETAPA_ESTADO_COLORS: Record<string, string> = {
  pendiente: 'border-gray-300 bg-gray-50',
  en_proceso: 'border-blue-400 bg-blue-50',
  completada: 'border-green-400 bg-green-50',
};

export default function LoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showEstadoModal, setShowEstadoModal] = useState(false);
  const [showMoverModal, setShowMoverModal] = useState(false);
  const [selectedEtapaId, setSelectedEtapaId] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');

  // Query del lote
  const { data: lote, isLoading } = useQuery({
    queryKey: ['lote', id],
    queryFn: () => produccionService.getLote(id!),
    enabled: Boolean(id),
  });

  // Query de etapas disponibles
  const { data: etapas } = useQuery({
    queryKey: ['etapas'],
    queryFn: () => produccionService.getEtapasLista(),
  });

  // Query de consumos
  const { data: consumos } = useQuery({
    queryKey: ['lote-consumos', id],
    queryFn: () => produccionService.getConsumosLote(id!),
    enabled: Boolean(id),
  });

  // Mutations
  const cambiarEstadoMutation = useMutation({
    mutationFn: ({ estado, obs }: { estado: EstadoLote; obs?: string }) =>
      produccionService.cambiarEstadoLote(id!, estado, obs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lote', id] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      toast({ title: 'Estado actualizado' });
      setShowEstadoModal(false);
      setObservaciones('');
    },
  });

  const moverMutation = useMutation({
    mutationFn: ({ etapaId, obs }: { etapaId: string; obs?: string }) =>
      produccionService.moverLote(id!, etapaId, undefined, obs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lote', id] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      toast({ title: 'Lote movido a nueva etapa' });
      setShowMoverModal(false);
      setSelectedEtapaId(null);
      setObservaciones('');
    },
  });

  const iniciarEtapaMutation = useMutation({
    mutationFn: (etapaId: string) => produccionService.iniciarEtapa(id!, etapaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lote', id] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      toast({ title: 'Etapa iniciada' });
    },
  });

  const finalizarEtapaMutation = useMutation({
    mutationFn: (etapaId: string) => produccionService.finalizarEtapa(id!, etapaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lote', id] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      toast({ title: 'Etapa finalizada' });
    },
  });

  const getTipoServicioLabel = (tipo: string) => {
    return TIPOS_SERVICIO.find((t) => t.value === tipo)?.label || tipo;
  };

  const getEstadoLabel = (est: EstadoLote) => {
    return ESTADOS_LOTE.find((e) => e.value === est)?.label || est;
  };

  const getPrioridadLabel = (pri: PrioridadLote) => {
    return PRIORIDADES.find((p) => p.value === pri)?.label || pri;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lote) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Lote no encontrado</p>
        <Button variant="link" onClick={() => navigate('/produccion/lotes')}>
          Volver a la lista
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">{lote.numero}</h1>
              <Badge className={ESTADO_COLORS[lote.estado]}>{getEstadoLabel(lote.estado)}</Badge>
              <Badge className={PRIORIDAD_COLORS[lote.prioridad]}>
                {getPrioridadLabel(lote.prioridad)}
              </Badge>
              {lote.esta_atrasado && (
                <Badge className="bg-red-100 text-red-700 border-red-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Atrasado
                </Badge>
              )}
            </div>
            <p className="text-gray-500">
              {getTipoServicioLabel(lote.tipo_servicio)}
              {lote.cliente_nombre && ` · ${lote.cliente_nombre}`}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/produccion/lotes/${id}/editar`)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button variant="outline" onClick={() => setShowMoverModal(true)}>
            <ChevronRight className="h-4 w-4 mr-2" />
            Mover a Etapa
          </Button>
          <Button variant="outline" onClick={() => setShowEstadoModal(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Cambiar Estado
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info General */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Información General
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Peso Entrada</p>
                  <p className="font-medium">
                    {lote.peso_entrada_kg ? `${formatNumber(lote.peso_entrada_kg, 2)} kg` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Peso Salida</p>
                  <p className="font-medium">
                    {lote.peso_salida_kg ? `${formatNumber(lote.peso_salida_kg, 2)} kg` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cantidad Prendas</p>
                  <p className="font-medium">{lote.cantidad_prendas || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avance</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${lote.porcentaje_avance}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{lote.porcentaje_avance}%</span>
                  </div>
                </div>
              </div>

              {(lote.tiene_manchas || lote.tiene_roturas) && (
                <div className="mt-4 pt-4 border-t flex gap-4">
                  {lote.tiene_manchas && (
                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                      Tiene manchas
                    </Badge>
                  )}
                  {lote.tiene_roturas && (
                    <Badge variant="outline" className="text-red-600 border-red-300">
                      Tiene roturas
                    </Badge>
                  )}
                </div>
              )}

              {lote.descripcion && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-1">Descripción</p>
                  <p className="text-sm">{lote.descripcion}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Etapas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Etapas del Proceso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {lote.etapas.map((etapa, index) => (
                  <div
                    key={etapa.id}
                    className={`p-4 rounded-lg border-2 ${ETAPA_ESTADO_COLORS[etapa.estado]}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: etapa.etapa_color || '#6B7280' }}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{etapa.etapa_nombre}</p>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            {etapa.fecha_inicio && (
                              <span>
                                Inicio:{' '}
                                {new Date(etapa.fecha_inicio).toLocaleString('es-AR', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </span>
                            )}
                            {etapa.duracion_minutos > 0 && (
                              <span>Duración: {formatDuration(etapa.duracion_minutos)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {etapa.estado === 'pendiente' && lote.etapa_actual_id === etapa.etapa_id && (
                          <Button
                            size="sm"
                            onClick={() => iniciarEtapaMutation.mutate(etapa.etapa_id)}
                            disabled={iniciarEtapaMutation.isPending}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Iniciar
                          </Button>
                        )}
                        {etapa.estado === 'en_proceso' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => finalizarEtapaMutation.mutate(etapa.etapa_id)}
                            disabled={finalizarEtapaMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Finalizar
                          </Button>
                        )}
                        {etapa.estado === 'completada' && (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completada
                          </Badge>
                        )}
                      </div>
                    </div>

                    {(etapa.responsable_nombre || etapa.maquina_nombre || etapa.observaciones) && (
                      <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600">
                        {etapa.responsable_nombre && (
                          <span className="flex items-center gap-1 mb-1">
                            <User className="h-3 w-3" />
                            {etapa.responsable_nombre}
                          </span>
                        )}
                        {etapa.maquina_nombre && (
                          <span className="flex items-center gap-1 mb-1">
                            <Settings className="h-3 w-3" />
                            {etapa.maquina_nombre}
                          </span>
                        )}
                        {etapa.observaciones && <p className="mt-1">{etapa.observaciones}</p>}
                      </div>
                    )}
                  </div>
                ))}

                {lote.etapas.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No hay etapas registradas</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Consumos */}
          {consumos && consumos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Consumos de Insumos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {consumos.map((consumo) => (
                    <div
                      key={consumo.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{consumo.insumo_nombre}</p>
                        <p className="text-sm text-gray-500">{consumo.insumo_codigo}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatNumber(consumo.cantidad, 2)} {consumo.unidad}
                        </p>
                        {consumo.costo_total && (
                          <p className="text-sm text-gray-500">
                            ${formatNumber(consumo.costo_total, 2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Fechas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Fechas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Fecha de Ingreso</p>
                <p className="font-medium">
                  {new Date(lote.fecha_ingreso).toLocaleDateString('es-AR')}
                </p>
              </div>
              {lote.fecha_compromiso && (
                <div>
                  <p className="text-sm text-gray-500">Fecha de Compromiso</p>
                  <p
                    className={`font-medium ${lote.esta_atrasado ? 'text-red-600' : ''}`}
                  >
                    {new Date(lote.fecha_compromiso).toLocaleDateString('es-AR')}
                  </p>
                </div>
              )}
              {lote.fecha_inicio_proceso && (
                <div>
                  <p className="text-sm text-gray-500">Inicio de Proceso</p>
                  <p className="font-medium">
                    {new Date(lote.fecha_inicio_proceso).toLocaleDateString('es-AR')}
                  </p>
                </div>
              )}
              {lote.fecha_fin_proceso && (
                <div>
                  <p className="text-sm text-gray-500">Fin de Proceso</p>
                  <p className="font-medium">
                    {new Date(lote.fecha_fin_proceso).toLocaleDateString('es-AR')}
                  </p>
                </div>
              )}
              {lote.tiempo_en_proceso > 0 && (
                <div>
                  <p className="text-sm text-gray-500">Tiempo en Proceso</p>
                  <p className="font-medium">{formatDuration(lote.tiempo_en_proceso)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notas */}
          {(lote.notas_internas || lote.notas_cliente || lote.observaciones_calidad) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Notas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lote.notas_internas && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Notas Internas</p>
                    <p className="text-sm text-gray-600">{lote.notas_internas}</p>
                  </div>
                )}
                {lote.notas_cliente && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Notas del Cliente</p>
                    <p className="text-sm text-gray-600">{lote.notas_cliente}</p>
                  </div>
                )}
                {lote.observaciones_calidad && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Observaciones de Calidad</p>
                    <p className="text-sm text-gray-600">{lote.observaciones_calidad}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Información Adicional */}
          <Card>
            <CardHeader>
              <CardTitle>Información Adicional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {lote.pedido_numero && (
                <div>
                  <p className="text-gray-500">Pedido</p>
                  <p className="font-medium font-mono">{lote.pedido_numero}</p>
                </div>
              )}
              <div>
                <p className="text-gray-500">Creado por</p>
                <p className="font-medium">{lote.creado_por_nombre || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Fecha de Creación</p>
                <p className="font-medium">
                  {new Date(lote.created_at).toLocaleString('es-AR')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Cambiar Estado */}
      {showEstadoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle>Cambiar Estado del Lote</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {ESTADOS_LOTE.filter((e) => e.value !== lote.estado).map((estado) => (
                  <Button
                    key={estado.value}
                    variant="outline"
                    className={`justify-start ${
                      estado.value === 'cancelado' ? 'text-red-600 border-red-300' : ''
                    }`}
                    onClick={() =>
                      cambiarEstadoMutation.mutate({
                        estado: estado.value as EstadoLote,
                        obs: observaciones,
                      })
                    }
                    disabled={cambiarEstadoMutation.isPending}
                  >
                    {estado.value === 'en_proceso' && <Play className="h-4 w-4 mr-2" />}
                    {estado.value === 'pausado' && <Pause className="h-4 w-4 mr-2" />}
                    {estado.value === 'completado' && <CheckCircle className="h-4 w-4 mr-2" />}
                    {estado.value === 'cancelado' && <XCircle className="h-4 w-4 mr-2" />}
                    {estado.label}
                  </Button>
                ))}
              </div>

              <Textarea
                placeholder="Observaciones (opcional)"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />

              <div className="flex justify-end">
                <Button variant="ghost" onClick={() => setShowEstadoModal(false)}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Mover a Etapa */}
      {showMoverModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle>Mover a Nueva Etapa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedEtapaId || ''} onValueChange={setSelectedEtapaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar etapa destino" />
                </SelectTrigger>
                <SelectContent>
                  {etapas
                    ?.filter((e) => e.id !== lote.etapa_actual_id)
                    .map((etapa) => (
                      <SelectItem key={etapa.id} value={etapa.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: etapa.color }}
                          />
                          {etapa.nombre}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Textarea
                placeholder="Observaciones (opcional)"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowMoverModal(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() =>
                    selectedEtapaId &&
                    moverMutation.mutate({ etapaId: selectedEtapaId, obs: observaciones })
                  }
                  disabled={!selectedEtapaId || moverMutation.isPending}
                >
                  Mover Lote
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
