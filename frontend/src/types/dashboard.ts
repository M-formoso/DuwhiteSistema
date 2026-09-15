/**
 * Tipos para el Dashboard
 */

export interface DashboardKPIs {
  ventas: {
    mes: {
      cantidad: number;
      total: number;
    };
    hoy: {
      cantidad: number;
      total: number;
    };
  };
  produccion: {
    lotes_en_proceso: number;
    lotes_completados_hoy: number;
    /** Minutos promedio entre completados de hoy. null si <2 lotes. */
    cadencia_min_entre_completados: number | null;
    /** Suma de peso_entrada_kg de lotes en estado EN_PROCESO. */
    kg_en_proceso: number;
  };
  finanzas: {
    saldo_caja: number;
    caja_abierta: boolean;
  };
  operacion: {
    clientes_activos: number;
    empleados_activos: number;
    insumos_bajo_minimo: number;
  };
}

export interface VentaSemana {
  fecha: string;
  dia: string;
  cantidad: number;
  total: number;
}

export interface PedidoReciente {
  id: string;
  numero: number;
  cliente: string;
  fecha: string;
  estado: string;
  total: number;
}

export interface LoteEnProceso {
  id: string;
  codigo: string;
  tipo_servicio: string;
  prioridad: string;
  peso_total: number;
  fecha_ingreso: string;
  etapa_actual_id: string | null;
}

export interface Alerta {
  tipo: 'stock' | 'pedido' | 'caja' | 'produccion';
  nivel: 'info' | 'warning' | 'error';
  titulo: string;
  mensaje: string;
  entidad_id: string | null;
}

export interface MovimientosHoy {
  ingresos: number;
  egresos: number;
  balance: number;
  cantidad_movimientos: number;
}

export interface DashboardCompleto {
  kpis: DashboardKPIs;
  grafico_ventas_semana: VentaSemana[];
  pedidos_recientes: PedidoReciente[];
  lotes_en_proceso: LoteEnProceso[];
  alertas: Alerta[];
  movimientos_hoy: MovimientosHoy;
  actualizado_at: string;
}
