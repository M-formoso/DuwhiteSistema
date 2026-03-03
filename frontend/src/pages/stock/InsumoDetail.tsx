/**
 * Detalle de Insumo
 */

import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Pencil,
  Package,
  MapPin,
  Calendar,
  DollarSign,
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Building2,
  Tag,
  BarChart3,
  Clock,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
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

import { stockService } from '@/services/stockService';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/utils/formatters';
import type { TipoMovimiento } from '@/types/stock';

const TIPO_MOVIMIENTO_CONFIG: Record<TipoMovimiento, { label: string; color: string; icon: React.ElementType }> = {
  entrada: { label: 'Entrada', color: 'bg-green-100 text-green-700', icon: TrendingUp },
  salida: { label: 'Salida', color: 'bg-red-100 text-red-700', icon: TrendingDown },
  ajuste_positivo: { label: 'Ajuste (+)', color: 'bg-blue-100 text-blue-700', icon: TrendingUp },
  ajuste_negativo: { label: 'Ajuste (-)', color: 'bg-orange-100 text-orange-700', icon: TrendingDown },
  transferencia: { label: 'Transferencia', color: 'bg-purple-100 text-purple-700', icon: ArrowUpDown },
};

export default function InsumoDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  // Cargar insumo
  const { data: insumo, isLoading, error } = useQuery({
    queryKey: ['insumo', id],
    queryFn: () => stockService.getInsumo(id!),
    enabled: Boolean(id),
  });

  // Cargar movimientos
  const { data: movimientosData } = useQuery({
    queryKey: ['insumo-movimientos', id],
    queryFn: () => stockService.getMovimientosInsumo(id!, { limit: 20 }),
    enabled: Boolean(id),
  });

  // Cargar resumen
  const { data: resumen } = useQuery({
    queryKey: ['insumo-resumen', id],
    queryFn: () => stockService.getResumenMovimientos(id!),
    enabled: Boolean(id),
  });

  const movimientos = movimientosData?.items || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !insumo) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <p>No se encontró el insumo</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/stock/insumos')}>
          Volver a Stock
        </Button>
      </div>
    );
  }

  // Determinar el estado del stock
  const getStockStatus = () => {
    if (insumo.sin_stock) return { label: 'Sin Stock', color: 'bg-red-100 text-red-700' };
    if (insumo.stock_bajo) return { label: 'Stock Bajo', color: 'bg-yellow-100 text-yellow-700' };
    if (insumo.sobrestock) return { label: 'Sobrestock', color: 'bg-orange-100 text-orange-700' };
    return { label: 'Normal', color: 'bg-green-100 text-green-700' };
  };

  const stockStatus = getStockStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/stock/insumos')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{insumo.nombre}</h1>
              <Badge className={stockStatus.color}>{stockStatus.label}</Badge>
              {insumo.proximo_a_vencer && (
                <Badge className="bg-red-100 text-red-700">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Próximo a vencer
                </Badge>
              )}
            </div>
            <p className="text-gray-500 font-mono">{insumo.codigo}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/stock/insumos/${id}/ajuste`)}
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Ajustar Stock
          </Button>
          <Button onClick={() => navigate(`/stock/insumos/${id}/editar`)}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Stock Actual */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stock Actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatNumber(insumo.stock_actual, 2)}
            </div>
            <p className="text-sm text-muted-foreground">{insumo.unidad}</p>
          </CardContent>
        </Card>

        {/* Stock Mínimo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stock Mínimo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatNumber(insumo.stock_minimo, 2)}</div>
            <p className="text-sm text-muted-foreground">{insumo.unidad}</p>
          </CardContent>
        </Card>

        {/* Valor en Stock */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor en Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(insumo.valor_stock)}</div>
            <p className="text-sm text-muted-foreground">
              Costo unit.: {formatCurrency(insumo.precio_unitario_costo || 0)}
            </p>
          </CardContent>
        </Card>

        {/* Movimientos del Mes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Movimientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{resumen?.cantidad_movimientos || 0}</div>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span className="text-green-600">+{formatNumber(resumen?.total_entradas || 0, 0)}</span>
              <span className="text-red-600">-{formatNumber(resumen?.total_salidas || 0, 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Información General */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Información General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Código:</span>
              <span className="font-mono">{insumo.codigo}</span>
            </div>
            {insumo.codigo_barras && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Código Barras:</span>
                <span className="font-mono">{insumo.codigo_barras}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unidad:</span>
              <span>{insumo.unidad}</span>
            </div>
            {insumo.categoria_nombre && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Categoría:</span>
                <Badge variant="outline">{insumo.categoria_nombre}</Badge>
              </div>
            )}
            {insumo.subcategoria && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subcategoría:</span>
                <span>{insumo.subcategoria}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Niveles de Stock */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Niveles de Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stock Actual:</span>
              <span className="font-bold">{formatNumber(insumo.stock_actual, 2)} {insumo.unidad}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stock Mínimo:</span>
              <span>{formatNumber(insumo.stock_minimo, 2)} {insumo.unidad}</span>
            </div>
            {insumo.stock_maximo && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stock Máximo:</span>
                <span>{formatNumber(insumo.stock_maximo, 2)} {insumo.unidad}</span>
              </div>
            )}
            {/* Barra de progreso visual */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0</span>
                <span>Mín: {formatNumber(insumo.stock_minimo, 0)}</span>
                {insumo.stock_maximo && <span>Máx: {formatNumber(insumo.stock_maximo, 0)}</span>}
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    insumo.sin_stock
                      ? 'bg-red-500'
                      : insumo.stock_bajo
                      ? 'bg-yellow-500'
                      : insumo.sobrestock
                      ? 'bg-orange-500'
                      : 'bg-green-500'
                  }`}
                  style={{
                    width: `${Math.min(
                      (insumo.stock_actual / (insumo.stock_maximo || insumo.stock_minimo * 3)) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Información Adicional */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Información Adicional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {insumo.ubicacion_deposito && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Ubicación:</p>
                  <p>{insumo.ubicacion_deposito}</p>
                </div>
              </div>
            )}
            {insumo.fecha_vencimiento && (
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Vencimiento:</p>
                  <p className={insumo.proximo_a_vencer ? 'text-red-600 font-medium' : ''}>
                    {formatDate(insumo.fecha_vencimiento)}
                  </p>
                </div>
              </div>
            )}
            {insumo.proveedor_nombre && (
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Proveedor Habitual:</p>
                  <p>{insumo.proveedor_nombre}</p>
                </div>
              </div>
            )}
            {insumo.precio_promedio_ponderado && (
              <div className="flex items-start gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Precio Promedio:</p>
                  <p>{formatCurrency(insumo.precio_promedio_ponderado)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notas */}
      {insumo.notas && (
        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{insumo.notas}</p>
          </CardContent>
        </Card>
      )}

      {/* Últimos Movimientos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Últimos Movimientos
          </CardTitle>
          <CardDescription>
            Historial de entradas, salidas y ajustes de stock
          </CardDescription>
        </CardHeader>
        <CardContent>
          {movimientos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay movimientos registrados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Stock Anterior</TableHead>
                  <TableHead className="text-right">Stock Posterior</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimientos.map((mov) => {
                  const config = TIPO_MOVIMIENTO_CONFIG[mov.tipo];
                  const Icon = config.icon;
                  return (
                    <TableRow key={mov.id}>
                      <TableCell className="text-sm">
                        {formatDateTime(mov.fecha_movimiento)}
                      </TableCell>
                      <TableCell>
                        <Badge className={config.color}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm capitalize">
                        {mov.origen?.replace(/_/g, ' ') || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <span
                          className={
                            mov.tipo === 'entrada' || mov.tipo === 'ajuste_positivo'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }
                        >
                          {mov.tipo === 'entrada' || mov.tipo === 'ajuste_positivo' ? '+' : '-'}
                          {formatNumber(mov.cantidad, 2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatNumber(mov.stock_anterior, 2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(mov.stock_posterior, 2)}
                      </TableCell>
                      <TableCell className="text-sm">{mov.usuario_nombre || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Información del Sistema */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <div>
              <span>Creado:</span>{' '}
              <span className="text-foreground">{formatDateTime(insumo.created_at)}</span>
            </div>
            {insumo.updated_at && (
              <div>
                <span>Última actualización:</span>{' '}
                <span className="text-foreground">{formatDateTime(insumo.updated_at)}</span>
              </div>
            )}
            <div>
              <span>Estado:</span>{' '}
              <span className={insumo.is_active ? 'text-green-600' : 'text-red-600'}>
                {insumo.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
