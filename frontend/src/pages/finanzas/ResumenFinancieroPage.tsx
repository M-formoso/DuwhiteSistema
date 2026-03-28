/**
 * Página de Resumen Financiero
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  CreditCard,
  Calendar,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { finanzasService } from '@/services/finanzasService';
import { formatCurrency, formatDate, getLocalDateString } from '@/utils/formatters';
import type { ResumenFinanciero, CuentaBancaria } from '@/types/finanzas';

export default function ResumenFinancieroPage() {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [fechaDesde, setFechaDesde] = useState(getLocalDateString(firstDayOfMonth));
  const [fechaHasta, setFechaHasta] = useState(getLocalDateString(today));

  // Cargar resumen financiero
  const {
    data: resumen,
    isLoading: isLoadingResumen,
    refetch: refetchResumen,
  } = useQuery({
    queryKey: ['resumen-financiero', fechaDesde, fechaHasta],
    queryFn: () =>
      finanzasService.getResumenFinanciero({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      }),
  });

  // Cargar cuentas bancarias para mostrar saldos
  const { data: cuentas, isLoading: isLoadingCuentas } = useQuery({
    queryKey: ['cuentas-bancarias-resumen'],
    queryFn: () => finanzasService.getCuentasBancarias(true),
  });

  const handleFiltrar = () => {
    refetchResumen();
  };

  // Calcular totales de cuentas bancarias
  const totalBancario = cuentas?.reduce((sum, c) => sum + (c.saldo_actual || 0), 0) || 0;

  const isLoading = isLoadingResumen || isLoadingCuentas;

  // Datos del resumen con valores por defecto
  const ingresosCaja = resumen?.caja?.ingresos || 0;
  const egresosCaja = resumen?.caja?.egresos || 0;
  const saldoCaja = resumen?.caja?.saldo_actual || 0;
  const ingresosBanco = resumen?.bancos?.ingresos || 0;
  const egresosBanco = resumen?.bancos?.egresos || 0;

  const totalIngresos = ingresosCaja + ingresosBanco;
  const totalEgresos = egresosCaja + egresosBanco;
  const balanceNeto = totalIngresos - totalEgresos;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resumen Financiero</h1>
          <p className="text-gray-500">Vista consolidada de la situación financiera</p>
        </div>
      </div>

      {/* Filtros de Fecha */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha_desde">Desde</Label>
              <Input
                id="fecha_desde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha_hasta">Hasta</Label>
              <Input
                id="fecha_hasta"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={handleFiltrar}>
              <Calendar className="h-4 w-4 mr-2" />
              Filtrar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFechaDesde(getLocalDateString(firstDayOfMonth));
                setFechaHasta(getLocalDateString(today));
              }}
            >
              Este Mes
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Resumen Principal */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-green-100">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Ingresos</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(totalIngresos)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-red-100">
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Egresos</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(totalEgresos)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-full ${balanceNeto >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}
                  >
                    <BarChart3
                      className={`h-6 w-6 ${balanceNeto >= 0 ? 'text-blue-600' : 'text-orange-600'}`}
                    />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Balance Neto</p>
                    <p
                      className={`text-2xl font-bold ${balanceNeto >= 0 ? 'text-blue-600' : 'text-orange-600'}`}
                    >
                      {formatCurrency(balanceNeto)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <DollarSign className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Disponible Total</p>
                    <p className="text-2xl font-bold">{formatCurrency(saldoCaja + totalBancario)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detalle por Fuente */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Caja */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Caja
                </CardTitle>
                <CardDescription>Movimientos de efectivo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Saldo Actual</span>
                    <span
                      className={`text-xl font-bold ${saldoCaja >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {formatCurrency(saldoCaja)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowDownRight className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-700">Ingresos</span>
                      </div>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(ingresosCaja)}
                      </p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowUpRight className="h-4 w-4 text-red-600" />
                        <span className="text-sm text-red-700">Egresos</span>
                      </div>
                      <p className="text-xl font-bold text-red-600">{formatCurrency(egresosCaja)}</p>
                    </div>
                  </div>

                  {resumen?.caja?.movimientos_por_categoria && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Por Categoría
                      </p>
                      <div className="space-y-2">
                        {Object.entries(resumen.caja.movimientos_por_categoria).map(
                          ([categoria, monto]) => (
                            <div key={categoria} className="flex justify-between text-sm">
                              <span className="capitalize">{categoria.replace(/_/g, ' ')}</span>
                              <span className="font-medium">{formatCurrency(monto as number)}</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Bancos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Cuentas Bancarias
                </CardTitle>
                <CardDescription>Saldos y movimientos bancarios</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Saldo Total</span>
                    <span
                      className={`text-xl font-bold ${totalBancario >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {formatCurrency(totalBancario)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowDownRight className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-700">Ingresos</span>
                      </div>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(ingresosBanco)}
                      </p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowUpRight className="h-4 w-4 text-red-600" />
                        <span className="text-sm text-red-700">Egresos</span>
                      </div>
                      <p className="text-xl font-bold text-red-600">
                        {formatCurrency(egresosBanco)}
                      </p>
                    </div>
                  </div>

                  {/* Lista de cuentas */}
                  {cuentas && cuentas.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Saldo por Cuenta
                      </p>
                      <div className="space-y-2">
                        {cuentas.map((cuenta) => (
                          <div
                            key={cuenta.id}
                            className="flex justify-between items-center text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4 text-muted-foreground" />
                              <span>{cuenta.banco}</span>
                              <span className="text-muted-foreground text-xs">
                                ({cuenta.numero_cuenta})
                              </span>
                            </div>
                            <span
                              className={`font-medium ${(cuenta.saldo_actual || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}
                            >
                              {formatCurrency(cuenta.saldo_actual || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Indicadores Adicionales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Indicadores del Período
              </CardTitle>
              <CardDescription>
                Del {formatDate(fechaDesde)} al {formatDate(fechaHasta)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Cantidad de Movimientos</p>
                  <p className="text-2xl font-bold">
                    {(resumen?.caja?.total_movimientos || 0) +
                      (resumen?.bancos?.total_movimientos || 0)}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Ticket Promedio Ingreso</p>
                  <p className="text-2xl font-bold">
                    {totalIngresos > 0 && (resumen?.caja?.total_movimientos || 0) > 0
                      ? formatCurrency(totalIngresos / (resumen?.caja?.total_movimientos || 1))
                      : formatCurrency(0)}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Margen Operativo</p>
                  <p className={`text-2xl font-bold ${balanceNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalIngresos > 0
                      ? `${((balanceNeto / totalIngresos) * 100).toFixed(1)}%`
                      : '0%'}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Ratio Caja/Banco</p>
                  <p className="text-2xl font-bold">
                    {totalBancario > 0
                      ? `${((saldoCaja / (saldoCaja + totalBancario)) * 100).toFixed(0)}/${((totalBancario / (saldoCaja + totalBancario)) * 100).toFixed(0)}`
                      : '100/0'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Últimos Movimientos Resumen */}
          {resumen?.ultimos_movimientos && resumen.ultimos_movimientos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Últimos Movimientos</CardTitle>
                <CardDescription>Actividad financiera reciente</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumen.ultimos_movimientos.slice(0, 10).map((mov, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{formatDate(mov.fecha)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {mov.origen === 'caja' ? 'Caja' : 'Banco'}
                          </Badge>
                        </TableCell>
                        <TableCell>{mov.descripcion || '-'}</TableCell>
                        <TableCell className="capitalize">
                          {mov.categoria?.replace(/_/g, ' ') || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-medium ${mov.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {mov.tipo === 'ingreso' ? '+' : '-'}
                            {formatCurrency(mov.monto)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
