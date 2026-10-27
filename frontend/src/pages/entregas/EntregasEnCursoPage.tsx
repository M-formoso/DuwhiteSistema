/**
 * Entregas en curso — remitos emitidos pendientes de entrega.
 *
 * Es la vista operativa post-conteo: una vez que el lote termina y se
 * genera el remito, aparece acá hasta que alguien marca "entregado".
 *
 * Permite:
 * - Ver qué remito tiene cada vehículo asignado.
 * - Reasignar o asignar vehículo (si Vero se olvidó).
 * - Marcar como entregado (dispara el flujo que lo saca del mapa y lo cierra).
 */

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Truck,
  Package as PackageIcon,
  Receipt,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Search,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { remitoService } from '@/services/remitoService';
import { formatDateAR } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import { AsignarVehiculoDialog } from '@/components/geotrackers/AsignarVehiculoDialog';
import type { RemitoListItem } from '@/types/produccion-v2';

export default function EntregasEnCursoPage() {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [asignando, setAsignando] = useState<RemitoListItem | null>(null);

  const { data: remitos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['remitos-en-entrega'],
    queryFn: () => remitoService.getAll({ estado: 'emitido', limit: 100 }),
    refetchInterval: 30_000,
  });

  const filtrados = (remitos as RemitoListItem[]).filter((r) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return (
      r.numero.toLowerCase().includes(q) ||
      r.cliente_nombre.toLowerCase().includes(q) ||
      (r.vehiculo_patente || '').toLowerCase().includes(q) ||
      (r.lote_numero || '').toLowerCase().includes(q)
    );
  });

  const entregarMutation = useMutation({
    mutationFn: (remitoId: string) => remitoService.marcarEntregado(remitoId),
    onSuccess: (data) => {
      toast.success(data.mensaje);
      queryClient.invalidateQueries({ queryKey: ['remitos-en-entrega'] });
      queryClient.invalidateQueries({ queryKey: ['gt-asignaciones'] });
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        'No se pudo marcar como entregado';
      toast.error(detail);
    },
  });

  const handleSavedAsignacion = () => {
    queryClient.invalidateQueries({ queryKey: ['remitos-en-entrega'] });
    queryClient.invalidateQueries({ queryKey: ['gt-asignaciones'] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Entregas en curso
          </h1>
          <p className="text-sm text-muted-foreground">
            Remitos ya emitidos, pendientes de entrega al cliente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, patente, nº…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8 w-[280px]"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Refrescar
          </Button>
        </div>
      </div>

      {isError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            No se pudo cargar la lista de remitos.
          </CardContent>
        </Card>
      )}

      {filtrados.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <PackageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
            {busqueda ? 'No hay remitos que coincidan con la búsqueda.' : 'No hay remitos pendientes de entrega.'}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtrados.map((r) => {
          const tieneVehiculo = Boolean(r.vehiculo_id);
          return (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {r.numero}
                    </div>
                    <div className="font-semibold text-base truncate">
                      {r.cliente_nombre}
                    </div>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {r.estado}
                  </Badge>
                </div>

                <div className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>Lote: {r.lote_numero || '—'}</span>
                  <span>{formatDateAR(r.fecha_emision)}</span>
                </div>

                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{formatCurrency(r.total)}</span>
                  {tieneVehiculo ? (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      {r.vehiculo_patente}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-700 border-amber-300">
                      Sin vehículo
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setAsignando(r)}
                  >
                    <Truck className="h-4 w-4 mr-1" />
                    {tieneVehiculo ? 'Cambiar' : 'Asignar'}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        disabled={entregarMutation.isPending}
                      >
                        {entregarMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Entregado
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Marcar como entregado?</AlertDialogTitle>
                        <AlertDialogDescription>
                          El remito <span className="font-mono">{r.numero}</span> de{' '}
                          <strong>{r.cliente_nombre}</strong> va a pasar al estado
                          "entregado" y va a desaparecer del mapa y de esta lista.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => entregarMutation.mutate(r.id)}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          Sí, entregado
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {asignando && (
        <AsignarVehiculoDialog
          open={!!asignando}
          onOpenChange={(open) => !open && setAsignando(null)}
          tipo="remito"
          entidadId={asignando.id}
          entidadNumero={asignando.numero}
          valorInicial={asignando.vehiculo_id ?? ''}
          onSaved={handleSavedAsignacion}
        />
      )}
    </div>
  );
}
