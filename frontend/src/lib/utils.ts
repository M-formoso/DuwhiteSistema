import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases de Tailwind de forma segura
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea una fecha ISO string a formato argentino (DD/MM/YYYY)
 * sin problemas de timezone
 */
export function formatDateAR(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  // Tomar solo la parte de la fecha (YYYY-MM-DD) para evitar problemas de timezone
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-AR');
}

/**
 * Formatea fecha y hora a formato argentino
 */
export function formatDateTimeAR(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
