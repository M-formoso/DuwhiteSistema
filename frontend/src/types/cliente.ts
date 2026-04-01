/**
 * Tipos para el módulo de Clientes
 */

// Estados y enums
export type TipoCliente = 'particular' | 'empresa' | 'hotel' | 'restaurante' | 'hospital' | 'gimnasio' | 'otro';
export type CondicionIVA = 'responsable_inscripto' | 'monotributo' | 'exento' | 'consumidor_final' | 'no_responsable';
export type EstadoPedido = 'borrador' | 'confirmado' | 'en_proceso' | 'listo' | 'entregado' | 'facturado' | 'cancelado';
export type TipoEntrega = 'retiro_local' | 'delivery' | 'envio';
export type TipoMovimientoCC = 'cargo' | 'pago' | 'ajuste';
export type MedioPago = 'efectivo' | 'transferencia' | 'tarjeta_debito' | 'tarjeta_credito' | 'cheque' | 'mercado_pago' | 'cuenta_corriente' | 'otro';

// Cliente
export interface Cliente {
  id: string;
  codigo: string;
  tipo: TipoCliente;
  razon_social: string;
  nombre_fantasia: string | null;
  cuit: string | null;
  condicion_iva: CondicionIVA;
  email: string | null;
  telefono: string | null;
  celular: string | null;
  contacto_nombre: string | null;
  contacto_cargo: string | null;
  direccion: string | null;
  ciudad: string | null;
  provincia: string;
  codigo_postal: string | null;
  lista_precios_id: string | null;
  descuento_general: number | null;
  limite_credito: number | null;
  dias_credito: number | null;
  saldo_cuenta_corriente: number;
  dia_retiro_preferido: string | null;
  horario_retiro_preferido: string | null;
  requiere_factura: boolean;
  enviar_notificaciones: boolean;
  fecha_alta: string | null;
  fecha_ultima_compra: string | null;
  notas: string | null;
  notas_internas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string | null;
  // Calculados
  nombre_display: string;
  tiene_deuda: boolean;
  supera_limite_credito: boolean;
}

export interface ClienteList {
  id: string;
  codigo: string;
  tipo: TipoCliente;
  razon_social: string;
  nombre_fantasia: string | null;
  cuit: string | null;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  saldo_cuenta_corriente: number;
  activo: boolean;
  tiene_deuda: boolean;
}

export interface ClienteCreate {
  tipo?: TipoCliente;
  razon_social: string;
  nombre_fantasia?: string | null;
  cuit?: string | null;
  condicion_iva?: CondicionIVA;
  email?: string | null;
  telefono?: string | null;
  celular?: string | null;
  contacto_nombre?: string | null;
  contacto_cargo?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  provincia?: string;
  codigo_postal?: string | null;
  descuento_general?: number | null;
  limite_credito?: number | null;
  dias_credito?: number | null;
  dia_retiro_preferido?: string | null;
  horario_retiro_preferido?: string | null;
  requiere_factura?: boolean;
  enviar_notificaciones?: boolean;
  notas?: string | null;
  notas_internas?: string | null;
}

// Pedido
export interface DetallePedido {
  id: string;
  servicio_id: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  descuento_porcentaje: number | null;
  subtotal: number;
  notas: string | null;
}

export interface Pedido {
  id: string;
  numero: string;
  cliente_id: string;
  estado: EstadoPedido;
  fecha_pedido: string;
  fecha_retiro: string | null;
  fecha_entrega_estimada: string | null;
  fecha_entrega_real: string | null;
  fecha_facturacion: string | null;
  tipo_entrega: TipoEntrega;
  direccion_entrega: string | null;
  horario_entrega: string | null;
  subtotal: number;
  descuento_porcentaje: number | null;
  descuento_monto: number | null;
  iva: number;
  total: number;
  saldo_pendiente: number;
  factura_numero: string | null;
  factura_tipo: string | null;
  notas: string | null;
  notas_internas: string | null;
  observaciones_entrega: string | null;
  creado_por_id: string;
  created_at: string;
  updated_at: string | null;
  detalles: DetallePedido[];
  cliente_nombre: string | null;
  creado_por_nombre: string | null;
}

