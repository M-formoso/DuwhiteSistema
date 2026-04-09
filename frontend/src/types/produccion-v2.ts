/**
 * Tipos para Producción v2
 * - Canastos
 * - Productos de Lavado
 * - Remitos
 * - Relevado
 */

// ==================== CANASTOS ====================

export type EstadoCanasto = 'disponible' | 'en_uso' | 'mantenimiento' | 'fuera_servicio';

export interface Canasto {
  id: string;
  numero: number;
  codigo: string;
  estado: EstadoCanasto;
  ubicacion?: string;
  notas?: string;
  activo: boolean;
  lote_actual_id?: string;
  lote_actual_numero?: string;
  cliente_nombre?: string;
}

export interface CanastoGridItem {
  id: string;
  numero: number;
  codigo: string;
  estado: EstadoCanasto;
  esta_disponible: boolean;
  lote_id?: string;
  lote_numero?: string;
  cliente_id?: string;
  cliente_nombre?: string;
  etapa_actual?: string;
  tiempo_en_uso_minutos?: number;
}

export interface CanastosGridResponse {
  canastos: CanastoGridItem[];
  resumen: {
    disponible: number;
    en_uso: number;
    mantenimiento: number;
    fuera_servicio: number;
  };
}

export interface LoteCanasto {
  id: string;
  lote_id: string;
  canasto_id: string;
  canasto_numero: number;
  canasto_codigo: string;
  etapa_id?: string;
  etapa_nombre?: string;
  fecha_asignacion: string;
  fecha_liberacion?: string;
  asignado_por_nombre?: string;
  liberado_por_nombre?: string;
  duracion_minutos: number;
  esta_activo: boolean;
  notas?: string;
}

export interface AsignarCanastosRequest {
  canasto_ids: string[];
  etapa_id?: string;
  notas?: string;
}

export interface LiberarCanastosRequest {
  canasto_ids?: string[];
  notas?: string;
}

// ==================== PRODUCTOS DE LAVADO ====================

export type CategoriaProductoLavado =
  | 'toallas'
  | 'ropa_cama'
  | 'manteleria'
  | 'alfombras'
  | 'cortinas'
  | 'otros';

export interface ProductoLavado {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  categoria: CategoriaProductoLavado;
  peso_promedio_kg?: number;
  activo: boolean;
}

export interface ProductoLavadoCreate {
  codigo: string;
  nombre: string;
  descripcion?: string;
  categoria: CategoriaProductoLavado;
  peso_promedio_kg?: number;
}

export interface ProductoLavadoUpdate {
  codigo?: string;
  nombre?: string;
  descripcion?: string;
  categoria?: CategoriaProductoLavado;
  peso_promedio_kg?: number;
  activo?: boolean;
}

export interface PrecioProductoLavado {
  id: string;
  lista_precios_id: string;
  producto_id: string;
  producto_codigo?: string;
  producto_nombre?: string;
  precio_unitario: number;
  activo: boolean;
}

export interface ProductoConPrecio {
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  categoria: CategoriaProductoLavado;
  peso_promedio_kg?: number;
  precio_unitario: number;
  tiene_precio: boolean;
}

// ==================== REMITOS ====================

export type TipoRemito = 'normal' | 'parcial' | 'complementario';
export type EstadoRemito = 'borrador' | 'emitido' | 'entregado' | 'anulado';

export interface DetalleRemito {
  id: string;
  remito_id: string;
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  descripcion?: string;
  pendiente_relevado: boolean;
  cantidad_relevado?: number;
}

export interface Remito {
  id: string;
  numero: string;
  lote_id: string;
  lote_numero: string;
  cliente_id: string;
  cliente_nombre: string;
  tipo: TipoRemito;
  estado: EstadoRemito;
  fecha_emision: string;
  fecha_entrega?: string;
  peso_total_kg?: number;
  subtotal: number;
  descuento: number;
  total: number;
  remito_padre_id?: string;
  remito_padre_numero?: string;
  movimiento_cc_id?: string;
  emitido_por_nombre?: string;
  entregado_por_nombre?: string;
  notas?: string;
  notas_entrega?: string;
  activo: boolean;
  created_at: string;
  detalles: DetalleRemito[];
  tiene_complemento: boolean;
  remitos_complementarios: RemitoListItem[];
}

