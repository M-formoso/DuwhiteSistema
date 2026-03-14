/**
 * Tablero Kanban de Producción con validación de PIN
 */

import { useState } from 'react';
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
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

import { PinValidationModal } from '@/components/produccion/PinValidationModal';
import { IniciarEtapaModal } from '@/components/produccion/IniciarEtapaModal';
import { produccionService } from '@/services/produccionService';
import { formatNumber } from '@/utils/formatters';
import { formatDateAR } from '@/lib/utils';
import type { KanbanLote, PrioridadLote, KanbanColumna } from '@/types/produccion';

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
  onIniciar: (loteId: string, etapaId: string, loteNumero?: string, etapaNombre?: string, requiereMaquina?: boolean, tipoMaquina?: string | null) => void;
  onFinalizar: (loteId: string, etapaId: string) => void;
  isEnProceso: boolean;
}

function KanbanCard({ lote, columna, onIniciar, onFinalizar, isEnProceso }: KanbanCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${
        lote.esta_atrasado ? 'border-red-400 bg-red-50' : ''
      }`}
    >
      <CardContent className="p-3">
        <div
          className="mb-2"
          onClick={() => navigate(`/produccion/lotes/${lote.id}`)}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-gray-400" />
              <span className="font-mono font-medium text-sm">{lote.numero}</span>
            </div>
            <Badge className={PRIORIDAD_COLORS[lote.prioridad]}>
              {PRIORIDAD_LABELS[lote.prioridad]}
            </Badge>
          </div>

          {lote.cliente_nombre && (
            <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
              <User className="h-3 w-3" />
              <span className="truncate">{lote.cliente_nombre}</span>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-gray-500">
            {lote.peso_entrada_kg && (
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {formatNumber(Number(lote.peso_entrada_kg), 1)} kg
              </span>
            )}
            {lote.cantidad_prendas && (
              <span>{lote.cantidad_prendas} prendas</span>
            )}
          </div>

          {lote.tiempo_en_etapa_minutos > 0 && (
            <div className="mt-2">
              <div className={`flex items-center gap-1 text-xs ${
                columna.tiempo_estimado_minutos && lote.tiempo_en_etapa_minutos > columna.tiempo_estimado_minutos
                  ? 'text-orange-600'
                  : 'text-gray-500'
              }`}>
                <Clock className="h-3 w-3" />
                <span>
                  {Math.floor(lote.tiempo_en_etapa_minutos / 60)}h {lote.tiempo_en_etapa_minutos % 60}m
                  {columna.tiempo_estimado_minutos && (
                    <span className="text-gray-400">
                      {' '}/ {Math.floor(columna.tiempo_estimado_minutos / 60)}h {columna.tiempo_estimado_minutos % 60}m est.
                    </span>
                  )}
                </span>
              </div>
              {columna.tiempo_estimado_minutos && lote.tiempo_en_etapa_minutos > columna.tiempo_estimado_minutos && (
                <div className="text-xs text-orange-600 mt-1">
                  +{Math.floor((lote.tiempo_en_etapa_minutos - columna.tiempo_estimado_minutos) / 60)}h {(lote.tiempo_en_etapa_minutos - columna.tiempo_estimado_minutos) % 60}m sobre estimado
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
                onIniciar(lote.id, columna.etapa_id, lote.numero, columna.etapa_nombre, columna.requiere_maquina, columna.tipo_maquina);
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
  } | null>(null);

  // Cargar tablero Kanban - refetch cada 10 segundos para mantener actualizado
  const { data: kanban, isLoading, refetch } = useQuery({
    queryKey: ['kanban'],
    queryFn: () => produccionService.getKanbanBoard(),
    refetchInterval: 10000,
  });

  // Iniciar etapa
  const iniciarMutation = useMutation({
    mutationFn: ({ loteId, etapaId, operarioId, maquinaId }: { loteId: string; etapaId: string; operarioId: string; maquinaId?: string }) =>
      produccionService.iniciarEtapa(loteId, etapaId, { responsable_id: operarioId, maquina_id: maquinaId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['maquinas-disponibles'] });
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

  const handleIniciar = (loteId: string, etapaId: string, loteNumero?: string, etapaNombre?: string, requiereMaquina?: boolean, tipoMaquina?: string | null) => {
    setPendingAction({ type: 'iniciar', loteId, etapaId, loteNumero, etapaNombre, requiereMaquina, tipoMaquina });
    setShowIniciarModal(true);
  };

  const handleFinalizar = (loteId: string, etapaId: string) => {
    setPendingAction({ type: 'finalizar', loteId, etapaId });
    setShowPinModal(true);
  };

  const handleIniciarConfirm = (operarioId: string, operarioNombre: string, maquinaId?: string) => {
    if (!pendingAction) return;

    toast({
      title: 'Operario validado',
      description: `Etapa iniciada por ${operarioNombre}`,
    });

    iniciarMutation.mutate({
      loteId: pendingAction.loteId,
      etapaId: pendingAction.etapaId,
      operarioId,
      maquinaId,
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
      ) : (
        <div className="flex gap-4 overflow-x-auto flex-1 pb-2">
          {kanban?.columnas.map((columna) => (
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
                      {columna.tiempo_estimado_minutos && (
                        <span className="text-xs text-muted-foreground">
                          ~{columna.tiempo_estimado_minutos >= 60
                            ? `${Math.floor(columna.tiempo_estimado_minutos / 60)}h ${columna.tiempo_estimado_minutos % 60}m`
                            : `${columna.tiempo_estimado_minutos}m`
                          }
                        </span>
                      )}
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
          ))}
        </div>
      )}

      {/* Leyenda */}
      <Card className="flex-shrink-0 mt-2">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-6 text-sm">
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
          </div>
        </CardContent>
      </Card>

      {/* Modal para iniciar etapa con máquina */}
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
