/**
 * Tablero Kanban de Producción
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
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

import { produccionService } from '@/services/produccionService';
import { formatNumber, formatDateTime } from '@/utils/formatters';
import type { KanbanLote, PrioridadLote } from '@/types/produccion';

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
  onMover: (loteId: string, etapaId: string) => void;
  onIniciar: (loteId: string, etapaId: string) => void;
  onFinalizar: (loteId: string, etapaId: string) => void;
  etapaActualId: string;
}

function KanbanCard({ lote, onMover, onIniciar, onFinalizar, etapaActualId }: KanbanCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${
        lote.esta_atrasado ? 'border-red-400 bg-red-50' : ''
      }`}
      onClick={() => navigate(`/produccion/lotes/${lote.id}`)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
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
              {formatNumber(lote.peso_entrada_kg, 1)} kg
            </span>
          )}
          {lote.cantidad_prendas && (
            <span>{lote.cantidad_prendas} prendas</span>
          )}
        </div>

        {lote.tiempo_en_etapa_minutos > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
            <Clock className="h-3 w-3" />
            <span>
              {Math.floor(lote.tiempo_en_etapa_minutos / 60)}h {lote.tiempo_en_etapa_minutos % 60}m en etapa
            </span>
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
            Compromiso: {new Date(lote.fecha_compromiso).toLocaleDateString('es-AR')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function KanbanBoardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Cargar tablero Kanban
  const { data: kanban, isLoading, refetch } = useQuery({
    queryKey: ['kanban'],
    queryFn: () => produccionService.getKanbanBoard(),
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  // Mover lote
  const moverMutation = useMutation({
    mutationFn: ({ loteId, etapaId }: { loteId: string; etapaId: string }) =>
      produccionService.moverLote(loteId, etapaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      toast({
        title: 'Lote movido',
        description: 'El lote ha sido movido correctamente.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo mover el lote.',
        variant: 'destructive',
      });
    },
  });

  // Iniciar etapa
  const iniciarMutation = useMutation({
    mutationFn: ({ loteId, etapaId }: { loteId: string; etapaId: string }) =>
      produccionService.iniciarEtapa(loteId, etapaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      toast({
        title: 'Etapa iniciada',
        description: 'La etapa ha sido iniciada.',
      });
    },
  });

  // Finalizar etapa
  const finalizarMutation = useMutation({
    mutationFn: ({ loteId, etapaId }: { loteId: string; etapaId: string }) =>
      produccionService.finalizarEtapa(loteId, etapaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      toast({
        title: 'Etapa finalizada',
        description: 'La etapa ha sido completada.',
      });
    },
  });

  const handleMover = (loteId: string, etapaId: string) => {
    moverMutation.mutate({ loteId, etapaId });
  };

  const handleIniciar = (loteId: string, etapaId: string) => {
    iniciarMutation.mutate({ loteId, etapaId });
  };

  const handleFinalizar = (loteId: string, etapaId: string) => {
    finalizarMutation.mutate({ loteId, etapaId });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
        <div className="flex items-center justify-center h-96">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kanban?.columnas.map((columna) => (
            <div
              key={columna.etapa_id}
              className="flex-shrink-0 w-80"
            >
              <Card className="h-full">
                <CardHeader
                  className="py-3 px-4"
                  style={{ borderTopColor: columna.etapa_color, borderTopWidth: '4px' }}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {columna.etapa_nombre}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {columna.lotes.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-2 space-y-2 min-h-[400px] max-h-[600px] overflow-y-auto">
                  {columna.lotes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                      <Package className="h-8 w-8 mb-2" />
                      <span className="text-sm">Sin lotes</span>
                    </div>
                  ) : (
                    columna.lotes.map((lote) => (
                      <KanbanCard
                        key={lote.id}
                        lote={lote}
                        etapaActualId={columna.etapa_id}
                        onMover={handleMover}
                        onIniciar={handleIniciar}
                        onFinalizar={handleFinalizar}
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
      <Card>
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
    </div>
  );
}
