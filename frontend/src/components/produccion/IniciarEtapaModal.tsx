/**
 * Modal para iniciar/finalizar una etapa: PIN + canastos + peso (sin máquinas)
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, User, Loader2, Box, Check, Scale, Wrench, Keyboard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

import { produccionService } from '@/services/produccionService';
import { canastoService } from '@/services/canastoService';

interface Operario {
  id: string;
  nombre: string;
  rol: string;
}

interface Canasto {
  id: string;
  numero: number;
  codigo: string;
  estado: string;
}

interface CanastoAsignado {
  id: string;
  canasto_id: string;
  canasto_numero: number;
  canasto_codigo: string;
}

interface RoutingOption {
  label: string;
  etapaId: string;
  description?: string;
}

interface MaquinaDisponible {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
}

interface IniciarEtapaModalProps {
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
  title?: string;
  description?: string;
  etapaNombre?: string;
  loteNumero?: string;
  loteId?: string;
  showCanastosSelection?: boolean;
  etapaCodigo?: string;
  showPesoInput?: boolean;
  accion?: 'iniciar' | 'finalizar';
  routingOptions?: RoutingOption[];
  requiereMaquina?: boolean;
  tipoMaquina?: string | null;
}

export function IniciarEtapaModal({
  open,
  onClose,
  onConfirm,
  title = 'Iniciar Etapa',
  description = 'Valida tu PIN para iniciar esta etapa',
  etapaNombre,
  loteNumero,
  loteId,
  showCanastosSelection = false,
  etapaCodigo,
  showPesoInput = false,
  accion = 'iniciar',
  routingOptions,
  requiereMaquina = false,
  tipoMaquina = null,
}: IniciarEtapaModalProps) {
  const [operarioId, setOperarioId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [selectedCanastos, setSelectedCanastos] = useState<string[]>([]);
  const [pesoKg, setPesoKg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [selectedRoutingId, setSelectedRoutingId] = useState<string | null>(null);
  const [maquinasConKg, setMaquinasConKg] = useState<{ maquinaId: string; nombre: string; kg: string }[]>([]);
  const [selectedMaquinas, setSelectedMaquinas] = useState<string[]>([]);
  // Teclado virtual: visible u oculto. Se persiste la preferencia para
  // que el operario configure una vez y se aplique siempre.
  const [mostrarTeclado, setMostrarTeclado] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('pin-teclado-visible');
      return v === null ? true : v === 'true';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('pin-teclado-visible', String(mostrarTeclado));
    } catch {
      /* ignore */
    }
  }, [mostrarTeclado]);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Etapas que trabajan con canastos. Al finalizar cualquiera, el
  // operario puede decidir qué canastos siguen con el lote y cuáles libera.
  const muestraCanastos = showCanastosSelection || ['REC', 'LAV', 'SEC', 'DIV', 'PLA'].includes(etapaCodigo || '');
  const esEtapaRecepcion = etapaCodigo === 'REC';
  const requierePeso = showPesoInput || etapaCodigo === 'REC';
  const esLavado = etapaCodigo === 'LAV';
  const muestraRouting = (routingOptions?.length ?? 0) > 0;

  // Fallback por código de etapa: si la prop `requiereMaquina` no vino
  // (o vino en false) pero el código es LAV/SEC/PLA, asumimos que la
  // etapa requiere máquina. Evita que se rompa el flujo si el backend
  // no envía bien el flag o si la columna no se encuentra.
  const MAQUINA_POR_CODIGO: Record<string, string> = {
    LAV: 'lavadora',
    SEC: 'secadora',
    PLA: 'planchadora',
  };
  const codigoEtapaUpper = (etapaCodigo || '').toUpperCase();
  const tipoMaquinaSegunCodigo = MAQUINA_POR_CODIGO[codigoEtapaUpper];
  const requiereMaquinaEfectivo = requiereMaquina || !!tipoMaquinaSegunCodigo;
  const tipoMaquinaEfectivo = tipoMaquina || tipoMaquinaSegunCodigo || null;

  // Iniciar: si la etapa requiere máquina, se muestra el selector.
  // LAV usa la UI especial con kg por lavadora; el resto usa multi-select simple.
  const requiereMaquinaIniciar = requiereMaquinaEfectivo && accion === 'iniciar';
  const muestraMaquinasLav = (esLavado || tipoMaquinaEfectivo === 'lavadora') && requiereMaquinaIniciar;
  const muestraMaquinasSimple = requiereMaquinaIniciar && !muestraMaquinasLav;
  const tipoMaquinaQuery = muestraMaquinasLav ? 'lavadora' : (tipoMaquinaEfectivo || undefined);

  const { data: operarios = [], isLoading: loadingOperarios } = useQuery<Operario[]>({
    queryKey: ['operarios-con-pin'],
    queryFn: () => produccionService.getOperariosConPin(),
    enabled: open,
  });

  const { data: canastosDisponibles = [], isLoading: loadingCanastos, refetch: refetchCanastos } = useQuery<Canasto[]>({
    queryKey: ['canastos-disponibles'],
    queryFn: () => canastoService.getDisponibles(),
    enabled: open && muestraCanastos,
  });

  const { data: canastosDelLote = [], isLoading: loadingCanastosLote } = useQuery<CanastoAsignado[]>({
    queryKey: ['canastos-lote', loteId],
    queryFn: () => canastoService.getCanastosLote(loteId!),
    enabled: open && muestraCanastos && !!loteId && !esEtapaRecepcion,
  });

  const { data: maquinasDisponibles = [], isLoading: loadingMaquinas } = useQuery<MaquinaDisponible[]>({
    queryKey: ['maquinas-disponibles', tipoMaquinaQuery || 'all'],
    queryFn: async () => {
      return produccionService.getMaquinasDisponibles(tipoMaquinaQuery);
    },
    enabled: open && requiereMaquinaIniciar,
  });
  const lavadoras = maquinasDisponibles;

  useEffect(() => {
    if (open) {
      setOperarioId('');
      setPin('');
      setSelectedCanastos([]);
      setPesoKg('');
      setError(null);
      setSelectedRoutingId(null);
      setMaquinasConKg([]);
      setSelectedMaquinas([]);
      if (muestraCanastos) refetchCanastos();
    }
  }, [open, refetchCanastos, muestraCanastos]);

  // Init lavadoras rows when list loads
  useEffect(() => {
    if (muestraMaquinasLav && lavadoras.length > 0 && maquinasConKg.length === 0) {
      setMaquinasConKg(lavadoras.map(m => ({ maquinaId: m.id, nombre: m.codigo || m.nombre, kg: '' })));
    }
  }, [lavadoras, muestraMaquinasLav, maquinasConKg.length]);

  useEffect(() => {
    if (canastosDelLote.length > 0 && !esEtapaRecepcion) {
      setSelectedCanastos(canastosDelLote.map(c => c.canasto_id));
    }
  }, [canastosDelLote, esEtapaRecepcion]);

  useEffect(() => {
    if (operarioId && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [operarioId]);

  const handleValidate = async () => {
    if (!operarioId || !pin) {
      setError('Selecciona un operario e ingresa el PIN');
      return;
    }
    if (esEtapaRecepcion && selectedCanastos.length === 0) {
      setError('Debes seleccionar al menos un canasto');
      return;
    }
    if (requierePeso && (!pesoKg || parseFloat(pesoKg) <= 0)) {
      setError('Debes ingresar el peso del lote');
      return;
    }
    if (muestraRouting && !selectedRoutingId) {
      setError('Debés seleccionar a dónde va el lote');
      return;
    }
    if (muestraMaquinasLav) {
      const conKg = maquinasConKg.filter(m => m.kg && parseFloat(m.kg) > 0);
      if (conKg.length === 0) {
        setError('Ingresá los kg en al menos una lavadora');
        return;
      }
    }
    if (muestraMaquinasSimple && selectedMaquinas.length === 0) {
      setError('Seleccioná al menos una máquina para esta etapa');
      return;
    }

    setValidating(true);
    setError(null);

    try {
      const result = await produccionService.validarPin(operarioId, pin);
      if (result.valido) {
        const maqConKgFiltradas = maquinasConKg
          .filter(m => m.kg && parseFloat(m.kg) > 0)
          .map(m => ({ maquinaId: m.maquinaId, kg: parseFloat(m.kg) }));
        onConfirm(
          operarioId,
          result.operario_nombre,
          selectedCanastos.length > 0 ? selectedCanastos : undefined,
          pesoKg ? parseFloat(pesoKg) : undefined,
          selectedRoutingId ?? undefined,
          maqConKgFiltradas.length > 0 ? maqConKgFiltradas : undefined,
          selectedMaquinas.length > 0 ? selectedMaquinas : undefined,
        );
        onClose();
      } else {
        setError(result.mensaje || 'PIN incorrecto');
        setPin('');
        pinInputRef.current?.focus();
      }
    } catch {
      setError('Error al validar el PIN');
    } finally {
      setValidating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && operarioId && pin.length >= 4) {
      handleValidate();
    }
  };

  const toggleCanasto = (canastoId: string) => {
    setSelectedCanastos((prev) =>
      prev.includes(canastoId)
        ? prev.filter((id) => id !== canastoId)
        : [...prev, canastoId]
    );
  };

  const canastosParaMostrar = esEtapaRecepcion
    ? canastosDisponibles
    : (() => {
        const idsDelLote = new Set(canastosDelLote.map(c => c.canasto_id));
        return [
          ...canastosDelLote.map(c => ({
            id: c.canasto_id,
            numero: c.canasto_numero,
            codigo: c.canasto_codigo,
            estado: 'en_uso' as const,
            esDelLote: true,
          })),
          ...canastosDisponibles
            .filter(c => !idsDelLote.has(c.id))
            .map(c => ({ ...c, esDelLote: false })),
        ];
      })();

  const isLoading = loadingOperarios || loadingCanastos || loadingCanastosLote || loadingMaquinas;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px] w-[95vw] max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <KeyRound className="h-5 w-5 text-primary flex-shrink-0" />
            <span className="truncate">{title}</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {description}
            {loteNumero && etapaNombre && (
              <span className="block mt-1 font-medium text-foreground">
                Lote {loteNumero} - {etapaNombre}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 py-3 sm:py-4 overflow-y-auto flex-1">
          {/* Selector de operario */}
          <div className="space-y-2">
            <Label>Operario</Label>
            {loadingOperarios ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando operarios...
              </div>
            ) : operarios.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No hay operarios con PIN configurado.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={operarioId || undefined} onValueChange={setOperarioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar operario..." />
                </SelectTrigger>
                <SelectContent>
                  {operarios.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {op.nombre}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* PIN */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>PIN</Label>
              <button
                type="button"
                onClick={() => setMostrarTeclado((v) => !v)}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                title={mostrarTeclado ? 'Ocultar teclado en pantalla' : 'Mostrar teclado en pantalla'}
              >
                <Keyboard className="h-3.5 w-3.5" />
                {mostrarTeclado ? 'Ocultar' : 'Mostrar'} teclado
              </button>
            </div>
            <Input
              ref={pinInputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setPin(value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ingrese PIN de 4-6 dígitos"
              disabled={!operarioId}
              className="text-center text-2xl tracking-widest font-mono"
            />
            {!operarioId && (
              <p className="text-xs text-amber-600">Seleccioná un operario para habilitar el PIN.</p>
            )}
            {mostrarTeclado && (
            <div className="grid grid-cols-3 gap-2 pt-1 select-none">
              {(['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={!operarioId}
                  onClick={() => {
                    if (pin.length >= 6) return;
                    setPin((p) => p + d);
                    setError(null);
                  }}
                  className="h-12 rounded-md border border-gray-300 bg-white text-xl font-bold text-gray-800
                             active:bg-gray-200 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                disabled={!operarioId || pin.length === 0}
                onClick={() => { setPin(''); setError(null); }}
                className="h-12 rounded-md border border-amber-300 bg-amber-50 text-sm font-semibold text-amber-700
                           active:bg-amber-100 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Borrar
              </button>
              <button
                type="button"
                disabled={!operarioId}
                onClick={() => {
                  if (pin.length >= 6) return;
                  setPin((p) => p + '0');
                  setError(null);
                }}
                className="h-12 rounded-md border border-gray-300 bg-white text-xl font-bold text-gray-800
                           active:bg-gray-200 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                0
              </button>
              <button
                type="button"
                disabled={!operarioId || pin.length === 0}
                onClick={() => { setPin((p) => p.slice(0, -1)); setError(null); }}
                className="h-12 rounded-md border border-gray-300 bg-white text-base font-semibold text-gray-700
                           active:bg-gray-200 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ←
              </button>
            </div>
            )}
          </div>

          {/* Peso */}
          {requierePeso && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Peso (kg) <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                inputMode="decimal"
                value={pesoKg}
                onChange={(e) => {
                  let v = e.target.value.replace(/[^\d.,]/g, '').replace(/,/g, '.');
                  const parts = v.split('.');
                  if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
                  setPesoKg(v);
                }}
                placeholder="Ej: 45,5"
                className="text-lg text-right font-medium"
              />
              <p className="text-xs text-muted-foreground">
                Usá el punto o la coma para los decimales (ej: 45.5 o 45,5).
              </p>
            </div>
          )}

          {/* Canastos */}
          {muestraCanastos && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 flex-wrap">
                <Box className="h-4 w-4" />
                Canastos {esEtapaRecepcion && <span className="text-red-500">*</span>}
                {!esEtapaRecepcion && canastosDelLote.length > 0 && (
                  <Badge variant="outline" className="text-blue-600 border-blue-300">
                    {canastosDelLote.length} asignados
                  </Badge>
                )}
                {selectedCanastos.length > 0 && (
                  <Badge variant="secondary">{selectedCanastos.length} sel.</Badge>
                )}
              </Label>
              {(loadingCanastos || loadingCanastosLote) ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando canastos...
                </div>
              ) : canastosParaMostrar.length === 0 ? (
                <Alert variant="destructive">
                  <AlertDescription>No hay canastos disponibles.</AlertDescription>
                </Alert>
              ) : (
                <div className="max-h-40 sm:max-h-32 overflow-y-auto border rounded-md p-2">
                  <div className="grid grid-cols-4 xs:grid-cols-5 gap-1.5 sm:gap-2">
                    {canastosParaMostrar.map((canasto) => {
                      const isSelected = selectedCanastos.includes(canasto.id);
                      const isFromLote = 'esDelLote' in canasto && canasto.esDelLote;
                      return (
                        <div
                          key={canasto.id}
                          onClick={() => toggleCanasto(canasto.id)}
                          className={`
                            flex items-center justify-center p-2 rounded-md cursor-pointer
                            border-2 transition-all text-sm font-medium
                            ${isSelected
                              ? isFromLote
                                ? 'bg-blue-500 text-white border-blue-600'
                                : 'bg-primary text-primary-foreground border-primary'
                              : isFromLote
                                ? 'bg-blue-50 border-blue-300 hover:border-blue-500'
                                : 'bg-green-50 border-green-300 hover:border-green-500'
                            }
                          `}
                          title={isFromLote ? 'Ya asignado a este lote' : 'Disponible'}
                        >
                          {isSelected && <Check className="h-3 w-3 mr-1" />}
                          #{canasto.numero}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {esEtapaRecepcion
                  ? 'Selecciona los canastos donde se colocará el lote'
                  : accion === 'finalizar'
                    ? 'Marcá los canastos que SIGUEN con el lote. Los desmarcados se liberan al cerrar la etapa.'
                    : canastosDelLote.length > 0
                      ? 'Azul = ya asignados al lote · Podés sumar disponibles o quitar'
                      : 'Selecciona los canastos para este lote'
                }
              </p>
            </div>
          )}

          {/* Lavadoras con kg (solo LAV iniciar) */}
          {muestraMaquinasLav && maquinasConKg.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Kg por lavadora
              </Label>
              <div className="space-y-2">
                {maquinasConKg.map((m, i) => (
                  <div key={m.maquinaId} className="flex items-center gap-2">
                    <span className="text-sm font-medium w-24 truncate">{m.nombre}</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,0"
                      value={m.kg}
                      onChange={(e) => {
                        // Acepta dígitos + un solo separador (. o ,).
                        // Internamente normaliza a punto. Permite vacío.
                        let v = e.target.value.replace(/[^\d.,]/g, '').replace(/,/g, '.');
                        const parts = v.split('.');
                        if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
                        setMaquinasConKg((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, kg: v } : x))
                        );
                      }}
                      className="flex-1 text-right text-lg font-medium"
                    />
                    <span className="text-sm text-muted-foreground w-6">kg</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: usá el punto o la coma para los decimales (ej: 12.5 o 12,5).
              </p>
            </div>
          )}

          {/* Selección simple de máquinas (PLA, SEC, etc.) */}
          {muestraMaquinasSimple && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Máquinas <span className="text-red-500">*</span>
              </Label>
              {loadingMaquinas ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando máquinas...
                </div>
              ) : maquinasDisponibles.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No hay máquinas disponibles{tipoMaquinaEfectivo ? ` del tipo "${tipoMaquinaEfectivo}"` : ''}. Liberá una desde Máquinas o esperá a que termine otro lote.
                  </AlertDescription>
                </Alert>
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
                            selected ? 'bg-primary border-primary' : 'border-gray-300'
                          }`}
                        >
                          {selected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{m.codigo || m.nombre}</div>
                          {m.codigo && m.nombre && m.codigo !== m.nombre && (
                            <div className="text-[11px] text-muted-foreground truncate">{m.nombre}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Podés elegir una o varias. Quedan reservadas hasta finalizar la etapa.
              </p>
            </div>
          )}

          {/* Routing para LAV finalizar */}
          {muestraRouting && (
            <div className="space-y-2">
              <Label className="font-semibold">¿A dónde va después? <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-1 gap-2">
                {routingOptions!.map(opt => (
                  <button
                    key={opt.etapaId}
                    type="button"
                    onClick={() => { setSelectedRoutingId(opt.etapaId); setError(null); }}
                    className={`w-full py-3 px-4 rounded-xl border-2 text-left transition-all active:scale-[0.98]
                      ${selectedRoutingId === opt.etapaId
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-gray-300 bg-white hover:border-primary/60'}
                    `}
                  >
                    <div className="font-semibold text-sm">{opt.label}</div>
                    {opt.description && <div className={`text-xs mt-0.5 ${selectedRoutingId === opt.etapaId ? 'opacity-80' : 'text-muted-foreground'}`}>{opt.description}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 pt-3 sm:pt-4 border-t flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={validating} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={handleValidate}
            className="w-full sm:w-auto"
            disabled={
              !operarioId ||
              pin.length < 4 ||
              validating ||
              isLoading ||
              (esEtapaRecepcion && selectedCanastos.length === 0) ||
              (requierePeso && (!pesoKg || parseFloat(pesoKg) <= 0)) ||
              (muestraRouting && !selectedRoutingId) ||
              (muestraMaquinasSimple && selectedMaquinas.length === 0)
            }
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validando...
              </>
            ) : (
              title
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
