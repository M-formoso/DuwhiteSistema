/**
 * Tipos para el módulo de Stock
 */

// Categoría de Insumo
export interface CategoriaInsumo {
  id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string | null;
  cantidad_insumos?: number;
}

export interface CategoriaInsumoCreate {
  nombre: string;
  descripcion?: string | null;
  orden?: number;
  activo?: boolean;
}

export interface CategoriaInsumoUpdate {
  nombre?: string;
  descripcion?: string | null;
  orden?: number;
  activo?: boolean;
}

// Insumo
export interface Insumo {
  id: string;
  codigo: string;
  codigo_barras: string | null;
  nombre: string;
  categoria_id: string | null;
  subcategoria: string | null;
  unidad: string;
  stock_actual: number;
  stock_minimo: number;
  stock_maximo: number | null;
  precio_unitario_sin_iva: number | null;
  precio_unitario_costo: number | null;
  precio_promedio_ponderado: number | null;
  proveedor_habitual_id: string | null;
  ubicacion_deposito: string | null;
  fecha_vencimiento: string | null;
  foto: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string | null;
  is_active: boolean;
  // Campos calculados
  categoria_nombre: string | null;
  proveedor_nombre: string | null;
  stock_bajo: boolean;
  sin_stock: boolean;
  sobrestock: boolean;
  proximo_a_vencer: boolean;
  valor_stock: number;
}

export interface InsumoCreate {
  codigo: string;
  codigo_barras?: string | null;
  nombre: string;
  categoria_id?: string | null;
  subcategoria?: string | null;
  unidad: string;
  stock_actual?: number;
  stock_minimo?: number;
  stock_maximo?: number | null;
  precio_unitario_sin_iva?: number | null;
  precio_unitario_costo?: number | null;
  proveedor_habitual_id?: string | null;
  ubicacion_deposito?: string | null;
  fecha_vencimiento?: string | null;
  foto?: string | null;
  notas?: string | null;
}

export interface InsumoUpdate {
  codigo?: string;
  codigo_barras?: string | null;
  nombre?: string;
  categoria_id?: string | null;
  subcategoria?: string | null;
  unidad?: string;
  stock_minimo?: number;
  stock_maximo?: number | null;
  precio_unitario_sin_iva?: number | null;
  precio_unitario_costo?: number | null;
  proveedor_habitual_id?: string | null;
  ubicacion_deposito?: string | null;
  fecha_vencimiento?: string | null;
  foto?: string | null;
  notas?: string | null;
}

// Movimiento de Stock
export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste_positivo' | 'ajuste_negativo' | 'transferencia';
export type OrigenMovimiento = 'compra' | 'produccion' | 'devolucion' | 'ajuste_inventario' | 'merma' | 'vencimiento' | 'inicial';

export interface MovimientoStock {
  id: string;
  insumo_id: string;
  tipo: TipoMovimiento;
  origen: OrigenMovimiento | null;
  cantidad: number;
  stock_anterior: number;
  stock_posterior: number;
  precio_unitario: number | null;
  costo_total: number | null;
  documento_tipo: string | null;
  documento_id: string | null;
  numero_documento: string | null;
  proveedor_id: string | null;
  numero_lote: string | null;
  fecha_vencimiento_lote: string | null;
  notas: string | null;
  usuario_id: string;
  fecha_movimiento: string;
  created_at: string;
  // Campos relacionados
  insumo_codigo: string | null;
  insumo_nombre: string | null;
  proveedor_nombre: string | null;
  usuario_nombre: string | null;
}

export interface AjusteStockRequest {
  insumo_id: string;
  cantidad: number;
  motivo: string;
  numero_lote?: string | null;
  fecha_vencimiento?: string | null;
}

export interface ResumenMovimientos {
  total_entradas: number;
  total_salidas: number;
  valor_entradas: number;
  valor_salidas: number;
  cantidad_movimientos: number;
}

// Alerta de Stock
export interface AlertaStock {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
  stock_actual: number;
  stock_minimo: number;
  tipo_alerta: 'stock_bajo' | 'sin_stock' | 'sobrestock' | 'vencimiento';
  mensaje: string;
}

// Filtros
export interface InsumoFilters {
  search?: string;
  categoria_id?: string;
  solo_activos?: boolean;
  solo_stock_bajo?: boolean;
  solo_sin_stock?: boolean;
}

export interface MovimientoFilters {
  insumo_id?: string;
  tipo?: TipoMovimiento;
  origen?: OrigenMovimiento;
  proveedor_id?: string;
  usuario_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  numero_documento?: string;
}

// Unidades de medida comunes
export const UNIDADES_MEDIDA = [
  { value: 'unidades', label: 'Unidades' },
  { value: 'litros', label: 'Litros' },
  { value: 'kg', label: 'Kilogramos' },
  { value: 'gramos', label: 'Gramos' },
  { value: 'metros', label: 'Metros' },
  { value: 'cm', label: 'Centímetros' },
  { value: 'pares', label: 'Pares' },
  { value: 'cajas', label: 'Cajas' },
  { value: 'bidones', label: 'Bidones' },
  { value: 'rollos', label: 'Rollos' },
];
