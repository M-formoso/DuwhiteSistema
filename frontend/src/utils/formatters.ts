/**
 * Utilidades de formateo para Argentina
 */

/**
 * Formatea un número como moneda argentina
 * @param amount Monto a formatear
 * @returns String formateado (ej: "$ 1.234,56")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formatea un número con separadores argentinos
 * @param num Número a formatear
 * @param decimals Cantidad de decimales (default: 2)
 * @returns String formateado (ej: "1.234,56")
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Formatea una fecha en formato argentino
 * @param date Fecha a formatear
 * @returns String formateado (ej: "15/01/2026")
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Formatea una fecha con hora
 * @param date Fecha a formatear
 * @returns String formateado (ej: "15/01/2026 14:30")
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Formatea un CUIT argentino
 * @param cuit CUIT sin formato (ej: "20123456789")
 * @returns CUIT formateado (ej: "20-12345678-9")
 */
export function formatCuit(cuit: string): string {
  const cleaned = cuit.replace(/\D/g, '');
  if (cleaned.length !== 11) return cuit;
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 10)}-${cleaned.slice(10)}`;
}

/**
 * Formatea un porcentaje
 * @param value Valor decimal (ej: 0.21 para 21%)
 * @returns String formateado (ej: "21%")
 */
export function formatPercent(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formatea kilogramos
 * @param kg Cantidad en kg
 * @returns String formateado (ej: "1.234,5 kg")
 */
export function formatKg(kg: number): string {
  return `${formatNumber(kg, 1)} kg`;
}

/**
 * Obtiene las iniciales de un nombre
 * @param nombre Nombre completo
 * @returns Iniciales (ej: "JP" para "Juan Pérez")
 */
export function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .map((n) => n.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

/**
 * Capitaliza la primera letra
 * @param str String a capitalizar
 * @returns String capitalizado
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
