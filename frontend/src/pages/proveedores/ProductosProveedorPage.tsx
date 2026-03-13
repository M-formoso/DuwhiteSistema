/**
 * Página de Productos del Proveedor
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Package,
  DollarSign,
  Star,
  StarOff,
  Loader2,
  AlertTriangle,
  Search,
  RefreshCw,
  Calendar,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

import { proveedorService } from '@/services/proveedorService';
import { stockService } from '@/services/stockService';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { ProductoProveedor, ProductoProveedorCreate } from '@/types/proveedor';

interface FormData {
  insumo_id: string;
  codigo_proveedor: string;
  nombre_proveedor: string;
  precio_unitario: string;
  moneda: string;
  precio_con_iva: boolean;
  unidad_compra: string;
  factor_conversion: string;
  cantidad_minima: string;
  fecha_precio: string;
  fecha_vencimiento_precio: string;
  es_preferido: boolean;
  notas: string;
}

const initialFormData: FormData = {
  insumo_id: '',
  codigo_proveedor: '',
  nombre_proveedor: '',
  precio_unitario: '',
  moneda: 'ARS',
  precio_con_iva: true,
  unidad_compra: '',
  factor_conversion: '1',
  cantidad_minima: '',
  fecha_precio: new Date().toLocaleDateString('en-CA'),
  fecha_vencimiento_precio: '',
  es_preferido: false,
  notas: '',
};

export default function ProductosProveedorPage() {
  const { id: proveedorId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState<ProductoProveedor | null>(null);
  const [deleteProducto, setDeleteProducto] = useState<ProductoProveedor | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [priceData, setPriceData] = useState({
    precio_unitario: '',
    fecha_precio: new Date().toLocaleDateString('en-CA'),
    fecha_vencimiento_precio: '',
    documento_referencia: '',
    notas: '',
  });

  // Cargar proveedor
  const { data: proveedor } = useQuery({
    queryKey: ['proveedor', proveedorId],
    queryFn: () => proveedorService.getProveedor(proveedorId!),
    enabled: Boolean(proveedorId),
  });

  // Cargar productos
  const { data: productosData, isLoading, refetch } = useQuery({
    queryKey: ['proveedor-productos', proveedorId],
    queryFn: () => proveedorService.getProductosProveedor(proveedorId!, { limit: 100, solo_activos: false }),
    enabled: Boolean(proveedorId),
  });

  // Cargar insumos para el dropdown
  const { data: insumosData } = useQuery({
    queryKey: ['insumos-lista'],
    queryFn: () => stockService.getInsumos({ limit: 500, solo_activos: true }),
  });

  // Crear producto
  const createMutation = useMutation({
    mutationFn: (data: ProductoProveedorCreate) =>
      proveedorService.createProductoProveedor(proveedorId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedor-productos', proveedorId] });
      queryClient.invalidateQueries({ queryKey: ['proveedor', proveedorId] });
      toast({ title: 'Producto agregado', description: 'El producto se agregó correctamente.' });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo agregar el producto.',
        variant: 'destructive',
      });
    },
  });

  // Actualizar producto
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductoProveedorCreate> }) =>
      proveedorService.updateProductoProveedor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedor-productos', proveedorId] });
      toast({ title: 'Producto actualizado', description: 'El producto se actualizó correctamente.' });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el producto.',
        variant: 'destructive',
      });
    },
  });

  // Actualizar precio
  const updatePriceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      proveedorService.actualizarPrecioProducto(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedor-productos', proveedorId] });
      toast({ title: 'Precio actualizado', description: 'El precio se actualizó correctamente.' });
      setIsPriceDialogOpen(false);
      setEditingProducto(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo actualizar el precio.',
        variant: 'destructive',
      });
    },
  });

  const handleOpenCreate = () => {
    setEditingProducto(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (producto: ProductoProveedor) => {
    setEditingProducto(producto);
    setFormData({
      insumo_id: producto.insumo_id,
      codigo_proveedor: producto.codigo_proveedor || '',
      nombre_proveedor: producto.nombre_proveedor || '',
      precio_unitario: producto.precio_unitario?.toString() || '',
      moneda: producto.moneda || 'ARS',
      precio_con_iva: producto.precio_con_iva ?? true,
      unidad_compra: producto.unidad_compra || '',
      factor_conversion: producto.factor_conversion?.toString() || '1',
      cantidad_minima: producto.cantidad_minima?.toString() || '',
      fecha_precio: producto.fecha_precio || new Date().toLocaleDateString('en-CA'),
      fecha_vencimiento_precio: producto.fecha_vencimiento_precio || '',
      es_preferido: producto.es_preferido ?? false,
      notas: producto.notas || '',
    });
    setIsDialogOpen(true);
  };

  const handleOpenPriceUpdate = (producto: ProductoProveedor) => {
    setEditingProducto(producto);
    setPriceData({
      precio_unitario: producto.precio_unitario?.toString() || '',
      fecha_precio: new Date().toLocaleDateString('en-CA'),
      fecha_vencimiento_precio: '',
      documento_referencia: '',
      notas: '',
    });
    setIsPriceDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProducto(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.insumo_id) {
      toast({ title: 'Error', description: 'Selecciona un insumo.', variant: 'destructive' });
      return;
    }
    if (!formData.precio_unitario || parseFloat(formData.precio_unitario) <= 0) {
      toast({ title: 'Error', description: 'Ingresa un precio válido.', variant: 'destructive' });
      return;
    }

    const data: ProductoProveedorCreate = {
      proveedor_id: proveedorId!,
      insumo_id: formData.insumo_id,
      codigo_proveedor: formData.codigo_proveedor || null,
      nombre_proveedor: formData.nombre_proveedor || null,
      precio_unitario: parseFloat(formData.precio_unitario),
      moneda: formData.moneda,
      precio_con_iva: formData.precio_con_iva,
      unidad_compra: formData.unidad_compra || null,
      factor_conversion: parseFloat(formData.factor_conversion) || 1,
      cantidad_minima: formData.cantidad_minima ? parseFloat(formData.cantidad_minima) : null,
      fecha_precio: formData.fecha_precio,
      fecha_vencimiento_precio: formData.fecha_vencimiento_precio || null,
      es_preferido: formData.es_preferido,
      notas: formData.notas || null,
      activo: true,
    };

    if (editingProducto) {
      updateMutation.mutate({ id: editingProducto.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSubmitPrice = (e: React.FormEvent) => {
    e.preventDefault();

    if (!priceData.precio_unitario || parseFloat(priceData.precio_unitario) <= 0) {
      toast({ title: 'Error', description: 'Ingresa un precio válido.', variant: 'destructive' });
      return;
    }

    updatePriceMutation.mutate({
      id: editingProducto!.id,
      data: {
        precio_unitario: parseFloat(priceData.precio_unitario),
        fecha_precio: priceData.fecha_precio,
        fecha_vencimiento_precio: priceData.fecha_vencimiento_precio || null,
        documento_referencia: priceData.documento_referencia || null,
        notas: priceData.notas || null,
      },
    });
  };

  const handleDelete = () => {
    if (deleteProducto) {
      updateMutation.mutate({ id: deleteProducto.id, data: { activo: false } });
      setDeleteProducto(null);
    }
  };

  // Filtrar productos
  const productos = productosData?.items.filter((p) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      p.insumo_nombre?.toLowerCase().includes(searchLower) ||
      p.codigo_proveedor?.toLowerCase().includes(searchLower) ||
      p.nombre_proveedor?.toLowerCase().includes(searchLower)
    );
  }) || [];

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (!proveedorId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <p>ID de proveedor no válido</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/proveedores/${proveedorId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Productos del Proveedor</h1>
            <p className="text-gray-500">{proveedor?.razon_social || 'Cargando...'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar Producto
          </Button>
        </div>
      </div>

      {/* Búsqueda */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por insumo o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de Productos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Catálogo de Productos
          </CardTitle>
          <CardDescription>
            {productos.length} productos registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : productos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay productos registrados</p>
              <Button variant="outline" className="mt-4" onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Primer Producto
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Insumo</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Fecha Precio</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productos.map((producto) => (
                    <TableRow key={producto.id} className={!producto.activo ? 'opacity-50' : ''}>
                      <TableCell className="font-mono text-sm">
                        {producto.codigo_proveedor || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{producto.insumo_nombre}</p>
                          {producto.nombre_proveedor && (
                            <p className="text-sm text-muted-foreground">
                              {producto.nombre_proveedor}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="font-medium">{formatCurrency(producto.precio_unitario)}</p>
                        <p className="text-xs text-muted-foreground">
                          {producto.precio_con_iva ? 'IVA incl.' : 'Sin IVA'} • {producto.moneda}
                        </p>
                      </TableCell>
                      <TableCell>
                        {producto.unidad_compra || '-'}
                        {producto.factor_conversion && producto.factor_conversion !== 1 && (
                          <span className="text-xs text-muted-foreground block">
                            x{producto.factor_conversion}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{formatDate(producto.fecha_precio)}</p>
                        {producto.fecha_vencimiento_precio && (
                          <p className="text-xs text-muted-foreground">
                            Vence: {formatDate(producto.fecha_vencimiento_precio)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge
                            variant={
                              !producto.activo
                                ? 'secondary'
                                : producto.precio_vigente
                                ? 'success'
                                : 'warning'
                            }
                          >
                            {!producto.activo
                              ? 'Inactivo'
                              : producto.precio_vigente
                              ? 'Vigente'
                              : 'Vencido'}
                          </Badge>
                          {producto.es_preferido && (
                            <Badge variant="default" className="gap-1">
                              <Star className="h-3 w-3" />
                              Preferido
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Actualizar precio"
                            onClick={() => handleOpenPriceUpdate(producto)}
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(producto)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteProducto(producto)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Crear/Editar Producto */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProducto ? 'Editar Producto' : 'Agregar Producto'}
            </DialogTitle>
            <DialogDescription>
              {editingProducto
                ? 'Modifica los datos del producto'
                : 'Agrega un insumo al catálogo de este proveedor'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Insumo */}
            <div className="space-y-2">
              <Label htmlFor="insumo_id">
                Insumo <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.insumo_id}
                onValueChange={(value) => setFormData({ ...formData, insumo_id: value })}
                disabled={Boolean(editingProducto)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar insumo" />
                </SelectTrigger>
                <SelectContent>
                  {insumosData?.items.map((insumo) => (
                    <SelectItem key={insumo.id} value={insumo.id}>
                      {insumo.codigo} - {insumo.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Código proveedor */}
              <div className="space-y-2">
                <Label htmlFor="codigo_proveedor">Código del Proveedor</Label>
                <Input
                  id="codigo_proveedor"
                  value={formData.codigo_proveedor}
                  onChange={(e) => setFormData({ ...formData, codigo_proveedor: e.target.value })}
                  placeholder="SKU del proveedor"
                />
              </div>

              {/* Nombre proveedor */}
              <div className="space-y-2">
                <Label htmlFor="nombre_proveedor">Nombre del Proveedor</Label>
                <Input
                  id="nombre_proveedor"
                  value={formData.nombre_proveedor}
                  onChange={(e) => setFormData({ ...formData, nombre_proveedor: e.target.value })}
                  placeholder="Nombre que usa el proveedor"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Precio */}
              <div className="space-y-2">
                <Label htmlFor="precio_unitario">
                  Precio <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="precio_unitario"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.precio_unitario}
                  onChange={(e) => setFormData({ ...formData, precio_unitario: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              {/* Moneda */}
              <div className="space-y-2">
                <Label htmlFor="moneda">Moneda</Label>
                <Select
                  value={formData.moneda}
                  onValueChange={(value) => setFormData({ ...formData, moneda: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* IVA */}
              <div className="space-y-2">
                <Label>Precio con IVA</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={formData.precio_con_iva}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, precio_con_iva: checked })
                    }
                  />
                  <span className="text-sm">{formData.precio_con_iva ? 'Sí' : 'No'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Unidad compra */}
              <div className="space-y-2">
                <Label htmlFor="unidad_compra">Unidad de Compra</Label>
                <Input
                  id="unidad_compra"
                  value={formData.unidad_compra}
                  onChange={(e) => setFormData({ ...formData, unidad_compra: e.target.value })}
                  placeholder="Caja, Bidón..."
                />
              </div>

              {/* Factor conversión */}
              <div className="space-y-2">
                <Label htmlFor="factor_conversion">Factor Conversión</Label>
                <Input
                  id="factor_conversion"
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={formData.factor_conversion}
                  onChange={(e) => setFormData({ ...formData, factor_conversion: e.target.value })}
                />
              </div>

              {/* Cantidad mínima */}
              <div className="space-y-2">
                <Label htmlFor="cantidad_minima">Cantidad Mínima</Label>
                <Input
                  id="cantidad_minima"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cantidad_minima}
                  onChange={(e) => setFormData({ ...formData, cantidad_minima: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Fecha precio */}
              <div className="space-y-2">
                <Label htmlFor="fecha_precio">Fecha del Precio</Label>
                <Input
                  id="fecha_precio"
                  type="date"
                  value={formData.fecha_precio}
                  onChange={(e) => setFormData({ ...formData, fecha_precio: e.target.value })}
                />
              </div>

              {/* Vencimiento precio */}
              <div className="space-y-2">
                <Label htmlFor="fecha_vencimiento_precio">Vencimiento del Precio</Label>
                <Input
                  id="fecha_vencimiento_precio"
                  type="date"
                  value={formData.fecha_vencimiento_precio}
                  onChange={(e) =>
                    setFormData({ ...formData, fecha_vencimiento_precio: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Es preferido */}
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.es_preferido}
                onCheckedChange={(checked) => setFormData({ ...formData, es_preferido: checked })}
              />
              <Label>Marcar como proveedor preferido para este insumo</Label>
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Notas adicionales..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingProducto ? 'Guardar Cambios' : 'Agregar Producto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Actualizar Precio */}
      <Dialog open={isPriceDialogOpen} onOpenChange={setIsPriceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actualizar Precio</DialogTitle>
            <DialogDescription>
              Actualiza el precio de {editingProducto?.insumo_nombre}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitPrice} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_precio">
                Nuevo Precio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new_precio"
                type="number"
                step="0.01"
                min="0"
                value={priceData.precio_unitario}
                onChange={(e) => setPriceData({ ...priceData, precio_unitario: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new_fecha_precio">Fecha del Precio</Label>
                <Input
                  id="new_fecha_precio"
                  type="date"
                  value={priceData.fecha_precio}
                  onChange={(e) => setPriceData({ ...priceData, fecha_precio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_fecha_vencimiento">Vencimiento</Label>
                <Input
                  id="new_fecha_vencimiento"
                  type="date"
                  value={priceData.fecha_vencimiento_precio}
                  onChange={(e) =>
                    setPriceData({ ...priceData, fecha_vencimiento_precio: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="documento_referencia">Documento de Referencia</Label>
              <Input
                id="documento_referencia"
                value={priceData.documento_referencia}
                onChange={(e) =>
                  setPriceData({ ...priceData, documento_referencia: e.target.value })
                }
                placeholder="N° de cotización, factura..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_notas">Notas</Label>
              <Textarea
                id="price_notas"
                value={priceData.notas}
                onChange={(e) => setPriceData({ ...priceData, notas: e.target.value })}
                placeholder="Motivo del cambio..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPriceDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updatePriceMutation.isPending}>
                {updatePriceMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Actualizar Precio
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog Eliminar */}
      <AlertDialog open={!!deleteProducto} onOpenChange={() => setDeleteProducto(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              El producto "{deleteProducto?.insumo_nombre}" será desactivado del catálogo de este
              proveedor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
