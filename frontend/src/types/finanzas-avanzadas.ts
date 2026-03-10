/**
 * Tipos para funcionalidades avanzadas de Finanzas
 * - Cuenta Corriente Proveedor
 * - Órdenes de Pago
 * - Cruces Consolidados
 * - Conciliación Bancaria
 */

// ==================== CUENTA CORRIENTE PROVEEDOR ====================

export type TipoMovimientoCCProveedor = 'cargo' | 'pago' | 'ajuste_credito' | 'ajuste_debito';
export type EstadoPagoProveedor = 'pendiente' | 'parcial' | 'pagado';

export interface MovimientoCCProveedor {
  id: string;
  proveedor_id: string;
  tipo: TipoMovimientoCCProveedor;
  concepto: string;
  monto: number;
  saldo_anterior: number;
  saldo_posterior: number;
  fecha_movimiento: string;
  factura_numero: string | null;
  fecha_factura: string | null;
  fecha_vencimiento: string | null;
  saldo_comprobante: number | null;
  estado_pago: EstadoPagoProveedor | null;
  recepcion_compra_id: string | null;
  orden_pago_id: string | null;
  registrado_por_id: string;
  notas: string | null;
  anulado: boolean;
  created_at: string;
}

export interface MovimientoCCProveedorList {
  id: string;
  proveedor_id: string;
  tipo: TipoMovimientoCCProveedor;
  concepto: string;
  monto: number;
  saldo_anterior: number;
  saldo_posterior: number;
  fecha_movimiento: string;
  factura_numero: string | null;
  saldo_comprobante: number | null;
  estado_pago: EstadoPagoProveedor | null;
  created_at: string;
}

export interface RegistrarCargoProveedorRequest {
  monto: number;
  concepto: string;
  factura_numero?: string | null;
  fecha_factura?: string | null;
  fecha_vencimiento?: string | null;
  fecha_movimiento?: string | null;
  recepcion_compra_id?: string | null;
}

export interface RegistrarPagoProveedorRequest {
  monto: number;
  concepto: string;
  fecha_movimiento?: string | null;
  orden_pago_id?: string | null;
}

export interface EstadoCuentaProveedor {
  proveedor_id: string;
  proveedor_nombre: string;
  proveedor_cuit: string | null;
  saldo_actual: number;
  total_cargos: number;
  total_pagos: number;
  comprobantes_pendientes: number;
  fecha_ultimo_movimiento: string | null;
  movimientos: MovimientoCCProveedorList[];
}

export interface ComprobanteVencimiento {
  id: string;
  proveedor_id: string;
  proveedor_nombre: string;
  factura_numero: string | null;
  concepto: string;
  monto: number;
  saldo_pendiente: number;
  fecha_vencimiento: string | null;
  dias_vencido: number;
  estado: string;
}

export interface AnalisisVencimientos {
  total_pendiente: number;
  por_vencer: ComprobanteVencimiento[];
  vencido_0_30: ComprobanteVencimiento[];
  vencido_30_60: ComprobanteVencimiento[];
  vencido_60_90: ComprobanteVencimiento[];
  vencido_90_plus: ComprobanteVencimiento[];
  resumen: {
    por_vencer: number;
    vencido_0_30: number;
    vencido_30_60: number;
    vencido_60_90: number;
    vencido_90_plus: number;
  };
}

// ==================== ÓRDENES DE PAGO ====================

export type EstadoOrdenPago = 'borrador' | 'confirmada' | 'pagada' | 'anulada';
export type MedioPago = 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta_debito';

