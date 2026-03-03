/**
 * Tipos para el módulo de Proveedores
 */

// Proveedor
export interface Proveedor {
  id: string;
  razon_social: string;
  nombre_fantasia: string | null;
  cuit: string;
  direccion: string | null;
  ciudad: string | null;
  provincia: string;
  codigo_postal: string | null;
  telefono: string | null;
  email: string | null;
  sitio_web: string | null;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_email: string | null;
  condicion_pago: string | null;
  dias_entrega_estimados: string | null;
  descuento_habitual: string | null;
  rubro: string | null;
  activo: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string | null;
  is_active: boolean;
  // Campos calculados
  nombre_display: string | null;
  cuit_formateado: string | null;
  cantidad_productos: number | null;
  cantidad_ordenes: number | null;
}

export interface ProveedorCreate {
  razon_social: string;
  nombre_fantasia?: string | null;
  cuit: string;
  direccion?: string | null;
  ciudad?: string | null;
  provincia?: string;
  codigo_postal?: string | null;
  telefono?: string | null;
  email?: string | null;
  sitio_web?: string | null;
  contacto_nombre?: string | null;
  contacto_telefono?: string | null;
  contacto_email?: string | null;
  condicion_pago?: string | null;
  dias_entrega_estimados?: string | null;
  descuento_habitual?: string | null;
  rubro?: string | null;
  activo?: boolean;
  notas?: string | null;
}

export interface ProveedorUpdate {
  razon_social?: string;
  nombre_fantasia?: string | null;
  cuit?: string;
  direccion?: string | null;
  ciudad?: string | null;
  provincia?: string;
  codigo_postal?: string | null;
  telefono?: string | null;
  email?: string | null;
  sitio_web?: string | null;
  contacto_nombre?: string | null;
  contacto_telefono?: string | null;
  contacto_email?: string | null;
  condicion_pago?: string | null;
  dias_entrega_estimados?: string | null;
  descuento_habitual?: string | null;
  rubro?: string | null;
  activo?: boolean;
  notas?: string | null;
}

// Producto de Proveedor
export interface ProductoProveedor {
  id: string;
  proveedor_id: string;
  insumo_id: string;
  codigo_proveedor: string | null;
  nombre_proveedor: string | null;
  precio_unitario: number;
  moneda: string;
  precio_con_iva: boolean;
  unidad_compra: string | null;
  factor_conversion: number;
  cantidad_minima: number | null;
  fecha_precio: string;
  fecha_vencimiento_precio: string | null;
  activo: boolean;
  es_preferido: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string | null;
  // Campos calculados
  proveedor_nombre: string | null;
  insumo_codigo: string | null;
  insumo_nombre: string | null;
  precio_vigente: boolean;
  precio_sin_iva: number | null;
  precio_por_unidad_stock: number | null;
}

export interface ProductoProveedorCreate {
  proveedor_id: string;
  insumo_id: string;
  codigo_proveedor?: string | null;
  nombre_proveedor?: string | null;
  precio_unitario: number;
  moneda?: string;
  precio_con_iva?: boolean;
  unidad_compra?: string | null;
  factor_conversion?: number;
  cantidad_minima?: number | null;
  fecha_precio?: string;
  fecha_vencimiento_precio?: string | null;
  activo?: boolean;
  es_preferido?: boolean;
  notas?: string | null;
}

// Orden de Compra
export type EstadoOrdenCompra =
  | 'borrador'
  | 'pendiente'
  | 'aprobada'
  | 'enviada'
  | 'parcial'
  | 'completada'
  | 'cancelada';

export interface OrdenCompraDetalle {
  id: string;
  orden_compra_id: string;
  insumo_id: string;
  producto_proveedor_id: string | null;
  descripcion: string | null;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  descuento_porcentaje: number;
  subtotal: number;
  cantidad_recibida: number;
  numero_linea: number;
  notas: string | null;
  created_at: string;
  // Campos calculados
  insumo_codigo: string | null;
  insumo_nombre: string | null;
  cantidad_pendiente: number;
  completamente_recibido: boolean;
}

export interface OrdenCompra {
  id: string;
  numero: string;
  proveedor_id: string;
  estado: EstadoOrdenCompra;
  fecha_emision: string;
  fecha_entrega_estimada: string | null;
  fecha_entrega_real: string | null;
  subtotal: number;
  descuento_porcentaje: number;
  descuento_monto: number;
  iva: number;
  total: number;
  moneda: string;
  condicion_pago: string | null;
  plazo_pago_dias: number | null;
  lugar_entrega: string | null;
  requiere_aprobacion: boolean;
  aprobada_por_id: string | null;
  fecha_aprobacion: string | null;
  creado_por_id: string;
  notas: string | null;
  notas_internas: string | null;
  created_at: string;
  updated_at: string | null;
  is_active: boolean;
  // Campos calculados
  proveedor_nombre: string | null;
  creado_por_nombre: string | null;
  aprobada_por_nombre: string | null;
  items: OrdenCompraDetalle[];
  puede_editar: boolean;
  puede_aprobar: boolean;
  puede_cancelar: boolean;
}

export interface OrdenCompraDetalleCreate {
  insumo_id: string;
  producto_proveedor_id?: string | null;
  descripcion?: string | null;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  descuento_porcentaje?: number;
  notas?: string | null;
}

export interface OrdenCompraCreate {
  proveedor_id: string;
  fecha_emision?: string;
  fecha_entrega_estimada?: string | null;
  descuento_porcentaje?: number;
  moneda?: string;
  condicion_pago?: string | null;
  plazo_pago_dias?: number | null;
  lugar_entrega?: string | null;
  requiere_aprobacion?: boolean;
  notas?: string | null;
  notas_internas?: string | null;
  items: OrdenCompraDetalleCreate[];
}

// Rubros predefinidos
export const RUBROS_PROVEEDOR = [
  { value: 'quimicos', label: 'Productos Químicos' },
  { value: 'limpieza', label: 'Artículos de Limpieza' },
  { value: 'repuestos', label: 'Repuestos y Maquinaria' },
  { value: 'envases', label: 'Envases y Embalaje' },
  { value: 'combustible', label: 'Combustible / Energía' },
  { value: 'materiales', label: 'Materiales de Consumo' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'otros', label: 'Otros' },
];

// Condiciones de pago comunes
export const CONDICIONES_PAGO = [
  { value: 'contado', label: 'Contado' },
  { value: '15_dias', label: '15 días' },
  { value: '30_dias', label: '30 días' },
  { value: '45_dias', label: '45 días' },
  { value: '60_dias', label: '60 días' },
  { value: '90_dias', label: '90 días' },
];
