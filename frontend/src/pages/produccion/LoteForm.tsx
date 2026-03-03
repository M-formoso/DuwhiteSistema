/**
 * Formulario de Creación/Edición de Lote de Producción
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

import { produccionService } from '@/services/produccionService';
import { TIPOS_SERVICIO, PRIORIDADES } from '@/types/produccion';
import type { LoteProduccionCreate } from '@/types/produccion';

const loteSchema = z.object({
  cliente_id: z.string().nullable().optional(),
  pedido_id: z.string().nullable().optional(),
  tipo_servicio: z.string().default('lavado_normal'),
  prioridad: z.string().default('normal'),
  peso_entrada_kg: z.coerce.number().positive().nullable().optional(),
  cantidad_prendas: z.coerce.number().int().positive().nullable().optional(),
  fecha_compromiso: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  notas_internas: z.string().nullable().optional(),
  notas_cliente: z.string().nullable().optional(),
  tiene_manchas: z.boolean().default(false),
  tiene_roturas: z.boolean().default(false),
});

type LoteFormData = z.infer<typeof loteSchema>;

export default function LoteFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(id);

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
      tipo_servicio: 'lavado_normal',
      prioridad: 'normal',
      tiene_manchas: false,
      tiene_roturas: false,
    },
  });

  // Cargar lote existente
  const { data: lote, isLoading } = useQuery({
    queryKey: ['lote', id],
    queryFn: () => produccionService.getLote(id!),
    enabled: isEditing,
  });

  useEffect(() => {
    if (lote) {
      reset({
        cliente_id: lote.cliente_id,
        pedido_id: lote.pedido_id,
        tipo_servicio: lote.tipo_servicio,
        prioridad: lote.prioridad,
        peso_entrada_kg: lote.peso_entrada_kg,
        cantidad_prendas: lote.cantidad_prendas,
        fecha_compromiso: lote.fecha_compromiso
          ? new Date(lote.fecha_compromiso).toISOString().split('T')[0]
          : null,
        descripcion: lote.descripcion,
        notas_internas: lote.notas_internas,
        notas_cliente: lote.notas_cliente,
        tiene_manchas: lote.tiene_manchas,
        tiene_roturas: lote.tiene_roturas,
      });
    }
  }, [lote, reset]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: LoteProduccionCreate) => produccionService.createLote(data),
    onSuccess: (newLote) => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo_servicio">Tipo de Servicio *</Label>
                <Select
                  value={watch('tipo_servicio')}
                  onValueChange={(v) => setValue('tipo_servicio', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_SERVICIO.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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

        {/* Estado del Material */}
        <Card>
          <CardHeader>
            <CardTitle>Estado del Material</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tiene_manchas"
                  checked={watch('tiene_manchas')}
                  onCheckedChange={(checked) => setValue('tiene_manchas', !!checked)}
                />
                <Label htmlFor="tiene_manchas" className="cursor-pointer">
                  Tiene manchas
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tiene_roturas"
                  checked={watch('tiene_roturas')}
                  onCheckedChange={(checked) => setValue('tiene_roturas', !!checked)}
                />
                <Label htmlFor="tiene_roturas" className="cursor-pointer">
                  Tiene roturas
                </Label>
              </div>
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
