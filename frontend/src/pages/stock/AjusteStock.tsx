/**
 * Página de Ajuste de Stock
 * Permite realizar ajustes de inventario por insumo
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  Plus,
  Minus,
  Save,
  AlertTriangle,
  Info,
  History,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

import { stockService } from '@/services/stockService';
import type { Insumo } from '@/types/stock';

type TipoAjuste = 'positivo' | 'negativo' | 'reemplazo';

const MOTIVOS_AJUSTE = [
  { value: 'conteo_fisico', label: 'Diferencia en conteo físico' },
  { value: 'merma', label: 'Merma o pérdida' },
  { value: 'vencimiento', label: 'Producto vencido' },
  { value: 'rotura', label: 'Rotura o daño' },
  { value: 'devolucion_interna', label: 'Devolución interna' },
  { value: 'error_sistema', label: 'Corrección de error en sistema' },
  { value: 'otro', label: 'Otro motivo' },
];

export default function AjusteStock() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [insumo, setInsumo] = useState<Insumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Formulario
  const [tipoAjuste, setTipoAjuste] = useState<TipoAjuste>('positivo');
  const [cantidad, setCantidad] = useState<string>('');
  const [nuevoStock, setNuevoStock] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [motivoDetalle, setMotivoDetalle] = useState<string>('');
  const [numeroLote, setNumeroLote] = useState<string>('');
  const [fechaVencimiento, setFechaVencimiento] = useState<string>('');

  // Cargar insumo
  useEffect(() => {
    const cargarInsumo = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await stockService.getInsumo(id);
        setInsumo(data);
        setNuevoStock(data.stock_actual.toString());
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudo cargar el insumo',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    cargarInsumo();
  }, [id, toast]);

  // Parsear cantidad de forma robusta (soporta coma o punto decimal)
  const parsearCantidad = (valor: string): number => {
    if (!valor || valor.trim() === '') return 0;
    // Reemplazar coma por punto para manejar locale argentino
    const valorNormalizado = valor.replace(',', '.');
    const num = parseFloat(valorNormalizado);
    return isNaN(num) ? 0 : num;
  };

  // Calcular stock resultante
  const calcularStockResultante = (): number => {
    if (!insumo) return 0;

    if (tipoAjuste === 'reemplazo') {
      return parsearCantidad(nuevoStock);
    }

    const cantidadNum = parsearCantidad(cantidad);
    if (tipoAjuste === 'positivo') {
      return insumo.stock_actual + cantidadNum;
    } else {
      return Math.max(0, insumo.stock_actual - cantidadNum);
    }
  };

  const stockResultante = Math.round(calcularStockResultante() * 100) / 100;
  const diferencia = insumo ? Math.round((stockResultante - insumo.stock_actual) * 100) / 100 : 0;

  // Validaciones
  const validarFormulario = (): boolean => {
    if (!motivo) {
      toast({
        title: 'Error de validación',
        description: 'Debe seleccionar un motivo para el ajuste',
        variant: 'destructive',
      });
      return false;
    }

    if (tipoAjuste === 'reemplazo') {
      if (!nuevoStock || parseFloat(nuevoStock) < 0) {
        toast({
          title: 'Error de validación',
          description: 'Ingrese un stock válido (mayor o igual a 0)',
          variant: 'destructive',
        });
        return false;
      }
    } else {
      if (!cantidad || parseFloat(cantidad) <= 0) {
        toast({
          title: 'Error de validación',
          description: 'Ingrese una cantidad válida mayor a 0',
          variant: 'destructive',
        });
        return false;
      }

      if (tipoAjuste === 'negativo' && insumo && parseFloat(cantidad) > insumo.stock_actual) {
        toast({
          title: 'Error de validación',
          description: 'La cantidad a descontar no puede ser mayor al stock actual',
          variant: 'destructive',
        });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validarFormulario() || !insumo) return;

    setSaving(true);
    try {
      const motivoCompleto = `${MOTIVOS_AJUSTE.find(m => m.value === motivo)?.label}${motivoDetalle ? `: ${motivoDetalle}` : ''}`;

      // Asegurar que la cantidad sea un número válido
      const cantidadAjuste = Number(diferencia);
      if (isNaN(cantidadAjuste) || cantidadAjuste === 0) {
        toast({
          title: 'Error',
          description: 'La cantidad de ajuste no es válida',
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }

      await stockService.ajustarStock(insumo.id, {
        insumo_id: insumo.id,
        cantidad: cantidadAjuste,
        motivo: motivoCompleto,
        numero_lote: numeroLote || null,
        fecha_vencimiento: fechaVencimiento || null,
      });

      toast({
        title: 'Ajuste realizado',
        description: `El stock de ${insumo.nombre} se actualizó de ${insumo.stock_actual} a ${stockResultante} ${insumo.unidad}`,
      });

      navigate(`/stock/insumos/${insumo.id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo realizar el ajuste de stock',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!insumo) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-lg font-medium">Insumo no encontrado</h2>
        <p className="text-muted-foreground mt-2">El insumo solicitado no existe</p>
        <Button asChild className="mt-4">
          <Link to="/stock/insumos">Volver a Insumos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/stock/insumos/${insumo.id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ajuste de Stock</h1>
          <p className="text-gray-500">
            {insumo.codigo} - {insumo.nombre}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formulario de ajuste */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info actual */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-5 w-5" />
                Stock Actual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold text-gray-900">
                    {insumo.stock_actual.toLocaleString('es-AR')}
                  </p>
                  <p className="text-sm text-muted-foreground">{insumo.unidad}</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-lg font-medium text-gray-600">
                    Mínimo: {insumo.stock_minimo}
                  </p>
                  <p className="text-sm text-muted-foreground">Stock mínimo</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-lg font-medium text-gray-600">
                    Máximo: {insumo.stock_maximo || 'N/A'}
                  </p>
                  <p className="text-sm text-muted-foreground">Stock máximo</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tipo de ajuste */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tipo de Ajuste</CardTitle>
              <CardDescription>
                Selecciona cómo deseas ajustar el stock
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <Button
                  variant={tipoAjuste === 'positivo' ? 'default' : 'outline'}
                  className={cn(
                    'h-auto py-4 flex-col gap-2',
                    tipoAjuste === 'positivo' && 'bg-green-600 hover:bg-green-700'
                  )}
                  onClick={() => {
                    setTipoAjuste('positivo');
                    setCantidad('');
                  }}
                >
                  <Plus className="h-6 w-6" />
                  <span>Agregar Stock</span>
                </Button>
                <Button
                  variant={tipoAjuste === 'negativo' ? 'default' : 'outline'}
                  className={cn(
                    'h-auto py-4 flex-col gap-2',
                    tipoAjuste === 'negativo' && 'bg-red-600 hover:bg-red-700'
                  )}
                  onClick={() => {
                    setTipoAjuste('negativo');
                    setCantidad('');
                  }}
                >
                  <Minus className="h-6 w-6" />
                  <span>Descontar Stock</span>
                </Button>
                <Button
                  variant={tipoAjuste === 'reemplazo' ? 'default' : 'outline'}
                  className={cn(
                    'h-auto py-4 flex-col gap-2',
                    tipoAjuste === 'reemplazo' && 'bg-blue-600 hover:bg-blue-700'
                  )}
                  onClick={() => {
                    setTipoAjuste('reemplazo');
                    setNuevoStock(insumo.stock_actual.toString());
                  }}
                >
                  <History className="h-6 w-6" />
                  <span>Reemplazar Stock</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cantidad */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cantidad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tipoAjuste === 'reemplazo' ? (
                <div className="space-y-2">
                  <Label>Nuevo stock total</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={nuevoStock}
                      onChange={(e) => setNuevoStock(e.target.value)}
                      className="text-lg"
                      placeholder="0"
                    />
                    <span className="text-muted-foreground w-20">{insumo.unidad}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>
                    Cantidad a {tipoAjuste === 'positivo' ? 'agregar' : 'descontar'}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      className="text-lg"
                      placeholder="0"
                    />
                    <span className="text-muted-foreground w-20">{insumo.unidad}</span>
                  </div>
                </div>
              )}

              {/* Preview del resultado */}
              {(cantidad || (tipoAjuste === 'reemplazo' && nuevoStock !== insumo.stock_actual.toString())) && (
                <Alert className={cn(
                  diferencia > 0 && 'border-green-500 bg-green-50',
                  diferencia < 0 && 'border-red-500 bg-red-50',
                  diferencia === 0 && 'border-gray-300'
                )}>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Resultado del ajuste</AlertTitle>
                  <AlertDescription>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-medium">{insumo.stock_actual}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-bold text-lg">{stockResultante.toLocaleString('es-AR')}</span>
                      <span className="text-muted-foreground">{insumo.unidad}</span>
                      {diferencia !== 0 && (
                        <Badge className={cn(
                          'ml-2',
                          diferencia > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        )}>
                          {diferencia > 0 ? '+' : ''}{diferencia.toLocaleString('es-AR')}
                        </Badge>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Motivo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Motivo del Ajuste</CardTitle>
              <CardDescription>
                Documenta la razón del ajuste para mantener trazabilidad
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Motivo *</Label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_AJUSTE.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Observaciones adicionales</Label>
                <Textarea
                  value={motivoDetalle}
                  onChange={(e) => setMotivoDetalle(e.target.value)}
                  placeholder="Describa con más detalle el motivo del ajuste..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Datos adicionales */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información Adicional</CardTitle>
              <CardDescription>Opcional: datos de lote y vencimiento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Número de Lote</Label>
                  <Input
                    value={numeroLote}
                    onChange={(e) => setNumeroLote(e.target.value)}
                    placeholder="Ej: LOTE-2025-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de Vencimiento</Label>
                  <Input
                    type="date"
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel lateral */}
        <div className="space-y-6">
          {/* Resumen */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen del Ajuste</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Insumo:</span>
                  <span className="font-medium">{insumo.codigo}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Stock actual:</span>
                  <span>{insumo.stock_actual} {insumo.unidad}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tipo de ajuste:</span>
                  <Badge variant="outline" className={cn(
                    tipoAjuste === 'positivo' && 'border-green-500 text-green-700',
                    tipoAjuste === 'negativo' && 'border-red-500 text-red-700',
                    tipoAjuste === 'reemplazo' && 'border-blue-500 text-blue-700'
                  )}>
                    {tipoAjuste === 'positivo' && 'Agregar'}
                    {tipoAjuste === 'negativo' && 'Descontar'}
                    {tipoAjuste === 'reemplazo' && 'Reemplazar'}
                  </Badge>
                </div>
                {diferencia !== 0 && (
                  <>
                    <div className="border-t pt-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Diferencia:</span>
                        <span className={cn(
                          'font-medium',
                          diferencia > 0 ? 'text-green-600' : 'text-red-600'
                        )}>
                          {diferencia > 0 ? '+' : ''}{diferencia.toLocaleString('es-AR')} {insumo.unidad}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-muted-foreground">Stock resultante:</span>
                        <span className="font-bold">{stockResultante.toLocaleString('es-AR')} {insumo.unidad}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Alertas */}
              {stockResultante < insumo.stock_minimo && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    El stock quedará por debajo del mínimo ({insumo.stock_minimo} {insumo.unidad})
                  </AlertDescription>
                </Alert>
              )}

              {insumo.stock_maximo && stockResultante > insumo.stock_maximo && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    El stock superará el máximo ({insumo.stock_maximo} {insumo.unidad})
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Acciones */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={saving || diferencia === 0}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Confirmar Ajuste
                  </>
                )}
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link to={`/stock/insumos/${insumo.id}`}>
                  Cancelar
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Registro de movimientos</AlertTitle>
            <AlertDescription className="text-xs">
              Todos los ajustes quedan registrados en el historial de movimientos
              del insumo con el usuario y fecha correspondiente.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
