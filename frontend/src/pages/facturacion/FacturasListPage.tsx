/**
 * Listado de Facturas (A/B + NC/ND).
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import { facturaService } from '@/services/facturaService';
import { formatCurrency, formatDate } from '@/utils/formatters';
import {
  TipoComprobante,
  EstadoFactura,
  EstadoPago,
  TIPOS_COMPROBANTE_LABEL,
  ESTADOS_FACTURA_COLOR,
  ESTADOS_FACTURA_LABEL,
  ESTADOS_PAGO_COLOR,
  ESTADOS_PAGO_LABEL,
} from '@/types/factura';
import PedidosPendientesPanel from './PedidosPendientesPanel';

const PAGE_SIZE = 20;

export default function FacturasListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState<TipoComprobante | 'todos'>('todos');
  const [estado, setEstado] = useState<EstadoFactura | 'todos'>('todos');
  const [estadoPago, setEstadoPago] = useState<EstadoPago | 'todos'>('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['facturas', { tipo, estado, estadoPago, fechaDesde, fechaHasta, search, page }],
    queryFn: () =>
      facturaService.listar({
        tipo: tipo === 'todos' ? undefined : tipo,
        estado: estado === 'todos' ? undefined : estado,
        estado_pago: estadoPago === 'todos' ? undefined : estadoPago,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        numero: search.trim() || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  // Badge con cantidad de pedidos pendientes (sin filtros) para mostrar en la pestaña
  const { data: pendientes } = useQuery({
    queryKey: ['pedidos-pendientes-facturar-count'],
    queryFn: () => facturaService.listarPedidosPendientes({ page: 1, page_size: 1 }),
    refetchOnWindowFocus: true,
  });
  const pendientesCount = pendientes?.total ?? 0;

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Facturación</h1>
          <p className="text-text-secondary">Pedidos listos para facturar y facturas emitidas</p>
        </div>
      </div>

      <Tabs defaultValue={pendientesCount > 0 ? 'pendientes' : 'facturas'}>
        <TabsList>
          <TabsTrigger value="pendientes" className="gap-2">
            Pendientes de facturar
            {pendientesCount > 0 && (
              <Badge className="bg-primary text-white">{pendientesCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="facturas">Facturas emitidas</TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes" className="mt-6">
          <PedidosPendientesPanel />
        </TabsContent>

        <TabsContent value="facturas" className="mt-6 space-y-4">
          {/* Filtros: 2 filas responsivas para no apretar */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                  <Input
                    placeholder="Buscar por número o CAE..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => {
                      setFechaDesde(e.target.value);
                      setPage(1);
                    }}
                    className="w-[150px]"
                  />
                  <Input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => {
                      setFechaHasta(e.target.value);
                      setPage(1);
                    }}
                    className="w-[150px]"
                  />
                  <Button
                    onClick={() => refetch()}
                    variant="outline"
                    size="icon"
                    title="Actualizar"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Select
                  value={tipo}
                  onValueChange={(v) => {
                    setTipo(v as TipoComprobante | 'todos');
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los tipos</SelectItem>
                    {Object.entries(TIPOS_COMPROBANTE_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={estado}
                  onValueChange={(v) => {
                    setEstado(v as EstadoFactura | 'todos');
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Estado fiscal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Estado fiscal</SelectItem>
                    {Object.entries(ESTADOS_FACTURA_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={estadoPago}
                  onValueChange={(v) => {
                    setEstadoPago(v as EstadoPago | 'todos');
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Cobranza" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Cualquier cobranza</SelectItem>
                    <SelectItem value="sin_cobrar">Impagas</SelectItem>
                    <SelectItem value="parcial">Parciales</SelectItem>
                    <SelectItem value="pagada">Pagadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tabla con scroll horizontal si no entra */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[960px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[90px]">Tipo</TableHead>
                      <TableHead className="w-[140px]">Número</TableHead>
                      <TableHead className="w-[110px]">Fecha</TableHead>
                      <TableHead className="min-w-[200px]">Cliente</TableHead>
                      <TableHead className="w-[120px]">Estado</TableHead>
                      <TableHead className="w-[130px]">Cobranza</TableHead>
                      <TableHead className="w-[130px]">CAE</TableHead>
                      <TableHead className="w-[130px] text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          Cargando...
                        </TableCell>
                      </TableRow>
                    ) : data?.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-text-secondary">
                          No hay facturas que coincidan con los filtros.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.items.map((f) => (
                        <TableRow
                          key={f.id}
                          className="cursor-pointer hover:bg-background"
                          onClick={() => navigate(`/facturacion/${f.id}`)}
                        >
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              {f.letra || '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm whitespace-nowrap">
                            {f.numero_completo || <span className="text-text-secondary">—</span>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(f.fecha_emision)}
                          </TableCell>
                          <TableCell className="max-w-[280px] truncate" title={f.cliente_razon_social_snap}>
                            {f.cliente_razon_social_snap}
                          </TableCell>
                          <TableCell>
                            <Badge className={ESTADOS_FACTURA_COLOR[f.estado]}>
                              {ESTADOS_FACTURA_LABEL[f.estado]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={ESTADOS_PAGO_COLOR[f.estado_pago]}>
                              {ESTADOS_PAGO_LABEL[f.estado_pago]}
                            </Badge>
                            {f.estado_pago === 'parcial' && (
                              <div className="text-xs text-text-secondary mt-0.5 whitespace-nowrap">
                                {formatCurrency(Number(f.monto_pagado))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {f.cae ? (
                              <span title={f.cae}>{f.cae.slice(0, 8)}…</span>
                            ) : (
                              <span className="text-text-secondary">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold whitespace-nowrap">
                            {formatCurrency(Number(f.total))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
              </p>
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-2 text-sm whitespace-nowrap">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
