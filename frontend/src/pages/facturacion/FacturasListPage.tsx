/**
 * Listado de Facturas (A/B + NC/ND).
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

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

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Facturación</h1>
          <p className="text-text-secondary">Facturas A/B y Notas de Crédito/Débito</p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
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
            </div>

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

            <div className="flex gap-2">
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value);
                  setPage(1);
                }}
                placeholder="Desde"
              />
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value);
                  setPage(1);
                }}
                placeholder="Hasta"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Cobranza</TableHead>
                <TableHead>CAE</TableHead>
                <TableHead className="text-right">Total</TableHead>
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
                      <span className="ml-2 text-sm text-text-secondary">
                        {TIPOS_COMPROBANTE_LABEL[f.tipo]}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono">
                      {f.numero_completo || <span className="text-text-secondary">—</span>}
                    </TableCell>
                    <TableCell>{formatDate(f.fecha_emision)}</TableCell>
                    <TableCell>{f.cliente_razon_social_snap}</TableCell>
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
                        <div className="text-xs text-text-secondary mt-0.5">
                          {formatCurrency(Number(f.monto_pagado))} / {formatCurrency(Number(f.total))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {f.cae || <span className="text-text-secondary">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(Number(f.total))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-3 py-1 text-sm">
              Página {page} de {totalPages}
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
    </div>
  );
}
