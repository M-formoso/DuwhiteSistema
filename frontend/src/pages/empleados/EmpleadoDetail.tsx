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
} from 'lucide-react';
import { toast } from 'sonner';

import {
  getEmpleado,
  deleteEmpleado,
  getAsistencias,
  getMovimientosNomina,
} from '@/services/empleadoService';
import {
  TIPOS_EMPLEADO,
  ESTADOS_EMPLEADO,
  TIPOS_CONTRATO,
  getEstadoBadgeColor,
  getTipoBadgeColor,
} from '@/types/empleado';

export default function EmpleadoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
    queryFn: () => getMovimientosNomina({ empleado_id: id!, limit: 10 }),
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-AR');
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
                  {formatDate(empleado.fecha_nacimiento)}
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
                  {formatDate(empleado.fecha_ingreso)}
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
          {/* Salario */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Salario
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
            </div>
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
                      <p className="text-xs text-muted-foreground">{formatDate(asist.fecha)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin registros de asistencia</p>
            )}
          </div>

          {/* Últimos Movimientos Nómina */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              Movimientos Nómina
            </h3>
            {movimientosData?.items && movimientosData.items.length > 0 ? (
              <div className="space-y-3">
                {movimientosData.items.slice(0, 5).map((mov) => (
                  <div
                    key={mov.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="text-sm text-text-primary">{mov.concepto}</p>
                      <p className="text-xs text-muted-foreground">
                        {mov.periodo_mes}/{mov.periodo_anio}
                      </p>
                    </div>
                    <span
                      className={`font-medium ${
                        mov.es_debito ? 'text-red-500' : 'text-emerald-500'
                      }`}
                    >
                      {mov.es_debito ? '-' : '+'}
                      {formatCurrency(mov.monto)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin movimientos de nómina</p>
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
    </div>
  );
}
