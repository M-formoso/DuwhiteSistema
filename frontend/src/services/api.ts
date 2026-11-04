/**
 * Configuración base de Axios para llamadas a la API
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// URL base de la API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Crear instancia de Axios
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autenticación
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Usar sessionStorage (cada pestaña tiene su propia sesión)
    const token = sessionStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores y refresh token.
// Dos fixes importantes respecto a la versión anterior:
// 1. Marcamos el request con _retry para evitar loop infinito si el reintento
//    también devuelve 401 (antes podía dar vueltas hasta timeout y mostrar
//    "Network Error" vacío al usuario).
// 2. Si el refresh falla, ANTES del redirect a /login mostramos el error
//    con mensaje claro para que el usuario entienda qué pasó.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    const esAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh');

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !esAuthEndpoint &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      const refreshToken = sessionStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token, refresh_token } = response.data;
          sessionStorage.setItem('access_token', access_token);
          sessionStorage.setItem('refresh_token', refresh_token);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
          }
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh fallido → sesión muerta. Limpiamos, avisamos, redirigimos.
          sessionStorage.removeItem('access_token');
          sessionStorage.removeItem('refresh_token');
          const msg = 'Tu sesión expiró. Redirigiendo al login...';
          // Pequeña espera para que el usuario lea el mensaje antes del reload.
          if (typeof window !== 'undefined') {
            setTimeout(() => {
              window.location.href = '/login';
            }, 1200);
          }
          const err = new Error(msg);
          return Promise.reject(err);
        }
      } else {
        // No hay refresh token: idem.
        const msg = 'No hay sesión activa. Redirigiendo al login...';
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            window.location.href = '/login';
          }, 1200);
        }
        return Promise.reject(new Error(msg));
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// Helper para extraer mensaje de error
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail: string; errors?: unknown[] }>;
    // Log completo del error para debugging
    console.error('API Error Response:', axiosError.response?.data);
    console.error('API Error Status:', axiosError.response?.status);
    return axiosError.response?.data?.detail || axiosError.message || 'Error desconocido';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Error desconocido';
}
