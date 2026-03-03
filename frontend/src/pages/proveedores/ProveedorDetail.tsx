/**
 * Detalle de Proveedor
 */

import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Building2,
  Package,
  FileText,
  Plus,
  User,
  Calendar,
  DollarSign,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

import { proveedorService } from '@/services/proveedorService';
import { formatCuit, formatCurrency, formatDate } from '@/utils/formatters';

export default function ProveedorDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Cargar proveedor
  const { data: proveedor, isLoading, error } = useQuery({
    queryKey: ['proveedor', id],
    queryFn: () => proveedorService.getProveedor(id!),
    enabled: Boolean(id),
  });

  // Cargar productos del proveedor
  const { data: productosData } = useQuery({
    queryKey: ['proveedor-productos', id],
    queryFn: () => proveedorService.getProductosProveedor(id!, { limit: 5 }),
    enabled: Boolean(id),
  });

  // Eliminar proveedor
  const deleteMutation = useMutation({
    mutationFn: () => proveedorService.deleteProveedor(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      toast({
        title: 'Proveedor eliminado',
        description: 'El proveedor ha sido eliminado correctamente.',
      });
      navigate('/proveedores');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el proveedor.',
        variant: 'destructive',
      });
    },
  });

  const handleDelete = () => {
    if (confirm('¿Está seguro de eliminar este proveedor? Esta acción no se puede deshacer.')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !proveedor) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <p>No se encontró el proveedor</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/proveedores')}>
          Volver a Proveedores
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/proveedores')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {proveedor.razon_social}
              </h1>
              <Badge variant={proveedor.activo ? 'success' : 'secondary'}>
                {proveedor.activo ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            {proveedor.nombre_fantasia && (
              <p className="text-gray-500">{proveedor.nombre_fantasia}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/proveedores/${id}/productos`)}
          >
            <Package className="h-4 w-4 mr-2" />
            Ver Productos
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/proveedores/ordenes/nueva?proveedor=${id}`)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Nueva Orden
          </Button>
          <Button onClick={() => navigate(`/proveedores/${id}/editar`)}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Información Principal */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Información General
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">CUIT</p>
              <p className="font-mono">{formatCuit(proveedor.cuit)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rubro</p>
              <p>{proveedor.rubro || '-'}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Dirección</p>
              <p className="flex items-center gap-1">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {proveedor.direccion
                  ? `${proveedor.direccion}, ${proveedor.ciudad || ''} - ${proveedor.provincia}`
                  : proveedor.provincia}
                {proveedor.codigo_postal && ` (${proveedor.codigo_postal})`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Estadísticas */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="text-sm">Productos</span>
              </div>
              <span className="font-bold">{proveedor.cantidad_productos || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm">Órdenes</span>
              </div>
              <span className="font-bold">{proveedor.cantidad_ordenes || 0}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>Creado: {formatDate(proveedor.created_at)}</p>
              {proveedor.updated_at && (
                <p>Actualizado: {formatDate(proveedor.updated_at)}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contacto */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contacto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {proveedor.telefono && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${proveedor.telefono}`} className="text-primary hover:underline">
                  {proveedor.telefono}
                </a>
              </div>
            )}
            {proveedor.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${proveedor.email}`} className="text-primary hover:underline">
                  {proveedor.email}
                </a>
              </div>
            )}
            {proveedor.sitio_web && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a
                  href={proveedor.sitio_web}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {proveedor.sitio_web}
                </a>
              </div>
            )}
            {!proveedor.telefono && !proveedor.email && !proveedor.sitio_web && (
              <p className="text-muted-foreground text-sm">Sin datos de contacto</p>
            )}
          </CardContent>
        </Card>

        {/* Contacto Personal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Persona de Contacto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {proveedor.contacto_nombre ? (
              <>
                <div>
                  <p className="font-medium">{proveedor.contacto_nombre}</p>
                </div>
                {proveedor.contacto_telefono && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`tel:${proveedor.contacto_telefono}`}
                      className="text-primary hover:underline"
                    >
                      {proveedor.contacto_telefono}
                    </a>
                  </div>
                )}
                {proveedor.contacto_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${proveedor.contacto_email}`}
                      className="text-primary hover:underline"
                    >
                      {proveedor.contacto_email}
                    </a>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Sin contacto asignado</p>
            )}
          </CardContent>
        </Card>

        {/* Condiciones Comerciales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Condiciones Comerciales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Condición de Pago</p>
              <p>{proveedor.condicion_pago || 'No especificada'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Días de Entrega</p>
              <p>{proveedor.dias_entrega_estimados || 'No especificados'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Descuento Habitual</p>
              <p>{proveedor.descuento_habitual || 'Sin descuento'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Productos Recientes */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Productos del Proveedor
              </CardTitle>
              <CardDescription>Últimos productos agregados</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/proveedores/${id}/productos/nuevo`)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Producto
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/proveedores/${id}/productos`)}
              >
                Ver todos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {productosData?.items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay productos registrados</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate(`/proveedores/${id}/productos/nuevo`)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Primer Producto
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                        Código
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                        Insumo
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">
                        Precio
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {productosData?.items.map((producto) => (
                      <tr key={producto.id} className="hover:bg-muted/50">
                        <td className="px-4 py-2 font-mono text-sm">
                          {producto.codigo_proveedor || '-'}
                        </td>
                        <td className="px-4 py-2">
                          <p className="font-medium">{producto.insumo_nombre}</p>
                          {producto.nombre_proveedor && (
                            <p className="text-sm text-muted-foreground">
                              {producto.nombre_proveedor}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <p className="font-medium">
                            {formatCurrency(producto.precio_unitario)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {producto.precio_con_iva ? 'IVA incl.' : 'Sin IVA'}
                          </p>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Badge
                            variant={
                              producto.precio_vigente
                                ? producto.es_preferido
                                  ? 'default'
                                  : 'success'
                                : 'warning'
                            }
                          >
                            {producto.precio_vigente
                              ? producto.es_preferido
                                ? 'Preferido'
                                : 'Vigente'
                              : 'Vencido'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notas */}
        {proveedor.notas && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {proveedor.notas}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
