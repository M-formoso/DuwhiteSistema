/**
 * Tipos para el módulo de Finanzas
 */

// Estados y enums
export type EstadoCaja = 'abierta' | 'cerrada';
export type TipoMovimientoCaja = 'ingreso' | 'egreso';
export type CategoriaMovimiento =
  | 'venta'
  | 'cobro_cliente'
  | 'otro_ingreso'
  | 'pago_proveedor'
  | 'pago_empleado'
  | 'gasto_operativo'
  | 'compra_insumos'
  | 'servicio'
  | 'impuesto'
  | 'retiro'
  | 'otro_egreso';

export type TipoCuentaBancaria = 'caja_ahorro' | 'cuenta_corriente';
export type TipoMovimientoBanco =
  | 'deposito'
  | 'extraccion'
  | 'transferencia_entrada'
  | 'transferencia_salida'
  | 'debito_automatico'
  | 'credito'
  | 'comision'
  | 'interes'
  | 'cheque_emitido'
  | 'cheque_depositado';

// Caja
export interface Caja {
  id: string;
  numero: number;
  fecha: string;
  estado: EstadoCaja;
  saldo_inicial: number;
  total_ingresos: number;
  total_egresos: number;
  saldo_final: number | null;
  saldo_real: number | null;
  diferencia: number | null;
  abierta_por_id: string;
  fecha_apertura: string;
  cerrada_por_id: string | null;
  fecha_cierre: string | null;
  observaciones_apertura: string | null;
  observaciones_cierre: string | null;
  created_at: string;
  saldo_calculado: number;
  abierta_por_nombre: string | null;
  cerrada_por_nombre: string | null;
}

export interface CajaList {
  id: string;
  numero: number;
  fecha: string;
  estado: EstadoCaja;
  saldo_inicial: number;
  total_ingresos: number;
  total_egresos: number;
  saldo_final: number | null;
  diferencia: number | null;
}

export interface AbrirCajaRequest {
  saldo_inicial: number;
  observaciones_apertura?: string | null;
}

export interface CerrarCajaRequest {
  saldo_real: number;
  observaciones_cierre?: string | null;
}

// Movimiento de Caja
export interface MovimientoCaja {
  id: string;
  caja_id: string;
  tipo: TipoMovimientoCaja;
  categoria: CategoriaMovimiento;
  concepto: string;
  descripcion: string | null;
  monto: number;
  medio_pago: string;
  referencia: string | null;
  cliente_id: string | null;
  proveedor_id: string | null;
  pedido_id: string | null;
  recibo_id: string | null;
  registrado_por_id: string;
  anulado: boolean;
  fecha_anulacion: string | null;
  motivo_anulacion: string | null;
  created_at: string;
  cliente_nombre: string | null;
  proveedor_nombre: string | null;
  registrado_por_nombre: string | null;
}

export interface MovimientoCajaCreate {
  tipo: TipoMovimientoCaja;
  categoria: CategoriaMovimiento;
  concepto: string;
  descripcion?: string | null;
  monto: number;
  medio_pago?: string;
  referencia?: string | null;
  cliente_id?: string | null;
  proveedor_id?: string | null;
  pedido_id?: string | null;
}

// Cuenta Bancaria
export interface CuentaBancaria {
  id: string;
  nombre?: string;
  banco: string;
  tipo_cuenta: TipoCuentaBancaria | string;
  numero_cuenta: string;
  cbu: string | null;
  alias: string | null;
  titular: string;
  cuit_titular?: string | null;
  saldo_actual: number;
  saldo_inicial?: number;
  saldo_disponible?: number | null;
  activa?: boolean;
  activo?: boolean;
  es_principal?: boolean;
  notas?: string | null;
  moneda?: string;
  created_at?: string;
  updated_at?: string | null;
}

// Movimiento Bancario
export interface MovimientoBancario {
  id: string;
  cuenta_id: string;
  tipo: TipoMovimientoBanco | string;
  concepto?: string;
  descripcion?: string | null;
  monto: number;
  fecha: string;
  saldo_anterior?: number;
  saldo_posterior?: number;
  fecha_movimiento?: string;
  fecha_valor?: string | null;
  numero_comprobante?: string | null;
  referencia_externa?: string | null;
  cliente_id?: string | null;
  proveedor_id?: string | null;
  conciliado?: boolean;
  fecha_conciliacion?: string | null;
  registrado_por_id?: string;
  categoria?: string;
  created_at?: string;
  cuenta_nombre?: string | null;
  cliente_nombre?: string | null;
  proveedor_nombre?: string | null;
}

// Resumen Financiero
export interface ResumenCajaDiario {
  fecha: string;
  caja_numero: number | null;
  estado: string | null;
  saldo_inicial: number;
  total_ingresos: number;
  total_egresos: number;
  saldo_actual: number;
  cantidad_movimientos: number;
}

export interface ResumenCaja {
  ingresos: number;
  egresos: number;
  saldo_actual: number;
  total_movimientos: number;
  movimientos_por_categoria?: Record<string, number>;
}

export interface ResumenBancos {
  ingresos: number;
  egresos: number;
  saldo_total: number;
  total_movimientos: number;
}

export interface MovimientoResumen {
  fecha: string;
  tipo: string;
  monto: number;
  descripcion?: string;
  categoria?: string;
  origen: 'caja' | 'banco';
}

export interface ResumenFinanciero {
  caja_actual?: ResumenCajaDiario | null;
  total_ingresos_periodo?: number;
  total_egresos_periodo?: number;
  balance_periodo?: number;
  ingresos_por_categoria?: Record<string, number>;
  egresos_por_categoria?: Record<string, number>;
  total_en_bancos?: number;
  // Nueva estructura alternativa
  caja?: ResumenCaja;
  bancos?: ResumenBancos;
  ultimos_movimientos?: MovimientoResumen[];
}

// Constantes
export const CATEGORIAS_INGRESO = [
  { value: 'venta', label: 'Venta' },
  { value: 'cobro_cliente', label: 'Cobro a Cliente' },
  { value: 'otro_ingreso', label: 'Otro Ingreso' },
];

export const CATEGORIAS_EGRESO = [
  { value: 'pago_proveedor', label: 'Pago a Proveedor' },
  { value: 'pago_empleado', label: 'Pago a Empleado' },
  { value: 'gasto_operativo', label: 'Gasto Operativo' },
  { value: 'compra_insumos', label: 'Compra de Insumos' },
  { value: 'servicio', label: 'Servicio (Luz, Agua, Gas)' },
  { value: 'impuesto', label: 'Impuesto' },
  { value: 'retiro', label: 'Retiro' },
  { value: 'otro_egreso', label: 'Otro Egreso' },
];

export const MEDIOS_PAGO_CAJA = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta_debito', label: 'Tarjeta Débito' },
  { value: 'tarjeta_credito', label: 'Tarjeta Crédito' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
];

export const TIPOS_CUENTA_BANCARIA = [
  { value: 'caja_ahorro', label: 'Caja de Ahorro' },
  { value: 'cuenta_corriente', label: 'Cuenta Corriente' },
];
