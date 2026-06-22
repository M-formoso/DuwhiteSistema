/**
 * Página de Gestión de Canastos
 * Grid visual de 50 canastos con estado en tiempo real
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Info, Clock, Package, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [showAgregarModal, setShowAgregarModal] = useState(false);
  const [cantidadAgregar, setCantidadAgregar] = useState<string>('1');
  const [busqueda, setBusqueda] = useState('');

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

  // Mutation: Crear canastos en bulk
  const crearBulkMutation = useMutation({
    mutationFn: (cantidad: number) => canastoService.crearBulk(cantidad),
    onSuccess: (data) => {
      toast.success(`${data.creados} canasto(s) creado(s)`);
      queryClient.invalidateQueries({ queryKey: ['canastos-grid'] });
      setShowAgregarModal(false);
      setCantidadAgregar('1');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al crear canastos');
    },
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
  const canastosFiltrados = busqueda.trim()
    ? canastos.filter((c) =>
        c.numero.toString().includes(busqueda.trim()) ||
        c.codigo.toLowerCase().includes(busqueda.trim().toLowerCase())
      )
    : canastos;
  const resumen = gridData?.resumen || {
    disponible: 0,
    en_uso: 0,
    mantenimiento: 0,
    fuera_servicio: 0,
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Canastos de Producción</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            50 canastos disponibles para el proceso de lavado
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={() => setShowAgregarModal(true)} className="flex-1 sm:flex-initial">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Canastos
          </Button>
          <Button variant="outline" onClick={() => refetch()} className="flex-1 sm:flex-initial">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CardTitle className="flex-1">Grid de Canastos</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por número o código..."
                className="pl-9 pr-8"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          {busqueda && (
            <p className="text-sm text-gray-500 mt-1">
              {canastosFiltrados.length === 0
                ? 'No se encontraron canastos'
                : `${canastosFiltrados.length} canasto${canastosFiltrados.length !== 1 ? 's' : ''} encontrado${canastosFiltrados.length !== 1 ? 's' : ''}`}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 sm:gap-3">
            {canastosFiltrados.map((canasto) => (
              <div
                key={canasto.id}
                onClick={() => handleCanastoClick(canasto)}
                className={cn(
                  'relative p-2 sm:p-3 rounded-lg border-2 cursor-pointer transition-all',
                  'flex flex-col items-center justify-center min-h-[80px] sm:min-h-[100px]',
                  getEstadoBgColor(canasto.estado as EstadoCanasto)
                )}
              >
                {/* Número del canasto */}
                <span className="text-xl sm:text-2xl font-bold text-gray-800">{canasto.numero}</span>
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

      {/* Modal Agregar Canastos */}
      <Dialog open={showAgregarModal} onOpenChange={setShowAgregarModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Agregar canastos</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cantidad-agregar">¿Cuántos canastos querés agregar?</Label>
              <Input
                id="cantidad-agregar"
                type="number"
                min={1}
                max={200}
                value={cantidadAgregar}
                onChange={(e) => setCantidadAgregar(e.target.value)}
                placeholder="Ej: 10"
              />
              <p className="text-xs text-gray-500">
                Se crean con numeración consecutiva a partir del último canasto existente.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const n = parseInt(cantidadAgregar, 10);
                  if (!Number.isFinite(n) || n < 1) {
                    toast.error('Ingresá una cantidad válida');
                    return;
                  }
                  crearBulkMutation.mutate(n);
                }}
                disabled={crearBulkMutation.isPending}
                className="flex-1"
              >
                {crearBulkMutation.isPending ? 'Creando...' : 'Crear'}
              </Button>
              <Button variant="outline" onClick={() => setShowAgregarModal(false)}>
                Cancelar
              </Button>
            </div>
          </div>
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
