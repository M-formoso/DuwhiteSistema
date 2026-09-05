import { useState } from 'react';
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
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  UserCog,
  Contact,
  ShoppingCart,
  FolderOpen,
  User,
  Building2,
  Tag,
  Banknote,
  Clock,
  Receipt,
  Archive,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  onMobileClose?: () => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const navSectionsInternal: NavSection[] = [
  {
    title: 'Principal',
    defaultOpen: true,
    items: [
      {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        // Operarios NO ven el dashboard operativo (muestra ventas y datos comerciales).
        roles: ['superadmin', 'administrador', 'jefe_produccion', 'comercial', 'contador', 'solo_lectura'],
      },
    ],
  },
  {
    title: 'Operaciones',
    defaultOpen: true,
    items: [
      {
        title: 'Stock',
        href: '/stock',
        icon: Package,
        roles: ['superadmin', 'administrador', 'jefe_produccion', 'operador', 'comercial', 'contador', 'solo_lectura'],
      },
      {
        title: 'Categorías',
        href: '/stock/categorias',
        icon: FolderOpen,
        roles: ['superadmin', 'administrador', 'jefe_produccion'],
      },
      {
        title: 'Proveedores',
        href: '/proveedores',
        icon: Truck,
        roles: ['superadmin', 'administrador', 'jefe_produccion', 'comercial', 'contador', 'solo_lectura'],
      },
      {
        title: 'Órdenes de Compra',
        href: '/proveedores/ordenes',
        icon: ShoppingCart,
        roles: ['superadmin', 'administrador', 'jefe_produccion', 'contador', 'solo_lectura'],
      },
      {
        title: 'Producción',
        href: '/produccion',
        icon: Factory,
        roles: ['superadmin', 'administrador', 'jefe_produccion', 'operador', 'solo_lectura'],
      },
      {
        title: 'Archivados',
        href: '/produccion/archivados',
        icon: Archive,
        roles: ['superadmin', 'administrador', 'jefe_produccion'],
      },
      {
        title: 'Recolección',
        href: '/recoleccion',
        icon: Truck,
        roles: ['superadmin', 'administrador', 'jefe_produccion', 'operador'],
      },
    ],
  },
  {
    title: 'Comercial',
    defaultOpen: true,
    items: [
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
        title: 'Servicios y Precios',
        href: '/servicios',
        icon: Tag,
        roles: ['superadmin', 'administrador', 'jefe_produccion', 'comercial', 'contador', 'solo_lectura'],
      },
      {
        title: 'Facturación',
        href: '/facturacion',
        icon: Receipt,
        roles: ['superadmin', 'administrador', 'contador', 'solo_lectura'],
      },
    ],
  },
  {
    title: 'Administración',
    defaultOpen: true,
    items: [
      {
        title: 'Tesorería',
        href: '/tesoreria',
        icon: Banknote,
        roles: ['superadmin', 'administrador', 'contador'],
      },
      {
        title: 'Cuentas Corrientes',
        href: '/tesoreria/cuentas-corrientes',
        icon: Users,
        roles: ['superadmin', 'administrador', 'contador', 'comercial'],
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
        title: 'Jornales',
        href: '/empleados/jornales',
        icon: Clock,
        roles: ['superadmin', 'administrador', 'contador'],
      },
    ],
  },
  {
    title: 'Análisis',
    defaultOpen: false,
    items: [
      {
        title: 'Reportes',
        href: '/reportes',
        icon: BarChart3,
        roles: ['superadmin', 'administrador', 'jefe_produccion', 'comercial', 'contador', 'solo_lectura'],
      },
      {
        title: 'Historial de Lavados',
        href: '/actividades',
        icon: History,
        roles: ['superadmin', 'administrador'],
      },
    ],
  },
  {
    title: 'Sistema',
    defaultOpen: false,
    items: [
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
    ],
  },
];

const getClientNavSections = (_clienteId: string | null): NavSection[] => [
  {
    title: 'Mi Cuenta',
    defaultOpen: true,
    items: [
      { title: 'Mi Perfil',        href: '/perfil',        icon: Building2 },
      { title: 'Mi Producción',    href: '/mi-produccion', icon: Factory   },
      { title: 'Mis Pedidos',      href: '/mis-pedidos',   icon: FileText  },
      { title: 'Cuenta Corriente', href: '/mi-cuenta',     icon: Wallet    },
      { title: 'Mi Usuario',       href: '/perfil',        icon: User      },
    ],
  },
];

