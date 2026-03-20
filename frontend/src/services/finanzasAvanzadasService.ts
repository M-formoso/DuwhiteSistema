/**
 * Servicios para funcionalidades avanzadas de Finanzas
 * - Cuenta Corriente Proveedor
 * - Órdenes de Pago
 * - Cruces Consolidados
 * - Conciliación Bancaria
 */

import api from './api';
import {
  MovimientoCCProveedorList,
  RegistrarCargoProveedorRequest,
  RegistrarPagoProveedorRequest,
  EstadoCuentaProveedor,
  AnalisisVencimientos,
  OrdenPago,
  OrdenPagoList,
  OrdenPagoCreate,
  OrdenPagoUpdate,
  PagarOrdenPagoRequest,
  ResumenOrdenesPago,
  EntidadConsolidada,
  EntidadConsolidadaList,
  SaldoConsolidadoDetalle,
  SincronizarEntidadesResponse,
  ResumenCruces,
  ConciliacionBancaria,
  ConciliacionBancariaList,
  ConciliacionBancariaCreate,
  ConciliarMovimientoRequest,
  FinalizarConciliacionRequest,
  MovimientoSinConciliar,
  ResumenConciliacionCuenta,
} from '@/types/finanzas-avanzadas';

// ==================== CUENTA CORRIENTE CLIENTES ====================

export interface ClienteConDeuda {
  id: string;
  codigo: string;
  razon_social: string;
  nombre_fantasia: string | null;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  saldo: number;
  limite_credito: number | null;
  dias_antiguedad: number | null;
}

export interface ResumenCCClientes {
  clientes_con_deuda: number;
  total_deuda: number;
  total_facturado_mes: number;
  total_cobrado_mes: number;
  promedio_dias_cobranza: number;
}

export interface MovimientoCCCliente {
  id: string;
  tipo: string;
  concepto: string;
  monto: number;
  fecha_movimiento: string;
  saldo_anterior: number;
  saldo_posterior: number;
  factura_numero: string | null;
  recibo_numero: string | null;
  medio_pago: string | null;
  referencia_pago: string | null;
}

export interface RegistrarPagoClienteRequest {
  monto: number;
  fecha: string;
  medio_pago: string;
  referencia_pago?: string;
  notas?: string;
  aplicar_a_pedidos?: string[];
}

export interface RegistrarCobranzaRequest {
  monto: number;
  fecha: string;
  medio_pago: string;
  concepto?: string;
  referencia_pago?: string;
  notas?: string;
  pedido_id?: string;
  lote_id?: string;
  estado_facturacion: string;  // sin_facturar, factura_a, factura_b, ticket
  factura_numero?: string;
}

export interface PedidoPendiente {
  id: string;
  numero: string;
  fecha: string;
  total: number;
  saldo_pendiente: number;
  estado: string;
}

export interface LoteCliente {
  id: string;
  numero: string;
  fecha_ingreso: string | null;
  estado: string;
  descripcion: string | null;
}

export interface RegistrarCargoClienteRequest {
  monto: number;
  concepto: string;
  factura_numero?: string;
  fecha_vencimiento?: string;
}