export interface OrdenPago {
  id: string;
  numero: string;
  proveedor_id: string;
  fecha_emision: string;
  fecha_pago_programada: string | null;
  fecha_pago_real: string | null;
  estado: EstadoOrdenPago;
  monto_total: number;
  monto_pagado: number | null;
  medio_pago: MedioPago | null;
  cuenta_bancaria_id: string | null;
  referencia_pago: string | null;
  concepto: string | null;
  notas: string | null;
  anulado: boolean;
  fecha_anulacion: string | null;
  motivo_anulacion: string | null;
  creado_por_id: string;
  pagado_por_id: string | null;
  anulado_por_id: string | null;
  created_at: string;
  updated_at: string | null;
  // Relaciones
  proveedor_nombre: string | null;
  proveedor_cuit: string | null;
  cuenta_bancaria_nombre: string | null;
  detalles: DetalleOrdenPago[];
  // Flags de acción
  puede_editar: boolean;
  puede_confirmar: boolean;
  puede_pagar: boolean;
  puede_anular: boolean;
}

export interface OrdenPagoList {
  id: string;
  numero: string;
  proveedor_id: string;
  proveedor_nombre: string | null;
  fecha_emision: string;
  fecha_pago_programada: string | null;
  fecha_pago_real: string | null;
  estado: EstadoOrdenPago;
  monto_total: number;
  monto_pagado: number | null;
  cantidad_comprobantes: number;
  anulado: boolean;
  created_at: string;
}

export interface DetalleOrdenPago {
  id: string;
  movimiento_id: string;
  descripcion: string | null;
  monto_comprobante: number;
  monto_pendiente_antes: number;
  monto_a_pagar: number;
  numero_linea: number;
  factura_numero: string | null;
  fecha_factura: string | null;
  fecha_vencimiento: string | null;
}

export interface DetalleOrdenPagoCreate {
  movimiento_id: string;
  monto_a_pagar: number;
  descripcion?: string | null;
}

export interface OrdenPagoCreate {
  proveedor_id: string;
  fecha_emision: string;
  fecha_pago_programada?: string | null;
  concepto?: string | null;
  notas?: string | null;
  detalles: DetalleOrdenPagoCreate[];
}

export interface OrdenPagoUpdate {
  fecha_pago_programada?: string | null;
  concepto?: string | null;
  notas?: string | null;
  detalles?: DetalleOrdenPagoCreate[] | null;
}

export interface PagarOrdenPagoRequest {
  fecha_pago: string;
  medio_pago: MedioPago;
  cuenta_bancaria_id?: string | null;
  referencia_pago?: string | null;
}

export interface ResumenOrdenesPago {
  total_borrador: number;
  total_confirmadas: number;
  total_pagadas: number;
  cantidad_borrador: number;
  cantidad_confirmadas: number;
  cantidad_pagadas: number;
}

// ==================== CRUCES CONSOLIDADOS ====================

export interface EntidadConsolidada {
  id: string;
  cuit: string;
  razon_social: string;
  es_cliente: boolean;
  es_proveedor: boolean;
  cliente_id: string | null;
  proveedor_id: string | null;
  saldo_como_cliente: number;
  saldo_como_proveedor: number;
  saldo_neto: number;
  activo: boolean;
  created_at: string;
  updated_at: string | null;
  tiene_cruce: boolean;
  cliente_nombre: string | null;
  proveedor_nombre: string | null;
}

export interface EntidadConsolidadaList {
  id: string;
  cuit: string;
  razon_social: string;
  es_cliente: boolean;
  es_proveedor: boolean;
  saldo_como_cliente: number;
  saldo_como_proveedor: number;
  saldo_neto: number;
  tiene_cruce: boolean;
}

export interface SaldoConsolidadoDetalle {
  entidad_id: string;
  cuit: string;
  razon_social: string;
  saldo_cliente: number;
  saldo_proveedor: number;
  saldo_neto: number;
  cliente_id: string | null;
  proveedor_id: string | null;
  cantidad_facturas_cliente: number;
  cantidad_facturas_proveedor: number;
}

export interface SincronizarEntidadesResponse {
  entidades_creadas: number;
  entidades_actualizadas: number;
  total_procesadas: number;
}

