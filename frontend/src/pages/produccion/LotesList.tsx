/**
 * Lista de Lotes de Producción
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  Package,
  Clock,
  AlertTriangle,
  LayoutGrid,
  List,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { produccionService } from '@/services/produccionService';
import { formatNumber } from '@/utils/formatters';
import { formatDateAR } from '@/lib/utils';
import type { EstadoLote, PrioridadLote, LoteProduccionList } from '@/types/produccion';
import { ESTADOS_LOTE, PRIORIDADES, TIPOS_SERVICIO } from '@/types/produccion';

const ESTADO_COLORS: Record<EstadoLote, string> = {
  pendiente: 'bg-gray-100 text-gray-700 border-gray-300',
  en_proceso: 'bg-blue-100 text-blue-700 border-blue-300',
  pausado: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  completado: 'bg-green-100 text-green-700 border-green-300',
  cancelado: 'bg-red-100 text-red-700 border-red-300',
};

const PRIORIDAD_COLORS: Record<PrioridadLote, string> = {
  baja: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
};

export default function LotesListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Filtros desde URL
  const estado = searchParams.get('estado') as EstadoLote | null;
  const prioridad = searchParams.get('prioridad') as PrioridadLote | null;
  const soloAtrasados = searchParams.get('atrasados') === 'true';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;

  // Query de lotes
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['lotes', estado, prioridad, soloAtrasados, page],
    queryFn: () =>
      produccionService.getLotes({
        skip: (page - 1) * limit,
        limit,
        estado: estado || undefined,
        prioridad: prioridad || undefined,
        solo_atrasados: soloAtrasados || undefined,
      }),
  });

  const lotes = data?.items || [];
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

  const clearFilters = () => {
    setSearchParams({});
  };

  const goToPage = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    setSearchParams(newParams);
  };

  const getTipoServicioLabel = (tipo: string) => {
    return TIPOS_SERVICIO.find((t) => t.value === tipo)?.label || tipo;
  };

  const getEstadoLabel = (est: EstadoLote) => {
    return ESTADOS_LOTE.find((e) => e.value === est)?.label || est;
  };

  const getPrioridadLabel = (pri: PrioridadLote) => {
    return PRIORIDADES.find((p) => p.value === pri)?.label || pri;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Lotes de Producción</h1>
          <p className="text-sm text-gray-500">
            {total} lotes en total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="flex-1 sm:flex-initial" onClick={() => navigate('/produccion')}>
            <LayoutGrid className="h-4 w-4 mr-2" />
            <span className="hidden xs:inline">Ver </span>Kanban
          </Button>
          <Button className="flex-1 sm:flex-initial" onClick={() => navigate('/produccion/lotes/nuevo')}>
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden xs:inline">Nuevo </span>Lote
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="py-3 sm:py-4">
          <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
            <div className="hidden sm:flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filtros:</span>
            </div>

            <Select
              value={estado || 'all'}
              onValueChange={(v) => updateFilter('estado', v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-full xs:w-36 sm:w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {ESTADOS_LOTE.map((est) => (
                  <SelectItem key={est.value} value={est.value}>
                    {est.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={prioridad || 'all'}
              onValueChange={(v) => updateFilter('prioridad', v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-full xs:w-32 sm:w-36">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {PRIORIDADES.map((pri) => (
                  <SelectItem key={pri.value} value={pri.value}>
                    {pri.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={soloAtrasados ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateFilter('atrasados', soloAtrasados ? null : 'true')}
              className={soloAtrasados ? '' : 'text-red-600 border-red-300 hover:bg-red-50'}
            >
              <AlertTriangle className="h-4 w-4 mr-1" />
              <span className="hidden xs:inline">Solo </span>Atrasados
            </Button>

            {(estado || prioridad || soloAtrasados) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpiar
              </Button>
            )}

            <div className="ml-auto flex gap-1 sm:gap-2">
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="icon"
                className="hidden md:inline-flex"
                onClick={() => setViewMode('table')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                size="icon"
                className="hidden md:inline-flex"
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contenido */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : viewMode === 'table' ? (
        <Card className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead className="text-right">Peso</TableHead>
                <TableHead>Compromiso</TableHead>
                <TableHead>Avance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    No se encontraron lotes
                  </TableCell>
                </TableRow>
              ) : (
                lotes.map((lote) => (
                  <TableRow
                    key={lote.id}
                    className={`cursor-pointer hover:bg-gray-50 ${
                      lote.esta_atrasado ? 'bg-red-50' : ''
                    }`}
                    onClick={() => navigate(`/produccion/lotes/${lote.id}`)}
                  >
                    <TableCell className="font-mono font-medium">
                      <div className="flex items-center gap-2">
                        {lote.numero}
                        {lote.esta_atrasado && (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{lote.cliente_nombre || '-'}</TableCell>
                    <TableCell>{getTipoServicioLabel(lote.tipo_servicio)}</TableCell>
                    <TableCell>
                      <Badge className={ESTADO_COLORS[lote.estado]}>
                        {getEstadoLabel(lote.estado)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lote.etapa_actual_nombre && (
                        <Badge
                          variant="outline"
                          style={{ borderColor: lote.etapa_actual_color || undefined }}
                        >
                          {lote.etapa_actual_nombre}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={PRIORIDAD_COLORS[lote.prioridad]}>
                        {getPrioridadLabel(lote.prioridad)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {lote.peso_entrada_kg ? `${formatNumber(lote.peso_entrada_kg, 1)} kg` : '-'}
                    </TableCell>
                    <TableCell>
                      {lote.fecha_compromiso
                        ? formatDateAR(lote.fecha_compromiso)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${lote.porcentaje_avance}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {lote.porcentaje_avance}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      {/* Vista de cards: siempre en mobile, opcional en desktop */}
      {!isLoading && (
        <div
          className={
            viewMode === 'cards'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4'
              : 'grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden'
          }
        >
          {lotes.length === 0 && viewMode === 'cards' && (
            <p className="col-span-full text-center text-gray-500 py-8">
              No se encontraron lotes
            </p>
          )}
          {lotes.map((lote) => (
            <Card
              key={lote.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${
                lote.esta_atrasado ? 'border-red-400 bg-red-50' : ''
              }`}
              onClick={() => navigate(`/produccion/lotes/${lote.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-mono">{lote.numero}</CardTitle>
                  <Badge className={PRIORIDAD_COLORS[lote.prioridad]}>
                    {getPrioridadLabel(lote.prioridad)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {lote.cliente_nombre && (
                  <p className="text-sm text-gray-600">{lote.cliente_nombre}</p>
                )}

                <div className="flex items-center gap-2">
                  <Badge className={ESTADO_COLORS[lote.estado]}>
                    {getEstadoLabel(lote.estado)}
                  </Badge>
                  {lote.etapa_actual_nombre && (
                    <Badge
                      variant="outline"
                      style={{ borderColor: lote.etapa_actual_color || undefined }}
                    >
                      {lote.etapa_actual_nombre}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{getTipoServicioLabel(lote.tipo_servicio)}</span>
                  {lote.peso_entrada_kg && (
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {formatNumber(lote.peso_entrada_kg, 1)} kg
                    </span>
                  )}
                </div>

                {lote.fecha_compromiso && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    Compromiso: {formatDateAR(lote.fecha_compromiso)}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${lote.porcentaje_avance}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{lote.porcentaje_avance}%</span>
                </div>

                {lote.esta_atrasado && (
                  <div className="flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    Atrasado
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
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
