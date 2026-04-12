/**
 * Tablero Kanban de Producción con validación de PIN
 * V2: Canastos, timers en tiempo real, totales por columna, relevado
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  RefreshCw,
  AlertTriangle,
  Clock,
  Package,
  User,
  GripVertical,
  Play,
  CheckCircle,
  Settings2,
  Truck,
  Box,
  RotateCcw,
  Scale,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

import { PinValidationModal } from '@/components/produccion/PinValidationModal';
import { IniciarEtapaModal } from '@/components/produccion/IniciarEtapaModal';
import { produccionService } from '@/services/produccionService';
import { clienteService } from '@/services/clienteService';
import { formatNumber, formatCurrency } from '@/utils/formatters';
import { formatDateAR } from '@/lib/utils';
import type { KanbanLote, PrioridadLote, KanbanColumna, KanbanCanasto } from '@/types/produccion';
import type { PedidoList } from '@/types/cliente';

// Hook para timer en tiempo real
function useRealTimeTimer(fechaInicio: string | null | undefined, isEnProceso: boolean) {
  const [minutosTranscurridos, setMinutosTranscurridos] = useState(0);

  useEffect(() => {
    if (!fechaInicio || !isEnProceso) {
      setMinutosTranscurridos(0);
      return;
    }

    const calcularMinutos = () => {
      const inicio = new Date(fechaInicio).getTime();
      const ahora = Date.now();
      return Math.floor((ahora - inicio) / 60000);
    };

    setMinutosTranscurridos(calcularMinutos());

    const interval = setInterval(() => {
      setMinutosTranscurridos(calcularMinutos());
    }, 30000); // Actualizar cada 30 segundos

    return () => clearInterval(interval);
  }, [fechaInicio, isEnProceso]);

  return minutosTranscurridos;
}

// Formateador de tiempo
function formatTiempo(minutos: number): string {
  if (minutos < 60) return `${minutos}m`;
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  if (horas < 24) return `${horas}h ${mins}m`;
  const dias = Math.floor(horas / 24);
  const horasRestantes = horas % 24;
  return `${dias}d ${horasRestantes}h`;
}

const PRIORIDAD_COLORS: Record<PrioridadLote, string> = {
  baja: 'bg-gray-100 text-gray-700 border-gray-300',
  normal: 'bg-blue-100 text-blue-700 border-blue-300',
  alta: 'bg-orange-100 text-orange-700 border-orange-300',
  urgente: 'bg-red-100 text-red-700 border-red-300',
};

const PRIORIDAD_LABELS: Record<PrioridadLote, string> = {
  baja: 'Baja',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

interface KanbanCardProps {
  lote: KanbanLote;
  columna: KanbanColumna;
  onIniciar: (loteId: string, etapaId: string, loteNumero?: string, etapaNombre?: string, requiereMaquina?: boolean, tipoMaquina?: string | null, etapaCodigo?: string) => void;
  onFinalizar: (loteId: string, etapaId: string) => void;
  isEnProceso: boolean;
}

function KanbanCard({ lote, columna, onIniciar, onFinalizar, isEnProceso }: KanbanCardProps) {
  const navigate = useNavigate();

  // Timer en tiempo real
  const tiempoReal = useRealTimeTimer(lote.fecha_inicio_etapa, isEnProceso);
  const tiempoMostrar = isEnProceso && lote.fecha_inicio_etapa ? tiempoReal : lote.tiempo_en_etapa_minutos;

  const estaExcedido = columna.tiempo_estimado_minutos && tiempoMostrar > columna.tiempo_estimado_minutos;
  const esRelevado = lote.tipo_lote === 'relevado';

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${
        lote.esta_atrasado ? 'border-red-400 bg-red-50' : ''
      } ${esRelevado ? 'border-l-4 border-l-purple-500' : ''}`}
    >
      <CardContent className="p-3">
        <div
          className="mb-2"
          onClick={() => navigate(`/produccion/lotes/${lote.id}`)}
        >
          {/* Header con número y badges */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-gray-400" />
              <span className="font-mono font-medium text-sm">{lote.numero}</span>
            </div>
            <div className="flex gap-1">
              {esRelevado && (
                <Badge className="bg-purple-100 text-purple-700 border-purple-300 text-[10px] px-1">
                  <RotateCcw className="h-2.5 w-2.5 mr-0.5" />
                  Relevado
                </Badge>
              )}
              <Badge className={PRIORIDAD_COLORS[lote.prioridad]}>
                {PRIORIDAD_LABELS[lote.prioridad]}
              </Badge>
            </div>
          </div>

          {/* Lote padre si es relevado */}
          {esRelevado && lote.lote_padre_numero && (
            <div className="text-[10px] text-purple-600 mb-1">
              De lote: {lote.lote_padre_numero}
            </div>
          )}

          {lote.cliente_nombre && (
            <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
              <User className="h-3 w-3" />
              <span className="truncate">{lote.cliente_nombre}</span>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-gray-500">
            {lote.peso_entrada_kg && (
              <span className="flex items-center gap-1">
                <Scale className="h-3 w-3" />
                {formatNumber(Number(lote.peso_entrada_kg), 1)} kg
              </span>
            )}
            {lote.cantidad_prendas && (
              <span>{lote.cantidad_prendas} prendas</span>
            )}
          </div>

          {/* Canastos asignados */}
          {lote.canastos && lote.canastos.length > 0 && (
            <div className="mt-2 flex items-center gap-1 flex-wrap">
              <Box className="h-3 w-3 text-amber-600" />
              {lote.canastos.slice(0, 5).map((c) => (
                <Badge
                  key={c.id}
                  variant="outline"
                  className="text-[10px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-300"
                >
                  #{c.numero}
                </Badge>
              ))}
              {lote.canastos.length > 5 && (
                <span className="text-[10px] text-amber-600">
                  +{lote.canastos.length - 5}
                </span>
              )}
            </div>
          )}

          {/* Timer en tiempo real */}
          {tiempoMostrar > 0 && (
            <div className="mt-2">
              <div className={`flex items-center gap-1 text-xs ${
                estaExcedido ? 'text-orange-600 font-medium' : 'text-gray-500'
              }`}>
                <Clock className={`h-3 w-3 ${isEnProceso ? 'animate-pulse' : ''}`} />
                <span>
                  {formatTiempo(tiempoMostrar)}
                  {columna.tiempo_estimado_minutos && (
                    <span className="text-gray-400">
                      {' '}/ {formatTiempo(columna.tiempo_estimado_minutos)} est.
                    </span>
                  )}
                </span>
              </div>
              {estaExcedido && (
                <div className="text-xs text-orange-600 mt-1">
                  +{formatTiempo(tiempoMostrar - columna.tiempo_estimado_minutos!)} sobre estimado
                </div>
              )}
            </div>
          )}

          {lote.esta_atrasado && (
            <div className="flex items-center gap-1 text-xs text-red-600 mt-2">
              <AlertTriangle className="h-3 w-3" />
              <span>Atrasado</span>
            </div>
          )}

          {lote.fecha_compromiso && (
            <div className="text-xs text-gray-400 mt-2">
              Compromiso: {formatDateAR(lote.fecha_compromiso)}
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2 mt-3 pt-2 border-t">
          {!isEnProceso ? (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onIniciar(lote.id, columna.etapa_id, lote.numero, columna.etapa_nombre, columna.requiere_maquina, columna.tipo_maquina, columna.etapa_codigo);
              }}
            >
              <Play className="h-3 w-3 mr-1" />
              Iniciar
            </Button>
          ) : (
            <Button
              size="sm"
              className="flex-1 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onFinalizar(lote.id, columna.etapa_id);
              }}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Finalizar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function KanbanBoardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Estado para modal de PIN / Iniciar
  const [showPinModal, setShowPinModal] = useState(false);
  const [showIniciarModal, setShowIniciarModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'iniciar' | 'finalizar';
    loteId: string;
    etapaId: string;
    loteNumero?: string;
    etapaNombre?: string;
    requiereMaquina?: boolean;
    tipoMaquina?: string | null;
    etapaCodigo?: string;
  } | null>(null);

  // Cargar tablero Kanban - refetch cada 10 segundos para mantener actualizado
  const { data: kanban, isLoading, error: kanbanError, refetch } = useQuery({
    queryKey: ['kanban'],
    queryFn: () => produccionService.getKanbanBoard(),
    refetchInterval: 10000,
  });

  // Log for debugging
  console.log('Kanban data:', kanban);
  console.log('Kanban columnas:', kanban?.columnas?.length || 0);
  if (kanbanError) {
    console.error('Error cargando Kanban:', kanbanError);
  }

  // Cargar pedidos en camino
  const { data: pedidosEnCamino } = useQuery({
    queryKey: ['pedidos-en-camino'],
    queryFn: () => produccionService.getPedidosEnCamino(),
    refetchInterval: 10000,
  });

  // Iniciar etapa
  const iniciarMutation = useMutation({
    mutationFn: ({ loteId, etapaId, operarioId, maquinaId, canastosIds, pesoKg }: { loteId: string; etapaId: string; operarioId: string; maquinaId?: string; canastosIds?: string[]; pesoKg?: number }) =>
      produccionService.iniciarEtapa(loteId, etapaId, { responsable_id: operarioId, maquina_id: maquinaId, canastos_ids: canastosIds, peso_kg: pesoKg }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['maquinas-disponibles'] });
      queryClient.invalidateQueries({ queryKey: ['canastos-disponibles'] });
      queryClient.invalidateQueries({ queryKey: ['canastos-grid'] });
      toast({
        title: 'Etapa iniciada',
        description: 'La etapa ha sido iniciada correctamente.',
      });
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      const detail = error.response?.data?.detail || 'No se pudo iniciar la etapa.';
      toast({
        title: 'Error',
        description: detail,
        variant: 'destructive',
      });
    },
  });

  // Finalizar etapa
  const finalizarMutation = useMutation({
    mutationFn: ({ loteId, etapaId }: { loteId: string; etapaId: string }) =>
      produccionService.finalizarEtapa(loteId, etapaId, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['maquinas-disponibles'] });
      queryClient.invalidateQueries({ queryKey: ['canastos-disponibles'] });
      queryClient.invalidateQueries({ queryKey: ['canastos-grid'] });
      toast({
        title: 'Etapa finalizada',
        description: 'La etapa ha sido completada.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo finalizar la etapa.',
        variant: 'destructive',
      });
    },
  });

  const handleIniciar = (loteId: string, etapaId: string, loteNumero?: string, etapaNombre?: string, requiereMaquina?: boolean, tipoMaquina?: string | null, etapaCodigo?: string) => {
    setPendingAction({ type: 'iniciar', loteId, etapaId, loteNumero, etapaNombre, requiereMaquina, tipoMaquina, etapaCodigo });
    setShowIniciarModal(true);
  };

  const handleFinalizar = (loteId: string, etapaId: string) => {
    setPendingAction({ type: 'finalizar', loteId, etapaId });
    setShowPinModal(true);
  };

  const handleIniciarConfirm = (operarioId: string, operarioNombre: string, maquinaId?: string, canastosIds?: string[], pesoKg?: number) => {
    if (!pendingAction) return;

    toast({
      title: 'Operario validado',
      description: `Etapa iniciada por ${operarioNombre}${canastosIds?.length ? ` con ${canastosIds.length} canasto(s)` : ''}${pesoKg ? ` - ${pesoKg} kg` : ''}`,
    });

    iniciarMutation.mutate({
      loteId: pendingAction.loteId,
      etapaId: pendingAction.etapaId,
      operarioId,
      maquinaId,
      canastosIds,
      pesoKg,
    });

    setPendingAction(null);
  };

  const handlePinValidated = (operarioId: string, operarioNombre: string) => {
    if (!pendingAction) return;

    toast({
      title: 'Operario validado',
      description: `Acción registrada por ${operarioNombre}`,
    });

    finalizarMutation.mutate({
      loteId: pendingAction.loteId,
      etapaId: pendingAction.etapaId,
    });

    setPendingAction(null);
  };

  // Determinar si un lote está en proceso en su etapa actual (desde el backend)
  const isLoteEnProceso = (lote: KanbanLote): boolean => {
    return lote.etapa_en_proceso;
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Producción</h1>
          <p className="text-gray-500">
            Tablero Kanban - {kanban?.total_lotes || 0} lotes activos
            {kanban && kanban.lotes_atrasados > 0 && (
              <span className="text-red-600 ml-2">
                ({kanban.lotes_atrasados} atrasados)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/produccion/panel')} className="bg-green-600 hover:bg-green-700">
            <Play className="h-4 w-4 mr-2" />
            Panel Operarios
          </Button>
          <Button variant="outline" onClick={() => navigate('/produccion/canastos')}>
            <Box className="h-4 w-4 mr-2" />
            Canastos
          </Button>
          <Button variant="outline" onClick={() => navigate('/produccion/productos')}>
            <Package className="h-4 w-4 mr-2" />
            Productos
          </Button>
          <Button variant="outline" onClick={() => navigate('/produccion/maquinas')}>
            <Settings2 className="h-4 w-4 mr-2" />
            Máquinas
          </Button>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button variant="outline" onClick={() => navigate('/produccion/lotes')}>
            Ver Lista
          </Button>
          <Button onClick={() => navigate('/produccion/lotes/nuevo')}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Lote
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : kanbanError ? (
        <div className="flex flex-col items-center justify-center flex-1 text-red-500">
          <AlertTriangle className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">Error al cargar el tablero</p>
          <p className="text-sm text-gray-500 mt-2">
            {kanbanError instanceof Error ? kanbanError.message : 'Error desconocido'}
          </p>
          <Button onClick={() => refetch()} className="mt-4" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto flex-1 pb-2">
          {/* Columnas de etapas del Kanban */}
          {kanban?.columnas.map((columna) => {
            // Calcular total kg de la columna
            const totalKgColumna = columna.lotes.reduce(
              (sum, lote) => sum + (Number(lote.peso_entrada_kg) || 0),
              0
            );

            return (
            <div
              key={columna.etapa_id}
              className="flex-shrink-0 w-80 flex flex-col"
            >
              <Card className="flex flex-col h-full">
                <CardHeader
                  className="py-3 px-4 flex-shrink-0"
                  style={{ borderTopColor: columna.etapa_color, borderTopWidth: '4px' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium">
                        {columna.etapa_nombre}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-0.5">
                        {columna.tiempo_estimado_minutos && (
                          <span className="text-xs text-muted-foreground">
                            ~{formatTiempo(columna.tiempo_estimado_minutos)}
                          </span>
                        )}
                        {totalKgColumna > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Scale className="h-3 w-3" />
                            {formatNumber(totalKgColumna, 1)} kg
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {columna.lotes.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-2 space-y-2 flex-1 overflow-y-auto">
                  {columna.lotes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <Package className="h-8 w-8 mb-2" />
                      <span className="text-sm">Sin lotes</span>
                    </div>
                  ) : (
                    columna.lotes.map((lote) => (
                      <KanbanCard
                        key={lote.id}
                        lote={lote}
                        columna={columna}
                        onIniciar={handleIniciar}
                        onFinalizar={handleFinalizar}
                        isEnProceso={isLoteEnProceso(lote)}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
            );
          })}
        </div>
      )}

      {/* Leyenda */}
      <Card className="flex-shrink-0 mt-2">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <span className="font-medium text-gray-700">Prioridad:</span>
            {Object.entries(PRIORIDAD_LABELS).map(([key, label]) => (
              <Badge key={key} className={PRIORIDAD_COLORS[key as PrioridadLote]}>
                {label}
              </Badge>
            ))}
            <span className="ml-4 flex items-center gap-1 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              Atrasado
            </span>
            <span className="ml-2 flex items-center gap-1 text-purple-600">
              <RotateCcw className="h-4 w-4" />
              Relevado
            </span>
            <span className="ml-2 flex items-center gap-1 text-amber-600">
              <Box className="h-4 w-4" />
              Canastos
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Modal para iniciar etapa con máquina y canastos */}
      <IniciarEtapaModal
        open={showIniciarModal}
        onClose={() => {
          setShowIniciarModal(false);
          setPendingAction(null);
        }}
        onConfirm={handleIniciarConfirm}
        title="Iniciar Etapa"
        description="Valida tu PIN para iniciar esta etapa"
        loteNumero={pendingAction?.loteNumero}
        etapaNombre={pendingAction?.etapaNombre}
        showMachineSelection={true}
        requiereMaquina={pendingAction?.requiereMaquina}
        tipoMaquina={pendingAction?.tipoMaquina}
        etapaCodigo={pendingAction?.etapaCodigo}
      />

      {/* Modal de validación de PIN para finalizar */}
      <PinValidationModal
        open={showPinModal}
        onClose={() => {
          setShowPinModal(false);
          setPendingAction(null);
        }}
        onValidated={handlePinValidated}
        title="Finalizar Etapa"
        description="Valida tu PIN para finalizar esta etapa"
      />
    </div>
  );
}
