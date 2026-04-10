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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

import { produccionService } from '@/services/produccionService';
import { clienteService } from '@/services/clienteService';
import { getLocalDateString } from '@/utils/formatters';
import { PRIORIDADES } from '@/types/produccion';
import type { LoteProduccionCreate } from '@/types/produccion';

const loteSchema = z.object({
  cliente_id: z.string().nullable().optional(),
  pedido_id: z.string().nullable().optional(),
  prioridad: z.string().default('normal'),
  peso_entrada_kg: z.coerce.number().positive().nullable().optional(),
  cantidad_prendas: z.coerce.number().int().positive().nullable().optional(),
  fecha_compromiso: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  notas_internas: z.string().nullable().optional(),
  notas_cliente: z.string().nullable().optional(),
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
      prioridad: 'normal',
    },
  });

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
        cliente_id: lote.cliente_id,
        pedido_id: lote.pedido_id,
        prioridad: lote.prioridad,
        peso_entrada_kg: lote.peso_entrada_kg,
        cantidad_prendas: lote.cantidad_prendas,
        fecha_compromiso: lote.fecha_compromiso
          ? getLocalDateString(new Date(lote.fecha_compromiso))
          : null,
        descripcion: lote.descripcion,
        notas_internas: lote.notas_internas,
        notas_cliente: lote.notas_cliente,
      });
    }
  }, [lote, reset]);

  // Auto-completar datos del pedido si viene de la URL
  useEffect(() => {
    if (pedidoFromUrl && !isEditing) {
      setValue('pedido_id', pedidoFromUrl.id);
      setValue('cliente_id', pedidoFromUrl.cliente_id);
      if (pedidoFromUrl.fecha_entrega_estimada) {
        setValue('fecha_compromiso', getLocalDateString(new Date(pedidoFromUrl.fecha_entrega_estimada)));
      }
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
      ...data,
      peso_entrada_kg: data.peso_entrada_kg || null,
      cantidad_prendas: data.cantidad_prendas || null,
      fecha_compromiso: data.fecha_compromiso || null,
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
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? `Editar Lote ${lote?.numero}` : 'Nuevo Lote de Producción'}
          </h1>
          <p className="text-gray-500">
            {isEditing ? 'Modifica los datos del lote' : 'Ingresa los datos del nuevo lote'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Información Básica */}
        <Card>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prioridad">Prioridad *</Label>
              <Select
                value={watch('prioridad')}
                onValueChange={(v) => setValue('prioridad', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((pri) => (
                    <SelectItem key={pri.value} value={pri.value}>
                      {pri.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="peso_entrada_kg">Peso de Entrada (kg)</Label>
                <Input
                  id="peso_entrada_kg"
                  type="number"
                  step="0.1"
                  placeholder="0.0"
                  {...register('peso_entrada_kg')}
                />
                {errors.peso_entrada_kg && (
                  <p className="text-sm text-red-500">{errors.peso_entrada_kg.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cantidad_prendas">Cantidad de Prendas</Label>
                <Input
                  id="cantidad_prendas"
                  type="number"
                  placeholder="0"
                  {...register('cantidad_prendas')}
                />
                {errors.cantidad_prendas && (
                  <p className="text-sm text-red-500">{errors.cantidad_prendas.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_compromiso">Fecha de Compromiso</Label>
                <Input
                  id="fecha_compromiso"
                  type="date"
                  {...register('fecha_compromiso')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                placeholder="Descripción general del lote..."
                rows={2}
                {...register('descripcion')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notas */}
        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notas_internas">Notas Internas</Label>
              <Textarea
                id="notas_internas"
                placeholder="Notas para uso interno del equipo..."
                rows={2}
                {...register('notas_internas')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas_cliente">Notas del Cliente</Label>
              <Textarea
                id="notas_cliente"
                placeholder="Observaciones o instrucciones del cliente..."
                rows={2}
                {...register('notas_cliente')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Acciones */}
        <div className="flex justify-end gap-4">
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
