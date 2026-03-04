/**
 * Servicio de Servicios y Listas de Precios
 */

import api from './api';

// ==================== TIPOS ====================

export interface Servicio {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipo: string;
  categoria?: string;
  unidad_cobro: string;
  precio_base: number;
  tiempo_estimado_minutos?: number;
  activo: boolean;
  mostrar_en_web: boolean;
  orden: number;
  notas?: string;
  created_at: string;
  updated_at?: string;
}

export interface ServicioCreate {
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipo?: string;
  categoria?: string;
  unidad_cobro?: string;
  precio_base: number;
  tiempo_estimado_minutos?: number;
  mostrar_en_web?: boolean;
  orden?: number;
  notas?: string;
}

export interface ServicioUpdate {
  codigo?: string;
  nombre?: string;
  descripcion?: string;
  tipo?: string;
  categoria?: string;
  unidad_cobro?: string;
  precio_base?: number;
  tiempo_estimado_minutos?: number;
  activo?: boolean;
  mostrar_en_web?: boolean;
  orden?: number;
  notas?: string;
}

export interface ListaPrecios {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  es_lista_base: boolean;
  lista_base_id?: string;
  lista_base_nombre?: string;
  porcentaje_modificador?: number;
  fecha_vigencia_desde?: string;
  fecha_vigencia_hasta?: string;
  activa: boolean;
  notas?: string;
  cantidad_items: number;
  created_at: string;
  updated_at?: string;
}

export interface ListaPreciosCreate {
  codigo: string;
  nombre: string;
  descripcion?: string;
  es_lista_base?: boolean;
  lista_base_id?: string;
  porcentaje_modificador?: number;
  fecha_vigencia_desde?: string;
  fecha_vigencia_hasta?: string;
  notas?: string;
}

export interface ListaPreciosUpdate {
  codigo?: string;
  nombre?: string;
  descripcion?: string;
  es_lista_base?: boolean;
  lista_base_id?: string;
  porcentaje_modificador?: number;
  fecha_vigencia_desde?: string;
  fecha_vigencia_hasta?: string;
  activa?: boolean;
  notas?: string;
}

export interface ItemListaPrecios {
  id: string;
  lista_id: string;
  servicio_id: string;
  precio: number;
  precio_minimo?: number;
  cantidad_minima?: number;
  fecha_vigencia_desde?: string;
  fecha_vigencia_hasta?: string;
  activo: boolean;
  servicio_codigo?: string;
  servicio_nombre?: string;
  servicio_unidad_cobro?: string;
}

export interface ItemListaPreciosCreate {
  servicio_id: string;
  precio: number;
  precio_minimo?: number;
  cantidad_minima?: number;
  fecha_vigencia_desde?: string;
  fecha_vigencia_hasta?: string;
}

export interface ItemListaPreciosUpdate {
  precio?: number;
  precio_minimo?: number;
  cantidad_minima?: number;
  fecha_vigencia_desde?: string;
  fecha_vigencia_hasta?: string;
  activo?: boolean;
}

export interface ListaPreciosConItems extends ListaPrecios {
  items: ItemListaPrecios[];
}

export interface TipoServicio {
  value: string;
  label: string;
}

export interface UnidadCobro {
  value: string;
  label: string;
}

