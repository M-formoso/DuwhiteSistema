/**
 * Página de Tesorería - Gestión de cheques y movimientos
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Plus,
  FileCheck,
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
  Ban,
  Building2,
  Calendar,
  User,
  Pencil,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Combobox } from '@/components/ui/combobox';
import { useToast } from '@/hooks/use-toast';

import { tesoreriaService } from '@/services/tesoreriaService';
import { clienteService } from '@/services/clienteService';
import { proveedorService } from '@/services/proveedorService';
import { finanzasService } from '@/services/finanzasService';
import { formatNumber, getLocalDateString } from '@/utils/formatters';
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
  EstadoCheque,
} from '@/types/tesoreria';

export default function TesoreriaPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Estados
  const [activeTab, setActiveTab] = useState('resumen');
  const [showChequeModal, setShowChequeModal] = useState(false);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [showAccionChequeModal, setShowAccionChequeModal] = useState(false);
  const [accionCheque, setAccionCheque] = useState<'depositar' | 'cobrar' | 'rechazar' | 'entregar' | null>(null);
  const [chequeSeleccionado, setChequeSeleccionado] = useState<ChequeList | null>(null);
  const [editingCheque, setEditingCheque] = useState<ChequeList | null>(null);
  const [showDeleteChequeDialog, setShowDeleteChequeDialog] = useState(false);
  const [chequeAEliminar, setChequeAEliminar] = useState<ChequeList | null>(null);

  // Filtros cheques
  const [chequeFiltroEstado, setChequeFiltroEstado] = useState<string>('');
  const [chequeFiltroBuscar, setChequeFiltroBuscar] = useState('');
  const [chequeFiltroTipo, setChequeFiltroTipo] = useState<string>('');

  // Filtros movimientos
  const [movFiltroTipo, setMovFiltroTipo] = useState<string>('');
  const [movFiltroBuscar, setMovFiltroBuscar] = useState('');

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
    tipo: 'ingreso_efectivo',
    concepto: '',
    monto: 0,
    es_ingreso: true,
    fecha_movimiento: getLocalDateString(),
    metodo_pago: 'efectivo',
    cliente_id: null,
    proveedor_id: null,
  });

  // Form acción cheque
  const [accionForm, setAccionForm] = useState({
    cuenta_destino_id: '',
    fecha: getLocalDateString(),
    motivo_rechazo: '',
    concepto: '',
    proveedor_id: '',
    notas: '',
  });

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
    queryKey: ['tesoreria-movimientos', movFiltroTipo, movFiltroBuscar],
    queryFn: () =>
      tesoreriaService.movimientos.getMovimientos({
        tipo: movFiltroTipo || undefined,
        buscar: movFiltroBuscar || undefined,
        limit: 100,
      }),
  });

  const { data: clientes, isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes-lista'],
    queryFn: () => clienteService.getClientes({ limit: 100, activo: true }),
  });

  const { data: proveedores, isLoading: loadingProveedores } = useQuery({
    queryKey: ['proveedores-lista'],
    queryFn: () => proveedorService.getProveedores({ limit: 100, solo_activos: true }),
  });

  // Query Caja actual
  const { data: cajaActual } = useQuery({
    queryKey: ['caja-actual'],
    queryFn: () => finanzasService.getCajaActual(),
  });

  // Query Cuentas Bancarias
  const { data: cuentasBancarias, isLoading: loadingCuentas } = useQuery({
    queryKey: ['cuentas-bancarias'],
    queryFn: () => finanzasService.getCuentasBancarias(true),
  });

  // Calcular totales
  const totalBancos = cuentasBancarias?.reduce((acc, c) => acc + (c.saldo_actual || 0), 0) || 0;
  const saldoCaja = cajaActual?.saldo_calculado || 0;

  // Mutations
  const crearChequeMutation = useMutation({
    mutationFn: (data: ChequeCreate) => tesoreriaService.cheques.crearCheque(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-cheques'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria-resumen'] });
      // Invalidar cuenta corriente del cliente (se imputa automáticamente)
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cc-cliente'] });
      toast({
        title: 'Cheque registrado correctamente',
        description: chequeForm.origen === 'recibido_cliente'
          ? 'El pago fue imputado automáticamente a la cuenta corriente del cliente'
          : undefined,
      });
      setShowChequeModal(false);
      resetChequeForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo registrar el cheque',
        variant: 'destructive',
      });
    },
  });

  const crearMovimientoMutation = useMutation({
    mutationFn: (data: MovimientoTesoreriaCreate) =>
      tesoreriaService.movimientos.crearMovimiento(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria-resumen'] });
      toast({ title: 'Movimiento registrado correctamente' });
      setShowMovimientoModal(false);
      resetMovimientoForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo registrar el movimiento',
        variant: 'destructive',
      });
    },
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
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo depositar el cheque',
        variant: 'destructive',
      });
    },
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
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo marcar como cobrado',
        variant: 'destructive',
      });
    },
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
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo rechazar el cheque',
        variant: 'destructive',
      });
    },
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
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo entregar el cheque',
        variant: 'destructive',
      });
    },
  });

  const anularMovimientoMutation = useMutation({
    mutationFn: ({ movimientoId, motivo }: { movimientoId: string; motivo: string }) =>
      tesoreriaService.movimientos.anularMovimiento(movimientoId, { motivo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria-movimientos'] });
      queryClient.invalidateQueries({ queryKey: ['tesoreria-resumen'] });
      toast({ title: 'Movimiento anulado' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo anular el movimiento',
        variant: 'destructive',
      });
    },
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
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo actualizar el cheque',
        variant: 'destructive',
      });
    },
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
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'No se pudo eliminar el cheque',
        variant: 'destructive',
      });
    },
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
      tipo: 'ingreso_efectivo',
      concepto: '',
      monto: 0,
      es_ingreso: true,
      fecha_movimiento: getLocalDateString(),
      metodo_pago: 'efectivo',
      cliente_id: null,
      proveedor_id: null,
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
    return new Date(fecha).toLocaleDateString('es-AR');
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
          <Button variant="outline" onClick={() => setShowChequeModal(true)}>
            <FileCheck className="h-4 w-4 mr-2" />
            Nuevo Cheque
          </Button>
          <Button onClick={() => setShowMovimientoModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Movimiento
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="caja">Caja</TabsTrigger>
          <TabsTrigger value="bancos">Bancos</TabsTrigger>
          <TabsTrigger value="cheques">Cheques</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
        </TabsList>

        {/* Tab Resumen */}
        <TabsContent value="resumen" className="space-y-6">
          {/* Saldos Principales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600">Efectivo en Caja</p>
                    <p className="text-2xl font-bold text-green-700">
                      ${formatNumber(saldoCaja, 2)}
                    </p>
                    <p className="text-xs text-green-600">
                      {cajaActual ? 'Caja abierta' : 'Sin caja abierta'}
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
                      ${formatNumber(totalBancos, 2)}
                    </p>
                    <p className="text-xs text-purple-600">
                      {cuentasBancarias?.length || 0} cuenta(s)
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
                      ${formatNumber(saldoCaja + totalBancos + (resumen?.total_cheques_cartera || 0), 2)}
                    </p>
                    <p className="text-xs text-primary">
                      Efectivo + Bancos + Cheques
                    </p>
                  </div>
                  <Wallet className="h-10 w-10 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>

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
                          </p>
                        </div>
                      </div>
                      <p className={`text-lg font-bold ${(cuenta.saldo_actual || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${formatNumber(cuenta.saldo_actual || 0, 2)}
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

        {/* Tab Caja */}
        <TabsContent value="caja" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-green-600" />
                Caja de Efectivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cajaActual ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">Saldo Inicial</p>
                      <p className="text-xl font-bold">${formatNumber(cajaActual.saldo_inicial || 0, 2)}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-600">Total Ingresos</p>
                      <p className="text-xl font-bold text-green-600">${formatNumber(cajaActual.total_ingresos || 0, 2)}</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-600">Total Egresos</p>
                      <p className="text-xl font-bold text-red-600">${formatNumber(cajaActual.total_egresos || 0, 2)}</p>
                    </div>
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <p className="text-sm text-primary">Saldo Actual</p>
                      <p className="text-xl font-bold text-primary">${formatNumber(cajaActual.saldo_calculado || 0, 2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="h-4 w-4" />
                    Caja abierta: {formatearFecha(cajaActual.fecha_apertura)}
                    {cajaActual.abierta_por_nombre && ` por ${cajaActual.abierta_por_nombre}`}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Banknote className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No hay caja abierta actualmente</p>
                  <p className="text-sm text-gray-400">Abrí una caja desde el módulo de Finanzas para registrar movimientos de efectivo</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Bancos */}
        <TabsContent value="bancos" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-purple-600" />
                  Cuentas Bancarias
                </CardTitle>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Saldo Total</p>
                  <p className="text-2xl font-bold text-purple-600">${formatNumber(totalBancos, 2)}</p>
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
                  {cuentasBancarias.map((cuenta) => (
                    <div key={cuenta.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-lg">
                          <CreditCard className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-semibold">{cuenta.banco}</p>
                          <p className="text-sm text-gray-500">
                            {cuenta.tipo_cuenta === 'cuenta_corriente' ? 'Cuenta Corriente' :
                             cuenta.tipo_cuenta === 'caja_ahorro' ? 'Caja de Ahorro' : cuenta.tipo_cuenta}
                          </p>
                          <p className="text-xs text-gray-400">
                            {cuenta.alias && `${cuenta.alias} - `}{cuenta.numero_cuenta}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-bold ${(cuenta.saldo_actual || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${formatNumber(cuenta.saldo_actual || 0, 2)}
                        </p>
                        <p className="text-xs text-gray-400">{cuenta.moneda || 'ARS'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No hay cuentas bancarias registradas</p>
                  <p className="text-sm text-gray-400">Agregá cuentas desde Finanzas → Cuentas Bancarias</p>
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
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
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
                <Select value={movFiltroTipo || "_all"} onValueChange={(v) => setMovFiltroTipo(v === "_all" ? "" : v)}>
                  <SelectTrigger className="w-[180px]">
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
            </CardContent>
          </Card>

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
                      className={`flex items-center justify-between p-4 rounded-lg ${
                        mov.anulado
                          ? 'bg-gray-100 opacity-60'
                          : mov.es_ingreso
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
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Badge variant="outline">
                              {METODOS_PAGO_TESORERIA.find((m) => m.value === mov.metodo_pago)?.label}
                            </Badge>
                            <span>{formatearFecha(mov.fecha_movimiento)}</span>
                            {mov.cliente_nombre && <span>- {mov.cliente_nombre}</span>}
                            {mov.proveedor_nombre && <span>- {mov.proveedor_nombre}</span>}
                            {mov.cheque_numero && <span>- Cheque #{mov.cheque_numero}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span
                          className={`text-lg font-bold ${
                            mov.anulado
                              ? 'text-gray-400 line-through'
                              : mov.es_ingreso
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {mov.es_ingreso ? '+' : '-'}${formatNumber(mov.monto, 2)}
                        </span>
                        {mov.anulado ? (
                          <Badge variant="destructive">Anulado</Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('¿Está seguro de anular este movimiento?')) {
                                anularMovimientoMutation.mutate({
                                  movimientoId: mov.id,
                                  motivo: 'Anulado por el usuario',
                                });
                              }
                            }}
                          >
                            <Ban className="h-4 w-4 text-gray-400 hover:text-red-500" />
                          </Button>
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
      {showChequeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg m-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{editingCheque ? 'Editar Cheque' : 'Registrar Cheque'}</CardTitle>
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
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={chequeForm.monto || ''}
                    onChange={(e) => setChequeForm({ ...chequeForm, monto: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
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
                    if (editingCheque) {
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
                    } else {
                      crearChequeMutation.mutate(chequeForm);
                    }
                  }}
                  disabled={
                    !chequeForm.numero ||
                    !chequeForm.monto ||
                    !chequeForm.fecha_vencimiento ||
                    (!editingCheque && chequeForm.origen === 'recibido_cliente' && !chequeForm.cliente_id) ||
                    crearChequeMutation.isPending ||
                    actualizarChequeMutation.isPending
                  }
                >
                  {editingCheque ? 'Guardar Cambios' : 'Registrar Cheque'}
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
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={movimientoForm.monto || ''}
                    onChange={(e) => setMovimientoForm({ ...movimientoForm, monto: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
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

              <div className="space-y-2">
                <Label>Método de Pago *</Label>
                <Select
                  value={movimientoForm.metodo_pago}
                  onValueChange={(v) => setMovimientoForm({ ...movimientoForm, metodo_pago: v as any })}
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

              {movimientoForm.metodo_pago === 'transferencia' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Banco Origen</Label>
                    <Select
                      value={movimientoForm.banco_origen || ''}
                      onValueChange={(v) => setMovimientoForm({ ...movimientoForm, banco_origen: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
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
                  <div className="space-y-2">
                    <Label>Banco Destino</Label>
                    <Select
                      value={movimientoForm.banco_destino || ''}
                      onValueChange={(v) => setMovimientoForm({ ...movimientoForm, banco_destino: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
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
                <div className="space-y-2">
                  <Label>Proveedor (opcional)</Label>
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
                  onClick={() => crearMovimientoMutation.mutate({
                    ...movimientoForm,
                    tipo: movimientoForm.es_ingreso
                      ? `ingreso_${movimientoForm.metodo_pago}`
                      : `egreso_${movimientoForm.metodo_pago}`,
                  })}
                  disabled={!movimientoForm.concepto || !movimientoForm.monto || crearMovimientoMutation.isPending}
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
    </div>
  );
}
