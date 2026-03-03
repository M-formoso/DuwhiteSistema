/**
 * Servicio de Clientes y Pedidos
 */

import api from './api';
import type {
  Cliente,
  ClienteList,
  ClienteCreate,
  Pedido,
  PedidoList,
  PedidoCreate,
  DetallePedidoCreate,
  MovimientoCuentaCorriente,
  EstadoCuenta,
  RegistrarPagoRequest,
  TipoCliente,
  EstadoPedido,
} from '@/types/cliente';
import type { PaginatedResponse } from '@/types/auth';

// ==================== CLIENTES ====================

export async function getClientes(params?: {
  skip?: number;
  limit?: number;
  tipo?: TipoCliente;
  activo?: boolean;
  con_deuda?: boolean;
  buscar?: string;
}): Promise<PaginatedResponse<ClienteList>> {
  const response = await api.get('/clientes', { params });
  return response.data;
}

export async function getClientesLista(): Promise<{
  id: string;
  codigo: string;
  nombre: string;
  cuit: string | null;
}[]> {
  const response = await api.get('/clientes/lista');
  return response.data;
}

export async function getCliente(id: string): Promise<Cliente> {
  const response = await api.get(`/clientes/${id}`);
  return response.data;
}

export async function createCliente(data: ClienteCreate): Promise<Cliente> {
  const response = await api.post('/clientes', data);
  return response.data;
}

export async function updateCliente(id: string, data: Partial<ClienteCreate>): Promise<Cliente> {
  const response = await api.put(`/clientes/${id}`, data);
  return response.data;
}

export async function deleteCliente(id: string): Promise<{ message: string }> {
  const response = await api.delete(`/clientes/${id}`);
  return response.data;
}

// ==================== CUENTA CORRIENTE ====================

export async function getEstadoCuenta(clienteId: string): Promise<EstadoCuenta> {
  const response = await api.get(`/clientes/${clienteId}/cuenta-corriente`);
  return response.data;
}

export async function getMovimientosCuenta(
  clienteId: string,
  params?: {
    skip?: number;
    limit?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
  }
): Promise<PaginatedResponse<MovimientoCuentaCorriente>> {
  const response = await api.get(`/clientes/${clienteId}/movimientos`, { params });
  return response.data;
}

export async function registrarPago(
  clienteId: string,
  data: RegistrarPagoRequest
): Promise<{
  recibo_numero: string;
  monto: number;
  saldo_anterior: number;
  saldo_posterior: number;
}> {
  const response = await api.post(`/clientes/${clienteId}/pagos`, data);
  return response.data;
}

// ==================== PEDIDOS ====================

export async function getPedidos(params?: {
  skip?: number;
  limit?: number;
  cliente_id?: string;
  estado?: EstadoPedido;
  fecha_desde?: string;
  fecha_hasta?: string;
}): Promise<PaginatedResponse<PedidoList>> {
  const response = await api.get('/pedidos', { params });
  return response.data;
}

export async function getPedido(id: string): Promise<Pedido> {
  const response = await api.get(`/pedidos/${id}`);
  return response.data;
}

export async function createPedido(data: PedidoCreate): Promise<Pedido> {
  const response = await api.post('/pedidos', data);
  return response.data;
}

export async function updatePedido(id: string, data: Partial<PedidoCreate>): Promise<Pedido> {
  const response = await api.put(`/pedidos/${id}`, data);
  return response.data;
}

export async function agregarDetallePedido(
  pedidoId: string,
  data: DetallePedidoCreate
): Promise<Pedido> {
  const response = await api.post(`/pedidos/${pedidoId}/detalles`, data);
  return response.data;
}

export async function cambiarEstadoPedido(
  id: string,
  estado: EstadoPedido,
  observaciones?: string
): Promise<{ message: string; numero: string; estado: string }> {
  const response = await api.post(`/pedidos/${id}/estado`, { estado, observaciones });
  return response.data;
}

export async function cancelarPedido(id: string): Promise<{ message: string }> {
  const response = await api.delete(`/pedidos/${id}`);
  return response.data;
}

// ==================== EXPORTS ====================

export const clienteService = {
  // Clientes
  getClientes,
  getClientesLista,
  getCliente,
  createCliente,
  updateCliente,
  deleteCliente,
  // Cuenta Corriente
  getEstadoCuenta,
  getMovimientosCuenta,
  registrarPago,
  // Pedidos
  getPedidos,
  getPedido,
  createPedido,
  updatePedido,
  agregarDetallePedido,
  cambiarEstadoPedido,
  cancelarPedido,
};

export default clienteService;
