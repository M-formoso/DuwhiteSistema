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
  Settings,
  Split,
  Pencil,
  Calculator,
  Plus,
  Undo2,
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
import { formatDate, formatNumber } from '@/utils/formatters';
import type { KanbanLote, KanbanColumna, PrioridadLote } from '@/types/produccion';
import { useAuthStore } from '@/stores/authStore';
import { DividirLoteModal } from '@/components/produccion/DividirLoteModal';
import { CorregirEtapaModal } from '@/components/produccion/CorregirEtapaModal';

function formatTiempo(minutos: number): string {
  if (minutos < 60) return `${minutos}m`;
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  if (horas < 24) return `${horas}h ${mins}m`;
  const dias = Math.floor(horas / 24);
  const horasRestantes = horas % 24;
  return `${dias}d ${horasRestantes}h`;
}

// Tipo local para máquinas disponibles
interface MaquinaDisponible {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  estado: string;
  capacidad_kg: number | null;
}

interface RoutingOption {
  label: string;
  etapaId: string;
  description?: string;
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
    <div className="flex items-center gap-1 font-mono text-sm font-bold">
      <Timer className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
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
  onDividir,
  onCorregir,
  onIrConteo,
  onRevertir,
  esSuperadmin,
  enProceso,
}: {
  lote: KanbanLote;
  columna: KanbanColumna;
  onIniciar: () => void;
  onFinalizar: () => void;
  onDividir: () => void;
  onCorregir: () => void;
  onIrConteo: () => void;
  onRevertir?: () => void;
  esSuperadmin: boolean;
  enProceso: boolean;
}) {
  const prioridad = PRIORIDAD_CONFIG[lote.prioridad];
  const tiempoExcedido = columna.tiempo_estimado_minutos && lote.tiempo_en_etapa_minutos > columna.tiempo_estimado_minutos;

  return (
    <div
      className={`
        relative rounded-xl border-2 p-3 sm:p-4 transition-all duration-300
        ${enProceso ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100' : ''}
        ${lote.esta_atrasado && !enProceso ? 'border-red-500 bg-red-50' : ''}
        ${!enProceso && !lote.esta_atrasado ? `${prioridad.border} bg-white` : ''}
        ${tiempoExcedido ? 'ring-2 ring-orange-300' : ''}
      `}
    >
      {/* Badge de prioridad */}
      <div className="absolute -top-2 left-3">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${prioridad.bg} ${prioridad.text}`}>
          {prioridad.label}
        </span>
      </div>

      {/* Indicador en proceso */}
      {enProceso && (
        <div className="absolute -top-2 right-3">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            EN PROCESO
          </span>
        </div>
      )}

      {/* Atrasado */}
      {lote.esta_atrasado && !enProceso && (
        <div className="absolute -top-2 right-3">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white flex items-center gap-1">
            <AlertTriangle className="h-2.5 w-2.5" />
            ATRASADO
          </span>
        </div>
      )}

      {/* Contenido principal */}
      <div className="mt-1">
        {/* Número de lote */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <h3 className="text-base sm:text-lg font-bold font-mono tracking-wide truncate">{lote.numero}</h3>
          <div className="flex items-center gap-2">
            {esSuperadmin && onRevertir && (
              <button
                type="button"
                title="Revertir última acción"
                onClick={onRevertir}
                className="p-1.5 rounded-full bg-white border border-amber-300 text-amber-600 hover:text-amber-700 hover:border-amber-500"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
            )}
            {enProceso && (
              <button
                type="button"
                title="Corregir peso o máquina"
                onClick={onCorregir}
                className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:text-primary hover:border-primary"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {lote.tiempo_en_etapa_minutos > 0 && (
              <TiempoEnVivo minutos={lote.tiempo_en_etapa_minutos} />
            )}
          </div>
        </div>

        {/* Cliente */}
        {lote.cliente_nombre && (
          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-700 mb-2">
            <User className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="font-medium truncate">{lote.cliente_nombre}</span>
          </div>
        )}

        {/* Info del lote */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          {lote.peso_entrada_kg && (
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2 py-1.5">
              <Scale className="h-4 w-4 text-gray-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500 leading-none">Peso</p>
                <p className="text-sm font-bold truncate">{Number(lote.peso_entrada_kg).toFixed(1)} kg</p>
              </div>
            </div>
          )}
          {lote.cantidad_prendas && (
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2 py-1.5">
              <Shirt className="h-4 w-4 text-gray-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500 leading-none">Prendas</p>
                <p className="text-sm font-bold truncate">{lote.cantidad_prendas}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tiempo estimado vs real */}
        {columna.tiempo_estimado_minutos && lote.tiempo_en_etapa_minutos > 0 && (
          <div className={`rounded-lg px-2 py-1.5 mb-2 ${tiempoExcedido ? 'bg-orange-100' : 'bg-gray-100'}`}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Estimado:</span>
              <span className="font-medium">
                {columna.tiempo_estimado_minutos >= 60
                  ? `${Math.floor(columna.tiempo_estimado_minutos / 60)}h ${columna.tiempo_estimado_minutos % 60}m`
                  : `${columna.tiempo_estimado_minutos}m`}
              </span>
            </div>
            {tiempoExcedido && (
              <div className="flex items-center gap-1 mt-0.5 text-orange-600 font-medium text-[11px]">
                <AlertTriangle className="h-3 w-3" />
                <span>
                  +{Math.floor((lote.tiempo_en_etapa_minutos - columna.tiempo_estimado_minutos) / 60)}h {' '}
                  {(lote.tiempo_en_etapa_minutos - columna.tiempo_estimado_minutos) % 60}m sobre est.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Fecha compromiso */}
        {lote.fecha_compromiso && (
          <div className={`text-xs mb-2 ${lote.esta_atrasado ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
            Compromiso: {formatDate(lote.fecha_compromiso)}
          </div>
        )}

        {/* Resumen de procesamiento (solo en posta Finalizada) */}
        {columna.etapa_codigo === 'FIN' && lote.etapas_resumen && lote.etapas_resumen.length > 0 && (
          <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2">
            <div className="text-[11px] font-bold text-emerald-700 mb-1.5 uppercase tracking-wide">
              Resumen del proceso
            </div>
            <div className="space-y-1">
              {lote.etapas_resumen.map((er) => (
                <div key={er.etapa_codigo} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 truncate">{er.etapa_nombre}</span>
                  <span className="font-medium text-gray-900 flex items-center gap-2 flex-shrink-0">
                    {er.peso_kg !== null && er.peso_kg !== undefined && (
                      <span>{Number(er.peso_kg).toFixed(1)} kg</span>
                    )}
                    <span className="text-gray-500">{formatTiempo(er.duracion_minutos)}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-emerald-200 flex items-center justify-between text-xs font-bold text-emerald-800">
              <span>Total</span>
              <span className="flex items-center gap-2">
                {lote.peso_total_procesado_kg !== null && lote.peso_total_procesado_kg !== undefined && (
                  <span>{Number(lote.peso_total_procesado_kg).toFixed(1)} kg</span>
                )}
                <span>{formatTiempo(lote.duracion_total_minutos || 0)}</span>
              </span>
            </div>
          </div>
        )}

        {/* Botón de acción */}
        {!enProceso ? (
          columna.permite_bifurcacion ? (
            // División: al llegar, abrir directamente el modal de dividir
            <button
              onClick={onDividir}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600
                         text-white text-sm font-bold flex items-center justify-center gap-2
                         hover:from-purple-600 hover:to-purple-700 active:scale-98
                         transition-all shadow-md shadow-purple-100"
            >
              <Split className="h-4 w-4" />
              DIVIDIR
            </button>
          ) : (
            <button
              onClick={onIniciar}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-green-600
                         text-white text-sm font-bold flex items-center justify-center gap-2
                         hover:from-green-600 hover:to-green-700 active:scale-98
                         transition-all shadow-md shadow-green-100"
            >
              <Play className="h-4 w-4" />
              INICIAR ETAPA
            </button>
          )
        ) : columna.etapa_codigo === 'CONT' ? (
          <button
            onClick={onIrConteo}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600
                       text-white text-sm font-bold flex items-center justify-center gap-2
                       hover:from-emerald-600 hover:to-emerald-700 active:scale-98
                       transition-all shadow-md shadow-emerald-100"
          >
            <Calculator className="h-4 w-4" />
            IR A CONTEO
          </button>
        ) : (
          <button
            onClick={onFinalizar}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600
                       text-white text-sm font-bold flex items-center justify-center gap-2
                       hover:from-blue-600 hover:to-blue-700 active:scale-98
                       transition-all shadow-md shadow-blue-100"
          >
            <CheckCircle className="h-4 w-4" />
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
  onDividir,
  onCorregir,
  onIrConteo,
  onRevertir,
  esSuperadmin,
  getLoteEnProceso,
}: {
  columna: KanbanColumna;
  onIniciar: (lote: KanbanLote, columna: KanbanColumna) => void;
  onFinalizar: (lote: KanbanLote, columna: KanbanColumna) => void;
  onDividir: (lote: KanbanLote, columna: KanbanColumna) => void;
  onCorregir: (lote: KanbanLote, columna: KanbanColumna) => void;
  onIrConteo: (lote: KanbanLote, columna: KanbanColumna) => void;
  onRevertir: (lote: KanbanLote) => void;
  esSuperadmin: boolean;
  getLoteEnProceso: (lote: KanbanLote) => boolean;
}) {
  const lotesAtrasados = columna.lotes.filter((l) => l.esta_atrasado).length;
  const lotesUrgentes = columna.lotes.filter((l) => l.prioridad === 'urgente').length;
  const totalKgColumna = columna.lotes.reduce(
    (sum, l) => sum + (Number(l.peso_entrada_kg) || 0),
    0,
  );

  return (
    <div className="flex-shrink-0 w-[88vw] sm:w-[320px] lg:w-[340px] flex flex-col h-full">
      {/* Header de etapa */}
      <div
        className="rounded-t-2xl p-3 sm:p-4 text-white"
        style={{ backgroundColor: columna.etapa_color }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold truncate">{columna.etapa_nombre}</h2>
            {columna.tiempo_estimado_minutos && (
              <p className="text-white/80 text-xs sm:text-sm flex items-center gap-1">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                Est: {columna.tiempo_estimado_minutos >= 60
                  ? `${Math.floor(columna.tiempo_estimado_minutos / 60)}h ${columna.tiempo_estimado_minutos % 60}m`
                  : `${columna.tiempo_estimado_minutos}m`}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-2xl sm:text-4xl font-bold leading-none">{columna.lotes.length}</div>
            <div className="text-xs sm:text-sm text-white/80">lotes</div>
            {totalKgColumna > 0 && (
              <div className="mt-1 flex items-center justify-end gap-1 text-xs sm:text-sm font-semibold text-white/95">
                <Scale className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                {formatNumber(totalKgColumna, 1)} kg
              </div>
            )}
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
      <div className="bg-gray-100 rounded-b-2xl p-2 sm:p-3 flex-1 overflow-y-auto space-y-3">
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
              onDividir={() => onDividir(lote, columna)}
              onCorregir={() => onCorregir(lote, columna)}
              onIrConteo={() => onIrConteo(lote, columna)}
              onRevertir={() => onRevertir(lote)}
              esSuperadmin={esSuperadmin}
              enProceso={getLoteEnProceso(lote)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Modal de PIN para iniciar/finalizar etapa (sin máquinas)
function PinModalGrande({
  open,
  onClose,
  onConfirm,
  title,
  loteNumero,
  etapaNombre,
  etapaCodigo,
  accion,
  routingOptions,
  requiereMaquina = false,
  tipoMaquina = null,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (
    operarioId: string,
    operarioNombre: string,
    canastosIds?: string[],
    pesoKg?: number,
    siguienteEtapaId?: string,
    maquinasConKg?: { maquinaId: string; kg: number }[],
    maquinasIds?: string[],
  ) => void;
  title: string;
  loteNumero?: string;
  etapaNombre?: string;
  etapaCodigo?: string;
  accion: 'iniciar' | 'finalizar';
  routingOptions?: RoutingOption[];
  requiereMaquina?: boolean;
  tipoMaquina?: string | null;
}) {
  const [selectedOperario, setSelectedOperario] = useState('');
  const [selectedCanastos, setSelectedCanastos] = useState<string[]>([]);
  const [pesoKg, setPesoKg] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRoutingId, setSelectedRoutingId] = useState<string | null>(null);
  const [maquinasConKg, setMaquinasConKg] = useState<{ maquinaId: string; kg: number }[]>([]);
  const [selectedMaquinas, setSelectedMaquinas] = useState<string[]>([]);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Mostrar peso en REC (iniciar y finalizar)
  const requierePeso = etapaCodigo === 'REC';
  // Mostrar canastos en REC, LAV, SEC, DIV, PLA
  const muestraCanastos = ['REC', 'LAV', 'SEC', 'DIV', 'PLA'].includes(etapaCodigo || '');
  const esRecepcion = etapaCodigo === 'REC';
  const esLavado = etapaCodigo === 'LAV';
  const muestraRouting = accion === 'finalizar' && !!routingOptions?.length;

  // Fallback por código de etapa: si la prop `requiereMaquina` no vino
  // (o vino en false) pero el código es LAV/SEC/PLA, asumimos que la
  // etapa requiere máquina. Evita que se rompa el flujo si el backend
  // no envía bien el flag.
  const MAQUINA_POR_CODIGO: Record<string, string> = {
    LAV: 'lavadora',
    SEC: 'secadora',
    PLA: 'planchadora',
  };
  const codigoEtapaUpper = (etapaCodigo || '').toUpperCase();
  const tipoMaquinaSegunCodigo = MAQUINA_POR_CODIGO[codigoEtapaUpper];
  const requiereMaquinaEfectivo = requiereMaquina || !!tipoMaquinaSegunCodigo;
  const tipoMaquinaEfectivo = tipoMaquina || tipoMaquinaSegunCodigo || null;

  const requiereMaquinaIniciar = requiereMaquinaEfectivo && accion === 'iniciar';
  const muestraMaquinasLav =
    (esLavado || tipoMaquinaEfectivo === 'lavadora') && requiereMaquinaIniciar;
  const muestraMaquinasSimple = requiereMaquinaIniciar && !muestraMaquinasLav;
  const tipoMaquinaQuery = muestraMaquinasLav ? 'lavadora' : (tipoMaquinaEfectivo || undefined);

  const { data: operarios } = useQuery({
    queryKey: ['operarios-pin'],
    queryFn: () => produccionService.getOperariosConPin(),
    enabled: open,
  });

  const { data: canastos = [] } = useQuery<CanastoDisponible[]>({
    queryKey: ['canastos-disponibles'],
    queryFn: () => canastoService.getDisponibles(),
    enabled: open && muestraCanastos,
  });

  const { data: maquinasDisponibles = [] } = useQuery<MaquinaDisponible[]>({
    queryKey: ['maquinas-disponibles', tipoMaquinaQuery || 'all'],
    queryFn: () => produccionService.getMaquinasDisponibles(tipoMaquinaQuery),
    enabled: open && requiereMaquinaIniciar,
  });
  const lavadoras = maquinasDisponibles;

  useEffect(() => {
    if (open) {
      setSelectedOperario('');
      setSelectedCanastos([]);
      setPesoKg('');
      setPin('');
      setError('');
      setSelectedRoutingId(null);
      setMaquinasConKg([]);
      setSelectedMaquinas([]);
    }
  }, [open]);

  useEffect(() => {
    if (muestraMaquinasLav && lavadoras.length > 0) {
      setMaquinasConKg(lavadoras.map((m) => ({ maquinaId: m.id, kg: 0 })));
    }
  }, [muestraMaquinasLav, lavadoras]);

  useEffect(() => {
    if (selectedOperario && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [selectedOperario]);

  const handleConfirm = async () => {
    if (!selectedOperario) { setError('Seleccione un operario'); return; }
    if (pin.length < 4) { setError('Ingrese su PIN completo'); return; }
    if (requierePeso && (!pesoKg || parseFloat(pesoKg) <= 0)) {
      setError('Debe ingresar el peso del lote');
      return;
    }
    if (esRecepcion && selectedCanastos.length === 0) {
      setError('Debe seleccionar al menos un canasto');
      return;
    }
    if (muestraRouting && !selectedRoutingId) {
      setError('Debe seleccionar el destino del lote');
      return;
    }
    if (muestraMaquinasLav) {
      const conKg = maquinasConKg.filter((m) => m.kg > 0);
      if (conKg.length === 0) {
        setError('Ingresá los kg en al menos una lavadora');
        return;
      }
    }
    if (muestraMaquinasSimple && selectedMaquinas.length === 0) {
      setError('Seleccioná al menos una máquina para esta etapa');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await produccionService.validarPin(selectedOperario, pin);
      if (result.valido) {
        const maqKgFinal = muestraMaquinasLav && maquinasConKg.some((m) => m.kg > 0)
          ? maquinasConKg.filter((m) => m.kg > 0)
          : undefined;
        onConfirm(
          result.operario_id,
          result.operario_nombre,
          selectedCanastos.length > 0 ? selectedCanastos : undefined,
          pesoKg ? parseFloat(pesoKg) : undefined,
          selectedRoutingId ?? undefined,
          maqKgFinal,
          selectedMaquinas.length > 0 ? selectedMaquinas : undefined,
        );
        setPin('');
        setSelectedOperario('');
        setSelectedCanastos([]);
        setPesoKg('');
        setSelectedRoutingId(null);
        setMaquinasConKg([]);
        setSelectedMaquinas([]);
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

  const toggleCanasto = (canastoId: string) => {
    setSelectedCanastos((prev) =>
      prev.includes(canastoId) ? prev.filter((id) => id !== canastoId) : [...prev, canastoId]
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedOperario && pin.length >= 4) handleConfirm();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl w-full max-w-[450px] max-h-[95vh] flex flex-col p-4 sm:p-6 relative shadow-xl">
        {/* Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1 rounded-full hover:bg-gray-100"
        >
          <X className="h-5 w-5 text-gray-400" />
        </button>

        {/* Header */}
        <div className="mb-4 sm:mb-6 flex-shrink-0 pr-8">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-5 w-5 text-primary flex-shrink-0" />
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{title}</h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-500">
            Valida tu PIN para {accion === 'iniciar' ? 'iniciar' : 'finalizar'} esta etapa
          </p>
          {loteNumero && etapaNombre && (
            <p className="text-xs sm:text-sm font-medium text-gray-900 mt-1 truncate">
              Lote {loteNumero} - {etapaNombre}
            </p>
          )}
        </div>

        <div className="space-y-3 sm:space-y-4 flex-1 overflow-y-auto pr-1">
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

          {/* Input de PIN + teclado numérico en pantalla */}
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
              className="w-full h-12 px-3 rounded-md border border-gray-300 text-center text-2xl tracking-widest font-mono bg-white disabled:bg-gray-50"
            />
            {!selectedOperario && (
              <p className="text-xs text-amber-600">
                Seleccioná un operario para habilitar el PIN.
              </p>
            )}

            {/* Teclado numérico en pantalla — funciona sin depender del teclado del SO */}
            <div className="grid grid-cols-3 gap-2 pt-1 select-none">
              {(['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={!selectedOperario}
                  onClick={() => {
                    if (pin.length >= 6) return;
                    setPin((p) => p + d);
                    setError('');
                  }}
                  className="h-14 sm:h-16 rounded-xl border border-gray-300 bg-white text-2xl font-bold text-gray-800
                             active:bg-gray-200 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                disabled={!selectedOperario || pin.length === 0}
                onClick={() => {
                  setPin('');
                  setError('');
                }}
                className="h-14 sm:h-16 rounded-xl border border-amber-300 bg-amber-50 text-sm font-semibold text-amber-700
                           active:bg-amber-100 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Borrar
              </button>
              <button
                type="button"
                disabled={!selectedOperario}
                onClick={() => {
                  if (pin.length >= 6) return;
                  setPin((p) => p + '0');
                  setError('');
                }}
                className="h-14 sm:h-16 rounded-xl border border-gray-300 bg-white text-2xl font-bold text-gray-800
                           active:bg-gray-200 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                0
              </button>
              <button
                type="button"
                disabled={!selectedOperario || pin.length === 0}
                onClick={() => {
                  setPin((p) => p.slice(0, -1));
                  setError('');
                }}
                className="h-14 sm:h-16 rounded-xl border border-gray-300 bg-white text-xl font-semibold text-gray-700
                           active:bg-gray-200 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ←
              </button>
            </div>
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

          {/* Selector de canastos (REC, LAV, SEC) */}
          {muestraCanastos && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Canastos {esRecepcion && <span className="text-red-500">*</span>}
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
                <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                  <div className="grid grid-cols-4 xs:grid-cols-5 gap-1.5 sm:gap-2">
                    {canastos.map((canasto) => (
                      <div
                        key={canasto.id}
                        onClick={() => toggleCanasto(canasto.id)}
                        className={`
                          flex items-center justify-center p-2 sm:p-3 rounded-lg cursor-pointer
                          border-2 transition-all text-base sm:text-lg font-bold
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
              <p className="text-xs text-gray-500">
                {esRecepcion ? 'Seleccioná los canastos donde se colocará el lote' : 'Canastos para esta etapa (opcional)'}
              </p>
            </div>
          )}

          {/* Kg por lavadora (solo LAV + iniciar) */}
          {muestraMaquinasLav && lavadoras.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Kg por lavadora
              </label>
              <div className="space-y-2">
                {lavadoras.map((lav) => {
                  const row = maquinasConKg.find((m) => m.maquinaId === lav.id);
                  return (
                    <div key={lav.id} className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 w-28 truncate">{lav.nombre}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={row?.kg ?? 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setMaquinasConKg((prev) =>
                            prev.map((m) => m.maquinaId === lav.id ? { ...m, kg: val } : m)
                          );
                        }}
                        className="flex-1 h-10 px-3 rounded-md border border-gray-300 text-sm"
                        placeholder="0"
                      />
                      <span className="text-sm text-gray-500">kg</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selección de máquinas simple (PLA, SEC) */}
          {muestraMaquinasSimple && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Máquinas <span className="text-red-500">*</span>
              </label>
              {maquinasDisponibles.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-800 text-sm">
                  No hay máquinas disponibles{tipoMaquinaEfectivo ? ` del tipo "${tipoMaquinaEfectivo}"` : ''}.
                  Liberá una desde Máquinas o esperá a que termine otro lote.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {maquinasDisponibles.map((m) => {
                    const selected = selectedMaquinas.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setSelectedMaquinas((prev) =>
                            prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                          )
                        }
                        className={`flex items-center gap-2 p-2 rounded-lg border-2 text-left transition-all active:scale-[0.98] ${
                          selected
                            ? 'border-primary bg-primary/10'
                            : 'border-gray-200 bg-white hover:border-primary/40'
                        }`}
                      >
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${
                            selected ? 'bg-primary border-primary text-white text-xs' : 'border-gray-300'
                          }`}
                        >
                          {selected && '✓'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{m.codigo || m.nombre}</div>
                          {m.codigo && m.nombre && m.codigo !== m.nombre && (
                            <div className="text-[11px] text-gray-500 truncate">{m.nombre}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-gray-500">
                Podés elegir una o varias. Quedan reservadas hasta finalizar la etapa.
              </p>
            </div>
          )}

          {/* Opciones de destino (LAV finalizar) */}
          {muestraRouting && routingOptions && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Destino del lote <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {routingOptions.map((opt) => (
                  <button
                    key={opt.etapaId}
                    type="button"
                    onClick={() => setSelectedRoutingId(opt.etapaId)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                      selectedRoutingId === opt.etapaId
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="font-medium text-sm">{opt.label}</div>
                    {opt.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                    )}
                  </button>
                ))}
              </div>
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
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 mt-4 sm:mt-6 flex-shrink-0 pt-3 sm:pt-4 border-t">
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50
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
              (requierePeso && (!pesoKg || parseFloat(pesoKg) <= 0)) ||
              (esRecepcion && selectedCanastos.length === 0) ||
              (muestraRouting && !selectedRoutingId)
            }
            className="w-full sm:w-auto px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90
                       disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
  const user = useAuthStore((s) => s.user);
  const esOperario = user?.rol === 'operador';

  const [fullscreen, setFullscreen] = useState(false);
  const [pinModal, setPinModal] = useState<{
    open: boolean;
    accion: 'iniciar' | 'finalizar';
    lote?: KanbanLote;
    columna?: KanbanColumna;
  }>({ open: false, accion: 'iniciar' });

  // Estado para el modal de Dividir lote (bifurcación)
  const [dividirData, setDividirData] = useState<{
    loteId: string;
    loteNumero: string;
    etapaId: string;
    etapaNombre: string;
    pesoKg: number;
  } | null>(null);

  // Estado para el modal de Corrección (peso/máquinas) del lote en proceso
  const [corregirData, setCorregirData] = useState<{
    loteId: string;
    etapaId: string;
    loteNumero: string;
    etapaNombre: string;
    pesoActualKg: number | null;
    requiereMaquina: boolean;
    tipoMaquina: string | null;
    maquinasActuales: string[];
  } | null>(null);

  // Cargar Kanban - refetch cada 10 segundos para mantener sincronizado
  const { data: kanban, isLoading, refetch } = useQuery({
    queryKey: ['kanban'],
    queryFn: () => produccionService.getKanbanBoard(),
    refetchInterval: 10000,
  });

  // Mutations
  const iniciarMutation = useMutation({
    mutationFn: ({ loteId, etapaId, operarioId, maquinasIds, canastosIds, pesoKg, maquinasConKg }: {
      loteId: string;
      etapaId: string;
      operarioId: string;
      maquinasIds?: string[];
      canastosIds?: string[];
      pesoKg?: number;
      maquinasConKg?: { maquinaId: string; kg: number }[];
    }) =>
      produccionService.iniciarEtapa(loteId, etapaId, {
        responsable_id: operarioId,
        maquinas_ids: maquinasIds,
        canastos_ids: canastosIds,
        peso_kg: pesoKg,
        maquinas_con_kg: maquinasConKg?.map((m) => ({ maquina_id: m.maquinaId, kg: m.kg })),
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
    mutationFn: ({ loteId, etapaId, responsable_id, canastos_ids, peso_kg, siguiente_etapa_id }: {
      loteId: string;
      etapaId: string;
      responsable_id?: string;
      canastos_ids?: string[];
      peso_kg?: number;
      siguiente_etapa_id?: string;
    }) =>
      produccionService.finalizarEtapa(loteId, etapaId, { responsable_id, canastos_ids, peso_kg, siguiente_etapa_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['canastos-disponibles'] });
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

  const handleDividir = (lote: KanbanLote, columna: KanbanColumna) => {
    setDividirData({
      loteId: lote.id,
      loteNumero: lote.numero,
      etapaId: columna.etapa_id,
      etapaNombre: columna.etapa_nombre,
      pesoKg: Number(lote.peso_entrada_kg) || 0,
    });
  };

  const handleIrConteo = (lote: KanbanLote) => {
    navigate(`/produccion/lotes/${lote.id}/conteo`);
  };

  const revertirMutation = useMutation({
    mutationFn: (loteId: string) => produccionService.revertirUltimaAccionLote(loteId),
    onSuccess: (res) => {
      toast({ title: 'Acción revertida', description: res.mensaje });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['maquinas-disponibles'] });
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'No se pudo revertir la acción.';
      toast({ title: 'Error', description: detail, variant: 'destructive' });
    },
  });

  const handleRevertir = (lote: KanbanLote) => {
    if (
      !window.confirm(
        `¿Revertir la última acción del lote ${lote.numero}? Esto reabre la etapa o cancela el inicio.`,
      )
    ) {
      return;
    }
    revertirMutation.mutate(lote.id);
  };

  const handleCorregir = (lote: KanbanLote, columna: KanbanColumna) => {
    setCorregirData({
      loteId: lote.id,
      etapaId: columna.etapa_id,
      loteNumero: lote.numero,
      etapaNombre: columna.etapa_nombre,
      pesoActualKg:
        lote.peso_entrada_kg !== null && lote.peso_entrada_kg !== undefined
          ? Number(lote.peso_entrada_kg)
          : null,
      requiereMaquina: !!columna.requiere_maquina,
      tipoMaquina: columna.tipo_maquina ?? null,
      maquinasActuales: lote.maquinas_ids || [],
    });
  };

  const handlePinConfirm = (
    operarioId: string,
    operarioNombre: string,
    canastosIds?: string[],
    pesoKg?: number,
    siguienteEtapaId?: string,
    maquinasConKg?: { maquinaId: string; kg: number }[],
    maquinasIds?: string[],
  ) => {
    const { accion, lote, columna } = pinModal;

    if (!lote || !columna) return;

    toast({ title: `Validado: ${operarioNombre}` });

    if (accion === 'iniciar') {
      iniciarMutation.mutate({
        loteId: lote.id,
        etapaId: columna.etapa_id,
        operarioId,
        maquinasIds,
        canastosIds,
        pesoKg,
        maquinasConKg,
      });
    } else {
      finalizarMutation.mutate({
        loteId: lote.id,
        etapaId: columna.etapa_id,
        responsable_id: operarioId,
        canastos_ids: canastosIds,
        peso_kg: pesoKg,
        siguiente_etapa_id: siguienteEtapaId,
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
      <div className="bg-white border-b flex-shrink-0 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          {/* Logo y título */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
              <Package className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">Panel de Producción</h1>
              <p className="text-gray-500 text-xs sm:text-sm truncate">
                {new Date().toLocaleDateString('es-AR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                })}
              </p>
            </div>
          </div>

          {/* Stats rápidos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:flex xl:items-center gap-2 sm:gap-3 xl:gap-6">
            <div className="text-center px-2 sm:px-4 py-2 bg-gray-100 rounded-xl">
              <p className="text-xl sm:text-3xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 leading-tight">LOTES ACTIVOS</p>
            </div>
            {stats.enProceso > 0 && (
              <div className="text-center px-2 sm:px-4 py-2 bg-blue-100 rounded-xl">
                <p className="text-xl sm:text-3xl font-bold text-blue-700">{stats.enProceso}</p>
                <p className="text-[10px] sm:text-xs text-blue-600 leading-tight">EN PROCESO</p>
              </div>
            )}
            {stats.atrasados > 0 && (
              <div className="text-center px-2 sm:px-4 py-2 bg-red-100 rounded-xl">
                <p className="text-xl sm:text-3xl font-bold text-red-700">{stats.atrasados}</p>
                <p className="text-[10px] sm:text-xs text-red-600 leading-tight">ATRASADOS</p>
              </div>
            )}
            {stats.urgentes > 0 && (
              <div className="text-center px-2 sm:px-4 py-2 bg-amber-100 rounded-xl">
                <p className="text-xl sm:text-3xl font-bold text-amber-700">{stats.urgentes}</p>
                <p className="text-[10px] sm:text-xs text-amber-600 leading-tight">URGENTES</p>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              onClick={() => navigate('/produccion/lotes/nuevo')}
              className="h-10 sm:h-12 flex-1 xl:flex-initial bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
              <span className="hidden sm:inline">Nuevo Lote</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="h-10 sm:h-12 flex-1 xl:flex-initial"
            >
              <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
            <Button
              variant="outline"
              onClick={toggleFullscreen}
              className="h-10 sm:h-12 hidden sm:inline-flex"
            >
              <Maximize2 className="h-5 w-5" />
            </Button>
            {!esOperario && (
              <Button
                variant="outline"
                onClick={() => navigate('/produccion')}
                className="h-10 sm:h-12 flex-1 xl:flex-initial"
              >
                <span className="text-sm sm:text-base">Vista Admin</span>
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tablero Kanban */}
      <div className="p-3 sm:p-6 overflow-x-auto flex-1 overflow-y-hidden">
        <div className="flex gap-3 sm:gap-6 h-full" style={{ minWidth: 'max-content' }}>
          {/* Columnas normales (excluye CONT) */}
          {kanban?.columnas.filter((c) => c.etapa_codigo !== 'CONT').map((columna) => (
            <EtapaColumna
              key={columna.etapa_id}
              columna={columna}
              onIniciar={handleIniciar}
              onFinalizar={handleFinalizar}
              onDividir={handleDividir}
              onCorregir={handleCorregir}
              onIrConteo={handleIrConteo}
              onRevertir={handleRevertir}
              esSuperadmin={user?.rol === 'superadmin'}
              getLoteEnProceso={getLoteEnProceso}
            />
          ))}

          {/* Columna especial: Listos para Conteo */}
          {(() => {
            const contLotes = kanban?.columnas.find((c) => c.etapa_codigo === 'CONT')?.lotes ?? [];
            return (
              <div className="flex-shrink-0 w-64 sm:w-72 flex flex-col h-full">
                <div className="bg-white rounded-2xl border-2 border-green-300 shadow-sm flex flex-col h-full overflow-hidden">
                  <div className="px-4 py-3 border-b border-green-200 bg-green-50 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="font-bold text-green-800 text-sm">Listos para Conteo</span>
                      </div>
                      <span className="bg-green-200 text-green-800 text-xs font-bold px-2 py-0.5 rounded-full">
                        {contLotes.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {contLotes.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
                        <Package className="h-10 w-10 mb-2 opacity-40" />
                        <span className="text-sm">Sin lotes</span>
                      </div>
                    ) : (
                      contLotes.map((lote) => (
                        <div
                          key={lote.id}
                          className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-base text-gray-800">{lote.numero}</span>
                            {lote.peso_entrada_kg && (
                              <span className="text-xs text-gray-500">
                                {formatNumber(Number(lote.peso_entrada_kg), 1)} kg
                              </span>
                            )}
                          </div>
                          {lote.cliente_nombre && (
                            <p className="text-sm text-gray-600 truncate">{lote.cliente_nombre}</p>
                          )}
                          <button
                            onClick={() => navigate(`/produccion/lotes/${lote.id}/conteo`)}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600
                                       text-white text-sm font-bold flex items-center justify-center gap-2
                                       hover:from-emerald-600 hover:to-emerald-700 active:scale-98
                                       transition-all shadow-md shadow-emerald-100"
                          >
                            <Calculator className="h-4 w-4" />
                            IR A CONTEO
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
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
        requiereMaquina={!!pinModal.columna?.requiere_maquina}
        tipoMaquina={pinModal.columna?.tipo_maquina ?? null}
        routingOptions={
          pinModal.accion === 'finalizar' && pinModal.columna?.etapa_codigo === 'LAV'
            ? (() => {
                const divCol = kanban?.columnas.find((c) => c.permite_bifurcacion);
                const secCol = kanban?.columnas.find((c) => c.etapa_codigo === 'SEC');
                const opts: RoutingOption[] = [];
                if (secCol) opts.push({ label: 'Solo Secado', etapaId: secCol.etapa_id, description: 'El lote pasa directo a Secado' });
                if (divCol) opts.push({ label: 'Secado + Planchado', etapaId: divCol.etapa_id, description: 'El lote se divide entre Secado y Planchado' });
                return opts.length > 0 ? opts : undefined;
              })()
            : undefined
        }
      />

      {/* Modal Dividir lote (bifurcación: Estirado, Planchado/Secado) */}
      {dividirData && (
        <DividirLoteModal
          open={true}
          onClose={() => setDividirData(null)}
          loteId={dividirData.loteId}
          loteNumero={dividirData.loteNumero}
          etapaId={dividirData.etapaId}
          etapaNombre={dividirData.etapaNombre}
          pesoTotalKg={dividirData.pesoKg}
        />
      )}

      {/* Modal Corregir lote en proceso */}
      {corregirData && (
        <CorregirEtapaModal
          open={true}
          onClose={() => setCorregirData(null)}
          loteId={corregirData.loteId}
          etapaId={corregirData.etapaId}
          loteNumero={corregirData.loteNumero}
          etapaNombre={corregirData.etapaNombre}
          pesoActualKg={corregirData.pesoActualKg}
          requiereMaquina={corregirData.requiereMaquina}
          tipoMaquina={corregirData.tipoMaquina}
          maquinasActuales={corregirData.maquinasActuales}
        />
      )}
    </div>
  );
}
