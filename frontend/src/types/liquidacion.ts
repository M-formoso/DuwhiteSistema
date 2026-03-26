/**
 * Tipos para el módulo de Liquidaciones
 */

// Estados de liquidación
export type EstadoLiquidacion = 'borrador' | 'confirmada' | 'facturada' | 'anulada';

// Detalle de liquidación
export interface DetalleLiquidacion {
  id: string;
  liquidacion_id: string;
  servicio_id: string | null;
  servicio_nombre: string;
  descripcion: string | null;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  subtotal: number;
  lote_id: string | null;
  numero_linea: number;
  notas: string | null;
}

export interface DetalleLiquidacionCreate {
  servicio_id?: string | null;
  servicio_nombre: string;
  descripcion?: string | null;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  lote_id?: string | null;
  notas?: string | null;
}

// Liquidación
export interface Liquidacion {
  id: string;
  numero: string;
  pedido_id: string;
  cliente_id: string;
  lista_precios_id: string | null;
  fecha_liquidacion: string;
  subtotal: number;
  descuento_porcentaje: number | null;
  descuento_monto: number | null;
  iva_porcentaje: number | null;
  iva_monto: number | null;
  total: number;
  estado: EstadoLiquidacion;
  movimiento_cc_id: string | null;
  liquidado_por_id: string;
  confirmado_por_id: string | null;
  fecha_confirmacion: string | null;
  anulado: boolean;
  anulado_por_id: string | null;
  fecha_anulacion: string | null;
  motivo_anulacion: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string | null;
  activo: boolean;
  // Flags calculados
  puede_editar: boolean;
  puede_confirmar: boolean;
  puede_anular: boolean;
  // Datos relacionados
  detalles: DetalleLiquidacion[];
  cliente_nombre: string | null;
  cliente_cuit: string | null;
  pedido_numero: string | null;
  lista_precios_nombre: string | null;
  liquidado_por_nombre: string | null;
  confirmado_por_nombre: string | null;
}

export interface LiquidacionList {
  id: string;
  numero: string;
  pedido_id: string;
  pedido_numero: string | null;
  cliente_id: string;
  cliente_nombre: string | null;
  fecha_liquidacion: string;
  subtotal: number;
  total: number;
  estado: EstadoLiquidacion;
  anulado: boolean;
  created_at: string;
}

export interface LiquidacionCreate {
  pedido_id: string;
  cliente_id: string;
  lista_precios_id?: string | null;
  fecha_liquidacion: string;
  descuento_porcentaje?: number;
  iva_porcentaje?: number;
  notas?: string | null;
  detalles: DetalleLiquidacionCreate[];
}

export interface LiquidacionUpdate {
  lista_precios_id?: string | null;
  fecha_liquidacion?: string;
  descuento_porcentaje?: number;
  iva_porcentaje?: number;
  notas?: string | null;
  detalles?: DetalleLiquidacionCreate[];
}

export interface LiquidacionDesdeControl {
  pedido_id: string;
  lista_precios_id?: string | null;
  descuento_porcentaje?: number;
  detalles: DetalleLiquidacionCreate[];
  notas?: string | null;
}

export interface LiquidacionConfirmar {
  notas?: string | null;
}

export interface LiquidacionAnular {
  motivo: string;
}

// Precios para liquidación
export interface ServicioPrecio {
  servicio_id: string;
  servicio_codigo: string;
  servicio_nombre: string;
  unidad_cobro: string;
  precio: number;
  precio_minimo: number | null;
}

export interface ListaPreciosParaLiquidacion {
  lista_id: string;
  lista_nombre: string;
  servicios: ServicioPrecio[];
}

// Resumen
export interface ResumenLiquidaciones {
  total_borradores: number;
  total_confirmadas: number;
  total_facturadas: number;
  total_anuladas: number;
  monto_borradores: number;
  monto_confirmadas: number;
  monto_facturadas: number;
}

// Constantes
export const ESTADOS_LIQUIDACION = [
  { value: 'borrador', label: 'Borrador', color: 'gray' },
  { value: 'confirmada', label: 'Confirmada', color: 'blue' },
  { value: 'facturada', label: 'Facturada', color: 'green' },
  { value: 'anulada', label: 'Anulada', color: 'red' },
];

export const UNIDADES_SERVICIO = [
  { value: 'kg', label: 'Kilogramo (kg)' },
  { value: 'prenda', label: 'Prenda' },
  { value: 'unidad', label: 'Unidad' },
  { value: 'docena', label: 'Docena' },
  { value: 'metro', label: 'Metro' },
];
