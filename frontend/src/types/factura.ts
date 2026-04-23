/**
 * Types de Facturación (espejo de schemas/factura.py).
 */

export type TipoComprobante =
  | 'factura_a'
  | 'factura_b'
  | 'nota_credito_a'
  | 'nota_credito_b'
  | 'nota_debito_a'
  | 'nota_debito_b';

export type EstadoFactura = 'borrador' | 'autorizada' | 'rechazada' | 'anulada';

export type EstadoPago = 'sin_cobrar' | 'parcial' | 'pagada' | 'no_aplica';

export type LetraFactura = 'A' | 'B';

export type CondicionVenta = 'contado' | 'cuenta_corriente';

export interface FacturaDetalle {
  id: string;
  detalle_pedido_id?: string | null;
  producto_lavado_id?: string | null;
  descripcion: string;
  cantidad: string | number;
  unidad_medida: string;
  precio_unitario_neto: string | number;
  descuento_porcentaje: string | number;
  iva_porcentaje: string | number;
  subtotal_neto: string | number;
  iva_monto: string | number;
  total_linea: string | number;
}

export interface FacturaDetalleCreate {
  descripcion: string;
  cantidad: number;
  unidad_medida?: string;
  precio_unitario_neto: number;
  descuento_porcentaje?: number;
  iva_porcentaje?: number;
  detalle_pedido_id?: string | null;
  producto_lavado_id?: string | null;
}

export interface Factura {
  id: string;
  tipo: TipoComprobante;
  letra: LetraFactura | '';
  punto_venta: number;
  numero_comprobante: number | null;
  numero_completo: string | null;

  cliente_id: string;
  cliente_razon_social_snap: string;
  cliente_cuit_snap: string | null;
  cliente_documento_tipo_snap: string | null;
  cliente_documento_nro_snap: string | null;
  cliente_condicion_iva_snap: string;
  cliente_domicilio_snap: string | null;

  pedido_id: string | null;
  factura_original_id: string | null;

  fecha_emision: string;
  fecha_servicio_desde: string | null;
  fecha_servicio_hasta: string | null;
  fecha_vencimiento_pago: string | null;

  concepto_afip: string;
  condicion_venta: CondicionVenta;

  subtotal: string;
  descuento_monto: string;
  neto_gravado_21: string;
  neto_gravado_105: string;
  neto_no_gravado: string;
  iva_21: string;
  iva_105: string;
  percepciones: string;
  total: string;

  estado: EstadoFactura;
  estado_pago: EstadoPago;
  monto_pagado: string;
  fecha_ultimo_cobro: string | null;
  cae: string | null;
  cae_vencimiento: string | null;
  afip_resultado: string | null;
  afip_observaciones: string | null;
  afip_errores: string | null;
  emitido_at: string | null;

  anulada_por_nc_id: string | null;
  observaciones: string | null;
  motivo: string | null;

  movimiento_cuenta_corriente_id: string | null;
  creado_por_id: string;
  emitido_por_id: string | null;
  created_at: string;
  updated_at: string | null;

  detalles: FacturaDetalle[];
}

export interface FacturaListItem {
  id: string;
  tipo: TipoComprobante;
  letra: LetraFactura | '';
  punto_venta: number;
  numero_completo: string | null;
  cliente_id: string;
  cliente_razon_social_snap: string;
  fecha_emision: string;
  total: string;
  estado: EstadoFactura;
  estado_pago: EstadoPago;
  monto_pagado: string;
  cae: string | null;
}

export interface FacturaListResponse {
  items: FacturaListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface FacturaCreateDesdePedido {
  pedido_id: string;
  fecha_emision?: string;
  concepto_afip?: string;
  fecha_servicio_desde?: string;
  fecha_servicio_hasta?: string;
  fecha_vencimiento_pago?: string;
  condicion_venta?: CondicionVenta;
  observaciones?: string;
}

export interface FacturaCreateManual {
  cliente_id: string;
  fecha_emision?: string;
  concepto_afip?: string;
  fecha_servicio_desde?: string;
  fecha_servicio_hasta?: string;
  fecha_vencimiento_pago?: string;
  condicion_venta?: CondicionVenta;
  observaciones?: string;
  detalles: FacturaDetalleCreate[];
}

export interface NotaCreditoItem {
  detalle_id?: string;
  descripcion: string;
  cantidad: number;
  precio_unitario_neto: number;
  iva_porcentaje?: number;
}

export interface NotaCreditoCreate {
  motivo: string;
  fecha_emision?: string;
  total?: boolean;
  detalles?: NotaCreditoItem[];
  observaciones?: string;
}

export interface NotaDebitoCreate {
  motivo: string;
  fecha_emision?: string;
  detalles: FacturaDetalleCreate[];
  observaciones?: string;
}

export interface EmitirFacturaResponse {
  id: string;
  estado: EstadoFactura;
  cae: string | null;
  cae_vencimiento: string | null;
  numero_completo: string | null;
  resultado: string | null;
  observaciones: string | null;
  errores: string | null;
}

export interface FacturaFiltros {
  cliente_id?: string;
  tipo?: TipoComprobante;
  estado?: EstadoFactura;
  estado_pago?: EstadoPago;
  fecha_desde?: string;
  fecha_hasta?: string;
  numero?: string;
  page?: number;
  page_size?: number;
}

export interface RegistrarCobroRequest {
  monto: number;
  fecha_cobro?: string;
  medio_pago?: string;
  referencia_pago?: string;
  observaciones?: string;
}

export interface RegistrarCobroResponse {
  factura_id: string;
  estado_pago: EstadoPago;
  monto_pagado: string;
  monto_adeudado: string;
  movimiento_cuenta_corriente_id: string;
}

export const TIPOS_COMPROBANTE_LABEL: Record<TipoComprobante, string> = {
  factura_a: 'Factura A',
  factura_b: 'Factura B',
  nota_credito_a: 'Nota de Crédito A',
  nota_credito_b: 'Nota de Crédito B',
  nota_debito_a: 'Nota de Débito A',
  nota_debito_b: 'Nota de Débito B',
};

export const ESTADOS_FACTURA_COLOR: Record<EstadoFactura, string> = {
  borrador: 'bg-gray-100 text-gray-700',
  autorizada: 'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-700',
  anulada: 'bg-orange-100 text-orange-700',
};

export const ESTADOS_FACTURA_LABEL: Record<EstadoFactura, string> = {
  borrador: 'Borrador',
  autorizada: 'Autorizada',
  rechazada: 'Rechazada',
  anulada: 'Anulada',
};

export const ESTADOS_PAGO_LABEL: Record<EstadoPago, string> = {
  sin_cobrar: 'Impaga',
  parcial: 'Parcial',
  pagada: 'Pagada',
  no_aplica: 'N/A',
};

export const ESTADOS_PAGO_COLOR: Record<EstadoPago, string> = {
  sin_cobrar: 'bg-red-100 text-red-700',
  parcial: 'bg-amber-100 text-amber-800',
  pagada: 'bg-green-100 text-green-700',
  no_aplica: 'bg-gray-100 text-gray-600',
};

export const MEDIOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta_debito', label: 'Tarjeta de débito' },
  { value: 'tarjeta_credito', label: 'Tarjeta de crédito' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'mercado_pago', label: 'MercadoPago' },
  { value: 'otro', label: 'Otro' },
];