export const cuentaCorrienteClienteService = {
  // Listar clientes con deuda
  async getClientesConDeuda(params?: {
    skip?: number;
    limit?: number;
    buscar?: string;
    orden?: 'saldo_desc' | 'saldo_asc' | 'nombre' | 'antiguedad';
  }) {
    const response = await api.get<{
      items: ClienteConDeuda[];
      total: number;
      total_deuda: number;
      skip: number;
      limit: number;
    }>('/clientes/cuenta-corriente/clientes-con-deuda', { params });
    return response.data;
  },

  // Resumen general
  async getResumen() {
    const response = await api.get<ResumenCCClientes>(
      '/clientes/cuenta-corriente/resumen'
    );
    return response.data;
  },

  // Movimientos de un cliente
  async getMovimientos(
    clienteId: string,
    params?: {
      skip?: number;
      limit?: number;
      fecha_desde?: string;
      fecha_hasta?: string;
      tipo?: string;
    }
  ) {
    const response = await api.get<{
      items: MovimientoCCCliente[];
      total: number;
      skip: number;
      limit: number;
    }>(`/clientes/cuenta-corriente/${clienteId}/movimientos`, { params });
    return response.data;
  },

  // Estado de cuenta de un cliente
  async getEstadoCuenta(clienteId: string) {
    const response = await api.get<{
      cliente_id: string;
      cliente_nombre: string;
      saldo_actual: number;
      limite_credito: number | null;
      credito_disponible: number | null;
      total_facturado_mes: number;
      total_pagado_mes: number;
      cantidad_facturas_pendientes: number;
      factura_mas_antigua_dias: number | null;
    }>(`/clientes/cuenta-corriente/${clienteId}/estado-cuenta`);
    return response.data;
  },

  // Registrar cargo
  async registrarCargo(clienteId: string, data: RegistrarCargoClienteRequest) {
    const response = await api.post<{ id: string; mensaje: string; saldo_posterior: number }>(
      `/clientes/cuenta-corriente/${clienteId}/cargo`,
      null,
      { params: data }
    );
    return response.data;
  },

  // Registrar pago
  async registrarPago(clienteId: string, data: RegistrarPagoClienteRequest) {
    const response = await api.post<{
      id: string;
      recibo_numero: string;
      mensaje: string;
      saldo_posterior: number;
    }>(`/clientes/cuenta-corriente/${clienteId}/pago`, {
      cliente_id: clienteId,
      ...data,
    });
    return response.data;
  },

  // Tipos de movimiento
  async getTiposMovimiento() {
    const response = await api.get<{ value: string; label: string }[]>(
      '/clientes/cuenta-corriente/tipos-movimiento'
    );
    return response.data;
  },

  // Medios de pago
  async getMediosPago() {
    const response = await api.get<{ value: string; label: string }[]>(
      '/clientes/cuenta-corriente/medios-pago'
    );
    return response.data;
  },

  // Estados de facturación
  async getEstadosFacturacion() {
    const response = await api.get<{ value: string; label: string }[]>(
      '/clientes/cuenta-corriente/estados-facturacion'
    );
    return response.data;
  },

  // Registrar cobranza completa
  async registrarCobranza(clienteId: string, data: RegistrarCobranzaRequest) {
    const response = await api.post<{
      id: string;
      recibo_numero: string;
      mensaje: string;
      saldo_anterior: number;
      saldo_posterior: number;
      estado_facturacion: string;
      pedido_numero: string | null;
      lote_numero: string | null;
    }>(`/clientes/cuenta-corriente/${clienteId}/cobranza`, data);
    return response.data;
  },

  // Pedidos pendientes de un cliente
  async getPedidosPendientes(clienteId: string) {
    const response = await api.get<PedidoPendiente[]>(
      `/clientes/cuenta-corriente/${clienteId}/pedidos-pendientes`
    );
    return response.data;
  },

  // Lotes de un cliente
  async getLotesCliente(clienteId: string) {
    const response = await api.get<LoteCliente[]>(
      `/clientes/cuenta-corriente/${clienteId}/lotes`
    );
    return response.data;
  },
};

// ==================== CUENTA CORRIENTE PROVEEDOR ====================

