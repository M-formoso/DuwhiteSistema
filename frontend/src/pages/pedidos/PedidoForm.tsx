/**
 * Formulario de Pedido (Crear/Editar)
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
  User,
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

import { clienteService } from '@/services/clienteService';
import { TIPOS_ENTREGA } from '@/types/cliente';
import type { DetallePedidoCreate } from '@/types/cliente';
import { formatCurrency, formatNumber } from '@/utils/formatters';

const detalleSchema = z.object({
  descripcion: z.string().min(1, 'La descripción es requerida'),
  cantidad: z.number().min(0.01, 'La cantidad debe ser mayor a 0'),
  unidad: z.string().default('kg'),
  precio_unitario: z.number().min(0, 'El precio no puede ser negativo'),
  descuento_porcentaje: z.number().min(0).max(100).nullable().optional(),
  notas: z.string().nullable().optional(),
});

const pedidoSchema = z.object({
  cliente_id: z.string().min(1, 'Debe seleccionar un cliente'),
  fecha_pedido: z.string().min(1, 'La fecha es requerida'),
  fecha_retiro: z.string().nullable().optional(),
  fecha_entrega_estimada: z.string().nullable().optional(),
  tipo_entrega: z.enum(['retiro_local', 'delivery', 'envio']).default('retiro_local'),
  direccion_entrega: z.string().nullable().optional(),
  horario_entrega: z.string().nullable().optional(),
  descuento_porcentaje: z.number().min(0).max(100).nullable().optional(),
  notas: z.string().nullable().optional(),
  notas_internas: z.string().nullable().optional(),
  observaciones_entrega: z.string().nullable().optional(),
  detalles: z.array(detalleSchema).min(1, 'Debe agregar al menos un item'),
});

type PedidoFormData = z.infer<typeof pedidoSchema>;

export default function PedidoForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(id);

  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteSearch, setShowClienteSearch] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PedidoFormData>({
    resolver: zodResolver(pedidoSchema),
    defaultValues: {
      fecha_pedido: new Date().toISOString().split('T')[0],
      tipo_entrega: 'retiro_local',
      detalles: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'detalles',
  });

  const clienteId = watch('cliente_id');
  const tipoEntrega = watch('tipo_entrega');
  const detalles = watch('detalles');
  const descuentoGeneral = watch('descuento_porcentaje') || 0;

  // Buscar clientes
  const { data: clientesLista } = useQuery({
    queryKey: ['clientes-lista'],
    queryFn: () => clienteService.getClientesLista(),
  });

  // Cliente seleccionado desde URL
  useEffect(() => {
    const clienteParam = searchParams.get('cliente');
    if (clienteParam && !clienteId) {
      setValue('cliente_id', clienteParam);
    }
  }, [searchParams, setValue, clienteId]);

  // Cargar pedido si estamos editando
  const { data: pedido, isLoading: loadingPedido } = useQuery({
    queryKey: ['pedido', id],
    queryFn: () => clienteService.getPedido(id!),
    enabled: isEditing,
  });

  // Cargar datos del pedido en el formulario
  useEffect(() => {
    if (pedido) {
      reset({
        cliente_id: pedido.cliente_id,
        fecha_pedido: pedido.fecha_pedido.split('T')[0],
        fecha_retiro: pedido.fecha_retiro?.split('T')[0] || null,
        fecha_entrega_estimada: pedido.fecha_entrega_estimada?.split('T')[0] || null,
        tipo_entrega: pedido.tipo_entrega,
        direccion_entrega: pedido.direccion_entrega,
        horario_entrega: pedido.horario_entrega,
        descuento_porcentaje: pedido.descuento_porcentaje,
        notas: pedido.notas,
        notas_internas: pedido.notas_internas,
        observaciones_entrega: pedido.observaciones_entrega,
        detalles: pedido.detalles.map((d) => ({
          descripcion: d.descripcion,
          cantidad: d.cantidad,
          unidad: d.unidad,
          precio_unitario: d.precio_unitario,
          descuento_porcentaje: d.descuento_porcentaje,
          notas: d.notas,
        })),
      });
    }
  }, [pedido, reset]);

  // Calcular totales
  const calcularSubtotal = () => {
    return detalles.reduce((sum, item) => {
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
    mutationFn: clienteService.createPedido,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      toast({
        title: 'Pedido creado',
        description: `Pedido #${data.numero} creado correctamente.`,
      });
      navigate(`/pedidos/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear el pedido.',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: PedidoFormData) => clienteService.updatePedido(id!, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedido', id] });
      toast({
        title: 'Pedido actualizado',
        description: `Pedido #${data.numero} actualizado correctamente.`,
      });
      navigate(`/pedidos/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el pedido.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: PedidoFormData) => {
    const cleanedData = {
      ...data,
      fecha_retiro: data.fecha_retiro || null,
      fecha_entrega_estimada: data.fecha_entrega_estimada || null,
      direccion_entrega: data.direccion_entrega || null,
      horario_entrega: data.horario_entrega || null,
      descuento_porcentaje: data.descuento_porcentaje || null,
      notas: data.notas || null,
      notas_internas: data.notas_internas || null,
      observaciones_entrega: data.observaciones_entrega || null,
    };

    if (isEditing) {
      updateMutation.mutate(cleanedData);
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const agregarItem = () => {
    append({
      descripcion: '',
      cantidad: 1,
      unidad: 'kg',
      precio_unitario: 0,
      descuento_porcentaje: null,
      notas: null,
    });
  };

  const clienteSeleccionado = clientesLista?.find((c) => c.id === clienteId);

  const clientesFiltrados = clientesLista?.filter(
    (c) =>
      c.nombre.toLowerCase().includes(clienteSearch.toLowerCase()) ||
      c.codigo.toLowerCase().includes(clienteSearch.toLowerCase())
  );

  if (isEditing && loadingPedido) {
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
            {isEditing ? `Editar Pedido #${pedido?.numero}` : 'Nuevo Pedido'}
          </h1>
          <p className="text-gray-500">
            {isEditing ? 'Modifique los datos del pedido' : 'Complete los datos del pedido'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Información Principal */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Información del Pedido</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {/* Cliente */}
              <div className="space-y-2 md:col-span-2">
                <Label>
                  Cliente <span className="text-destructive">*</span>
                </Label>
                {clienteSeleccionado ? (
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{clienteSeleccionado.nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          {clienteSeleccionado.codigo}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setValue('cliente_id', '');
                        setShowClienteSearch(true);
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
                        placeholder="Buscar cliente por nombre o código..."
                        value={clienteSearch}
                        onChange={(e) => setClienteSearch(e.target.value)}
                        onFocus={() => setShowClienteSearch(true)}
                        className="pl-10"
                      />
                    </div>
                    {showClienteSearch && clientesFiltrados && clientesFiltrados.length > 0 && (
                      <div className="border rounded-lg max-h-48 overflow-y-auto">
                        {clientesFiltrados.slice(0, 10).map((cliente) => (
                          <button
                            key={cliente.id}
                            type="button"
                            className="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-3"
                            onClick={() => {
                              setValue('cliente_id', cliente.id);
                              setShowClienteSearch(false);
                              setClienteSearch('');
                            }}
                          >
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                              {cliente.nombre.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{cliente.nombre}</p>
                              <p className="text-xs text-muted-foreground">{cliente.codigo}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {errors.cliente_id && (
                  <p className="text-sm text-destructive">{errors.cliente_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_pedido">
                  Fecha del Pedido <span className="text-destructive">*</span>
                </Label>
                <Input type="date" {...register('fecha_pedido')} />
                {errors.fecha_pedido && (
                  <p className="text-sm text-destructive">{errors.fecha_pedido.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_entrega_estimada">Fecha Entrega Estimada</Label>
                <Input type="date" {...register('fecha_entrega_estimada')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo_entrega">Tipo de Entrega</Label>
                <Select
                  value={tipoEntrega}
                  onValueChange={(value: 'retiro_local' | 'delivery' | 'envio') =>
                    setValue('tipo_entrega', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_ENTREGA.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {tipoEntrega === 'retiro_local' && (
                <div className="space-y-2">
                  <Label htmlFor="fecha_retiro">Fecha de Retiro</Label>
                  <Input type="date" {...register('fecha_retiro')} />
                </div>
              )}

              {(tipoEntrega === 'delivery' || tipoEntrega === 'envio') && (
                <>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="direccion_entrega">Dirección de Entrega</Label>
                    <Input
                      {...register('direccion_entrega')}
                      placeholder="Dirección completa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="horario_entrega">Horario de Entrega</Label>
                    <Input
                      {...register('horario_entrega')}
                      placeholder="Ej: 9:00 - 12:00"
                    />
                  </div>
                </>
              )}
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
            </CardContent>
          </Card>
        </div>

        {/* Items del Pedido */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Items del Pedido
            </CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={agregarItem}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Item
            </Button>
          </CardHeader>
          <CardContent>
            {fields.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay items en el pedido</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={agregarItem}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Primer Item
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => {
                  const item = detalles[index];
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
                            {...register(`detalles.${index}.descripcion`)}
                            placeholder="Descripción del servicio"
                          />
                          {errors.detalles?.[index]?.descripcion && (
                            <p className="text-xs text-destructive">
                              {errors.detalles[index]?.descripcion?.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Cantidad</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            {...register(`detalles.${index}.cantidad`, { valueAsNumber: true })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Unidad</Label>
                          <Select
                            value={watch(`detalles.${index}.unidad`) || 'kg'}
                            onValueChange={(v) => setValue(`detalles.${index}.unidad`, v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="unidad">Unidad</SelectItem>
                              <SelectItem value="metro">Metro</SelectItem>
                              <SelectItem value="servicio">Servicio</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Precio Unit.</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...register(`detalles.${index}.precio_unitario`, { valueAsNumber: true })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Desc. %</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            {...register(`detalles.${index}.descuento_porcentaje`, {
                              valueAsNumber: true,
                            })}
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Input
                          {...register(`detalles.${index}.notas`)}
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
            {errors.detalles && typeof errors.detalles === 'object' && 'message' in errors.detalles && (
              <p className="text-sm text-destructive mt-2">
                {(errors.detalles as { message: string }).message}
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
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notas">Notas para el cliente</Label>
                <Textarea
                  {...register('notas')}
                  placeholder="Notas que aparecerán en el comprobante..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="observaciones_entrega">Observaciones de entrega</Label>
                <Textarea
                  {...register('observaciones_entrega')}
                  placeholder="Instrucciones especiales de entrega..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas Internas</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                {...register('notas_internas')}
                placeholder="Notas internas (no visibles para el cliente)..."
                rows={5}
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
            {isEditing ? 'Guardar Cambios' : 'Crear Pedido'}
          </Button>
        </div>
      </form>
    </div>
  );
}
