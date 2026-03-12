/**
 * Panel de Producción para Operarios
 * Interfaz táctil optimizada para tablets en planta
 */

import { useState, useEffect } from 'react';
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
            Compromiso: {new Date(lote.fecha_compromiso).toLocaleDateString('es-AR')}
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

// Modal de PIN grande para táctil con selección de máquina
function PinModalGrande({
  open,
  onClose,
  onConfirm,
  title,
  loteNumero,
  etapaNombre,
  accion,
  requiereMaquina = false,
  tipoMaquina = null,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (operarioId: string, operarioNombre: string, maquinaId?: string) => void;
  title: string;
  loteNumero?: string;
  etapaNombre?: string;
  accion: 'iniciar' | 'finalizar';
  requiereMaquina?: boolean;
  tipoMaquina?: string | null;
}) {
  const [selectedOperario, setSelectedOperario] = useState('');
  const [selectedMaquina, setSelectedMaquina] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  // Reset cuando se abre
  useEffect(() => {
    if (open) {
      setSelectedOperario('');
      setSelectedMaquina('');
      setPin('');
      setError('');
    }
  }, [open]);

  // Manejar teclado físico
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Solo números
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        if (pin.length < 6) {
          setPin(prev => prev + e.key);
          setError('');
        }
      }
      // Backspace
      else if (e.key === 'Backspace') {
        e.preventDefault();
        setPin(prev => prev.slice(0, -1));
        setError('');
      }
      // Escape para cerrar
      else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      // Enter para confirmar
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedOperario && pin.length >= 4) {
          handleConfirm();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, pin, selectedOperario, onClose]);

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      setPin(pin + digit);
      setError('');
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

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

    setLoading(true);
    setError('');

    try {
      const result = await produccionService.validarPin(selectedOperario, pin);
      if (result.valido) {
        onConfirm(result.operario_id, result.operario_nombre, selectedMaquina || undefined);
        setPin('');
        setSelectedOperario('');
        setSelectedMaquina('');
      } else {
        setError(result.mensaje || 'PIN incorrecto');
        setPin('');
      }
    } catch {
      setError('Error al validar');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit cuando se completa el PIN
  useEffect(() => {
    if (pin.length === 6 && selectedOperario) {
      handleConfirm();
    }
  }, [pin]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-8 relative">
        {/* Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100"
        >
          <X className="h-8 w-8 text-gray-400" />
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
            accion === 'iniciar' ? 'bg-green-100' : 'bg-blue-100'
          }`}>
            {accion === 'iniciar' ? (
              <Play className={`h-10 w-10 ${accion === 'iniciar' ? 'text-green-600' : 'text-blue-600'}`} />
            ) : (
              <CheckCircle className="h-10 w-10 text-blue-600" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          {loteNumero && (
            <p className="text-lg text-gray-600 mt-2">
              Lote <span className="font-mono font-bold">{loteNumero}</span>
              {etapaNombre && <> - {etapaNombre}</>}
            </p>
          )}
        </div>

        {/* Selector de operario */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seleccione su nombre
          </label>
          <Select value={selectedOperario} onValueChange={setSelectedOperario}>
            <SelectTrigger className="h-14 text-lg">
              <SelectValue placeholder="Toque para seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              {operarios?.map((op) => (
                <SelectItem key={op.id} value={op.id} className="text-lg py-3">
                  {op.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selector de máquina (solo para iniciar y si requiere) */}
        {accion === 'iniciar' && requiereMaquina && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccione la máquina <span className="text-red-500">*</span>
              {tipoMaquina && (
                <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs uppercase">
                  {tipoMaquina}
                </span>
              )}
            </label>
            {maquinas.length === 0 ? (
              <div className="bg-red-50 border border-red-300 rounded-xl p-4 text-red-700 text-center">
                <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                <p className="font-medium">No hay {tipoMaquina || 'máquinas'} disponibles</p>
                <p className="text-sm">Todas están en uso</p>
              </div>
            ) : (
              <Select value={selectedMaquina} onValueChange={setSelectedMaquina}>
                <SelectTrigger className={`h-14 text-lg ${!selectedMaquina ? 'border-orange-400' : ''}`}>
                  <SelectValue placeholder="Toque para seleccionar máquina..." />
                </SelectTrigger>
                <SelectContent>
                  {maquinas.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-lg py-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold">{m.codigo}</span>
                        <span>{m.nombre}</span>
                        {m.capacidad_kg && (
                          <span className="text-sm text-gray-500">({m.capacidad_kg} kg)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {maquinas.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                {maquinas.length} {tipoMaquina || 'máquina'}(s) disponible(s)
              </p>
            )}
          </div>
        )}

        {/* Display del PIN */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ingrese su PIN
          </label>
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`w-12 h-16 rounded-xl border-2 flex items-center justify-center text-2xl font-bold
                  ${pin.length > i ? 'border-primary bg-primary/10' : 'border-gray-300'}
                `}
              >
                {pin.length > i ? '•' : ''}
              </div>
            ))}
          </div>
          {error && (
            <p className="text-center text-red-500 mt-3 font-medium">{error}</p>
          )}
        </div>

        {/* Teclado numérico */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((key) => (
            <button
              key={key}
              onClick={() => {
                if (key === 'C') handleClear();
                else if (key === '⌫') handleDelete();
                else handleDigit(key);
              }}
              disabled={loading}
              className={`
                h-16 rounded-xl text-2xl font-bold transition-all active:scale-95
                ${key === 'C' ? 'bg-gray-200 text-gray-600' : ''}
                ${key === '⌫' ? 'bg-gray-200 text-gray-600' : ''}
                ${!['C', '⌫'].includes(key) ? 'bg-gray-100 hover:bg-gray-200' : ''}
              `}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Botón confirmar */}
        <button
          onClick={handleConfirm}
          disabled={
            loading ||
            !selectedOperario ||
            pin.length < 4 ||
            (accion === 'iniciar' && requiereMaquina && (!selectedMaquina || maquinas.length === 0))
          }
          className={`
            w-full py-5 rounded-2xl text-xl font-bold flex items-center justify-center gap-3
            transition-all disabled:opacity-50 disabled:cursor-not-allowed
            ${accion === 'iniciar'
              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
              : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
            }
          `}
        >
          {loading ? (
            <RefreshCw className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <Lock className="h-6 w-6" />
              CONFIRMAR
            </>
          )}
        </button>
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
    mutationFn: ({ loteId, etapaId, operarioId, maquinaId }: { loteId: string; etapaId: string; operarioId: string; maquinaId?: string }) =>
      produccionService.iniciarEtapa(loteId, etapaId, { responsable_id: operarioId, maquina_id: maquinaId }),
    onSuccess: () => {
      // Invalidar inmediatamente y refetch para actualizar UI
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['maquinas-disponibles'] });
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

  const handlePinConfirm = (operarioId: string, operarioNombre: string, maquinaId?: string) => {
    const { accion, lote, columna } = pinModal;

    if (!lote || !columna) return;

    toast({ title: `Validado: ${operarioNombre}` });

    if (accion === 'iniciar') {
      iniciarMutation.mutate({
        loteId: lote.id,
        etapaId: columna.etapa_id,
        operarioId,
        maquinaId,
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
        accion={pinModal.accion}
        requiereMaquina={pinModal.columna?.requiere_maquina}
        tipoMaquina={pinModal.columna?.tipo_maquina}
      />
    </div>
  );
}