export interface ResumenCruces {
  total_entidades: number;
  total_cruzadas: number;
  saldo_total_a_favor: number;
  saldo_total_en_contra: number;
  saldo_neto_global: number;
}

// ==================== CONCILIACIÓN BANCARIA ====================

export type EstadoConciliacion = 'en_proceso' | 'completada';

export interface ConciliacionBancaria {
  id: string;
  cuenta_id: string;
  fecha_desde: string;
  fecha_hasta: string;
  estado: EstadoConciliacion;
  saldo_extracto_bancario: number | null;
  saldo_sistema: number | null;
  diferencia: number | null;
  cantidad_conciliados: number;
  monto_conciliado: number;
  creado_por_id: string;
  finalizado_por_id: string | null;
  fecha_finalizacion: string | null;
  notas: string | null;
  created_at: string;
  items: ItemConciliacion[];
  cuenta_nombre: string | null;
  cuenta_banco: string | null;
  cantidad_pendientes: number;
  esta_finalizada: boolean;
}

export interface ConciliacionBancariaList {
  id: string;
  cuenta_id: string;
  cuenta_nombre: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  estado: EstadoConciliacion;
  cantidad_conciliados: number;
  cantidad_pendientes: number;
  diferencia: number | null;
  created_at: string;
}

export interface ItemConciliacion {
  id: string;
  movimiento_bancario_id: string;
  conciliado: boolean;
  fecha_conciliacion: string | null;
  referencia_extracto: string | null;
  notas: string | null;
  tipo_movimiento: string | null;
  concepto: string | null;
  monto: number | null;
  fecha_movimiento: string | null;
  referencia_externa: string | null;
}

export interface ConciliacionBancariaCreate {
  cuenta_id: string;
  fecha_desde: string;
  fecha_hasta: string;
  saldo_extracto_bancario?: number | null;
}

export interface ConciliarMovimientoRequest {
  movimiento_bancario_id: string;
  referencia_extracto?: string | null;
  notas?: string | null;
}

export interface FinalizarConciliacionRequest {
  saldo_extracto_bancario: number;
  notas?: string | null;
}

export interface MovimientoSinConciliar {
  id: string;
  cuenta_id: string;
  tipo: string;
  concepto: string;
  monto: number;
  fecha_movimiento: string;
  referencia_externa: string | null;
  numero_comprobante: string | null;
  cliente_nombre: string | null;
  proveedor_nombre: string | null;
}

export interface ResumenConciliacionCuenta {
  cuenta_id: string;
  cuenta_nombre: string;
  saldo_actual: number;
  total_movimientos: number;
  movimientos_conciliados: number;
  movimientos_sin_conciliar: number;
  porcentaje_conciliado: number;
  ultima_conciliacion_fecha: string | null;
  ultima_conciliacion_diferencia: number | null;
}

// ==================== CONSTANTES ====================

export const TIPOS_MOVIMIENTO_CC_PROVEEDOR = [
  { value: 'cargo', label: 'Cargo (Factura)', color: 'red' },
  { value: 'pago', label: 'Pago', color: 'green' },
  { value: 'ajuste_credito', label: 'Ajuste a Favor', color: 'blue' },
  { value: 'ajuste_debito', label: 'Ajuste en Contra', color: 'orange' },
];

export const ESTADOS_ORDEN_PAGO = [
  { value: 'borrador', label: 'Borrador', color: 'gray' },
  { value: 'confirmada', label: 'Confirmada', color: 'blue' },
  { value: 'pagada', label: 'Pagada', color: 'green' },
  { value: 'anulada', label: 'Anulada', color: 'red' },
];

export const MEDIOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia Bancaria' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'tarjeta_debito', label: 'Tarjeta de Débito' },
];

export const ESTADOS_CONCILIACION = [
  { value: 'en_proceso', label: 'En Proceso', color: 'yellow' },
  { value: 'completada', label: 'Completada', color: 'green' },
];
