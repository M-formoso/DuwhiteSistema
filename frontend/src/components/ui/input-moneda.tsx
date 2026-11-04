/**
 * InputMoneda — input de monto con formato argentino en vivo.
 *
 * Muestra "$ 1.500.000,25" mientras el usuario tipea (separador de miles
 * punto, decimal coma, signo $ como prefijo). Hacia afuera expone el
 * valor como number (o null si está vacío) para que el form del padre
 * siga trabajando con números sin tener que parsear el string.
 */

import { forwardRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  /** Mostrar solo enteros (sin ,xx). Default false. */
  soloEnteros?: boolean;
}

/** Formatea un number (ej 1500000.25) a "1.500.000,25". */
function formatearMoneda(n: number, soloEnteros: boolean): string {
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: soloEnteros ? 0 : 2,
    maximumFractionDigits: soloEnteros ? 0 : 2,
  }).format(n);
}

/**
 * Convierte "1.500.000,25" (o "1500000.25", "1500000", etc) a 1500000.25.
 * Devuelve null si el string queda vacío. Si el string es inválido, NaN.
 */
function parsearMoneda(raw: string): number | null {
  // Limpiamos: dejamos solo dígitos, comas y puntos. También aceptamos
  // que el usuario pegue "$ 1.500,25" borrando el "$" y el espacio.
  const limpio = raw.replace(/[^\d.,-]/g, '');
  if (!limpio) return null;

  // Heurística para decidir qué es separador de miles y qué es decimal:
  // si tiene coma, la coma es siempre decimal (formato AR). Los puntos
  // se tratan como separadores de miles y se ignoran.
  // Si no tiene coma pero tiene punto(s), lo tomamos como separador de
  // miles también (para que pegar "1.500.000" funcione).
  let enDotNotation = limpio;
  if (limpio.includes(',')) {
    // formato AR: punto=miles (quitar), coma=decimal (convertir a punto)
    enDotNotation = limpio.replace(/\./g, '').replace(',', '.');
  } else {
    // sin coma: los puntos son miles → quitar
    enDotNotation = limpio.replace(/\./g, '');
  }
  const n = parseFloat(enDotNotation);
  return Number.isNaN(n) ? null : n;
}

export const InputMoneda = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, soloEnteros = false, className, placeholder, ...rest }, ref) => {
    // El string mostrado se recalcula del number cada render. Durante el
    // tipeo, onChange actualiza el number del padre y el string refleja
    // ese valor formateado.
    const display = useMemo(() => {
      if (value === null || value === undefined || !Number.isFinite(value)) return '';
      return formatearMoneda(value, soloEnteros);
    }, [value, soloEnteros]);

    return (
      <div className="relative">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
          aria-hidden
        >
          $
        </span>
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={display}
          onChange={(e) => onChange(parsearMoneda(e.target.value))}
          placeholder={placeholder ?? '0,00'}
          className={cn('pl-7 text-right font-mono', className)}
          {...rest}
        />
      </div>
    );
  },
);
InputMoneda.displayName = 'InputMoneda';
