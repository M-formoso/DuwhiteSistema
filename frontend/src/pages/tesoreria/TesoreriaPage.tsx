/**
 * Página de Tesorería - Gestión de cheques y movimientos
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Plus,
  FileCheck,
  FileText,
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Eye,
  Banknote,
  CreditCard,
  ArrowRight,
  ArrowRightLeft,
  Building2,
  Calendar,
  User,
  Pencil,
  Trash2,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Info,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputMoneda } from '@/components/ui/input-moneda';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Combobox } from '@/components/ui/combobox';
import { useToast } from '@/hooks/use-toast';

import { tesoreriaService } from '@/services/tesoreriaService';
import { clienteService } from '@/services/clienteService';
import { proveedorService } from '@/services/proveedorService';
import { categoriaGastoService, type CategoriaGasto } from '@/services/categoriaGastoService';
import { finanzasService } from '@/services/finanzasService';
import { TesoreriaGraficos } from '@/components/tesoreria/TesoreriaGraficos';
import { HistorialAjustesCuenta } from '@/components/tesoreria/HistorialAjustesCuenta';
import { formatNumber, formatDate, getLocalDateString } from '@/utils/formatters';
import { toastApiError } from '@/utils/apiErrors';
import {
  TIPOS_CHEQUE,
  ORIGENES_CHEQUE,
  ESTADOS_CHEQUE,
  METODOS_PAGO_TESORERIA,
  BANCOS_ARGENTINA,
} from '@/types/tesoreria';
import type {
  ChequeList,
  ChequeCreate,
  ChequeUpdate,
  MovimientoTesoreriaCreate,
  MovimientoTesoreriaUpdate,
  MovimientoConsolidado,
  EstadoCheque,
} from '@/types/tesoreria';
import type { CuentaBancaria } from '@/types/finanzas';
import { TIPOS_CUENTA_BANCARIA, MONEDAS } from '@/types/finanzas';

// Rango razonable de años para fechas de cheques (protege contra tipeos
// como "0026-02-31" o años absurdamente futuros).
const CHEQUE_ANIO_MIN = 2000;
const CHEQUE_ANIO_MAX = 2100;

/**
 * Valida una fecha YYYY-MM-DD proveniente de <input type="date">.
 * Devuelve mensaje específico o null si es válida.
 */
function validarFechaCheque(valor: string, etiqueta: string): string | null {
  if (!valor) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return `${etiqueta}: formato inválido, use DD/MM/AAAA.`;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(year, month - 1, day);
  const real = d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
  if (!real) {
    return `${etiqueta}: ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year} no existe en el calendario.`;
  }
  if (year < CHEQUE_ANIO_MIN || year > CHEQUE_ANIO_MAX) {
    return `${etiqueta}: el año debe estar entre ${CHEQUE_ANIO_MIN} y ${CHEQUE_ANIO_MAX}.`;
  }
  return null;
}

