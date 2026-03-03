/**
 * Página Principal de Costos
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Users,
  Package,
  Wallet,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

import {
  costosService,
  CATEGORIAS_COSTO,
  type CostoFijo,
  type CostoVariable,
} from '@/services/costosService';
import { formatCurrency, formatNumber } from '@/utils/formatters';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function CostosPage() {
  const today = new Date();
  const [mes, setMes] = useState(today.getMonth() + 1);
  const [anio, setAnio] = useState(today.getFullYear());

  // Query resumen del mes
  const { data: resumen, isLoading: loadingResumen } = useQuery({
    queryKey: ['costos-resumen', mes, anio],
    queryFn: () => costosService.getResumenCostosMes(mes, anio),
  });

  // Query costos fijos
  const { data: costosFijosData, isLoading: loadingFijos } = useQuery({
    queryKey: ['costos-fijos'],
    queryFn: () => costosService.getCostosFijos({ solo_vigentes: true, limit: 50 }),
  });

  // Query costos variables
  const { data: costosVariablesData, isLoading: loadingVariables } = useQuery({
    queryKey: ['costos-variables'],
    queryFn: () => costosService.getCostosVariables({ limit: 50 }),
  });

  // Query rentabilidad clientes
  const { data: rentabilidad, isLoading: loadingRentabilidad } = useQuery({
    queryKey: ['rentabilidad-clientes'],
    queryFn: () => costosService.getRentabilidadClientes({ limit: 10 }),
  });

  const costosFijos = costosFijosData?.items || [];
  const costosVariables = costosVariablesData?.items || [];

  const getCategoriaLabel = (value: string) => {
    return CATEGORIAS_COSTO.find((c) => c.value === value)?.label || value;
  };

  // Calcular totales por categoría para gráfico
  const costosFijosPorCategoria = costosFijos.reduce((acc, c) => {
    acc[c.categoria] = (acc[c.categoria] || 0) + c.monto_mensual;
    return acc;
  }, {} as Record<string, number>);

  const totalCostosFijos = costosFijos.reduce((sum, c) => sum + c.monto_mensual, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Análisis de Costos</h1>
          <p className="text-gray-500">Gestión y análisis de costos de operación</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={mes.toString()} onValueChange={(v) => setMes(parseInt(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={anio.toString()} onValueChange={(v) => setAnio(parseInt(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map((a) => (
                <SelectItem key={a} value={a.toString()}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      {loadingResumen ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : resumen ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Costos Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(resumen.total_costos_fijos + resumen.total_costos_variables)}
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                <span>Fijos: {formatCurrency(resumen.total_costos_fijos)}</span>
                <span>|</span>
                <span>Variables: {formatCurrency(resumen.total_costos_variables)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(resumen.total_ingresos)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {MESES[mes - 1]} {anio}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Margen Bruto</CardTitle>
              {resumen.margen_porcentaje >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  resumen.margen_porcentaje >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatNumber(resumen.margen_porcentaje, 1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(resumen.margen_bruto)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Costo por Kg</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(resumen.costo_promedio_por_kg)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatNumber(resumen.total_kg_procesados, 0)} kg procesados
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Tabs de Contenido */}
      <Tabs defaultValue="fijos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fijos">Costos Fijos</TabsTrigger>
          <TabsTrigger value="variables">Costos Variables</TabsTrigger>
          <TabsTrigger value="rentabilidad">Rentabilidad</TabsTrigger>
        </TabsList>

        {/* Costos Fijos */}
        <TabsContent value="fijos" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Tabla de Costos Fijos */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Costos Fijos Vigentes
                </CardTitle>
                <CardDescription>
                  Costos que no varían con el volumen de producción
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingFijos ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : costosFijos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No hay costos fijos registrados</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Monto Mensual</TableHead>
                        <TableHead className="text-right">Costo Diario</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costosFijos.map((costo) => (
                        <TableRow key={costo.id}>
                          <TableCell className="font-medium">{costo.nombre}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getCategoriaLabel(costo.categoria)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(costo.monto_mensual)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(costo.costo_diario || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell colSpan={2}>Total</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(totalCostosFijos)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(totalCostosFijos / 30)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Distribución por Categoría */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Por Categoría
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(costosFijosPorCategoria)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, monto]) => {
                    const porcentaje = (monto / totalCostosFijos) * 100;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{getCategoriaLabel(cat)}</span>
                          <span className="font-medium">{formatCurrency(monto)}</span>
                        </div>
                        <Progress value={porcentaje} className="h-2" />
                        <p className="text-xs text-muted-foreground text-right">
                          {formatNumber(porcentaje, 1)}%
                        </p>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Costos Variables */}
        <TabsContent value="variables" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Costos Variables
              </CardTitle>
              <CardDescription>
                Costos que varían según el volumen de producción
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingVariables ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : costosVariables.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay costos variables registrados</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Costo por Unidad</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead className="text-right">Consumo/Kg</TableHead>
                      <TableHead className="text-right">Costo/Kg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costosVariables.map((costo) => (
                      <TableRow key={costo.id}>
                        <TableCell className="font-medium">
                          <div>
                            {costo.nombre}
                            {costo.insumo_nombre && (
                              <span className="text-xs text-muted-foreground block">
                                Insumo: {costo.insumo_nombre}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getCategoriaLabel(costo.categoria)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(costo.costo_por_unidad)}
                        </TableCell>
                        <TableCell>{costo.unidad_medida}</TableCell>
                        <TableCell className="text-right">
                          {costo.consumo_por_kg
                            ? `${formatNumber(costo.consumo_por_kg, 3)}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {costo.costo_por_kg
                            ? formatCurrency(costo.costo_por_kg)
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rentabilidad */}
        <TabsContent value="rentabilidad" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Rentabilidad por Cliente
              </CardTitle>
              <CardDescription>
                Análisis de margen por cliente (Top 10)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRentabilidad ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : !rentabilidad || rentabilidad.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay datos de rentabilidad disponibles</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-center">Pedidos</TableHead>
                      <TableHead className="text-right">Kg Procesados</TableHead>
                      <TableHead className="text-right">Costo Total</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                      <TableHead className="text-right">Margen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rentabilidad.map((r) => (
                      <TableRow key={r.cliente_id}>
                        <TableCell className="font-medium">{r.cliente_nombre}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{r.cantidad_pedidos}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(r.kg_procesados, 0)} kg
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {formatCurrency(r.costo_total)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(r.ingreso_total)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span
                              className={`font-medium ${
                                r.margen_porcentaje >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {formatNumber(r.margen_porcentaje, 1)}%
                            </span>
                            {r.margen_porcentaje >= 20 ? (
                              <ArrowUpRight className="h-4 w-4 text-green-500" />
                            ) : r.margen_porcentaje >= 0 ? (
                              <TrendingUp className="h-4 w-4 text-yellow-500" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