export interface RemitoListItem {
  id: string;
  numero: string;
  lote_numero: string;
  cliente_nombre: string;
  tipo: TipoRemito;
  estado: EstadoRemito;
  fecha_emision: string;
  total: number;
  tiene_complemento: boolean;
}

export interface DetalleRemitoCreate {
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  descripcion?: string;
}

export interface GenerarRemitoRequest {
  detalles?: DetalleRemitoCreate[];
  items?: { producto_id: string; cantidad: number; precio_unitario: number }[];
  peso_total_kg?: number;
  notas?: string;
  observaciones?: string;
  generar_relevado?: boolean;
  items_relevado?: { producto_id: string; cantidad: number }[];
}

export interface GenerarRemitoResponse {
  remito_id: string;
  remito_numero: string;
  tipo: TipoRemito;
  total: number;
  movimiento_cc_id: string;
  lote_estado: string;
  lote_relevado_id?: string;
  lote_relevado_numero?: string;
  mensaje: string;
}

// ==================== CONTEO Y FINALIZACIÓN ====================

export interface ProductoConteoItem {
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  categoria: CategoriaProductoLavado;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
  relavar: boolean;
  cantidad_relavar: number;
}

// ==================== LOTE EXTENDIDO ====================

export type TipoLote = 'normal' | 'relevado';

export interface LoteProduccionExtendido {
  id: string;
  numero: string;
  cliente_id?: string;
  cliente_nombre?: string;
  tipo_lote: TipoLote;
  lote_padre_id?: string;
  lote_padre_numero?: string;
  estado: string;
  prioridad: string;
  peso_entrada_kg?: number;
  etapa_actual_id?: string;
  etapa_actual_nombre?: string;
  fecha_ingreso: string;
  fecha_compromiso?: string;
  // Canastos asignados
  canastos: LoteCanasto[];
  canastos_codigos: string[];
  // Tiempo
  tiempo_en_etapa_minutos: number;
  tiempo_total_minutos: number;
  // Relevado
  es_relevado: boolean;
  tiene_relevado_pendiente: boolean;
  lotes_relevado: { id: string; numero: string; estado: string }[];
}

// ==================== CONSTANTES ====================

export const ESTADOS_CANASTO: { value: EstadoCanasto; label: string; color: string }[] = [
  { value: 'disponible', label: 'Disponible', color: '#22C55E' },
  { value: 'en_uso', label: 'En Uso', color: '#F59E0B' },
  { value: 'mantenimiento', label: 'Mantenimiento', color: '#F97316' },
  { value: 'fuera_servicio', label: 'Fuera de Servicio', color: '#EF4444' },
];

export const CATEGORIAS_PRODUCTO_LAVADO: { value: CategoriaProductoLavado; label: string }[] = [
  { value: 'toallas', label: 'Toallas' },
  { value: 'ropa_cama', label: 'Ropa de Cama' },
  { value: 'manteleria', label: 'Mantelería' },
  { value: 'alfombras', label: 'Alfombras' },
  { value: 'cortinas', label: 'Cortinas' },
  { value: 'otros', label: 'Otros' },
];

export const TIPOS_REMITO: { value: TipoRemito; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'complementario', label: 'Complementario' },
];

export const ESTADOS_REMITO: { value: EstadoRemito; label: string; color: string }[] = [
  { value: 'borrador', label: 'Borrador', color: '#6B7280' },
  { value: 'emitido', label: 'Emitido', color: '#3B82F6' },
  { value: 'entregado', label: 'Entregado', color: '#22C55E' },
  { value: 'anulado', label: 'Anulado', color: '#EF4444' },
];
