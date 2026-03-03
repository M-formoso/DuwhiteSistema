/**
 * Servicio de Proveedores y Órdenes de Compra
 */

import api from './api';
import type {
  Proveedor,
  ProveedorCreate,
  ProveedorUpdate,
  ProductoProveedor,
  ProductoProveedorCreate,
  OrdenCompra,
  OrdenCompraCreate,
  EstadoOrdenCompra,
} from '@/types/proveedor';
import type { PaginatedResponse } from '@/types/auth';

// ==================== PROVEEDORES ====================

export async function getProveedores(params?: {
  skip?: number;
  limit?: number;
  search?: string;
  rubro?: string;
  solo_activos?: boolean;
}): Promise<PaginatedResponse<Proveedor>> {
  const response = await api.get('/proveedores', { params });
  return response.data;
}

export async function getProveedoresLista(search?: string): Promise<{
  id: string;
  razon_social: string;
  nombre_fantasia: string | null;
  cuit: string;
}[]> {
  const response = await api.get('/proveedores/lista', { params: { search } });
  return response.data;
}

export async function getProveedor(id: string): Promise<Proveedor> {
  const response = await api.get(`/proveedores/${id}`);
  return response.data;
}

export async function createProveedor(data: ProveedorCreate): Promise<Proveedor> {
  const response = await api.post('/proveedores', data);
  return response.data;
}

export async function updateProveedor(id: string, data: ProveedorUpdate): Promise<Proveedor> {
  const response = await api.put(`/proveedores/${id}`, data);
  return response.data;
}

export async function deleteProveedor(id: string): Promise<void> {
  await api.delete(`/proveedores/${id}`);
}

// ==================== PRODUCTOS DE PROVEEDOR ====================

export async function getProductosProveedor(
  proveedorId: string,
  params?: { skip?: number; limit?: number; solo_activos?: boolean }
): Promise<PaginatedResponse<ProductoProveedor>> {
  const response = await api.get(`/proveedores/${proveedorId}/productos`, { params });
  return response.data;
}

export async function createProductoProveedor(
  proveedorId: string,
  data: ProductoProveedorCreate
): Promise<ProductoProveedor> {
  const response = await api.post(`/proveedores/${proveedorId}/productos`, data);
  return response.data;
}

export async function updateProductoProveedor(
  productoId: string,
  data: Partial<ProductoProveedorCreate>
): Promise<ProductoProveedor> {
  const response = await api.put(`/proveedores/productos/${productoId}`, data);
  return response.data;
}

export async function actualizarPrecioProducto(
  productoId: string,
  data: {
    precio_unitario: number;
    fecha_precio?: string;
    fecha_vencimiento_precio?: string | null;
    documento_referencia?: string | null;
    notas?: string | null;
  }
): Promise<ProductoProveedor> {
  const response = await api.post(`/proveedores/productos/${productoId}/precio`, data);
  return response.data;
}

// ==================== ÓRDENES DE COMPRA ====================

export async function getOrdenesCompra(params?: {
  skip?: number;
  limit?: number;
  proveedor_id?: string;
  estado?: EstadoOrdenCompra;
  fecha_desde?: string;
  fecha_hasta?: string;
}): Promise<PaginatedResponse<OrdenCompra>> {
  const response = await api.get('/ordenes-compra', { params });
  return response.data;
}

export async function getOrdenCompra(id: string): Promise<OrdenCompra> {
  const response = await api.get(`/ordenes-compra/${id}`);
  return response.data;
}

export async function createOrdenCompra(data: OrdenCompraCreate): Promise<OrdenCompra> {
  const response = await api.post('/ordenes-compra', data);
  return response.data;
}

export async function updateOrdenCompra(
  id: string,
  data: Partial<OrdenCompraCreate>
): Promise<OrdenCompra> {
  const response = await api.put(`/ordenes-compra/${id}`, data);
  return response.data;
}

export async function aprobarOrdenCompra(
  id: string,
  notas?: string
): Promise<{ message: string }> {
  const response = await api.post(`/ordenes-compra/${id}/aprobar`, { notas });
  return response.data;
}

export async function enviarOrdenCompra(id: string): Promise<{ message: string }> {
  const response = await api.post(`/ordenes-compra/${id}/enviar`);
  return response.data;
}

export async function cancelarOrdenCompra(
  id: string,
  notas?: string
): Promise<{ message: string }> {
  const response = await api.post(`/ordenes-compra/${id}/cancelar`, { notas });
  return response.data;
}

export async function registrarRecepcion(
  ordenId: string,
  data: {
    orden_compra_id: string;
    remito_numero?: string | null;
    factura_numero?: string | null;
    notas?: string | null;
    items: {
      orden_detalle_id: string;
      insumo_id: string;
      cantidad_esperada: number;
      cantidad_recibida: number;
      cantidad_rechazada?: number;
      numero_lote?: string | null;
      fecha_vencimiento?: string | null;
      ubicacion?: string | null;
      motivo_rechazo?: string | null;
    }[];
  }
): Promise<{
  id: string;
  numero: string;
  fecha_recepcion: string;
}> {
  const response = await api.post(`/ordenes-compra/${ordenId}/recepcion`, data);
  return response.data;
}

// ==================== EXPORTS ====================

export const proveedorService = {
  // Proveedores
  getProveedores,
  getProveedoresLista,
  getProveedor,
  createProveedor,
  updateProveedor,
  deleteProveedor,
  // Productos
  getProductosProveedor,
  createProductoProveedor,
  updateProductoProveedor,
  actualizarPrecioProducto,
  // Órdenes
  getOrdenesCompra,
  getOrdenCompra,
  createOrdenCompra,
  updateOrdenCompra,
  aprobarOrdenCompra,
  enviarOrdenCompra,
  cancelarOrdenCompra,
  registrarRecepcion,
};

export default proveedorService;
