/**
 * Formulario de Insumo (Crear/Editar)
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

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

import { stockService } from '@/services/stockService';
import { UNIDADES_MEDIDA } from '@/types/stock';
import type { InsumoCreate, InsumoUpdate } from '@/types/stock';

const insumoSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(50),
  codigo_barras: z.string().max(100).optional().nullable(),
  nombre: z.string().min(1, 'El nombre es requerido').max(255),
  categoria_id: z.string().uuid().optional().nullable(),
  subcategoria: z.string().max(100).optional().nullable(),
  unidad: z.string().min(1, 'La unidad es requerida').max(20),
  stock_actual: z.coerce.number().min(0).default(0),
  stock_minimo: z.coerce.number().min(0).default(0),
  stock_maximo: z.coerce.number().min(0).optional().nullable(),
  precio_unitario_costo: z.coerce.number().min(0).optional().nullable(),
  ubicacion_deposito: z.string().max(100).optional().nullable(),
  fecha_vencimiento: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
});

type InsumoFormData = z.infer<typeof insumoSchema>;

export default function InsumoForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = !!id;

  // Cargar categorías
  const { data: categorias } = useQuery({
    queryKey: ['categorias-lista'],
    queryFn: () => stockService.getCategoriasLista(),
  });

  // Cargar insumo si estamos editando
  const { data: insumo, isLoading: loadingInsumo } = useQuery({
    queryKey: ['insumo', id],
    queryFn: () => stockService.getInsumo(id!),
    enabled: isEditing,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<InsumoFormData>({
    resolver: zodResolver(insumoSchema),
    defaultValues: {
      codigo: '',
      nombre: '',
      unidad: 'unidades',
      stock_actual: 0,
      stock_minimo: 0,
    },
  });

  // Cargar datos del insumo en el formulario
  useEffect(() => {
    if (insumo) {
      reset({
        codigo: insumo.codigo,
        codigo_barras: insumo.codigo_barras,
        nombre: insumo.nombre,
        categoria_id: insumo.categoria_id,
        subcategoria: insumo.subcategoria,
        unidad: insumo.unidad,
        stock_actual: insumo.stock_actual,
        stock_minimo: insumo.stock_minimo,
        stock_maximo: insumo.stock_maximo,
        precio_unitario_costo: insumo.precio_unitario_costo,
        ubicacion_deposito: insumo.ubicacion_deposito,
        fecha_vencimiento: insumo.fecha_vencimiento,
        notas: insumo.notas,
      });
    }
  }, [insumo, reset]);

  // Crear insumo
  const createMutation = useMutation({
    mutationFn: (data: InsumoCreate) => stockService.createInsumo(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      toast({
        title: 'Insumo creado',
        description: 'El insumo ha sido creado correctamente.',
      });
      navigate('/stock/insumos');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo crear el insumo.',
        variant: 'destructive',
      });
    },
  });

  // Actualizar insumo
  const updateMutation = useMutation({
    mutationFn: (data: InsumoUpdate) => stockService.updateInsumo(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['insumo', id] });
      toast({
        title: 'Insumo actualizado',
        description: 'El insumo ha sido actualizado correctamente.',
      });
      navigate('/stock/insumos');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo actualizar el insumo.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: InsumoFormData) => {
    // Limpiar valores vacíos
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
    );

    if (isEditing) {
      // No enviar stock_actual en edición (se usa ajuste)
      const { stock_actual, ...updateData } = cleanData;
      updateMutation.mutate(updateData as InsumoUpdate);
    } else {
      createMutation.mutate(cleanData as InsumoCreate);
    }
  };

  if (isEditing && loadingInsumo) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Editar Insumo' : 'Nuevo Insumo'}
          </h1>
          <p className="text-gray-500">
            {isEditing
              ? `Editando: ${insumo?.codigo} - ${insumo?.nombre}`
              : 'Complete los datos del nuevo insumo'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Datos Básicos */}
          <Card>
            <CardHeader>
              <CardTitle>Datos Básicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código *</Label>
                  <Input
                    id="codigo"
                    {...register('codigo')}
                    placeholder="INS-001"
                    className={errors.codigo ? 'border-red-500' : ''}
                  />
                  {errors.codigo && (
                    <p className="text-sm text-red-500">{errors.codigo.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="codigo_barras">Código de Barras</Label>
                  <Input
                    id="codigo_barras"
                    {...register('codigo_barras')}
                    placeholder="7791234567890"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  {...register('nombre')}
                  placeholder="Detergente Industrial X"
                  className={errors.nombre ? 'border-red-500' : ''}
                />
                {errors.nombre && (
                  <p className="text-sm text-red-500">{errors.nombre.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoria_id">Categoría</Label>
                  <Select
                    value={watch('categoria_id') || ''}
                    onValueChange={(value) => setValue('categoria_id', value || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subcategoria">Subcategoría</Label>
                  <Input
                    id="subcategoria"
                    {...register('subcategoria')}
                    placeholder="Ej: Líquidos"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unidad">Unidad de Medida *</Label>
                <Select
                  value={watch('unidad')}
                  onValueChange={(value) => setValue('unidad', value)}
                >
                  <SelectTrigger className={errors.unidad ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Seleccionar unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES_MEDIDA.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.unidad && (
                  <p className="text-sm text-red-500">{errors.unidad.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stock y Precios */}
          <Card>
            <CardHeader>
              <CardTitle>Stock y Precios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="stock_actual">Stock Inicial</Label>
                  <Input
                    id="stock_actual"
                    type="number"
                    step="0.01"
                    {...register('stock_actual')}
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500">
                    Se creará un movimiento de entrada inicial
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock_minimo">Stock Mínimo</Label>
                  <Input
                    id="stock_minimo"
                    type="number"
                    step="0.01"
                    {...register('stock_minimo')}
                    placeholder="10"
                  />
                  <p className="text-xs text-gray-500">
                    Alerta cuando el stock baje de este valor
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stock_maximo">Stock Máximo</Label>
                  <Input
                    id="stock_maximo"
                    type="number"
                    step="0.01"
                    {...register('stock_maximo')}
                    placeholder="100"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="precio_unitario_costo">Precio Unitario (Costo)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <Input
                    id="precio_unitario_costo"
                    type="number"
                    step="0.01"
                    {...register('precio_unitario_costo')}
                    className="pl-8"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ubicacion_deposito">Ubicación en Depósito</Label>
                <Input
                  id="ubicacion_deposito"
                  {...register('ubicacion_deposito')}
                  placeholder="Ej: Estante A, Fila 3"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_vencimiento">Fecha de Vencimiento</Label>
                <Input
                  id="fecha_vencimiento"
                  type="date"
                  {...register('fecha_vencimiento')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notas */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Notas Adicionales</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                {...register('notas')}
                placeholder="Observaciones, instrucciones de uso, etc."
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Acciones */}
        <div className="flex justify-end gap-4 mt-6">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEditing ? 'Guardar Cambios' : 'Crear Insumo'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