export default function TesoreriaPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Estados
  const [activeTab, setActiveTab] = useState('movimientos');
  const [showChequeModal, setShowChequeModal] = useState(false);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [showAccionChequeModal, setShowAccionChequeModal] = useState(false);
  const [accionCheque, setAccionCheque] = useState<'depositar' | 'cobrar' | 'rechazar' | 'entregar' | null>(null);
  const [chequeSeleccionado, setChequeSeleccionado] = useState<ChequeList | null>(null);
  const [editingCheque, setEditingCheque] = useState<ChequeList | null>(null);
  const [showDeleteChequeDialog, setShowDeleteChequeDialog] = useState(false);
  const [chequeAEliminar, setChequeAEliminar] = useState<ChequeList | null>(null);
  const [showCuentaBancariaModal, setShowCuentaBancariaModal] = useState(false);
  const [showEditMovimientoModal, setShowEditMovimientoModal] = useState(false);
  const [movimientoAEditar, setMovimientoAEditar] = useState<MovimientoConsolidado | null>(null);
  const [editMovimientoForm, setEditMovimientoForm] = useState<MovimientoTesoreriaUpdate>({});

  // Nota: el flujo de "caja abierta/cerrada" fue eliminado. Ahora todo pasa
  // por cuentas nombradas (banco / efectivo / billetera_virtual) que se
  // gestionan en la tab Cuentas. Los movimientos siempre se imputan a una
  // cuenta específica.

  // Edición manual de saldo de una cuenta (ajuste puntual, no reemplaza el
  // flujo normal de movimientos). Cada edición queda registrada en
  // ajustes_manuales_cuenta con quién/cuándo/motivo para auditoría.
  const [editarSaldoCuenta, setEditarSaldoCuenta] = useState<CuentaBancaria | null>(null);
  const [nuevoSaldoCuenta, setNuevoSaldoCuenta] = useState<number | null>(null);
  const [motivoAjuste, setMotivoAjuste] = useState<string>('');
  // IDs de cuentas con su historial de ajustes expandido en pantalla.
  const [historialAbierto, setHistorialAbierto] = useState<Set<string>>(new Set());

  // Transferencia entre dos cuentas propias (banco / efectivo / billetera).
  const [showTransferenciaModal, setShowTransferenciaModal] = useState(false);
  const [transferenciaForm, setTransferenciaForm] = useState({
    cuenta_origen: '' as string,
    cuenta_destino: '' as string,
    monto: '',
    fecha: getLocalDateString(),
    concepto: '',
    notas: '',
  });

  // Detalle de movimiento (modal al clickear una fila del listado).
  const [movimientoDetalle, setMovimientoDetalle] = useState<MovimientoConsolidado | null>(null);

  // Form cuenta bancaria
  const [cuentaBancariaForm, setCuentaBancariaForm] = useState({
    nombre: '',
    banco: '',
    tipo_cuenta: 'cuenta_corriente' as string,
    numero_cuenta: '',
    cbu: '',
    alias: '',
    titular: '',
    cuit_titular: '',
    saldo_actual: 0,
    es_principal: false,
    notas: '',
    moneda: 'ARS' as string,
  });

  // Filtros cheques
  const [chequeFiltroEstado, setChequeFiltroEstado] = useState<string>('en_cartera');
  const [chequeFiltroBuscar, setChequeFiltroBuscar] = useState('');
  const [chequeFiltroTipo, setChequeFiltroTipo] = useState<string>('');

  // Filtros movimientos
  const [movFiltroTipo, setMovFiltroTipo] = useState<string>('');
  const [movFiltroBuscar, setMovFiltroBuscar] = useState('');
  const [movFiltroFechaDesde, setMovFiltroFechaDesde] = useState<string>('');
  const [movFiltroFechaHasta, setMovFiltroFechaHasta] = useState<string>('');
  const [movFiltroIngresosEgresos, setMovFiltroIngresosEgresos] = useState<'todos' | 'ingresos' | 'egresos'>('todos');

  // Form cheque
  const [chequeForm, setChequeForm] = useState<ChequeCreate>({
    numero: '',
    tipo: 'fisico',
    origen: 'recibido_cliente',
    monto: 0,
    fecha_vencimiento: getLocalDateString(),
    banco_origen: '',
    cliente_id: null,
    proveedor_id: null,
    librador: '',
    cuit_librador: '',
    notas: '',
  });

  // Form movimiento
  const [movimientoForm, setMovimientoForm] = useState<MovimientoTesoreriaCreate>({
    tipo: 'ingreso_transferencia',
    concepto: '',
    monto: 0,
    es_ingreso: true,
    fecha_movimiento: getLocalDateString(),
    metodo_pago: 'transferencia',
    cliente_id: null,
    proveedor_id: null,
    cuenta_destino_id: null,
  });

  // Datos del cheque dentro del modal de movimiento (cuando metodo_pago = 'cheque').
  // Reemplazan al viejo modal "Nuevo Cheque" separado.
  const [movChequeNumero, setMovChequeNumero] = useState('');
  const [movChequeTipo, setMovChequeTipo] = useState<'fisico' | 'echeq'>('fisico');
  const [movChequeBanco, setMovChequeBanco] = useState('');
  const [movChequeFechaEmision, setMovChequeFechaEmision] = useState('');
  const [movChequeFechaVencimiento, setMovChequeFechaVencimiento] = useState('');
  const [movChequeLibrador, setMovChequeLibrador] = useState('');
  const [movChequeCuitLibrador, setMovChequeCuitLibrador] = useState('');
  const [movChequeImagen, setMovChequeImagen] = useState<File | null>(null);

  // Form acción cheque
  const [accionForm, setAccionForm] = useState({
    cuenta_destino_id: '',
    fecha: getLocalDateString(),
    motivo_rechazo: '',
    concepto: '',
    proveedor_id: '',
    notas: '',
  });

  // Detectar parámetros de URL para abrir modal de movimiento con cliente pre-seleccionado
  useEffect(() => {
    const tipo = searchParams.get('tipo');
    const clienteId = searchParams.get('cliente_id');
    const clienteNombre = searchParams.get('cliente_nombre');

    if (tipo === 'ingreso' && clienteId) {
      // Abrir modal de nuevo movimiento con cliente pre-seleccionado
      setMovimientoForm({
        tipo: 'ingreso_transferencia',
        concepto: clienteNombre ? `Pago de ${clienteNombre}` : 'Pago de cliente',
        monto: 0,
        es_ingreso: true,
        fecha_movimiento: getLocalDateString(),
        metodo_pago: 'transferencia',
        cliente_id: clienteId,
        proveedor_id: null,
      });
      setShowMovimientoModal(true);
      setActiveTab('movimientos');
      // Limpiar los parámetros de URL
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Queries
  const { data: resumen, isLoading: loadingResumen } = useQuery({
    queryKey: ['tesoreria-resumen'],
    queryFn: () => tesoreriaService.resumen.getResumen(),
  });

  const { data: cheques, isLoading: loadingCheques } = useQuery({
    queryKey: ['tesoreria-cheques', chequeFiltroEstado, chequeFiltroTipo, chequeFiltroBuscar],
    queryFn: () =>
      tesoreriaService.cheques.getCheques({
        estado: chequeFiltroEstado || undefined,
        tipo: chequeFiltroTipo || undefined,
        buscar: chequeFiltroBuscar || undefined,
        limit: 100,
      }),
  });

  const { data: movimientos, isLoading: loadingMovimientos } = useQuery({
    queryKey: ['tesoreria-movimientos', movFiltroTipo, movFiltroBuscar, movFiltroFechaDesde, movFiltroFechaHasta, movFiltroIngresosEgresos],
    queryFn: () =>
      tesoreriaService.movimientos.getMovimientosConsolidados({
        tipo: movFiltroTipo || undefined,
        buscar: movFiltroBuscar || undefined,
        fecha_desde: movFiltroFechaDesde || undefined,
        fecha_hasta: movFiltroFechaHasta || undefined,
        es_ingreso: movFiltroIngresosEgresos === 'todos' ? undefined : movFiltroIngresosEgresos === 'ingresos',
        limit: 500,
      }),
  });

  // Usar totales del backend (ya calculados en el endpoint consolidado)
  const movimientosFiltrados = movimientos?.items || [];
  const totalIngresosFiltered = movimientos?.total_ingresos || 0;
  const totalEgresosFiltered = movimientos?.total_egresos || 0;
  const saldoFiltered = totalIngresosFiltered - totalEgresosFiltered;

  const { data: clientes, isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes-lista'],
    queryFn: () => clienteService.getClientes({ limit: 100, activo: true }),
  });

  const { data: proveedores, isLoading: loadingProveedores } = useQuery({
    queryKey: ['proveedores-lista'],
    queryFn: () => proveedorService.getProveedores({ limit: 100, solo_activos: true }),
  });

  // Categorías de gasto (seed de la casa + las que agregue la admin desde la UI).
  const { data: categoriasGasto = [], isLoading: loadingCategorias } = useQuery<CategoriaGasto[]>({
    queryKey: ['categorias-gasto'],
    queryFn: () => categoriaGastoService.list(true),
  });

  // Toggle del modal de egreso: "Pagás a: Proveedor | Categoría". Default
  // "categoria" porque la mayoría de los egresos de la casa son recurrentes
  // (IVA, EPEC, sueldos) y no proveedores concretos.
  const [imputacionEgreso, setImputacionEgreso] = useState<'proveedor' | 'categoria'>('categoria');
  const [nuevaCategoriaDialog, setNuevaCategoriaDialog] = useState(false);
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState('');

  const crearCategoriaGastoMutation = useMutation({
    mutationFn: (nombre: string) => categoriaGastoService.create(nombre),
    onSuccess: (nueva) => {
      queryClient.invalidateQueries({ queryKey: ['categorias-gasto'] });
      // Auto-selecciona la recién creada en el movimiento.
      setMovimientoForm((f) => ({ ...f, categoria_gasto_id: nueva.id }));
      setNuevaCategoriaDialog(false);
      setNuevaCategoriaNombre('');
      toast({ title: `Categoría "${nueva.nombre}" creada` });
    },
    onError: (err) => toastApiError(toast, err, 'No se pudo crear la categoría'),
  });

  // Botón de rescate: carga las 27 categorías del seed si por algún motivo
  // la migración Alembic no las dejó cargadas (DB nueva, rollback, etc).
  const seedCategoriasMutation = useMutation({
    mutationFn: () => categoriaGastoService.seed(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['categorias-gasto'] });
      toast({
        title: `${res.creadas} categorías cargadas`,
        description: `Ya tenés ${res.total_disponibles} categorías disponibles.`,
      });
    },
    onError: (err) => toastApiError(toast, err, 'No se pudo cargar el seed'),
  });

  // Caja abierta/cerrada quedó deprecated — no la consultamos. El saldo
  // "efectivo" ahora es simplemente otra cuenta más (tipo="efectivo").
  const cajaActual = null as null | { saldo_calculado?: number; saldo_inicial?: number; total_ingresos?: number; total_egresos?: number; id?: string };

  // Query Cuentas Bancarias
  const { data: cuentasBancarias, isLoading: loadingCuentas } = useQuery({
    queryKey: ['cuentas-bancarias'],
    queryFn: () => finanzasService.getCuentasBancarias(true),
  });

  // Calcular totales - usar Number() para asegurar que los valores sean numéricos
  const totalBancos = cuentasBancarias?.reduce((acc, c) => acc + Number(c.saldo_actual || 0), 0) || 0;
  const saldoCaja = 0; // deprecated — ya no hay caja efímera

  // El selector del modal usa "cheque" para el flujo especial de cheques y
  // un UUID de cuenta para todo lo demás. Si no hay nada elegido, string vacío.
  const fondoSeleccionado: 'cheque' | string = (() => {
    if (movimientoForm.metodo_pago === 'cheque') return 'cheque';
    return movimientoForm.cuenta_destino_id || '';
  })();

  const saldoFondoActual = (() => {
    if (fondoSeleccionado === 'cheque' || !fondoSeleccionado) return 0;
    const cuenta = cuentasBancarias?.find((c) => c.id === fondoSeleccionado);
    return Number(cuenta?.saldo_actual || 0);
  })();

  const saldoFondoResultante = (() => {
    const monto = Number(movimientoForm.monto || 0);
    if (!monto) return saldoFondoActual;
    const delta = movimientoForm.es_ingreso ? monto : -monto;
    return saldoFondoActual + delta;
  })();

  // Mutations
  const crearMovimientoMutation = useMutation({
    mutationFn: (data: MovimientoTesoreriaCreate) =>
      tesoreriaService.movimientos.crearMovimiento(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria-resumen'] });
      // Si el movimiento era en efectivo, el backend tocó la caja — refrescamos.
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] });
      toast({ title: 'Movimiento registrado correctamente' });
      setShowMovimientoModal(false);
      resetMovimientoForm();
    },
    onError: (err) => toastApiError(toast, err, 'No se pudo registrar el movimiento'),
  });

  // Endpoint unificado: crea Cheque + MovimientoTesoreria en un solo paso.
  const crearMovimientoConChequeMutation = useMutation({
    mutationFn: (payload: Parameters<typeof tesoreriaService.movimientos.crearMovimientoConCheque>[0]) =>
      tesoreriaService.movimientos.crearMovimientoConCheque(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria-cheques'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cc-cliente'] });
      toast({
        title: 'Movimiento y cheque registrados',
        description: movimientoForm.cliente_id
          ? 'El cheque se imputó como pago en la cuenta corriente del cliente.'
          : undefined,
      });
      setShowMovimientoModal(false);
      resetMovimientoForm();
    },
    onError: (err) =>
      toastApiError(toast, err, 'No se pudo registrar el movimiento con cheque'),
  });

  const transferenciaMutation = useMutation({
    mutationFn: () =>
      tesoreriaService.movimientos.transferirEntreCuentas({
        cuenta_origen_id: transferenciaForm.cuenta_origen,
        cuenta_destino_id: transferenciaForm.cuenta_destino,
        monto: Number(transferenciaForm.monto || 0),
        fecha: transferenciaForm.fecha,
        concepto: transferenciaForm.concepto,
        notas: transferenciaForm.notas || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['caja-actual'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-bancarias'] });
      toast({
        title: 'Transferencia registrada',
        description: `${res.cuenta_origen} → ${res.cuenta_destino}`,
      });
      setShowTransferenciaModal(false);
      setTransferenciaForm({
        cuenta_origen: '',
        cuenta_destino: '',
        monto: '',
        fecha: getLocalDateString(),
        concepto: '',
        notas: '',
      });
    },
    onError: (err) => toastApiError(toast, err, 'No se pudo registrar la transferencia'),
  });

  const depositarChequeMutation = useMutation({
    mutationFn: ({ chequeId, data }: { chequeId: string; data: any }) =>
      tesoreriaService.cheques.depositarCheque(chequeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-cheques'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria-resumen'] });
      toast({ title: 'Cheque depositado correctamente' });
      cerrarAccionModal();
    },
    onError: (err) => toastApiError(toast, err, 'No se pudo depositar el cheque'),
  });

  const cobrarChequeMutation = useMutation({
    mutationFn: ({ chequeId, data }: { chequeId: string; data: any }) =>
      tesoreriaService.cheques.cobrarCheque(chequeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-cheques'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria-resumen'] });
      toast({ title: 'Cheque cobrado correctamente' });
      cerrarAccionModal();
    },
    onError: (err) => toastApiError(toast, err, 'No se pudo marcar como cobrado'),
  });

  const rechazarChequeMutation = useMutation({
    mutationFn: ({ chequeId, data }: { chequeId: string; data: any }) =>
      tesoreriaService.cheques.rechazarCheque(chequeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-cheques'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria-resumen'] });
      // Invalidar cuenta corriente (se revierte el pago automáticamente)
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cc-cliente'] });
      toast({
        title: 'Cheque rechazado',
        description: chequeSeleccionado?.cliente_nombre
          ? 'Se revirtió el pago en la cuenta corriente del cliente'
          : undefined,
      });
      cerrarAccionModal();
    },
    onError: (err) => toastApiError(toast, err, 'No se pudo rechazar el cheque'),
  });

  const entregarChequeMutation = useMutation({
    mutationFn: ({ chequeId, data }: { chequeId: string; data: any }) =>
      tesoreriaService.cheques.entregarCheque(chequeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-cheques'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria-resumen'] });
      toast({ title: 'Cheque entregado correctamente' });
      cerrarAccionModal();
    },
    onError: (err) => toastApiError(toast, err, 'No se pudo entregar el cheque'),
  });

  const anularMovimientoMutation = useMutation({
    mutationFn: ({ movimientoId, motivo }: { movimientoId: string; motivo: string }) =>
      tesoreriaService.movimientos.anularMovimiento(movimientoId, { motivo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria-resumen'] });
      toast({ title: 'Movimiento anulado' });
    },
    onError: (err) => toastApiError(toast, err, 'No se pudo anular el movimiento'),
  });

  const actualizarChequeMutation = useMutation({
    mutationFn: ({ chequeId, data }: { chequeId: string; data: ChequeUpdate }) =>
      tesoreriaService.cheques.actualizarCheque(chequeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-cheques'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria-resumen'] });
      toast({ title: 'Cheque actualizado correctamente' });
      setShowChequeModal(false);
      setEditingCheque(null);
      resetChequeForm();
    },
    onError: (err) => toastApiError(toast, err, 'No se pudo actualizar el cheque'),
  });

  const eliminarChequeMutation = useMutation({
    mutationFn: (chequeId: string) => tesoreriaService.cheques.eliminarCheque(chequeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-cheques'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria-resumen'] });
      // Invalidar cuenta corriente (se revierte el pago si era de cliente)
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cc-cliente'] });
      toast({
        title: 'Cheque eliminado',
        description: chequeAEliminar?.cliente_nombre
          ? 'Se revirtió el pago en la cuenta corriente del cliente'
          : undefined,
      });
      setShowDeleteChequeDialog(false);
      setChequeAEliminar(null);
    },
    onError: (err) => toastApiError(toast, err, 'No se pudo eliminar el cheque'),
  });

  const actualizarMovimientoMutation = useMutation({
    mutationFn: ({ movimientoId, data }: { movimientoId: string; data: MovimientoTesoreriaUpdate }) =>
      tesoreriaService.movimientos.actualizarMovimiento(movimientoId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria-resumen'] });
      toast({ title: 'Movimiento actualizado correctamente' });
      setShowEditMovimientoModal(false);
      setMovimientoAEditar(null);
      setEditMovimientoForm({});
    },
    onError: (err) => toastApiError(toast, err, 'No se pudo actualizar el movimiento'),
  });

  const eliminarMovimientoMutation = useMutation({
    mutationFn: (movimientoId: string) => tesoreriaService.movimientos.eliminarMovimiento(movimientoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria-resumen'] });
      toast({ title: 'Movimiento eliminado correctamente' });
    },
    onError: (err) => toastApiError(toast, err, 'No se pudo eliminar el movimiento'),
  });

  const crearCuentaBancariaMutation = useMutation({
    mutationFn: (data: Partial<CuentaBancaria>) => finanzasService.createCuentaBancaria(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cuentas-bancarias'] });
      toast({ title: 'Cuenta bancaria creada correctamente' });
      setShowCuentaBancariaModal(false);
      resetCuentaBancariaForm();
    },
    onError: (err) => toastApiError(toast, err, 'No se pudo crear la cuenta bancaria'),
  });

  const editarSaldoMutation = useMutation({
    mutationFn: () => {
      if (!editarSaldoCuenta || nuevoSaldoCuenta == null) {
        throw new Error('Datos incompletos');
      }
      return finanzasService.updateCuentaBancaria(editarSaldoCuenta.id, {
        saldo_actual: nuevoSaldoCuenta,
        motivo_ajuste: motivoAjuste || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cuentas-bancarias'] });
      queryClient.invalidateQueries({ queryKey: ['ajustes-manuales', editarSaldoCuenta?.id] });
      toast({ title: 'Saldo actualizado y registrado en el historial' });
      setEditarSaldoCuenta(null);
      setNuevoSaldoCuenta(null);
      setMotivoAjuste('');
    },
    onError: (err) => toastApiError(toast, err, 'No se pudo actualizar el saldo'),
  });


  // Helpers
  const resetChequeForm = () => {
    setChequeForm({
      numero: '',
      tipo: 'fisico',
      origen: 'recibido_cliente',
      monto: 0,
      fecha_vencimiento: getLocalDateString(),
      banco_origen: '',
      cliente_id: null,
      proveedor_id: null,
      librador: '',
      cuit_librador: '',
      notas: '',
    });
  };

  const resetMovimientoForm = () => {
    setMovimientoForm({
      tipo: 'ingreso_transferencia',
      concepto: '',
      monto: 0,
      es_ingreso: true,
      fecha_movimiento: getLocalDateString(),
      metodo_pago: 'transferencia',
      cliente_id: null,
      proveedor_id: null,
    });
    setMovChequeNumero('');
    setMovChequeTipo('fisico');
    setMovChequeBanco('');
    setMovChequeFechaEmision('');
    setMovChequeFechaVencimiento('');
    setMovChequeLibrador('');
    setMovChequeCuitLibrador('');
    setMovChequeImagen(null);
  };

  const resetCuentaBancariaForm = () => {
    setCuentaBancariaForm({
      nombre: '',
      banco: '',
      tipo_cuenta: 'cuenta_corriente',
      numero_cuenta: '',
      cbu: '',
      alias: '',
      titular: '',
      cuit_titular: '',
      saldo_actual: 0,
      es_principal: false,
      notas: '',
      moneda: 'ARS',
    });
  };

  const abrirAccionCheque = (cheque: ChequeList, accion: 'depositar' | 'cobrar' | 'rechazar' | 'entregar') => {
    setChequeSeleccionado(cheque);
    setAccionCheque(accion);
    setAccionForm({
      cuenta_destino_id: '',
      fecha: getLocalDateString(),
      motivo_rechazo: '',
      concepto: '',
      proveedor_id: '',
      notas: '',
    });
    setShowAccionChequeModal(true);
  };

  const abrirEditarCheque = (cheque: ChequeList) => {
    setEditingCheque(cheque);
    setChequeForm({
      numero: cheque.numero,
      tipo: cheque.tipo,
      origen: cheque.origen,
      monto: cheque.monto,
      fecha_vencimiento: cheque.fecha_vencimiento,
      banco_origen: cheque.banco_origen || '',
      cliente_id: null,
      proveedor_id: null,
      librador: '',
      cuit_librador: '',
      notas: '',
    });
    setShowChequeModal(true);
  };

  const cerrarAccionModal = () => {
    setShowAccionChequeModal(false);
    setChequeSeleccionado(null);
    setAccionCheque(null);
  };

  const abrirEditarMovimiento = (mov: MovimientoConsolidado) => {
    setMovimientoAEditar(mov);
    setEditMovimientoForm({
      concepto: mov.concepto,
      monto: mov.monto,
      es_ingreso: mov.es_ingreso,
      fecha_movimiento: mov.fecha,
      metodo_pago: mov.metodo_pago as any,
      notas: '',
    });
    setShowEditMovimientoModal(true);
  };

  const ejecutarAccionCheque = () => {
    if (!chequeSeleccionado || !accionCheque) return;

    switch (accionCheque) {
      case 'depositar':
        depositarChequeMutation.mutate({
          chequeId: chequeSeleccionado.id,
          data: {
            cuenta_destino_id: accionForm.cuenta_destino_id,
            fecha_deposito: accionForm.fecha,
            notas: accionForm.notas || undefined,
          },
        });
        break;
      case 'cobrar':
        cobrarChequeMutation.mutate({
          chequeId: chequeSeleccionado.id,
          data: {
            fecha_cobro: accionForm.fecha,
            notas: accionForm.notas || undefined,
          },
        });
        break;
      case 'rechazar':
        rechazarChequeMutation.mutate({
          chequeId: chequeSeleccionado.id,
          data: {
            motivo_rechazo: accionForm.motivo_rechazo,
            fecha_rechazo: accionForm.fecha,
          },
        });
        break;
      case 'entregar':
        entregarChequeMutation.mutate({
          chequeId: chequeSeleccionado.id,
          data: {
            proveedor_id: accionForm.proveedor_id || undefined,
            concepto: accionForm.concepto,
            fecha_entrega: accionForm.fecha,
            notas: accionForm.notas || undefined,
          },
        });
        break;
    }
  };

  const getEstadoBadge = (estado: EstadoCheque) => {
    const config = ESTADOS_CHEQUE.find((e) => e.value === estado);
    const colors: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-700',
      yellow: 'bg-yellow-100 text-yellow-700',
      green: 'bg-green-100 text-green-700',
      purple: 'bg-purple-100 text-purple-700',
      red: 'bg-red-100 text-red-700',
      gray: 'bg-gray-100 text-gray-700',
    };
    return (
      <Badge className={colors[config?.color || 'gray']}>
        {config?.label || estado}
      </Badge>
    );
  };

  const formatearFecha = (fecha: string) => {
    return formatDate(fecha);
  };

  /**
   * Handler de submit del modal de movimiento.
   * Si método = cheque → arma multipart y llama al endpoint unificado
   * (que crea Cheque + MovimientoTesoreria + adjunta imagen en una operación).
   * Si método ≠ cheque → mantiene el flujo actual.
   */
  const handleSubmitMovimiento = () => {
    if (!movimientoForm.concepto || !movimientoForm.monto) return;

    if (movimientoForm.metodo_pago === 'cheque') {
      // Validaciones específicas del cheque
      if (!movChequeNumero.trim() || !movChequeBanco || !movChequeFechaVencimiento) {
        toast({
          title: 'Faltan datos del cheque',
          description: 'Número, banco emisor y fecha de vencimiento son obligatorios.',
          variant: 'destructive',
        });
        return;
      }
      const errEmi = validarFechaCheque(movChequeFechaEmision, 'Fecha de emisión');
      if (errEmi) {
        toast({ title: 'Fecha de emisión inválida', description: errEmi, variant: 'destructive' });
        return;
      }
      const errVenc = validarFechaCheque(movChequeFechaVencimiento, 'Fecha de vencimiento');
      if (errVenc) {
        toast({ title: 'Fecha de vencimiento inválida', description: errVenc, variant: 'destructive' });
        return;
      }
      if (
        movChequeFechaEmision &&
        movChequeFechaVencimiento &&
        movChequeFechaEmision > movChequeFechaVencimiento
      ) {
        toast({
          title: 'Fechas inconsistentes',
          description: 'La fecha de emisión no puede ser posterior a la fecha de vencimiento.',
          variant: 'destructive',
        });
        return;
      }
      // Ingreso con cliente → cheque recibido de cliente (imputa a CC).
      // Egreso con proveedor → cheque emitido (a futuro puede refinarse).
      const origen: 'recibido_cliente' | 'recibido_proveedor' | 'emitido' = movimientoForm.es_ingreso
        ? movimientoForm.cliente_id
          ? 'recibido_cliente'
          : 'recibido_proveedor'
        : 'emitido';
      if (origen === 'recibido_cliente' && !movimientoForm.cliente_id) {
        toast({
          title: 'Falta el cliente',
          description: 'Los cheques recibidos deben estar asociados a un cliente.',
          variant: 'destructive',
        });
        return;
      }
      crearMovimientoConChequeMutation.mutate({
        tipo: movimientoForm.es_ingreso ? 'ingreso_cheque' : 'egreso_cheque',
        concepto: movimientoForm.concepto,
        monto: movimientoForm.monto,
        es_ingreso: movimientoForm.es_ingreso,
        fecha_movimiento: movimientoForm.fecha_movimiento,
        notas: movimientoForm.notas || undefined,
        cliente_id: movimientoForm.cliente_id || undefined,
        proveedor_id: movimientoForm.proveedor_id || undefined,
        cheque_numero: movChequeNumero.trim(),
        cheque_tipo: movChequeTipo,
        cheque_origen: origen,
        cheque_banco_origen: movChequeBanco,
        cheque_fecha_emision: movChequeFechaEmision || undefined,
        cheque_fecha_vencimiento: movChequeFechaVencimiento,
        cheque_librador: movChequeLibrador || undefined,
        cheque_cuit_librador: movChequeCuitLibrador || undefined,
        imagen: movChequeImagen,
      });
      return;
    }

    // Métodos no-cheque: flujo original
    crearMovimientoMutation.mutate({
      ...movimientoForm,
      tipo: movimientoForm.es_ingreso
        ? `ingreso_${movimientoForm.metodo_pago}`
        : `egreso_${movimientoForm.metodo_pago}`,
    });
  };

  if (loadingResumen) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tesorería</h1>
          <p className="text-gray-500">Gestión de cheques y movimientos de fondos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTransferenciaModal(true)}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Transferir
          </Button>
          <Button onClick={() => setShowMovimientoModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Movimiento
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Orden pedido por la casa: Movimientos primero (es el flujo diario),
            después Cuentas (banco/efectivo/billetera), Cheques, y Resumen con
            gráficos al final. Caja desapareció — ahora todo pasa por cuentas. */}
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="bancos">Cuentas</TabsTrigger>
          <TabsTrigger value="cheques">Cheques</TabsTrigger>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
        </TabsList>

        {/* Tab Resumen */}
        <TabsContent value="resumen" className="space-y-6">
          {/* Saldos Principales */}
          {(() => {
            // Breakdown por tipo de cuenta (reemplaza la vieja tarjeta
            // "Efectivo en Caja" que no tiene sentido sin caja efímera).
            const cuentas = cuentasBancarias || [];
            const totalEfectivo = cuentas
              .filter((c) => c.tipo_cuenta === 'efectivo')
              .reduce((s, c) => s + Number(c.saldo_actual || 0), 0);
            const totalBillVirt = cuentas
              .filter((c) => c.tipo_cuenta === 'billetera_virtual')
              .reduce((s, c) => s + Number(c.saldo_actual || 0), 0);
            const totalBancosReales = cuentas
              .filter(
                (c) =>
                  c.tipo_cuenta === 'caja_ahorro' || c.tipo_cuenta === 'cuenta_corriente',
              )
              .reduce((s, c) => s + Number(c.saldo_actual || 0), 0);
            const totalDisponible =
              totalBancos + Number(resumen?.total_cheques_cartera || 0);
            return (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-600">Efectivo</p>
                        <p className="text-2xl font-bold text-green-700">
                          ${formatNumber(totalEfectivo + totalBillVirt, 2)}
                        </p>
                        <p className="text-xs text-green-600">
                          {cuentas.filter(
                            (c) =>
                              c.tipo_cuenta === 'efectivo' ||
                              c.tipo_cuenta === 'billetera_virtual',
                          ).length}{' '}
                          cuenta(s)
                        </p>
                      </div>
                      <Banknote className="h-10 w-10 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-200 bg-purple-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-purple-600">Saldo en Bancos</p>
                        <p className="text-2xl font-bold text-purple-700">
                          ${formatNumber(totalBancosReales, 2)}
                        </p>
                        <p className="text-xs text-purple-600">
                          {cuentas.filter(
                            (c) =>
                              c.tipo_cuenta === 'caja_ahorro' ||
                              c.tipo_cuenta === 'cuenta_corriente',
                          ).length}{' '}
                          cuenta(s)
                        </p>
                      </div>
                      <Building2 className="h-10 w-10 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-600">Cheques en Cartera</p>
                        <p className="text-2xl font-bold text-blue-700">
                          ${formatNumber(resumen?.total_cheques_cartera || 0, 2)}
                        </p>
                        <p className="text-xs text-blue-600">
                          {resumen?.cheques_en_cartera || 0} cheque(s)
                        </p>
                      </div>
                      <FileCheck className="h-10 w-10 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary bg-primary/10">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-primary">Total Disponible</p>
                        <p className="text-2xl font-bold text-primary">
                          ${formatNumber(totalDisponible, 2)}
                        </p>
                        <p className="text-xs text-primary">
                          Cuentas + Cheques
                        </p>
                      </div>
                      <Wallet className="h-10 w-10 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* Gráficos — insight visual rápido sobre ingresos vs egresos y
              composición. Datos derivados de `movimientos.items` que ya se
              carga para la tab Movimientos. */}
          {movimientos?.items && movimientos.items.length > 0 && (
            <TesoreriaGraficos movimientos={movimientos.items} cuentas={cuentasBancarias || []} />
          )}

          {/* Detalle Cuentas Bancarias */}
          {cuentasBancarias && cuentasBancarias.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Cuentas Bancarias
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cuentasBancarias.map((cuenta) => (
                    <div key={cuenta.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <CreditCard className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium">{cuenta.banco}</p>
                          <p className="text-sm text-gray-500">
                            {cuenta.tipo_cuenta === 'cuenta_corriente' ? 'Cta. Cte.' : cuenta.tipo_cuenta} - {cuenta.alias || cuenta.numero_cuenta}
                            {cuenta.moneda && cuenta.moneda !== 'ARS' && (
                              <span className="ml-1 text-xs font-medium text-blue-600">({cuenta.moneda})</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <p className={`text-lg font-bold ${(cuenta.saldo_actual || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {cuenta.moneda === 'USD' ? 'US$' : '$'}{formatNumber(cuenta.saldo_actual || 0, 2)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resumen Cheques */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600">Cheques en Cartera</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {resumen?.cheques_en_cartera || 0}
                    </p>
                    <p className="text-sm text-blue-600">
                      ${formatNumber(resumen?.total_cheques_cartera || 0, 2)}
                    </p>
                  </div>
                  <Wallet className="h-10 w-10 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-600">Próximos a Vencer (7 días)</p>
                    <p className="text-2xl font-bold text-yellow-700">
                      {resumen?.cheques_proximos_vencer || 0}
                    </p>
                    <p className="text-sm text-yellow-600">
                      ${formatNumber(resumen?.total_proximos_vencer || 0, 2)}
                    </p>
                  </div>
                  <Clock className="h-10 w-10 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-600">Cheques Vencidos</p>
                    <p className="text-2xl font-bold text-red-700">
                      {resumen?.cheques_vencidos || 0}
                    </p>
                    <p className="text-sm text-red-600">
                      ${formatNumber(resumen?.total_vencidos || 0, 2)}
                    </p>
                  </div>
                  <AlertTriangle className="h-10 w-10 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resumen Movimientos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <ArrowUpCircle className="h-5 w-5" />
                  Ingresos del Período
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-gray-600">
                      <Banknote className="h-4 w-4" /> Efectivo
                    </span>
                    <span className="font-semibold text-green-600">
                      ${formatNumber(resumen?.total_ingresos_efectivo || 0, 2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-gray-600">
                      <CreditCard className="h-4 w-4" /> Transferencia
                    </span>
                    <span className="font-semibold text-green-600">
                      ${formatNumber(resumen?.total_ingresos_transferencia || 0, 2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-gray-600">
                      <FileCheck className="h-4 w-4" /> Cheques
                    </span>
                    <span className="font-semibold text-green-600">
                      ${formatNumber(resumen?.total_ingresos_cheque || 0, 2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <ArrowDownCircle className="h-5 w-5" />
                  Egresos del Período
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-gray-600">
                      <Banknote className="h-4 w-4" /> Efectivo
                    </span>
                    <span className="font-semibold text-red-600">
                      ${formatNumber(resumen?.total_egresos_efectivo || 0, 2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-gray-600">
                      <CreditCard className="h-4 w-4" /> Transferencia
                    </span>
                    <span className="font-semibold text-red-600">
                      ${formatNumber(resumen?.total_egresos_transferencia || 0, 2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-gray-600">
                      <FileCheck className="h-4 w-4" /> Cheques
                    </span>
                    <span className="font-semibold text-red-600">
                      ${formatNumber(resumen?.total_egresos_cheque || 0, 2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Saldo */}
          <Card className="border-primary bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-primary">Saldo del Período</p>
                  <p className="text-3xl font-bold text-primary">
                    ${formatNumber(resumen?.saldo_periodo || 0, 2)}
                  </p>
                </div>
                <Wallet className="h-12 w-12 text-primary" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Cuentas (antes "Bancos") — unificada: muestra cuentas bancarias
            + efectivos nombrados + billeteras virtuales. */}
        <TabsContent value="bancos" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-purple-600" />
                  Cuentas Bancarias
                </CardTitle>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Saldo Total</p>
                    <p className="text-2xl font-bold text-purple-600">${formatNumber(totalBancos, 2)}</p>
                  </div>
                  <Button onClick={() => setShowCuentaBancariaModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Cuenta
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingCuentas ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : cuentasBancarias && cuentasBancarias.length > 0 ? (
                <div className="space-y-3">
                  {cuentasBancarias.map((cuenta) => {
                    const esEfectivo = cuenta.tipo_cuenta === 'efectivo';
                    const esBilletera = cuenta.tipo_cuenta === 'billetera_virtual';
                    const icono = esEfectivo ? '💵' : esBilletera ? '📱' : null;
                    const historialOpen = historialAbierto.has(cuenta.id);
                    return (
                      <div key={cuenta.id} className="p-4 border rounded-lg hover:bg-gray-50/40">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="p-3 bg-purple-100 rounded-lg flex items-center justify-center text-xl">
                              {icono || <CreditCard className="h-6 w-6 text-purple-600" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate">
                                {cuenta.nombre || cuenta.banco}
                              </p>
                              <p className="text-sm text-gray-500">
                                {esEfectivo
                                  ? 'Efectivo'
                                  : esBilletera
                                  ? 'Billetera virtual'
                                  : cuenta.tipo_cuenta === 'cuenta_corriente'
                                  ? 'Cuenta Corriente'
                                  : cuenta.tipo_cuenta === 'caja_ahorro'
                                  ? 'Caja de Ahorro'
                                  : cuenta.tipo_cuenta}
                              </p>
                              {!esEfectivo && !esBilletera && (
                                <p className="text-xs text-gray-400">
                                  {cuenta.alias && `${cuenta.alias} - `}{cuenta.numero_cuenta}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className={`text-xl font-bold ${(cuenta.saldo_actual || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {cuenta.moneda === 'USD' ? 'US$' : '$'}{formatNumber(cuenta.saldo_actual || 0, 2)}
                              </p>
                              <p className="text-xs text-gray-400">{cuenta.moneda === 'USD' ? 'Dólares' : 'Pesos'}</p>
                            </div>
                            <div className="flex flex-col gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                title="Editar saldo manualmente"
                                onClick={() => {
                                  setEditarSaldoCuenta(cuenta);
                                  setNuevoSaldoCuenta(Number(cuenta.saldo_actual || 0));
                                  setMotivoAjuste('');
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                Editar saldo
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                onClick={() => {
                                  setHistorialAbierto((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(cuenta.id)) next.delete(cuenta.id);
                                    else next.add(cuenta.id);
                                    return next;
                                  });
                                }}
                              >
                                {historialOpen ? 'Ocultar historial' : 'Ver historial de ajustes'}
                              </Button>
                            </div>
                          </div>
                        </div>
                        <HistorialAjustesCuenta cuentaId={cuenta.id} abierto={historialOpen} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No hay cuentas bancarias registradas</p>
                  <p className="text-sm text-gray-400 mb-4">Agregá tus cuentas bancarias para hacer seguimiento de los saldos</p>
                  <Button onClick={() => setShowCuentaBancariaModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Cuenta Bancaria
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Cheques */}
        <TabsContent value="cheques" className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por número, librador..."
                      value={chequeFiltroBuscar}
                      onChange={(e) => setChequeFiltroBuscar(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={chequeFiltroEstado || "_all"} onValueChange={(v) => setChequeFiltroEstado(v === "_all" ? "" : v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos los estados</SelectItem>
                    {ESTADOS_CHEQUE.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={chequeFiltroTipo || "_all"} onValueChange={(v) => setChequeFiltroTipo(v === "_all" ? "" : v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos los tipos</SelectItem>
                    {TIPOS_CHEQUE.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Cheques */}
          <Card>
            <CardContent className="pt-4">
              {loadingCheques ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : cheques?.items && cheques.items.length > 0 ? (
                <div className="space-y-2">
                  {cheques.items.map((cheque) => (
                    <div
                      key={cheque.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <FileCheck className="h-6 w-6 text-gray-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">#{cheque.numero}</span>
                            <Badge variant="outline">
                              {TIPOS_CHEQUE.find((t) => t.value === cheque.tipo)?.label}
                            </Badge>
                            {getEstadoBadge(cheque.estado)}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-3">
                            {cheque.banco_origen && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" /> {cheque.banco_origen}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> Vence: {formatearFecha(cheque.fecha_vencimiento)}
                            </span>
                            {cheque.cliente_nombre && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" /> {cheque.cliente_nombre}
                              </span>
                            )}
                            {cheque.proveedor_nombre && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" /> {cheque.proveedor_nombre}
                              </span>
                            )}
                          </div>
                          {cheque.dias_para_vencimiento !== null && cheque.dias_para_vencimiento <= 7 && cheque.estado === 'en_cartera' && (
                            <span className={`text-xs ${cheque.dias_para_vencimiento < 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                              {cheque.dias_para_vencimiento < 0
                                ? `Vencido hace ${Math.abs(cheque.dias_para_vencimiento)} días`
                                : cheque.dias_para_vencimiento === 0
                                ? 'Vence hoy'
                                : `Vence en ${cheque.dias_para_vencimiento} días`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold">
                          ${formatNumber(cheque.monto, 2)}
                        </span>
                        {/* Botón de editar siempre visible para cheques en cartera o depositados */}
                        {(cheque.estado === 'en_cartera' || cheque.estado === 'depositado') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => abrirEditarCheque(cheque)}
                            title="Editar cheque"
                          >
                            <Pencil className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        {cheque.estado === 'en_cartera' && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => abrirAccionCheque(cheque, 'depositar')}
                              title="Depositar"
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => abrirAccionCheque(cheque, 'cobrar')}
                              title="Marcar cobrado"
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => abrirAccionCheque(cheque, 'entregar')}
                              title="Entregar a tercero"
                            >
                              <ArrowDownCircle className="h-4 w-4 text-purple-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => abrirAccionCheque(cheque, 'rechazar')}
                              title="Rechazar"
                            >
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setChequeAEliminar(cheque);
                                setShowDeleteChequeDialog(true);
                              }}
                              title="Eliminar cheque"
                            >
                              <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-600" />
                            </Button>
                          </div>
                        )}
                        {cheque.estado === 'depositado' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => abrirAccionCheque(cheque, 'cobrar')}
                            title="Marcar cobrado"
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No hay cheques registrados</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Movimientos */}
        <TabsContent value="movimientos" className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs text-gray-500 mb-1 block">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por concepto..."
                      value={movFiltroBuscar}
                      onChange={(e) => setMovFiltroBuscar(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Desde</Label>
                  <Input
                    type="date"
                    value={movFiltroFechaDesde}
                    onChange={(e) => setMovFiltroFechaDesde(e.target.value)}
                    className="w-[150px]"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Hasta</Label>
                  <Input
                    type="date"
                    value={movFiltroFechaHasta}
                    onChange={(e) => setMovFiltroFechaHasta(e.target.value)}
                    className="w-[150px]"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Tipo</Label>
                  <Select value={movFiltroIngresosEgresos} onValueChange={(v) => setMovFiltroIngresosEgresos(v as 'todos' | 'ingresos' | 'egresos')}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="ingresos">Ingresos</SelectItem>
                      <SelectItem value="egresos">Egresos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Método</Label>
                  <Select value={movFiltroTipo || "_all"} onValueChange={(v) => setMovFiltroTipo(v === "_all" ? "" : v)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Método de pago" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Todos</SelectItem>
                      {METODOS_PAGO_TESORERIA.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(movFiltroFechaDesde || movFiltroFechaHasta || movFiltroBuscar || movFiltroTipo || movFiltroIngresosEgresos !== 'todos') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMovFiltroFechaDesde('');
                      setMovFiltroFechaHasta('');
                      setMovFiltroBuscar('');
                      setMovFiltroTipo('');
                      setMovFiltroIngresosEgresos('todos');
                    }}
                  >
                    Limpiar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Totales del período filtrado */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-gray-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Movimientos</p>
                    <p className="text-xl font-bold">{movimientos?.total || 0}</p>
                  </div>
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600">Total Ingresos</p>
                    <p className="text-xl font-bold text-green-700">${formatNumber(totalIngresosFiltered, 2)}</p>
                  </div>
                  <ArrowUpCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-600">Total Egresos</p>
                    <p className="text-xl font-bold text-red-700">${formatNumber(totalEgresosFiltered, 2)}</p>
                  </div>
                  <ArrowDownCircle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
            <Card className={`border-2 ${saldoFiltered >= 0 ? 'border-green-300 bg-green-100' : 'border-red-300 bg-red-100'}`}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm ${saldoFiltered >= 0 ? 'text-green-600' : 'text-red-600'}`}>Saldo</p>
                    <p className={`text-xl font-bold ${saldoFiltered >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      ${formatNumber(saldoFiltered, 2)}
                    </p>
                  </div>
                  <Wallet className={`h-8 w-8 ${saldoFiltered >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de Movimientos */}
          <Card>
            <CardContent className="pt-4">
              {loadingMovimientos ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : movimientos?.items && movimientos.items.length > 0 ? (
                <div className="space-y-2">
                  {movimientos.items.map((mov) => (
                    <div
                      key={mov.id}
                      onClick={() => setMovimientoDetalle(mov)}
                      className={`flex items-center justify-between p-4 rounded-lg cursor-pointer hover:ring-2 hover:ring-primary/40 transition ${
                        mov.es_ingreso
                          ? 'bg-green-50'
                          : 'bg-red-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {mov.es_ingreso ? (
                          <ArrowUpCircle className="h-6 w-6 text-green-600" />
                        ) : (
                          <ArrowDownCircle className="h-6 w-6 text-red-600" />
                        )}
                        <div>
                          <p className="font-medium">{mov.concepto}</p>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                            {mov.metodo_pago && (
                              <Badge variant="outline">
                                {METODOS_PAGO_TESORERIA.find((m) => m.value === mov.metodo_pago)?.label || mov.metodo_pago}
                              </Badge>
                            )}
                            {mov.origen === 'cheque' && (
                              <Badge variant="secondary">Cheque</Badge>
                            )}
                            {mov.estado && mov.origen === 'cheque' && (
                              <Badge variant="outline" className="text-xs">
                                {ESTADOS_CHEQUE.find((e) => e.value === mov.estado)?.label || mov.estado}
                              </Badge>
                            )}
                            <span>{formatearFecha(mov.fecha)}</span>
                            {mov.cliente_nombre && <span>- {mov.cliente_nombre}</span>}
                            {mov.proveedor_nombre && <span>- {mov.proveedor_nombre}</span>}
                            {mov.numero_referencia && <span>- #{mov.numero_referencia}</span>}
                            {mov.banco && <span>- {mov.banco}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-lg font-bold ${
                            mov.es_ingreso
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {mov.es_ingreso ? '+' : '-'}${formatNumber(mov.monto, 2)}
                        </span>
                        {mov.origen === 'movimiento_tesoreria' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar movimiento"
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirEditarMovimiento(mov);
                              }}
                            >
                              <Pencil className="h-4 w-4 text-gray-400 hover:text-blue-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Eliminar movimiento"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('¿Está seguro de eliminar este movimiento?')) {
                                  eliminarMovimientoMutation.mutate(mov.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                            </Button>
                          </>
                        )}
                        {mov.origen === 'cheque' && mov.estado === 'en_cartera' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar cheque"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Buscar el cheque en la lista y abrir el modal de edición
                                const cheque = cheques?.items?.find(c => c.id === mov.id);
                                if (cheque) {
                                  abrirEditarCheque(cheque);
                                }
                              }}
                            >
                              <Pencil className="h-4 w-4 text-gray-400 hover:text-blue-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Eliminar cheque"
                              onClick={(e) => {
                                e.stopPropagation();
                                const cheque = cheques?.items?.find(c => c.id === mov.id);
                                if (cheque) {
                                  setChequeAEliminar(cheque);
                                  setShowDeleteChequeDialog(true);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No hay movimientos registrados</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Nuevo/Editar Cheque */}
      {/* Modal solo para EDITAR cheques existentes. La creación se hace desde
          "Nuevo Movimiento" → método Cheque (endpoint unificado). */}
      {showChequeModal && editingCheque && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg m-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Editar Cheque</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número de Cheque *</Label>
                  <Input
                    value={chequeForm.numero}
                    onChange={(e) => setChequeForm({ ...chequeForm, numero: e.target.value })}
                    placeholder="00000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monto *</Label>
                  <InputMoneda
                    value={chequeForm.monto || null}
                    onChange={(v) => setChequeForm({ ...chequeForm, monto: v || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={chequeForm.tipo}
                    onValueChange={(v) => setChequeForm({ ...chequeForm, tipo: v as any })}
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
                <div className="space-y-2">
                  <Label>Origen</Label>
                  <Select
                    value={chequeForm.origen}
                    onValueChange={(v) => setChequeForm({ ...chequeForm, origen: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORIGENES_CHEQUE.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha de Emisión</Label>
                  <Input
                    type="date"
                    value={chequeForm.fecha_emision || ''}
                    onChange={(e) => setChequeForm({ ...chequeForm, fecha_emision: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de Vencimiento *</Label>
                  <Input
                    type="date"
                    value={chequeForm.fecha_vencimiento}
                    onChange={(e) => setChequeForm({ ...chequeForm, fecha_vencimiento: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Banco de Origen</Label>
                <Select
                  value={chequeForm.banco_origen || ''}
                  onValueChange={(v) => setChequeForm({ ...chequeForm, banco_origen: v })}
                >
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

              {(chequeForm.origen === 'recibido_cliente') && (
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Combobox
                    options={clientes?.items?.map((c) => ({
                      value: c.id,
                      label: c.razon_social,
                      sublabel: c.cuit || undefined,
                    })) || []}
                    value={chequeForm.cliente_id ?? null}
                    onChange={(v) => setChequeForm({ ...chequeForm, cliente_id: v })}
                    placeholder="Buscar cliente..."
                    searchPlaceholder="Escribí para buscar..."
                    emptyText="No se encontró el cliente"
                    isLoading={loadingClientes}
                  />
                  <p className="text-xs text-blue-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    El cheque se imputará automáticamente como PAGO en la cuenta corriente del cliente
                  </p>
                </div>
              )}

              {(chequeForm.origen === 'recibido_proveedor') && (
                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <Combobox
                    options={proveedores?.items?.map((p) => ({
                      value: p.id,
                      label: p.razon_social,
                      sublabel: p.cuit || undefined,
                    })) || []}
                    value={chequeForm.proveedor_id ?? null}
                    onChange={(v) => setChequeForm({ ...chequeForm, proveedor_id: v })}
                    placeholder="Buscar proveedor..."
                    searchPlaceholder="Escribí para buscar..."
                    emptyText="No se encontró el proveedor"
                    isLoading={loadingProveedores}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Librador</Label>
                  <Input
                    value={chequeForm.librador || ''}
                    onChange={(e) => setChequeForm({ ...chequeForm, librador: e.target.value })}
                    placeholder="Nombre del librador"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CUIT Librador</Label>
                  <Input
                    value={chequeForm.cuit_librador || ''}
                    onChange={(e) => setChequeForm({ ...chequeForm, cuit_librador: e.target.value })}
                    placeholder="XX-XXXXXXXX-X"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={chequeForm.notas || ''}
                  onChange={(e) => setChequeForm({ ...chequeForm, notas: e.target.value })}
                  placeholder="Observaciones..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={() => {
                  setShowChequeModal(false);
                  setEditingCheque(null);
                  resetChequeForm();
                }}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!editingCheque) return;
                    actualizarChequeMutation.mutate({
                      chequeId: editingCheque.id,
                      data: {
                        numero: chequeForm.numero,
                        tipo: chequeForm.tipo,
                        monto: chequeForm.monto,
                        fecha_emision: chequeForm.fecha_emision,
                        fecha_vencimiento: chequeForm.fecha_vencimiento,
                        banco_origen: chequeForm.banco_origen || undefined,
                        librador: chequeForm.librador || undefined,
                        cuit_librador: chequeForm.cuit_librador || undefined,
                        notas: chequeForm.notas || undefined,
                      },
                    });
                  }}
                  disabled={
                    !chequeForm.numero ||
                    !chequeForm.monto ||
                    !chequeForm.fecha_vencimiento ||
                    actualizarChequeMutation.isPending
                  }
                >
                  Guardar Cambios
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Nuevo Movimiento */}
      {showMovimientoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg m-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Registrar Movimiento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button
                  variant={movimientoForm.es_ingreso ? 'default' : 'outline'}
                  className={movimientoForm.es_ingreso ? 'bg-green-600 hover:bg-green-700' : ''}
                  onClick={() => setMovimientoForm({ ...movimientoForm, es_ingreso: true })}
                >
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  Ingreso
                </Button>
                <Button
                  variant={!movimientoForm.es_ingreso ? 'default' : 'outline'}
                  className={!movimientoForm.es_ingreso ? 'bg-red-600 hover:bg-red-700' : ''}
                  onClick={() => setMovimientoForm({ ...movimientoForm, es_ingreso: false })}
                >
                  <ArrowDownCircle className="h-4 w-4 mr-2" />
                  Egreso
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Concepto *</Label>
                <Input
                  value={movimientoForm.concepto}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, concepto: e.target.value })}
                  placeholder="Descripción del movimiento"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monto *</Label>
                  <InputMoneda
                    value={movimientoForm.monto || null}
                    onChange={(v) => setMovimientoForm({ ...movimientoForm, monto: v || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha *</Label>
                  <Input
                    type="date"
                    value={movimientoForm.fecha_movimiento}
                    onChange={(e) => setMovimientoForm({ ...movimientoForm, fecha_movimiento: e.target.value })}
                  />
                </div>
              </div>

              {/* Selector de cuenta: todas las cuentas del listado (banco /
                  efectivo nombrado / billetera virtual) + opción Cheque para
                  el flujo especial de cartera. Ya no existe "Caja genérica". */}
              <div className="space-y-2">
                <Label>{movimientoForm.es_ingreso ? 'Cuenta destino' : 'Cuenta origen'} *</Label>
                <Select
                  value={fondoSeleccionado}
                  onValueChange={(v) => {
                    if (v === 'cheque') {
                      setMovimientoForm({
                        ...movimientoForm,
                        metodo_pago: 'cheque',
                        cuenta_destino_id: null,
                      });
                    } else {
                      // v = UUID de una cuenta. Si es efectivo/billetera, el
                      // backend igual lo trata como transferencia a esa cuenta.
                      setMovimientoForm({
                        ...movimientoForm,
                        metodo_pago: 'transferencia',
                        cuenta_destino_id: v,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí la cuenta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {!cuentasBancarias || cuentasBancarias.length === 0 ? (
                      <SelectItem value="__sin_cuentas__" disabled>
                        No tenés cuentas creadas. Creá una desde la tab Cuentas.
                      </SelectItem>
                    ) : (
                      cuentasBancarias.map((c) => {
                        const icono =
                          c.tipo_cuenta === 'efectivo'
                            ? '💵'
                            : c.tipo_cuenta === 'billetera_virtual'
                            ? '📱'
                            : '🏦';
                        const label =
                          c.tipo_cuenta === 'efectivo' || c.tipo_cuenta === 'billetera_virtual'
                            ? c.nombre
                            : `${c.banco} - ${c.numero_cuenta}`;
                        return (
                          <SelectItem key={c.id} value={c.id}>
                            {icono} {label}
                            <span className="ml-2 text-xs text-muted-foreground">
                              · ${formatNumber(Number(c.saldo_actual || 0), 2)}
                            </span>
                          </SelectItem>
                        );
                      })
                    )}
                    <SelectItem value="cheque">📄 Cheque</SelectItem>
                  </SelectContent>
                </Select>

                {/* Preview del impacto sobre la cuenta elegida (no aplica a cheques). */}
                {fondoSeleccionado && fondoSeleccionado !== 'cheque' && Number(movimientoForm.monto || 0) > 0 && (
                  <div
                    className={`text-xs rounded-md border px-3 py-2 ${
                      saldoFondoResultante < 0
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}
                  >
                    Saldo actual: <strong>${formatNumber(saldoFondoActual, 2)}</strong>
                    {' → '}
                    Después del movimiento:{' '}
                    <strong>${formatNumber(saldoFondoResultante, 2)}</strong>
                    {saldoFondoResultante < 0 && (
                      <span className="ml-1">(quedará en negativo)</span>
                    )}
                  </div>
                )}
              </div>

              {/* Datos del cheque (unificado: reemplaza al modal "Nuevo Cheque" separado) */}
              {movimientoForm.metodo_pago === 'cheque' && (
                <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                  <p className="text-sm font-medium text-blue-800">
                    Datos del cheque
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Número de cheque *</Label>
                      <Input
                        value={movChequeNumero}
                        onChange={(e) => setMovChequeNumero(e.target.value)}
                        placeholder="00000000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo *</Label>
                      <Select
                        value={movChequeTipo}
                        onValueChange={(v) => setMovChequeTipo(v as 'fisico' | 'echeq')}
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
                    <Select value={movChequeBanco} onValueChange={setMovChequeBanco}>
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
                        value={movChequeFechaEmision}
                        onChange={(e) => setMovChequeFechaEmision(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fecha de vencimiento *</Label>
                      <Input
                        type="date"
                        value={movChequeFechaVencimiento}
                        onChange={(e) => setMovChequeFechaVencimiento(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Librador</Label>
                      <Input
                        value={movChequeLibrador}
                        onChange={(e) => setMovChequeLibrador(e.target.value)}
                        placeholder="Nombre de quien firma"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CUIT librador</Label>
                      <Input
                        value={movChequeCuitLibrador}
                        onChange={(e) => setMovChequeCuitLibrador(e.target.value)}
                        placeholder="XX-XXXXXXXX-X"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Imagen o PDF del cheque (opcional)</Label>
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) => setMovChequeImagen(e.target.files?.[0] || null)}
                    />
                    {movChequeImagen && (
                      <p className="text-xs text-gray-600">
                        {movChequeImagen.name} ({Math.round(movChequeImagen.size / 1024)} KB)
                      </p>
                    )}
                  </div>
                  {movimientoForm.es_ingreso && movimientoForm.cliente_id && (
                    <p className="flex items-center gap-1 text-xs text-blue-700">
                      <AlertTriangle className="h-3 w-3" />
                      El cheque se imputará automáticamente como PAGO en la cuenta corriente del cliente.
                    </p>
                  )}
                </div>
              )}

              {movimientoForm.es_ingreso ? (
                <div className="space-y-2">
                  <Label>Cliente (opcional)</Label>
                  <Combobox
                    options={clientes?.items?.map((c) => ({
                      value: c.id,
                      label: c.razon_social,
                      sublabel: c.cuit || undefined,
                    })) || []}
                    value={movimientoForm.cliente_id ?? null}
                    onChange={(v) => setMovimientoForm({ ...movimientoForm, cliente_id: v })}
                    placeholder="Buscar cliente..."
                    searchPlaceholder="Escribí para buscar..."
                    emptyText="No se encontró el cliente"
                    isLoading={loadingClientes}
                  />
                </div>
              ) : (
                // EGRESO: la plata puede ir a un proveedor concreto o a una
                // categoría genérica (IVA, EPEC, sindicato, cuotas, etc).
                // El toggle resetea el otro campo para que no quede ambiguo.
                <div className="space-y-2">
                  <Label>Imputación del egreso *</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={imputacionEgreso === 'proveedor' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setImputacionEgreso('proveedor');
                        setMovimientoForm({ ...movimientoForm, categoria_gasto_id: null });
                      }}
                    >
                      Proveedor
                    </Button>
                    <Button
                      type="button"
                      variant={imputacionEgreso === 'categoria' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setImputacionEgreso('categoria');
                        setMovimientoForm({ ...movimientoForm, proveedor_id: null });
                      }}
                    >
                      Categoría de gasto
                    </Button>
                  </div>

                  {imputacionEgreso === 'proveedor' ? (
                    <Combobox
                      options={proveedores?.items?.map((p) => ({
                        value: p.id,
                        label: p.razon_social,
                        sublabel: p.cuit || undefined,
                      })) || []}
                      value={movimientoForm.proveedor_id ?? null}
                      onChange={(v) => setMovimientoForm({ ...movimientoForm, proveedor_id: v })}
                      placeholder="Buscar proveedor..."
                      searchPlaceholder="Escribí para buscar..."
                      emptyText="No se encontró el proveedor"
                      isLoading={loadingProveedores}
                    />
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Combobox
                            options={categoriasGasto.map((c) => ({
                              value: c.id,
                              label: c.nombre,
                            }))}
                            value={movimientoForm.categoria_gasto_id ?? null}
                            onChange={(v) =>
                              setMovimientoForm({ ...movimientoForm, categoria_gasto_id: v })
                            }
                            placeholder="Elegí la categoría..."
                            searchPlaceholder="Escribí para buscar..."
                            emptyText="No hay categorías. Creá una con el +"
                            isLoading={loadingCategorias}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          title="Agregar categoría nueva"
                          onClick={() => setNuevaCategoriaDialog(true)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Si todavía no hay ninguna categoría cargada mostramos
                          el atajo para cargar el seed con un clic (ocurre si la
                          migración Alembic no corrió). */}
                      {!loadingCategorias && categoriasGasto.length === 0 && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-2">
                          <p>
                            Todavía no tenés categorías cargadas. Podés cargar las
                            27 que usa la casa por defecto (ARCA, IVA, EPEC, etc.) con un clic.
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={seedCategoriasMutation.isPending}
                            onClick={() => seedCategoriasMutation.mutate()}
                          >
                            {seedCategoriasMutation.isPending
                              ? 'Cargando...'
                              : 'Cargar categorías por defecto'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={movimientoForm.notas || ''}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, notas: e.target.value })}
                  placeholder="Observaciones..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={() => setShowMovimientoModal(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmitMovimiento}
                  disabled={
                    !movimientoForm.concepto ||
                    !movimientoForm.monto ||
                    crearMovimientoMutation.isPending ||
                    crearMovimientoConChequeMutation.isPending
                  }
                  className={movimientoForm.es_ingreso ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                >
                  Registrar {movimientoForm.es_ingreso ? 'Ingreso' : 'Egreso'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Acción Cheque */}
      {showAccionChequeModal && chequeSeleccionado && accionCheque && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle>
                {accionCheque === 'depositar' && 'Depositar Cheque'}
                {accionCheque === 'cobrar' && 'Marcar Cheque como Cobrado'}
                {accionCheque === 'rechazar' && 'Rechazar Cheque'}
                {accionCheque === 'entregar' && 'Entregar Cheque a Tercero'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-500">Cheque</p>
                <p className="font-semibold">#{chequeSeleccionado.numero}</p>
                <p className="text-lg font-bold">${formatNumber(chequeSeleccionado.monto, 2)}</p>
              </div>

              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={accionForm.fecha}
                  onChange={(e) => setAccionForm({ ...accionForm, fecha: e.target.value })}
                />
              </div>

              {accionCheque === 'rechazar' && (
                <div className="space-y-2">
                  <Label>Motivo del Rechazo *</Label>
                  <Textarea
                    value={accionForm.motivo_rechazo}
                    onChange={(e) => setAccionForm({ ...accionForm, motivo_rechazo: e.target.value })}
                    placeholder="Indique el motivo del rechazo..."
                  />
                </div>
              )}

              {accionCheque === 'entregar' && (
                <>
                  <div className="space-y-2">
                    <Label>Concepto *</Label>
                    <Input
                      value={accionForm.concepto}
                      onChange={(e) => setAccionForm({ ...accionForm, concepto: e.target.value })}
                      placeholder="Pago a proveedor, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Proveedor (opcional)</Label>
                    <Combobox
                      options={proveedores?.items?.map((p) => ({
                        value: p.id,
                        label: p.razon_social,
                        sublabel: p.cuit || undefined,
                      })) || []}
                      value={accionForm.proveedor_id || null}
                      onChange={(v) => setAccionForm({ ...accionForm, proveedor_id: v || '' })}
                      placeholder="Buscar proveedor..."
                      searchPlaceholder="Escribí para buscar..."
                      emptyText="No se encontró el proveedor"
                      isLoading={loadingProveedores}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={accionForm.notas}
                  onChange={(e) => setAccionForm({ ...accionForm, notas: e.target.value })}
                  placeholder="Observaciones..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={cerrarAccionModal}>
                  Cancelar
                </Button>
                <Button
                  onClick={ejecutarAccionCheque}
                  disabled={
                    (accionCheque === 'rechazar' && !accionForm.motivo_rechazo) ||
                    (accionCheque === 'entregar' && !accionForm.concepto)
                  }
                  className={accionCheque === 'rechazar' ? 'bg-red-600 hover:bg-red-700' : ''}
                >
                  {accionCheque === 'depositar' && 'Depositar'}
                  {accionCheque === 'cobrar' && 'Marcar Cobrado'}
                  {accionCheque === 'rechazar' && 'Rechazar'}
                  {accionCheque === 'entregar' && 'Entregar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Confirmar Eliminación de Cheque */}
      {showDeleteChequeDialog && chequeAEliminar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Eliminar Cheque
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-500">Cheque a eliminar</p>
                <p className="font-semibold">#{chequeAEliminar.numero}</p>
                <p className="text-lg font-bold">${formatNumber(chequeAEliminar.monto, 2)}</p>
                {chequeAEliminar.cliente_nombre && (
                  <p className="text-sm text-gray-500">Cliente: {chequeAEliminar.cliente_nombre}</p>
                )}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Atención:</strong> Esta acción no se puede deshacer.
                  {chequeAEliminar.cliente_nombre && (
                    <span className="block mt-1">
                      Se revertirá el pago en la cuenta corriente del cliente.
                    </span>
                  )}
                </p>
              </div>

              <p className="text-gray-600">
                ¿Está seguro que desea eliminar este cheque?
              </p>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowDeleteChequeDialog(false);
                    setChequeAEliminar(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => eliminarChequeMutation.mutate(chequeAEliminar.id)}
                  disabled={eliminarChequeMutation.isPending}
                >
                  {eliminarChequeMutation.isPending ? 'Eliminando...' : 'Eliminar Cheque'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Nueva Cuenta — unificado para los 3 tipos (banco, efectivo
          nombrado, billetera virtual). Para no-banco los campos CBU/alias/
          titular son opcionales y los auto-llenamos con placeholders al
          enviar para que el backend acepte el schema actual sin fricciones. */}
      {showCuentaBancariaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg m-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-600" />
                Nueva Cuenta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de Cuenta *</Label>
                <Select
                  value={cuentaBancariaForm.tipo_cuenta}
                  onValueChange={(v) => {
                    const esBanco = v === 'caja_ahorro' || v === 'cuenta_corriente';
                    setCuentaBancariaForm({
                      ...cuentaBancariaForm,
                      tipo_cuenta: v,
                      // Al pasar a no-banco limpiamos campos bancarios para evitar
                      // confusión; el usuario los puede volver a cargar si cambia.
                      banco: esBanco ? cuentaBancariaForm.banco : '',
                      cbu: esBanco ? cuentaBancariaForm.cbu : '',
                      numero_cuenta: esBanco ? cuentaBancariaForm.numero_cuenta : '',
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CUENTA_BANCARIA.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {cuentaBancariaForm.tipo_cuenta === 'efectivo' &&
                    'Caja de efectivo nombrada (ej: "Efectivo Lucho", "Caja chica").'}
                  {cuentaBancariaForm.tipo_cuenta === 'billetera_virtual' &&
                    'Billetera virtual (ej: "Mercado Pago Lucho", "Ualá").'}
                  {(cuentaBancariaForm.tipo_cuenta === 'caja_ahorro' ||
                    cuentaBancariaForm.tipo_cuenta === 'cuenta_corriente') &&
                    'Cuenta bancaria tradicional con CBU y titular.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Nombre / Identificador *</Label>
                <Input
                  value={cuentaBancariaForm.nombre}
                  onChange={(e) => setCuentaBancariaForm({ ...cuentaBancariaForm, nombre: e.target.value })}
                  placeholder={
                    cuentaBancariaForm.tipo_cuenta === 'efectivo'
                      ? 'Ej: Efectivo Lucho'
                      : cuentaBancariaForm.tipo_cuenta === 'billetera_virtual'
                      ? 'Ej: Mercado Pago Lucho'
                      : 'Ej: Cuenta Principal'
                  }
                />
              </div>

              {/* Campos específicos de banco — solo visibles para los dos tipos
                  bancarios. Para efectivo/billetera no tienen sentido. */}
              {(cuentaBancariaForm.tipo_cuenta === 'caja_ahorro' ||
                cuentaBancariaForm.tipo_cuenta === 'cuenta_corriente') && (
                <div className="space-y-2">
                  <Label>Banco *</Label>
                  <Select
                    value={cuentaBancariaForm.banco}
                    onValueChange={(v) => setCuentaBancariaForm({ ...cuentaBancariaForm, banco: v })}
                  >
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
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Moneda *</Label>
                  <Select
                    value={cuentaBancariaForm.moneda}
                    onValueChange={(v) => setCuentaBancariaForm({ ...cuentaBancariaForm, moneda: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONEDAS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(cuentaBancariaForm.tipo_cuenta === 'caja_ahorro' ||
                  cuentaBancariaForm.tipo_cuenta === 'cuenta_corriente') && (
                  <div className="space-y-2">
                    <Label>Número de Cuenta</Label>
                    <Input
                      value={cuentaBancariaForm.numero_cuenta}
                      onChange={(e) => setCuentaBancariaForm({ ...cuentaBancariaForm, numero_cuenta: e.target.value })}
                      placeholder="Ej: 123456789"
                    />
                  </div>
                )}
              </div>

              {/* Campos bancarios — se ocultan si el tipo es efectivo o billetera. */}
              {(cuentaBancariaForm.tipo_cuenta === 'caja_ahorro' ||
                cuentaBancariaForm.tipo_cuenta === 'cuenta_corriente') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>CBU</Label>
                      <Input
                        value={cuentaBancariaForm.cbu}
                        onChange={(e) => setCuentaBancariaForm({ ...cuentaBancariaForm, cbu: e.target.value })}
                        placeholder="22 dígitos"
                        maxLength={22}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Alias</Label>
                      <Input
                        value={cuentaBancariaForm.alias}
                        onChange={(e) => setCuentaBancariaForm({ ...cuentaBancariaForm, alias: e.target.value })}
                        placeholder="Ej: MI.ALIAS.CBU"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Titular</Label>
                      <Input
                        value={cuentaBancariaForm.titular}
                        onChange={(e) => setCuentaBancariaForm({ ...cuentaBancariaForm, titular: e.target.value })}
                        placeholder="Nombre del titular"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CUIT del Titular</Label>
                      <Input
                        value={cuentaBancariaForm.cuit_titular}
                        onChange={(e) => setCuentaBancariaForm({ ...cuentaBancariaForm, cuit_titular: e.target.value })}
                        placeholder="XX-XXXXXXXX-X"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Saldo Inicial</Label>
                  <InputMoneda
                    value={cuentaBancariaForm.saldo_actual || null}
                    onChange={(v) => setCuentaBancariaForm({ ...cuentaBancariaForm, saldo_actual: v || 0 })}
                  />
                </div>
                <div className="space-y-2 flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={cuentaBancariaForm.es_principal}
                      onChange={(e) => setCuentaBancariaForm({ ...cuentaBancariaForm, es_principal: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium">Cuenta principal</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={cuentaBancariaForm.notas}
                  onChange={(e) => setCuentaBancariaForm({ ...cuentaBancariaForm, notas: e.target.value })}
                  placeholder="Observaciones adicionales..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowCuentaBancariaModal(false);
                    resetCuentaBancariaForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    // Para efectivo / billetera_virtual el schema del backend
                    // sigue pidiendo banco + numero_cuenta + titular. Los
                    // rellenamos automáticamente con el nombre así el usuario
                    // no tiene que lidiar con campos que no aplican.
                    const esBanco =
                      cuentaBancariaForm.tipo_cuenta === 'caja_ahorro' ||
                      cuentaBancariaForm.tipo_cuenta === 'cuenta_corriente';
                    const payload = {
                      ...cuentaBancariaForm,
                      banco: esBanco
                        ? cuentaBancariaForm.banco
                        : cuentaBancariaForm.tipo_cuenta === 'efectivo'
                        ? 'Efectivo'
                        : 'Billetera virtual',
                      numero_cuenta: esBanco
                        ? cuentaBancariaForm.numero_cuenta
                        : cuentaBancariaForm.nombre,
                      titular: esBanco
                        ? cuentaBancariaForm.titular || cuentaBancariaForm.nombre
                        : cuentaBancariaForm.nombre,
                    };
                    crearCuentaBancariaMutation.mutate(payload);
                  }}
                  disabled={
                    !cuentaBancariaForm.nombre ||
                    (((cuentaBancariaForm.tipo_cuenta === 'caja_ahorro' ||
                      cuentaBancariaForm.tipo_cuenta === 'cuenta_corriente') &&
                      !cuentaBancariaForm.banco)) ||
                    crearCuentaBancariaMutation.isPending
                  }
                >
                  {crearCuentaBancariaMutation.isPending ? 'Guardando...' : 'Crear Cuenta'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Editar Movimiento */}
      {showEditMovimientoModal && movimientoAEditar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg m-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Editar Movimiento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button
                  variant={editMovimientoForm.es_ingreso ? 'default' : 'outline'}
                  className={editMovimientoForm.es_ingreso ? 'bg-green-600 hover:bg-green-700' : ''}
                  onClick={() => setEditMovimientoForm({ ...editMovimientoForm, es_ingreso: true })}
                >
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  Ingreso
                </Button>
                <Button
                  variant={!editMovimientoForm.es_ingreso ? 'default' : 'outline'}
                  className={!editMovimientoForm.es_ingreso ? 'bg-red-600 hover:bg-red-700' : ''}
                  onClick={() => setEditMovimientoForm({ ...editMovimientoForm, es_ingreso: false })}
                >
                  <ArrowDownCircle className="h-4 w-4 mr-2" />
                  Egreso
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Concepto *</Label>
                <Input
                  value={editMovimientoForm.concepto || ''}
                  onChange={(e) => setEditMovimientoForm({ ...editMovimientoForm, concepto: e.target.value })}
                  placeholder="Descripción del movimiento"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monto *</Label>
                  <InputMoneda
                    value={editMovimientoForm.monto || null}
                    onChange={(v) => setEditMovimientoForm({ ...editMovimientoForm, monto: v || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha *</Label>
                  <Input
                    type="date"
                    value={editMovimientoForm.fecha_movimiento || ''}
                    onChange={(e) => setEditMovimientoForm({ ...editMovimientoForm, fecha_movimiento: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Método de Pago</Label>
                <Select
                  value={editMovimientoForm.metodo_pago || 'efectivo'}
                  onValueChange={(v) => setEditMovimientoForm({ ...editMovimientoForm, metodo_pago: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METODOS_PAGO_TESORERIA.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={editMovimientoForm.notas || ''}
                  onChange={(e) => setEditMovimientoForm({ ...editMovimientoForm, notas: e.target.value })}
                  placeholder="Observaciones..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowEditMovimientoModal(false);
                    setMovimientoAEditar(null);
                    setEditMovimientoForm({});
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (movimientoAEditar) {
                      actualizarMovimientoMutation.mutate({
                        movimientoId: movimientoAEditar.id,
                        data: editMovimientoForm,
                      });
                    }
                  }}
                  disabled={!editMovimientoForm.concepto || !editMovimientoForm.monto || actualizarMovimientoMutation.isPending}
                  className={editMovimientoForm.es_ingreso ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                >
                  {actualizarMovimientoMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Transferencia entre cuentas — crea dos movimientos vinculados
          (egreso en origen + ingreso en destino) con la misma referencia. */}
      {showTransferenciaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg m-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
                Transferencia entre cuentas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Desde *</Label>
                  <Select
                    value={transferenciaForm.cuenta_origen}
                    onValueChange={(v) =>
                      setTransferenciaForm({ ...transferenciaForm, cuenta_origen: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Cuenta origen" />
                    </SelectTrigger>
                    <SelectContent>
                      {cuentasBancarias?.map((c) => {
                        const icono =
                          c.tipo_cuenta === 'efectivo'
                            ? '💵'
                            : c.tipo_cuenta === 'billetera_virtual'
                            ? '📱'
                            : '🏦';
                        const label =
                          c.tipo_cuenta === 'efectivo' || c.tipo_cuenta === 'billetera_virtual'
                            ? c.nombre
                            : `${c.banco} - ${c.numero_cuenta}`;
                        return (
                          <SelectItem key={c.id} value={c.id}>
                            {icono} {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Hacia *</Label>
                  <Select
                    value={transferenciaForm.cuenta_destino}
                    onValueChange={(v) =>
                      setTransferenciaForm({ ...transferenciaForm, cuenta_destino: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Cuenta destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {cuentasBancarias?.map((c) => {
                        const icono =
                          c.tipo_cuenta === 'efectivo'
                            ? '💵'
                            : c.tipo_cuenta === 'billetera_virtual'
                            ? '📱'
                            : '🏦';
                        const label =
                          c.tipo_cuenta === 'efectivo' || c.tipo_cuenta === 'billetera_virtual'
                            ? c.nombre
                            : `${c.banco} - ${c.numero_cuenta}`;
                        return (
                          <SelectItem
                            key={c.id}
                            value={c.id}
                            disabled={c.id === transferenciaForm.cuenta_origen}
                          >
                            {icono} {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monto *</Label>
                  <InputMoneda
                    value={transferenciaForm.monto ? Number(transferenciaForm.monto) : null}
                    onChange={(v) =>
                      setTransferenciaForm({
                        ...transferenciaForm,
                        monto: v != null ? String(v) : '',
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha *</Label>
                  <Input
                    type="date"
                    value={transferenciaForm.fecha}
                    onChange={(e) =>
                      setTransferenciaForm({ ...transferenciaForm, fecha: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Concepto *</Label>
                <Input
                  value={transferenciaForm.concepto}
                  onChange={(e) =>
                    setTransferenciaForm({ ...transferenciaForm, concepto: e.target.value })
                  }
                  placeholder="Ej: Depósito de recaudación del día"
                />
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={transferenciaForm.notas}
                  onChange={(e) =>
                    setTransferenciaForm({ ...transferenciaForm, notas: e.target.value })
                  }
                  placeholder="Observaciones adicionales..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowTransferenciaModal(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => transferenciaMutation.mutate()}
                  disabled={
                    !transferenciaForm.concepto ||
                    !transferenciaForm.monto ||
                    !transferenciaForm.cuenta_destino ||
                    transferenciaForm.cuenta_origen === transferenciaForm.cuenta_destino ||
                    transferenciaMutation.isPending
                  }
                >
                  {transferenciaMutation.isPending ? 'Transfiriendo...' : 'Transferir'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Detalle de Movimiento — vista expandida del movimiento con todas
          las vinculaciones (cliente, proveedor, cheque, caja, cuenta bancaria,
          usuario que lo registró). Se abre al clickear una fila del listado. */}
      {movimientoDetalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-xl m-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Detalle del movimiento
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMovimientoDetalle(null)}
                >
                  <XCircle className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                {movimientoDetalle.es_ingreso ? (
                  <ArrowUpCircle className="h-8 w-8 text-green-600" />
                ) : (
                  <ArrowDownCircle className="h-8 w-8 text-red-600" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base">{movimientoDetalle.concepto}</p>
                  <p className="text-xs text-muted-foreground">
                    {movimientoDetalle.tipo?.replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-xl font-bold ${
                      movimientoDetalle.es_ingreso ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {movimientoDetalle.es_ingreso ? '+' : '-'}$
                    {formatNumber(Number(movimientoDetalle.monto || 0), 2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatearFecha(movimientoDetalle.fecha)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Método de pago</p>
                  <p className="font-medium capitalize">
                    {(movimientoDetalle as any).metodo_pago || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Origen del registro</p>
                  <p className="font-medium capitalize">
                    {movimientoDetalle.origen?.replace(/_/g, ' ') || '—'}
                  </p>
                </div>
                {(movimientoDetalle as any).cliente_nombre && (
                  <div>
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="font-medium">{(movimientoDetalle as any).cliente_nombre}</p>
                  </div>
                )}
                {(movimientoDetalle as any).proveedor_nombre && (
                  <div>
                    <p className="text-xs text-muted-foreground">Proveedor</p>
                    <p className="font-medium">{(movimientoDetalle as any).proveedor_nombre}</p>
                  </div>
                )}
                {(movimientoDetalle as any).categoria_gasto_nombre && (
                  <div>
                    <p className="text-xs text-muted-foreground">Categoría de gasto</p>
                    <p className="font-medium">
                      {(movimientoDetalle as any).categoria_gasto_nombre}
                    </p>
                  </div>
                )}
                {(movimientoDetalle as any).cheque_numero && (
                  <div>
                    <p className="text-xs text-muted-foreground">Cheque</p>
                    <p className="font-medium">#{(movimientoDetalle as any).cheque_numero}</p>
                  </div>
                )}
                {(movimientoDetalle as any).cuenta_destino_nombre && (
                  <div>
                    <p className="text-xs text-muted-foreground">Cuenta bancaria</p>
                    <p className="font-medium">{(movimientoDetalle as any).cuenta_destino_nombre}</p>
                  </div>
                )}
                {(movimientoDetalle as any).registrado_por_nombre && (
                  <div>
                    <p className="text-xs text-muted-foreground">Registrado por</p>
                    <p className="font-medium">
                      {(movimientoDetalle as any).registrado_por_nombre}
                    </p>
                  </div>
                )}
                {(movimientoDetalle as any).numero_transferencia && (
                  <div>
                    <p className="text-xs text-muted-foreground">N° transferencia</p>
                    <p className="font-medium font-mono text-xs">
                      {(movimientoDetalle as any).numero_transferencia}
                    </p>
                  </div>
                )}
              </div>

              {(movimientoDetalle as any).descripcion && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Descripción</p>
                  <p className="whitespace-pre-wrap">
                    {(movimientoDetalle as any).descripcion}
                  </p>
                </div>
              )}

              {(movimientoDetalle as any).notas && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Notas</p>
                  <p className="whitespace-pre-wrap">{(movimientoDetalle as any).notas}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal "Nueva categoría de gasto" — abierto desde el "+" al lado del
          selector de categoría. Al crearla, se auto-selecciona en el form. */}
      {nuevaCategoriaDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <Card className="w-full max-w-sm m-4">
            <CardHeader>
              <CardTitle className="text-base">Nueva categoría de gasto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Nombre *</Label>
                <Input
                  autoFocus
                  value={nuevaCategoriaNombre}
                  onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
                  placeholder="Ej: Mantenimiento edificio"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && nuevaCategoriaNombre.trim()) {
                      crearCategoriaGastoMutation.mutate(nuevaCategoriaNombre.trim());
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNuevaCategoriaDialog(false);
                    setNuevaCategoriaNombre('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={!nuevaCategoriaNombre.trim() || crearCategoriaGastoMutation.isPending}
                  onClick={() =>
                    crearCategoriaGastoMutation.mutate(nuevaCategoriaNombre.trim())
                  }
                >
                  {crearCategoriaGastoMutation.isPending ? 'Creando...' : 'Crear'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Editar saldo de una cuenta — ajuste manual auditado. */}
      {editarSaldoCuenta && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle className="text-base">
                Ajustar saldo — {editarSaldoCuenta.nombre || editarSaldoCuenta.banco}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-gray-50 rounded-md px-3 py-2 text-sm flex justify-between">
                <span className="text-muted-foreground">Saldo actual:</span>
                <span className="font-semibold">
                  ${formatNumber(Number(editarSaldoCuenta.saldo_actual || 0), 2)}
                </span>
              </div>

              <div className="space-y-1">
                <Label>Nuevo saldo *</Label>
                <InputMoneda
                  value={nuevoSaldoCuenta}
                  onChange={(v) => setNuevoSaldoCuenta(v)}
                />
                {nuevoSaldoCuenta != null && (
                  <p className="text-xs text-muted-foreground">
                    Diferencia:{' '}
                    <span
                      className={
                        nuevoSaldoCuenta - Number(editarSaldoCuenta.saldo_actual || 0) >= 0
                          ? 'text-green-700 font-medium'
                          : 'text-red-700 font-medium'
                      }
                    >
                      {nuevoSaldoCuenta - Number(editarSaldoCuenta.saldo_actual || 0) >= 0 ? '+' : ''}
                      ${formatNumber(
                        nuevoSaldoCuenta - Number(editarSaldoCuenta.saldo_actual || 0),
                        2,
                      )}
                    </span>
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Motivo del ajuste</Label>
                <Textarea
                  value={motivoAjuste}
                  onChange={(e) => setMotivoAjuste(e.target.value)}
                  placeholder="Ej: Corrección de carga inicial / conciliación con extracto / etc."
                />
                <p className="text-[11px] text-muted-foreground">
                  Queda guardado en el historial abajo de la cuenta junto con tu usuario y la fecha.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditarSaldoCuenta(null);
                    setNuevoSaldoCuenta(null);
                    setMotivoAjuste('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={
                    nuevoSaldoCuenta == null ||
                    nuevoSaldoCuenta === Number(editarSaldoCuenta.saldo_actual || 0) ||
                    editarSaldoMutation.isPending
                  }
                  onClick={() => editarSaldoMutation.mutate()}
                >
                  {editarSaldoMutation.isPending ? 'Guardando...' : 'Guardar ajuste'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
