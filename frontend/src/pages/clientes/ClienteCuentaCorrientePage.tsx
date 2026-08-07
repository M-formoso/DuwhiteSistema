/**
 * Detalle de Cuenta Corriente de Cliente
 * Vista completa con movimientos paginados, filtros y acciones
 */

import { Fragment, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  RefreshCw,
  CreditCard,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  TrendingUp,
  TrendingDown,
  Package,
  Receipt,
  Sliders,
  Pencil,
  Eye,
  Trash2,
  AlertTriangle,
  CalendarClock,
  CalendarRange,
  Wallet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

import {
  clienteService,
  type RegistrarAjusteRequest,
  type EditarAjusteRequest,
} from '@/services/clienteService';
import {
  cuentaCorrienteClienteService,
  type RegistrarCobranzaRequest,
} from '@/services/finanzasAvanzadasService';
import { historialLavadosService } from '@/services/historialLavadosService';
import { formatNumber, formatDate, getLocalDateString } from '@/utils/formatters';
import { MEDIOS_PAGO } from '@/types/cliente';
import type { MedioPago } from '@/types/cliente';
import { BANCOS_ARGENTINA, TIPOS_CHEQUE } from '@/types/tesoreria';
import { useAuthStore } from '@/stores/authStore';
import ConfirmDeleteStrict from '@/components/ui/confirm-delete-strict';

const ESTADOS_FACTURACION = [
  { value: 'sin_facturar', label: 'Sin Facturar' },
  { value: 'factura_a', label: 'Factura A' },
  { value: 'factura_b', label: 'Factura B' },
  { value: 'factura_c', label: 'Factura C' },
  { value: 'ticket', label: 'Ticket' },
];

const ITEMS_PER_PAGE = 200;

export default function ClienteCuentaCorrientePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Estados de filtros
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos');
  const [page, setPage] = useState(0);

  // Estados del modal de ajuste manual
  const [showAjusteModal, setShowAjusteModal] = useState(false);
  const [ajusteDireccion, setAjusteDireccion] = useState<'aumentar' | 'disminuir'>('disminuir');
  const [ajusteMonto, setAjusteMonto] = useState('');
  const [ajusteConcepto, setAjusteConcepto] = useState('');
  const [ajusteFecha, setAjusteFecha] = useState('');
  const [ajusteNotas, setAjusteNotas] = useState('');

  // Estados del modal de edición de movimiento
  const [editandoMovimientoId, setEditandoMovimientoId] = useState<string | null>(null);
  const [editandoTipo, setEditandoTipo] = useState<'ajuste' | 'pago' | null>(null);
  const [editDireccion, setEditDireccion] = useState<'aumentar' | 'disminuir'>('disminuir');
  const [editMonto, setEditMonto] = useState('');
  const [editConcepto, setEditConcepto] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [editNotas, setEditNotas] = useState('');

  // Estados del modal de detalle y eliminación
  const [movimientoDetalle, setMovimientoDetalle] = useState<any | null>(null);
  const [movimientoAEliminar, setMovimientoAEliminar] = useState<any | null>(null);
  const [remitoAEliminar, setRemitoAEliminar] = useState<any | null>(null);
  const [mesesAbiertos, setMesesAbiertos] = useState<Set<string>>(new Set());

  const usuarioActual = useAuthStore((s) => s.user);
  const puedeEliminarRemito =
    !!usuarioActual && ['superadmin', 'administrador'].includes(usuarioActual.rol);

  // Estados del modal de cobranza completo
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [cobranzaMonto, setCobranzaMonto] = useState('');
  const [cobranzaMedio, setCobranzaMedio] = useState<MedioPago>('efectivo');
  const [cobranzaReferencia, setCobranzaReferencia] = useState('');
  const [cobranzaConcepto, setCobranzaConcepto] = useState('');
  const [cobranzaNotas, setCobranzaNotas] = useState('');
  const [cobranzaEstadoFacturacion, setCobranzaEstadoFacturacion] = useState('sin_facturar');
  const [cobranzaFacturaNumero, setCobranzaFacturaNumero] = useState('');
  const [cobranzaPedidoId, setCobranzaPedidoId] = useState<string>('');
  const [cobranzaLoteId, setCobranzaLoteId] = useState<string>('');

  // Detalle Cheque
  const [chequeNumero, setChequeNumero] = useState('');
  const [chequeBanco, setChequeBanco] = useState('');
  const [chequeFechaEmision, setChequeFechaEmision] = useState('');
  const [chequeFechaVencimiento, setChequeFechaVencimiento] = useState('');
  const [chequeLibrador, setChequeLibrador] = useState('');
  const [chequeCuitLibrador, setChequeCuitLibrador] = useState('');
  const [chequeTipo, setChequeTipo] = useState<'fisico' | 'echeq'>('fisico');
  // Detalle Transferencia
  const [transferenciaBanco, setTransferenciaBanco] = useState('');
  const [transferenciaNumero, setTransferenciaNumero] = useState('');

  // Query del cliente
  const { data: cliente, isLoading: loadingCliente } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => clienteService.getCliente(id!),
    enabled: Boolean(id),
  });

  // Query del estado de cuenta (respeta filtros de fecha)
  const { data: estadoCuenta } = useQuery({
    queryKey: ['cliente-estado-cuenta', id, fechaDesde, fechaHasta],
    queryFn: () =>
      clienteService.getEstadoCuenta(id!, {
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      }),
    enabled: Boolean(id),
  });

  const hayFiltroPeriodo = Boolean(fechaDesde || fechaHasta);

  // Query de movimientos con paginación y filtros
  const { data: movimientosData, isLoading: loadingMovimientos } = useQuery({
    queryKey: ['cliente-movimientos', id, page, fechaDesde, fechaHasta],
    queryFn: () =>
      clienteService.getMovimientosCuenta(id!, {
        skip: page * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      }),
    enabled: Boolean(id),
  });

  // Query pedidos pendientes del cliente (para asociar cobranza)
  const { data: pedidosPendientes } = useQuery({
    queryKey: ['cc-pedidos-pendientes', id],
    queryFn: () => cuentaCorrienteClienteService.getPedidosPendientes(id!),
    enabled: Boolean(id) && showPagoModal,
  });

  // Query lotes del cliente (para asociar cobranza)
  const { data: lotesCliente } = useQuery({
    queryKey: ['cc-lotes-cliente', id],
    queryFn: () => cuentaCorrienteClienteService.getLotesCliente(id!),
    enabled: Boolean(id) && showPagoModal,
  });

  // Filtrar localmente por tipo si es necesario
  const movimientosFiltrados = movimientosData?.items?.filter((mov) => {
    if (tipoFiltro === 'todos') return true;
    return mov.tipo === tipoFiltro;
  });

  // Agrupar por mes (YYYY-MM). Los movimientos vienen ordenados por created_at desc,
  // así que el saldo posterior del primer movimiento del mes es el saldo al fin de mes.
  // Nota: fecha_movimiento viene como "YYYY-MM-DD"; parseamos manualmente para evitar
  // que new Date() lo interprete como UTC y corra el día al zone local (America/Argentina).
  const movimientosPorMes = (() => {
    const MESES_ES = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const grupos = new Map<string, { key: string; label: string; movimientos: any[]; cargos: number; pagos: number; saldoFinal: number }>();
    for (const mov of movimientosFiltrados || []) {
      const [anio, mes] = String(mov.fecha_movimiento).slice(0, 10).split('-');
      const key = `${anio}-${mes}`;
      if (!grupos.has(key)) {
        const label = `${MESES_ES[parseInt(mes, 10) - 1]} de ${anio}`;
        grupos.set(key, { key, label, movimientos: [], cargos: 0, pagos: 0, saldoFinal: Number(mov.saldo_posterior) });
      }
      const g = grupos.get(key)!;
      g.movimientos.push(mov);
      const delta = Number(mov.saldo_posterior) - Number(mov.saldo_anterior);
      if (mov.tipo === 'cargo' || (mov.tipo === 'ajuste' && delta > 0)) g.cargos += Number(mov.monto);
      if (mov.tipo === 'pago' || (mov.tipo === 'ajuste' && delta < 0)) g.pagos += Number(mov.monto);
    }
    return Array.from(grupos.values());
  })();

  const toggleMes = (key: string) => {
    setMesesAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Mutation para registrar cobranza completa
  const cobranzaMutation = useMutation({
    mutationFn: (data: RegistrarCobranzaRequest) =>
      cuentaCorrienteClienteService.registrarCobranza(id!, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['cliente', id] });
      queryClient.invalidateQueries({ queryKey: ['cliente-estado-cuenta', id] });
      queryClient.invalidateQueries({ queryKey: ['cliente-movimientos', id] });
      queryClient.invalidateQueries({ queryKey: ['cc-clientes-deuda'] });
      queryClient.invalidateQueries({ queryKey: ['cc-clientes-resumen'] });
      toast({
        title: 'Cobranza registrada',
        description: `Recibo ${result.recibo_numero} generado correctamente.`,
      });
      cerrarModalCobranza();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo registrar la cobranza.',
        variant: 'destructive',
      });
    },
  });

  // Mutation para registrar ajuste manual
  const ajusteMutation = useMutation({
    mutationFn: (data: RegistrarAjusteRequest) =>
      clienteService.registrarAjuste(id!, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['cliente', id] });
      queryClient.invalidateQueries({ queryKey: ['cliente-estado-cuenta', id] });
      queryClient.invalidateQueries({ queryKey: ['cliente-movimientos', id] });
      queryClient.invalidateQueries({ queryKey: ['cc-clientes-deuda'] });
      queryClient.invalidateQueries({ queryKey: ['cc-clientes-resumen'] });
      toast({
        title: 'Ajuste registrado',
        description: `Saldo actualizado a ${formatNumber(result.saldo_posterior, 'currency')}.`,
      });
      cerrarModalAjuste();
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err?.response?.data?.detail || 'No se pudo registrar el ajuste.',
        variant: 'destructive',
      });
    },
  });

  const abrirModalAjuste = () => {
    setAjusteDireccion('disminuir');
    setAjusteMonto('');
    setAjusteConcepto('');
    setAjusteFecha(getLocalDateString());
    setAjusteNotas('');
    setShowAjusteModal(true);
  };

  const cerrarModalAjuste = () => {
    setShowAjusteModal(false);
    setAjusteMonto('');
    setAjusteConcepto('');
    setAjusteNotas('');
  };

  const handleRegistrarAjuste = () => {
    const monto = parseFloat(ajusteMonto);
    if (!monto || monto <= 0 || !ajusteConcepto.trim() || !ajusteFecha) return;

    ajusteMutation.mutate({
      monto,
      direccion: ajusteDireccion,
      concepto: ajusteConcepto.trim(),
      fecha: ajusteFecha,
      notas: ajusteNotas || undefined,
    });
  };

  const saldoActualNum = Number(cliente?.saldo_cuenta_corriente || 0);
  const deltaAjuste = ajusteMonto
    ? (ajusteDireccion === 'aumentar' ? 1 : -1) * parseFloat(ajusteMonto || '0')
    : 0;
  const saldoPreview = saldoActualNum + (isFinite(deltaAjuste) ? deltaAjuste : 0);

  // Mutation para editar un movimiento tipo AJUSTE
  const editMutation = useMutation({
    mutationFn: (payload: { movimientoId: string; data: EditarAjusteRequest }) =>
      clienteService.editarAjuste(id!, payload.movimientoId, payload.data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['cliente', id] });
      queryClient.invalidateQueries({ queryKey: ['cliente-estado-cuenta', id] });
      queryClient.invalidateQueries({ queryKey: ['cliente-movimientos', id] });
      queryClient.invalidateQueries({ queryKey: ['cc-clientes-deuda'] });
      queryClient.invalidateQueries({ queryKey: ['cc-clientes-resumen'] });
      toast({
        title: 'Movimiento actualizado',
        description: `Nuevo saldo: ${formatNumber(result.saldo_posterior, 'currency')}.`,
      });
      cerrarModalEditar();
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err?.response?.data?.detail || 'No se pudo editar el movimiento.',
        variant: 'destructive',
      });
    },
  });

  const abrirModalEditar = (mov: any) => {
    const delta = Number(mov.saldo_posterior) - Number(mov.saldo_anterior);
    setEditandoMovimientoId(mov.id);
    setEditandoTipo(mov.tipo === 'pago' ? 'pago' : 'ajuste');
    setEditDireccion(mov.tipo === 'pago' ? 'disminuir' : (delta >= 0 ? 'aumentar' : 'disminuir'));
    setEditMonto(String(mov.monto));
    setEditConcepto(mov.concepto || '');
    setEditFecha((mov.fecha_movimiento || '').slice(0, 10));
    setEditNotas(mov.notas || '');
  };

  const cerrarModalEditar = () => {
    setEditandoMovimientoId(null);
    setEditandoTipo(null);
    setEditMonto('');
    setEditConcepto('');
    setEditNotas('');
  };

  const handleGuardarEdicion = () => {
    if (!editandoMovimientoId) return;
    const monto = parseFloat(editMonto);
    if (!monto || monto <= 0 || !editConcepto.trim() || !editFecha) return;

    editMutation.mutate({
      movimientoId: editandoMovimientoId,
      data: {
        monto,
        direccion: editDireccion,
        concepto: editConcepto.trim(),
        fecha: editFecha,
        notas: editNotas || undefined,
      },
    });
  };

  // Mutation para eliminar un movimiento tipo AJUSTE
  const eliminarMutation = useMutation({
    mutationFn: (movimientoId: string) => clienteService.eliminarAjuste(id!, movimientoId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['cliente', id] });
      queryClient.invalidateQueries({ queryKey: ['cliente-estado-cuenta', id] });
      queryClient.invalidateQueries({ queryKey: ['cliente-movimientos', id] });
      queryClient.invalidateQueries({ queryKey: ['cc-clientes-deuda'] });
      queryClient.invalidateQueries({ queryKey: ['cc-clientes-resumen'] });
      toast({
        title: 'Movimiento eliminado',
        description: `Nuevo saldo: ${formatNumber(result.saldo_posterior_cliente, 'currency')}.`,
      });
      setMovimientoAEliminar(null);
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err?.response?.data?.detail || 'No se pudo eliminar el movimiento.',
        variant: 'destructive',
      });
    },
  });

  const confirmarEliminar = () => {
    if (movimientoAEliminar) {
      eliminarMutation.mutate(movimientoAEliminar.id);
    }
  };

  // Mutation para eliminar un REMITO (soft delete + reversión CC)
  const eliminarRemitoMutation = useMutation({
    mutationFn: async ({ remitoId, motivo }: { remitoId: string; motivo?: string }) => {
      if (!id) throw new Error('Cliente no definido');
      return historialLavadosService.deleteRemito(id, remitoId, motivo);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['cliente', id] });
      queryClient.invalidateQueries({ queryKey: ['cliente-estado-cuenta', id] });
      queryClient.invalidateQueries({ queryKey: ['cliente-movimientos', id] });
      queryClient.invalidateQueries({ queryKey: ['cc-clientes-deuda'] });
      queryClient.invalidateQueries({ queryKey: ['cc-clientes-resumen'] });
      toast({
        title: 'Remito eliminado',
        description:
          result.saldo_posterior_cliente !== null
            ? `${result.numero} eliminado. Nuevo saldo: ${formatNumber(
                result.saldo_posterior_cliente,
                'currency'
              )}.`
            : `${result.numero} eliminado.`,
      });
      setRemitoAEliminar(null);
    },
    onError: (err: any) => {
      toast({
        title: 'Error al eliminar el remito',
        description: err?.response?.data?.detail || 'No se pudo eliminar el remito.',
        variant: 'destructive',
      });
    },
  });

  const abrirModalCobranza = () => {
    setCobranzaMonto(cliente?.saldo_cuenta_corriente?.toString() || '');
    setCobranzaMedio('efectivo');
    setCobranzaReferencia('');
    setCobranzaConcepto('');
    setCobranzaNotas('');
    setCobranzaEstadoFacturacion('sin_facturar');
    setCobranzaFacturaNumero('');
    setCobranzaPedidoId('');
    setCobranzaLoteId('');
    setShowPagoModal(true);
  };

  const cerrarModalCobranza = () => {
    setShowPagoModal(false);
    setCobranzaMonto('');
    setCobranzaReferencia('');
    setCobranzaConcepto('');
    setCobranzaNotas('');
    setCobranzaEstadoFacturacion('sin_facturar');
    setCobranzaFacturaNumero('');
    setCobranzaPedidoId('');
    setCobranzaLoteId('');
    setChequeNumero('');
    setChequeBanco('');
    setChequeFechaEmision('');
    setChequeFechaVencimiento('');
    setChequeLibrador('');
    setChequeCuitLibrador('');
    setChequeTipo('fisico');
    setTransferenciaBanco('');
    setTransferenciaNumero('');
  };

  const handleRegistrarCobranza = () => {
    if (!cobranzaMonto) return;

    // Validación cliente-side de campos obligatorios por medio de pago
    if (cobranzaMedio === 'cheque') {
      if (!chequeNumero.trim() || !chequeBanco || !chequeFechaVencimiento) {
        toast({
          title: 'Faltan datos del cheque',
          description: 'Número, banco emisor y fecha de vencimiento son obligatorios.',
          variant: 'destructive',
        });
        return;
      }
    }

    cobranzaMutation.mutate({
      monto: parseFloat(cobranzaMonto),
      fecha: getLocalDateString(),
      medio_pago: cobranzaMedio,
      concepto: cobranzaConcepto || undefined,
      referencia_pago: cobranzaReferencia || undefined,
      notas: cobranzaNotas || undefined,
      pedido_id: cobranzaPedidoId || undefined,
      lote_id: cobranzaLoteId || undefined,
      estado_facturacion: cobranzaEstadoFacturacion,
      factura_numero: cobranzaFacturaNumero || undefined,
      // Cheque
      cheque_numero: cobranzaMedio === 'cheque' ? chequeNumero.trim() : undefined,
      cheque_banco: cobranzaMedio === 'cheque' ? chequeBanco : undefined,
      cheque_fecha_emision:
        cobranzaMedio === 'cheque' && chequeFechaEmision ? chequeFechaEmision : undefined,
      cheque_fecha_vencimiento:
        cobranzaMedio === 'cheque' ? chequeFechaVencimiento : undefined,
      cheque_librador:
        cobranzaMedio === 'cheque' && chequeLibrador ? chequeLibrador : undefined,
      cheque_cuit_librador:
        cobranzaMedio === 'cheque' && chequeCuitLibrador ? chequeCuitLibrador : undefined,
      cheque_tipo: cobranzaMedio === 'cheque' ? chequeTipo : undefined,
      // Transferencia
      transferencia_banco_origen:
        cobranzaMedio === 'transferencia' && transferenciaBanco ? transferenciaBanco : undefined,
      transferencia_numero:
        cobranzaMedio === 'transferencia' && transferenciaNumero
          ? transferenciaNumero
          : undefined,
    });
  };

  const limpiarFiltros = () => {
    setFechaDesde('');
    setFechaHasta('');
    setTipoFiltro('todos');
    setPage(0);
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'cargo':
        return <Badge className="bg-red-100 text-red-700">Cargo</Badge>;
      case 'pago':
        return <Badge className="bg-green-100 text-green-700">Pago</Badge>;
      case 'ajuste':
        return <Badge className="bg-purple-100 text-purple-700">Ajuste</Badge>;
      default:
        return <Badge variant="outline">{tipo}</Badge>;
    }
  };

  const getEstadoFacturacionBadge = (mov: any) => {
    // Si es CARGO: depende de si tiene factura asociada y su estado_pago
    if (mov.tipo === 'cargo') {
      if (mov.factura) {
        const ep = mov.factura.estado_pago;
        if (ep === 'pagada') {
          return <Badge className="bg-green-100 text-green-700">🟢 Cobrada</Badge>;
        }
        if (ep === 'parcial') {
          return <Badge className="bg-yellow-100 text-yellow-700">🟡 Parcial</Badge>;
        }
        return <Badge className="bg-blue-100 text-blue-700">🔵 Facturada</Badge>;
      }
      return <Badge className="bg-orange-100 text-orange-700">🟠 Sin facturar</Badge>;
    }
    // Si es PAGO: depende de si está vinculado a una factura
    if (mov.tipo === 'pago') {
      if (mov.factura_id || mov.factura) {
        return <Badge className="bg-green-100 text-green-700">🟢 Aplicado</Badge>;
      }
      return <Badge className="bg-purple-100 text-purple-700">🟣 Anticipo</Badge>;
    }
    return <Badge variant="outline">-</Badge>;
  };

  const totalPages = Math.ceil((movimientosData?.total || 0) / ITEMS_PER_PAGE);

  if (loadingCliente) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cliente no encontrado</p>
        <Button variant="link" onClick={() => navigate('/clientes')}>
          Volver a la lista
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/clientes')}
            title="Volver a la lista de clientes"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cuenta Corriente</h1>
            <p className="text-gray-500">
              {cliente.nombre_fantasia || cliente.razon_social} - {cliente.codigo}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() =>
                  clienteService.abrirEstadoCuentaPdf(id!, {
                    fecha_desde: fechaDesde || undefined,
                    fecha_hasta: fechaHasta || undefined,
                  })
                }
              >
                <FileText className="h-4 w-4 mr-2" />
                {fechaDesde || fechaHasta ? 'Rango filtrado actual' : 'Histórico completo'}
              </DropdownMenuItem>
              {movimientosPorMes.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Por mes</DropdownMenuLabel>
                  {movimientosPorMes.map((g) => {
                    const [anio, mes] = g.key.split('-');
                    const primerDia = `${anio}-${mes}-01`;
                    const ultimoDia = new Date(parseInt(anio, 10), parseInt(mes, 10), 0)
                      .toISOString()
                      .slice(0, 10);
                    return (
                      <DropdownMenuItem
                        key={g.key}
                        onClick={() =>
                          clienteService.abrirEstadoCuentaPdf(id!, {
                            fecha_desde: primerDia,
                            fecha_hasta: ultimoDia,
                          })
                        }
                      >
                        {g.label}
                      </DropdownMenuItem>
                    );
                  })}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={abrirModalAjuste}>
            <Sliders className="h-4 w-4 mr-2" />
            Ajustar Saldo
          </Button>
          <Button onClick={abrirModalCobranza} disabled={!cliente.tiene_deuda}>
            <CreditCard className="h-4 w-4 mr-2" />
            Registrar Pago
          </Button>
        </div>
      </div>

      {/* Cards del mes en curso (fijas, no dependen del filtro) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={(estadoCuenta?.deuda_vencida || 0) > 0 ? 'border-red-300 bg-red-50/40' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Deuda vencida</p>
                <p
                  className={`text-2xl font-bold ${
                    (estadoCuenta?.deuda_vencida || 0) > 0 ? 'text-red-600' : 'text-gray-700'
                  }`}
                >
                  {formatNumber(estadoCuenta?.deuda_vencida || 0, 'currency')}
                </p>
                <p className="text-xs text-gray-400 mt-1">Meses anteriores impagos (neto de pagos)</p>
              </div>
              <CalendarClock
                className={`h-10 w-10 ${
                  (estadoCuenta?.deuda_vencida || 0) > 0 ? 'text-red-200' : 'text-gray-200'
                }`}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Consumo del mes</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatNumber(estadoCuenta?.consumo_mes_actual || 0, 'currency')}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Cargos del 1° a hoy (neto de pagos)
                </p>
              </div>
              <CalendarRange className="h-10 w-10 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        {(() => {
          const adeudado = Number(estadoCuenta?.total_adeudado || 0);
          const aFavor = Number(estadoCuenta?.saldo_a_favor || 0);
          const tieneFavor = aFavor > 0;
          const tieneDeuda = adeudado > 0;
          return (
            <Card
              className={
                tieneFavor
                  ? 'border-green-300 bg-green-50/40'
                  : tieneDeuda
                  ? 'border-orange-300'
                  : 'border-green-300'
              }
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">
                      {tieneFavor ? 'Saldo a favor' : 'Total adeudado'}
                    </p>
                    <p
                      className={`text-2xl font-bold ${
                        tieneFavor
                          ? 'text-green-600'
                          : tieneDeuda
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      {formatNumber(tieneFavor ? aFavor : adeudado, 'currency')}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {tieneFavor
                        ? 'Anticipo del cliente sin aplicar'
                        : 'Vencida + consumo del mes (neto de pagos)'}
                    </p>
                  </div>
                  {tieneFavor ? (
                    <TrendingDown className="h-10 w-10 text-green-300" />
                  ) : (
                    <Wallet
                      className={`h-10 w-10 ${
                        tieneDeuda ? 'text-orange-200' : 'text-green-200'
                      }`}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* Cards de saldo del cliente — desglose por estado de facturación.
          Total facturado + Total sin facturar = saldo total a cobrar.
          Cada card navega al módulo de facturación filtrado por este cliente. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/facturacion?cliente_id=${id}&tab=facturas`)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate(`/facturacion?cliente_id=${id}&tab=facturas`);
            }
          }}
          className="cursor-pointer transition hover:shadow-md hover:border-blue-300"
          title="Ver facturas de este cliente"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total facturado</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatNumber(estadoCuenta?.deuda_facturada || 0, 'currency')}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {hayFiltroPeriodo
                    ? 'Facturado en el período'
                    : 'Saldo pendiente de facturas emitidas (con CAE)'}
                </p>
                <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                  Ver facturas del cliente <ChevronRight className="h-3 w-3" />
                </p>
              </div>
              <Receipt className="h-10 w-10 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/facturacion?cliente_id=${id}&tab=pendientes`)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate(`/facturacion?cliente_id=${id}&tab=pendientes`);
            }
          }}
          className={`cursor-pointer transition hover:shadow-md hover:border-orange-400 ${
            (estadoCuenta?.cargos_sin_facturar || 0) > 0 ? 'border-orange-300' : ''
          }`}
          title="Ver remitos pendientes de facturar"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total sin facturar</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatNumber(estadoCuenta?.cargos_sin_facturar || 0, 'currency')}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {hayFiltroPeriodo
                    ? 'Cargos sin factura en el período'
                    : 'Saldo por remitos/ajustes pendientes de facturar'}
                </p>
                <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                  Ver remitos pendientes <ChevronRight className="h-3 w-3" />
                </p>
              </div>
              <FileText className="h-10 w-10 text-orange-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Desde</Label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value);
                  setPage(0);
                }}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value);
                  setPage(0);
                }}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={tipoFiltro}
                onValueChange={(v) => {
                  setTipoFiltro(v);
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="cargo">Cargos</SelectItem>
                  <SelectItem value="pago">Pagos</SelectItem>
                  <SelectItem value="nota_credito">Notas de crédito</SelectItem>
                  <SelectItem value="nota_debito">Notas de débito</SelectItem>
                  <SelectItem value="ajuste">Ajustes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" onClick={limpiarFiltros}>
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de movimientos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Movimientos
            </CardTitle>
            <span className="text-sm text-gray-500">
              {movimientosData?.total || 0} movimientos
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMovimientos ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : movimientosFiltrados && movimientosFiltrados.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Fecha</TableHead>
                      <TableHead className="w-[100px]">Tipo</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Comprobante</TableHead>
                      <TableHead className="w-[140px]">Estado</TableHead>
                      <TableHead className="text-right">Debe</TableHead>
                      <TableHead className="text-right">Haber</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="w-[140px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimientosPorMes.map((grupo) => {
                      const abierto = mesesAbiertos.has(grupo.key);
                      return (
                        <Fragment key={grupo.key}>
                          <TableRow
                            className="bg-gray-50 hover:bg-gray-100 cursor-pointer font-semibold"
                            onClick={() => toggleMes(grupo.key)}
                          >
                            <TableCell colSpan={4}>
                              <div className="flex items-center gap-2">
                                {abierto ? (
                                  <ChevronDown className="h-4 w-4 text-gray-600" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-600" />
                                )}
                                <span className="text-gray-900">{grupo.label}</span>
                                <span className="text-xs text-gray-500 font-normal">
                                  ({grupo.movimientos.length} {grupo.movimientos.length === 1 ? 'movimiento' : 'movimientos'})
                                </span>
                              </div>
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right text-red-600">
                              {grupo.cargos > 0 ? formatNumber(grupo.cargos, 'currency') : '-'}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {grupo.pagos > 0 ? formatNumber(grupo.pagos, 'currency') : '-'}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {formatNumber(grupo.saldoFinal, 'currency')}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                          {abierto && grupo.movimientos.map((mov: any) => {
                            const delta = Number(mov.saldo_posterior) - Number(mov.saldo_anterior);
                            const esDebe = mov.tipo === 'cargo' || (mov.tipo === 'ajuste' && delta > 0);
                            const esHaber = mov.tipo === 'pago' || (mov.tipo === 'ajuste' && delta < 0);
                            return (
                              <TableRow key={mov.id}>
                                <TableCell className="font-mono text-sm pl-8">
                                  {formatDate(mov.fecha_movimiento)}
                                </TableCell>
                                <TableCell>{getTipoBadge(mov.tipo)}</TableCell>
                                <TableCell className="whitespace-nowrap" title={mov.concepto}>
                                  {mov.concepto}
                                </TableCell>
                                <TableCell className="text-gray-500 text-sm">
                                  {mov.factura?.numero_completo
                                    ? <button onClick={() => navigate(`/facturacion/${mov.factura.id}`)} className="text-blue-600 hover:underline font-mono">{mov.factura.numero_completo}</button>
                                    : (mov.factura_numero || mov.recibo_numero || mov.referencia_pago || '-')}
                                </TableCell>
                                <TableCell>{getEstadoFacturacionBadge(mov)}</TableCell>
                                <TableCell className="text-right font-medium text-red-600">
                                  {esDebe ? formatNumber(mov.monto, 'currency') : '-'}
                                </TableCell>
                                <TableCell className="text-right font-medium text-green-600">
                                  {esHaber ? formatNumber(mov.monto, 'currency') : '-'}
                                </TableCell>
                                <TableCell className="text-right font-bold">
                                  {formatNumber(mov.saldo_posterior, 'currency')}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setMovimientoDetalle(mov)}
                                      title="Ver detalle"
                                    >
                                      <Eye className="h-4 w-4 text-gray-500" />
                                    </Button>
                                    {(mov.tipo === 'ajuste' || mov.tipo === 'pago') && (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => abrirModalEditar(mov)}
                                          title={mov.tipo === 'pago' ? 'Editar pago' : 'Editar ajuste'}
                                        >
                                          <Pencil className="h-4 w-4 text-gray-500" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => setMovimientoAEliminar(mov)}
                                          title={mov.tipo === 'pago' ? 'Eliminar pago' : 'Eliminar ajuste'}
                                        >
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                      </>
                                    )}
                                    {mov.tipo === 'cargo' &&
                                      puedeEliminarRemito &&
                                      mov.remito?.numero && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => setRemitoAEliminar(mov)}
                                          title="Eliminar remito"
                                        >
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                      )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-gray-500">
                    Página {page + 1} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay movimientos registrados</p>
              {(fechaDesde || fechaHasta || tipoFiltro !== 'todos') && (
                <Button variant="link" onClick={limpiarFiltros}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalle de Movimiento */}
      {movimientoDetalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-4">
          <Card className="w-full max-w-lg m-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detalle del Movimiento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                {getTipoBadge(movimientoDetalle.tipo)}
                <span className="text-sm text-gray-500 font-mono">
                  {formatDate(movimientoDetalle.fecha_movimiento)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Concepto</p>
                  <p className="font-medium">{movimientoDetalle.concepto || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Monto</p>
                  <p className="font-mono font-semibold">
                    {formatNumber(movimientoDetalle.monto, 'currency')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Saldo anterior</p>
                  <p className="font-mono">
                    {formatNumber(movimientoDetalle.saldo_anterior, 'currency')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Saldo posterior</p>
                  <p className="font-mono font-bold">
                    {formatNumber(movimientoDetalle.saldo_posterior, 'currency')}
                  </p>
                </div>
                {movimientoDetalle.medio_pago && (
                  <div>
                    <p className="text-gray-500 text-xs">Medio de pago</p>
                    <p className="font-medium capitalize">
                      {movimientoDetalle.medio_pago.replace('_', ' ')}
                    </p>
                  </div>
                )}
                {movimientoDetalle.referencia_pago && (
                  <div>
                    <p className="text-gray-500 text-xs">Referencia</p>
                    <p className="font-mono">{movimientoDetalle.referencia_pago}</p>
                  </div>
                )}
                {movimientoDetalle.recibo_numero && (
                  <div>
                    <p className="text-gray-500 text-xs">Recibo</p>
                    <p className="font-mono">{movimientoDetalle.recibo_numero}</p>
                  </div>
                )}
                {movimientoDetalle.factura_numero && (
                  <div>
                    <p className="text-gray-500 text-xs">Factura</p>
                    <p className="font-mono">{movimientoDetalle.factura_numero}</p>
                  </div>
                )}
                {movimientoDetalle.factura && (
                  <div className="col-span-2">
                    <p className="text-gray-500 text-xs mb-1">Factura vinculada</p>
                    <button
                      onClick={() => navigate(`/facturacion/${movimientoDetalle.factura.id}`)}
                      className="text-blue-600 hover:underline font-mono text-sm"
                    >
                      {movimientoDetalle.factura.numero_completo} —{' '}
                      {formatNumber(movimientoDetalle.factura.total, 'currency')}
                    </button>
                  </div>
                )}
                {movimientoDetalle.registrado_por_nombre && (
                  <div>
                    <p className="text-gray-500 text-xs">Registrado por</p>
                    <p>{movimientoDetalle.registrado_por_nombre}</p>
                  </div>
                )}
                {movimientoDetalle.created_at && (
                  <div>
                    <p className="text-gray-500 text-xs">Fecha de carga</p>
                    <p className="font-mono text-xs">
                      {new Date(movimientoDetalle.created_at).toLocaleString('es-AR')}
                    </p>
                  </div>
                )}
              </div>

              {movimientoDetalle.remito && (
                <div className="pt-3 border-t space-y-2">
                  <p className="text-gray-700 text-sm font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Productos del remito {movimientoDetalle.remito.numero}
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 text-xs">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium">Código</th>
                          <th className="px-2 py-1.5 text-left font-medium">Producto</th>
                          <th className="px-2 py-1.5 text-right font-medium">Cant.</th>
                          <th className="px-2 py-1.5 text-right font-medium">P. Unit.</th>
                          <th className="px-2 py-1.5 text-right font-medium">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movimientoDetalle.remito.detalles?.length ? (
                          movimientoDetalle.remito.detalles.map((d: any) => (
                            <tr key={d.id} className="border-t">
                              <td className="px-2 py-1.5 font-mono text-xs">{d.producto_codigo || '-'}</td>
                              <td className="px-2 py-1.5">{d.producto_nombre || '-'}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{d.cantidad}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{formatNumber(d.precio_unitario, 'currency')}</td>
                              <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatNumber(d.subtotal, 'currency')}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-2 py-3 text-center text-gray-400 text-xs">
                              El remito no tiene productos cargados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-gray-50 text-xs">
                        <tr className="border-t">
                          <td colSpan={4} className="px-2 py-1.5 text-right text-gray-600">Subtotal</td>
                          <td className="px-2 py-1.5 text-right font-mono">{formatNumber(movimientoDetalle.remito.subtotal, 'currency')}</td>
                        </tr>
                        {movimientoDetalle.remito.descuento > 0 && (
                          <tr>
                            <td colSpan={4} className="px-2 py-1.5 text-right text-gray-600">Descuento</td>
                            <td className="px-2 py-1.5 text-right font-mono text-red-600">- {formatNumber(movimientoDetalle.remito.descuento, 'currency')}</td>
                          </tr>
                        )}
                        <tr className="border-t">
                          <td colSpan={4} className="px-2 py-1.5 text-right font-semibold">Total</td>
                          <td className="px-2 py-1.5 text-right font-mono font-bold">{formatNumber(movimientoDetalle.remito.total, 'currency')}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {movimientoDetalle.remito.peso_total_kg != null && movimientoDetalle.remito.peso_total_kg > 0 && (
                    <p className="text-xs text-gray-500">
                      Peso total: <span className="font-mono">{movimientoDetalle.remito.peso_total_kg} kg</span>
                    </p>
                  )}
                </div>
              )}

              {movimientoDetalle.pago_detalle && (
                <div className="pt-3 border-t space-y-3">
                  <p className="text-gray-700 text-sm font-semibold flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Detalle del pago
                  </p>

                  {movimientoDetalle.pago_detalle.cheque && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1 text-sm">
                      <p className="font-semibold text-blue-900 mb-1">
                        Cheque {movimientoDetalle.pago_detalle.cheque.tipo === 'echeq' ? '(e-Cheq)' : '(físico)'}
                        {movimientoDetalle.pago_detalle.cheque.estado && (
                          <Badge className="ml-2 bg-blue-100 text-blue-700 capitalize">
                            {movimientoDetalle.pago_detalle.cheque.estado.replace('_', ' ')}
                          </Badge>
                        )}
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div>
                          <span className="text-gray-500 text-xs">Número: </span>
                          <span className="font-mono">{movimientoDetalle.pago_detalle.cheque.numero}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Banco emisor: </span>
                          <span>{movimientoDetalle.pago_detalle.cheque.banco_origen || '-'}</span>
                        </div>
                        {movimientoDetalle.pago_detalle.cheque.fecha_emision && (
                          <div>
                            <span className="text-gray-500 text-xs">Emisión: </span>
                            <span className="font-mono">{formatDate(movimientoDetalle.pago_detalle.cheque.fecha_emision)}</span>
                          </div>
                        )}
                        {movimientoDetalle.pago_detalle.cheque.fecha_vencimiento && (
                          <div>
                            <span className="text-gray-500 text-xs">Vencimiento: </span>
                            <span className="font-mono">{formatDate(movimientoDetalle.pago_detalle.cheque.fecha_vencimiento)}</span>
                          </div>
                        )}
                        {movimientoDetalle.pago_detalle.cheque.librador && (
                          <div>
                            <span className="text-gray-500 text-xs">Librador: </span>
                            <span>{movimientoDetalle.pago_detalle.cheque.librador}</span>
                          </div>
                        )}
                        {movimientoDetalle.pago_detalle.cheque.cuit_librador && (
                          <div>
                            <span className="text-gray-500 text-xs">CUIT: </span>
                            <span className="font-mono">{movimientoDetalle.pago_detalle.cheque.cuit_librador}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(movimientoDetalle.pago_detalle.banco_origen ||
                    movimientoDetalle.pago_detalle.numero_transferencia ||
                    movimientoDetalle.pago_detalle.cuenta_destino) && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1 text-sm">
                      <p className="font-semibold text-green-900 mb-1">Transferencia</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {movimientoDetalle.pago_detalle.banco_origen && (
                          <div>
                            <span className="text-gray-500 text-xs">Banco origen: </span>
                            <span>{movimientoDetalle.pago_detalle.banco_origen}</span>
                          </div>
                        )}
                        {movimientoDetalle.pago_detalle.numero_transferencia && (
                          <div>
                            <span className="text-gray-500 text-xs">N° operación: </span>
                            <span className="font-mono">{movimientoDetalle.pago_detalle.numero_transferencia}</span>
                          </div>
                        )}
                        {movimientoDetalle.pago_detalle.cuenta_destino && (
                          <div className="col-span-2">
                            <span className="text-gray-500 text-xs">Cuenta destino: </span>
                            <span>
                              {movimientoDetalle.pago_detalle.cuenta_destino.nombre}
                              {movimientoDetalle.pago_detalle.cuenta_destino.banco && ` — ${movimientoDetalle.pago_detalle.cuenta_destino.banco}`}
                              {movimientoDetalle.pago_detalle.cuenta_destino.numero_cuenta && ` (${movimientoDetalle.pago_detalle.cuenta_destino.numero_cuenta})`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {movimientoDetalle.pago_detalle.caja && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-1 text-sm">
                      <p className="font-semibold text-yellow-900 mb-1">Ingreso en caja</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div>
                          <span className="text-gray-500 text-xs">Caja Nº: </span>
                          <span className="font-mono">{movimientoDetalle.pago_detalle.caja.caja_numero ?? '-'}</span>
                        </div>
                        {movimientoDetalle.pago_detalle.caja.caja_fecha && (
                          <div>
                            <span className="text-gray-500 text-xs">Fecha caja: </span>
                            <span className="font-mono">{formatDate(movimientoDetalle.pago_detalle.caja.caja_fecha)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {movimientoDetalle.pago_detalle.fecha_valor && (
                    <p className="text-xs text-gray-500">
                      Fecha valor (impacto en tesorería):{' '}
                      <span className="font-mono">{formatDate(movimientoDetalle.pago_detalle.fecha_valor)}</span>
                    </p>
                  )}
                </div>
              )}

              {movimientoDetalle.notas && (
                <div className="pt-2 border-t">
                  <p className="text-gray-500 text-xs mb-1">Notas</p>
                  <p className="text-sm whitespace-pre-wrap">{movimientoDetalle.notas}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                {(movimientoDetalle.tipo === 'ajuste' || movimientoDetalle.tipo === 'pago') && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const mov = movimientoDetalle;
                        setMovimientoDetalle(null);
                        abrirModalEditar(mov);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        const mov = movimientoDetalle;
                        setMovimientoDetalle(null);
                        setMovimientoAEliminar(mov);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </Button>
                  </>
                )}
                <Button onClick={() => setMovimientoDetalle(null)}>Cerrar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {movimientoAEliminar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-4">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                {movimientoAEliminar.tipo === 'pago' ? 'Eliminar Pago' : 'Eliminar Ajuste'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                ¿Confirmás eliminar este {movimientoAEliminar.tipo === 'pago' ? 'pago' : 'ajuste'}? Esta acción no se puede deshacer.
              </p>

              <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Fecha:</span>
                  <span>{formatDate(movimientoAEliminar.fecha_movimiento)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Concepto:</span>
                  <span className="font-medium">{movimientoAEliminar.concepto}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Monto:</span>
                  <span className="font-mono font-semibold">
                    {formatNumber(movimientoAEliminar.monto, 'currency')}
                  </span>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm text-yellow-800">
                Los saldos de los movimientos posteriores se recalculan
                automáticamente.
                {movimientoAEliminar.tipo === 'pago' && (
                  <> No se revierten movimientos de tesorería, caja ni cheques asociados: ajustalos manualmente si corresponde.</>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setMovimientoAEliminar(null)}
                  disabled={eliminarMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmarEliminar}
                  disabled={eliminarMutation.isPending}
                >
                  {eliminarMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Edición de Movimiento (Ajuste o Pago) */}
      {editandoMovimientoId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-4">
          <Card className="w-full max-w-lg m-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5" />
                {editandoTipo === 'pago' ? 'Editar Pago' : 'Editar Ajuste'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm text-yellow-800">
                Cambiar monto recalcula automáticamente los saldos de este
                movimiento y de todos los posteriores.
                {editandoTipo === 'pago' && (
                  <> No se actualizan movimientos de tesorería, caja ni cheques asociados.</>
                )}
              </div>

              {editandoTipo !== 'pago' && (
                <div className="space-y-2">
                  <Label>Tipo de ajuste *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditDireccion('aumentar')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition ${
                        editDireccion === 'aumentar'
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm font-medium">Aumentar deuda</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditDireccion('disminuir')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition ${
                        editDireccion === 'disminuir'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <TrendingDown className="h-4 w-4" />
                      <span className="text-sm font-medium">Disminuir deuda</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monto *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editMonto}
                    onChange={(e) => setEditMonto(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha *</Label>
                  <Input
                    type="date"
                    value={editFecha}
                    onChange={(e) => setEditFecha(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Concepto *</Label>
                <Input
                  value={editConcepto}
                  onChange={(e) => setEditConcepto(e.target.value)}
                  maxLength={255}
                />
              </div>

              <div className="space-y-2">
                <Label>Notas internas</Label>
                <Textarea
                  value={editNotas}
                  onChange={(e) => setEditNotas(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="ghost" onClick={cerrarModalEditar}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleGuardarEdicion}
                  disabled={
                    !editMonto ||
                    parseFloat(editMonto) <= 0 ||
                    !editConcepto.trim() ||
                    !editFecha ||
                    editMutation.isPending
                  }
                >
                  {editMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Pencil className="h-4 w-4 mr-2" />
                  )}
                  Guardar Cambios
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Ajuste Manual de Saldo */}
      {showAjusteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-4">
          <Card className="w-full max-w-lg m-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sliders className="h-5 w-5" />
                Ajustar Saldo Manualmente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium">{cliente.nombre_fantasia || cliente.razon_social}</p>
                <p className="text-sm text-gray-500">
                  Saldo actual:{' '}
                  <span className={`font-semibold ${saldoActualNum > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatNumber(saldoActualNum, 'currency')}
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <Label>Tipo de ajuste *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAjusteDireccion('aumentar')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition ${
                      ajusteDireccion === 'aumentar'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">Aumentar deuda</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAjusteDireccion('disminuir')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition ${
                      ajusteDireccion === 'disminuir'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-sm font-medium">Disminuir deuda</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monto *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={ajusteMonto}
                    onChange={(e) => setAjusteMonto(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha *</Label>
                  <Input
                    type="date"
                    value={ajusteFecha}
                    onChange={(e) => setAjusteFecha(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Concepto *</Label>
                <Input
                  value={ajusteConcepto}
                  onChange={(e) => setAjusteConcepto(e.target.value)}
                  placeholder="Ej: Bonificación acordada, Diferencia por redondeo, Nota de crédito manual..."
                  maxLength={255}
                />
                <p className="text-xs text-gray-400">
                  Describí el motivo del ajuste. Queda registrado en el historial.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Notas internas</Label>
                <Textarea
                  value={ajusteNotas}
                  onChange={(e) => setAjusteNotas(e.target.value)}
                  placeholder="Detalles adicionales (opcional)..."
                  rows={2}
                />
              </div>

              {ajusteMonto && parseFloat(ajusteMonto) > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Saldo actual:</span>
                    <span className="font-mono">{formatNumber(saldoActualNum, 'currency')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      Ajuste ({ajusteDireccion === 'aumentar' ? '+' : '−'}):
                    </span>
                    <span className={`font-mono font-semibold ${ajusteDireccion === 'aumentar' ? 'text-red-600' : 'text-green-600'}`}>
                      {ajusteDireccion === 'aumentar' ? '+' : '−'}
                      {formatNumber(parseFloat(ajusteMonto), 'currency')}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-blue-200">
                    <span className="font-medium">Saldo resultante:</span>
                    <span className={`font-mono font-bold ${saldoPreview > 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {formatNumber(saldoPreview, 'currency')}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="ghost" onClick={cerrarModalAjuste}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleRegistrarAjuste}
                  disabled={
                    !ajusteMonto ||
                    parseFloat(ajusteMonto) <= 0 ||
                    !ajusteConcepto.trim() ||
                    !ajusteFecha ||
                    ajusteMutation.isPending
                  }
                >
                  {ajusteMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sliders className="h-4 w-4 mr-2" />
                  )}
                  Registrar Ajuste
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Cobranza Completo */}
      {showPagoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-4">
          <Card className="w-full max-w-2xl m-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Registrar Cobranza
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Info del cliente */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium">{cliente.nombre_fantasia || cliente.razon_social}</p>
                <p className="text-sm text-gray-500">
                  Deuda actual: <span className="font-semibold text-red-600">{formatNumber(cliente.saldo_cuenta_corriente, 'currency')}</span>
                </p>
              </div>

              <Tabs defaultValue="basico" className="w-full">
                <TabsList
                  className={`grid w-full ${
                    cobranzaMedio === 'cheque' || cobranzaMedio === 'transferencia'
                      ? 'grid-cols-4'
                      : 'grid-cols-3'
                  }`}
                >
                  <TabsTrigger value="basico">Datos Básicos</TabsTrigger>
                  {(cobranzaMedio === 'cheque' || cobranzaMedio === 'transferencia') && (
                    <TabsTrigger value="detalle">
                      {cobranzaMedio === 'cheque' ? 'Cheque' : 'Transferencia'}
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="asociar">Asociar a</TabsTrigger>
                  <TabsTrigger value="facturacion">Facturación</TabsTrigger>
                </TabsList>

                <TabsContent value="basico" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Monto a cobrar *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={cobranzaMonto}
                        onChange={(e) => setCobranzaMonto(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Medio de Pago *</Label>
                      <Select value={cobranzaMedio} onValueChange={(v) => setCobranzaMedio(v as MedioPago)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MEDIOS_PAGO.map((mp) => (
                            <SelectItem key={mp.value} value={mp.value}>
                              {mp.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Referencia de Pago</Label>
                    <Input
                      value={cobranzaReferencia}
                      onChange={(e) => setCobranzaReferencia(e.target.value)}
                      placeholder="Nro. transferencia, cheque, etc."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Concepto (opcional)</Label>
                    <Input
                      value={cobranzaConcepto}
                      onChange={(e) => setCobranzaConcepto(e.target.value)}
                      placeholder="Se genera automáticamente si no se especifica"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Textarea
                      value={cobranzaNotas}
                      onChange={(e) => setCobranzaNotas(e.target.value)}
                      placeholder="Observaciones adicionales..."
                      rows={2}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="detalle" className="space-y-4 mt-4">
                  {cobranzaMedio === 'cheque' && (
                    <>
                      <p className="text-sm text-gray-500">
                        Se crea automáticamente un cheque en cartera vinculado a este pago.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Número de cheque *</Label>
                          <Input
                            value={chequeNumero}
                            onChange={(e) => setChequeNumero(e.target.value)}
                            placeholder="12345678"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo *</Label>
                          <Select
                            value={chequeTipo}
                            onValueChange={(v) => setChequeTipo(v as 'fisico' | 'echeq')}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIPOS_CHEQUE.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Banco emisor *</Label>
                        <Select value={chequeBanco} onValueChange={setChequeBanco}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar banco" />
                          </SelectTrigger>
                          <SelectContent>
                            {BANCOS_ARGENTINA.map((b) => (
                              <SelectItem key={b} value={b}>
                                {b}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Fecha de emisión</Label>
                          <Input
                            type="date"
                            value={chequeFechaEmision}
                            onChange={(e) => setChequeFechaEmision(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Fecha de vencimiento *</Label>
                          <Input
                            type="date"
                            value={chequeFechaVencimiento}
                            onChange={(e) => setChequeFechaVencimiento(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Librador</Label>
                          <Input
                            value={chequeLibrador}
                            onChange={(e) => setChequeLibrador(e.target.value)}
                            placeholder="Nombre de quién firma"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>CUIT librador</Label>
                          <Input
                            value={chequeCuitLibrador}
                            onChange={(e) => setChequeCuitLibrador(e.target.value)}
                            placeholder="XX-XXXXXXXX-X"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {cobranzaMedio === 'transferencia' && (
                    <>
                      <p className="text-sm text-gray-500">
                        Datos de la transferencia recibida.
                      </p>
                      <div className="space-y-2">
                        <Label>Banco de origen</Label>
                        <Select
                          value={transferenciaBanco || '_none'}
                          onValueChange={(v) =>
                            setTransferenciaBanco(v === '_none' ? '' : v)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar banco" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Sin especificar</SelectItem>
                            {BANCOS_ARGENTINA.map((b) => (
                              <SelectItem key={b} value={b}>
                                {b}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Número de transferencia / comprobante</Label>
                        <Input
                          value={transferenciaNumero}
                          onChange={(e) => setTransferenciaNumero(e.target.value)}
                          placeholder="Ej: 1234567890"
                        />
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="asociar" className="space-y-4 mt-4">
                  <p className="text-sm text-gray-500">
                    Opcionalmente podés asociar esta cobranza a un pedido o lote específico.
                  </p>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Pedido
                    </Label>
                    <Select value={cobranzaPedidoId || "_none"} onValueChange={(v) => setCobranzaPedidoId(v === "_none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin asociar a pedido" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Sin asociar a pedido</SelectItem>
                        {pedidosPendientes?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.numero} - {formatNumber(p.saldo_pendiente, 'currency')} pendiente
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {pedidosPendientes?.length === 0 && (
                      <p className="text-xs text-gray-400">No hay pedidos con saldo pendiente</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Lote de Producción
                    </Label>
                    <Select value={cobranzaLoteId || "_none"} onValueChange={(v) => setCobranzaLoteId(v === "_none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin asociar a lote" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Sin asociar a lote</SelectItem>
                        {lotesCliente?.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.numero} - {l.descripcion || l.estado}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {lotesCliente?.length === 0 && (
                      <p className="text-xs text-gray-400">No hay lotes registrados para este cliente</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="facturacion" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Estado de Facturación
                    </Label>
                    <Select value={cobranzaEstadoFacturacion} onValueChange={setCobranzaEstadoFacturacion}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS_FACTURACION.map((ef) => (
                          <SelectItem key={ef.value} value={ef.value}>
                            {ef.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {cobranzaEstadoFacturacion !== 'sin_facturar' && (
                    <div className="space-y-2">
                      <Label>Número de Factura/Ticket</Label>
                      <Input
                        value={cobranzaFacturaNumero}
                        onChange={(e) => setCobranzaFacturaNumero(e.target.value)}
                        placeholder="Ej: 0001-00001234"
                      />
                    </div>
                  )}

                  <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm">
                    <p className="font-medium">Nota sobre facturación</p>
                    <p className="mt-1">
                      Podés registrar el cobro ahora y facturarlo después, o indicar que ya está facturado
                      ingresando el número de comprobante.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="ghost" onClick={cerrarModalCobranza}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleRegistrarCobranza}
                  disabled={!cobranzaMonto || parseFloat(cobranzaMonto) <= 0 || cobranzaMutation.isPending}
                >
                  {cobranzaMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  Registrar Cobranza
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal doble confirmación: eliminar remito */}
      {remitoAEliminar && (
        <ConfirmDeleteStrict
          open={!!remitoAEliminar}
          onClose={() => setRemitoAEliminar(null)}
          onConfirm={async (motivo) => {
            const remitoId = remitoAEliminar.remito?.id;
            if (!remitoId) {
              toast({
                title: 'No se puede eliminar',
                description: 'Este movimiento no tiene un remito asociado.',
                variant: 'destructive',
              });
              return;
            }
            await eliminarRemitoMutation.mutateAsync({ remitoId, motivo });
          }}
          title={`Eliminar remito ${remitoAEliminar.remito?.numero || ''}`}
          description="Esto quitará el remito del sistema y revertirá el impacto en la cuenta corriente. Quedará registro en la solapa Eliminados del módulo Historial de Lavados."
          confirmationText={remitoAEliminar.remito?.numero || 'ELIMINAR'}
          extraContent={
            <div className="rounded-md bg-gray-50 border p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Cliente:</span>
                <span className="font-medium">{cliente?.razon_social}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Fecha:</span>
                <span>{formatDate(remitoAEliminar.fecha_movimiento)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Monto a revertir:</span>
                <span className="font-semibold text-red-600">
                  {formatNumber(remitoAEliminar.monto, 'currency')}
                </span>
              </div>
            </div>
          }
        />
      )}
    </div>
  );
}
