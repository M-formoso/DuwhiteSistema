/**
 * Página de Conteo y Finalización de Lotes
 * Última posta del proceso de producción
 * - Conteo de prendas por producto
 * - Cálculo de precios desde lista del cliente
 * - Generación de remito
 * - Opción de relevado parcial
 * - Cargo a cuenta corriente
 */

import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Scale,
  Package,
  Calculator,
  FileText,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Plus,
  Minus,
  Loader2,
  User,
  Clock,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { toast } from 'sonner';
import { produccionService } from '@/services/produccionService';
import { productoLavadoService } from '@/services/productoLavadoService';
import { remitoService } from '@/services/remitoService';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import {
  ProductoConPrecio,
  CATEGORIAS_PRODUCTO_LAVADO,
} from '@/types/produccion-v2';

interface ConteoItem {
  producto_id: string;
  producto_codigo: string;
  producto_nombre: string;
  categoria: string;
  precio_unitario: number;
  cantidad: number;
  cantidad_relevado: number;
  subtotal: number;
}

export default function ConteoFinalizacionPage() {
  const { id: loteId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Estados
  const [conteoItems, setConteoItems] = useState<ConteoItem[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [tieneRelevado, setTieneRelevado] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showRelevadoInfo, setShowRelevadoInfo] = useState(false);

  // Query: Datos del lote
  const { data: lote, isLoading: loadingLote } = useQuery({
    queryKey: ['lote', loteId],
    queryFn: () => produccionService.getLote(loteId!),
    enabled: !!loteId,
  });

  // Query: Productos con precios del cliente
  const { data: productosConPrecios, isLoading: loadingProductos } = useQuery<ProductoConPrecio[]>({
    queryKey: ['productos-con-precios', lote?.cliente_id],
    queryFn: async () => {
      if (!lote?.cliente_id) return [];
      // Obtener la lista de precios del cliente y cargar productos
      const clienteResponse = await fetch(`/api/v1/clientes/${lote.cliente_id}`);
      const cliente = await clienteResponse.json();
      if (!cliente.lista_precios_id) return [];
      return productoLavadoService.getProductosConPrecios(cliente.lista_precios_id);
    },
    enabled: !!lote?.cliente_id,
  });

  // Inicializar items de conteo cuando se cargan los productos
  useEffect(() => {
    if (productosConPrecios && productosConPrecios.length > 0 && conteoItems.length === 0) {
      setConteoItems(
        productosConPrecios.map((p) => ({
          producto_id: p.producto_id,
          producto_codigo: p.producto_codigo,
          producto_nombre: p.producto_nombre,
          categoria: p.categoria,
          precio_unitario: p.precio_unitario || 0,
          cantidad: 0,
          cantidad_relevado: 0,
          subtotal: 0,
        }))
      );
    }
  }, [productosConPrecios, conteoItems.length]);

  // Mutation: Generar remito
  const generarRemitoMutation = useMutation({
    mutationFn: async () => {
      if (!loteId) throw new Error('No hay lote');

      const itemsConCantidad = conteoItems.filter((item) => item.cantidad > 0);

      return remitoService.generarDesdeLote(loteId, {
        observaciones: observaciones || undefined,
        items: itemsConCantidad.map((item) => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
        })),
        generar_relevado: tieneRelevado,
        items_relevado: tieneRelevado
          ? conteoItems
              .filter((item) => item.cantidad_relevado > 0)
              .map((item) => ({
                producto_id: item.producto_id,
                cantidad: item.cantidad_relevado,
              }))
          : undefined,
      });
    },
    onSuccess: (response) => {
      toast.success('Remito generado correctamente');
      queryClient.invalidateQueries({ queryKey: ['lote', loteId] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });

      if (response.lote_relevado_id) {
        toast.info(`Se creó lote de relevado: ${response.lote_relevado_numero}`);
      }

      // Navegar al detalle del remito o volver al kanban
      navigate(`/produccion`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al generar remito');
    },
  });

  // Calcular totales
  const totales = useMemo(() => {
    const totalUnidades = conteoItems.reduce((sum, item) => sum + item.cantidad, 0);
    const totalRelevado = conteoItems.reduce((sum, item) => sum + item.cantidad_relevado, 0);
    const totalMonto = conteoItems.reduce(
      (sum, item) => sum + item.cantidad * item.precio_unitario,
      0
    );
    return { totalUnidades, totalRelevado, totalMonto };
  }, [conteoItems]);

  // Handlers
  const handleCantidadChange = (productoId: string, cantidad: number, esRelevado = false) => {
    setConteoItems((prev) =>
      prev.map((item) => {
        if (item.producto_id === productoId) {
          const newCantidad = esRelevado ? item.cantidad : Math.max(0, cantidad);
          const newCantidadRelevado = esRelevado
            ? Math.max(0, Math.min(cantidad, item.cantidad))
            : item.cantidad_relevado;
          return {
            ...item,
            cantidad: newCantidad,
            cantidad_relevado: newCantidadRelevado,
            subtotal: newCantidad * item.precio_unitario,
          };
        }
        return item;
      })
    );
  };

  const handleIncrement = (productoId: string, esRelevado = false) => {
    const item = conteoItems.find((i) => i.producto_id === productoId);
    if (!item) return;
    handleCantidadChange(
      productoId,
      esRelevado ? item.cantidad_relevado + 1 : item.cantidad + 1,
      esRelevado
    );
  };

  const handleDecrement = (productoId: string, esRelevado = false) => {
    const item = conteoItems.find((i) => i.producto_id === productoId);
    if (!item) return;
    handleCantidadChange(
      productoId,
      esRelevado ? item.cantidad_relevado - 1 : item.cantidad - 1,
      esRelevado
    );
  };

  const handleSubmit = () => {
    if (totales.totalUnidades === 0) {
      toast.error('Debe contar al menos una prenda');
      return;
    }
    setShowConfirmDialog(true);
  };

  const confirmarGeneracion = () => {
    setShowConfirmDialog(false);
    generarRemitoMutation.mutate();
  };

  // Agrupar items por categoría
  const itemsPorCategoria = useMemo(() => {
    return CATEGORIAS_PRODUCTO_LAVADO.map((cat) => ({
      ...cat,
      items: conteoItems.filter((item) => item.categoria === cat.value),
    })).filter((cat) => cat.items.length > 0);
  }, [conteoItems]);

  if (loadingLote || loadingProductos) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lote) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600">Lote no encontrado</p>
        <Button className="mt-4" onClick={() => navigate('/produccion')}>
          Volver al Kanban
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="h-6 w-6" />
              Conteo y Finalización
            </h1>
            <p className="text-gray-500 text-sm">
              Lote {lote.numero} - {lote.cliente_nombre}
            </p>
          </div>
        </div>
        <Badge
          variant={lote.tipo_lote === 'relevado' ? 'outline' : 'default'}
          className={lote.tipo_lote === 'relevado' ? 'bg-purple-100 text-purple-700' : ''}
        >
          {lote.tipo_lote === 'relevado' ? 'Relevado' : 'Normal'}
        </Badge>
      </div>

      {/* Info del lote */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="font-medium">{lote.cliente_nombre}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Peso Entrada</p>
                <p className="font-medium">{formatNumber(Number(lote.peso_entrada_kg), 2)} kg</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Ingreso</p>
                <p className="font-medium">
                  {new Date(lote.fecha_ingreso).toLocaleDateString('es-AR')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Canastos Usados</p>
                <p className="font-medium">{lote.canastos?.length || 0}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de conteo por categoría */}
      <div className="grid gap-4">
        {itemsPorCategoria.map((categoria) => (
          <Card key={categoria.value}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{categoria.label}</span>
                <Badge variant="outline">
                  {categoria.items.reduce((sum, item) => sum + item.cantidad, 0)} unidades
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="w-24 text-right">Precio</TableHead>
                    <TableHead className="w-40 text-center">Cantidad</TableHead>
                    {tieneRelevado && (
                      <TableHead className="w-40 text-center">Relevado</TableHead>
                    )}
                    <TableHead className="w-28 text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoria.items.map((item) => (
                    <TableRow key={item.producto_id}>
                      <TableCell className="font-mono text-xs">
                        {item.producto_codigo}
                      </TableCell>
                      <TableCell>{item.producto_nombre}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.precio_unitario)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDecrement(item.producto_id)}
                            disabled={item.cantidad === 0}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) =>
                              handleCantidadChange(
                                item.producto_id,
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-16 text-center"
                            min={0}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleIncrement(item.producto_id)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      {tieneRelevado && (
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 border-purple-300"
                              onClick={() => handleDecrement(item.producto_id, true)}
                              disabled={item.cantidad_relevado === 0}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              value={item.cantidad_relevado}
                              onChange={(e) =>
                                handleCantidadChange(
                                  item.producto_id,
                                  parseInt(e.target.value) || 0,
                                  true
                                )
                              }
                              className="w-16 text-center border-purple-300"
                              min={0}
                              max={item.cantidad}
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 border-purple-300"
                              onClick={() => handleIncrement(item.producto_id, true)}
                              disabled={item.cantidad_relevado >= item.cantidad}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.cantidad * item.precio_unitario)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Resumen y acciones */}
      <Card className="border-2 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Resumen del Conteo</span>
            <div className="flex items-center gap-2">
              <Checkbox
                id="relevado"
                checked={tieneRelevado}
                onCheckedChange={(checked) => {
                  setTieneRelevado(!!checked);
                  if (!checked) {
                    // Limpiar cantidades de relevado
                    setConteoItems((prev) =>
                      prev.map((item) => ({ ...item, cantidad_relevado: 0 }))
                    );
                  }
                }}
              />
              <Label
                htmlFor="relevado"
                className="text-sm font-normal flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4 text-purple-600" />
                Hay prendas para relevado
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="text-purple-600"
                onClick={() => setShowRelevadoInfo(true)}
              >
                <AlertTriangle className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600">Total Unidades</p>
              <p className="text-3xl font-bold text-blue-700">{totales.totalUnidades}</p>
            </div>
            {tieneRelevado && (
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-600">Para Relevado</p>
                <p className="text-3xl font-bold text-purple-700">{totales.totalRelevado}</p>
              </div>
            )}
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600">Total a Facturar</p>
              <p className="text-3xl font-bold text-green-700">
                {formatCurrency(totales.totalMonto)}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <Label>Observaciones del conteo</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas adicionales para el remito..."
              rows={2}
            />
          </div>

          <div className="flex gap-4">
            <Button
              className="flex-1"
              size="lg"
              onClick={handleSubmit}
              disabled={generarRemitoMutation.isPending || totales.totalUnidades === 0}
            >
              {generarRemitoMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Generar Remito y Finalizar
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de confirmación */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Generación de Remito</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Se generará un remito con los siguientes datos:</p>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p>
                    <strong>Total unidades:</strong> {totales.totalUnidades}
                  </p>
                  <p>
                    <strong>Total a facturar:</strong> {formatCurrency(totales.totalMonto)}
                  </p>
                  {tieneRelevado && totales.totalRelevado > 0 && (
                    <p className="text-purple-600">
                      <strong>Para relevado:</strong> {totales.totalRelevado} unidades
                      (se creará nuevo lote)
                    </p>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Esta acción generará un cargo en la cuenta corriente del cliente.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarGeneracion}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog info relevado */}
      <Dialog open={showRelevadoInfo} onOpenChange={setShowRelevadoInfo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-purple-600" />
              ¿Qué es el Relevado?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-gray-600">
            <p>
              El <strong>relevado</strong> permite enviar a re-lavar prendas que no quedaron
              correctamente en el primer proceso.
            </p>
            <p>Cuando marcas prendas para relevado:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Se genera un remito parcial con las prendas OK</li>
              <li>Se crea automáticamente un nuevo lote con las prendas marcadas</li>
              <li>El nuevo lote vuelve a la etapa de Lavado</li>
              <li>Al finalizar el relevado, se genera un remito complementario</li>
            </ul>
            <p className="text-purple-600 font-medium">
              El cliente solo paga una vez - el cargo se hace al entregar todas las prendas.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowRelevadoInfo(false)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
