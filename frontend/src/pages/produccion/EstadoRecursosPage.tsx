/**
 * Página de Estado de Recursos (Canastos y Máquinas)
 * Muestra en tiempo real qué recursos están en uso y cuáles disponibles
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Settings2,
  RefreshCw,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Package,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { canastoService } from '@/services/canastoService';
import { produccionService } from '@/services/produccionService';

// Colores por estado
const ESTADO_COLORS: Record<string, string> = {
  disponible: 'bg-green-100 text-green-700 border-green-300',
  en_uso: 'bg-blue-100 text-blue-700 border-blue-300',
  mantenimiento: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  fuera_servicio: 'bg-red-100 text-red-700 border-red-300',
};

const ESTADO_LABELS: Record<string, string> = {
  disponible: 'Disponible',
  en_uso: 'En Uso',
  mantenimiento: 'Mantenimiento',
  fuera_servicio: 'Fuera de Servicio',
};

interface CanastoGrid {
  id: string;
  numero: number;
  codigo: string;
  estado: string;
  lote_actual?: {
    id: string;
    numero: string;
    cliente_nombre?: string;
  } | null;
}

interface MaquinaEstado {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  estado: string;
  capacidad_kg: number | null;
  lote_en_uso?: {
    id: string;
    numero: string;
    etapa_nombre?: string;
  } | null;
}

export default function EstadoRecursosPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('canastos');

  // Cargar canastos con su estado
  const { data: canastosData, isLoading: loadingCanastos, refetch: refetchCanastos } = useQuery({
    queryKey: ['canastos-grid'],
    queryFn: () => canastoService.getGrid(),
    refetchInterval: 10000, // Refrescar cada 10 segundos
  });

  // Cargar máquinas
  const { data: maquinas = [], isLoading: loadingMaquinas, refetch: refetchMaquinas } = useQuery<MaquinaEstado[]>({
    queryKey: ['maquinas-estado'],
    queryFn: async () => {
      const maquinasData = await produccionService.getMaquinas();
      // Para cada máquina en uso, obtener info del lote
      const maquinasConLote = await Promise.all(
        maquinasData.map(async (m) => {
          if (m.estado === 'en_uso') {
            try {
              const enUso = await produccionService.verificarMaquinaEnUso(m.id);
              if (enUso.en_uso) {
                return {
                  ...m,
                  lote_en_uso: {
                    id: enUso.lote_id || '',
                    numero: enUso.lote_numero || '',
                  },
                };
              }
            } catch {
              // Ignorar errores
            }
          }
          return { ...m, lote_en_uso: null };
        })
      );
      return maquinasConLote;
    },
    refetchInterval: 10000,
  });

  const refetchAll = () => {
    refetchCanastos();
    refetchMaquinas();
  };

  // Procesar canastos del grid
  const canastos: CanastoGrid[] = canastosData?.canastos || [];

  // Estadísticas de canastos
  const canastosDisponibles = canastos.filter(c => c.estado === 'disponible').length;
  const canastosEnUso = canastos.filter(c => c.estado === 'en_uso').length;
  const canastosMantenimiento = canastos.filter(c => c.estado === 'mantenimiento').length;
  const canastosFueraServicio = canastos.filter(c => c.estado === 'fuera_servicio').length;

  // Estadísticas de máquinas
  const maquinasDisponibles = maquinas.filter(m => m.estado === 'disponible').length;
  const maquinasEnUso = maquinas.filter(m => m.estado === 'en_uso').length;
  const maquinasMantenimiento = maquinas.filter(m => m.estado === 'mantenimiento').length;

  const isLoading = loadingCanastos || loadingMaquinas;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/produccion')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Estado de Recursos</h1>
            <p className="text-gray-500">Canastos y Máquinas en tiempo real</p>
          </div>
        </div>
        <Button onClick={refetchAll} variant="outline" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Canastos Disponibles</p>
                <p className="text-3xl font-bold text-green-600">{canastosDisponibles}</p>
              </div>
              <Box className="h-10 w-10 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Canastos En Uso</p>
                <p className="text-3xl font-bold text-blue-600">{canastosEnUso}</p>
              </div>
              <Box className="h-10 w-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Máquinas Disponibles</p>
                <p className="text-3xl font-bold text-green-600">{maquinasDisponibles}</p>
              </div>
              <Settings2 className="h-10 w-10 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Máquinas En Uso</p>
                <p className="text-3xl font-bold text-blue-600">{maquinasEnUso}</p>
              </div>
              <Settings2 className="h-10 w-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="canastos" className="flex items-center gap-2">
            <Box className="h-4 w-4" />
            Canastos ({canastos.length})
          </TabsTrigger>
          <TabsTrigger value="maquinas" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Máquinas ({maquinas.length})
          </TabsTrigger>
        </TabsList>

        {/* Canastos Tab */}
        <TabsContent value="canastos" className="mt-4">
          {loadingCanastos ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Leyenda */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500" />
                  <span className="text-sm">Disponible ({canastosDisponibles})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-500" />
                  <span className="text-sm">En Uso ({canastosEnUso})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-500" />
                  <span className="text-sm">Mantenimiento ({canastosMantenimiento})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500" />
                  <span className="text-sm">Fuera de Servicio ({canastosFueraServicio})</span>
                </div>
              </div>

              {/* Grid de canastos */}
              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                {canastos.map((canasto) => (
                  <div
                    key={canasto.id}
                    className={`
                      relative p-3 rounded-lg border-2 text-center cursor-pointer
                      transition-all hover:scale-105 hover:shadow-md
                      ${canasto.estado === 'disponible' ? 'bg-green-50 border-green-400 text-green-700' : ''}
                      ${canasto.estado === 'en_uso' ? 'bg-blue-50 border-blue-400 text-blue-700' : ''}
                      ${canasto.estado === 'mantenimiento' ? 'bg-yellow-50 border-yellow-400 text-yellow-700' : ''}
                      ${canasto.estado === 'fuera_servicio' ? 'bg-red-50 border-red-400 text-red-700' : ''}
                    `}
                    title={
                      canasto.lote_actual
                        ? `Lote: ${canasto.lote_actual.numero}${canasto.lote_actual.cliente_nombre ? ` - ${canasto.lote_actual.cliente_nombre}` : ''}`
                        : ESTADO_LABELS[canasto.estado] || canasto.estado
                    }
                  >
                    <span className="font-bold text-lg">#{canasto.numero}</span>
                    {canasto.lote_actual && (
                      <div className="text-[10px] truncate mt-1 font-medium">
                        {canasto.lote_actual.numero}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Lista de canastos en uso */}
              {canastosEnUso > 0 && (
                <Card className="mt-6">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="h-5 w-5 text-blue-500" />
                      Canastos En Uso ({canastosEnUso})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="divide-y">
                      {canastos
                        .filter(c => c.estado === 'en_uso' && c.lote_actual)
                        .map((canasto) => (
                          <div
                            key={canasto.id}
                            className="py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer rounded px-2"
                            onClick={() => canasto.lote_actual && navigate(`/produccion/lotes/${canasto.lote_actual.id}`)}
                          >
                            <div className="flex items-center gap-3">
                              <Badge className="bg-blue-100 text-blue-700 border-blue-300">
                                #{canasto.numero}
                              </Badge>
                              <span className="text-gray-500">{canasto.codigo}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-medium">
                                {canasto.lote_actual?.numero}
                              </span>
                              {canasto.lote_actual?.cliente_nombre && (
                                <span className="text-sm text-gray-500 ml-2">
                                  ({canasto.lote_actual.cliente_nombre})
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Máquinas Tab */}
        <TabsContent value="maquinas" className="mt-4">
          {loadingMaquinas ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Agrupar por tipo */}
              {['lavadora', 'secadora', 'planchadora', 'centrifuga', 'calandra', 'otro'].map((tipo) => {
                const maquinasTipo = maquinas.filter(m => m.tipo === tipo);
                if (maquinasTipo.length === 0) return null;

                return (
                  <Card key={tipo}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg capitalize flex items-center gap-2">
                        <Settings2 className="h-5 w-5" />
                        {tipo}s ({maquinasTipo.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {maquinasTipo.map((maquina) => (
                          <div
                            key={maquina.id}
                            className={`
                              p-4 rounded-lg border-2 transition-all
                              ${maquina.estado === 'disponible' ? 'bg-green-50 border-green-400' : ''}
                              ${maquina.estado === 'en_uso' ? 'bg-blue-50 border-blue-400' : ''}
                              ${maquina.estado === 'mantenimiento' ? 'bg-yellow-50 border-yellow-400' : ''}
                              ${maquina.estado === 'fuera_servicio' ? 'bg-red-50 border-red-400' : ''}
                            `}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <span className="font-mono font-bold">{maquina.codigo}</span>
                                <p className="text-sm text-gray-600">{maquina.nombre}</p>
                              </div>
                              {maquina.estado === 'disponible' && (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              )}
                              {maquina.estado === 'en_uso' && (
                                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                              )}
                              {maquina.estado === 'mantenimiento' && (
                                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                              )}
                              {maquina.estado === 'fuera_servicio' && (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                            </div>

                            <Badge className={ESTADO_COLORS[maquina.estado] || ''}>
                              {ESTADO_LABELS[maquina.estado] || maquina.estado}
                            </Badge>

                            {maquina.capacidad_kg && (
                              <p className="text-xs text-gray-500 mt-2">
                                Capacidad: {maquina.capacidad_kg} kg
                              </p>
                            )}

                            {maquina.lote_en_uso && (
                              <div
                                className="mt-2 pt-2 border-t border-blue-200 cursor-pointer hover:bg-blue-100 rounded p-1 -m-1"
                                onClick={() => navigate(`/produccion/lotes/${maquina.lote_en_uso!.id}`)}
                              >
                                <p className="text-sm font-medium text-blue-700">
                                  Lote: {maquina.lote_en_uso.numero}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