export function Sidebar({ isCollapsed, onToggle, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  const isCliente = user?.rol === 'cliente';
  const navSections = isCliente
    ? getClientNavSections(user?.cliente_id || null)
    : navSectionsInternal;

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navSections.forEach((section) => {
      initial[section.title] = !section.defaultOpen;
    });
    return initial;
  });

  const toggleSection = (sectionTitle: string) => {
    setCollapsedSections((prev) => ({ ...prev, [sectionTitle]: !prev[sectionTitle] }));
  };

  const filterItems = (items: NavItem[]) => {
    return items.filter((item) => {
      if (!item.roles) return true;
      return user && item.roles.includes(user.rol);
    });
  };

  const visibleSections = navSections
    .map((section) => ({ ...section, items: filterItems(section.items) }))
    .filter((section) => section.items.length > 0);

  return (
    // ⚠ Sin `position: fixed` aquí — el posicionamiento lo maneja el wrapper en MainLayout.
    // En desktop se colapsa (w-16 / w-64); en mobile siempre se muestra expandido cuando está abierto.
    <aside
      className={cn(
        'h-full bg-sidebar text-white transition-all duration-300 flex flex-col',
        isCollapsed ? 'lg:w-16 w-64' : 'w-64'
      )}
    >
      {/* Header con Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-white/10 flex-shrink-0">
        {/* Logo completo — siempre visible en mobile, en desktop solo si no colapsado */}
        <Link
          to="/dashboard"
          onClick={onMobileClose}
          className={cn('flex items-center', isCollapsed && 'hidden')}
        >
          <img src="/logo-white.svg" alt="DUWHITE" className="h-10 w-auto" />
        </Link>

        {/* Ícono DW — solo en desktop colapsado */}
        <Link
          to="/dashboard"
          className={cn(
            'w-8 h-8 bg-primary rounded-md items-center justify-center mx-auto',
            isCollapsed ? 'hidden lg:flex' : 'hidden'
          )}
          title="DUWHITE"
        >
          <span className="text-sm font-bold text-white">DW</span>
        </Link>

        {/* Botón cerrar — solo mobile */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileClose}
          className="text-white hover:bg-white/10 lg:hidden"
          aria-label="Cerrar menú"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Botón colapsar — solo desktop */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="text-white hover:bg-white/10 hidden lg:flex"
          aria-label={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Navigation con scroll */}
      <nav className="flex-1 overflow-y-auto p-2">
        {visibleSections.map((section) => {
          const isSectionCollapsed = collapsedSections[section.title];

          // En mobile el sidebar nunca está "colapsado" (isCollapsed=false siempre en drawer)
          // pero aun así respetamos la clase para desktop. En mobile siempre mostramos texto.
          const showText = !isCollapsed;

          return (
            <div key={section.title} className="mb-2">
              {showText && (
                <button
                  onClick={() => toggleSection(section.title)}
                  className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-white/50 uppercase tracking-wider hover:text-white/70 transition-colors"
                >
                  <span>{section.title}</span>
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', isSectionCollapsed && '-rotate-90')}
                  />
                </button>
              )}

              {(!isSectionCollapsed || !showText) && (
                <div className={cn('flex flex-col gap-1', showText && 'mt-1')}>
                  {section.items.map((item) => {
                    const isActive = location.pathname.startsWith(item.href);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={onMobileClose}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-primary text-white'
                            : 'text-white/70 hover:bg-white/10 hover:text-white',
                          !showText && 'justify-center px-2'
                        )}
                        title={!showText ? item.title : undefined}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {showText && <span>{item.title}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}

              {showText && (
                <div className="mx-3 my-2 border-b border-white/10" />
              )}
            </div>
          );
        })}
      </nav>

      {!isCollapsed && (
        <div className="flex-shrink-0 p-4 border-t border-white/10">
          <p className="text-xs text-white/30 text-center">DUWHITE ERP v1.0</p>
        </div>
      )}
    </aside>
  );
}
