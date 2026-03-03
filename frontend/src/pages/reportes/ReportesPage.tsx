/**
 * Centro de Reportes
 */

import { useState } from 'react';
import {
  FileText,
  Download,
  Calendar,
  BarChart3,
  Users,
  Package,
  DollarSign,
  Factory,
  Truck,
  FileSpreadsheet,
  Printer,
  Filter,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

interface ReporteConfig {
  id: string;
  nombre: string;
  descripcion: string;
  icono: React.ElementType;
  categoria: 'produccion' | 'finanzas' | 'clientes' | 'stock' | 'empleados';
  formatos: ('pdf' | 'excel')[];
  requiereFechas: boolean;
}

const REPORTES: ReporteConfig[] = [
  {
    id: 'produccion-diaria',
    nombre: 'Producción Diaria',
    descripcion: 'Resumen de lotes procesados por día',
    icono: Factory,
    categoria: 'produccion',
    formatos: ['pdf', 'excel'],
    requiereFechas: true,
  },
  {
    id: 'produccion-mensual',
    nombre: 'Producción Mensual',
    descripcion: 'Estadísticas de producción del mes',
    icono: BarChart3,
    categoria: 'produccion',
    formatos: ['pdf', 'excel'],
    requiereFechas: true,
  },
  {
    id: 'consumo-insumos',
    nombre: 'Consumo de Insumos',
    descripcion: 'Detalle de insumos consumidos por período',
    icono: Package,
    categoria: 'stock',
    formatos: ['pdf', 'excel'],
    requiereFechas: true,
  },
  {
    id: 'stock-actual',
    nombre: 'Stock Actual',
    descripcion: 'Inventario actual de todos los insumos',
    icono: Package,
    categoria: 'stock',
    formatos: ['pdf', 'excel'],
    requiereFechas: false,
  },
  {
    id: 'alertas-stock',
    nombre: 'Alertas de Stock',
    descripcion: 'Insumos con stock bajo, sin stock o próximos a vencer',
    icono: Package,
    categoria: 'stock',
    formatos: ['pdf', 'excel'],
    requiereFechas: false,
  },
  {
    id: 'ventas-periodo',
    nombre: 'Ventas por Período',
    descripcion: 'Resumen de ventas y facturación',
    icono: DollarSign,
    categoria: 'finanzas',
    formatos: ['pdf', 'excel'],
    requiereFechas: true,
  },
  {
    id: 'cuentas-corrientes',
    nombre: 'Cuentas Corrientes',
    descripcion: 'Estado de cuenta de clientes',
    icono: Users,
    categoria: 'clientes',
    formatos: ['pdf', 'excel'],
    requiereFechas: false,
  },
  {
    id: 'clientes-deudores',
    nombre: 'Clientes Deudores',
    descripcion: 'Clientes con saldo pendiente',
    icono: Users,
    categoria: 'clientes',
    formatos: ['pdf', 'excel'],
    requiereFechas: false,
  },
  {
    id: 'pedidos-pendientes',
    nombre: 'Pedidos Pendientes',
    descripcion: 'Pedidos por entregar o facturar',
    icono: FileText,
    categoria: 'clientes',
    formatos: ['pdf', 'excel'],
    requiereFechas: false,
  },
  {
    id: 'ordenes-compra',
    nombre: 'Órdenes de Compra',
    descripcion: 'Órdenes a proveedores por período',
    icono: Truck,
    categoria: 'stock',
    formatos: ['pdf', 'excel'],
    requiereFechas: true,
  },
  {
    id: 'costos-produccion',
    nombre: 'Costos de Producción',
    descripcion: 'Análisis de costos por lote y período',
    icono: DollarSign,
    categoria: 'finanzas',
    formatos: ['pdf', 'excel'],
    requiereFechas: true,
  },
  {
    id: 'flujo-caja',
    nombre: 'Flujo de Caja',
    descripcion: 'Movimientos de caja por período',
    icono: DollarSign,
    categoria: 'finanzas',
    formatos: ['pdf', 'excel'],
    requiereFechas: true,
  },
  {
    id: 'asistencia-empleados',
    nombre: 'Asistencia de Empleados',
    descripcion: 'Registro de asistencia por período',
    icono: Users,
    categoria: 'empleados',
    formatos: ['pdf', 'excel'],
    requiereFechas: true,
  },
  {
    id: 'productividad-empleados',
    nombre: 'Productividad por Empleado',
    descripcion: 'Rendimiento de cada empleado',
    icono: BarChart3,
    categoria: 'empleados',
    formatos: ['pdf', 'excel'],
    requiereFechas: true,
  },
];

const CATEGORIAS = [
  { value: 'all', label: 'Todos', icon: FileText },
  { value: 'produccion', label: 'Producción', icon: Factory },
  { value: 'stock', label: 'Stock', icon: Package },
  { value: 'finanzas', label: 'Finanzas', icon: DollarSign },
  { value: 'clientes', label: 'Clientes', icon: Users },
  { value: 'empleados', label: 'Empleados', icon: Users },
];

export default function ReportesPage() {
  const { toast } = useToast();
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('all');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const reportesFiltrados =
    categoriaFiltro === 'all'
      ? REPORTES
      : REPORTES.filter((r) => r.categoria === categoriaFiltro);

  const handleGenerarReporte = (reporte: ReporteConfig, formato: 'pdf' | 'excel') => {
    // Validar fechas si son requeridas
    if (reporte.requiereFechas && (!fechaDesde || !fechaHasta)) {
      toast({
        title: 'Fechas requeridas',
        description: 'Este reporte requiere un rango de fechas.',
        variant: 'destructive',
      });
      return;
    }

    // En producción, esto llamaría al backend
    toast({
      title: 'Generando reporte...',
      description: `${reporte.nombre} en formato ${formato.toUpperCase()}`,
    });

    // Simular descarga
    setTimeout(() => {
      toast({
        title: 'Reporte generado',
        description: `El reporte ${reporte.nombre} está listo para descargar.`,
      });
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Centro de Reportes</h1>
          <p className="text-gray-500">Genera reportes en PDF o Excel</p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Categoría
              </Label>
              <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Fecha Desde
              </Label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-40"
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha Hasta</Label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-40"
              />
            </div>

            {(fechaDesde || fechaHasta) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFechaDesde('');
                  setFechaHasta('');
                }}
              >
                Limpiar fechas
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Grid de Reportes */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportesFiltrados.map((reporte) => {
          const Icon = reporte.icono;
          return (
            <Card key={reporte.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{reporte.nombre}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {reporte.descripcion}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {reporte.requiereFechas && (
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="h-3 w-3 mr-1" />
                        Fechas
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {reporte.formatos.includes('pdf') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerarReporte(reporte, 'pdf')}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        PDF
                      </Button>
                    )}
                    {reporte.formatos.includes('excel') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerarReporte(reporte, 'excel')}
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-1" />
                        Excel
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {reportesFiltrados.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No hay reportes en esta categoría</p>
        </div>
      )}

      {/* Info */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Printer className="h-4 w-4" />
            <span>
              Los reportes se generan en tiempo real con los datos actuales del sistema.
              Para reportes con fechas, selecciona el rango antes de generar.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
