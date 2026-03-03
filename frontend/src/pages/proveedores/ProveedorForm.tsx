/**
 * Formulario de Proveedor (Crear/Editar)
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
import { useToast } from '@/components/ui/use-toast';

import { proveedorService } from '@/services/proveedorService';
import { RUBROS_PROVEEDOR, CONDICIONES_PAGO } from '@/types/proveedor';

const PROVINCIAS = [
  'Buenos Aires',
  'CABA',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
];

const proveedorSchema = z.object({
  razon_social: z.string().min(1, 'La razón social es requerida'),
  nombre_fantasia: z.string().optional().nullable(),
  cuit: z
    .string()
    .min(11, 'El CUIT debe tener 11 dígitos')
    .max(13, 'CUIT inválido')
    .regex(/^[\d-]+$/, 'CUIT inválido'),
  direccion: z.string().optional().nullable(),
  ciudad: z.string().optional().nullable(),
  provincia: z.string().min(1, 'La provincia es requerida'),
  codigo_postal: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  sitio_web: z.string().url('URL inválida').optional().nullable().or(z.literal('')),
  contacto_nombre: z.string().optional().nullable(),
  contacto_telefono: z.string().optional().nullable(),
  contacto_email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  condicion_pago: z.string().optional().nullable(),
  dias_entrega_estimados: z.string().optional().nullable(),
  descuento_habitual: z.string().optional().nullable(),
  rubro: z.string().optional().nullable(),
  activo: z.boolean().default(true),
  notas: z.string().optional().nullable(),
});

type ProveedorFormData = z.infer<typeof proveedorSchema>;

export default function ProveedorForm() {
  const navigate = useNavigate();
  const { id } = useParams();
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
  } = useForm<ProveedorFormData>({
    resolver: zodResolver(proveedorSchema),
    defaultValues: {
      provincia: 'Buenos Aires',
      activo: true,
    },
  });

  // Cargar proveedor si estamos editando
  const { data: proveedor, isLoading: loadingProveedor } = useQuery({
    queryKey: ['proveedor', id],
    queryFn: () => proveedorService.getProveedor(id!),
    enabled: isEditing,
  });

  // Cargar datos del proveedor en el formulario
  useEffect(() => {
    if (proveedor) {
      reset({
        razon_social: proveedor.razon_social,
        nombre_fantasia: proveedor.nombre_fantasia,
        cuit: proveedor.cuit,
        direccion: proveedor.direccion,
        ciudad: proveedor.ciudad,
        provincia: proveedor.provincia || 'Buenos Aires',
        codigo_postal: proveedor.codigo_postal,
        telefono: proveedor.telefono,
        email: proveedor.email,
        sitio_web: proveedor.sitio_web,
        contacto_nombre: proveedor.contacto_nombre,
        contacto_telefono: proveedor.contacto_telefono,
        contacto_email: proveedor.contacto_email,
        condicion_pago: proveedor.condicion_pago,
        dias_entrega_estimados: proveedor.dias_entrega_estimados,
        descuento_habitual: proveedor.descuento_habitual,
        rubro: proveedor.rubro,
        activo: proveedor.activo,
        notas: proveedor.notas,
      });
    }
  }, [proveedor, reset]);

  // Mutaciones
  const createMutation = useMutation({
    mutationFn: proveedorService.createProveedor,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      toast({
        title: 'Proveedor creado',
        description: `${data.razon_social} ha sido creado correctamente.`,
      });
      navigate(`/proveedores/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear el proveedor.',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProveedorFormData) =>
      proveedorService.updateProveedor(id!, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      queryClient.invalidateQueries({ queryKey: ['proveedor', id] });
      toast({
        title: 'Proveedor actualizado',
        description: `${data.razon_social} ha sido actualizado correctamente.`,
      });
      navigate(`/proveedores/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el proveedor.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ProveedorFormData) => {
    // Limpiar strings vacíos
    const cleanedData = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        value === '' ? null : value,
      ])
    ) as ProveedorFormData;

    if (isEditing) {
      updateMutation.mutate(cleanedData);
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  if (isEditing && loadingProveedor) {
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
            {isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </h1>
          <p className="text-gray-500">
            {isEditing
              ? `Editando: ${proveedor?.razon_social}`
              : 'Complete los datos del proveedor'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Datos Principales */}
        <Card>
          <CardHeader>
            <CardTitle>Datos Principales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="razon_social">
                Razón Social <span className="text-destructive">*</span>
              </Label>
              <Input
                id="razon_social"
                {...register('razon_social')}
                placeholder="Ej: Químicos S.A."
              />
              {errors.razon_social && (
                <p className="text-sm text-destructive">{errors.razon_social.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre_fantasia">Nombre Fantasía</Label>
              <Input
                id="nombre_fantasia"
                {...register('nombre_fantasia')}
                placeholder="Nombre comercial (opcional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cuit">
                CUIT <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cuit"
                {...register('cuit')}
                placeholder="20-12345678-9"
              />
              {errors.cuit && (
                <p className="text-sm text-destructive">{errors.cuit.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rubro">Rubro</Label>
              <Select
                value={watch('rubro') || ''}
                onValueChange={(value) => setValue('rubro', value || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar rubro" />
                </SelectTrigger>
                <SelectContent>
                  {RUBROS_PROVEEDOR.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Ubicación */}
        <Card>
          <CardHeader>
            <CardTitle>Ubicación</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                {...register('direccion')}
                placeholder="Calle y número"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ciudad">Ciudad</Label>
              <Input id="ciudad" {...register('ciudad')} placeholder="Ciudad" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provincia">
                Provincia <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch('provincia') || 'Buenos Aires'}
                onValueChange={(value) => setValue('provincia', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar provincia" />
                </SelectTrigger>
                <SelectContent>
                  {PROVINCIAS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.provincia && (
                <p className="text-sm text-destructive">{errors.provincia.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo_postal">Código Postal</Label>
              <Input
                id="codigo_postal"
                {...register('codigo_postal')}
                placeholder="1234"
              />
            </div>
          </CardContent>
        </Card>

        {/* Contacto */}
        <Card>
          <CardHeader>
            <CardTitle>Contacto</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono General</Label>
              <Input
                id="telefono"
                {...register('telefono')}
                placeholder="+54 11 1234-5678"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email General</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="contacto@empresa.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sitio_web">Sitio Web</Label>
              <Input
                id="sitio_web"
                {...register('sitio_web')}
                placeholder="https://www.empresa.com"
              />
              {errors.sitio_web && (
                <p className="text-sm text-destructive">{errors.sitio_web.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contacto_nombre">Nombre del Contacto</Label>
              <Input
                id="contacto_nombre"
                {...register('contacto_nombre')}
                placeholder="Juan Pérez"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contacto_telefono">Teléfono del Contacto</Label>
              <Input
                id="contacto_telefono"
                {...register('contacto_telefono')}
                placeholder="+54 11 1234-5678"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contacto_email">Email del Contacto</Label>
              <Input
                id="contacto_email"
                type="email"
                {...register('contacto_email')}
                placeholder="jperez@empresa.com"
              />
              {errors.contacto_email && (
                <p className="text-sm text-destructive">{errors.contacto_email.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Condiciones Comerciales */}
        <Card>
          <CardHeader>
            <CardTitle>Condiciones Comerciales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="condicion_pago">Condición de Pago</Label>
              <Select
                value={watch('condicion_pago') || ''}
                onValueChange={(value) => setValue('condicion_pago', value || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar condición" />
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
              <Label htmlFor="dias_entrega_estimados">Días de Entrega</Label>
              <Input
                id="dias_entrega_estimados"
                {...register('dias_entrega_estimados')}
                placeholder="Ej: 3-5 días"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descuento_habitual">Descuento Habitual</Label>
              <Input
                id="descuento_habitual"
                {...register('descuento_habitual')}
                placeholder="Ej: 10%"
              />
            </div>
          </CardContent>
        </Card>

        {/* Notas */}
        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              {...register('notas')}
              placeholder="Notas adicionales sobre el proveedor..."
              rows={4}
            />
          </CardContent>
        </Card>

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
            {isEditing ? 'Guardar Cambios' : 'Crear Proveedor'}
          </Button>
        </div>
      </form>
    </div>
  );
}
