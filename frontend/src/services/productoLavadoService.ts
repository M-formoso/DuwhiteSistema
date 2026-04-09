/**
 * Servicio de Productos de Lavado
 */

import api from './api';
import {
  ProductoLavado,
  ProductoLavadoCreate,
  ProductoLavadoUpdate,
  PrecioProductoLavado,
  ProductoConPrecio,
  CategoriaProductoLavado,
} from '@/types/produccion-v2';

const BASE_URL = '/produccion/productos-lavado';

export const productoLavadoService = {
  /**
   * Lista todos los productos
   */
  async getAll(params?: {
    categoria?: CategoriaProductoLavado;
    search?: string;
    solo_activos?: boolean;
  }): Promise<ProductoLavado[]> {
    const response = await api.get(BASE_URL, { params });
    return response.data;
  },

  /**
   * Obtiene las categorías disponibles
   */
  async getCategorias(): Promise<{ value: string; label: string }[]> {
    const response = await api.get(`${BASE_URL}/categorias`);
    return response.data;
  },

  /**
   * Obtiene productos con precios para una lista
   */
  async getProductosConPrecios(
    listaPreciosId: string,
    categoria?: CategoriaProductoLavado
  ): Promise<ProductoConPrecio[]> {
    const response = await api.get(`${BASE_URL}/con-precios`, {
      params: { lista_precios_id: listaPreciosId, categoria },
    });
    return response.data;
  },

  /**
   * Obtiene un producto por ID
   */
  async getById(id: string): Promise<ProductoLavado> {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response.data;
  },

  /**
   * Crea un nuevo producto
   */
  async create(data: ProductoLavadoCreate): Promise<ProductoLavado> {
    const response = await api.post(BASE_URL, data);
    return response.data;
  },

  /**
   * Actualiza un producto
   */
  async update(id: string, data: ProductoLavadoUpdate): Promise<ProductoLavado> {
    const response = await api.put(`${BASE_URL}/${id}`, data);
    return response.data;
  },

  /**
   * Elimina (desactiva) un producto
   */
  async delete(id: string): Promise<void> {
    await api.delete(`${BASE_URL}/${id}`);
  },

  // ==================== PRECIOS ====================

  /**
   * Obtiene precios para una lista
   */
  async getPreciosLista(listaPreciosId: string): Promise<PrecioProductoLavado[]> {
    const response = await api.get(`${BASE_URL}/precios/lista/${listaPreciosId}`);
    return response.data;
  },

  /**
   * Establece precio de un producto en una lista
   */
  async setPrecio(data: {
    lista_precios_id: string;
    producto_id: string;
    precio_unitario: number;
  }): Promise<PrecioProductoLavado> {
    const response = await api.post(`${BASE_URL}/precios`, data);
    return response.data;
  },

  /**
   * Obtiene precio de un producto específico
   */
  async getPrecioProducto(
    listaPreciosId: string,
    productoId: string
  ): Promise<{ precio_unitario: number | null; tiene_precio: boolean }> {
    const response = await api.get(`${BASE_URL}/precios/${listaPreciosId}/${productoId}`);
    return response.data;
  },
};

export default productoLavadoService;
