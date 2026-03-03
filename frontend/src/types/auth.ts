/**
 * Tipos de autenticación
 */

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: RolUsuario;
  avatar?: string;
  debe_cambiar_password: boolean;
  ultimo_acceso?: string;
  empleado_id?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export type RolUsuario =
  | 'superadmin'
  | 'administrador'
  | 'jefe_produccion'
  | 'operador'
  | 'comercial'
  | 'contador'
  | 'solo_lectura';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginResponse {
  user: Usuario;
  tokens: TokenResponse;
}

export interface CambiarPasswordRequest {
  password_actual: string;
  password_nuevo: string;
}
