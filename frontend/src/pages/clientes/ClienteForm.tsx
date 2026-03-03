/**
 * Formulario de Creación/Edición de Cliente
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

import { clienteService } from '@/services/clienteService';
import { TIPOS_CLIENTE, CONDICIONES_IVA } from '@/types/cliente';
import type { ClienteCreate } from '@/types/cliente';

const clienteSchema = z.object({
  tipo: z.string().default('particular'),
  razon_social: z.string().min(2, 'Mínimo 2 caracteres').max(200),
  nombre_fantasia: z.string().nullable().optional(),
  cuit: z
    .string()
    .regex(/^\d{2}-\d{8}-\d{1}$/, 'Formato: XX-XXXXXXXX-X')
    .nullable()
    .optional()
    .or(z.literal('')),
  condicion_iva: z.string().default('consumidor_final'),
  email: z.string().email('Email inválido').nullable().optional().or(z.literal('')),
  telefono: z.string().nullable().optional(),
  celular: z.string().nullable().optional(),
  contacto_nombre: z.string().nullable().optional(),
  contacto_cargo: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  ciudad: z.string().nullable().optional(),
  provincia: z.string().default('Córdoba'),
  codigo_postal: z.string().nullable().optional(),
  descuento_general: z.coerce.number().min(0).max(100).nullable().optional(),
  limite_credito: z.coerce.number().min(0).nullable().optional(),
  dias_credito: z.coerce.number().int().min(0).nullable().optional(),
  dia_retiro_preferido: z.string().nullable().optional(),
  horario_retiro_preferido: z.string().nullable().optional(),
  requiere_factura: z.boolean().default(false),
  enviar_notificaciones: z.boolean().default(true),
  notas: z.string().nullable().optional(),
  notas_internas: z.string().nullable().optional(),
});

type ClienteFormData = z.infer<typeof clienteSchema>;

export default function ClienteFormPage() {
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
  } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      tipo: 'particular',
      condicion_iva: 'consumidor_final',
      provincia: 'Córdoba',
      requiere_factura: false,
      enviar_notificaciones: true,
    },
  });

  // Cargar cliente existente
  const { data: cliente, isLoading } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => clienteService.getCliente(id!),
    enabled: isEditing,
  });

  useEffect(() => {
    if (cliente) {
      reset({
        tipo: cliente.tipo,
        razon_social: cliente.razon_social,
        nombre_fantasia: cliente.nombre_fantasia,
        cuit: cliente.cuit,
        condicion_iva: cliente.condicion_iva,
        email: cliente.email,
        telefono: cliente.telefono,
        celular: cliente.celular,
        contacto_nombre: cliente.contacto_nombre,
        contacto_cargo: cliente.contacto_cargo,
        direccion: cliente.direccion,
        ciudad: cliente.ciudad,
        provincia: cliente.provincia,
        codigo_postal: cliente.codigo_postal,
        descuento_general: cliente.descuento_general,
        limite_credito: cliente.limite_credito,
        dias_credito: cliente.dias_credito,
        dia_retiro_preferido: cliente.dia_retiro_preferido,
        horario_retiro_preferido: cliente.horario_retiro_preferido,
        requiere_factura: cliente.requiere_factura,
        enviar_notificaciones: cliente.enviar_notificaciones,
        notas: cliente.notas,
        notas_internas: cliente.notas_internas,
      });
    }
  }, [cliente, reset]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: ClienteCreate) => clienteService.createCliente(data),
    onSuccess: (newCliente) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast({
        title: 'Cliente creado',
        description: `El cliente ${newCliente.codigo} ha sido creado exitosamente.`,
      });
      navigate(`/clientes/${newCliente.id}`);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo crear el cliente.',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<ClienteCreate>) => clienteService.updateCliente(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cliente', id] });
      toast({
        title: 'Cliente actualizado',
        description: 'Los cambios han sido guardados.',
      });
      navigate(`/clientes/${id}`);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo actualizar el cliente.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ClienteFormData) => {
    // Limpiar campos vacíos
    const payload: ClienteCreate = {
      ...data,
      cuit: data.cuit || null,
      email: data.email || null,
      descuento_general: data.descuento_general || null,
      limite_credito: data.limite_credito || null,
      dias_credito: data.dias_credito || null,
    };

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
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? `Editar Cliente ${cliente?.codigo}` : 'Nuevo Cliente'}
          </h1>
          <p className="text-gray-500">
            {isEditing ? 'Modifica los datos del cliente' : 'Ingresa los datos del nuevo cliente'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Datos Básicos */}
        <Card>
          <CardHeader>
            <CardTitle>Datos Básicos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo de Cliente *</Label>
                <Select value={watch('tipo')} onValueChange={(v) => setValue('tipo', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CLIENTE.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="condicion_iva">Condición IVA *</Label>
                <Select
                  value={watch('condicion_iva')}
                  onValueChange={(v) => setValue('condicion_iva', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDICIONES_IVA.map((cond) => (
                      <SelectItem key={cond.value} value={cond.value}>
                        {cond.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="razon_social">Razón Social / Nombre *</Label>
                <Input id="razon_social" {...register('razon_social')} />
                {errors.razon_social && (
                  <p className="text-sm text-red-500">{errors.razon_social.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre_fantasia">Nombre Fantasía</Label>
                <Input id="nombre_fantasia" {...register('nombre_fantasia')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cuit">CUIT</Label>
              <Input id="cuit" placeholder="XX-XXXXXXXX-X" {...register('cuit')} />
              {errors.cuit && <p className="text-sm text-red-500">{errors.cuit.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Contacto */}
        <Card>
          <CardHeader>
            <CardTitle>Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} />
                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input id="telefono" {...register('telefono')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="celular">Celular</Label>
                <Input id="celular" {...register('celular')} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contacto_nombre">Persona de Contacto</Label>
                <Input id="contacto_nombre" {...register('contacto_nombre')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contacto_cargo">Cargo</Label>
                <Input id="contacto_cargo" {...register('contacto_cargo')} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dirección */}
        <Card>
          <CardHeader>
            <CardTitle>Dirección</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input id="direccion" {...register('direccion')} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input id="ciudad" {...register('ciudad')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="provincia">Provincia</Label>
                <Input id="provincia" {...register('provincia')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="codigo_postal">Código Postal</Label>
                <Input id="codigo_postal" {...register('codigo_postal')} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comercial */}
        <Card>
          <CardHeader>
            <CardTitle>Condiciones Comerciales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="descuento_general">Descuento General (%)</Label>
                <Input
                  id="descuento_general"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  {...register('descuento_general')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="limite_credito">Límite de Crédito ($)</Label>
                <Input
                  id="limite_credito"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('limite_credito')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dias_credito">Días de Crédito</Label>
                <Input
                  id="dias_credito"
                  type="number"
                  min="0"
                  {...register('dias_credito')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dia_retiro_preferido">Día de Retiro Preferido</Label>
                <Select
                  value={watch('dia_retiro_preferido') || ''}
                  onValueChange={(v) => setValue('dia_retiro_preferido', v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar día" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lunes">Lunes</SelectItem>
                    <SelectItem value="martes">Martes</SelectItem>
                    <SelectItem value="miercoles">Miércoles</SelectItem>
                    <SelectItem value="jueves">Jueves</SelectItem>
                    <SelectItem value="viernes">Viernes</SelectItem>
                    <SelectItem value="sabado">Sábado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="horario_retiro_preferido">Horario Preferido</Label>
                <Input
                  id="horario_retiro_preferido"
                  placeholder="Ej: 9:00 - 12:00"
                  {...register('horario_retiro_preferido')}
                />
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requiere_factura"
                  checked={watch('requiere_factura')}
                  onCheckedChange={(checked) => setValue('requiere_factura', !!checked)}
                />
                <Label htmlFor="requiere_factura" className="cursor-pointer">
                  Requiere factura
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enviar_notificaciones"
                  checked={watch('enviar_notificaciones')}
                  onCheckedChange={(checked) => setValue('enviar_notificaciones', !!checked)}
                />
                <Label htmlFor="enviar_notificaciones" className="cursor-pointer">
                  Enviar notificaciones
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
              <Label htmlFor="notas">Notas (visibles para el cliente)</Label>
              <Textarea id="notas" rows={2} {...register('notas')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas_internas">Notas Internas</Label>
              <Textarea id="notas_internas" rows={2} {...register('notas_internas')} />
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
            {isEditing ? 'Guardar Cambios' : 'Crear Cliente'}
          </Button>
        </div>
      </form>
    </div>
  );
}
