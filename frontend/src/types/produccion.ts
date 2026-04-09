/**
 * Tipos para el módulo de Producción
 */

// Estados y enums
export type EstadoLote = 'pendiente' | 'en_proceso' | 'pausado' | 'completado' | 'cancelado';
export type PrioridadLote = 'baja' | 'normal' | 'alta' | 'urgente';
export type TipoServicio = 'lavado_normal' | 'lavado_delicado' | 'lavado_industrial' | 'lavado_seco' | 'planchado_solo' | 'tintoreria';

// Etapa de Producción
export interface EtapaProduccion {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  color: string;
  es_inicial: boolean;
  es_final: boolean;
  requiere_peso: boolean;
  requiere_maquina: boolean;
  tiempo_estimado_minutos: number | null;
  activo: boolean;
  created_at: string;
  updated_at: string | null;
  cantidad_lotes_activos?: number;
}

// Máquina
export interface Maquina {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  capacidad_kg: number | null;
  estado: string;
  ubicacion: string | null;
  costo_hora: number | null;
  consumo_energia_kwh: number | null;
  consumo_agua_litros: number | null;
  fecha_ultimo_mantenimiento: string | null;
  fecha_proximo_mantenimiento: string | null;
  horas_uso_totales: number;
  notas: string | null;
  created_at: string;
  updated_at: string | null;
  is_active: boolean;
  requiere_mantenimiento: boolean;
}

// Lote Etapa
export interface LoteEtapa {
  id: string;
  lote_id: string;
  etapa_id: string;
  orden: number;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  responsable_id: string | null;
  maquina_id: string | null;
  peso_kg: number | null;
  observaciones: string | null;
  created_at: string;
  // Campos calculados
  etapa_codigo: string | null;
  etapa_nombre: string | null;
  etapa_color: string | null;
  responsable_nombre: string | null;
  maquina_nombre: string | null;
  duracion_minutos: number;
}

// Tipo de lote
export type TipoLote = 'normal' | 'relevado';

// Canasto asignado al lote
export interface LoteCanastoInfo {
  id: string;
  numero: number;
  codigo: string;
}

// Lote de Producción
export interface LoteProduccion {
  id: string;
  numero: string;
  cliente_id: string | null;
  pedido_id: string | null;
  tipo_servicio: TipoServicio;
  estado: EstadoLote;
  prioridad: PrioridadLote;
  etapa_actual_id: string | null;
  peso_entrada_kg: number | null;
  peso_salida_kg: number | null;
  cantidad_prendas: number | null;
  fecha_ingreso: string;
  fecha_compromiso: string | null;
  fecha_inicio_proceso: string | null;
  fecha_fin_proceso: string | null;
  creado_por_id: string;
  descripcion: string | null;
  notas_internas: string | null;
  notas_cliente: string | null;
  observaciones_calidad: string | null;
  tiene_manchas: boolean;
  tiene_roturas: boolean;
  created_at: string;
  updated_at: string | null;
  is_active: boolean;
  // Campos calculados
  cliente_nombre: string | null;
  pedido_numero: string | null;
  etapa_actual_nombre: string | null;
  etapa_actual_color: string | null;
  creado_por_nombre: string | null;
  tiempo_en_proceso: number;
  esta_atrasado: boolean;
  porcentaje_avance: number;
  etapas: LoteEtapa[];
  // Campos V2
  tipo_lote?: TipoLote;
  lote_padre_id?: string | null;
  lote_padre_numero?: string | null;
  canastos?: LoteCanastoInfo[];
}

export interface LoteProduccionList {
  id: string;
  numero: string;
  cliente_nombre: string | null;
  tipo_servicio: TipoServicio;
  estado: EstadoLote;
  prioridad: PrioridadLote;
  etapa_actual_nombre: string | null;
  etapa_actual_color: string | null;
  peso_entrada_kg: number | null;
  fecha_ingreso: string;
  fecha_compromiso: string | null;
  esta_atrasado: boolean;
  porcentaje_avance: number;
}

