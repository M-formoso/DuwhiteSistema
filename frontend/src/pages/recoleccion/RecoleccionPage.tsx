/**
 * Vista de Recolección — mobile-first.
 *
 * El chico que va a buscar la ropa al cliente entra acá desde su celular,
 * elige el cliente, su nombre de la lista de operarios y escribe su PIN.
 * Al confirmar, queda un pedido "en camino" listo para que recepción lo
 * pese cuando llega al lavadero.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Truck,
  Search,
  CheckCircle2,
  Loader2,
  Plus,
  Clock,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

import { clienteService } from '@/services/clienteService';
import { produccionService } from '@/services/produccionService';
import { recoleccionService, type RecoleccionItem } from '@/services/recoleccionService';

type Paso = 'cliente' | 'repartidor' | 'pin' | 'confirmado';

export default function RecoleccionPage() {
  const [paso, setPaso] = useState<Paso>('cliente');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clienteSel, setClienteSel] = useState<{ id: string; nombre: string } | null>(null);
  const [repartidorSel, setRepartidorSel] = useState<{ id: string; nombre: string } | null>(null);
  const [pin, setPin] = useState('');
  const [confirmacion, setConfirmacion] = useState<{
    cliente: string;
    repartidor: string;
    hora: string;
    numero: string;
  } | null>(null);

  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes-lista'],
    queryFn: () => clienteService.getClientesLista(),
  });

  const { data: operarios = [], isLoading: loadingOperarios } = useQuery({
    queryKey: ['operarios-pin'],
    queryFn: () => produccionService.getOperariosConPin(),
  });

  const { data: recoleccionesHoy = [], refetch: refetchRecolecciones } = useQuery({
    queryKey: ['recolecciones-del-dia'],
    queryFn: () => recoleccionService.listarDelDia(),
    refetchInterval: 60_000,
  });

  const clientesFiltrados = useMemo(() => {
    const q = busquedaCliente.trim().toLowerCase();
    if (!q) return clientes.slice(0, 30);
    return clientes
      .filter((c) => {
        const haystack = `${c.nombre} ${c.codigo || ''} ${c.cuit || ''}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 30);
  }, [clientes, busquedaCliente]);

  const iniciarMutation = useMutation({
    mutationFn: () =>
      recoleccionService.iniciar({
        cliente_id: clienteSel!.id,
        repartidor_id: repartidorSel!.id,
        pin,
      }),
    onSuccess: (data) => {
      const hora = new Date(data.hora_inicio_retiro).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setConfirmacion({
        cliente: data.cliente_nombre,
        repartidor: data.repartidor_nombre,
        hora,
        numero: data.numero,
      });
      setPaso('confirmado');
      refetchRecolecciones();
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { detail?: string } } };
      toast.error(e.response?.data?.detail || 'No se pudo iniciar la recolección');
    },
  });

  const reset = () => {
    setBusquedaCliente('');
    setClienteSel(null);
    setRepartidorSel(null);
    setPin('');
    setConfirmacion(null);
    setPaso('cliente');
  };

  // PIN: teclear con teclado en pantalla
  const tecladoTeclear = (d: string) => {
    setPin((prev) => (prev.length < 6 ? prev + d : prev));
  };
  const tecladoBorrar = () => setPin((prev) => prev.slice(0, -1));
  const tecladoLimpiar = () => setPin('');

  // Auto-confirm si el PIN llega a 4 dígitos (modo rápido) — opcional, lo dejo
  // como botón explícito para evitar errores de tipeo.

  useEffect(() => {
    if (paso === 'pin') setPin('');
  }, [paso]);

  return (
    <div className="min-h-[calc(100vh-120px)] max-w-md mx-auto px-3 py-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="rounded-full bg-primary/10 p-2">
          <Truck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Recolección</h1>
          <p className="text-xs text-gray-500">Registrar un retiro de ropa</p>
        </div>
      </div>

      {/* Paso 1: Cliente */}
      {paso === 'cliente' && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">1. Elegí el cliente</span>
              <span className="text-[10px] text-gray-400">{clientes.length} clientes</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={busquedaCliente}
                onChange={(e) => setBusquedaCliente(e.target.value)}
                placeholder="Buscar por nombre, código, CUIT..."
                className="pl-9 h-12 text-base"
                autoFocus
              />
            </div>

            <div className="space-y-2 max-h-[55vh] overflow-y-auto -mx-1 px-1">
              {loadingClientes ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : clientesFiltrados.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  No hay clientes que coincidan.
                </div>
              ) : (
                clientesFiltrados.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setClienteSel({ id: c.id, nombre: c.nombre });
                      setPaso('repartidor');
                    }}
                    className="w-full text-left px-3 py-3 rounded-lg border border-gray-200 active:bg-primary/5 hover:border-primary/40 transition"
                  >
                    <div className="font-semibold text-sm text-gray-900">{c.nombre}</div>
                    <div className="text-[11px] text-gray-500">
                      {c.codigo}
                      {c.cuit ? ` · ${c.cuit}` : ''}
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 2: Repartidor */}
      {paso === 'repartidor' && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPaso('cliente')}
                className="text-primary underline"
              >
                ← cambiar
              </button>
              <span className="text-gray-500">Cliente:</span>
              <span className="font-semibold text-gray-800 truncate">{clienteSel?.nombre}</span>
            </div>
            <div className="text-sm font-semibold text-gray-700">2. ¿Quién retira?</div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto -mx-1 px-1">
              {loadingOperarios ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : operarios.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  No hay operarios con PIN configurado.
                </div>
              ) : (
                operarios.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setRepartidorSel({ id: o.id, nombre: o.nombre });
                      setPaso('pin');
                    }}
                    className="w-full text-left px-3 py-3 rounded-lg border border-gray-200 active:bg-primary/5 hover:border-primary/40 transition"
                  >
                    <div className="font-semibold text-sm text-gray-900">{o.nombre}</div>
                    <div className="text-[11px] text-gray-500 capitalize">{o.rol}</div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 3: PIN */}
      {paso === 'pin' && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <button
                type="button"
                onClick={() => setPaso('repartidor')}
                className="text-primary underline"
              >
                ← cambiar
              </button>
              <div className="flex flex-col text-[11px] flex-1 min-w-0">
                <span className="truncate">
                  <span className="text-gray-500">Cliente:</span>{' '}
                  <span className="font-semibold text-gray-800">{clienteSel?.nombre}</span>
                </span>
                <span className="truncate">
                  <span className="text-gray-500">Retira:</span>{' '}
                  <span className="font-semibold text-gray-800">{repartidorSel?.nombre}</span>
                </span>
              </div>
            </div>

            <div className="text-sm font-semibold text-gray-700">3. Ingresá tu PIN</div>

            <div className="flex gap-2 justify-center">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`h-12 w-9 sm:h-14 sm:w-10 rounded-md border-2 flex items-center justify-center text-xl font-bold transition ${
                    pin[i]
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 bg-gray-50 text-gray-300'
                  }`}
                >
                  {pin[i] ? '●' : ''}
                </div>
              ))}
            </div>

            {/* Teclado numérico grande */}
            <div className="grid grid-cols-3 gap-2 select-none">
              {(['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => tecladoTeclear(d)}
                  className="h-14 rounded-lg border border-gray-300 bg-white text-2xl font-bold text-gray-800 active:bg-gray-200 active:scale-95 transition"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={tecladoLimpiar}
                className="h-14 rounded-lg border border-amber-300 bg-amber-50 text-sm font-semibold text-amber-700 active:bg-amber-100 active:scale-95 transition"
              >
                Borrar
              </button>
              <button
                type="button"
                onClick={() => tecladoTeclear('0')}
                className="h-14 rounded-lg border border-gray-300 bg-white text-2xl font-bold text-gray-800 active:bg-gray-200 active:scale-95 transition"
              >
                0
              </button>
              <button
                type="button"
                onClick={tecladoBorrar}
                className="h-14 rounded-lg border border-gray-300 bg-white text-base font-semibold text-gray-700 active:bg-gray-200 active:scale-95 transition"
              >
                ←
              </button>
            </div>

            <Button
              size="lg"
              className="w-full h-14 text-base font-bold"
              disabled={pin.length < 4 || iniciarMutation.isPending}
              onClick={() => iniciarMutation.mutate()}
            >
              {iniciarMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Truck className="h-5 w-5 mr-2" />
              )}
              Iniciar Recolección
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Paso 4: Confirmación */}
      {paso === 'confirmado' && confirmacion && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="pt-6 space-y-4 text-center">
            <div className="mx-auto rounded-full bg-green-100 p-3 w-fit">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-green-800">¡Recolección iniciada!</h2>
            <div className="bg-white rounded-lg p-3 text-left space-y-1.5 text-sm">
              <div>
                <span className="text-gray-500">Pedido:</span>{' '}
                <span className="font-mono font-semibold">{confirmacion.numero}</span>
              </div>
              <div>
                <span className="text-gray-500">Cliente:</span>{' '}
                <span className="font-semibold">{confirmacion.cliente}</span>
              </div>
              <div>
                <span className="text-gray-500">Retira:</span>{' '}
                <span className="font-semibold">{confirmacion.repartidor}</span>
              </div>
              <div>
                <span className="text-gray-500">Hora:</span>{' '}
                <span className="font-semibold">{confirmacion.hora}</span>
              </div>
            </div>
            <Button size="lg" className="w-full h-14 text-base font-bold" onClick={reset}>
              <Plus className="h-5 w-5 mr-2" />
              Otra recolección
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recolecciones del día */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Clock className="h-4 w-4" />
              Retiros de hoy
            </div>
            <span className="text-[10px] text-gray-400">{recoleccionesHoy.length}</span>
          </div>
          {recoleccionesHoy.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400">
              Todavía no se inició ninguna recolección hoy.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {recoleccionesHoy.map((r: RecoleccionItem) => {
                const hora = r.hora_inicio_retiro
                  ? new Date(r.hora_inicio_retiro).toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—';
                return (
                  <div
                    key={r.pedido_id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  >
                    <div
                      className={`h-2 w-2 rounded-full flex-shrink-0 ${
                        r.tiene_lote ? 'bg-green-500' : 'bg-amber-500'
                      }`}
                      title={r.tiene_lote ? 'Recibido en planta' : 'En camino'}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate text-gray-900">
                        {r.cliente_nombre}
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {hora} · {r.tiene_lote ? 'recibido' : 'en camino'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
