/**
 * Servicio de Categorías de Gasto.
 *
 * Las categorías son el "a qué le pagás" cuando un egreso no tiene
 * proveedor concreto (IVA, EPEC, sindicato, cuotas, obras, sueldos).
 * El backend trae un seed con las que la casa ya venía manejando;
 * la admin puede sumar más desde el modal de "Nuevo movimiento".
 */

import api from './api';

export interface CategoriaGasto {
  id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
}

export const categoriaGastoService = {
  async list(soloActivas = true): Promise<CategoriaGasto[]> {
    const { data } = await api.get<CategoriaGasto[]>('/tesoreria/categorias-gasto', {
      params: { solo_activas: soloActivas },
    });
    return data;
  },

  async create(nombre: string): Promise<CategoriaGasto> {
    const { data } = await api.post<CategoriaGasto>('/tesoreria/categorias-gasto', { nombre });
    return data;
  },

  async update(id: string, patch: { nombre?: string; activo?: boolean }): Promise<CategoriaGasto> {
    const { data } = await api.patch<CategoriaGasto>(`/tesoreria/categorias-gasto/${id}`, patch);
    return data;
  },

  async disable(id: string): Promise<void> {
    await api.delete(`/tesoreria/categorias-gasto/${id}`);
  },
};
