/**
 * Utilidades para mostrar y loguear errores de la API de forma consistente.
 *
 * Convención del backend (FastAPI):
 *   { "detail": "mensaje" }                     ← HTTPException
 *   { "detail": "loc: msg; ...", "errors": [{loc, msg, type, input}] }
 *                                               ← RequestValidationError (main.py)
 *
 * Uso típico en un onError de mutation:
 *   onError: (err) => toastApiError(toast, err, 'No se pudo registrar la cobranza.')
 */

import axios, { AxiosError } from 'axios';
import type { toast as toastFn } from '@/components/ui/use-toast';

type ToastFn = typeof toastFn;

interface ApiErrorBody {
  detail?: string;
  errors?: Array<{
    loc?: (string | number)[];
    msg?: string;
    type?: string;
    input?: unknown;
  }>;
}

/**
 * Extrae el mensaje más útil posible de un error de API.
 * Prioriza `detail` del backend, luego el mensaje de axios/JS.
 */
export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<ApiErrorBody>;
    const body = ax.response?.data;
    if (body?.detail && typeof body.detail === 'string') {
      return body.detail;
    }
    if (body?.errors?.length) {
      return body.errors
        .map((e) => `${(e.loc ?? []).join(' → ')}: ${e.msg ?? ''}`.trim())
        .join('; ');
    }
    if (ax.message) return ax.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

/**
 * Muestra un toast destructivo con el mensaje real del error del backend
 * y loguea el detalle completo en consola para debugging.
 *
 * @param toast   Función `toast` del hook useToast (o el `toast` importado)
 * @param error   Error atrapado (típicamente en onError de una mutation)
 * @param fallback Mensaje a mostrar si no se puede extraer nada del error
 * @param titulo  Título del toast (default: 'Error')
 */
export function toastApiError(
  toast: ToastFn,
  error: unknown,
  fallback: string,
  titulo: string = 'Error',
): void {
  const description = extractApiErrorMessage(error, fallback);

  // Log completo en consola para debugging (status, url, body).
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<ApiErrorBody>;
    // eslint-disable-next-line no-console
    console.error('[API Error]', {
      status: ax.response?.status,
      url: ax.config?.url,
      method: ax.config?.method,
      data: ax.response?.data,
    });
  } else {
    // eslint-disable-next-line no-console
    console.error('[Error]', error);
  }

  toast({
    title: titulo,
    description,
    variant: 'destructive',
  });
}
