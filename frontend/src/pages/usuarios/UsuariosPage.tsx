/**
 * Página de gestión de usuarios
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Users,
  MoreHorizontal,
  Pencil,
  Trash2,
  Key,
  Eye,
  EyeOff,
  UserPlus,
  Shield,
  Copy,
  Check,
} from 'lucide-react';

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

import usuarioService, { Usuario, ROLES, MODULOS_LABELS } from '@/services/usuarioService';
import { formatDate } from '@/utils/formatters';

export default function UsuariosPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [rolFilter, setRolFilter] = useState<string>('all');
  const [soloActivos, setSoloActivos] = useState(true);
  const [soloClientes, setSoloClientes] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Formulario
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    telefono: '',
    pin: '',
    rol: 'operador',
    guardar_password_visible: false,
    permisos_modulos: undefined as Record<string, boolean> | undefined,
  });

  // Para controlar si se personalizan los permisos
  const [personalizarPermisos, setPersonalizarPermisos] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [guardarPasswordVisible, setGuardarPasswordVisible] = useState(false);

  // Cargar usuarios
  const { data, isLoading } = useQuery({
    queryKey: ['usuarios', { page, search, rolFilter, soloActivos, soloClientes }],
    queryFn: () =>
      usuarioService.getUsuarios({
        skip: (page - 1) * limit,
        limit,
        search: search || undefined,
        rol: rolFilter !== 'all' ? rolFilter : undefined,
        activo: soloActivos ? true : undefined,
        solo_clientes: soloClientes,
      }),
  });

  // Cargar módulos y permisos
  const { data: modulosData } = useQuery({
    queryKey: ['modulos-permisos'],
    queryFn: () => usuarioService.getModulosPermisos(),
  });

  // Mutaciones
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => usuarioService.createUsuario(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast({ title: 'Usuario creado', description: 'El usuario ha sido creado correctamente.' });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (error: any) => {
      let errorMsg = 'No se pudo crear el usuario.';
      const detail = error.response?.data?.detail;

      if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        // Error de validación de Pydantic
        errorMsg = detail.map((e: any) => e.msg || e.message || String(e)).join('. ');
      } else if (detail && typeof detail === 'object') {
        errorMsg = detail.msg || detail.message || JSON.stringify(detail);
      }

      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMsg,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      usuarioService.updateUsuario(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast({ title: 'Usuario actualizado', description: 'Los cambios han sido guardados.' });
      setShowEditModal(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      let errorMsg = 'No se pudo actualizar el usuario.';
      const detail = error.response?.data?.detail;

      if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        errorMsg = detail.map((e: any) => e.msg || e.message || String(e)).join('. ');
      } else if (detail && typeof detail === 'object') {
        errorMsg = detail.msg || detail.message || JSON.stringify(detail);
      }

      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMsg,
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password, guardar }: { id: string; password: string; guardar: boolean }) =>
      usuarioService.resetPassword(id, {
        password_nuevo: password,
        guardar_password_visible: guardar,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast({ title: 'Contraseña reseteada', description: 'La nueva contraseña ha sido establecida.' });
      setShowPasswordModal(false);
      setNewPassword('');
      setGuardarPasswordVisible(false);
    },
    onError: (error: any) => {
      let errorMsg = 'No se pudo resetear la contraseña.';
      const detail = error.response?.data?.detail;

      if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        errorMsg = detail.map((e: any) => e.msg || e.message || String(e)).join('. ');
      } else if (detail && typeof detail === 'object') {
        errorMsg = detail.msg || detail.message || JSON.stringify(detail);
      }

      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMsg,
      });
    },
  });

  const toggleActivoMutation = useMutation({
    mutationFn: (id: string) => usuarioService.toggleActivo(id),
    onSuccess: (usuario) => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast({
        title: usuario.activo ? 'Usuario activado' : 'Usuario desactivado',
        description: `El usuario ha sido ${usuario.activo ? 'activado' : 'desactivado'}.`,
      });
    },
    onError: (error: any) => {
      let errorMsg = 'No se pudo cambiar el estado.';
      const detail = error.response?.data?.detail;

      if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        errorMsg = detail.map((e: any) => e.msg || e.message || String(e)).join('. ');
      }

      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMsg,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usuarioService.deleteUsuario(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast({ title: 'Usuario eliminado', description: 'El usuario ha sido eliminado.' });
    },
    onError: (error: any) => {
      let errorMsg = 'No se pudo eliminar el usuario.';
      const detail = error.response?.data?.detail;

      if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        errorMsg = detail.map((e: any) => e.msg || e.message || String(e)).join('. ');
      }

      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMsg,
      });
    },
  });

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      nombre: '',
      apellido: '',
      telefono: '',
      pin: '',
      rol: 'operador',
      guardar_password_visible: false,
      permisos_modulos: undefined,
    });
    setPersonalizarPermisos(false);
  };

  // Obtener permisos por defecto del rol seleccionado
  const getPermisosDefaultPorRol = (rol: string): Record<string, boolean> => {
    if (modulosData?.permisos_por_rol && modulosData.permisos_por_rol[rol]) {
      return { ...modulosData.permisos_por_rol[rol] };
    }
    // Fallback
    return Object.fromEntries(
      (modulosData?.modulos_disponibles || Object.keys(MODULOS_LABELS)).map(m => [m, false])
    );
  };

  // Cuando cambia el rol, actualizar los permisos personalizados si están activos
  const handleRolChange = (nuevoRol: string) => {
    setFormData(prev => ({
      ...prev,
      rol: nuevoRol,
      permisos_modulos: personalizarPermisos ? getPermisosDefaultPorRol(nuevoRol) : undefined,
    }));
  };

  // Toggle para personalizar permisos
  const handleTogglePersonalizarPermisos = (activar: boolean) => {
    setPersonalizarPermisos(activar);
    if (activar) {
      setFormData(prev => ({
        ...prev,
        permisos_modulos: getPermisosDefaultPorRol(prev.rol),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        permisos_modulos: undefined,
      }));
    }
  };

  // Actualizar un permiso individual
  const handlePermisoChange = (modulo: string, valor: boolean) => {
    setFormData(prev => ({
      ...prev,
      permisos_modulos: {
        ...(prev.permisos_modulos || {}),
        [modulo]: valor,
      },
    }));
  };

  const handleEdit = (usuario: Usuario) => {
    setSelectedUser(usuario);
    const tienePermisosPersonalizados = !!(usuario.permisos_modulos && Object.keys(usuario.permisos_modulos).length > 0);
    setPersonalizarPermisos(tienePermisosPersonalizados);
    setFormData({
      email: usuario.email,
      password: '',
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      telefono: usuario.telefono || '',
      pin: usuario.pin || '',
      rol: usuario.rol,
      guardar_password_visible: false,
      permisos_modulos: tienePermisosPersonalizados ? usuario.permisos_modulos : undefined,
    });
    setShowEditModal(true);
  };

  const handleShowCredentials = async (usuario: Usuario) => {
    try {
      const userWithCreds = await usuarioService.getUsuarioConCredenciales(usuario.id);
      setSelectedUser(userWithCreds);
      setShowCredentialsModal(true);
    } catch {
      // Si no es superadmin, mostrar solo lo que tenemos
      setSelectedUser(usuario);
      setShowCredentialsModal(true);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getRolBadgeVariant = (rol: string) => {
    switch (rol) {
      case 'superadmin':
        return 'destructive';
      case 'administrador':
        return 'default';
      case 'cliente':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-500">Gestión de usuarios y permisos del sistema</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre o email..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            <Select
              value={rolFilter}
              onValueChange={(value) => {
                setRolFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos los roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                {ROLES.map((rol) => (
                  <SelectItem key={rol.value} value={rol.value}>
                    {rol.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={soloActivos}
                  onCheckedChange={(checked) => {
                    setSoloActivos(checked === true);
                    setPage(1);
                  }}
                />
                Solo activos
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={soloClientes}
                  onCheckedChange={(checked) => {
                    setSoloClientes(checked === true);
                    setPage(1);
                  }}
                />
                Solo clientes
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Usuario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Rol
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    PIN
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Último Acceso
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      Cargando...
                    </td>
                  </tr>
                ) : data?.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      No se encontraron usuarios
                    </td>
                  </tr>
                ) : (
                  data?.items.map((usuario) => (
                    <tr key={usuario.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {usuario.nombre.charAt(0)}
                              {usuario.apellido.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">
                              {usuario.nombre} {usuario.apellido}
                            </p>
                            {usuario.telefono && (
                              <p className="text-sm text-gray-500">{usuario.telefono}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{usuario.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={getRolBadgeVariant(usuario.rol)}>
                          {usuarioService.getRolLabel(usuario.rol)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {usuario.cliente_nombre ? (
                          <span className="text-primary">{usuario.cliente_nombre}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {usuario.pin ? (
                          <Badge variant="outline" className="font-mono">
                            {usuario.pin}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={usuario.activo ? 'success' : 'secondary'}>
                          {usuario.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {usuario.ultimo_acceso
                          ? formatDate(usuario.ultimo_acceso)
                          : 'Nunca'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(usuario)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(usuario);
                                setShowPasswordModal(true);
                              }}
                            >
                              <Key className="h-4 w-4 mr-2" />
                              Resetear Contraseña
                            </DropdownMenuItem>
                            {usuario.tiene_password_visible && (
                              <DropdownMenuItem onClick={() => handleShowCredentials(usuario)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Credenciales
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => toggleActivoMutation.mutate(usuario.id)}
                            >
                              {usuario.activo ? (
                                <>
                                  <EyeOff className="h-4 w-4 mr-2" />
                                  Desactivar
                                </>
                              ) : (
                                <>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Activar
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                if (confirm('¿Está seguro de eliminar este usuario?')) {
                                  deleteMutation.mutate(usuario.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {data && data.total > limit && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-gray-500">
                Mostrando {(page - 1) * limit + 1} a{' '}
                {Math.min(page * limit, data.total)} de {data.total} usuarios
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page * limit >= data.total}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Crear Usuario */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nuevo Usuario</DialogTitle>
            <DialogDescription>
              Crea un nuevo usuario del sistema
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellido">Apellido</Label>
                <Input
                  id="apellido"
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                Mínimo 8 caracteres, una mayúscula, una minúscula y un número
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin">PIN (4-6 dígitos)</Label>
                <Input
                  id="pin"
                  value={formData.pin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setFormData({ ...formData, pin: value });
                  }}
                  placeholder="Ej: 1234"
                  maxLength={6}
                />
                <p className="text-xs text-gray-500">
                  Para validar acciones en producción
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rol">Rol</Label>
              <Select
                value={formData.rol}
                onValueChange={handleRolChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter(r => r.value !== 'cliente').map((rol) => (
                    <SelectItem key={rol.value} value={rol.value}>
                      {rol.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sección de permisos personalizados */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Permisos de módulos
                </Label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={personalizarPermisos}
                    onCheckedChange={(checked) => handleTogglePersonalizarPermisos(checked === true)}
                  />
                  Personalizar permisos
                </label>
              </div>

              {personalizarPermisos && formData.permisos_modulos && (
                <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto bg-gray-50">
                  <p className="text-xs text-gray-500 mb-2">
                    Selecciona los módulos a los que tendrá acceso:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(modulosData?.modulos_disponibles || Object.keys(MODULOS_LABELS)).map((modulo) => (
                      <label key={modulo} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={formData.permisos_modulos?.[modulo] || false}
                          onCheckedChange={(checked) => handlePermisoChange(modulo, checked === true)}
                        />
                        {MODULOS_LABELS[modulo] || modulo}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {!personalizarPermisos && (
                <p className="text-xs text-gray-500">
                  Se usarán los permisos predeterminados del rol seleccionado.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creando...' : 'Crear Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Usuario */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Modifica los datos del usuario
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nombre">Nombre</Label>
                <Input
                  id="edit-nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-apellido">Apellido</Label>
                <Input
                  id="edit-apellido"
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-telefono">Teléfono</Label>
                <Input
                  id="edit-telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-pin">PIN (4-6 dígitos)</Label>
                <Input
                  id="edit-pin"
                  value={formData.pin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setFormData({ ...formData, pin: value });
                  }}
                  placeholder="Ej: 1234"
                  maxLength={6}
                />
                <p className="text-xs text-gray-500">
                  Para validar acciones en producción
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-rol">Rol</Label>
              <Select
                value={formData.rol}
                onValueChange={handleRolChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((rol) => (
                    <SelectItem key={rol.value} value={rol.value}>
                      {rol.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sección de permisos personalizados */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Permisos de módulos
                </Label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={personalizarPermisos}
                    onCheckedChange={(checked) => handleTogglePersonalizarPermisos(checked === true)}
                  />
                  Personalizar permisos
                </label>
              </div>

              {personalizarPermisos && formData.permisos_modulos && (
                <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto bg-gray-50">
                  <p className="text-xs text-gray-500 mb-2">
                    Selecciona los módulos a los que tendrá acceso:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(modulosData?.modulos_disponibles || Object.keys(MODULOS_LABELS)).map((modulo) => (
                      <label key={modulo} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={formData.permisos_modulos?.[modulo] || false}
                          onCheckedChange={(checked) => handlePermisoChange(modulo, checked === true)}
                        />
                        {MODULOS_LABELS[modulo] || modulo}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {!personalizarPermisos && (
                <p className="text-xs text-gray-500">
                  Se usarán los permisos predeterminados del rol seleccionado.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedUser) {
                  updateMutation.mutate({
                    id: selectedUser.id,
                    data: {
                      email: formData.email,
                      nombre: formData.nombre,
                      apellido: formData.apellido,
                      telefono: formData.telefono,
                      pin: formData.pin || null,
                      rol: formData.rol,
                      permisos_modulos: formData.permisos_modulos,
                    },
                  });
                }
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Resetear Contraseña */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Resetear Contraseña</DialogTitle>
            <DialogDescription>
              Establece una nueva contraseña para{' '}
              <strong>
                {selectedUser?.nombre} {selectedUser?.apellido}
              </strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva Contraseña</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Mínimo 8 caracteres
              </p>
            </div>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={guardarPasswordVisible}
                onCheckedChange={(checked) => setGuardarPasswordVisible(checked === true)}
              />
              <span className="text-sm">
                Guardar contraseña visible (para mostrar al usuario)
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedUser && newPassword) {
                  resetPasswordMutation.mutate({
                    id: selectedUser.id,
                    password: newPassword,
                    guardar: guardarPasswordVisible,
                  });
                }
              }}
              disabled={resetPasswordMutation.isPending || !newPassword}
            >
              {resetPasswordMutation.isPending ? 'Reseteando...' : 'Resetear Contraseña'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ver Credenciales */}
      <Dialog open={showCredentialsModal} onOpenChange={setShowCredentialsModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Credenciales de Acceso</DialogTitle>
            <DialogDescription>
              Credenciales de{' '}
              <strong>
                {selectedUser?.nombre} {selectedUser?.apellido}
              </strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="flex items-center gap-2">
                <Input value={selectedUser?.email || ''} readOnly className="font-mono" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(selectedUser?.email || '', 'email')}
                >
                  {copiedField === 'email' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contraseña</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={selectedUser?.password_visible || '(No disponible)'}
                  readOnly
                  className="font-mono"
                />
                {selectedUser?.password_visible && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(selectedUser.password_visible || '', 'password')}
                  >
                    {copiedField === 'password' ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              {!selectedUser?.password_visible && (
                <p className="text-xs text-gray-500">
                  La contraseña no fue guardada en texto plano
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowCredentialsModal(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
