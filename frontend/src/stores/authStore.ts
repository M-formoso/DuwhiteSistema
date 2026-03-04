/**
 * Store de autenticación con Zustand
 * Usa sessionStorage para que cada pestaña tenga su propia sesión
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Usuario } from '@/types/auth';
import { authService } from '@/services/authService';

interface AuthState {
  user: Usuario | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: Usuario | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) => {
        set({ user, isAuthenticated: !!user });
      },

      login: async (email: string, password: string) => {
        const response = await authService.login({ email, password });

        // Guardar tokens
        authService.saveTokens(
          response.tokens.access_token,
          response.tokens.refresh_token
        );

        // Actualizar estado
        set({
          user: response.user,
          isAuthenticated: true,
        });
      },

      logout: async () => {
        try {
          await authService.logout();
        } finally {
          set({
            user: null,
            isAuthenticated: false,
          });
        }
      },

      checkAuth: async () => {
        set({ isLoading: true });

        if (!authService.isAuthenticated()) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }

        try {
          const user = await authService.getCurrentUser();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch {
          // Token inválido o expirado
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      // Usar sessionStorage en lugar de localStorage para sesiones por pestaña
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
