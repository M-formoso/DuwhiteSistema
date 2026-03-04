/**
 * Página Mi Cuenta Corriente - Vista para clientes
 * Muestra el estado de cuenta y historial de movimientos
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  Wallet,
  TrendingUp,
  TrendingDown,
  CreditCard,
  AlertCircle,
  FileText,
  Receipt,
  Calendar,
  DollarSign,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useAuthStore } from '@/stores/authStore';
import { clienteService } from '@/services/clienteService';
import { formatCurrency, formatDate } from '@/utils/formatters';

const TIPOS_MOVIMIENTO: Record<string, { label: string; color: string }> = {
  factura: { label: 'Factura', color: 'destructive' },
  pago: { label: 'Pago', color: 'success' },
  nota_credito: { label: 'Nota de Crédito', color: 'info' },
  nota_debito: { label: 'Nota de Débito', color: 'warning' },
  ajuste: { label: 'Ajuste', color: 'secondary' },
};

export default function MiCuentaCorrientePage() {
  const user = useAuthStore((state) => state.user);
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');

  // Cargar estado de cuenta
  const { data: estadoCuenta, isLoading: isLoadingEstado } = useQuery({
    queryKey: ['mi-estado-cuenta', user?.cliente_id],
    queryFn: () => clienteService.getEstadoCuenta(user!.cliente_id!),
    enabled: !!user?.cliente_id,
  });

  // Cargar movimientos
  const { data: movimientosData, isLoading: isLoadingMovimientos } = useQuery({
    queryKey: ['mis-movimientos', user?.cliente_id, fechaDesde, fechaHasta],
    queryFn: () =>
      clienteService.getMovimientosCuenta(user!.cliente_id!, {
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        limit: 100,
      }),
    enabled: !!user?.cliente_id,
  });

  const movimientos = movimientosData?.items || [];
  const isLoading = isLoadingEstado || isLoadingMovimientos;

  if (!user?.cliente_id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          No tienes un cliente asociado
        </h2>
        <p className="text-gray-500">
          Contacta al administrador para vincular tu cuenta a un cliente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi Cuenta Corriente</h1>
        <p className="text-gray-500">Consulta tu estado de cuenta y movimientos</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Estado de Cuenta */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${(estadoCuenta?.saldo_actual || 0) > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                    <Wallet className={`h-6 w-6 ${(estadoCuenta?.saldo_actual || 0) > 0 ? 'text-red-600' : 'text-green-600'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo Actual</p>
                    <p className={`text-2xl font-bold ${(estadoCuenta?.saldo_actual || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(estadoCuenta?.saldo_actual || 0)}
                    </p>
                    {(estadoCuenta?.saldo_actual || 0) > 0 && (
                      <p className="text-xs text-red-500">Deuda pendiente</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-blue-100">
                    <CreditCard className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Límite de Crédito</p>
                    <p className="text-2xl font-bold">
                      {estadoCuenta?.limite_credito
                        ? formatCurrency(estadoCuenta.limite_credito)
                        : 'Sin límite'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-amber-100">
                    <FileText className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Facturas Pendientes</p>
                    <p className="text-2xl font-bold">
                      {estadoCuenta?.cantidad_facturas_pendientes || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-purple-100">
                    <DollarSign className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Crédito Disponible</p>
                    <p className="text-2xl font-bold">
                      {estadoCuenta?.credito_disponible !== null
                        ? formatCurrency(estadoCuenta?.credito_disponible || 0)
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumen del Mes */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-red-100">
                    <TrendingUp className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Facturado Este Mes</p>
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(estadoCuenta?.total_facturado_mes || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-green-100">
                    <TrendingDown className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pagado Este Mes</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(estadoCuenta?.total_pagado_mes || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alerta de factura antigua */}
          {estadoCuenta?.factura_mas_antigua_dias && estadoCuenta.factura_mas_antigua_dias > 30 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <AlertCircle className="h-6 w-6 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-800">
                      Tienes facturas con más de {estadoCuenta.factura_mas_antigua_dias} días de antigüedad
                    </p>
                    <p className="text-sm text-amber-600">
                      Te recomendamos regularizar tu situación lo antes posible.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filtros */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label>Desde</Label>
                  <Input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hasta</Label>
                  <Input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="w-40"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFechaDesde('');
                    setFechaHasta('');
                  }}
                >
                  Limpiar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Historial de Movimientos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Historial de Movimientos
              </CardTitle>
              <CardDescription>Todos los movimientos de tu cuenta corriente</CardDescription>
            </CardHeader>
            <CardContent>
              {movimientos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay movimientos registrados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Comprobante</TableHead>
                        <TableHead className="text-right">Debe</TableHead>
                        <TableHead className="text-right">Haber</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimientos.map((mov) => {
                        const tipoInfo = TIPOS_MOVIMIENTO[mov.tipo] || { label: mov.tipo, color: 'secondary' };
                        const esDebe = ['factura', 'nota_debito'].includes(mov.tipo);

                        return (
                          <TableRow key={mov.id}>
                            <TableCell>{formatDate(mov.fecha_movimiento)}</TableCell>
                            <TableCell>
                              <Badge variant={tipoInfo.color as any}>
                                {tipoInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>{mov.concepto}</TableCell>
                            <TableCell>
                              {mov.factura_numero || mov.recibo_numero || '-'}
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              {esDebe ? formatCurrency(mov.monto) : '-'}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {!esDebe ? formatCurrency(mov.monto) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              <span className={mov.saldo_posterior > 0 ? 'text-red-600' : 'text-green-600'}>
                                {formatCurrency(mov.saldo_posterior)}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