export interface PrecioServicio {
  servicio_id: string;
  servicio_codigo: string;
  servicio_nombre: string;
  unidad_cobro: string;
  precio: number;
  precio_base: number;
  lista_id?: string;
  es_precio_lista: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

// ==================== SERVICIOS ====================

export const servicioService = {
  /**
   * Lista servicios con filtros
   */
  async listar(params?: {
    skip?: number;
    limit?: number;
    search?: string;
    tipo?: string;
    categoria?: string;
    activo?: boolean;
    mostrar_en_web?: boolean;
  }): Promise<PaginatedResponse<Servicio>> {
    const response = await api.get('/servicios/', { params });
    return response.data;
  },

  /**
   * Obtiene un servicio por ID
   */
  async obtener(id: string): Promise<Servicio> {
    const response = await api.get(`/servicios/${id}`);
    return response.data;
  },

  /**
   * Crea un nuevo servicio
   */
  async crear(data: ServicioCreate): Promise<Servicio> {
    const response = await api.post('/servicios/', data);
    return response.data;
  },

  /**
   * Actualiza un servicio
   */
  async actualizar(id: string, data: ServicioUpdate): Promise<Servicio> {
    const response = await api.put(`/servicios/${id}`, data);
    return response.data;
  },

  /**
   * Elimina (desactiva) un servicio
   */
  async eliminar(id: string): Promise<void> {
    await api.delete(`/servicios/${id}`);
  },

  /**
   * Búsqueda rápida de servicios
   */
  async buscar(q: string, limit?: number): Promise<Servicio[]> {
    const response = await api.get('/servicios/buscar', { params: { q, limit } });
    return response.data;
  },

  /**
   * Obtiene tipos de servicio disponibles
   */
  async getTipos(): Promise<TipoServicio[]> {
    const response = await api.get('/servicios/tipos');
    return response.data;
  },

  /**
   * Obtiene unidades de cobro disponibles
   */
  async getUnidadesCobro(): Promise<UnidadCobro[]> {
    const response = await api.get('/servicios/unidades-cobro');
    return response.data;
  },

  /**
   * Obtiene categorías existentes
   */
  async getCategorias(): Promise<string[]> {
    const response = await api.get('/servicios/categorias');
    return response.data;
  },

  /**
   * Obtiene el precio de un servicio
   */
  async getPrecio(servicioId: string, listaId?: string): Promise<PrecioServicio> {
    const response = await api.get(`/servicios/precio/${servicioId}`, {
      params: listaId ? { lista_id: listaId } : undefined,
    });
    return response.data;
  },
};

// ==================== LISTAS DE PRECIOS ====================

export const listaPreciosService = {
  /**
   * Lista listas de precios con filtros
   */
  async listar(params?: {
    skip?: number;
    limit?: number;
    search?: string;
    activa?: boolean;
    es_lista_base?: boolean;
  }): Promise<PaginatedResponse<ListaPrecios>> {
    const response = await api.get('/servicios/listas-precios/', { params });
    return response.data;
  },

  /**
   * Obtiene una lista de precios con sus items
   */
  async obtener(id: string): Promise<ListaPreciosConItems> {
    const response = await api.get(`/servicios/listas-precios/${id}`);
    return response.data;
  },

  /**
   * Crea una nueva lista de precios
   */
  async crear(data: ListaPreciosCreate): Promise<ListaPrecios> {
    const response = await api.post('/servicios/listas-precios/', data);
    return response.data;
  },

  /**
   * Actualiza una lista de precios
   */
  async actualizar(id: string, data: ListaPreciosUpdate): Promise<ListaPrecios> {
    const response = await api.put(`/servicios/listas-precios/${id}`, data);
    return response.data;
  },

  /**
   * Elimina (desactiva) una lista de precios
   */
  async eliminar(id: string): Promise<void> {
    await api.delete(`/servicios/listas-precios/${id}`);
  },

  /**
   * Aplica el modificador de una lista derivada
   */
  async aplicarModificador(id: string): Promise<{ message: string; items_actualizados: number }> {
    const response = await api.post(`/servicios/listas-precios/${id}/aplicar-modificador`);
    return response.data;
  },

  /**
   * Obtiene los items de una lista
   */
  async getItems(listaId: string): Promise<ItemListaPrecios[]> {
    const response = await api.get(`/servicios/listas-precios/${listaId}/items`);
    return response.data;
  },

  /**
   * Agrega un item a una lista
   */
  async agregarItem(listaId: string, data: ItemListaPreciosCreate): Promise<ItemListaPrecios> {
    const response = await api.post(`/servicios/listas-precios/${listaId}/items`, data);
    return response.data;
  },

  /**
   * Actualiza un item de una lista
   */
  async actualizarItem(
    listaId: string,
    itemId: string,
    data: ItemListaPreciosUpdate
  ): Promise<ItemListaPrecios> {
    const response = await api.put(`/servicios/listas-precios/${listaId}/items/${itemId}`, data);
    return response.data;
  },

  /**
   * Elimina un item de una lista
   */
  async eliminarItem(listaId: string, itemId: string): Promise<void> {
    await api.delete(`/servicios/listas-precios/${listaId}/items/${itemId}`);
  },
};