export interface PedidoList {
  id: string;
  numero: string;
  cliente_id: string;
  cliente_nombre: string | null;
  estado: EstadoPedido;
  fecha_pedido: string;
  fecha_retiro: string | null;
  fecha_entrega_estimada: string | null;
  total: number;
  saldo_pendiente: number;
  tipo_entrega: TipoEntrega;
}

export interface DetallePedidoCreate {
  servicio_id?: string | null;
  descripcion: string;
  cantidad: number;
  unidad?: string;
  precio_unitario: number;
  descuento_porcentaje?: number | null;
  notas?: string | null;
}

export interface PedidoCreate {
  cliente_id: string;
  fecha_pedido: string;
  fecha_retiro?: string | null;
  fecha_entrega_estimada?: string | null;
  tipo_entrega?: TipoEntrega;
  direccion_entrega?: string | null;
  horario_entrega?: string | null;
  descuento_porcentaje?: number | null;
  notas?: string | null;
  notas_internas?: string | null;
  observaciones_entrega?: string | null;
  detalles?: DetallePedidoCreate[];
}

// Cuenta Corriente
export interface MovimientoCuentaCorriente {
  id: string;
  tipo: TipoMovimientoCC;
  concepto: string;
  monto: number;
  fecha_movimiento: string;
  saldo_anterior: number;
  saldo_posterior: number;
  factura_numero: string | null;
  recibo_numero: string | null;
  medio_pago: MedioPago | null;
  referencia_pago: string | null;
}

export interface EstadoCuenta {
  cliente_id: string;
  cliente_nombre: string;
  saldo_actual: number;
  limite_credito: number | null;
  credito_disponible: number | null;
  total_facturado_mes: number;
  total_pagado_mes: number;
  cantidad_facturas_pendientes: number;
  factura_mas_antigua_dias: number | null;
}

export interface RegistrarPagoRequest {
  monto: number;
  fecha: string;
  medio_pago: MedioPago;
  referencia_pago?: string | null;
  notas?: string | null;
  aplicar_a_pedidos?: string[];
}

// Constantes
export const TIPOS_CLIENTE = [
  { value: 'particular', label: 'Particular' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'restaurante', label: 'Restaurante' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'gimnasio', label: 'Gimnasio' },
  { value: 'otro', label: 'Otro' },
];

export const CONDICIONES_IVA = [
  { value: 'responsable_inscripto', label: 'Responsable Inscripto' },
  { value: 'monotributo', label: 'Monotributo' },
  { value: 'exento', label: 'Exento' },
  { value: 'consumidor_final', label: 'Consumidor Final' },
  { value: 'no_responsable', label: 'No Responsable' },
];

export const ESTADOS_PEDIDO = [
  { value: 'borrador', label: 'Borrador', color: 'gray' },
  { value: 'confirmado', label: 'Confirmado', color: 'blue' },
  { value: 'en_proceso', label: 'En Proceso', color: 'yellow' },
  { value: 'listo', label: 'Listo', color: 'green' },
  { value: 'entregado', label: 'Entregado', color: 'purple' },
  { value: 'facturado', label: 'Facturado', color: 'teal' },
  { value: 'cancelado', label: 'Cancelado', color: 'red' },
];

export const TIPOS_ENTREGA = [
  { value: 'retiro_local', label: 'Retiro en Local' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'envio', label: 'Envío' },
];

export const MEDIOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia Bancaria' },
  { value: 'tarjeta_debito', label: 'Tarjeta de Débito' },
  { value: 'tarjeta_credito', label: 'Tarjeta de Crédito' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
  { value: 'cuenta_corriente', label: 'Cuenta Corriente' },
  { value: 'otro', label: 'Otro' },
];
