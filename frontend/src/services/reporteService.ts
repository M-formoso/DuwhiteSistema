/**
 * Servicio de Reportes
 */

import api from './api';

// ==================== TIPOS ====================

export interface EstadisticasRapidas {
  hoy: {
    pedidos: number;
    total: number;
  };
  semana: {
    pedidos: number;
    total: number;
  };
  mes: {
    pedidos: number;
    total: number;
  };
  produccion: {
    lotes_en_proceso: number;
  };
  stock: {
    critico: number;
  };
  clientes: {
    activos: number;
  };
}

export interface VentasPeriodo {
  periodo: string;
  periodo_label: string;
  cantidad_pedidos: number;
  subtotal: number;
  descuentos: number;
  total: number;
}

export interface VentasCliente {
  cliente_id: string;
  cliente_nombre: string;
  cantidad_pedidos: number;
  total: number;
  promedio_pedido: number;
}

export interface VentasServicio {
  servicio_id: string;
  servicio_nombre: string;
  cantidad_items: number;
  unidades_vendidas: number;
  total: number;
}

export interface ProduccionPeriodo {
  periodo: string;
  cantidad_lotes: number;
  kg_total: number;
  lotes_completados: number;
  lotes_en_proceso: number;
}

export interface ProduccionEtapa {
  etapa_id: string;
  etapa_nombre: string;
  cantidad_procesos: number;
  promedio_horas: number;
}

export interface FlujoCaja {
  periodo: string;
  ingresos: number;
  egresos: number;
  balance: number;
}

export interface MovimientoCategoria {
  categoria: string;
  tipo: 'ingreso' | 'egreso';
  cantidad: number;
  total: number;
}

export interface MovimientoStock {
  insumo_id: string;
  insumo_nombre: string;
  unidad_medida: string;
  entradas: number;
  salidas: number;
  neto: number;
}

export interface StockBajoMinimo {
  insumo_id: string;
  codigo: string;
  nombre: string;
  unidad_medida: string;
  stock_actual: number;
  stock_minimo: number;
  diferencia: number;
  porcentaje: number;
}

export interface StockActual {
  insumo_id: string;
  codigo: string;
  nombre: string;
  categoria: string | null;
  unidad_medida: string;
  stock_actual: number;
  stock_minimo: number;
  stock_maximo: number | null;
  precio_unitario: number;
  valor_total: number;
  estado: 'critico' | 'bajo' | 'ok';
}

export interface AsistenciaEmpleado {
  empleado_id: string;
  empleado_nombre: string;
  dias_registrados: number;
  horas_trabajadas: number;
  horas_extra: number;
  llegadas_tarde: number;
  ausencias: number;
}

export interface ResumenGeneral {
  periodo: {
    desde: string;
    hasta: string;
  };
  ventas: {
    cantidad_pedidos: number;
    total: number;
  };
  produccion: {
    cantidad_lotes: number;
    kg_procesados: number;
    lotes_completados: number;
  };
  finanzas: {
    ingresos: number;
    egresos: number;
    balance: number;
  };
  clientes_nuevos: number;
  stock_critico: number;
}

export type Agrupacion = 'dia' | 'semana' | 'mes';

interface FiltroFechas {
  fecha_desde: string;
  fecha_hasta: string;
}

// ==================== FUNCIONES ====================

export async function getEstadisticasRapidas(): Promise<EstadisticasRapidas> {
  const response = await api.get('/reportes/estadisticas');
  return response.data;
}

// Ventas
export async function getVentasPorPeriodo(
  params: FiltroFechas & { agrupacion?: Agrupacion }
): Promise<VentasPeriodo[]> {
  const response = await api.get('/reportes/ventas/periodo', { params });
  return response.data;
}

export async function getVentasPorCliente(
  params: FiltroFechas & { limit?: number }
): Promise<VentasCliente[]> {
  const response = await api.get('/reportes/ventas/clientes', { params });
  return response.data;
}

export async function getVentasPorServicio(
  params: FiltroFechas
): Promise<VentasServicio[]> {
  const response = await api.get('/reportes/ventas/servicios', { params });
  return response.data;
}

// Produccion
export async function getProduccionPorPeriodo(
  params: FiltroFechas & { agrupacion?: Agrupacion }
): Promise<ProduccionPeriodo[]> {
  const response = await api.get('/reportes/produccion/periodo', { params });
  return response.data;
}

export async function getProduccionPorEtapa(
  params: FiltroFechas
): Promise<ProduccionEtapa[]> {
  const response = await api.get('/reportes/produccion/etapas', { params });
  return response.data;
}

// Finanzas
export async function getFlujoCaja(
  params: FiltroFechas & { agrupacion?: Agrupacion }
): Promise<FlujoCaja[]> {
  const response = await api.get('/reportes/finanzas/flujo-caja', { params });
  return response.data;
}

export async function getMovimientosPorCategoria(
  params: FiltroFechas & { tipo?: 'ingreso' | 'egreso' }
): Promise<MovimientoCategoria[]> {
  const response = await api.get('/reportes/finanzas/categorias', { params });
  return response.data;
}

// Stock
export async function getMovimientosStock(
  params: FiltroFechas & { insumo_id?: string }
): Promise<MovimientoStock[]> {
  const response = await api.get('/reportes/stock/movimientos', { params });
  return response.data;
}

export async function getStockBajoMinimo(): Promise<StockBajoMinimo[]> {
  const response = await api.get('/reportes/stock/bajo-minimo');
  return response.data;
}

export async function getStockActual(): Promise<StockActual[]> {
  const response = await api.get('/reportes/stock/actual');
  return response.data;
}

// Empleados
export async function getAsistenciaEmpleados(
  params: FiltroFechas & { empleado_id?: string }
): Promise<AsistenciaEmpleado[]> {
  const response = await api.get('/reportes/empleados/asistencia', { params });
  return response.data;
}

// Resumen
export async function getResumenGeneral(params: FiltroFechas): Promise<ResumenGeneral> {
  const response = await api.get('/reportes/resumen', { params });
  return response.data;
}

export async function getReporteHoy(): Promise<ResumenGeneral> {
  const response = await api.get('/reportes/rapidos/hoy');
  return response.data;
}

export async function getReporteSemana(): Promise<ResumenGeneral> {
  const response = await api.get('/reportes/rapidos/semana');
  return response.data;
}

export async function getReporteMes(): Promise<ResumenGeneral> {
  const response = await api.get('/reportes/rapidos/mes');
  return response.data;
}

// ==================== EXPORTS ====================

export const reporteService = {
  getEstadisticasRapidas,
  // Ventas
  getVentasPorPeriodo,
  getVentasPorCliente,
  getVentasPorServicio,
  // Produccion
  getProduccionPorPeriodo,
  getProduccionPorEtapa,
  // Finanzas
  getFlujoCaja,
  getMovimientosPorCategoria,
  // Stock
  getMovimientosStock,
  getStockBajoMinimo,
  getStockActual,
  // Empleados
  getAsistenciaEmpleados,
  // Resumen
  getResumenGeneral,
  getReporteHoy,
  getReporteSemana,
  getReporteMes,
};

export default reporteService;
