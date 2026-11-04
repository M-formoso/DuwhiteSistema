/**
 * InputMoneda — input de monto con formato argentino en vivo.
 *
 * Muestra "$ 1.500.000,25" mientras el usuario tipea (separador de miles
 * punto, decimal coma, signo $ como prefijo). Hacia afuera expone el
 * valor como number (o null si está vacío) para que el form del padre
 * siga trabajando con números sin tener que parsear el string.
 *
 * Diseño clave: el cursor se preserva en la misma posición "lógica"
 * (contado por dígitos) aunque el formato re-inserte/quite separadores
 * mientras tipeás. Antes el input re-renderizaba y el caret saltaba al
 * final; ahora si tenés "1.234|" y escribís un 5 → "12.345|", no
 * "12345|5" ni "|12.345".
 */

import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
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

/** Cuenta cuántos caracteres "de dígito o coma" (no separadores) hay a la
 * izquierda de `offset` en `s`. Nos sirve para preservar la posición
 * del caret: lo que al usuario le importa es "cuántos dígitos tipeados
 * tengo a la izquierda", no la posición absoluta en el string. */
function digitosHastaOffset(s: string, offset: number): number {
  let n = 0;
  for (let i = 0; i < Math.min(offset, s.length); i++) {
    const c = s[i];
    if ((c >= '0' && c <= '9') || c === ',') n++;
  }
  return n;
}

/** Inversa: dado "1.234.567,89" y `digitos=5`, devuelve la posición del
 * string justo después del 5to dígito/coma (saltea separadores). */
function offsetDesdeDigitos(s: string, digitos: number): number {
  if (digitos <= 0) return 0;
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ((c >= '0' && c <= '9') || c === ',') {
      count++;
      if (count === digitos) return i + 1;
    }
  }
  return s.length;
}

/**
 * Convierte "1.500.000,25" (o "1500000.25", "1500000", etc) a 1500000.25.
 * Devuelve null si el string queda vacío. Si el string es inválido, null.
 */
function parsearMoneda(raw: string): number | null {
  const limpio = raw.replace(/[^\d.,-]/g, '');
  if (!limpio) return null;
  let enDotNotation = limpio;
  if (limpio.includes(',')) {
    enDotNotation = limpio.replace(/\./g, '').replace(',', '.');
  } else {
    enDotNotation = limpio.replace(/\./g, '');
  }
  const n = parseFloat(enDotNotation);
  return Number.isNaN(n) ? null : n;
}

export const InputMoneda = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, soloEnteros = false, className, placeholder, ...rest }, ref) => {
    const internalRef = useRef<HTMLInputElement | null>(null);
    // Posición "lógica" del caret que queremos restaurar tras cada render
    // (contada en dígitos desde el inicio, ignorando los separadores).
    const caretDigitRef = useRef<number | null>(null);

    // El valor que se muestra en el input se controla por un estado local
    // para evitar que el formateador rompa "1.234," cuando el usuario
    // escribió el separador decimal pero todavía no tipeó los centavos.
    // Al blur sincronizamos todo con el formato canónico.
    const [display, setDisplay] = useState<string>(() =>
      value === null || value === undefined || !Number.isFinite(value)
        ? ''
        : formatearMoneda(value, soloEnteros),
    );

    // Si el valor externo cambia (reset del form, etc), actualizamos el
    // display al formato canónico. Lo hacemos solo si el valor numérico
    // efectivamente cambió, para no pelear con el tipeo del usuario.
    const lastExternalValue = useRef<number | null | undefined>(value);
    if (lastExternalValue.current !== value) {
      lastExternalValue.current = value;
      const nuevoDisplay =
        value === null || value === undefined || !Number.isFinite(value)
          ? ''
          : formatearMoneda(value, soloEnteros);
      // Solo pisamos el display si el valor parseado actual NO coincide
      // con el externo. Así, mientras el usuario tipea "1.234" no lo
      // reformateamos ante cada onChange (que re-triggerea el hook).
      if (parsearMoneda(display) !== value) {
        setDisplay(nuevoDisplay);
      }
    }

    // Después de cada render, si onChange cambió el display, reposicionamos
    // el caret donde "debería estar" según los dígitos tipeados antes del
    // cambio. useLayoutEffect para evitar un flash visual.
    useLayoutEffect(() => {
      if (caretDigitRef.current == null) return;
      const el = internalRef.current;
      if (!el || el !== document.activeElement) {
        caretDigitRef.current = null;
        return;
      }
      const pos = offsetDesdeDigitos(display, caretDigitRef.current);
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        /* algunos tipos de input no soportan setSelectionRange */
      }
      caretDigitRef.current = null;
    }, [display]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const caretRaw = e.target.selectionStart ?? raw.length;
      // Guardamos cuántos dígitos había a la izquierda del caret ANTES
      // del reformato, para restaurar la posición después.
      caretDigitRef.current = digitosHastaOffset(raw, caretRaw);

      // Parseo para informar al padre (valor numérico real).
      const parsed = parsearMoneda(raw);
      onChange(parsed);

      // El display es el string crudo del usuario, mínimamente saneado:
      // solo dígitos, coma, punto. Evitamos reformatear en cada tecla
      // (eso mataría el "1.234," del usuario escribiendo centavos). El
      // reformateo canónico lo hacemos en handleBlur.
      const soloValidos = raw.replace(/[^\d.,-]/g, '');
      // Pero sí formateamos la parte entera para ir metiendo puntos de
      // miles mientras tipea (lo que el usuario pidió: "que se vaya
      // acomodando"). Dejamos intacto todo lo que esté después de la coma.
      const [intPart = '', decPart] = soloValidos.replace(/\./g, '').split(',');
      const intFormateado =
        intPart === ''
          ? ''
          : new Intl.NumberFormat('es-AR').format(
              parseInt(intPart.replace(/\D/g, ''), 10) || 0,
            );
      const nuevoDisplay =
        decPart !== undefined ? `${intFormateado},${decPart}` : intFormateado;
      setDisplay(nuevoDisplay);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Al perder foco, canonizamos: "1234," → "1.234,00".
      const parsed = parsearMoneda(e.target.value);
      if (parsed === null) {
        setDisplay('');
      } else {
        setDisplay(formatearMoneda(parsed, soloEnteros));
      }
      caretDigitRef.current = null;
      rest.onBlur?.(e);
    };

    return (
      <div className="relative">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
          aria-hidden
        >
          $
        </span>
        <Input
          ref={(el) => {
            internalRef.current = el;
            if (typeof ref === 'function') ref(el);
            else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
          }}
          type="text"
          inputMode="decimal"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder ?? '0,00'}
          className={cn('pl-7 text-right font-mono', className)}
          {...rest}
        />
      </div>
    );
  },
);
InputMoneda.displayName = 'InputMoneda';
