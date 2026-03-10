/**
 * Formulario de creación/edición de Orden de Pago
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Building2,
  Calendar,
  Search,
  Plus,
  Trash2,
  FileText,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

import { getProveedoresLista } from '@/services/proveedorService';
import { ordenesPagoService, cuentaCorrienteProveedorService } from '@/services/finanzasAvanzadasService';
import { formatNumber, formatDate } from '@/utils/formatters';
import type {
  OrdenPagoCreate,
  DetalleOrdenPagoCreate,
  MovimientoCCProveedorList,
} from '@/types/finanzas-avanzadas';

interface ComprobanteSeleccionado extends MovimientoCCProveedorList {
  seleccionado: boolean;
  monto_a_pagar: number;
}

export default function OrdenPagoFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isEditing = !!id;
  const proveedorIdParam = searchParams.get('proveedor_id');

  // Estado del formulario
  const [proveedorId, setProveedorId] = useState<string>(proveedorIdParam || '');
  const [proveedorNombre, setProveedorNombre] = useState('');
  const [proveedorOpen, setProveedorOpen] = useState(false);
  const [busquedaProveedor, setBusquedaProveedor] = useState('');

  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split('T')[0]);
  const [fechaPagoProgramada, setFechaPagoProgramada] = useState('');
  const [concepto, setConcepto] = useState('');
  const [notas, setNotas] = useState('');

  const [comprobantes, setComprobantes] = useState<ComprobanteSeleccionado[]>([]);
  const [totalAPagar, setTotalAPagar] = useState(0);

  // Query proveedores
  const { data: proveedores = [] } = useQuery({
    queryKey: ['proveedores-lista', busquedaProveedor],
    queryFn: () => getProveedoresLista(busquedaProveedor),
  });

  // Query comprobantes pendientes del proveedor
  const { data: comprobantesPendientes = [], isLoading: loadingComprobantes } = useQuery({
    queryKey: ['comprobantes-pendientes', proveedorId],
    queryFn: () => cuentaCorrienteProveedorService.getComprobantesPendientes(proveedorId),
    enabled: !!proveedorId,
  });

  // Query orden existente (edición)
  const { data: ordenExistente } = useQuery({
    queryKey: ['orden-pago', id],
    queryFn: () => ordenesPagoService.getOrden(id!),
    enabled: isEditing,
  });

  // Actualizar comprobantes cuando cambian los pendientes
  useEffect(() => {
    if (comprobantesPendientes.length > 0 && !isEditing) {
      setComprobantes(
        comprobantesPendientes.map((c) => ({
          ...c,
          seleccionado: false,
          monto_a_pagar: c.saldo_comprobante || c.monto,
        }))
      );
    }
  }, [comprobantesPendientes, isEditing]);

  // Cargar datos de orden existente
  useEffect(() => {
    if (ordenExistente) {
      setProveedorId(ordenExistente.proveedor_id);
      setProveedorNombre(ordenExistente.proveedor_nombre || '');
      setFechaEmision(ordenExistente.fecha_emision.split('T')[0]);
      setFechaPagoProgramada(ordenExistente.fecha_pago_programada?.split('T')[0] || '');
      setConcepto(ordenExistente.concepto || '');
      setNotas(ordenExistente.notas || '');
    }
  }, [ordenExistente]);

  // Calcular total cuando cambian los comprobantes seleccionados
  useEffect(() => {
    const total = comprobantes
      .filter((c) => c.seleccionado)
      .reduce((sum, c) => sum + c.monto_a_pagar, 0);
    setTotalAPagar(total);
  }, [comprobantes]);

  // Mutation crear
  const crearMutation = useMutation({
    mutationFn: (data: OrdenPagoCreate) => ordenesPagoService.crear(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-pago'] });
      toast({ title: 'Orden creada', description: `Se creó la orden ${result.numero}` });
      navigate('/finanzas/ordenes-pago');
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo crear la orden de pago.', variant: 'destructive' });
    },
  });

  // Handlers
  const handleSeleccionarProveedor = (proveedor: { id: string; razon_social: string }) => {
    setProveedorId(proveedor.id);
    setProveedorNombre(proveedor.razon_social);
    setProveedorOpen(false);
    setComprobantes([]);
  };

  const toggleComprobante = (id: string) => {
    setComprobantes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, seleccionado: !c.seleccionado } : c))
    );
  };

  const toggleTodos = (seleccionar: boolean) => {
    setComprobantes((prev) => prev.map((c) => ({ ...c, seleccionado: seleccionar })));
  };

  const actualizarMontoPagar = (id: string, monto: number) => {
    setComprobantes((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const maxMonto = c.saldo_comprobante || c.monto;
          return { ...c, monto_a_pagar: Math.min(Math.max(0, monto), maxMonto) };
        }
        return c;
      })
    );
  };

  const handleSubmit = () => {
    if (!proveedorId) {
      toast({ title: 'Error', description: 'Seleccione un proveedor.', variant: 'destructive' });
      return;
    }

    const seleccionados = comprobantes.filter((c) => c.seleccionado && c.monto_a_pagar > 0);
    if (seleccionados.length === 0) {
      toast({ title: 'Error', description: 'Seleccione al menos un comprobante.', variant: 'destructive' });
      return;
    }

    const detalles: DetalleOrdenPagoCreate[] = seleccionados.map((c) => ({
      movimiento_id: c.id,
      monto_a_pagar: c.monto_a_pagar,
    }));

    const data: OrdenPagoCreate = {
      proveedor_id: proveedorId,
      fecha_emision: fechaEmision,
      fecha_pago_programada: fechaPagoProgramada || null,
      concepto: concepto || null,
      notas: notas || null,
      detalles,
    };

    crearMutation.mutate(data);
  };

  const comprobantesSeleccionados = comprobantes.filter((c) => c.seleccionado);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Editar Orden de Pago' : 'Nueva Orden de Pago'}
          </h1>
          <p className="text-muted-foreground">
            Seleccione los comprobantes a incluir en la orden
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel izquierdo - Datos principales */}
        <div className="lg:col-span-2 space-y-6">
          {/* Proveedor */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Proveedor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Popover open={proveedorOpen} onOpenChange={setProveedorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    disabled={isEditing}
                  >
                    {proveedorNombre || 'Seleccionar proveedor...'}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar proveedor..."
                      value={busquedaProveedor}
                      onValueChange={setBusquedaProveedor}
                    />
                    <CommandList>
                      <CommandEmpty>No se encontraron proveedores.</CommandEmpty>
                      <CommandGroup>
                        {proveedores.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={p.razon_social}
                            onSelect={() => handleSeleccionarProveedor(p)}
                          >
                            <div>
                              <p className="font-medium">{p.razon_social}</p>
                              <p className="text-sm text-muted-foreground">CUIT: {p.cuit}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>

          {/* Fechas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Fechas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha de Emisión *</Label>
                  <Input
                    type="date"
                    value={fechaEmision}
                    onChange={(e) => setFechaEmision(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de Pago Programada</Label>
                  <Input
                    type="date"
                    value={fechaPagoProgramada}
                    onChange={(e) => setFechaPagoProgramada(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comprobantes pendientes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Comprobantes Pendientes
              </CardTitle>
              <CardDescription>
                Seleccione los comprobantes que desea incluir en esta orden de pago
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!proveedorId ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Seleccione un proveedor para ver sus comprobantes pendientes.
                  </AlertDescription>
                </Alert>
              ) : loadingComprobantes ? (
                <div className="text-center py-8">Cargando comprobantes...</div>
              ) : comprobantes.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Este proveedor no tiene comprobantes pendientes de pago.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="flex gap-2 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleTodos(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Seleccionar Todos
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleTodos(false)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Deseleccionar Todos
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Factura</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="text-right">Pendiente</TableHead>
                        <TableHead className="text-right">A Pagar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comprobantes.map((c) => (
                        <TableRow
                          key={c.id}
                          className={c.seleccionado ? 'bg-primary/5' : ''}
                        >
                          <TableCell>
                            <Checkbox
                              checked={c.seleccionado}
                              onCheckedChange={() => toggleComprobante(c.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {c.factura_numero || '-'}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {c.concepto}
                          </TableCell>
                          <TableCell>{formatDate(c.fecha_movimiento)}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(c.monto, 'currency')}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {formatNumber(c.saldo_comprobante || c.monto, 'currency')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              value={c.monto_a_pagar}
                              onChange={(e) =>
                                actualizarMontoPagar(c.id, parseFloat(e.target.value) || 0)
                              }
                              className="w-32 text-right"
                              disabled={!c.seleccionado}
                              min={0}
                              max={c.saldo_comprobante || c.monto}
                              step="0.01"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>

          {/* Notas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información Adicional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Concepto</Label>
                <Input
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  placeholder="Descripción de la orden de pago"
                />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Observaciones adicionales..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel derecho - Resumen */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Proveedor:</span>
                  <span className="font-medium">{proveedorNombre || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Comprobantes:</span>
                  <span className="font-medium">{comprobantesSeleccionados.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fecha Emisión:</span>
                  <span className="font-medium">{formatDate(fechaEmision)}</span>
                </div>
                {fechaPagoProgramada && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pago Prog.:</span>
                    <span className="font-medium">{formatDate(fechaPagoProgramada)}</span>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total a Pagar:</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatNumber(totalAPagar, 'currency')}
                  </span>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={crearMutation.isPending || comprobantesSeleccionados.length === 0}
              >
                <Save className="h-4 w-4 mr-2" />
                {isEditing ? 'Actualizar Orden' : 'Crear Orden de Pago'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
