/**
 * Panel colapsable con el historial de ajustes manuales a una cuenta.
 *
 * Muestra la lista de veces que alguien editó el saldo a mano — cada una
 * con quién, cuándo, de→a, diff y motivo opcional. No lista los
 * movimientos normales (esos están en la tab Movimientos).
 */

import { useQuery } from '@tanstack/react-query';
import { History, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { finanzasService, type AjusteManualCuenta } from '@/services/finanzasService';
import { formatNumber } from '@/utils/formatters';

interface Props {
  cuentaId: string;
  /** Si está false, no renderiza nada (lo controla el padre con un collapse). */
  abierto: boolean;
}

function formatFecha(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistorialAjustesCuenta({ cuentaId, abierto }: Props) {
  const { data = [], isLoading } = useQuery<AjusteManualCuenta[]>({
    queryKey: ['ajustes-manuales', cuentaId],
    queryFn: () => finanzasService.getAjustesManualesCuenta(cuentaId),
    enabled: abierto,
  });

  if (!abierto) return null;

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
        <History className="h-3.5 w-3.5" />
        Historial de ajustes manuales
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Cargando...
        </div>
      )}

      {!isLoading && data.length === 0 && (
        <p className="text-xs text-muted-foreground italic py-2">
          No hay ajustes manuales. Los cambios de saldo por edición directa
          van a aparecer acá con quién y cuándo.
        </p>
      )}

      {data.length > 0 && (
        <div className="space-y-2">
          {data.map((a) => {
            const esSuma = a.diff >= 0;
            return (
              <div
                key={a.id}
                className="text-xs rounded border bg-white px-3 py-2 flex items-start gap-3"
              >
                <div
                  className={`mt-0.5 rounded-full p-1 ${
                    esSuma ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {esSuma ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">
                      ${formatNumber(a.saldo_anterior, 2)} → ${formatNumber(a.saldo_nuevo, 2)}
                    </span>
                    <span
                      className={`font-semibold ${esSuma ? 'text-green-700' : 'text-red-700'}`}
                    >
                      {esSuma ? '+' : ''}${formatNumber(a.diff, 2)}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {formatFecha(a.fecha)}
                    {a.usuario_nombre && <> · {a.usuario_nombre}</>}
                  </div>
                  {a.motivo && (
                    <div className="mt-1 text-gray-700 italic">"{a.motivo}"</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