export interface LoteProduccionCreate {
  cliente_id?: string | null;
  pedido_id?: string | null;
  tipo_servicio?: TipoServicio;
  prioridad?: PrioridadLote;
  peso_entrada_kg?: number | null;
  cantidad_prendas?: number | null;
  fecha_compromiso?: string | null;
  descripcion?: string | null;
  notas_internas?: string | null;
  notas_cliente?: string | null;
  tiene_manchas?: boolean;
  tiene_roturas?: boolean;
}

// Consumo de Insumo
export interface ConsumoInsumoLote {
  id: string;
  lote_id: string;
  insumo_id: string;
  etapa_id: string | null;
  cantidad: number;
  unidad: string;
  costo_unitario: number | null;
  costo_total: number | null;
  registrado_por_id: string;
  registrado_por_nombre: string | null;
  insumo_codigo: string | null;
  insumo_nombre: string | null;
  notas: string | null;
  created_at: string;
}

// Canasto asignado para Kanban
export interface KanbanCanasto {
  id: string;
  numero: number;
  codigo: string;
}

// Kanban
export interface KanbanLote {
  id: string;
  numero: string;
  cliente_nombre: string | null;
  tipo_servicio: TipoServicio;
  prioridad: PrioridadLote;
  peso_entrada_kg: number | null;
  cantidad_prendas: number | null;
  fecha_compromiso: string | null;
  esta_atrasado: boolean;
  tiempo_en_etapa_minutos: number;
  etapa_en_proceso: boolean; // True si la etapa actual está en proceso (tiene fecha_inicio pero no fecha_fin)
  // Campos nuevos para v2
  tipo_lote?: 'normal' | 'relevado';
  lote_padre_numero?: string | null;
  canastos?: KanbanCanasto[];
  fecha_inicio_etapa?: string | null; // Para timer en tiempo real
}

export interface KanbanColumna {
  etapa_id: string;
  etapa_codigo: string;
  etapa_nombre: string;
  etapa_color: string;
  orden: number;
  tiempo_estimado_minutos: number | null;
  requiere_maquina: boolean;
  tipo_maquina: string | null; // lavadora, secadora, planchadora según etapa
  lotes: KanbanLote[];
  // Campos nuevos para v2
  total_kg?: number;
  total_lotes?: number;
}

export interface KanbanBoard {
  columnas: KanbanColumna[];
  total_lotes: number;
  lotes_atrasados: number;
}

// Constantes
export const TIPOS_SERVICIO = [
  { value: 'lavado_normal', label: 'Lavado Normal' },
  { value: 'lavado_delicado', label: 'Lavado Delicado' },
  { value: 'lavado_industrial', label: 'Lavado Industrial' },
  { value: 'lavado_seco', label: 'Lavado en Seco' },
  { value: 'planchado_solo', label: 'Solo Planchado' },
  { value: 'tintoreria', label: 'Tintorería' },
];

export const PRIORIDADES = [
  { value: 'baja', label: 'Baja', color: 'gray' },
  { value: 'normal', label: 'Normal', color: 'blue' },
  { value: 'alta', label: 'Alta', color: 'orange' },
  { value: 'urgente', label: 'Urgente', color: 'red' },
];

export const ESTADOS_LOTE = [
  { value: 'pendiente', label: 'Pendiente', color: 'gray' },
  { value: 'en_proceso', label: 'En Proceso', color: 'blue' },
  { value: 'pausado', label: 'Pausado', color: 'yellow' },
  { value: 'completado', label: 'Completado', color: 'green' },
  { value: 'cancelado', label: 'Cancelado', color: 'red' },
];

export const TIPOS_MAQUINA = [
  { value: 'lavadora', label: 'Lavadora' },
  { value: 'secadora', label: 'Secadora' },
  { value: 'planchadora', label: 'Planchadora' },
  { value: 'centrifuga', label: 'Centrífuga' },
  { value: 'calandra', label: 'Calandra' },
  { value: 'dobladora', label: 'Dobladora' },
  { value: 'otro', label: 'Otro' },
];
