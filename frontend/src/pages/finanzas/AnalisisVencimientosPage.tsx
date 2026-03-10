/**
 * Página de Análisis de Vencimientos (Aging)
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Building2,
  FileText,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

import { cuentaCorrienteProveedorService } from '@/services/finanzasAvanzadasService';
import { formatNumber, formatDate } from '@/utils/formatters';
import type { ComprobanteVencimiento } from '@/types/finanzas-avanzadas';

interface SeccionVencimientosProps {
  titulo: string;
  descripcion: string;
  comprobantes: ComprobanteVencimiento[];
  color: string;
  icon: React.ReactNode;
  monto: number;
}

function SeccionVencimientos({
  titulo,
  descripcion,
  comprobantes,
  color,
  icon,
  monto,
}: SeccionVencimientosProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={`border-l-4 ${color}`}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {icon}
                <div>
                  <CardTitle className="text-base">{titulo}</CardTitle>
                  <CardDescription>{descripcion}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-2xl font-bold">{formatNumber(monto, 'currency')}</p>
                  <p className="text-sm text-muted-foreground">
                    {comprobantes.length} comprobante{comprobantes.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {isOpen ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            {comprobantes.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">
                No hay comprobantes en esta categoría.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Factura</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Días</TableHead>
                    <TableHead className="text-right">Monto Original</TableHead>
                    <TableHead className="text-right">Saldo Pendiente</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comprobantes.map((comp) => (
                    <TableRow key={comp.id}>
                      <TableCell>
                        <div className="font-medium">{comp.proveedor_nombre}</div>
                      </TableCell>
                      <TableCell>{comp.factura_numero || comp.concepto}</TableCell>
                      <TableCell>
                        {comp.fecha_vencimiento ? formatDate(comp.fecha_vencimiento) : '-'}
                      </TableCell>
                      <TableCell>
                        {comp.dias_vencido > 0 ? (
                          <Badge variant="destructive">{comp.dias_vencido} días</Badge>
                        ) : comp.dias_vencido < 0 ? (
                          <Badge variant="outline">En {Math.abs(comp.dias_vencido)} días</Badge>
                        ) : (
                          <Badge variant="secondary">Hoy</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(comp.monto, 'currency')}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatNumber(comp.saldo_pendiente, 'currency')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            navigate(`/finanzas/cuenta-corriente-proveedor/${comp.proveedor_id}`)
                          }
                        >
                          Ver CC
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function AnalisisVencimientosPage() {
  const navigate = useNavigate();

  const { data: analisis, isLoading } = useQuery({
    queryKey: ['analisis-vencimientos'],
    queryFn: () => cuentaCorrienteProveedorService.getAnalisisVencimientos(),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 text-center">
        <p>Cargando análisis de vencimientos...</p>
      </div>
    );
  }

  const resumen = analisis?.resumen || {
    por_vencer: 0,
    vencido_0_30: 0,
    vencido_30_60: 0,
    vencido_60_90: 0,
    vencido_90_plus: 0,
  };

  const totalPendiente = analisis?.total_pendiente || 0;
  const totalVencido =
    resumen.vencido_0_30 + resumen.vencido_30_60 + resumen.vencido_60_90 + resumen.vencido_90_plus;

  const porcentajeVencido = totalPendiente > 0 ? (totalVencido / totalPendiente) * 100 : 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Análisis de Vencimientos</h1>
          <p className="text-muted-foreground">
            Deuda con proveedores por antigüedad (Aging Report)
          </p>
        </div>
        <Button onClick={() => navigate('/finanzas/ordenes-pago')}>
          <DollarSign className="h-4 w-4 mr-2" />
          Órdenes de Pago
        </Button>
      </div>

      {/* Resumen general */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendiente</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(totalPendiente, 'currency')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vencido</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatNumber(totalVencido, 'currency')}
            </div>
            <Progress value={porcentajeVencido} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {porcentajeVencido.toFixed(1)}% de la deuda total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por Vencer</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatNumber(resumen.por_vencer, 'currency')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secciones de vencimientos */}
      <div className="space-y-4">
        <SeccionVencimientos
          titulo="Por Vencer"
          descripcion="Comprobantes que aún no han vencido"
          comprobantes={analisis?.por_vencer || []}
          color="border-l-blue-500"
          icon={<Calendar className="h-5 w-5 text-blue-500" />}
          monto={resumen.por_vencer}
        />

        <SeccionVencimientos
          titulo="Vencido 0-30 días"
          descripcion="Comprobantes vencidos en el último mes"
          comprobantes={analisis?.vencido_0_30 || []}
          color="border-l-yellow-500"
          icon={<Clock className="h-5 w-5 text-yellow-500" />}
          monto={resumen.vencido_0_30}
        />

        <SeccionVencimientos
          titulo="Vencido 30-60 días"
          descripcion="Comprobantes vencidos hace 1-2 meses"
          comprobantes={analisis?.vencido_30_60 || []}
          color="border-l-orange-500"
          icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
          monto={resumen.vencido_30_60}
        />

        <SeccionVencimientos
          titulo="Vencido 60-90 días"
          descripcion="Comprobantes vencidos hace 2-3 meses"
          comprobantes={analisis?.vencido_60_90 || []}
          color="border-l-red-400"
          icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
          monto={resumen.vencido_60_90}
        />

        <SeccionVencimientos
          titulo="Vencido +90 días"
          descripcion="Comprobantes vencidos hace más de 3 meses"
          comprobantes={analisis?.vencido_90_plus || []}
          color="border-l-red-600"
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          monto={resumen.vencido_90_plus}
        />
      </div>
    </div>
  );
}
