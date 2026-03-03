/**
 * Sidebar de navegación principal
 */

import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Truck,
  Factory,
  Users,
  FileText,
  Wallet,
  DollarSign,
  BarChart3,
  CheckSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Contact,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Stock',
    href: '/stock',
    icon: Package,
    roles: ['superadmin', 'administrador', 'jefe_produccion', 'operador', 'comercial', 'contador', 'solo_lectura'],
  },
  {
    title: 'Proveedores',
    href: '/proveedores',
    icon: Truck,
    roles: ['superadmin', 'administrador', 'jefe_produccion', 'comercial', 'contador', 'solo_lectura'],
  },
  {
    title: 'Producción',
    href: '/produccion',
    icon: Factory,
    roles: ['superadmin', 'administrador', 'jefe_produccion', 'operador', 'solo_lectura'],
  },
  {
    title: 'Clientes',
    href: '/clientes',
    icon: Contact,
    roles: ['superadmin', 'administrador', 'jefe_produccion', 'comercial', 'contador', 'solo_lectura'],
  },
  {
    title: 'Pedidos',
    href: '/pedidos',
    icon: FileText,
    roles: ['superadmin', 'administrador', 'jefe_produccion', 'comercial', 'solo_lectura'],
  },
  {
    title: 'Finanzas',
    href: '/finanzas',
    icon: Wallet,
    roles: ['superadmin', 'administrador', 'contador', 'solo_lectura'],
  },
  {
    title: 'Costos',
    href: '/costos',
    icon: DollarSign,
    roles: ['superadmin', 'administrador', 'jefe_produccion', 'contador', 'solo_lectura'],
  },
  {
    title: 'Empleados',
    href: '/empleados',
    icon: Users,
    roles: ['superadmin', 'administrador', 'jefe_produccion', 'contador', 'solo_lectura'],
  },
  {
    title: 'Reportes',
    href: '/reportes',
    icon: BarChart3,
    roles: ['superadmin', 'administrador', 'jefe_produccion', 'comercial', 'contador', 'solo_lectura'],
  },
  {
    title: 'Actividades',
    href: '/actividades',
    icon: CheckSquare,
  },
  {
    title: 'Usuarios',
    href: '/usuarios',
    icon: UserCog,
    roles: ['superadmin', 'administrador'],
  },
  {
    title: 'Configuración',
    href: '/configuracion',
    icon: Settings,
    roles: ['superadmin', 'administrador'],
  },
];

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  // Filtrar items según rol del usuario
  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return user && item.roles.includes(user.rol);
  });

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar text-white transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header con Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
        {!isCollapsed ? (
          <Link to="/dashboard" className="flex items-center">
            <img
              src="/logo-white.svg"
              alt="DUWHITE"
              className="h-10 w-auto"
            />
          </Link>
        ) : (
          <Link
            to="/dashboard"
            className="w-8 h-8 bg-primary rounded-md flex items-center justify-center mx-auto"
            title="DUWHITE"
          >
            <span className="text-sm font-bold text-white">DW</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="text-white hover:bg-white/10"
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-2 mt-2">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white',
                isCollapsed && 'justify-center px-2'
              )}
              title={isCollapsed ? item.title : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
