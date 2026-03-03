/**
 * Lista de Clientes
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  RefreshCw,
  User,
  Building,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { clienteService } from '@/services/clienteService';
import { formatNumber } from '@/utils/formatters';
import type { TipoCliente } from '@/types/cliente';
import { TIPOS_CLIENTE } from '@/types/cliente';

const TIPO_ICONS: Record<TipoCliente, typeof User> = {
  particular: User,
  empresa: Building,
  hotel: Building,
  restaurante: Building,
  hospital: Building,
  gimnasio: Building,
  otro: User,
};

export default function ClientesListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState(searchParams.get('buscar') || '');

  // Filtros desde URL
  const tipo = searchParams.get('tipo') as TipoCliente | null;
  const conDeuda = searchParams.get('deuda') === 'true';
  const activo = searchParams.get('activo') !== 'false';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;

  // Query de clientes
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clientes', tipo, conDeuda, activo, busqueda, page],
    queryFn: () =>
      clienteService.getClientes({
        skip: (page - 1) * limit,
        limit,
        tipo: tipo || undefined,
        con_deuda: conDeuda || undefined,
        activo,
        buscar: busqueda || undefined,
      }),
  });

  const clientes = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const updateFilter = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleBuscar = () => {
    updateFilter('buscar', busqueda || null);
  };

  const goToPage = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    setSearchParams(newParams);
  };

  const getTipoLabel = (t: TipoCliente) => {
    return TIPOS_CLIENTE.find((x) => x.value === t)?.label || t;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500">{total} clientes registrados</p>
        </div>
        <Button onClick={() => navigate('/clientes/nuevo')}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px] max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre, CUIT, email..."
                  className="pl-10"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
                />
              </div>
            </div>

            <Select
              value={tipo || 'all'}
              onValueChange={(v) => updateFilter('tipo', v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {TIPOS_CLIENTE.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={conDeuda ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateFilter('deuda', conDeuda ? null : 'true')}
              className={conDeuda ? '' : 'text-orange-600 border-orange-300'}
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Con deuda
            </Button>

            <Button
              variant={!activo ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateFilter('activo', activo ? 'false' : null)}
            >
              {activo ? 'Ver inactivos' : 'Ver activos'}
            </Button>

            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead className="text-right">Saldo CC</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No se encontraron clientes
                  </TableCell>
                </TableRow>
              ) : (
                clientes.map((cliente) => {
                  const Icon = TIPO_ICONS[cliente.tipo] || User;
                  return (
                    <TableRow
                      key={cliente.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => navigate(`/clientes/${cliente.id}`)}
                    >
                      <TableCell className="font-mono font-medium">{cliente.codigo}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="font-medium">
                              {cliente.nombre_fantasia || cliente.razon_social}
                            </p>
                            {cliente.cuit && (
                              <p className="text-xs text-gray-500">CUIT: {cliente.cuit}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTipoLabel(cliente.tipo)}</Badge>
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
                      <TableCell>
                        {cliente.ciudad && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <MapPin className="h-3 w-3" />
                            {cliente.ciudad}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-medium ${
                            cliente.tiene_deuda ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          ${formatNumber(cliente.saldo_cuenta_corriente, 2)}
                        </span>
                        {cliente.tiene_deuda && (
                          <AlertTriangle className="inline h-4 w-4 ml-1 text-orange-500" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            cliente.activo
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }
                        >
                          {cliente.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => goToPage(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
