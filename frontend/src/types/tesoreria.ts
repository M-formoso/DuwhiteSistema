/**
 * Tipos para el módulo de Tesorería
 */

// ==================== CHEQUE ====================

export type TipoCheque = 'fisico' | 'echeq';
export type OrigenCheque = 'recibido_cliente' | 'recibido_proveedor' | 'emitido';
export type EstadoCheque = 'en_cartera' | 'depositado' | 'cobrado' | 'entregado' | 'rechazado' | 'anulado';

export interface Cheque {
  id: string;
  numero: string;
  tipo: TipoCheque;
  origen: OrigenCheque;
  estado: EstadoCheque;
  monto: number;
  fecha_emision: string | null;
  fecha_vencimiento: string;
  fecha_cobro: string | null;
  banco_origen: string | null;
  cuenta_destino_id: string | null;
  banco_destino: string | null;
  cliente_id: string | null;
  proveedor_id: string | null;
  librador: string | null;
  cuit_librador: string | null;
  registrado_por_id: string;
  cobrado_por_id: string | null;
  notas: string | null;
  motivo_rechazo: string | null;
  created_at: string;
  activo: boolean;
  // Campos calculados
  cliente_nombre: string | null;
  proveedor_nombre: string | null;
  registrado_por_nombre: string | null;
  dias_para_vencimiento: number | null;
}

export interface ChequeList {
  id: string;
  numero: string;
  tipo: TipoCheque;
  origen: OrigenCheque;
  estado: EstadoCheque;
  monto: number;
  fecha_vencimiento: string;
  fecha_cobro: string | null;
  banco_origen: string | null;
  banco_destino: string | null;
  cliente_nombre: string | null;
  proveedor_nombre: string | null;
  dias_para_vencimiento: number | null;
}

export interface ChequeCreate {
  numero: string;
  tipo?: TipoCheque;
  origen?: OrigenCheque;
  monto: number;
  fecha_emision?: string | null;
  fecha_vencimiento: string;
  banco_origen?: string | null;
  cuenta_destino_id?: string | null;
  banco_destino?: string | null;
  cliente_id?: string | null;
  proveedor_id?: string | null;
  librador?: string | null;
  cuit_librador?: string | null;
  notas?: string | null;
}

export interface ChequeUpdate {
  numero?: string;
  tipo?: TipoCheque;
  estado?: EstadoCheque;
  monto?: number;
  fecha_emision?: string | null;
  fecha_vencimiento?: string;
  fecha_cobro?: string | null;
  banco_origen?: string | null;
  cuenta_destino_id?: string | null;
  banco_destino?: string | null;
  cliente_id?: string | null;
  proveedor_id?: string | null;
  librador?: string | null;
  cuit_librador?: string | null;
  notas?: string | null;
  motivo_rechazo?: string | null;
}

export interface DepositarChequeRequest {
  cuenta_destino_id: string;
  fecha_deposito?: string;
  notas?: string | null;
}

export interface CobrarChequeRequest {
  fecha_cobro?: string;
  notas?: string | null;
}

export interface RechazarChequeRequest {
  motivo_rechazo: string;
  fecha_rechazo?: string;
}

export interface EntregarChequeRequest {
  proveedor_id?: string | null;
  concepto: string;
  fecha_entrega?: string;
  notas?: string | null;
}

// ==================== MOVIMIENTO TESORERIA ====================

export type TipoMovimientoTesoreria =
  | 'ingreso_efectivo'
  | 'ingreso_transferencia'
  | 'ingreso_cheque'
  | 'egreso_efectivo'
  | 'egreso_transferencia'
  | 'egreso_cheque'
  | 'deposito_cheque'
  | 'cobro_cheque';

export type MetodoPagoTesoreria = 'efectivo' | 'transferencia' | 'cheque';

export interface MovimientoTesoreria {
  id: string;
  tipo: string;
  concepto: string;
  descripcion: string | null;
  monto: number;
  es_ingreso: boolean;
  fecha_movimiento: string;
  fecha_valor: string | null;
  metodo_pago: MetodoPagoTesoreria;
  banco_origen: string | null;
  banco_destino: string | null;
  cuenta_destino_id: string | null;
  numero_transferencia: string | null;
  cheque_id: string | null;
  cliente_id: string | null;
  proveedor_id: string | null;
  registrado_por_id: string;
  notas: string | null;
  comprobante: string | null;
  anulado: boolean;
  motivo_anulacion: string | null;
  created_at: string;
  activo: boolean;
  // Campos calculados
  cliente_nombre: string | null;
  proveedor_nombre: string | null;
  registrado_por_nombre: string | null;
  cheque_numero: string | null;
}

