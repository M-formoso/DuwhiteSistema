/**
 * Página de Gestión de Canastos
 * Grid visual de 50 canastos con estado en tiempo real
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Info, Clock, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { canastoService } from '@/services/canastoService';
import {
  CanastoGridItem,
  CanastosGridResponse,
  EstadoCanasto,
  ESTADOS_CANASTO,
  LoteCanasto,
} from '@/types/produccion-v2';

export default function CanastosPage() {
  const queryClient = useQueryClient();
  const [selectedCanasto, setSelectedCanasto] = useState<CanastoGridItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEstadoModal, setShowEstadoModal] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState<EstadoCanasto>('disponible');

  // Query: Grid de canastos
  const { data: gridData, isLoading, refetch } = useQuery<CanastosGridResponse>({
    queryKey: ['canastos-grid'],
    queryFn: () => canastoService.getGrid(),
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  // Query: Historial del canasto seleccionado
  const { data: historial } = useQuery<LoteCanasto[]>({
    queryKey: ['canasto-historial', selectedCanasto?.id],
    queryFn: () => canastoService.getHistorial(selectedCanasto!.id, 10),
    enabled: !!selectedCanasto && showDetailModal,
  });

  // Mutation: Cambiar estado
  const cambiarEstadoMutation = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoCanasto }) =>
      canastoService.cambiarEstado(id, estado),
    onSuccess: () => {
      toast.success('Estado actualizado');
      queryClient.invalidateQueries({ queryKey: ['canastos-grid'] });
      setShowEstadoModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al cambiar estado');
    },
  });

  const getEstadoColor = (estado: EstadoCanasto): string => {
    const config = ESTADOS_CANASTO.find((e) => e.value === estado);
    return config?.color || '#6B7280';
  };

  const getEstadoBgColor = (estado: EstadoCanasto): string => {
    switch (estado) {
      case 'disponible':
        return 'bg-green-100 hover:bg-green-200 border-green-400';
      case 'en_uso':
        return 'bg-amber-100 hover:bg-amber-200 border-amber-400';
      case 'mantenimiento':
        return 'bg-orange-100 hover:bg-orange-200 border-orange-400';
      case 'fuera_servicio':
        return 'bg-red-100 hover:bg-red-200 border-red-400';
      default:
        return 'bg-gray-100 hover:bg-gray-200 border-gray-400';
    }
  };

  const formatMinutos = (minutos: number): string => {
    if (minutos < 60) return `${minutos}m`;
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas}h ${mins}m`;
  };

  const handleCanastoClick = (canasto: CanastoGridItem) => {
    setSelectedCanasto(canasto);
    setShowDetailModal(true);
  };

  const handleCambiarEstado = () => {
    if (!selectedCanasto) return;
    setNuevoEstado(selectedCanasto.estado as EstadoCanasto);
    setShowDetailModal(false);
    setShowEstadoModal(true);
  };

  const confirmarCambioEstado = () => {
    if (!selectedCanasto) return;
    cambiarEstadoMutation.mutate({ id: selectedCanasto.id, estado: nuevoEstado });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const canastos = gridData?.canastos || [];
  const resumen = gridData?.resumen || {
    disponible: 0,
    en_uso: 0,
    mantenimiento: 0,
    fuera_servicio: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Canastos de Producción</h1>
          <p className="text-gray-500 text-sm mt-1">
            50 canastos disponibles para el proceso de lavado
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Disponibles</p>
                <p className="text-2xl font-bold text-green-600">{resumen.disponible}</p>
              </div>
              <Package className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">En Uso</p>
                <p className="text-2xl font-bold text-amber-600">{resumen.en_uso}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Mantenimiento</p>
                <p className="text-2xl font-bold text-orange-600">{resumen.mantenimiento}</p>
              </div>
              <Info className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Fuera de Servicio</p>
                <p className="text-2xl font-bold text-red-600">{resumen.fuera_servicio}</p>
              </div>
              <Info className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid de Canastos */}
      <Card>
        <CardHeader>
          <CardTitle>Grid de Canastos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-10 gap-3">
            {canastos.map((canasto) => (
              <div
                key={canasto.id}
                onClick={() => handleCanastoClick(canasto)}
                className={cn(
                  'relative p-3 rounded-lg border-2 cursor-pointer transition-all',
                  'flex flex-col items-center justify-center min-h-[100px]',
                  getEstadoBgColor(canasto.estado as EstadoCanasto)
                )}
              >
                {/* Número del canasto */}
                <span className="text-2xl font-bold text-gray-800">{canasto.numero}</span>
                <span className="text-xs text-gray-600">{canasto.codigo}</span>

                {/* Info si está en uso */}
                {canasto.estado === 'en_uso' && canasto.lote_numero && (
                  <div className="mt-1 text-center">
                    <span className="text-[10px] font-medium text-amber-800 block truncate max-w-full">
                      {canasto.lote_numero}
                    </span>
                    {canasto.tiempo_en_uso_minutos !== undefined && (
                      <span className="text-[10px] text-amber-700">
                        {formatMinutos(canasto.tiempo_en_uso_minutos)}
                      </span>
                    )}
                  </div>
                )}

                {/* Badge de estado */}
                {canasto.estado !== 'disponible' && canasto.estado !== 'en_uso' && (
                  <Badge
                    variant="outline"
                    className="absolute -top-2 -right-2 text-[8px] px-1"
                    style={{ backgroundColor: getEstadoColor(canasto.estado as EstadoCanasto) }}
                  >
                    {canasto.estado === 'mantenimiento' ? 'MANT' : 'F/S'}
                  </Badge>
                )}
              </div>
            ))}
          </div>

          {/* Leyenda */}
          <div className="mt-6 flex gap-6 justify-center">
            {ESTADOS_CANASTO.map((estado) => (
              <div key={estado.value} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: estado.color }}
                />
                <span className="text-sm text-gray-600">{estado.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalle */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Canasto {selectedCanasto?.codigo} - #{selectedCanasto?.numero}
            </DialogTitle>
          </DialogHeader>

          {selectedCanasto && (
            <div className="space-y-4">
              {/* Estado actual */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Estado:</span>
                <Badge style={{ backgroundColor: getEstadoColor(selectedCanasto.estado as EstadoCanasto) }}>
                  {ESTADOS_CANASTO.find((e) => e.value === selectedCanasto.estado)?.label}
                </Badge>
              </div>

              {/* Info del lote si está en uso */}
              {selectedCanasto.estado === 'en_uso' && selectedCanasto.lote_numero && (
                <Card className="bg-amber-50">
                  <CardContent className="pt-4">
                    <p className="text-sm font-medium">Asignado a:</p>
                    <p className="text-lg font-bold">{selectedCanasto.lote_numero}</p>
                    {selectedCanasto.cliente_nombre && (
                      <p className="text-sm text-gray-600">{selectedCanasto.cliente_nombre}</p>
                    )}
                    {selectedCanasto.etapa_actual && (
                      <p className="text-sm text-gray-500">Etapa: {selectedCanasto.etapa_actual}</p>
                    )}
                    {selectedCanasto.tiempo_en_uso_minutos !== undefined && (
                      <p className="text-sm text-amber-700 mt-2">
                        <Clock className="inline h-3 w-3 mr-1" />
                        En uso: {formatMinutos(selectedCanasto.tiempo_en_uso_minutos)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Historial reciente */}
              {historial && historial.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Historial reciente:</p>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {historial.slice(0, 5).map((h) => (
                      <div key={h.id} className="text-xs p-2 bg-gray-50 rounded">
                        <span className="font-medium">{h.etapa_nombre}</span>
                        <span className="text-gray-500 ml-2">
                          {new Date(h.fecha_asignacion).toLocaleDateString('es-AR')}
                        </span>
                        <span className="text-gray-400 ml-2">
                          ({formatMinutos(h.duracion_minutos)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-2 pt-4 border-t">
                {selectedCanasto.estado !== 'en_uso' && (
                  <Button onClick={handleCambiarEstado} className="flex-1">
                    Cambiar Estado
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Cambiar Estado */}
      <Dialog open={showEstadoModal} onOpenChange={setShowEstadoModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar Estado - {selectedCanasto?.codigo}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nuevo Estado</Label>
              <Select value={nuevoEstado} onValueChange={(v) => setNuevoEstado(v as EstadoCanasto)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_CANASTO.filter((e) => e.value !== 'en_uso').map((estado) => (
                    <SelectItem key={estado.value} value={estado.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: estado.color }}
                        />
                        {estado.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                El estado "En Uso" se asigna automáticamente al asignar a un lote.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={confirmarCambioEstado}
                disabled={cambiarEstadoMutation.isPending}
                className="flex-1"
              >
                {cambiarEstadoMutation.isPending ? 'Guardando...' : 'Confirmar'}
              </Button>
              <Button variant="outline" onClick={() => setShowEstadoModal(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
