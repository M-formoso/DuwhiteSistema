/**
 * Banner con el estado de la integración con ARCA / AFIP.
 * Permite ver de un vistazo si el módulo está listo para emitir.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, RefreshCw, Loader2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { facturaService } from '@/services/facturaService';
import { EstadoArcaSemaforo } from '@/types/factura';

const SEMAFORO_CLASS: Record<EstadoArcaSemaforo, string> = {
  verde: 'border-green-300 bg-green-50',
  amarillo: 'border-amber-300 bg-amber-50',
  rojo: 'border-red-300 bg-red-50',
};

const SEMAFORO_TEXT: Record<EstadoArcaSemaforo, string> = {
  verde: 'text-green-800',
  amarillo: 'text-amber-800',
  rojo: 'text-red-800',
};

const SEMAFORO_ICON: Record<EstadoArcaSemaforo, JSX.Element> = {
  verde: <CheckCircle2 className="w-5 h-5 text-green-600" />,
  amarillo: <AlertTriangle className="w-5 h-5 text-amber-600" />,
  rojo: <XCircle className="w-5 h-5 text-red-600" />,
};

const SEMAFORO_LABEL: Record<EstadoArcaSemaforo, string> = {
  verde: 'Listo para emitir',
  amarillo: 'Operativo con avisos',
  rojo: 'Configuración incompleta',
};

export default function EstadoArcaBanner() {
  const [expandido, setExpandido] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['estado-arca'],
    queryFn: () => facturaService.estadoArca(),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-3 px-4 flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
          Verificando estado de ARCA…
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const fallandoCriticos = data.checks.filter((c) => c.critico && !c.ok);
  const avisos = data.checks.filter((c) => !c.critico && !c.ok);

  return (
    <Card className={SEMAFORO_CLASS[data.estado] + ' border-2'}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          {SEMAFORO_ICON[data.estado]}
          <div className="flex-1 min-w-0">
            <div className={'font-semibold ' + SEMAFORO_TEXT[data.estado]}>
              ARCA — {SEMAFORO_LABEL[data.estado]}
              <span className="ml-2 text-xs font-normal text-text-secondary">
                · {data.entorno} · PV {data.punto_venta} · CUIT {data.cuit_empresa}
              </span>
            </div>
            <div className="text-sm text-text-primary">{data.resumen}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            title="Re-evaluar"
            disabled={isFetching}
          >
            <RefreshCw className={'w-4 h-4 ' + (isFetching ? 'animate-spin' : '')} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpandido((v) => !v)}
          >
            {expandido ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" /> Ocultar
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" /> Detalle
                {(fallandoCriticos.length + avisos.length) > 0 && (
                  <span className="ml-1 text-xs text-text-secondary">
                    ({fallandoCriticos.length + avisos.length})
                  </span>
                )}
              </>
            )}
          </Button>
        </div>

        {expandido && (
          <div className="mt-3 pt-3 border-t border-current/20 space-y-2">
            {data.checks.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-sm">
                {c.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                ) : c.critico ? (
                  <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text-primary">{c.titulo}</div>
                  <div className="text-xs text-text-secondary break-words">{c.detalle}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
