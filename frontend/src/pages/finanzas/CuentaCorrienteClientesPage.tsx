/**
 * Página de Cuentas Corrientes de Clientes
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Search,
  Phone,
  Mail,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  CreditCard,
  FileText,
  ArrowUpDown,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  cuentaCorrienteClienteService,
} from '@/services/finanzasAvanzadasService';
import { formatNumber } from '@/utils/formatters';

export default function CuentaCorrienteClientesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<'saldo_desc' | 'saldo_asc' | 'nombre' | 'antiguedad'>('saldo_desc');
  const [pagina, setPagina] = useState(0);
  const limite = 20;

  // Query resumen
  const { data: resumen } = useQuery({
    queryKey: ['cc-clientes-resumen'],
    queryFn: () => cuentaCorrienteClienteService.getResumen(),
  });

  // Query clientes con deuda
  const { data: clientesData, isLoading } = useQuery({
    queryKey: ['cc-clientes-deuda', busqueda, orden, pagina],
    queryFn: () =>
      cuentaCorrienteClienteService.getClientesConDeuda({
        skip: pagina * limite,
        limit: limite,
        buscar: busqueda || undefined,
        orden,
      }),
  });

  const clientes = clientesData?.items || [];
  const total = clientesData?.total || 0;
  const totalDeuda = clientesData?.total_deuda || 0;
  const totalPages = Math.ceil(total / limite);

  const handleBuscar = () => {
    setPagina(0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cuentas Corrientes - Clientes</h1>
          <p className="text-gray-500">Gestión de deudas y cobranzas de clientes</p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes con Deuda</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resumen?.clientes_con_deuda || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total a Cobrar</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${formatNumber(resumen?.total_deuda || 0, 2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facturado este Mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${formatNumber(resumen?.total_facturado_mes || 0, 2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cobrado este Mes</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${formatNumber(resumen?.total_cobrado_mes || 0, 2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px] max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre, CUIT, código..."
                  className="pl-10"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
                />
              </div>
            </div>

            <Select value={orden} onValueChange={(v) => setOrden(v as typeof orden)}>
              <SelectTrigger className="w-48">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saldo_desc">Mayor deuda primero</SelectItem>
                <SelectItem value="saldo_asc">Menor deuda primero</SelectItem>
                <SelectItem value="nombre">Nombre A-Z</SelectItem>
                <SelectItem value="antiguedad">Más antiguo primero</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ['cc-clientes-deuda'] })}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Clientes con Deuda ({total})
            {totalDeuda > 0 && (
              <Badge variant="destructive" className="ml-2">
                Total: ${formatNumber(totalDeuda, 2)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : clientes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay clientes con deuda pendiente</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="text-right">Deuda</TableHead>
                  <TableHead className="text-right">Límite</TableHead>
                  <TableHead>Antigüedad</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((cliente) => (
                  <TableRow
                    key={cliente.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/clientes/${cliente.id}`)}
                  >
                    <TableCell className="font-mono font-medium">{cliente.codigo}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {cliente.nombre_fantasia || cliente.razon_social}
                        </p>
                        {cliente.cuit && (
                          <p className="text-xs text-gray-500">CUIT: {cliente.cuit}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {cliente.telefono && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Phone className="h-3 w-3" />
                            {cliente.telefono}
                          </div>
                        )}
                        {cliente.email && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Mail className="h-3 w-3" />
                            {cliente.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-red-600">
                        ${formatNumber(cliente.saldo, 2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {cliente.limite_credito ? (
                        <span className={cliente.saldo > cliente.limite_credito ? 'text-red-600' : ''}>
                          ${formatNumber(cliente.limite_credito, 2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {cliente.dias_antiguedad !== null ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <span className={cliente.dias_antiguedad > 30 ? 'text-orange-600 font-medium' : ''}>
                            {cliente.dias_antiguedad} días
                          </span>
                          {cliente.dias_antiguedad > 60 && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/clientes/${cliente.id}/cuenta-corriente`);
                        }}
                      >
                        <CreditCard className="h-4 w-4 mr-1" />
                        Cobrar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina === 0}
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600">
                Página {pagina + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagina + 1 >= totalPages}
                onClick={() => setPagina((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