export const cuentaCorrienteProveedorService = {
  // Listar movimientos
  async getMovimientos(
    proveedorId: string,
    params?: {
      skip?: number;
      limit?: number;
      fecha_desde?: string;
      fecha_hasta?: string;
      tipo?: string;
    }
  ) {
    const response = await api.get<{
      items: MovimientoCCProveedorList[];
      total: number;
      skip: number;
      limit: number;
    }>(`/proveedores/cuenta-corriente/${proveedorId}/movimientos`, { params });
    return response.data;
  },

  // Obtener saldo
  async getSaldo(proveedorId: string) {
    const response = await api.get<{ proveedor_id: string; saldo: number }>(
      `/proveedores/cuenta-corriente/${proveedorId}/saldo`
    );
    return response.data;
  },

  // Comprobantes pendientes
  async getComprobantesPendientes(proveedorId: string) {
    const response = await api.get<MovimientoCCProveedorList[]>(
      `/proveedores/cuenta-corriente/${proveedorId}/comprobantes-pendientes`
    );
    return response.data;
  },

  // Registrar cargo
  async registrarCargo(proveedorId: string, data: RegistrarCargoProveedorRequest) {
    const response = await api.post<{ id: string; mensaje: string; saldo_posterior: number }>(
      `/proveedores/cuenta-corriente/${proveedorId}/cargo`,
      data
    );
    return response.data;
  },

  // Registrar pago
  async registrarPago(proveedorId: string, data: RegistrarPagoProveedorRequest) {
    const response = await api.post<{ id: string; mensaje: string; saldo_posterior: number }>(
      `/proveedores/cuenta-corriente/${proveedorId}/pago`,
      data
    );
    return response.data;
  },

  // Estado de cuenta
  async getEstadoCuenta(
    proveedorId: string,
    params?: { fecha_desde?: string; fecha_hasta?: string }
  ) {
    const response = await api.get<EstadoCuentaProveedor>(
      `/proveedores/cuenta-corriente/${proveedorId}/estado-cuenta`,
      { params }
    );
    return response.data;
  },

  // Análisis de vencimientos
  async getAnalisisVencimientos(proveedorId?: string) {
    const response = await api.get<AnalisisVencimientos>(
      '/proveedores/cuenta-corriente/analisis-vencimientos',
      { params: { proveedor_id: proveedorId } }
    );
    return response.data;
  },
};

// ==================== ÓRDENES DE PAGO ====================

export const ordenesPagoService = {
  // Listar órdenes
  async getOrdenes(params?: {
    skip?: number;
    limit?: number;
    proveedor_id?: string;
    estado?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    incluir_anuladas?: boolean;
  }) {
    const response = await api.get<{
      items: OrdenPagoList[];
      total: number;
      skip: number;
      limit: number;
    }>('/ordenes-pago', { params });
    return response.data;
  },

  // Obtener orden por ID
  async getOrden(ordenId: string) {
    const response = await api.get<OrdenPago>(`/ordenes-pago/${ordenId}`);
    return response.data;
  },

  // Crear orden
  async crear(data: OrdenPagoCreate) {
    const response = await api.post<OrdenPago>('/ordenes-pago', data);
    return response.data;
  },

  // Actualizar orden
  async actualizar(ordenId: string, data: OrdenPagoUpdate) {
    const response = await api.put<OrdenPago>(`/ordenes-pago/${ordenId}`, data);
    return response.data;
  },

  // Confirmar orden
  async confirmar(ordenId: string, notas?: string) {
    const response = await api.post<{ message: string }>(
      `/ordenes-pago/${ordenId}/confirmar`,
      notas ? { notas } : undefined
    );
    return response.data;
  },

  // Pagar orden
  async pagar(ordenId: string, data: PagarOrdenPagoRequest) {
    const response = await api.post<{ message: string }>(
      `/ordenes-pago/${ordenId}/pagar`,
      data
    );
    return response.data;
  },

  // Anular orden
  async anular(ordenId: string, motivo: string) {
    const response = await api.post<{ message: string }>(
      `/ordenes-pago/${ordenId}/anular`,
      { motivo }
    );
    return response.data;
  },

  // Resumen
  async getResumen(proveedorId?: string) {
    const response = await api.get<ResumenOrdenesPago>('/ordenes-pago/resumen/general', {
      params: { proveedor_id: proveedorId },
    });
    return response.data;
  },
};

// ==================== CRUCES CONSOLIDADOS ====================

