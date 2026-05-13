/**
 * Timeline de auditoría de un lote: muestra cada cambio (inicio/fin de etapa,
 * cambios de estado del lote) con usuario, hora y detalle.
 */

import { useQuery } from '@tanstack/react-query';
import { History, User, Clock, Package, Loader2 } from 'lucide-react';

import api from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface HistorialEvento {
  id: string;
  fecha: string;
  accion: string;
  entidad_tipo: string;
  entidad_id: string | null;
  usuario_id: string;
  usuario_nombre: string;
  datos: Record<string, any>;
}

interface Props {
  loteId: string;
}

const ACCION_LABEL: Record<string, string> = {
  iniciar_etapa: 'Inicio etapa',
  finalizar_etapa: 'Fin etapa',
  crear: 'Creación',
  cambiar_estado: 'Cambio de estado',
};

const ACCION_COLOR: Record<string, string> = {
  iniciar_etapa: 'bg-blue-100 text-blue-700',
  finalizar_etapa: 'bg-green-100 text-green-700',
  crear: 'bg-purple-100 text-purple-700',
  cambiar_estado: 'bg-yellow-100 text-yellow-700',
};

function formatearFecha(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function LoteHistorialPanel({ loteId }: Props) {
  const { data: eventos, isLoading } = useQuery<HistorialEvento[]>({
    queryKey: ['lote-historial', loteId],
    queryFn: async () => (await api.get(`/produccion/lotes/${loteId}/historial`)).data,
    enabled: Boolean(loteId),
    refetchOnMount: true,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historial completo
          {eventos && <Badge variant="outline" className="ml-2">{eventos.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-text-secondary">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Cargando historial…
          </div>
        ) : !eventos || eventos.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-6">
            No hay eventos registrados todavía. Las acciones de los operarios se irán acumulando acá.
          </p>
        ) : (
          <div className="relative pl-6 border-l-2 border-gray-200 space-y-4">
            {eventos.map((e) => (
              <div key={e.id} className="relative">
                <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-primary border-4 border-white" />
                <div className="flex flex-wrap items-baseline gap-2 mb-1">
                  <Badge className={ACCION_COLOR[e.accion] || 'bg-gray-100 text-gray-700'}>
                    {ACCION_LABEL[e.accion] || e.accion}
                  </Badge>
                  {e.datos.etapa_nombre && (
                    <span className="font-medium">{e.datos.etapa_nombre}</span>
                  )}
                  <span className="text-xs text-text-secondary flex items-center gap-1 ml-auto">
                    <Clock className="h-3 w-3" />
                    {formatearFecha(e.fecha)}
                  </span>
                </div>
                <div className="text-sm text-text-secondary flex items-center gap-1 mb-1">
                  <User className="h-3 w-3" />
                  <span className="font-medium">{e.usuario_nombre}</span>
                </div>
                <div className="text-xs space-y-0.5 text-text-secondary">
                  {e.datos.peso_kg !== null && e.datos.peso_kg !== undefined && (
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      Peso: <span className="font-mono">{e.datos.peso_kg} kg</span>
                    </div>
                  )}
                  {e.datos.maquinas_ids && e.datos.maquinas_ids.length > 0 && (
                    <div>Máquinas: {e.datos.maquinas_ids.length}</div>
                  )}
                  {e.datos.responsable_id && (
                    <div>Responsable id: <span className="font-mono">{String(e.datos.responsable_id).slice(0, 8)}…</span></div>
                  )}
                  {e.datos.observaciones && (
                    <div className="bg-gray-50 rounded p-2 mt-1 italic">
                      "{e.datos.observaciones}"
                    </div>
                  )}
                  {e.datos.estado && (
                    <div>Estado: <span className="font-mono">{e.datos.estado}</span></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
