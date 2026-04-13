/**
 * Servicio de Producción (Lotes, Etapas, Kanban)
 */

import api from './api';
import type {
  EtapaProduccion,
  Maquina,
  LoteProduccion,
  LoteProduccionList,
  LoteProduccionCreate,
  LoteEtapa,
  ConsumoInsumoLote,
  KanbanBoard,
  EstadoLote,
  PrioridadLote,
} from '@/types/produccion';
import type { PaginatedResponse } from '@/types/auth';

// ==================== OPERARIOS Y PIN ====================

export interface ValidarPinResponse {
  valido: boolean;
  operario_id: string;
  operario_nombre: string;
  mensaje?: string;
}

export async function getOperariosConPin(): Promise<{
  id: string;
  nombre: string;
  rol: string;
}[]> {
  const response = await api.get('/produccion/operarios');
  return response.data;
}

export async function validarPin(
  operarioId: string,
  pin: string
): Promise<ValidarPinResponse> {
  const response = await api.post('/produccion/validar-pin', {
    operario_id: operarioId,
    pin,
  });
  return response.data;
}

// ==================== KANBAN ====================

export async function getKanbanBoard(): Promise<KanbanBoard> {
  const response = await api.get('/produccion/kanban');
  return response.data;
}

export interface PedidoEnCamino {
  id: string;
  numero: string;
  cliente_id: string;
  cliente_nombre: string | null;
  fecha_pedido: string | null;
  fecha_retiro: string | null;
  fecha_entrega_estimada: string | null;
  total: number;
  notas: string | null;
}

export async function getPedidosEnCamino(): Promise<PedidoEnCamino[]> {
  const response = await api.get('/produccion/pedidos-en-camino');
  return response.data;
}

// ==================== ETAPAS ====================

export async function getEtapas(soloActivas: boolean = true): Promise<EtapaProduccion[]> {
  const response = await api.get('/produccion/etapas', {
    params: { solo_activas: soloActivas },
  });
  return response.data;
}

export async function getEtapasLista(): Promise<{
  id: string;
  codigo: string;
  nombre: string;
  color: string;
  orden: number;
  tiempo_estimado_minutos?: number;
}[]> {
  const response = await api.get('/produccion/etapas/lista');
  return response.data;
}

export async function createEtapa(data: Partial<EtapaProduccion>): Promise<EtapaProduccion> {
  const response = await api.post('/produccion/etapas', data);
  return response.data;
}

export async function updateEtapa(id: string, data: Partial<EtapaProduccion>): Promise<EtapaProduccion> {
  const response = await api.put(`/produccion/etapas/${id}`, data);
  return response.data;
}

// ==================== MÁQUINAS ====================

export async function getMaquinas(params?: {
  tipo?: string;
  estado?: string;
}): Promise<Maquina[]> {
  const response = await api.get('/produccion/maquinas', { params });
  return response.data;
}

export async function getMaquinasLista(tipo?: string): Promise<{
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  estado: string;
  capacidad_kg: number | null;
}[]> {
  const response = await api.get('/produccion/maquinas/lista', {
    params: { tipo },
  });
  return response.data;
}

export async function getMaquinasDisponibles(tipo?: string): Promise<{
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  estado: string;
  capacidad_kg: number | null;
}[]> {
  const response = await api.get('/produccion/maquinas/disponibles', {
    params: { tipo },
  });
  return response.data;
}

export async function verificarMaquinaEnUso(maquinaId: string): Promise<{
  en_uso: boolean;
  lote_id?: string;
  lote_numero?: string;
  etapa_id?: string;
  fecha_inicio?: string;
}> {
  const response = await api.get(`/produccion/maquinas/${maquinaId}/en-uso`);
  return response.data;
}

export async function createMaquina(data: Partial<Maquina>): Promise<Maquina> {
  const response = await api.post('/produccion/maquinas', data);
  return response.data;
}

export async function updateMaquina(id: string, data: Partial<Maquina>): Promise<Maquina> {
  const response = await api.put(`/produccion/maquinas/${id}`, data);
  return response.data;
}

// ==================== LOTES ====================

export async function getLotes(params?: {
  skip?: number;
  limit?: number;
  estado?: EstadoLote;
  etapa_id?: string;
  cliente_id?: string;
  prioridad?: PrioridadLote;
  fecha_desde?: string;
  fecha_hasta?: string;
  solo_atrasados?: boolean;
}): Promise<PaginatedResponse<LoteProduccionList>> {
  const response = await api.get('/produccion/lotes', { params });
  return response.data;
}