export const crucesConsolidadosService = {
  // Sincronizar entidades
  async sincronizar() {
    const response = await api.post<SincronizarEntidadesResponse>(
      '/cruces-consolidados/sincronizar'
    );
    return response.data;
  },

  // Listar entidades
  async getEntidades(params?: {
    skip?: number;
    limit?: number;
    solo_cruzadas?: boolean;
    con_saldo?: boolean;
  }) {
    const response = await api.get<{
      items: EntidadConsolidadaList[];
      total: number;
      skip: number;
      limit: number;
    }>('/cruces-consolidados', { params });
    return response.data;
  },

  // Obtener por CUIT
  async getEntidadPorCuit(cuit: string) {
    const response = await api.get<EntidadConsolidada>(
      `/cruces-consolidados/por-cuit/${cuit}`
    );
    return response.data;
  },

  // Saldo consolidado
  async getSaldoConsolidado(cuit: string) {
    const response = await api.get<SaldoConsolidadoDetalle>(
      `/cruces-consolidados/saldo/${cuit}`
    );
    return response.data;
  },

  // Actualizar saldos
  async actualizarSaldos(cuit: string) {
    const response = await api.post<{ message: string }>(
      `/cruces-consolidados/actualizar-saldos/${cuit}`
    );
    return response.data;
  },

  // Resumen
  async getResumen() {
    const response = await api.get<ResumenCruces>('/cruces-consolidados/resumen');
    return response.data;
  },
};

// ==================== CONCILIACIÓN BANCARIA ====================

export const conciliacionBancariaService = {
  // Listar conciliaciones
  async getConciliaciones(params?: {
    skip?: number;
    limit?: number;
    cuenta_id?: string;
    estado?: string;
  }) {
    const response = await api.get<{
      items: ConciliacionBancariaList[];
      total: number;
      skip: number;
      limit: number;
    }>('/conciliacion-bancaria', { params });
    return response.data;
  },

  // Obtener conciliación
  async getConciliacion(conciliacionId: string) {
    const response = await api.get<ConciliacionBancaria>(
      `/conciliacion-bancaria/${conciliacionId}`
    );
    return response.data;
  },

  // Iniciar conciliación
  async iniciar(data: ConciliacionBancariaCreate) {
    const response = await api.post<ConciliacionBancaria>('/conciliacion-bancaria', data);
    return response.data;
  },

  // Conciliar movimiento
  async conciliarMovimiento(conciliacionId: string, data: ConciliarMovimientoRequest) {
    const response = await api.post<{ message: string }>(
      `/conciliacion-bancaria/${conciliacionId}/conciliar`,
      data
    );
    return response.data;
  },

  // Desconciliar movimiento
  async desconciliarMovimiento(conciliacionId: string, movimientoId: string) {
    const response = await api.post<{ message: string }>(
      `/conciliacion-bancaria/${conciliacionId}/desconciliar/${movimientoId}`
    );
    return response.data;
  },

  // Conciliar varios
  async conciliarVarios(
    conciliacionId: string,
    movimientos: ConciliarMovimientoRequest[]
  ) {
    const response = await api.post<{ message: string }>(
      `/conciliacion-bancaria/${conciliacionId}/conciliar-varios`,
      { movimientos }
    );
    return response.data;
  },

  // Finalizar conciliación
  async finalizar(conciliacionId: string, data: FinalizarConciliacionRequest) {
    const response = await api.post<{ message: string }>(
      `/conciliacion-bancaria/${conciliacionId}/finalizar`,
      data
    );
    return response.data;
  },

  // Movimientos sin conciliar
  async getMovimientosSinConciliar(cuentaId: string, fechaHasta?: string) {
    const response = await api.get<MovimientoSinConciliar[]>(
      `/conciliacion-bancaria/cuenta/${cuentaId}/sin-conciliar`,
      { params: { fecha_hasta: fechaHasta } }
    );
    return response.data;
  },

  // Resumen de cuenta
  async getResumenCuenta(cuentaId: string) {
    const response = await api.get<ResumenConciliacionCuenta>(
      `/conciliacion-bancaria/cuenta/${cuentaId}/resumen`
    );
    return response.data;
  },
};

// Export all services
export default {
  cuentaCorrienteCliente: cuentaCorrienteClienteService,
  cuentaCorrienteProveedor: cuentaCorrienteProveedorService,
  ordenesPago: ordenesPagoService,
  crucesConsolidados: crucesConsolidadosService,
  conciliacionBancaria: conciliacionBancariaService,
};
