/**
 * Lotes Archivados — vista para limpiar el Kanban sin perder datos.
 *
 * Los lotes con archivado_at != NULL no aparecen en el tablero principal.
 * Desde acá se pueden desarchivar (vuelven al Kanban) o quedan a la espera
 * del job de purga (físicamente borrados a los 30 días si no tienen remito).
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  RefreshCw,
  Package,
  RotateCcw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Receipt,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

import { produccionService, LoteArchivado } from '@/services/produccionService';
import { formatNumber } from '@/utils/formatters';

const PAGE_SIZE = 50;

function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return '-';
  return new Date(fecha).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function diasArchivado(archivado_at: string): number {
  const dif = Date.now() - new Date(archivado_at).getTime();
  return Math.max(0, Math.floor(dif / (1000 * 60 * 60 * 24)));
}

export default function ArchivadosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [skip, setSkip] = useState(0);
  const [confirmDesarchivar, setConfirmDesarchivar] = useState<LoteArchivado | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['lotes-archivados', skip],
    queryFn: () => produccionService.getLotesArchivados({ skip, limit: PAGE_SIZE }),
  });

  const desarchivarMutation = useMutation({
    mutationFn: (id: string) => produccionService.desarchivarLote(id),
    onSuccess: (res) => {
      toast({ title: 'Lote desarchivado', description: res.mensaje });
      queryClient.invalidateQueries({ queryKey: ['lotes-archivados'] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      setConfirmDesarchivar(null);
    },
    onError: () => {
      toast({ title: 'Error al desarchivar', variant: 'destructive' });
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(skip / PAGE_SIZE) + 1;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Archive className="h-6 w-6 text-gray-500" />
            Lotes archivados
          </h1>
          <p className="text-sm text-muted-foreground">
            Lotes ocultos del Kanban. Se purgan automáticamente a los 30 días si no tienen remito.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refrescar
        </Button>
      </div>

      <Card>
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-medium">
            {total} lote{total === 1 ? '' : 's'} archivado{total === 1 ? '' : 's'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Package className="h-10 w-10 mb-2" />
              <span>No hay lotes archivados</span>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lote</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Etapa al archivar</TableHead>
                    <TableHead className="text-right">Peso</TableHead>
                    <TableHead>Fecha ingreso</TableHead>
                    <TableHead>Archivado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((lote) => {
                    const dias = diasArchivado(lote.archivado_at);
                    const cercaDePurga = !lote.tiene_remito && dias >= 25;
                    return (
                      <TableRow
                        key={lote.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => navigate(`/produccion/lotes/${lote.id}`)}
                      >
                        <TableCell className="font-mono font-medium">{lote.numero}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {lote.cliente_nombre || '-'}
                        </TableCell>
                        <TableCell>
                          {lote.etapa_actual_nombre ? (
                            <Badge variant="outline">{lote.etapa_actual_nombre}</Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {lote.peso_entrada_kg
                            ? `${formatNumber(Number(lote.peso_entrada_kg), 1)} kg`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {formatFecha(lote.fecha_ingreso)}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-col gap-0.5">
                            <span>{formatFecha(lote.archivado_at)}</span>
                            <span
                              className={
                                cercaDePurga
                                  ? 'text-xs font-medium text-amber-600 flex items-center gap-1'
                                  : 'text-xs text-gray-400'
                              }
                            >
                              {cercaDePurga && <AlertTriangle className="h-3 w-3" />}
                              hace {dias} día{dias === 1 ? '' : 's'}
                              {lote.tiene_remito && (
                                <span className="ml-1 inline-flex items-center gap-0.5 text-blue-600">
                                  <Receipt className="h-3 w-3" />
                                  con remito
                                </span>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmDesarchivar(lote)}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Desarchivar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
                  <span className="text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={skip === 0}
                      onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={skip + PAGE_SIZE >= total}
                      onClick={() => setSkip(skip + PAGE_SIZE)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!confirmDesarchivar}
        onOpenChange={(open) => !open && setConfirmDesarchivar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desarchivar lote</AlertDialogTitle>
            <AlertDialogDescription>
              El lote{' '}
              <span className="font-mono font-semibold">{confirmDesarchivar?.numero}</span> va a
              volver al Kanban en la etapa{' '}
              <span className="font-semibold">{confirmDesarchivar?.etapa_actual_nombre}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDesarchivar && desarchivarMutation.mutate(confirmDesarchivar.id)}
            >
              Desarchivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
