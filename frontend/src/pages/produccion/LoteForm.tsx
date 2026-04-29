/**
 * Formulario de Creación/Edición de Lote de Producción
 */

import { useEffect } from 'react';
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

  // Leer pedido_id de query params (para crear lote desde pedido en camino)
  const pedidoIdFromUrl = searchParams.get('pedido_id');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LoteFormData>({
    resolver: zodResolver(loteSchema),
    defaultValues: {
      cliente_id: '',
    },
  });

  // Cargar lista de clientes
  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes-lista'],
    queryFn: () => clienteService.getClientesLista(),
  });

  // Convertir clientes a opciones para el combobox
  const clientesOptions = clientes.map((cliente) => ({
    value: cliente.id,
    label: cliente.nombre,
    sublabel: cliente.codigo,
  }));

  // Cargar lote existente
  const { data: lote, isLoading } = useQuery({
    queryKey: ['lote', id],
    queryFn: () => produccionService.getLote(id!),
    enabled: isEditing,
  });

  // Cargar pedido si viene de la URL (para crear lote desde pedido en camino)
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

  // Auto-completar datos del pedido si viene de la URL
  useEffect(() => {
    if (pedidoFromUrl && !isEditing) {
      setValue('pedido_id', pedidoFromUrl.id);
      setValue('cliente_id', pedidoFromUrl.cliente_id);
      if (pedidoFromUrl.notas) {
        setValue('descripcion', `Pedido #${pedidoFromUrl.numero} - ${pedidoFromUrl.notas}`);
      } else {
        setValue('descripcion', `Pedido #${pedidoFromUrl.numero}`);
      }
    }
  }, [pedidoFromUrl, isEditing, setValue]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: LoteProduccionCreate) => produccionService.createLote(data),
    onSuccess: (newLote) => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-en-camino'] });
      toast({
        title: 'Lote creado',
        description: `El lote ${newLote.numero} ha sido creado exitosamente.`,
      });
      navigate(`/produccion/lotes/${newLote.id}`);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo crear el lote.',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<LoteProduccionCreate>) =>
      produccionService.updateLote(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['lote', id] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      toast({
        title: 'Lote actualizado',
        description: 'Los cambios han sido guardados.',
      });
      navigate(`/produccion/lotes/${id}`);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el lote.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: LoteFormData) => {
    const payload = {
      cliente_id: data.cliente_id,
      pedido_id: data.pedido_id || null,
      descripcion: data.descripcion || null,
    } as LoteProduccionCreate;

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
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
      {/* Header */}
      <div className="flex items-start gap-2 sm:gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="flex-shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
            {isEditing ? `Editar Lote ${lote?.numero}` : 'Nuevo Lote de Producción'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">
            {isEditing ? 'Modifica los datos del lote' : 'Ingresa los datos del nuevo lote'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Información del Lote */}
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

        {/* Acciones */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditing ? 'Guardar Cambios' : 'Crear Lote'}
          </Button>
        </div>
      </form>
    </div>
  );
}
