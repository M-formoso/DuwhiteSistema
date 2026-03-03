/**
 * Detalle de Cliente
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit,
  RefreshCw,
  User,
  Phone,
  Mail,
  MapPin,
  Building,
  DollarSign,
  Calendar,
  CreditCard,
  FileText,
  Plus,
  ChevronRight,
  Key,
  UserPlus,
  Copy,
  Check,
  Eye,
  EyeOff,
  Shield,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

import { clienteService } from '@/services/clienteService';
import { usuarioService, type Usuario } from '@/services/usuarioService';
import { formatNumber } from '@/utils/formatters';
import { TIPOS_CLIENTE, CONDICIONES_IVA, MEDIOS_PAGO } from '@/types/cliente';
import type { MedioPago } from '@/types/cliente';

export default function ClienteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showPagoModal, setShowPagoModal] = useState(false);
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoMedio, setPagoMedio] = useState<MedioPago>('efectivo');
  const [pagoReferencia, setPagoReferencia] = useState('');

  // Estados para gestión de usuario
  const [showCrearUsuarioModal, setShowCrearUsuarioModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [nuevoUsuarioEmail, setNuevoUsuarioEmail] = useState('');
  const [nuevoUsuarioPassword, setNuevoUsuarioPassword] = useState('');
  const [nuevoUsuarioNombre, setNuevoUsuarioNombre] = useState('');
  const [nuevoUsuarioApellido, setNuevoUsuarioApellido] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Query del cliente
  const { data: cliente, isLoading } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => clienteService.getCliente(id!),
    enabled: Boolean(id),
  });

  // Query del estado de cuenta
  const { data: estadoCuenta } = useQuery({
    queryKey: ['cliente-estado-cuenta', id],
    queryFn: () => clienteService.getEstadoCuenta(id!),
    enabled: Boolean(id),
  });

  // Query de movimientos
  const { data: movimientos } = useQuery({
    queryKey: ['cliente-movimientos', id],
    queryFn: () => clienteService.getMovimientosCuenta(id!, { limit: 10 }),
    enabled: Boolean(id),
  });

  // Query de pedidos
  const { data: pedidos } = useQuery({
    queryKey: ['cliente-pedidos', id],
    queryFn: () => clienteService.getPedidos({ cliente_id: id, limit: 5 }),
    enabled: Boolean(id),
  });

  // Query de usuarios del cliente
  const { data: usuariosCliente, isLoading: loadingUsuarios } = useQuery({
    queryKey: ['cliente-usuarios', id],
    queryFn: () => usuarioService.getUsuariosPorCliente(id!),
    enabled: Boolean(id),
  });

  // El usuario principal del cliente (si existe)
  const usuarioCliente = usuariosCliente?.[0] as Usuario | undefined;

  // Query para obtener credenciales del usuario
  const { data: usuarioConCredenciales, refetch: refetchCredenciales } = useQuery({
    queryKey: ['usuario-credenciales', usuarioCliente?.id],
    queryFn: () => usuarioService.getUsuarioConCredenciales(usuarioCliente!.id),
    enabled: Boolean(usuarioCliente?.id) && showPassword,
  });

  // Mutation para registrar pago
  const pagoMutation = useMutation({
    mutationFn: () =>
      clienteService.registrarPago(id!, {
        monto: parseFloat(pagoMonto),
        fecha: new Date().toISOString().split('T')[0],
        medio_pago: pagoMedio,
        referencia_pago: pagoReferencia || undefined,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['cliente', id] });
      queryClient.invalidateQueries({ queryKey: ['cliente-estado-cuenta', id] });
      queryClient.invalidateQueries({ queryKey: ['cliente-movimientos', id] });
      toast({
        title: 'Pago registrado',
        description: `Recibo ${result.recibo_numero} generado. Nuevo saldo: $${formatNumber(result.saldo_posterior, 2)}`,
      });
      setShowPagoModal(false);
      setPagoMonto('');
      setPagoReferencia('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo registrar el pago.',
        variant: 'destructive',
      });
    },
  });

  // Mutation para crear usuario
  const crearUsuarioMutation = useMutation({
    mutationFn: () =>
      usuarioService.createUsuarioParaCliente({
        cliente_id: id!,
        email: nuevoUsuarioEmail,
        password: nuevoUsuarioPassword,
        nombre: nuevoUsuarioNombre || cliente?.razon_social?.split(' ')[0],
        apellido: nuevoUsuarioApellido || '',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-usuarios', id] });
      toast({
        title: 'Usuario creado',
        description: 'El usuario para el cliente ha sido creado exitosamente.',
      });
      setShowCrearUsuarioModal(false);
      setNuevoUsuarioEmail('');
      setNuevoUsuarioPassword('');
      setNuevoUsuarioNombre('');
      setNuevoUsuarioApellido('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear el usuario.',
        variant: 'destructive',
      });
    },
  });

  // Mutation para resetear contraseña
  const resetPasswordMutation = useMutation({
    mutationFn: () =>
      usuarioService.resetPassword(usuarioCliente!.id, {
        password_nuevo: nuevaPassword,
        guardar_password_visible: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-usuarios', id] });
      queryClient.invalidateQueries({ queryKey: ['usuario-credenciales', usuarioCliente?.id] });
      toast({
        title: 'Contraseña actualizada',
        description: 'La contraseña ha sido cambiada exitosamente.',
      });
      setShowResetPasswordModal(false);
      setNuevaPassword('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo cambiar la contraseña.',
        variant: 'destructive',
      });
    },
  });

  // Función para copiar al portapapeles
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Generar contraseña aleatoria
  const generarPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const getTipoLabel = (tipo: string) => {
    return TIPOS_CLIENTE.find((t) => t.value === tipo)?.label || tipo;
  };

  const getCondicionIVALabel = (cond: string) => {
    return CONDICIONES_IVA.find((c) => c.value === cond)?.label || cond;
  };

  if (isLoading) {
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
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {cliente.nombre_fantasia || cliente.razon_social}
              </h1>
              <Badge variant="outline">{getTipoLabel(cliente.tipo)}</Badge>
              <Badge
                className={
                  cliente.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }
              >
                {cliente.activo ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <p className="text-gray-500 font-mono">{cliente.codigo}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/clientes/${id}/editar`)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button onClick={() => navigate(`/pedidos/nuevo?cliente=${id}`)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Pedido
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info General */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Información General
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Razón Social</p>
                <p className="font-medium">{cliente.razon_social}</p>
              </div>
              {cliente.nombre_fantasia && (
                <div>
                  <p className="text-sm text-gray-500">Nombre Fantasía</p>
                  <p className="font-medium">{cliente.nombre_fantasia}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">CUIT</p>
                <p className="font-medium">{cliente.cuit || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Condición IVA</p>
                <p className="font-medium">{getCondicionIVALabel(cliente.condicion_iva)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Contacto */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Contacto
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {cliente.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <a href={`mailto:${cliente.email}`} className="text-primary hover:underline">
                    {cliente.email}
                  </a>
                </div>
              )}
              {cliente.telefono && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{cliente.telefono}</span>
                </div>
              )}
              {cliente.celular && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{cliente.celular}</span>
                </div>
              )}
              {cliente.contacto_nombre && (
                <div>
                  <p className="text-sm text-gray-500">Contacto</p>
                  <p className="font-medium">
                    {cliente.contacto_nombre}
                    {cliente.contacto_cargo && ` - ${cliente.contacto_cargo}`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dirección */}
          {(cliente.direccion || cliente.ciudad) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Dirección
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  {cliente.direccion}
                  {cliente.direccion && cliente.ciudad && ', '}
                  {cliente.ciudad}
                  {cliente.provincia && `, ${cliente.provincia}`}
                  {cliente.codigo_postal && ` (${cliente.codigo_postal})`}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Últimos Pedidos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Últimos Pedidos
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/pedidos?cliente=${id}`)}>
                Ver todos
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {pedidos?.items && pedidos.items.length > 0 ? (
                <div className="space-y-2">
                  {pedidos.items.map((pedido) => (
                    <div
                      key={pedido.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                      onClick={() => navigate(`/pedidos/${pedido.id}`)}
                    >
                      <div>
                        <p className="font-mono font-medium">{pedido.numero}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(pedido.fecha_pedido).toLocaleDateString('es-AR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${formatNumber(pedido.total, 2)}</p>
                        <Badge variant="outline">{pedido.estado}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">Sin pedidos registrados</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Estado de Cuenta */}
          <Card className={cliente.tiene_deuda ? 'border-orange-300' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Estado de Cuenta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">Saldo Actual</p>
                <p
                  className={`text-3xl font-bold ${
                    cliente.tiene_deuda ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  ${formatNumber(cliente.saldo_cuenta_corriente, 2)}
                </p>
              </div>

              {estadoCuenta && (
                <div className="space-y-2 text-sm">
                  {estadoCuenta.limite_credito && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Límite de crédito:</span>
                      <span>${formatNumber(estadoCuenta.limite_credito, 2)}</span>
                    </div>
                  )}
                  {estadoCuenta.credito_disponible !== null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Crédito disponible:</span>
                      <span
                        className={estadoCuenta.credito_disponible < 0 ? 'text-red-600' : ''}
                      >
                        ${formatNumber(estadoCuenta.credito_disponible, 2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Facturado este mes:</span>
                    <span>${formatNumber(estadoCuenta.total_facturado_mes, 2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pagado este mes:</span>
                    <span>${formatNumber(estadoCuenta.total_pagado_mes, 2)}</span>
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => setShowPagoModal(true)}
                disabled={!cliente.tiene_deuda}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Registrar Pago
              </Button>
            </CardContent>
          </Card>

          {/* Acceso al Sistema */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Acceso al Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingUsuarios ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : usuarioCliente ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge className="bg-green-100 text-green-700">
                      Usuario activo
                    </Badge>
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Email de acceso</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-100 px-2 py-1 rounded text-sm">
                        {usuarioCliente.email}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyToClipboard(usuarioCliente.email, 'email')}
                      >
                        {copiedField === 'email' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Contraseña */}
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Contraseña</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                        {showPassword && usuarioConCredenciales?.password_visible
                          ? usuarioConCredenciales.password_visible
                          : '••••••••'}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          if (!showPassword) {
                            setShowPassword(true);
                            refetchCredenciales();
                          } else {
                            setShowPassword(false);
                          }
                        }}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      {showPassword && usuarioConCredenciales?.password_visible && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            copyToClipboard(usuarioConCredenciales.password_visible!, 'password')
                          }
                        >
                          {copiedField === 'password' ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                    {!usuarioConCredenciales?.password_visible && showPassword && (
                      <p className="text-xs text-orange-600">
                        La contraseña no está guardada. Reseteala para poder verla.
                      </p>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowResetPasswordModal(true)}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Cambiar Contraseña
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <p className="text-sm text-gray-500">
                    Este cliente no tiene usuario para acceder al sistema.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => {
                      // Pre-llenar con datos del cliente
                      setNuevoUsuarioEmail(cliente.email || '');
                      setNuevoUsuarioNombre(cliente.contacto_nombre?.split(' ')[0] || '');
                      setNuevoUsuarioApellido(
                        cliente.contacto_nombre?.split(' ').slice(1).join(' ') || ''
                      );
                      setNuevoUsuarioPassword(generarPassword());
                      setShowCrearUsuarioModal(true);
                    }}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Crear Usuario
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Condiciones Comerciales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Condiciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {cliente.descuento_general && cliente.descuento_general > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Descuento general:</span>
                  <span className="font-medium">{cliente.descuento_general}%</span>
                </div>
              )}
              {cliente.dias_credito && cliente.dias_credito > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Días de crédito:</span>
                  <span className="font-medium">{cliente.dias_credito} días</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Requiere factura:</span>
                <span className="font-medium">{cliente.requiere_factura ? 'Sí' : 'No'}</span>
              </div>
              {cliente.dia_retiro_preferido && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Retiro preferido:</span>
                  <span className="font-medium capitalize">
                    {cliente.dia_retiro_preferido}
                    {cliente.horario_retiro_preferido && ` ${cliente.horario_retiro_preferido}`}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Información Adicional */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Información
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {cliente.fecha_alta && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Fecha de alta:</span>
                  <span>{new Date(cliente.fecha_alta).toLocaleDateString('es-AR')}</span>
                </div>
              )}
              {cliente.fecha_ultima_compra && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Última compra:</span>
                  <span>{new Date(cliente.fecha_ultima_compra).toLocaleDateString('es-AR')}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Movimientos Recientes */}
          {movimientos?.items && movimientos.items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Últimos Movimientos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {movimientos.items.slice(0, 5).map((mov) => (
                    <div key={mov.id} className="flex justify-between text-sm">
                      <div>
                        <p className="font-medium">{mov.concepto}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(mov.fecha_movimiento).toLocaleDateString('es-AR')}
                        </p>
                      </div>
                      <span
                        className={
                          mov.tipo === 'pago' ? 'text-green-600' : 'text-red-600'
                        }
                      >
                        {mov.tipo === 'pago' ? '-' : '+'}${formatNumber(mov.monto, 2)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal de Pago */}
      {showPagoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle>Registrar Pago</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Monto *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={pagoMonto}
                  onChange={(e) => setPagoMonto(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Medio de Pago *</Label>
                <Select value={pagoMedio} onValueChange={(v) => setPagoMedio(v as MedioPago)}>
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

              <div className="space-y-2">
                <Label>Referencia (opcional)</Label>
                <Input
                  value={pagoReferencia}
                  onChange={(e) => setPagoReferencia(e.target.value)}
                  placeholder="Nro. transferencia, cheque, etc."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={() => setShowPagoModal(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => pagoMutation.mutate()}
                  disabled={!pagoMonto || parseFloat(pagoMonto) <= 0 || pagoMutation.isPending}
                >
                  {pagoMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Registrar Pago
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Crear Usuario */}
      {showCrearUsuarioModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Crear Usuario para Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={nuevoUsuarioEmail}
                  onChange={(e) => setNuevoUsuarioEmail(e.target.value)}
                  placeholder="cliente@ejemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Contraseña *</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={nuevoUsuarioPassword}
                    onChange={(e) => setNuevoUsuarioPassword(e.target.value)}
                    placeholder="Contraseña"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setNuevoUsuarioPassword(generarPassword())}
                  >
                    Generar
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={nuevoUsuarioNombre}
                    onChange={(e) => setNuevoUsuarioNombre(e.target.value)}
                    placeholder="Nombre"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Apellido</Label>
                  <Input
                    value={nuevoUsuarioApellido}
                    onChange={(e) => setNuevoUsuarioApellido(e.target.value)}
                    placeholder="Apellido"
                  />
                </div>
              </div>

              <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">
                El usuario tendrá rol "Cliente" y solo podrá ver sus propios pedidos y datos.
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowCrearUsuarioModal(false);
                    setNuevoUsuarioEmail('');
                    setNuevoUsuarioPassword('');
                    setNuevoUsuarioNombre('');
                    setNuevoUsuarioApellido('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => crearUsuarioMutation.mutate()}
                  disabled={
                    !nuevoUsuarioEmail ||
                    !nuevoUsuarioPassword ||
                    crearUsuarioMutation.isPending
                  }
                >
                  {crearUsuarioMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Crear Usuario
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Resetear Contraseña */}
      {showResetPasswordModal && usuarioCliente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Cambiar Contraseña
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Usuario: <span className="font-medium">{usuarioCliente.email}</span>
              </p>

              <div className="space-y-2">
                <Label>Nueva Contraseña *</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={nuevaPassword}
                    onChange={(e) => setNuevaPassword(e.target.value)}
                    placeholder="Nueva contraseña"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setNuevaPassword(generarPassword())}
                  >
                    Generar
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowResetPasswordModal(false);
                    setNuevaPassword('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => resetPasswordMutation.mutate()}
                  disabled={!nuevaPassword || resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Cambiar Contraseña
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
