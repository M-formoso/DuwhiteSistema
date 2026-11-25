/**
 * Historial de Remitos — listado por rango de fechas con hora exacta y
 * detalle de productos expandible inline.
 *
 * Reemplaza en espíritu al "Visor de Punto de Venta" del sistema anterior:
 * se elige un rango, se ven todos los remitos emitidos en ese período con
 * su hora exacta, y al tocar una fila se despliega la lista de productos.
 */

import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Receipt,
  Filter,
  RefreshCw,
  ChevronRight,
  Loader2,
  FileText,
  Download,
  Search,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Combobox } from '@/components/ui/combobox';

import { remitoService } from '@/services/remitoService';
import { clienteService } from '@/services/clienteService';
import { getLocalDateString, formatNumber } from '@/utils/formatters';
import type { RemitoListItem } from '@/types/produccion-v2';

function formatFecha(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}

function formatHora(iso?: string | null): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function estadoBadge(estado: string) {
  const map: Record<string, { label: string; className: string }> = {
    emitido: { label: 'Emitido', className: 'bg-blue-100 text-blue-700' },
    entregado: { label: 'Entregado', className: 'bg-emerald-100 text-emerald-700' },
    anulado: { label: 'Anulado', className: 'bg-red-100 text-red-700' },
    borrador: { label: 'Borrador', className: 'bg-gray-100 text-gray-700' },
  };
  const info = map[estado] || { label: estado, className: 'bg-gray-100 text-gray-700' };
  return <Badge className={info.className}>{info.label}</Badge>;
}

