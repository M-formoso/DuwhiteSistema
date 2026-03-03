/**
 * Formulario de Orden de Compra (Crear/Editar)
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  Search,
  Package,
  Building2,
} from 'lucide-react';

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
import { useToast } from '@/components/ui/use-toast';

import { proveedorService } from '@/services/proveedorService';
import { stockService } from '@/services/stockService';
import { formatCurrency } from '@/utils/formatters';
import { CONDICIONES_PAGO } from '@/types/proveedor';

const detalleSchema = z.object({
  insumo_id: z.string().min(1, 'Seleccione un insumo'),
  descripcion: z.string().nullable().optional(),
  cantidad: z.number().min(0.01, 'La cantidad debe ser mayor a 0'),
  unidad: z.string().min(1, 'La unidad es requerida'),
  precio_unitario: z.number().min(0, 'El precio no puede ser negativo'),
  descuento_porcentaje: z.number().min(0).max(100).default(0),
  notas: z.string().nullable().optional(),
});

const ordenSchema = z.object({
  proveedor_id: z.string().min(1, 'Debe seleccionar un proveedor'),
  fecha_emision: z.string().min(1, 'La fecha es requerida'),
  fecha_entrega_estimada: z.string().nullable().optional(),
  descuento_porcentaje: z.number().min(0).max(100).default(0),
  moneda: z.string().default('ARS'),
  condicion_pago: z.string().nullable().optional(),
  plazo_pago_dias: z.number().nullable().optional(),
  lugar_entrega: z.string().nullable().optional(),
  requiere_aprobacion: z.boolean().default(false),
  notas: z.string().nullable().optional(),
  notas_internas: z.string().nullable().optional(),
  items: z.array(detalleSchema).min(1, 'Debe agregar al menos un item'),
});

type OrdenFormData = z.infer<typeof ordenSchema>;

export default function OrdenCompraForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(id);

  const [proveedorSearch, setProveedorSearch] = useState('');
  const [showProveedorSearch, setShowProveedorSearch] = useState(false);
  const [insumoSearch, setInsumoSearch] = useState('');

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OrdenFormData>({
    resolver: zodResolver(ordenSchema),
    defaultValues: {
      fecha_emision: new Date().toISOString().split('T')[0],
      moneda: 'ARS',
      descuento_porcentaje: 0,
      requiere_aprobacion: false,
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const proveedorId = watch('proveedor_id');
  const items = watch('items');
  const descuentoGeneral = watch('descuento_porcentaje') || 0;

  // Buscar proveedores
  const { data: proveedoresLista } = useQuery({
    queryKey: ['proveedores-lista', proveedorSearch],
    queryFn: () => proveedorService.getProveedoresLista(proveedorSearch),
  });

  // Buscar insumos
  const { data: insumosLista } = useQuery({
    queryKey: ['insumos-lista', insumoSearch],
    queryFn: () => stockService.getInsumosLista(insumoSearch),
    enabled: insumoSearch.length >= 2,
  });

  // Proveedor desde URL
  useEffect(() => {
    const proveedorParam = searchParams.get('proveedor');
    if (proveedorParam && !proveedorId) {
      setValue('proveedor_id', proveedorParam);
    }
  }, [searchParams, setValue, proveedorId]);

  // Cargar orden si estamos editando
  const { data: orden, isLoading: loadingOrden } = useQuery({
    queryKey: ['orden-compra', id],
    queryFn: () => proveedorService.getOrdenCompra(id!),
    enabled: isEditing,
  });

  // Cargar datos de la orden en el formulario
  useEffect(() => {
    if (orden) {
      reset({
        proveedor_id: orden.proveedor_id,
        fecha_emision: orden.fecha_emision.split('T')[0],
        fecha_entrega_estimada: orden.fecha_entrega_estimada?.split('T')[0] || null,
        descuento_porcentaje: orden.descuento_porcentaje,
        moneda: orden.moneda,
        condicion_pago: orden.condicion_pago,
        plazo_pago_dias: orden.plazo_pago_dias,
        lugar_entrega: orden.lugar_entrega,
        requiere_aprobacion: orden.requiere_aprobacion,
        notas: orden.notas,
        notas_internas: orden.notas_internas,
        items: orden.items.map((item) => ({
          insumo_id: item.insumo_id,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidad: item.unidad,
          precio_unitario: item.precio_unitario,
          descuento_porcentaje: item.descuento_porcentaje,
          notas: item.notas,
        })),
      });
    }
  }, [orden, reset]);

  // Calcular totales
  const calcularSubtotal = () => {
    return items.reduce((sum, item) => {
      const subtotalItem = item.cantidad * item.precio_unitario;
      const descuentoItem = subtotalItem * ((item.descuento_porcentaje || 0) / 100);
      return sum + (subtotalItem - descuentoItem);
    }, 0);
  };

  const subtotal = calcularSubtotal();
  const descuentoMonto = subtotal * (descuentoGeneral / 100);
  const baseImponible = subtotal - descuentoMonto;
  const iva = baseImponible * 0.21;
  const total = baseImponible + iva;

  // Mutaciones
  const createMutation = useMutation({
    mutationFn: proveedorService.createOrdenCompra,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] });
      toast({
        title: 'Orden creada',
        description: `Orden #${data.numero} creada correctamente.`,
      });
      navigate(`/proveedores/ordenes/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear la orden.',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: OrdenFormData) => proveedorService.updateOrdenCompra(id!, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] });
      queryClient.invalidateQueries({ queryKey: ['orden-compra', id] });
      toast({
        title: 'Orden actualizada',
        description: `Orden #${data.numero} actualizada correctamente.`,
      });
      navigate(`/proveedores/ordenes/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar la orden.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: OrdenFormData) => {
    const cleanedData = {
      ...data,
      fecha_entrega_estimada: data.fecha_entrega_estimada || null,
      condicion_pago: data.condicion_pago || null,
      plazo_pago_dias: data.plazo_pago_dias || null,
      lugar_entrega: data.lugar_entrega || null,
      notas: data.notas || null,
      notas_internas: data.notas_internas || null,
    };

    if (isEditing) {
      updateMutation.mutate(cleanedData);
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const agregarItem = (insumo: {
    id: string;
    codigo: string;
    nombre: string;
    unidad: string;
  }) => {
    append({
      insumo_id: insumo.id,
      descripcion: insumo.nombre,
      cantidad: 1,
      unidad: insumo.unidad,
      precio_unitario: 0,
      descuento_porcentaje: 0,
      notas: null,
    });
    setInsumoSearch('');
  };

  const proveedorSeleccionado = proveedoresLista?.find((p) => p.id === proveedorId);

  const proveedoresFiltrados = proveedoresLista?.filter(
    (p) =>
      p.razon_social.toLowerCase().includes(proveedorSearch.toLowerCase()) ||
      p.cuit.includes(proveedorSearch)
  );

  if (isEditing && loadingOrden) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? `Editar Orden #${orden?.numero}` : 'Nueva Orden de Compra'}
          </h1>
          <p className="text-gray-500">
            {isEditing ? 'Modifique los datos de la orden' : 'Complete los datos de la orden'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Información Principal */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Información de la Orden</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {/* Proveedor */}
              <div className="space-y-2 md:col-span-2">
                <Label>
                  Proveedor <span className="text-destructive">*</span>
                </Label>
                {proveedorSeleccionado ? (
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{proveedorSeleccionado.razon_social}</p>
                        <p className="text-sm text-muted-foreground">
                          CUIT: {proveedorSeleccionado.cuit}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setValue('proveedor_id', '');
                        setShowProveedorSearch(true);
                      }}
                    >
                      Cambiar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar proveedor por nombre o CUIT..."
                        value={proveedorSearch}
                        onChange={(e) => setProveedorSearch(e.target.value)}
                        onFocus={() => setShowProveedorSearch(true)}
                        className="pl-10"
                      />
                    </div>
                    {showProveedorSearch && proveedoresFiltrados && proveedoresFiltrados.length > 0 && (
                      <div className="border rounded-lg max-h-48 overflow-y-auto">
                        {proveedoresFiltrados.slice(0, 10).map((proveedor) => (
                          <button
                            key={proveedor.id}
                            type="button"
                            className="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-3"
                            onClick={() => {
                              setValue('proveedor_id', proveedor.id);
                              setShowProveedorSearch(false);
                              setProveedorSearch('');
                            }}
                          >
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                              <Building2 className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{proveedor.razon_social}</p>
                              <p className="text-xs text-muted-foreground">
                                CUIT: {proveedor.cuit}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {errors.proveedor_id && (
                  <p className="text-sm text-destructive">{errors.proveedor_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_emision">
                  Fecha de Emisión <span className="text-destructive">*</span>
                </Label>
                <Input type="date" {...register('fecha_emision')} />
                {errors.fecha_emision && (
                  <p className="text-sm text-destructive">{errors.fecha_emision.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_entrega_estimada">Fecha Entrega Estimada</Label>
                <Input type="date" {...register('fecha_entrega_estimada')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="condicion_pago">Condición de Pago</Label>
                <Select
                  value={watch('condicion_pago') || ''}
                  onValueChange={(value) => setValue('condicion_pago', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDICIONES_PAGO.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="plazo_pago_dias">Plazo de Pago (días)</Label>
                <Input
                  type="number"
                  min="0"
                  {...register('plazo_pago_dias', { valueAsNumber: true })}
                  placeholder="30"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="lugar_entrega">Lugar de Entrega</Label>
                <Input
                  {...register('lugar_entrega')}
                  placeholder="Dirección de entrega"
                />
              </div>
            </CardContent>
          </Card>

          {/* Resumen */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {descuentoGeneral > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Descuento ({descuentoGeneral}%)</span>
                    <span>-{formatCurrency(descuentoMonto)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IVA (21%)</span>
                  <span>{formatCurrency(iva)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descuento_porcentaje">Descuento General (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  {...register('descuento_porcentaje', { valueAsNumber: true })}
                  placeholder="0"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requiere_aprobacion"
                  {...register('requiere_aprobacion')}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="requiere_aprobacion" className="text-sm font-normal">
                  Requiere aprobación
                </Label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items de la Orden */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Items de la Orden
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Buscar insumo para agregar */}
            <div className="mb-4">
              <Label>Agregar Insumo</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar insumo por código o nombre..."
                  value={insumoSearch}
                  onChange={(e) => setInsumoSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {insumoSearch.length >= 2 && insumosLista && insumosLista.length > 0 && (
                <div className="border rounded-lg max-h-48 overflow-y-auto mt-2">
                  {insumosLista.slice(0, 10).map((insumo) => (
                    <button
                      key={insumo.id}
                      type="button"
                      className="w-full px-4 py-2 text-left hover:bg-muted flex items-center justify-between"
                      onClick={() => agregarItem(insumo)}
                    >
                      <div>
                        <p className="font-medium text-sm">{insumo.nombre}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {insumo.codigo} - {insumo.unidad}
                        </p>
                      </div>
                      <Plus className="h-4 w-4 text-primary" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {fields.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay items en la orden</p>
                <p className="text-sm">Busque un insumo arriba para agregarlo</p>
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => {
                  const item = items[index];
                  const subtotalItem = (item?.cantidad || 0) * (item?.precio_unitario || 0);
                  const descItem = subtotalItem * ((item?.descuento_porcentaje || 0) / 100);
                  const totalItem = subtotalItem - descItem;

                  return (
                    <div
                      key={field.id}
                      className="grid gap-4 p-4 border rounded-lg bg-muted/30"
                    >
                      <div className="grid gap-4 md:grid-cols-6">
                        <div className="md:col-span-2 space-y-2">
                          <Label>Descripción</Label>
                          <Input
                            {...register(`items.${index}.descripcion`)}
                            placeholder="Descripción del item"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cantidad</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            {...register(`items.${index}.cantidad`, { valueAsNumber: true })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Unidad</Label>
                          <Input
                            {...register(`items.${index}.unidad`)}
                            placeholder="kg, lt, etc."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Precio Unit.</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...register(`items.${index}.precio_unitario`, { valueAsNumber: true })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Desc. %</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            {...register(`items.${index}.descuento_porcentaje`, {
                              valueAsNumber: true,
                            })}
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Input
                          {...register(`items.${index}.notas`)}
                          placeholder="Notas del item (opcional)"
                          className="max-w-md"
                        />
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium">
                            Subtotal: {formatCurrency(totalItem)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {errors.items && typeof errors.items === 'object' && 'message' in errors.items && (
              <p className="text-sm text-destructive mt-2">
                {(errors.items as { message: string }).message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Notas */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                {...register('notas')}
                placeholder="Notas para el proveedor..."
                rows={4}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas Internas</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                {...register('notas_internas')}
                placeholder="Notas internas (no visibles para el proveedor)..."
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        {/* Acciones */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
          >
            {(isSubmitting || createMutation.isPending || updateMutation.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Save className="mr-2 h-4 w-4" />
            {isEditing ? 'Guardar Cambios' : 'Crear Orden'}
          </Button>
        </div>
      </form>
    </div>
  );
}
