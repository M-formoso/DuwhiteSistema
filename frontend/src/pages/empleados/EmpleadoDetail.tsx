/**
 * Detalle de Empleado
 */

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  Heart,
  Clock,
  DollarSign,
  Building2,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Banknote,
  ChevronDown,
  ChevronUp,
  History,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  getEmpleado,
  deleteEmpleado,
  getAsistencias,
  getMovimientosNomina,
  createMovimientoNomina,
  pagarMovimientoNomina,
} from '@/services/empleadoService';
import {
  TIPOS_EMPLEADO,
  ESTADOS_EMPLEADO,
  TIPOS_CONTRATO,
  TIPOS_CONTRATACION,
  TIPOS_MOVIMIENTO_NOMINA,
  getEstadoBadgeColor,
  getTipoBadgeColor,
  getTipoContratacionBadgeColor,
  getTipoContratacionLabel,
} from '@/types/empleado';
import type { MovimientoNominaCreate, TipoMovimientoNomina } from '@/types/empleado';
import { formatDate, getLocalDateString } from '@/utils/formatters';

const currentDate = new Date();

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

export default function EmpleadoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [selectedMovimiento, setSelectedMovimiento] = useState<string | null>(null);
  const [showHistorialCompleto, setShowHistorialCompleto] = useState(false);

  // Form para nuevo movimiento
  const [movimientoForm, setMovimientoForm] = useState({
    tipo: 'adelanto' as TipoMovimientoNomina,
    concepto: '',
    descripcion: '',
    monto: '',
    periodo_mes: currentDate.getMonth() + 1,
    periodo_anio: currentDate.getFullYear(),
    es_debito: false,
  });

  // Form para pago
  const [pagoForm, setPagoForm] = useState({
    fecha_pago: getLocalDateString(currentDate),
    medio_pago: 'efectivo',
    comprobante: '',
  });

  const { data: empleado, isLoading } = useQuery({
    queryKey: ['empleado', id],
    queryFn: () => getEmpleado(id!),
    enabled: !!id,
  });

  const { data: asistenciasData } = useQuery({
    queryKey: ['asistencias', id],
    queryFn: () => getAsistencias({ empleado_id: id!, limit: 10 }),
    enabled: !!id,
  });

  const { data: movimientosData } = useQuery({
    queryKey: ['movimientos-nomina', id],
    queryFn: () => getMovimientosNomina({ empleado_id: id!, limit: 100 }),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEmpleado(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empleados'] });
      toast.success('Empleado eliminado exitosamente');
      navigate('/empleados');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al eliminar empleado');
    },
  });

  // Crear movimiento de nómina
  const createMovimientoMutation = useMutation({
    mutationFn: (data: MovimientoNominaCreate) => createMovimientoNomina(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientos-nomina', id] });
      toast.success('Movimiento registrado exitosamente');
      setShowMovimientoModal(false);
      resetMovimientoForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al crear movimiento');
    },
  });

  // Pagar movimiento
  const pagarMovimientoMutation = useMutation({
    mutationFn: ({ movId, data }: { movId: string; data: any }) =>
      pagarMovimientoNomina(movId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientos-nomina', id] });
      toast.success('Pago registrado exitosamente');
      setShowPagoModal(false);
      setSelectedMovimiento(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al registrar pago');
    },
  });

  const resetMovimientoForm = () => {
    setMovimientoForm({
      tipo: 'adelanto',
      concepto: '',
      descripcion: '',
      monto: '',
      periodo_mes: currentDate.getMonth() + 1,
      periodo_anio: currentDate.getFullYear(),
      es_debito: false,
    });
  };

  const handleCreateMovimiento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movimientoForm.concepto.trim()) {
      toast.error('Ingresa un concepto');
      return;
    }
    if (!movimientoForm.monto || parseFloat(movimientoForm.monto) <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }

    createMovimientoMutation.mutate({
      empleado_id: id!,
      tipo: movimientoForm.tipo,
      concepto: movimientoForm.concepto,
      descripcion: movimientoForm.descripcion || undefined,
      monto: parseFloat(movimientoForm.monto),
      periodo_mes: movimientoForm.periodo_mes,
      periodo_anio: movimientoForm.periodo_anio,
      es_debito: movimientoForm.es_debito,
    });
  };

  const handlePagarMovimiento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovimiento) return;

    pagarMovimientoMutation.mutate({
      movId: selectedMovimiento,
      data: {
        fecha_pago: pagoForm.fecha_pago,
        medio_pago: pagoForm.medio_pago,
        comprobante: pagoForm.comprobante || undefined,
        registrar_en_caja: true,
      },
    });
  };

  const openPagoModal = (movId: string) => {
    setSelectedMovimiento(movId);
    setPagoForm({
      fecha_pago: getLocalDateString(currentDate),
      medio_pago: 'efectivo',
      comprobante: '',
    });
    setShowPagoModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!empleado) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Empleado no encontrado</p>
      </div>
    );
  }

  const formatDateLocal = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return formatDate(dateStr);
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-';
    return timeStr.substring(0, 5);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/empleados')}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {empleado.nombre.charAt(0)}
                {empleado.apellido.charAt(0)}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                {empleado.nombre_completo}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-muted-foreground">{empleado.codigo}</span>
                <span
                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getEstadoBadgeColor(
                    empleado.estado
                  )}`}
                >
                  {ESTADOS_EMPLEADO.find((e) => e.value === empleado.estado)?.label}
                </span>
                <span
                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getTipoBadgeColor(
                    empleado.tipo
                  )}`}
                >
                  {TIPOS_EMPLEADO.find((t) => t.value === empleado.tipo)?.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/empleados/${id}/editar`}
            className="inline-flex items-center gap-2 px-4 py-2 border border-input rounded-lg text-text-primary hover:bg-muted transition-colors"
          >
            <Edit className="w-4 h-4" />
            Editar
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos Personales */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Datos Personales
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">DNI</p>
                <p className="text-text-primary font-medium">{empleado.dni}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CUIL</p>
                <p className="text-text-primary font-medium">{empleado.cuil || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fecha de Nacimiento</p>
                <p className="text-text-primary font-medium">
                  {formatDateLocal(empleado.fecha_nacimiento)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Teléfono</p>
                <p className="text-text-primary font-medium">
                  {empleado.telefono ? (
                    <a
                      href={`tel:${empleado.telefono}`}
                      className="flex items-center gap-1 hover:text-primary"
                    >
                      <Phone className="w-4 h-4" />
                      {empleado.telefono}
                    </a>
                  ) : (
                    '-'
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-text-primary font-medium">
                  {empleado.email ? (
                    <a
                      href={`mailto:${empleado.email}`}
                      className="flex items-center gap-1 hover:text-primary"
                    >
                      <Mail className="w-4 h-4" />
                      {empleado.email}
                    </a>
                  ) : (
                    '-'
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dirección</p>
                <p className="text-text-primary font-medium flex items-center gap-1">
                  {empleado.direccion && <MapPin className="w-4 h-4" />}
                  {empleado.direccion || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ciudad</p>
                <p className="text-text-primary font-medium">{empleado.ciudad || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contacto Emergencia</p>
                <p className="text-text-primary font-medium">
                  {empleado.contacto_emergencia || '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Datos Laborales */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Datos Laborales
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Tipo de Contrato</p>
                <p className="text-text-primary font-medium">
                  {TIPOS_CONTRATO.find((t) => t.value === empleado.tipo_contrato)?.label}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Puesto</p>
                <p className="text-text-primary font-medium">{empleado.puesto || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Departamento</p>
                <p className="text-text-primary font-medium">{empleado.departamento || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fecha de Ingreso</p>
                <p className="text-text-primary font-medium flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDateLocal(empleado.fecha_ingreso)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Horario</p>
                <p className="text-text-primary font-medium flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatTime(empleado.horario_entrada)} - {formatTime(empleado.horario_salida)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Días de Trabajo</p>
                <p className="text-text-primary font-medium">{empleado.dias_trabajo || '-'}</p>
              </div>
            </div>
          </div>

          {/* Datos Bancarios */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Datos Bancarios
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Banco</p>
                <p className="text-text-primary font-medium">{empleado.banco || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo de Cuenta</p>
                <p className="text-text-primary font-medium">
                  {empleado.tipo_cuenta_banco === 'caja_ahorro'
                    ? 'Caja de Ahorro'
                    : empleado.tipo_cuenta_banco === 'cuenta_corriente'
                    ? 'Cuenta Corriente'
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Número de Cuenta</p>
                <p className="text-text-primary font-medium">
                  {empleado.numero_cuenta_banco || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CBU</p>
                <p className="text-text-primary font-medium font-mono text-sm">
                  {empleado.cbu || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Alias</p>
                <p className="text-text-primary font-medium">{empleado.alias_cbu || '-'}</p>
              </div>
            </div>
          </div>

          {/* Obra Social */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              Obra Social / ART
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Obra Social</p>
                <p className="text-text-primary font-medium">{empleado.obra_social || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">N° Afiliado</p>
                <p className="text-text-primary font-medium">{empleado.numero_afiliado_os || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ART</p>
                <p className="text-text-primary font-medium">{empleado.art || '-'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tipo de Contratación */}
          <div className={`border rounded-lg p-6 ${
            empleado.tipo_contratacion === 'blanco'
              ? 'bg-emerald-50 border-emerald-200'
              : empleado.tipo_contratacion === 'negro'
              ? 'bg-red-50 border-red-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            <h3 className="text-lg font-semibold text-text-primary mb-3">
              Tipo de Contratación
            </h3>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex px-3 py-1.5 text-sm font-bold rounded-full ${getTipoContratacionBadgeColor(
                  empleado.tipo_contratacion
                )}`}
              >
                {getTipoContratacionLabel(empleado.tipo_contratacion)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {TIPOS_CONTRATACION.find(t => t.value === empleado.tipo_contratacion)?.description}
            </p>
          </div>

          {/* Información de Pago */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Información de Pago
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Salario Base</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(empleado.salario_base)}
                </p>
              </div>
              {empleado.salario_hora && (
                <div>
                  <p className="text-sm text-muted-foreground">Salario por Hora</p>
                  <p className="text-lg font-semibold text-text-primary">
                    {formatCurrency(empleado.salario_hora)}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                <div>
                  <p className="text-sm text-muted-foreground">Día de Pago</p>
                  <p className="text-lg font-semibold text-text-primary">
                    {empleado.dia_pago || 5}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Jornada</p>
                  <p className="text-lg font-semibold text-text-primary">
                    {empleado.jornada_horas}h
                  </p>
                </div>
              </div>
              <div className="pt-3 border-t border-border">
                <p className="text-sm text-muted-foreground">Adelanto Máximo</p>
                <p className="text-lg font-semibold text-text-primary">
                  {empleado.adelanto_maximo_porcentaje || 50}% del salario
                </p>
                <p className="text-sm text-emerald-600 font-medium">
                  (Hasta {formatCurrency((empleado.salario_base * (empleado.adelanto_maximo_porcentaje || 50)) / 100)})
                </p>
              </div>
            </div>
          </div>

          {/* Liquidación del Mes Actual */}
          {movimientosData?.items && (() => {
            const mesActual = currentDate.getMonth() + 1;
            const anioActual = currentDate.getFullYear();

            // Filtrar movimientos del período actual (mes actual) que no estén pagados
            const movimientosMesActual = movimientosData.items.filter(
              m => m.periodo_mes === mesActual && m.periodo_anio === anioActual && !m.pagado
            );

            // Calcular totales por tipo
            const totalAdelantos = movimientosMesActual
              .filter(m => m.tipo === 'adelanto')
              .reduce((sum, m) => sum + m.monto, 0);

            const totalBonos = movimientosMesActual
              .filter(m => m.tipo === 'bono' || m.tipo === 'hora_extra')
              .reduce((sum, m) => sum + m.monto, 0);

            const totalDescuentos = movimientosMesActual
              .filter(m => m.tipo === 'descuento' || m.es_debito)
              .reduce((sum, m) => sum + m.monto, 0);

            // Saldo a pagar = Salario Base - Adelantos + Bonos - Descuentos
            const saldoAPagar = empleado.salario_base - totalAdelantos + totalBonos - totalDescuentos;

            const mesNombre = MESES.find(m => m.value === mesActual)?.label || '';

            return (
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Liquidación {mesNombre} {anioActual}
                </h3>
                <div className="space-y-3">
                  {/* Salario Base */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Salario Base</span>
                    <span className="font-semibold text-text-primary">
                      {formatCurrency(empleado.salario_base)}
                    </span>
                  </div>

                  {/* Adelantos */}
                  {totalAdelantos > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-amber-600">(-) Adelantos</span>
                      <span className="font-semibold text-amber-600">
                        - {formatCurrency(totalAdelantos)}
                      </span>
                    </div>
                  )}

                  {/* Bonos */}
                  {totalBonos > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-emerald-600">(+) Bonos / Horas Extra</span>
                      <span className="font-semibold text-emerald-600">
                        + {formatCurrency(totalBonos)}
                      </span>
                    </div>
                  )}

                  {/* Descuentos */}
                  {totalDescuentos > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-red-600">(-) Descuentos</span>
                      <span className="font-semibold text-red-600">
                        - {formatCurrency(totalDescuentos)}
                      </span>
                    </div>
                  )}

                  {/* Línea divisora */}
                  <div className="border-t-2 border-primary/30 pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-semibold text-primary">
                        Saldo a Pagar
                      </span>
                      <span className={`text-2xl font-bold ${saldoAPagar >= 0 ? 'text-primary' : 'text-red-600'}`}>
                        {formatCurrency(saldoAPagar)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      A pagar el día {empleado.dia_pago || 5} de {MESES.find(m => m.value === (mesActual === 12 ? 1 : mesActual + 1))?.label}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Adelantos y Movimientos */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Banknote className="w-5 h-5 text-primary" />
                Movimientos de Nómina
              </h3>
              <button
                onClick={() => setShowMovimientoModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nuevo
              </button>
            </div>

            {movimientosData?.items && (() => {
              const adelantos = movimientosData.items.filter(m => m.tipo === 'adelanto');
              const adelantosPendientes = adelantos.filter(m => !m.pagado);
              const totalPendiente = adelantosPendientes.reduce((sum, m) => sum + m.monto, 0);
              const movimientosPendientes = movimientosData.items.filter(m => !m.pagado);
              const movimientosPagados = movimientosData.items.filter(m => m.pagado);

              const formatDateTime = (dateStr: string) => {
                const date = new Date(dateStr);
                return date.toLocaleString('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
              };

              return (
                <div className="space-y-4">
                  {/* Resumen de adelantos pendientes */}
                  {adelantosPendientes.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">Adelantos pendientes de pago</p>
                      <p className="text-xl font-bold text-amber-600">
                        {formatCurrency(totalPendiente)}
                      </p>
                    </div>
                  )}

                  {/* Lista de movimientos pendientes */}
                  {movimientosPendientes.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Pendientes de pago:</p>
                      {movimientosPendientes.map((mov) => (
                        <div
                          key={mov.id}
                          className="p-3 bg-muted/30 rounded-lg border border-border"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  mov.tipo === 'adelanto' ? 'bg-amber-100 text-amber-700' :
                                  mov.tipo === 'bono' ? 'bg-emerald-100 text-emerald-700' :
                                  mov.tipo === 'descuento' ? 'bg-red-100 text-red-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {TIPOS_MOVIMIENTO_NOMINA.find(t => t.value === mov.tipo)?.label}
                                </span>
                                <p className="text-sm text-text-primary font-medium">{mov.concepto}</p>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {MESES.find(m => m.value === mov.periodo_mes)?.label} {mov.periodo_anio}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`font-bold ${mov.es_debito ? 'text-red-600' : 'text-emerald-600'}`}>
                                {mov.es_debito ? '-' : '+'}{formatCurrency(mov.monto)}
                              </span>
                              <button
                                onClick={() => openPagoModal(mov.id)}
                                className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors"
                              >
                                Pagar
                              </button>
                            </div>
                          </div>
                          {/* Info de registro */}
                          <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDateTime(mov.created_at)}
                            </span>
                            {mov.registrado_por_nombre && (
                              <span className="flex items-center gap-1">
                                <UserCheck className="w-3 h-3" />
                                {mov.registrado_por_nombre}
                              </span>
                            )}
                          </div>
                          {mov.descripcion && (
                            <p className="mt-1 text-xs text-muted-foreground italic">
                              {mov.descripcion}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      Sin movimientos pendientes
                    </p>
                  )}

                  {/* Historial de movimientos pagados - Expandible */}
                  {movimientosPagados.length > 0 && (
                    <div className="pt-3 border-t border-border">
                      <button
                        onClick={() => setShowHistorialCompleto(!showHistorialCompleto)}
                        className="w-full flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors"
                      >
                        <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <History className="w-4 h-4" />
                          Historial de movimientos ({movimientosPagados.length})
                        </span>
                        {showHistorialCompleto ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>

                      {showHistorialCompleto && (
                        <div className="mt-2 space-y-2 max-h-[400px] overflow-y-auto">
                          {movimientosPagados.map((mov) => (
                            <div
                              key={mov.id}
                              className="p-3 bg-muted/20 rounded-lg border border-border/50"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      mov.tipo === 'adelanto' ? 'bg-amber-100 text-amber-700' :
                                      mov.tipo === 'bono' ? 'bg-emerald-100 text-emerald-700' :
                                      mov.tipo === 'descuento' ? 'bg-red-100 text-red-700' :
                                      'bg-blue-100 text-blue-700'
                                    }`}>
                                      {TIPOS_MOVIMIENTO_NOMINA.find(t => t.value === mov.tipo)?.label}
                                    </span>
                                    <p className="text-sm text-text-primary font-medium">{mov.concepto}</p>
                                    <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                                      Pagado
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {MESES.find(m => m.value === mov.periodo_mes)?.label} {mov.periodo_anio}
                                  </p>
                                </div>
                                <span className={`font-bold ${mov.es_debito ? 'text-red-500' : 'text-emerald-500'}`}>
                                  {mov.es_debito ? '-' : '+'}{formatCurrency(mov.monto)}
                                </span>
                              </div>

                              {/* Info detallada */}
                              <div className="mt-2 pt-2 border-t border-border/30 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                <div>
                                  <span className="font-medium">Registrado:</span>
                                  <p>{formatDateTime(mov.created_at)}</p>
                                  {mov.registrado_por_nombre && (
                                    <p className="flex items-center gap-1">
                                      <UserCheck className="w-3 h-3" />
                                      {mov.registrado_por_nombre}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <span className="font-medium">Pagado:</span>
                                  <p>{formatDateLocal(mov.fecha_pago)}</p>
                                  {mov.medio_pago && (
                                    <p className="capitalize">{mov.medio_pago}</p>
                                  )}
                                  {mov.comprobante && (
                                    <p>Comp: {mov.comprobante}</p>
                                  )}
                                </div>
                              </div>

                              {mov.descripcion && (
                                <p className="mt-2 text-xs text-muted-foreground italic border-t border-border/30 pt-2">
                                  {mov.descripcion}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {!showHistorialCompleto && movimientosPagados.length > 0 && (
                        <p className="text-xs text-muted-foreground text-center mt-2">
                          Click para ver historial completo
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Últimas Asistencias */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              Últimas Asistencias
            </h3>
            {asistenciasData?.items && asistenciasData.items.length > 0 ? (
              <div className="space-y-3">
                {asistenciasData.items.slice(0, 5).map((asist) => (
                  <div
                    key={asist.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {asist.tipo === 'entrada' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-amber-500" />
                      )}
                      <span className="text-sm text-text-primary capitalize">{asist.tipo}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-text-primary">{formatTime(asist.hora)}</p>
                      <p className="text-xs text-muted-foreground">{formatDateLocal(asist.fecha)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin registros de asistencia</p>
            )}
          </div>

          
          {/* Notas */}
          {empleado.notas && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Notas</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{empleado.notas}</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-destructive/10 rounded-full">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary">
                Confirmar Eliminación
              </h3>
            </div>
            <p className="text-muted-foreground mb-6">
              ¿Estás seguro de que deseas eliminar al empleado{' '}
              <strong className="text-text-primary">{empleado.nombre_completo}</strong>? Esta
              acción lo marcará como desvinculado.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-input rounded-lg text-text-primary hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Eliminar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Movimiento */}
      {showMovimientoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Nuevo Movimiento de Nómina
            </h3>
            <form onSubmit={handleCreateMovimiento} className="space-y-4">
              {/* Tipo de movimiento */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Tipo de Movimiento *
                </label>
                <select
                  value={movimientoForm.tipo}
                  onChange={(e) => {
                    const tipo = e.target.value as TipoMovimientoNomina;
                    const esDebito = ['descuento', 'adelanto', 'prestamo'].includes(tipo);
                    setMovimientoForm({ ...movimientoForm, tipo, es_debito: esDebito });
                  }}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {TIPOS_MOVIMIENTO_NOMINA.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Período */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Mes
                  </label>
                  <select
                    value={movimientoForm.periodo_mes}
                    onChange={(e) =>
                      setMovimientoForm({ ...movimientoForm, periodo_mes: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {MESES.map((mes) => (
                      <option key={mes.value} value={mes.value}>
                        {mes.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Año
                  </label>
                  <select
                    value={movimientoForm.periodo_anio}
                    onChange={(e) =>
                      setMovimientoForm({ ...movimientoForm, periodo_anio: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map((anio) => (
                      <option key={anio} value={anio}>
                        {anio}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Concepto */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Concepto *
                </label>
                <input
                  type="text"
                  value={movimientoForm.concepto}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, concepto: e.target.value })}
                  placeholder="Ej: Adelanto Marzo 2024"
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Monto */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Monto *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={movimientoForm.monto}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, monto: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {movimientoForm.tipo === 'adelanto' && empleado && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Máximo permitido: {formatCurrency((empleado.salario_base * (empleado.adelanto_maximo_porcentaje || 50)) / 100)}
                  </p>
                )}
              </div>

              {/* Es débito */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="es_debito"
                  checked={movimientoForm.es_debito}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, es_debito: e.target.checked })}
                  className="rounded border-input"
                />
                <label htmlFor="es_debito" className="text-sm text-text-primary">
                  Es descuento (resta del salario)
                </label>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={movimientoForm.descripcion}
                  onChange={(e) => setMovimientoForm({ ...movimientoForm, descripcion: e.target.value })}
                  rows={2}
                  placeholder="Notas adicionales..."
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowMovimientoModal(false);
                    resetMovimientoForm();
                  }}
                  className="px-4 py-2 border border-input rounded-lg text-text-primary hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMovimientoMutation.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {createMovimientoMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Crear Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar Pago */}
      {showPagoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              Registrar Pago
            </h3>
            <form onSubmit={handlePagarMovimiento} className="space-y-4">
              {/* Fecha de pago */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Fecha de Pago *
                </label>
                <input
                  type="date"
                  value={pagoForm.fecha_pago}
                  onChange={(e) => setPagoForm({ ...pagoForm, fecha_pago: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Medio de pago */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Medio de Pago *
                </label>
                <select
                  value={pagoForm.medio_pago}
                  onChange={(e) => setPagoForm({ ...pagoForm, medio_pago: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              {/* Comprobante */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  N° Comprobante (opcional)
                </label>
                <input
                  type="text"
                  value={pagoForm.comprobante}
                  onChange={(e) => setPagoForm({ ...pagoForm, comprobante: e.target.value })}
                  placeholder="N° de recibo"
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowPagoModal(false);
                    setSelectedMovimiento(null);
                  }}
                  className="px-4 py-2 border border-input rounded-lg text-text-primary hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pagarMovimientoMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {pagarMovimientoMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
