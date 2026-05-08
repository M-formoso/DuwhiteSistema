/**
 * Dashboard de Cobranzas — Aging report + acciones masivas.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { TrendingDown, AlertTriangle, Users, RefreshCw, FileText } from 'lucide-react';

import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/utils/formatters';

interface DashboardData {
  total_a_cobrar: number;
  al_dia: number;
  vencido: number;
  buckets: Record<string, number>;
  clientes_con_deuda: number;
  top_deudores: AgingClienteRow[];
}

interface AgingClienteRow {
  cliente_id: string;
  cliente_razon_social: string;
  cliente_nombre_fantasia: string | null;
  cuit: string | null;
  buckets: Record<string, number>;
  total: number;
  facturas_pendientes: number;
  factura_mas_vieja_dias: number;
}

const BUCKET_LABEL: Record<string, string> = {
  '0-30': 'Al día',
  '31-60': '31-60 días',
  '61-90': '61-90 días',
  '90+': 'Más de 90',
};

const BUCKET_COLOR: Record<string, string> = {
  '0-30': 'bg-green-100 text-green-700',
  '31-60': 'bg-yellow-100 text-yellow-700',
  '61-90': 'bg-orange-100 text-orange-700',
  '90+': 'bg-red-100 text-red-700',
};

export default function CobranzasDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: dashboard, isLoading } = useQuery<DashboardData>({
    queryKey: ['cobranzas-dashboard'],
    queryFn: async () => (await api.get('/cobranzas/dashboard')).data,
  });

  const { data: aging } = useQuery<{ clientes: AgingClienteRow[]; totales: any }>({
    queryKey: ['cobranzas-aging'],
    queryFn: async () => (await api.get('/cobranzas/aging')).data,
  });

  const compensarMut = useMutation({
    mutationFn: (clienteId: string) => api.post(`/cobranzas/compensar/${clienteId}`),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['cobranzas-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['cobranzas-aging'] });
      toast({
        title: 'Compensación realizada',
        description: `Se aplicaron ${r.data.aplicaciones_creadas} pagos por ${formatCurrency(r.data.monto_total_aplicado)}.`,
      });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo compensar', variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cobranzas</h1>
        <p className="text-gray-500">Gestión de saldos pendientes y antigüedad de deuda.</p>
      </div>

      {/* Cards resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total a cobrar</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(dashboard?.total_a_cobrar || 0)}
                </p>
              </div>
              <TrendingDown className="h-10 w-10 text-red-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Al día (0-30 días)</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(dashboard?.al_dia || 0)}
                </p>
              </div>
              <FileText className="h-10 w-10 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Vencido (31+ días)</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(dashboard?.vencido || 0)}
                </p>
              </div>
              <AlertTriangle className="h-10 w-10 text-orange-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Clientes con deuda</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboard?.clientes_con_deuda || 0}
                </p>
              </div>
              <Users className="h-10 w-10 text-gray-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Buckets de antigüedad */}
      <Card>
        <CardHeader>
          <CardTitle>Antigüedad de saldos (aging)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {(['0-30', '31-60', '61-90', '90+'] as const).map((bk) => (
              <div key={bk} className="border rounded p-3">
                <Badge className={BUCKET_COLOR[bk]}>{BUCKET_LABEL[bk]}</Badge>
                <p className="text-lg font-bold mt-2">
                  {formatCurrency(dashboard?.buckets?.[bk] || 0)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabla de clientes con deuda */}
      <Card>
        <CardHeader>
          <CardTitle>Clientes con deuda ({aging?.clientes?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!aging?.clientes?.length ? (
            <p className="text-center text-gray-500 py-8">No hay clientes con deuda. 🎉</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">0-30</TableHead>
                  <TableHead className="text-right">31-60</TableHead>
                  <TableHead className="text-right">61-90</TableHead>
                  <TableHead className="text-right">90+</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aging.clientes.map((c) => (
                  <TableRow key={c.cliente_id}>
                    <TableCell>
                      <button
                        className="text-left font-medium text-blue-600 hover:underline"
                        onClick={() => navigate(`/clientes/${c.cliente_id}/cuenta-corriente`)}
                      >
                        {c.cliente_razon_social}
                      </button>
                      <p className="text-xs text-gray-500">
                        {c.facturas_pendientes} factura(s) · más antigua: {c.factura_mas_vieja_dias} días
                      </p>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(c.buckets['0-30'])}</TableCell>
                    <TableCell className="text-right text-yellow-700">{formatCurrency(c.buckets['31-60'])}</TableCell>
                    <TableCell className="text-right text-orange-700">{formatCurrency(c.buckets['61-90'])}</TableCell>
                    <TableCell className="text-right text-red-700 font-semibold">{formatCurrency(c.buckets['90+'])}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(c.total)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm(`¿Compensar pagos pendientes con facturas de ${c.cliente_razon_social}?`)) {
                            compensarMut.mutate(c.cliente_id);
                          }
                        }}
                        disabled={compensarMut.isPending}
                      >
                        Compensar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
