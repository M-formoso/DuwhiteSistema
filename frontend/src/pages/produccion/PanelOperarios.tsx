/**
 * Panel de Producción para Operarios
 * Interfaz táctil optimizada para tablets en planta
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  CheckCircle,
  Clock,
  Package,
  User,
  AlertTriangle,
  RefreshCw,
  Timer,
  ChevronRight,
  Maximize2,
  X,
  Lock,
  Shirt,
  Scale,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

import { produccionService } from '@/services/produccionService';
import { canastoService } from '@/services/canastoService';
import { formatDate } from '@/utils/formatters';
import type { KanbanLote, KanbanColumna, PrioridadLote } from '@/types/produccion';

// Tipo local para máquinas disponibles
interface MaquinaDisponible {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  estado: string;
  capacidad_kg: number | null;
}

// Tipo local para canastos disponibles
interface CanastoDisponible {
  id: string;
  numero: number;
  codigo: string;
  estado: string;
}

// Colores más vivos para prioridades
const PRIORIDAD_CONFIG: Record<PrioridadLote, { bg: string; text: string; border: string; label: string }> = {
  baja: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', label: 'BAJA' },
  normal: { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-400', label: 'NORMAL' },
  alta: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-400', label: 'ALTA' },
  urgente: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-500', label: 'URGENTE' },
};

// Componente de tiempo en vivo
function TiempoEnVivo({ minutos }: { minutos: number }) {
  const [tiempo, setTiempo] = useState(minutos);

  useEffect(() => {
    const interval = setInterval(() => {
      setTiempo((t) => t + 1);
    }, 60000); // Actualizar cada minuto
    return () => clearInterval(interval);
  }, []);

  const horas = Math.floor(tiempo / 60);
  const mins = tiempo % 60;

  return (
    <div className="flex items-center gap-2 font-mono text-2xl font-bold">
      <Timer className="h-6 w-6 text-blue-500 animate-pulse" />
      <span>{horas > 0 ? `${horas}h ${mins}m` : `${mins}m`}</span>
    </div>
  );
}

// Tarjeta de lote grande y táctil
function LoteCard({
  lote,
  columna,
  onIniciar,
  onFinalizar,
  enProceso,
}: {
  lote: KanbanLote;
  columna: KanbanColumna;
  onIniciar: () => void;
  onFinalizar: () => void;
  enProceso: boolean;
}) {
  const prioridad = PRIORIDAD_CONFIG[lote.prioridad];
  const tiempoExcedido = columna.tiempo_estimado_minutos && lote.tiempo_en_etapa_minutos > columna.tiempo_estimado_minutos;

  return (
    <div
      className={`
        relative rounded-2xl border-4 p-5 transition-all duration-300
        ${enProceso ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-200' : ''}
        ${lote.esta_atrasado && !enProceso ? 'border-red-500 bg-red-50' : ''}
        ${!enProceso && !lote.esta_atrasado ? `${prioridad.border} bg-white` : ''}
        ${tiempoExcedido ? 'ring-4 ring-orange-300' : ''}
      `}
    >
      {/* Badge de prioridad */}
      <div className="absolute -top-3 left-4">
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${prioridad.bg} ${prioridad.text}`}>
          {prioridad.label}
        </span>
      </div>

      {/* Indicador en proceso */}
      {enProceso && (
        <div className="absolute -top-3 right-4">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500 text-white flex items-center gap-1">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            EN PROCESO
          </span>
        </div>
      )}

      {/* Atrasado */}
      {lote.esta_atrasado && !enProceso && (
        <div className="absolute -top-3 right-4">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500 text-white flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            ATRASADO
          </span>
        </div>
      )}

      {/* Contenido principal */}
      <div className="mt-2">
        {/* Número de lote */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-2xl font-bold font-mono tracking-wide">{lote.numero}</h3>
          {lote.tiempo_en_etapa_minutos > 0 && (
            <TiempoEnVivo minutos={lote.tiempo_en_etapa_minutos} />
          )}
        </div>

        {/* Cliente */}
        {lote.cliente_nombre && (
          <div className="flex items-center gap-2 text-lg text-gray-700 mb-3">
            <User className="h-5 w-5" />
            <span className="font-medium truncate">{lote.cliente_nombre}</span>
          </div>
        )}

        {/* Info del lote */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {lote.peso_entrada_kg && (
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-3">
              <Scale className="h-6 w-6 text-gray-600" />
              <div>
                <p className="text-xs text-gray-500">Peso</p>
                <p className="text-lg font-bold">{Number(lote.peso_entrada_kg).toFixed(1)} kg</p>
              </div>
            </div>
          )}
          {lote.cantidad_prendas && (
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-3">
              <Shirt className="h-6 w-6 text-gray-600" />
              <div>
                <p className="text-xs text-gray-500">Prendas</p>
                <p className="text-lg font-bold">{lote.cantidad_prendas}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tiempo estimado vs real */}
        {columna.tiempo_estimado_minutos && lote.tiempo_en_etapa_minutos > 0 && (
          <div className={`rounded-xl p-3 mb-4 ${tiempoExcedido ? 'bg-orange-100' : 'bg-gray-100'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Tiempo estimado:</span>
              <span className="font-medium">
                {columna.tiempo_estimado_minutos >= 60
                  ? `${Math.floor(columna.tiempo_estimado_minutos / 60)}h ${columna.tiempo_estimado_minutos % 60}m`
                  : `${columna.tiempo_estimado_minutos}m`}
              </span>
            </div>
            {tiempoExcedido && (
              <div className="flex items-center gap-1 mt-1 text-orange-600 font-medium">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  +{Math.floor((lote.tiempo_en_etapa_minutos - columna.tiempo_estimado_minutos) / 60)}h {' '}
                  {(lote.tiempo_en_etapa_minutos - columna.tiempo_estimado_minutos) % 60}m sobre estimado
                </span>
              </div>
            )}
          </div>
        )}

        {/* Fecha compromiso */}
        {lote.fecha_compromiso && (
          <div className={`text-sm mb-4 ${lote.esta_atrasado ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
            Compromiso: {formatDate(lote.fecha_compromiso)}
          </div>
        )}

        {/* Botón de acción GRANDE */}
        {!enProceso ? (
          <button
            onClick={onIniciar}
            className="w-full py-5 rounded-2xl bg-gradient-to-r from-green-500 to-green-600
                       text-white text-xl font-bold flex items-center justify-center gap-3
                       hover:from-green-600 hover:to-green-700 active:scale-98
                       transition-all shadow-lg shadow-green-200"
          >
            <Play className="h-8 w-8" />
            INICIAR ETAPA
          </button>
        ) : (
          <button
            onClick={onFinalizar}
            className="w-full py-5 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600
                       text-white text-xl font-bold flex items-center justify-center gap-3
                       hover:from-blue-600 hover:to-blue-700 active:scale-98
                       transition-all shadow-lg shadow-blue-200"
          >
            <CheckCircle className="h-8 w-8" />
            FINALIZAR ETAPA
          </button>
        )}
      </div>
    </div>
  );
}

// Columna de etapa visual
function EtapaColumna({
  columna,
  onIniciar,
  onFinalizar,
  getLoteEnProceso,
}: {
  columna: KanbanColumna;
  onIniciar: (lote: KanbanLote, columna: KanbanColumna) => void;
  onFinalizar: (lote: KanbanLote, columna: KanbanColumna) => void;
  getLoteEnProceso: (lote: KanbanLote) => boolean;
}) {
  const lotesAtrasados = columna.lotes.filter((l) => l.esta_atrasado).length;
  const lotesUrgentes = columna.lotes.filter((l) => l.prioridad === 'urgente').length;

  return (
    <div className="flex-shrink-0 w-[400px] flex flex-col h-full">
      {/* Header de etapa */}
      <div
        className="rounded-t-2xl p-4 text-white"
        style={{ backgroundColor: columna.etapa_color }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{columna.etapa_nombre}</h2>
            {columna.tiempo_estimado_minutos && (
              <p className="text-white/80 text-sm flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Estimado: {columna.tiempo_estimado_minutos >= 60
                  ? `${Math.floor(columna.tiempo_estimado_minutos / 60)}h ${columna.tiempo_estimado_minutos % 60}m`
                  : `${columna.tiempo_estimado_minutos}m`}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">{columna.lotes.length}</div>
            <div className="text-sm text-white/80">lotes</div>
          </div>
        </div>

        {/* Indicadores */}
        {(lotesAtrasados > 0 || lotesUrgentes > 0) && (
          <div className="flex gap-2 mt-3">
            {lotesAtrasados > 0 && (
              <span className="px-2 py-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {lotesAtrasados} atrasados
              </span>
            )}
            {lotesUrgentes > 0 && (
              <span className="px-2 py-1 rounded-full bg-amber-500 text-white text-xs font-bold">
                {lotesUrgentes} urgentes
              </span>
            )}
          </div>
        )}
      </div>

      {/* Lista de lotes */}
      <div className="bg-gray-100 rounded-b-2xl p-4 flex-1 overflow-y-auto space-y-4">
        {columna.lotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Package className="h-16 w-16 mb-4 opacity-50" />
            <span className="text-xl">Sin lotes en esta etapa</span>
          </div>
        ) : (
          columna.lotes.map((lote) => (
            <LoteCard
              key={lote.id}
              lote={lote}
              columna={columna}
              onIniciar={() => onIniciar(lote, columna)}
              onFinalizar={() => onFinalizar(lote, columna)}
              enProceso={getLoteEnProceso(lote)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Modal de PIN con input de texto (igual que admin)
function PinModalGrande({
  open,
  onClose,
  onConfirm,
  title,
  loteNumero,
  etapaNombre,
  etapaCodigo,
  accion,
  requiereMaquina = false,
  tipoMaquina = null,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (operarioId: string, operarioNombre: string, maquinaId?: string, canastosIds?: string[], pesoKg?: number) => void;
  title: string;
  loteNumero?: string;
  etapaNombre?: string;
  etapaCodigo?: string;
  accion: 'iniciar' | 'finalizar';
  requiereMaquina?: boolean;
  tipoMaquina?: string | null;
}) {
  const [selectedOperario, setSelectedOperario] = useState('');
  const [selectedMaquina, setSelectedMaquina] = useState('');
  const [selectedCanastos, setSelectedCanastos] = useState<string[]>([]);
  const [pesoKg, setPesoKg] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Determinar si requiere peso (REC - Recepción y Pesaje)
  const requierePeso = accion === 'iniciar' && etapaCodigo === 'REC';
  // Determinar si requiere canastos (LAV, SEC)
  const requiereCanastos = accion === 'iniciar' && ['LAV', 'SEC'].includes(etapaCodigo || '');

  const { data: operarios } = useQuery({
    queryKey: ['operarios-pin'],
    queryFn: () => produccionService.getOperariosConPin(),
    enabled: open,
  });

  // Cargar máquinas disponibles si es necesario
  const { data: maquinas = [] } = useQuery<MaquinaDisponible[]>({
    queryKey: ['maquinas-disponibles', tipoMaquina],
    queryFn: () => produccionService.getMaquinasDisponibles(tipoMaquina || undefined),
    enabled: open && accion === 'iniciar' && requiereMaquina,
  });

  // Cargar canastos disponibles si es necesario
  const { data: canastos = [] } = useQuery<CanastoDisponible[]>({
    queryKey: ['canastos-disponibles'],
    queryFn: () => canastoService.getDisponibles(),
    enabled: open && requiereCanastos,
  });

  // Reset cuando se abre
  useEffect(() => {
    if (open) {
      setSelectedOperario('');
      setSelectedMaquina('');
      setSelectedCanastos([]);
      setPesoKg('');
      setPin('');
      setError('');
    }
  }, [open]);

  // Focus en PIN cuando se selecciona operario
  useEffect(() => {
    if (selectedOperario && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [selectedOperario]);

  const handleConfirm = async () => {
    if (!selectedOperario) {
      setError('Seleccione un operario');
      return;
    }
    if (pin.length < 4) {
      setError('Ingrese su PIN completo');
      return;
    }
    // Validar máquina si es requerida
    if (accion === 'iniciar' && requiereMaquina && !selectedMaquina) {
      setError('Debe seleccionar una máquina');
      return;
    }
    // Validar peso si es requerido
    if (requierePeso && (!pesoKg || parseFloat(pesoKg) <= 0)) {
      setError('Debe ingresar el peso del lote');
      return;
    }
    // Validar canastos si es requerido
    if (requiereCanastos && selectedCanastos.length === 0) {
      setError('Debe seleccionar al menos un canasto');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await produccionService.validarPin(selectedOperario, pin);
      if (result.valido) {
        onConfirm(
          result.operario_id,
          result.operario_nombre,
          selectedMaquina || undefined,
          selectedCanastos.length > 0 ? selectedCanastos : undefined,
          pesoKg ? parseFloat(pesoKg) : undefined
        );
        setPin('');
        setSelectedOperario('');
        setSelectedMaquina('');
        setSelectedCanastos([]);
        setPesoKg('');
      } else {
        setError(result.mensaje || 'PIN incorrecto');
        setPin('');
        pinInputRef.current?.focus();
      }
    } catch {
      setError('Error al validar');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Toggle canasto selection
  const toggleCanasto = (canastoId: string) => {
    setSelectedCanastos((prev) =>
      prev.includes(canastoId)
        ? prev.filter((id) => id !== canastoId)
        : [...prev, canastoId]
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedOperario && pin.length >= 4) {
      handleConfirm();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-[450px] p-6 relative shadow-xl">
        {/* Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100"
        >
          <X className="h-5 w-5 text-gray-400" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <p className="text-sm text-gray-500">
            Valida tu PIN para {accion === 'iniciar' ? 'iniciar' : 'finalizar'} esta etapa
          </p>
          {loteNumero && etapaNombre && (
            <p className="text-sm font-medium text-gray-900 mt-1">
              Lote {loteNumero} - {etapaNombre}
            </p>
          )}
        </div>

        <div className="space-y-4">
          {/* Selector de operario */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Operario
            </label>
            <Select value={selectedOperario} onValueChange={setSelectedOperario}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar operario..." />
              </SelectTrigger>
              <SelectContent>
                {operarios?.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {op.nombre}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Input de PIN */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              PIN
            </label>
            <input
              ref={pinInputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setPin(value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ingrese PIN de 4-6 dígitos"
              disabled={!selectedOperario}
              className="w-full h-10 px-3 rounded-md border border-gray-300 text-center text-2xl tracking-widest font-mono
                         focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                         disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          {/* Input de peso (solo para Recepción y Pesaje) */}
          {requierePeso && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Peso de Entrada (kg) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={pesoKg}
                onChange={(e) => setPesoKg(e.target.value)}
                placeholder="Ej: 45.5"
                className="w-full h-12 px-4 rounded-md border border-gray-300 text-xl
                           focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-gray-500">Ingresa el peso que marca la balanza</p>
            </div>
          )}

          {/* Selector de canastos (solo para Lavado/Secado) */}
          {requiereCanastos && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Canastos <span className="text-red-500">*</span>
                {selectedCanastos.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                    {selectedCanastos.length} seleccionados
                  </span>
                )}
              </label>
              {canastos.length === 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>No hay canastos disponibles. Todos están en uso.</span>
                  </div>
                </div>
              ) : (
                <div className="max-h-32 overflow-y-auto border rounded-md p-2">
                  <div className="grid grid-cols-5 gap-2">
                    {canastos.map((canasto) => (
                      <div
                        key={canasto.id}
                        onClick={() => toggleCanasto(canasto.id)}
                        className={`
                          flex items-center justify-center p-3 rounded-lg cursor-pointer
                          border-2 transition-all text-lg font-bold
                          ${selectedCanastos.includes(canasto.id)
                            ? 'bg-primary text-white border-primary'
                            : 'bg-green-50 border-green-300 hover:border-green-500 text-green-700'
                          }
                        `}
                      >
                        #{canasto.numero}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500">Selecciona los canastos donde se colocará el lote</p>
            </div>
          )}

          {/* Selector de máquina (solo para iniciar y si requiere) */}
          {accion === 'iniciar' && requiereMaquina && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                Máquina <span className="text-red-500">*</span>
                {tipoMaquina && (
                  <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs uppercase">
                    {tipoMaquina}
                  </span>
                )}
              </label>
              {maquinas.length === 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>No hay {tipoMaquina || 'máquinas'} disponibles. Todas están en uso.</span>
                  </div>
                </div>
              ) : (
                <Select value={selectedMaquina || 'none'} onValueChange={(v) => setSelectedMaquina(v === 'none' ? '' : v)}>
                  <SelectTrigger className={!selectedMaquina ? 'border-orange-400' : ''}>
                    <SelectValue placeholder="Seleccionar máquina..." />
                  </SelectTrigger>
                  <SelectContent>
                    {maquinas.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{m.codigo}</span>
                          <span className="text-gray-500">{m.nombre}</span>
                          {m.capacidad_kg && (
                            <span className="text-xs text-gray-400">({m.capacidad_kg} kg)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              loading ||
              !selectedOperario ||
              pin.length < 4 ||
              (accion === 'iniciar' && requiereMaquina && (!selectedMaquina || maquinas.length === 0)) ||
              (requierePeso && (!pesoKg || parseFloat(pesoKg) <= 0)) ||
              (requiereCanastos && selectedCanastos.length === 0)
            }
            className="px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90
                       disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Validando...
              </>
            ) : (
              <>{accion === 'iniciar' ? 'Iniciar Etapa' : 'Finalizar Etapa'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Componente principal
export default function PanelOperariosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [fullscreen, setFullscreen] = useState(false);
  const [pinModal, setPinModal] = useState<{
    open: boolean;
    accion: 'iniciar' | 'finalizar';
    lote?: KanbanLote;
    columna?: KanbanColumna;
  }>({ open: false, accion: 'iniciar' });

  // Cargar Kanban - refetch cada 10 segundos para mantener sincronizado
  const { data: kanban, isLoading, refetch } = useQuery({
    queryKey: ['kanban'],
    queryFn: () => produccionService.getKanbanBoard(),
    refetchInterval: 10000,
  });

  // Mutations
  const iniciarMutation = useMutation({
    mutationFn: ({ loteId, etapaId, operarioId, maquinaId, canastosIds, pesoKg }: {
      loteId: string;
      etapaId: string;
      operarioId: string;
      maquinaId?: string;
      canastosIds?: string[];
      pesoKg?: number;
    }) =>
      produccionService.iniciarEtapa(loteId, etapaId, {
        responsable_id: operarioId,
        maquina_id: maquinaId,
        canastos_ids: canastosIds,
        peso_kg: pesoKg
      }),
    onSuccess: () => {
      // Invalidar inmediatamente y refetch para actualizar UI
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['maquinas-disponibles'] });
      queryClient.invalidateQueries({ queryKey: ['canastos-disponibles'] });
      toast({ title: 'Etapa iniciada correctamente' });
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      const detail = error.response?.data?.detail || 'Error al iniciar etapa';
      toast({ title: 'Error', description: detail, variant: 'destructive' });
    },
  });

  const finalizarMutation = useMutation({
    mutationFn: ({ loteId, etapaId }: { loteId: string; etapaId: string }) =>
      produccionService.finalizarEtapa(loteId, etapaId, {}),
    onSuccess: () => {
      // Invalidar inmediatamente y refetch para actualizar UI
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['maquinas-disponibles'] });
      toast({ title: 'Etapa finalizada correctamente' });
    },
    onError: () => {
      toast({ title: 'Error al finalizar etapa', variant: 'destructive' });
    },
  });

  const handleIniciar = (lote: KanbanLote, columna: KanbanColumna) => {
    setPinModal({ open: true, accion: 'iniciar', lote, columna });
  };

  const handleFinalizar = (lote: KanbanLote, columna: KanbanColumna) => {
    setPinModal({ open: true, accion: 'finalizar', lote, columna });
  };

  const handlePinConfirm = (operarioId: string, operarioNombre: string, maquinaId?: string, canastosIds?: string[], pesoKg?: number) => {
    const { accion, lote, columna } = pinModal;

    if (!lote || !columna) return;

    toast({ title: `Validado: ${operarioNombre}` });

    if (accion === 'iniciar') {
      iniciarMutation.mutate({
        loteId: lote.id,
        etapaId: columna.etapa_id,
        operarioId,
        maquinaId,
        canastosIds,
        pesoKg,
      });
    } else {
      finalizarMutation.mutate({
        loteId: lote.id,
        etapaId: columna.etapa_id,
      });
    }

    setPinModal({ open: false, accion: 'iniciar' });
  };

  // Usar el campo del backend para determinar si está en proceso
  const getLoteEnProceso = (lote: KanbanLote) => {
    return lote.etapa_en_proceso;
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  // Resumen stats - calculado desde los datos del backend
  const stats = kanban ? {
    total: kanban.total_lotes,
    atrasados: kanban.lotes_atrasados,
    enProceso: kanban.columnas.reduce((acc, col) =>
      acc + col.lotes.filter((l) => l.etapa_en_proceso).length, 0),
    urgentes: kanban.columnas.reduce((acc, col) =>
      acc + col.lotes.filter((l) => l.prioridad === 'urgente').length, 0),
  } : { total: 0, atrasados: 0, enProceso: 0, urgentes: 0 };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
          <p className="text-xl text-gray-600">Cargando producción...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen bg-gray-50 flex flex-col overflow-hidden ${fullscreen ? 'p-4' : ''}`}>
      {/* Header fijo */}
      <div className="bg-white border-b flex-shrink-0 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo y título */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <Package className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Panel de Producción</h1>
              <p className="text-gray-500 text-sm">
                {new Date().toLocaleDateString('es-AR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                })}
              </p>
            </div>
          </div>

          {/* Stats rápidos */}
          <div className="flex items-center gap-6">
            <div className="text-center px-4 py-2 bg-gray-100 rounded-xl">
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">LOTES ACTIVOS</p>
            </div>
            {stats.enProceso > 0 && (
              <div className="text-center px-4 py-2 bg-blue-100 rounded-xl">
                <p className="text-3xl font-bold text-blue-700">{stats.enProceso}</p>
                <p className="text-xs text-blue-600">EN PROCESO</p>
              </div>
            )}
            {stats.atrasados > 0 && (
              <div className="text-center px-4 py-2 bg-red-100 rounded-xl">
                <p className="text-3xl font-bold text-red-700">{stats.atrasados}</p>
                <p className="text-xs text-red-600">ATRASADOS</p>
              </div>
            )}
            {stats.urgentes > 0 && (
              <div className="text-center px-4 py-2 bg-amber-100 rounded-xl">
                <p className="text-3xl font-bold text-amber-700">{stats.urgentes}</p>
                <p className="text-xs text-amber-600">URGENTES</p>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => refetch()}
              className="h-12"
            >
              <RefreshCw className="h-5 w-5 mr-2" />
              Actualizar
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={toggleFullscreen}
              className="h-12"
            >
              <Maximize2 className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/produccion')}
              className="h-12"
            >
              Vista Admin
              <ChevronRight className="h-5 w-5 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tablero Kanban */}
      <div className="p-6 overflow-x-auto flex-1 overflow-y-hidden">
        <div className="flex gap-6 h-full" style={{ minWidth: 'max-content' }}>
          {kanban?.columnas.map((columna) => (
            <EtapaColumna
              key={columna.etapa_id}
              columna={columna}
              onIniciar={handleIniciar}
              onFinalizar={handleFinalizar}
              getLoteEnProceso={getLoteEnProceso}
            />
          ))}
        </div>
      </div>

      {/* Modal PIN */}
      <PinModalGrande
        open={pinModal.open}
        onClose={() => setPinModal({ open: false, accion: 'iniciar' })}
        onConfirm={handlePinConfirm}
        title={pinModal.accion === 'iniciar' ? 'Iniciar Etapa' : 'Finalizar Etapa'}
        loteNumero={pinModal.lote?.numero}
        etapaNombre={pinModal.columna?.etapa_nombre}
        etapaCodigo={pinModal.columna?.etapa_codigo}
        accion={pinModal.accion}
        requiereMaquina={pinModal.columna?.requiere_maquina}
        tipoMaquina={pinModal.columna?.tipo_maquina}
      />
    </div>
  );
}
