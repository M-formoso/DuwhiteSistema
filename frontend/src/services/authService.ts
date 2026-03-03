/**
 * Servicio de autenticación
 */

import api from './api';
import type { LoginRequest, LoginResponse, Usuario, CambiarPasswordRequest } from '@/types/auth';

export const authService = {
  /**
   * Inicia sesión con email y contraseña
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', data);
    return response.data;
  },

  /**
   * Cierra sesión
   */
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      // Limpiar tokens aunque falle la petición
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  },

  /**
   * Obtiene el usuario actual
   */
  async getCurrentUser(): Promise<Usuario> {
    const response = await api.get<Usuario>('/auth/me');
    return response.data;
  },

  /**
   * Cambia la contraseña del usuario actual
   */
  async changePassword(data: CambiarPasswordRequest): Promise<void> {
    await api.put('/auth/change-password', data);
  },

  /**
   * Refresca el token de acceso
   */
  async refreshToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    const response = await api.post('/auth/refresh', { refresh_token: refreshToken });
    return response.data;
  },

  /**
   * Guarda los tokens en localStorage
   */
  saveTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  },

  /**
   * Obtiene el token de acceso
   */
  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  },

  /**
   * Verifica si hay un token de acceso
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token');
  },
};
