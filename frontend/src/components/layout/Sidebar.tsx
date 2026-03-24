/**
 * Sidebar de navegación principal con secciones agrupadas
 */

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
  CheckSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  UserCog,
  Contact,
  ShoppingCart,
  ClipboardList,
  Boxes,
  FolderOpen,
  User,
  Building2,
  Tag,
  CreditCard,
  Landmark,
  Clock,
  Banknote,
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

interface NavSection {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

// Navegación para usuarios internos (no clientes)
const navSectionsInternal: NavSection[] = [
  {
    title: 'Principal',
    defaultOpen: true,
    items: [
      {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        roles: ['superadmin', 'administrador', 'jefe_produccion', 'operador', 'comercial', 'contador', 'solo_lectura'],
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
    ],
  },
  {
    title: 'Administración',
    defaultOpen: true,
    items: [
      {
        title: 'Finanzas',
        href: '/finanzas',
        icon: Wallet,
        roles: ['superadmin', 'administrador', 'contador', 'solo_lectura'],
      },
      {
        title: 'Cuentas Corrientes',
        href: '/finanzas/cuentas-corrientes-clientes',
        icon: Users,
        roles: ['superadmin', 'administrador', 'contador', 'comercial'],
      },
      {
        title: 'Órdenes de Pago',
        href: '/finanzas/ordenes-pago',
        icon: CreditCard,
        roles: ['superadmin', 'administrador', 'contador'],
      },
      {
        title: 'Vencimientos',
        href: '/finanzas/analisis-vencimientos',
        icon: Clock,
        roles: ['superadmin', 'administrador', 'contador', 'solo_lectura'],
      },
      {
        title: 'Conciliación',
        href: '/finanzas/conciliacion',
        icon: Landmark,
        roles: ['superadmin', 'administrador', 'contador'],
      },
      {
        title: 'Tesorería',
        href: '/tesoreria',
        icon: Banknote,
        roles: ['superadmin', 'administrador', 'contador'],
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
        title: 'Actividades',
        href: '/actividades',
        icon: CheckSquare,
        roles: ['superadmin', 'administrador', 'jefe_produccion', 'operador', 'comercial', 'contador', 'solo_lectura'],
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

// Navegación especial para clientes - Solo ven su propia información
const getClientNavSections = (clienteId: string | null): NavSection[] => [
  {
    title: 'Mi Cuenta',
    defaultOpen: true,
    items: [
      {
        title: 'Mi Perfil',
        href: clienteId ? `/clientes/${clienteId}` : '/perfil',
        icon: Building2,
      },
      {
        title: 'Mis Pedidos',
        href: '/mis-pedidos',
        icon: FileText,
      },
      {
        title: 'Cuenta Corriente',
        href: '/mi-cuenta',
        icon: Wallet,
      },
      {
        title: 'Mi Usuario',
        href: '/perfil',
        icon: User,
      },
    ],
  },
];

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  // Determinar qué navegación usar según el rol
  const isCliente = user?.rol === 'cliente';
  const navSections = isCliente
    ? getClientNavSections(user?.cliente_id || null)
    : navSectionsInternal;

  // Estado para secciones colapsadas
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navSections.forEach((section) => {
      initial[section.title] = !section.defaultOpen;
    });
    return initial;
  });

  const toggleSection = (sectionTitle: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle],
    }));
  };

  // Filtrar items según rol del usuario
  const filterItems = (items: NavItem[]) => {
    return items.filter((item) => {
      if (!item.roles) return true;
      return user && item.roles.includes(user.rol);
    });
  };

  // Filtrar secciones que tienen al menos un item visible
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: filterItems(section.items),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar text-white transition-all duration-300 flex flex-col',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header con Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-white/10 flex-shrink-0">
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

      {/* Navigation con scroll */}
      <nav className="flex-1 overflow-y-auto p-2">
        {visibleSections.map((section) => {
          const isSectionCollapsed = collapsedSections[section.title];

          return (
            <div key={section.title} className="mb-2">
              {/* Título de sección (solo si no está colapsado el sidebar) */}
              {!isCollapsed && (
                <button
                  onClick={() => toggleSection(section.title)}
                  className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-white/50 uppercase tracking-wider hover:text-white/70 transition-colors"
                >
                  <span>{section.title}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isSectionCollapsed && '-rotate-90'
                    )}
                  />
                </button>
              )}

              {/* Items de la sección */}
              {(!isSectionCollapsed || isCollapsed) && (
                <div className={cn('flex flex-col gap-1', !isCollapsed && 'mt-1')}>
                  {section.items.map((item) => {
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
                </div>
              )}

              {/* Separador entre secciones */}
              {!isCollapsed && (
                <div className="mx-3 my-2 border-b border-white/10" />
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer con versión */}
      {!isCollapsed && (
        <div className="flex-shrink-0 p-4 border-t border-white/10">
          <p className="text-xs text-white/30 text-center">
            DUWHITE ERP v1.0
          </p>
        </div>
      )}
    </aside>
  );
}