// Fila expandible: al tocar, hace fetch del remito completo y despliega items.
function RemitoRow({ remito }: { remito: RemitoListItem }) {
  const [expandido, setExpandido] = useState(false);

  const { data: detalle, isLoading } = useQuery({
    queryKey: ['remito-detalle-historial', remito.id],
    queryFn: () => remitoService.getById(remito.id),
    enabled: expandido,
    staleTime: 60_000,
  });

  const items = (detalle as any)?.detalles || [];

  return (
    <Fragment>
      <TableRow
        className="cursor-pointer hover:bg-gray-50"
        onClick={() => setExpandido((v) => !v)}
      >
        <TableCell className="w-8">
          <ChevronRight
            className={`h-4 w-4 text-gray-400 transition-transform ${
              expandido ? 'rotate-90' : ''
            }`}
          />
        </TableCell>
        <TableCell className="whitespace-nowrap">{formatFecha(remito.created_at || remito.fecha_emision)}</TableCell>
        <TableCell className="font-mono text-xs whitespace-nowrap">{formatHora(remito.created_at)}</TableCell>
        <TableCell className="font-mono font-semibold">{remito.numero}</TableCell>
        <TableCell className="max-w-[220px] truncate">{remito.cliente_nombre || '—'}</TableCell>
        <TableCell className="capitalize text-xs text-gray-600">{remito.tipo}</TableCell>
        <TableCell>{estadoBadge(remito.estado)}</TableCell>
        <TableCell className="text-right font-mono font-semibold">
          {formatNumber(remito.total, 'currency')}
        </TableCell>
        <TableCell className="text-xs text-gray-600">
          {remito.facturado && remito.factura_id ? (
            <Link
              to={`/facturacion/${remito.factura_id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline"
            >
              {remito.factura_numero || 'Ver'}
            </Link>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
          <a
            href={remitoService.getPdfUrl(remito.id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </a>
        </TableCell>
      </TableRow>
      {expandido && (
        <TableRow className="bg-gray-50/70">
          <TableCell colSpan={10} className="p-0">
            <div className="p-4">
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando productos…
                </div>
              ) : items.length === 0 ? (
                <p className="text-sm text-gray-500">Este remito no tiene productos cargados.</p>
              ) : (
                <div className="border rounded-md overflow-hidden bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-gray-600 text-xs">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-medium">Código</th>
                        <th className="px-3 py-1.5 text-left font-medium">Producto</th>
                        <th className="px-3 py-1.5 text-right font-medium">Cant.</th>
                        <th className="px-3 py-1.5 text-right font-medium">P. Unit.</th>
                        <th className="px-3 py-1.5 text-right font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((d: any) => (
                        <tr key={d.id} className="border-t">
                          <td className="px-3 py-1.5 font-mono text-xs">{d.producto_codigo || '—'}</td>
                          <td className="px-3 py-1.5">{d.producto_nombre || d.descripcion || '—'}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{d.cantidad}</td>
                          <td className="px-3 py-1.5 text-right font-mono">
                            {formatNumber(d.precio_unitario, 'currency')}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono font-semibold">
                            {formatNumber(d.subtotal, 'currency')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 text-xs">
                      <tr className="border-t">
                        <td colSpan={4} className="px-3 py-1.5 text-right font-semibold">
                          Total
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold">
                          {formatNumber(remito.total, 'currency')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

export default function RemitosHistorialPage() {
  const hoy = getLocalDateString(new Date());
  const hace7 = getLocalDateString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

  const [fechaDesde, setFechaDesde] = useState<string>(hace7);
  const [fechaHasta, setFechaHasta] = useState<string>(hoy);
  const [clienteId, setClienteId] = useState<string>('');
  const [estado, setEstado] = useState<string>('');
  const [numeroBusqueda, setNumeroBusqueda] = useState<string>('');

  // Clientes para el combobox de filtro.
  const { data: clientesData } = useQuery({
    queryKey: ['clientes-combo-remitos'],
    queryFn: () => clienteService.getClientes({ limit: 500, activo: true }),
    staleTime: 5 * 60_000,
  });
  const clientesOptions = useMemo(
    () =>
      (clientesData?.items || []).map((c: any) => ({
        value: c.id,
        label: c.nombre_fantasia || c.razon_social,
        sublabel: c.razon_social && c.nombre_fantasia ? c.razon_social : undefined,
      })),
    [clientesData],
  );

  // Listado principal — reacciona a los filtros via queryKey.
  const {
    data: remitos,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['remitos-historial', fechaDesde, fechaHasta, clienteId, estado],
    queryFn: () =>
      remitoService.getAll({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        cliente_id: clienteId || undefined,
        estado: (estado || undefined) as any,
        limit: 200,
      }),
  });

  // Filtro local por número (no amerita roundtrip al backend).
  const remitosFiltrados = useMemo(() => {
    const term = numeroBusqueda.trim().toLowerCase();
    if (!term) return remitos || [];
    return (remitos || []).filter((r) =>
      r.numero.toLowerCase().includes(term),
    );
  }, [remitos, numeroBusqueda]);

  const totalMonto = useMemo(
    () => (remitosFiltrados || []).reduce((acc, r) => acc + Number(r.total || 0), 0),
    [remitosFiltrados],
  );

  const limpiarFiltros = () => {
    setFechaDesde('');
    setFechaHasta('');
    setClienteId('');
    setEstado('');
    setNumeroBusqueda('');
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Historial de Remitos
          </h1>
          <p className="text-sm text-muted-foreground">
            Todos los remitos del período con fecha, hora y detalle de productos.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refrescar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <Combobox
                options={clientesOptions}
                value={clienteId || null}
                onChange={(v) => setClienteId(v || '')}
                placeholder="Todos los clientes"
                searchPlaceholder="Buscar cliente…"
                emptyText="Sin clientes."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Select value={estado || '_all'} onValueChange={(v) => setEstado(v === '_all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos</SelectItem>
                  <SelectItem value="emitido">Emitido</SelectItem>
                  <SelectItem value="entregado">Entregado</SelectItem>
                  <SelectItem value="anulado">Anulado</SelectItem>
                  <SelectItem value="borrador">Borrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Número de remito</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  value={numeroBusqueda}
                  onChange={(e) => setNumeroBusqueda(e.target.value)}
                  placeholder="REM-…"
                  className="pl-7"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button variant="outline" size="sm" onClick={limpiarFiltros}>
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Totales */}
      {!isLoading && remitosFiltrados && remitosFiltrados.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <span className="font-semibold">{remitosFiltrados.length}</span>
          <span className="text-muted-foreground">
            {remitosFiltrados.length === 1 ? 'remito' : 'remitos'} en el período
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-muted-foreground">Total facturado:</span>
          <span className="font-mono font-bold text-primary">{formatNumber(totalMonto, 'currency')}</span>
        </div>
      )}

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !remitosFiltrados || remitosFiltrados.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>No hay remitos en el rango seleccionado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Fecha</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Factura</TableHead>
                    <TableHead className="text-right">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {remitosFiltrados.map((r) => (
                    <RemitoRow key={r.id} remito={r} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
