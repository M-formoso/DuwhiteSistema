/**
 * Formulario de Creación/Edición de Lote de Producción
 * Al crear: pide PIN y auto-inicia la primera etapa (REC)
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { useToast } from '@/hooks/use-toast';
import { IniciarEtapaModal } from '@/components/produccion/IniciarEtapaModal';

import { produccionService } from '@/services/produccionService';
import { clienteService } from '@/services/clienteService';
import type { LoteProduccionCreate } from '@/types/produccion';

const loteSchema = z.object({
  cliente_id: z.string().min(1, 'Debe seleccionar un cliente'),
  pedido_id: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
});

type LoteFormData = z.infer<typeof loteSchema>;

export default function LoteFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(id);

  const pedidoIdFromUrl = searchParams.get('pedido_id');

  // Estado para el modal de auto-iniciar tras crear el lote
  const [pendingLote, setPendingLote] = useState<{ id: string; etapaId: string } | null>(null);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    register,
    formState: { errors, isSubmitting },
  } = useForm<LoteFormData>({
    resolver: zodResolver(loteSchema),
    defaultValues: { cliente_id: '' },
  });

  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes-lista'],
    queryFn: () => clienteService.getClientesLista(),
  });

  const clientesOptions = clientes.map((c) => ({
    value: c.id,
    label: c.nombre,
    sublabel: c.codigo,
  }));

  const { data: lote, isLoading } = useQuery({
    queryKey: ['lote', id],
    queryFn: () => produccionService.getLote(id!),
    enabled: isEditing,
  });

  const { data: pedidoFromUrl } = useQuery({
    queryKey: ['pedido', pedidoIdFromUrl],
    queryFn: () => clienteService.getPedido(pedidoIdFromUrl!),
    enabled: Boolean(pedidoIdFromUrl) && !isEditing,
  });

  useEffect(() => {
    if (lote) {
      reset({
        cliente_id: lote.cliente_id || '',
        pedido_id: lote.pedido_id,
        descripcion: lote.descripcion,
      });
    }
  }, [lote, reset]);

  useEffect(() => {
    if (pedidoFromUrl && !isEditing) {
      setValue('pedido_id', pedidoFromUrl.id);
      setValue('cliente_id', pedidoFromUrl.cliente_id);
      setValue(
        'descripcion',
        pedidoFromUrl.notas
          ? `Pedido #${pedidoFromUrl.numero} - ${pedidoFromUrl.notas}`
          : `Pedido #${pedidoFromUrl.numero}`
      );
    }
  }, [pedidoFromUrl, isEditing, setValue]);

  const createMutation = useMutation({
    mutationFn: (data: LoteProduccionCreate) => produccionService.createLote(data),
    onSuccess: (newLote) => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-en-camino'] });
      // Guardar el lote recién creado y mostrar modal de PIN para auto-iniciar
      if (newLote.etapa_actual_id) {
        setPendingLote({ id: newLote.id, etapaId: newLote.etapa_actual_id });
      } else {
        toast({ title: 'Lote creado', description: `Lote ${newLote.numero} creado.` });
        navigate(`/produccion/lotes/${newLote.id}`);
      }
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo crear el lote.', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<LoteProduccionCreate>) => produccionService.updateLote(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['lote', id] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      toast({ title: 'Lote actualizado', description: 'Los cambios han sido guardados.' });
      navigate(`/produccion/lotes/${id}`);
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo actualizar el lote.', variant: 'destructive' });
    },
  });

  const iniciarMutation = useMutation({
    mutationFn: ({ loteId, etapaId, responsable_id, canastos_ids, peso_kg }: {
      loteId: string;
      etapaId: string;
      responsable_id: string;
      canastos_ids?: string[];
      peso_kg?: number;
    }) =>
      produccionService.iniciarEtapa(loteId, etapaId, {
        responsable_id,
        canastos_ids,
        peso_kg,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['canastos-disponibles'] });
    },
  });

  const onSubmit = (data: LoteFormData) => {
    const payload = {
      cliente_id: data.cliente_id,
      pedido_id: data.pedido_id || null,
      descripcion: data.descripcion || null,
      peso_entrada_kg: null,
    } as LoteProduccionCreate;

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleIniciarConfirm = (
    operarioId: string,
    _operarioNombre: string,
    canastosIds?: string[],
    pesoKg?: number,
  ) => {
    if (!pendingLote) return;
    iniciarMutation.mutate({
      loteId: pendingLote.id,
      etapaId: pendingLote.etapaId,
      responsable_id: operarioId,
      canastos_ids: canastosIds,
      peso_kg: pesoKg,
    });
    navigate(`/produccion/lotes/${pendingLote.id}`);
    setPendingLote(null);
  };

  if (isEditing && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start gap-2 sm:gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="flex-shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
            {isEditing ? `Editar Lote ${lote?.numero}` : 'Nuevo Lote de Producción'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">
            {isEditing
              ? 'Modifica los datos del lote'
              : 'Seleccioná el cliente y completá el PIN para iniciar la recepción'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Información del Lote</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cliente_id">Cliente *</Label>
              <Combobox
                options={clientesOptions}
                value={watch('cliente_id') || null}
                onChange={(v) => setValue('cliente_id', v || '')}
                placeholder="Seleccionar cliente..."
                searchPlaceholder="Buscar cliente..."
                emptyText="No se encontraron clientes"
                isLoading={loadingClientes}
                allowClear={false}
              />
              {errors.cliente_id && (
                <p className="text-sm text-red-500">{errors.cliente_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción (opcional)</Label>
              <Textarea
                id="descripcion"
                placeholder="Descripción o notas del lote..."
                rows={3}
                {...register('descripcion')}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
            {(isSubmitting || createMutation.isPending) ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditing ? 'Guardar Cambios' : 'Crear Lote'}
          </Button>
        </div>
      </form>

      {/* Modal de PIN para auto-iniciar al crear */}
      <IniciarEtapaModal
        open={!!pendingLote}
        onClose={() => {
          // Si cancela el PIN, navegar igual al lote creado
          if (pendingLote) {
            navigate(`/produccion/lotes/${pendingLote.id}`);
            setPendingLote(null);
          }
        }}
        onConfirm={handleIniciarConfirm}
        title="Iniciar Recepción"
        description="Ingresá el PIN del operario para registrar la recepción"
        etapaCodigo="REC"
        loteId={pendingLote?.id}
      />
    </div>
  );
}
