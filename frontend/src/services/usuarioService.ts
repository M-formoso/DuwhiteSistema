/**
 * Servicio de Usuarios
 */

import api from '@/lib/api';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  rol: string;
  avatar?: string;
  activo: boolean;
  debe_cambiar_password: boolean;
  ultimo_acceso?: string;
  cliente_id?: string;
  cliente_nombre?: string;
  permisos_modulos?: Record<string, boolean>;
  permisos_efectivos?: Record<string, boolean>;
  tiene_password_visible?: boolean;
  password_visible?: string;
  created_at: string;
  updated_at?: string;
}

export interface UsuarioCreate {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  rol: string;
  cliente_id?: string;
  permisos_modulos?: Record<string, boolean>;
  guardar_password_visible?: boolean;
}

export interface UsuarioCreateForClient {
  cliente_id: string;
  email: string;
  password: string;
  nombre?: string;
  apellido?: string;
}

export interface UsuarioUpdate {
  email?: string;
  nombre?: string;
  apellido?: string;
  telefono?: string;
  rol?: string;
  cliente_id?: string;
  permisos_modulos?: Record<string, boolean>;
  activo?: boolean;
  debe_cambiar_password?: boolean;
}

export interface ResetPasswordRequest {
  password_nuevo: string;
  guardar_password_visible?: boolean;
}

export interface PermisosModulos {
  modulos_disponibles: string[];
  permisos_por_rol: Record<string, Record<string, boolean>>;
}

export interface UsuarioFilters {
  skip?: number;
  limit?: number;
  search?: string;
  activo?: boolean;
  rol?: string;
  solo_clientes?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export const ROLES = [
  { value: 'superadmin', label: 'Super Administrador' },
  { value: 'administrador', label: 'Administrador' },
  { value: 'jefe_produccion', label: 'Jefe de Producción' },
  { value: 'operador', label: 'Operador' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'contador', label: 'Contador' },
  { value: 'solo_lectura', label: 'Solo Lectura' },
  { value: 'cliente', label: 'Cliente' },
];

export const MODULOS_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  stock: 'Stock',
  proveedores: 'Proveedores',
  produccion: 'Producción',
  clientes: 'Clientes',
  pedidos: 'Pedidos',
  finanzas: 'Finanzas',
  costos: 'Costos',
  empleados: 'Empleados',
  reportes: 'Reportes',
  usuarios: 'Usuarios',
  configuracion: 'Configuración',
};

export const usuarioService = {
  /**
   * Lista usuarios con filtros
   */
  async getUsuarios(filters: UsuarioFilters = {}): Promise<PaginatedResponse<Usuario>> {
    const params = new URLSearchParams();
    if (filters.skip !== undefined) params.append('skip', filters.skip.toString());
    if (filters.limit !== undefined) params.append('limit', filters.limit.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.activo !== undefined) params.append('activo', filters.activo.toString());
    if (filters.rol) params.append('rol', filters.rol);
    if (filters.solo_clientes) params.append('solo_clientes', 'true');

    const response = await api.get(`/usuarios?${params.toString()}`);
    return response.data;
  },

  /**
   * Obtiene un usuario por ID
   */
  async getUsuario(id: string): Promise<Usuario> {
    const response = await api.get(`/usuarios/${id}`);
    return response.data;
  },

  /**
   * Obtiene un usuario con credenciales visibles
   */
  async getUsuarioConCredenciales(id: string): Promise<Usuario> {
    const response = await api.get(`/usuarios/${id}/con-credenciales`);
    return response.data;
  },

  /**
   * Obtiene usuarios de un cliente
   */
  async getUsuariosPorCliente(clienteId: string): Promise<Usuario[]> {
    const response = await api.get(`/usuarios/por-cliente/${clienteId}`);
    return response.data;
  },

  /**
   * Obtiene módulos y permisos disponibles
   */
  async getModulosPermisos(): Promise<PermisosModulos> {
    const response = await api.get('/usuarios/modulos-permisos');
    return response.data;
  },

  /**
   * Crea un nuevo usuario
   */
  async createUsuario(data: UsuarioCreate): Promise<Usuario> {
    const response = await api.post('/usuarios', data);
    return response.data;
  },

  /**
   * Crea un usuario para un cliente
   */
  async createUsuarioParaCliente(data: UsuarioCreateForClient): Promise<Usuario> {
    const response = await api.post('/usuarios/para-cliente', data);
    return response.data;
  },

  /**
   * Actualiza un usuario
   */
  async updateUsuario(id: string, data: UsuarioUpdate): Promise<Usuario> {
    const response = await api.put(`/usuarios/${id}`, data);
    return response.data;
  },

  /**
   * Actualiza los permisos de un usuario
   */
  async updatePermisos(id: string, permisos: Record<string, boolean>): Promise<Usuario> {
    const response = await api.put(`/usuarios/${id}/permisos`, permisos);
    return response.data;
  },

  /**
   * Resetea la contraseña de un usuario
   */
  async resetPassword(id: string, data: ResetPasswordRequest): Promise<Usuario> {
    const response = await api.put(`/usuarios/${id}/reset-password`, data);
    return response.data;
  },

  /**
   * Elimina un usuario
   */
  async deleteUsuario(id: string): Promise<void> {
    await api.delete(`/usuarios/${id}`);
  },

  /**
   * Activa/desactiva un usuario
   */
  async toggleActivo(id: string): Promise<Usuario> {
    const response = await api.put(`/usuarios/${id}/toggle-activo`);
    return response.data;
  },

  /**
   * Obtiene el label de un rol
   */
  getRolLabel(rol: string): string {
    return ROLES.find(r => r.value === rol)?.label || rol;
  },
};

export default usuarioService;