export interface MovimientoTesoreriaList {
  id: string;
  tipo: string;
  concepto: string;
  monto: number;
  es_ingreso: boolean;
  fecha_movimiento: string;
  metodo_pago: MetodoPagoTesoreria;
  cliente_nombre: string | null;
  proveedor_nombre: string | null;
  cheque_numero: string | null;
  anulado: boolean;
}

export interface MovimientoTesoreriaCreate {
  tipo: string;
  concepto: string;
  descripcion?: string | null;
  monto: number;
  es_ingreso: boolean;
  fecha_movimiento: string;
  fecha_valor?: string | null;
  metodo_pago: MetodoPagoTesoreria;
  banco_origen?: string | null;
  banco_destino?: string | null;
  cuenta_destino_id?: string | null;
  numero_transferencia?: string | null;
  cheque_id?: string | null;
  cliente_id?: string | null;
  proveedor_id?: string | null;
  notas?: string | null;
  comprobante?: string | null;
}

export interface AnularMovimientoRequest {
  motivo: string;
}

// ==================== MOVIMIENTO CONSOLIDADO ====================

export interface MovimientoConsolidado {
  id: string;
  fecha: string;
  tipo: string;
  origen: 'cheque' | 'movimiento_tesoreria' | 'movimiento_bancario';
  concepto: string;
  monto: number;
  es_ingreso: boolean;
  metodo_pago: string | null;
  cliente_id: string | null;
  cliente_nombre: string | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  numero_referencia: string | null;
  banco: string | null;
  estado: string | null;
  created_at: string;
}

export interface MovimientosConsolidadosResponse {
  items: MovimientoConsolidado[];
  total: number;
  total_ingresos: number;
  total_egresos: number;
  skip: number;
  limit: number;
}

// ==================== RESUMEN ====================

export interface ResumenTesoreria {
  cheques_en_cartera: number;
  total_cheques_cartera: number;
  cheques_proximos_vencer: number;
  total_proximos_vencer: number;
  cheques_vencidos: number;
  total_vencidos: number;
  total_ingresos_efectivo: number;
  total_ingresos_transferencia: number;
  total_ingresos_cheque: number;
  total_egresos_efectivo: number;
  total_egresos_transferencia: number;
  total_egresos_cheque: number;
  saldo_periodo: number;
}

// ==================== CONSTANTES ====================

export const TIPOS_CHEQUE = [
  { value: 'fisico', label: 'Cheque Físico' },
  { value: 'echeq', label: 'E-Cheq' },
];

export const ORIGENES_CHEQUE = [
  { value: 'recibido_cliente', label: 'Recibido de Cliente' },
  { value: 'recibido_proveedor', label: 'Recibido de Proveedor' },
  { value: 'emitido', label: 'Emitido (Propio)' },
];

export const ESTADOS_CHEQUE = [
  { value: 'en_cartera', label: 'En Cartera', color: 'blue' },
  { value: 'depositado', label: 'Depositado', color: 'yellow' },
  { value: 'cobrado', label: 'Cobrado', color: 'green' },
  { value: 'entregado', label: 'Entregado', color: 'purple' },
  { value: 'rechazado', label: 'Rechazado', color: 'red' },
  { value: 'anulado', label: 'Anulado', color: 'gray' },
];

export const METODOS_PAGO_TESORERIA = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cheque', label: 'Cheque' },
];

export const BANCOS_ARGENTINA = [
  'Banco Nación',
  'Banco Provincia',
  'Banco Ciudad',
  'Banco Galicia',
  'Banco Santander',
  'BBVA',
  'Banco Macro',
  'Banco Patagonia',
  'HSBC',
  'Banco ICBC',
  'Banco Credicoop',
  'Banco Hipotecario',
  'Banco Supervielle',
  'Banco Comafi',
  'Banco de Córdoba',
  'Banco de San Juan',
  'Brubank',
  'Mercado Pago',
  'Naranja X',
  'Ualá',
  'Otro',
];
