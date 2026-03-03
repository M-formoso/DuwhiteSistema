/**
 * Página Mi Perfil
 */

import { useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Shield,
  Key,
  Camera,
  Save,
  Eye,
  EyeOff,
  Clock,
  CheckCircle2,
  LogOut,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/stores/authStore';

interface UsuarioPerfil {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;
  rol: string;
  rolLabel: string;
  avatar?: string;
  fechaCreacion: string;
  ultimoAcceso: string;
}

const USUARIO_EJEMPLO: UsuarioPerfil = {
  id: '1',
  nombre: 'Admin',
  apellido: 'Sistema',
  email: 'admin@duwhite.com.ar',
  telefono: '+54 351 123-4567',
  rol: 'administrador',
  rolLabel: 'Administrador',
  fechaCreacion: '2024-01-15',
  ultimoAcceso: '2025-03-03T10:30:00',
};

const ROLES_INFO: Record<string, { label: string; descripcion: string; color: string }> = {
  superadmin: {
    label: 'Super Administrador',
    descripcion: 'Acceso total al sistema, gestión de usuarios y configuración',
    color: 'bg-red-100 text-red-700',
  },
  administrador: {
    label: 'Administrador',
    descripcion: 'Acceso a todos los módulos operativos y reportes',
    color: 'bg-purple-100 text-purple-700',
  },
  jefe_produccion: {
    label: 'Jefe de Producción',
    descripcion: 'Gestión completa de producción, lotes y empleados',
    color: 'bg-blue-100 text-blue-700',
  },
  operador: {
    label: 'Operador',
    descripcion: 'Registro de producción y consumo de insumos',
    color: 'bg-green-100 text-green-700',
  },
  comercial: {
    label: 'Comercial',
    descripcion: 'Gestión de clientes, pedidos y facturación',
    color: 'bg-orange-100 text-orange-700',
  },
  contador: {
    label: 'Contador',
    descripcion: 'Acceso a finanzas, reportes contables y facturación',
    color: 'bg-cyan-100 text-cyan-700',
  },
  solo_lectura: {
    label: 'Solo Lectura',
    descripcion: 'Visualización de información sin capacidad de edición',
    color: 'bg-gray-100 text-gray-700',
  },
};

export default function PerfilPage() {
  const { toast } = useToast();
  const logout = useAuthStore((state) => state.logout);
  const [usuario, setUsuario] = useState<UsuarioPerfil>(USUARIO_EJEMPLO);
  const [saving, setSaving] = useState(false);

  // Estados del formulario de edición
  const [editando, setEditando] = useState(false);
  const [formData, setFormData] = useState({
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    telefono: usuario.telefono || '',
  });

  // Estados del diálogo de cambio de contraseña
  const [dialogPassword, setDialogPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    actual: '',
    nueva: '',
    confirmar: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    actual: false,
    nueva: false,
    confirmar: false,
  });

  const rolInfo = ROLES_INFO[usuario.rol] || ROLES_INFO.solo_lectura;

  const handleGuardarPerfil = async () => {
    setSaving(true);
    try {
      // En producción esto iría al backend
      await new Promise((r) => setTimeout(r, 1000));

      setUsuario({
        ...usuario,
        nombre: formData.nombre,
        apellido: formData.apellido,
        telefono: formData.telefono,
      });

      toast({
        title: 'Perfil actualizado',
        description: 'Tus datos se han guardado correctamente',
      });

      setEditando(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el perfil',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCambiarPassword = async () => {
    // Validaciones
    if (!passwordData.actual || !passwordData.nueva || !passwordData.confirmar) {
      toast({
        title: 'Error',
        description: 'Completa todos los campos',
        variant: 'destructive',
      });
      return;
    }

    if (passwordData.nueva.length < 8) {
      toast({
        title: 'Error',
        description: 'La contraseña debe tener al menos 8 caracteres',
        variant: 'destructive',
      });
      return;
    }

    if (passwordData.nueva !== passwordData.confirmar) {
      toast({
        title: 'Error',
        description: 'Las contraseñas no coinciden',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // En producción esto iría al backend
      await new Promise((r) => setTimeout(r, 1000));

      toast({
        title: 'Contraseña actualizada',
        description: 'Tu contraseña se ha cambiado correctamente',
      });

      setDialogPassword(false);
      setPasswordData({ actual: '', nueva: '', confirmar: '' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cambiar la contraseña',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const formatFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatFechaHora = (fecha: string) => {
    return new Date(fecha).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="text-gray-500">Administra tu información personal y seguridad</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Columna izquierda - Info principal */}
        <div className="md:col-span-2 space-y-6">
          {/* Tarjeta de perfil */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Información Personal
                </CardTitle>
                {!editando ? (
                  <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
                    Editar
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditando(false);
                        setFormData({
                          nombre: usuario.nombre,
                          apellido: usuario.apellido,
                          telefono: usuario.telefono || '',
                        });
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleGuardarPerfil} disabled={saving}>
                      {saving ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar y nombre */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={usuario.avatar} />
                    <AvatarFallback className="text-xl bg-primary text-white">
                      {usuario.nombre.charAt(0)}{usuario.apellido.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {editando && (
                    <Button
                      size="icon"
                      variant="outline"
                      className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">
                    {usuario.nombre} {usuario.apellido}
                  </h3>
                  <Badge className={rolInfo.color}>{rolInfo.label}</Badge>
                </div>
              </div>

              <Separator />

              {/* Campos editables */}
              {editando ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nombre</Label>
                      <Input
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Apellido</Label>
                      <Input
                        value={formData.apellido}
                        onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={usuario.email} disabled className="bg-gray-50" />
                    <p className="text-xs text-muted-foreground">
                      El email no puede modificarse. Contacta al administrador si necesitas cambiarlo.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      placeholder="+54 XXX XXX-XXXX"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{usuario.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Teléfono</p>
                      <p className="font-medium">{usuario.telefono || 'No especificado'}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seguridad */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Seguridad
              </CardTitle>
              <CardDescription>
                Gestiona tu contraseña y la seguridad de tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Contraseña</p>
                    <p className="text-sm text-muted-foreground">
                      ••••••••••••
                    </p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setDialogPassword(true)}>
                  Cambiar
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Estado de la cuenta</p>
                    <p className="text-sm text-muted-foreground">Activa y verificada</p>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-700">Activa</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Columna derecha - Info adicional */}
        <div className="space-y-6">
          {/* Rol y permisos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tu Rol</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <Badge className={rolInfo.color}>{rolInfo.label}</Badge>
                <p className="text-sm text-muted-foreground mt-2">{rolInfo.descripcion}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Los roles son asignados por el administrador del sistema.
              </p>
            </CardContent>
          </Card>

          {/* Actividad */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Actividad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Miembro desde</p>
                <p className="font-medium">{formatFecha(usuario.fechaCreacion)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Último acceso</p>
                <p className="font-medium">{formatFechaHora(usuario.ultimoAcceso)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Cerrar sesión */}
          <Card>
            <CardContent className="pt-6">
              <Button
                variant="outline"
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={logout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar Sesión
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Diálogo de cambio de contraseña */}
      <Dialog open={dialogPassword} onOpenChange={setDialogPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Contraseña</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Contraseña actual</Label>
              <div className="relative">
                <Input
                  type={showPasswords.actual ? 'text' : 'password'}
                  value={passwordData.actual}
                  onChange={(e) => setPasswordData({ ...passwordData, actual: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() =>
                    setShowPasswords({ ...showPasswords, actual: !showPasswords.actual })
                  }
                >
                  {showPasswords.actual ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nueva contraseña</Label>
              <div className="relative">
                <Input
                  type={showPasswords.nueva ? 'text' : 'password'}
                  value={passwordData.nueva}
                  onChange={(e) => setPasswordData({ ...passwordData, nueva: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() =>
                    setShowPasswords({ ...showPasswords, nueva: !showPasswords.nueva })
                  }
                >
                  {showPasswords.nueva ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Mínimo 8 caracteres</p>
            </div>

            <div className="space-y-2">
              <Label>Confirmar nueva contraseña</Label>
              <div className="relative">
                <Input
                  type={showPasswords.confirmar ? 'text' : 'password'}
                  value={passwordData.confirmar}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmar: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() =>
                    setShowPasswords({ ...showPasswords, confirmar: !showPasswords.confirmar })
                  }
                >
                  {showPasswords.confirmar ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogPassword(false);
                setPasswordData({ actual: '', nueva: '', confirmar: '' });
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleCambiarPassword} disabled={saving}>
              {saving ? 'Guardando...' : 'Cambiar Contraseña'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
