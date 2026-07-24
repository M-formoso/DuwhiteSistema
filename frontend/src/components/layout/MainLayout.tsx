import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';

export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Backdrop mobile — toca fuera para cerrar */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/*
       * Wrapper del sidebar.
       * - En mobile: empieza fuera de pantalla (-translate-x-full) y entra
       *   con translate-x-0 al abrir. El `position: fixed` aquí contiene al
       *   <aside> hijo, que ya NO tiene fixed propio.
       * - En desktop: siempre visible (lg:translate-x-0).
       * - La anchura del wrapper se adapta a la del <aside> (w-64 / lg:w-16).
       */}
      <div
        className={cn(
          'fixed left-0 top-0 z-40 h-screen transition-transform duration-300 ease-in-out lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onMobileClose={() => setMobileOpen(false)}
        />
      </div>

      {/* Header */}
      <Header
        sidebarCollapsed={sidebarCollapsed}
        onMobileMenuToggle={() => setMobileOpen(!mobileOpen)}
      />

      {/* Contenido principal */}
      <main
        className={cn(
          'pt-16 min-h-screen transition-all duration-300',
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        )}
      >
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