export async function getLote(id: string): Promise<LoteProduccion> {
  const response = await api.get(`/produccion/lotes/${id}`);
  return response.data;
}

export async function createLote(data: LoteProduccionCreate): Promise<LoteProduccion> {
  const response = await api.post('/produccion/lotes', data);
  return response.data;
}

export async function updateLote(id: string, data: Partial<LoteProduccionCreate>): Promise<LoteProduccion> {
  const response = await api.put(`/produccion/lotes/${id}`, data);
  return response.data;
}

export async function deleteLote(id: string): Promise<{ message: string }> {
  const response = await api.delete(`/produccion/lotes/${id}`);
  return response.data;
}

export async function cambiarEstadoLote(
  id: string,
  estado: EstadoLote,
  observaciones?: string
): Promise<{ message: string }> {
  const response = await api.post(`/produccion/lotes/${id}/estado`, {
    estado,
    observaciones,
  });
  return response.data;
}

export async function moverLote(
  id: string,
  etapa_destino_id: string,
  responsable_id?: string,
  observaciones?: string
): Promise<{ message: string }> {
  const response = await api.post(`/produccion/lotes/${id}/mover`, {
    etapa_destino_id,
    responsable_id,
    observaciones,
  });
  return response.data;
}

// ==================== ETAPAS DE LOTE ====================

export async function iniciarEtapa(
  loteId: string,
  etapaId: string,
  data?: {
    responsable_id?: string;
    maquina_id?: string;
    observaciones?: string;
    canastos_ids?: string[];
    peso_kg?: number;
  }
): Promise<LoteEtapa> {
  const response = await api.post(
    `/produccion/lotes/${loteId}/etapas/${etapaId}/iniciar`,
    data || {}
  );
  return response.data;
}

export async function finalizarEtapa(
  loteId: string,
  etapaId: string,
  data?: {
    peso_kg?: number;
    observaciones?: string;
  }
): Promise<LoteEtapa> {
  const response = await api.post(
    `/produccion/lotes/${loteId}/etapas/${etapaId}/finalizar`,
    data || {}
  );
  return response.data;
}

// ==================== CONSUMOS ====================

export async function getConsumosLote(loteId: string): Promise<ConsumoInsumoLote[]> {
  const response = await api.get(`/produccion/lotes/${loteId}/consumos`);
  return response.data;
}

export async function registrarConsumo(
  loteId: string,
  data: {
    insumo_id: string;
    etapa_id?: string;
    cantidad: number;
    unidad: string;
    notas?: string;
  }
): Promise<ConsumoInsumoLote> {
  const response = await api.post(`/produccion/lotes/${loteId}/consumos`, data);
  return response.data;
}

// ==================== LOTE DIRECTO ====================

export interface LoteDirectoCreate {
  cliente_id: string;
  tipo_servicio: string;
  peso_entrada_kg?: number;
  cantidad_prendas?: number;
  monto_cobro: number;
  estado_facturacion: string;
  descripcion?: string;
  concepto?: string;
}

export interface LoteDirectoResponse {
  lote: LoteProduccion;
  movimiento_cc_id: string;
  mensaje: string;
}

export async function crearLoteDirecto(data: LoteDirectoCreate): Promise<LoteDirectoResponse> {
  const response = await api.post('/produccion/lotes/directo', data);
  return response.data;
}

// ==================== EXPORTS ====================

export const produccionService = {
  // Operarios y PIN
  getOperariosConPin,
  validarPin,
  // Kanban
  getKanbanBoard,
  getPedidosEnCamino,
  // Etapas
  getEtapas,
  getEtapasLista,
  createEtapa,
  updateEtapa,
  // Máquinas
  getMaquinas,
  getMaquinasLista,
  getMaquinasDisponibles,
  verificarMaquinaEnUso,
  createMaquina,
  updateMaquina,
  // Lotes
  getLotes,
  getLote,
  createLote,
  updateLote,
  deleteLote,
  cambiarEstadoLote,
  moverLote,
  crearLoteDirecto,
  // Etapas de lote
  iniciarEtapa,
  finalizarEtapa,
  // Consumos
  getConsumosLote,
  registrarConsumo,
};

export default produccionService;
