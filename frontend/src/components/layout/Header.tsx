/**
 * Header principal de la aplicación
 */

import { Bell, LogOut, User, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ui/use-toast';

interface HeaderProps {
  sidebarCollapsed: boolean;
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/stock': 'Stock de Insumos',
  '/proveedores': 'Proveedores',
  '/produccion': 'Producción',
  '/clientes': 'Clientes',
  '/pedidos': 'Pedidos',
  '/finanzas': 'Finanzas',
  '/costos': 'Costos',
  '/empleados': 'Empleados',
  '/reportes': 'Reportes',
  '/actividades': 'Actividades',
  '/configuracion': 'Configuración',
  '/perfil': 'Mi Perfil',
};

export function Header({ sidebarCollapsed }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, logout } = useAuthStore();

  const getPageTitle = () => {
    const path = location.pathname;
    for (const [route, title] of Object.entries(PAGE_TITLES)) {
      if (path.startsWith(route)) {
        return title;
      }
    }
    return 'Sistema de Gestión';
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: 'Sesión cerrada',
        description: 'Has cerrado sesión correctamente.',
      });
      navigate('/login');
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cerrar la sesión.',
      });
    }
  };

  const getRolLabel = (rol: string): string => {
    const roles: Record<string, string> = {
      superadmin: 'Super Administrador',
      administrador: 'Administrador',
      jefe_produccion: 'Jefe de Producción',
      operador: 'Operador',
      comercial: 'Comercial',
      contador: 'Contador',
      solo_lectura: 'Solo Lectura',
    };
    return roles[rol] || rol;
  };

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 bg-white border-b border-border transition-all duration-300 ${
        sidebarCollapsed ? 'left-16' : 'left-64'
      }`}
    >
      <div className="flex h-full items-center justify-between px-6">
        {/* Título de la página */}
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            {getPageTitle()}
          </h1>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2">
          {/* Notificaciones */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {/* Badge de notificaciones */}
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-white flex items-center justify-center">
              3
            </span>
          </Button>

          {/* Usuario */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user?.nombre?.charAt(0)}
                    {user?.apellido?.charAt(0)}
                  </span>
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium">
                    {user?.nombre} {user?.apellido}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.rol && getRolLabel(user.rol)}
                  </p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/perfil')}>
                <User className="mr-2 h-4 w-4" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/configuracion')}>
                <Settings className="mr-2 h-4 w-4" />
                Configuración
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
