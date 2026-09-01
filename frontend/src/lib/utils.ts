import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases de Tailwind de forma segura
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea una fecha ISO string a formato argentino (DD/MM/YYYY) manejando
 * timezones correctamente.
 *
 * Comportamiento:
 * - `"2026-09-01"` (DATE puro) → se interpreta como local ARG → 01/09/2026.
 * - `"2026-09-01T00:15:00Z"` (datetime UTC) → se convierte a ARG y se toma la
 *   fecha resultante → 31/08/2026.
 * - `"2026-09-01T00:15:00"` (datetime naive, como serializa Pydantic v2 por
 *   defecto sin timezone): se asume UTC (todos los timestamps del backend lo
 *   son) y se convierte a ARG → 31/08/2026.
 *
 * Este es el patrón que evitó bugs de "un día menos" en el módulo de reportes.
 */
export function formatDateAR(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';

  // Caso 1: string sin 'T' → es DATE puro (YYYY-MM-DD). Sin timezone.
  if (!dateStr.includes('T')) {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return dateStr;
    return new Date(year, month - 1, day).toLocaleDateString('es-AR');
  }

  // Caso 2: datetime. Si no viene con Z u offset, asumir UTC (el backend
  // siempre guarda en UTC via datetime.utcnow()).
  const tieneTz = /Z$|[+-]\d{2}:?\d{2}$/.test(dateStr);
  const iso = tieneTz ? dateStr : dateStr + 'Z';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

/**
 * Formatea fecha y hora a formato argentino con timezone correcto
 * El backend guarda en UTC, así que forzamos la interpretación como UTC
 */
export function formatDateTimeAR(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  // Si el string no tiene indicador de timezone, agregar Z para interpretarlo como UTC
  const str = dateStr.includes('Z') || dateStr.includes('+') || dateStr.includes('-', 10)
    ? dateStr
    : dateStr + 'Z';
  const date = new Date(str);
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}
