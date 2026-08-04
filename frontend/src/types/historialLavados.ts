/**
 * Tipos para el módulo Historial de Lavados.
 */

export interface HistorialRemitoResumen {
  id: string;
  numero: string;
  fecha_emision: string | null;
  estado: string;
  total: number;
}

export interface HistorialProductoResumen {
  producto: string;
  cantidad: number;
}

export interface HistorialLoteRow {
  lote_id: string;
  numero_lote: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  estado: string;
  tipo_servicio: string | null;
  fecha_ingreso: string | null;
  fecha_inicio_proceso: string | null;
  fecha_fin_proceso: string | null;
  duracion_minutos: number | null;
  peso_entrada_kg: number | null;
  peso_salida_kg: number | null;
  cantidad_prendas: number | null;
  remitos: HistorialRemitoResumen[];
  productos_resumen: HistorialProductoResumen[];
}

export interface HistorialListResponse {
  items: HistorialLoteRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface HistorialEtapaDetalle {
  id: string;
  orden: number;
  codigo: string | null;
  nombre: string | null;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  duracion_minutos: number;
  responsable_id: string | null;
  responsable_nombre: string | null;
  peso_kg: number | null;
  observaciones: string | null;
}

export interface HistorialConsumoDetalle {
  id: string;
  insumo_nombre: string | null;
  cantidad: number;
  unidad: string;
  costo_total: number | null;
  notas: string | null;
}

export interface HistorialRemitoDetalle extends HistorialRemitoResumen {
  tipo: string;
  fecha_entrega: string | null;
  subtotal: number;
  descuento: number;
  detalles: {
    producto_id: string | null;
    producto_nombre: string | null;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }[];
}

export interface HistorialLoteDetalle {
  lote_id: string;
  numero_lote: string;
  estado: string;
  tipo_servicio: string | null;
  tipo_lote: string;
  prioridad: string;
  cliente: {
    id: string;
    razon_social: string | null;
    cuit: string | null;
  } | null;
  pedido: { id: string; numero: string } | null;
  fecha_ingreso: string | null;
  fecha_compromiso: string | null;
  fecha_inicio_proceso: string | null;
  fecha_fin_proceso: string | null;
  duracion_minutos: number | null;
  peso_entrada_kg: number | null;
  peso_salida_kg: number | null;
  cantidad_prendas: number | null;
  descripcion: string | null;
  notas_internas: string | null;
  notas_cliente: string | null;
  observaciones_calidad: string | null;
  etapas: HistorialEtapaDetalle[];
  consumos: HistorialConsumoDetalle[];
  remitos: HistorialRemitoDetalle[];
}

export interface RemitoEliminadoRow {
  log_id: string;
  fecha: string | null;
  hora: string | null;
  created_at: string | null;
  usuario_id: string | null;
  usuario_nombre: string | null;
  remito_id: string | null;
  numero_remito: string | null;
  cliente_id: string | null;
  cliente_nombre: string | null;
  monto: number | string | null;
  motivo: string | null;
  datos: Record<string, any>;
}

export interface RemitosEliminadosResponse {
  items: RemitoEliminadoRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface HistorialFiltros {
  cliente_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  numero_remito?: string;
  tipo_servicio?: string;
  producto_id?: string;
  estado?: string;
  page?: number;
  page_size?: number;
}

export interface EliminadosFiltros {
  fecha_desde?: string;
  fecha_hasta?: string;
  cliente_id?: string;
  usuario_id?: string;
  page?: number;
  page_size?: number;
}

export interface TipoServicioOpcion {
  value: string;
  label: string;
}
