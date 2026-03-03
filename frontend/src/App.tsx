/**
 * Componente principal de la aplicación
 */

import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { useAuthStore } from '@/stores/authStore';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { MainLayout } from '@/components/layout/MainLayout';

// Pages
import LoginPage from '@/pages/auth/LoginPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';

// Stock
import InsumosList from '@/pages/stock/InsumosList';
import InsumoForm from '@/pages/stock/InsumoForm';
import InsumoDetail from '@/pages/stock/InsumoDetail';
import CategoriasInsumos from '@/pages/stock/CategoriasInsumos';
import AjusteStock from '@/pages/stock/AjusteStock';

// Proveedores
import ProveedoresList from '@/pages/proveedores/ProveedoresList';
import ProveedorForm from '@/pages/proveedores/ProveedorForm';
import ProveedorDetail from '@/pages/proveedores/ProveedorDetail';

// Producción
import { KanbanBoardPage, LotesListPage, LoteFormPage, LoteDetailPage } from '@/pages/produccion';

// Clientes
import { ClientesListPage, ClienteFormPage, ClienteDetailPage } from '@/pages/clientes';

// Pedidos
import { PedidosListPage, PedidoFormPage, PedidoDetailPage } from '@/pages/pedidos';

// Finanzas
import { CajaPage } from '@/pages/finanzas';

// Empleados
import { EmpleadosListPage, EmpleadoFormPage, EmpleadoDetailPage, AsistenciaPage } from '@/pages/empleados';

// Órdenes de Compra
import { OrdenesCompraListPage, OrdenCompraFormPage, OrdenCompraDetailPage } from '@/pages/ordenes-compra';

// Costos
import { CostosPage } from '@/pages/costos';

// Reportes
import { ReportesPage } from '@/pages/reportes';

// Actividades
import { ActividadesPage } from '@/pages/actividades';

// Configuración
import { ConfiguracionPage } from '@/pages/configuracion';

// Perfil
import { PerfilPage } from '@/pages/perfil';

// Usuarios
import UsuariosPage from '@/pages/usuarios/UsuariosPage';

// Página temporal para módulos no implementados
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-2xl font-bold text-text-primary mb-2">{title}</h1>
      <p className="text-muted-foreground">Este módulo está en desarrollo</p>
    </div>
  );
}

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  // Verificar autenticación al cargar la app
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login" element={<LoginPage />} />

      {/* Rutas protegidas */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard */}
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Stock */}
        <Route path="/stock" element={<Navigate to="/stock/insumos" replace />} />
        <Route path="/stock/insumos" element={<InsumosList />} />
        <Route path="/stock/insumos/nuevo" element={<InsumoForm />} />
        <Route path="/stock/insumos/:id" element={<InsumoDetail />} />
        <Route path="/stock/insumos/:id/editar" element={<InsumoForm />} />
        <Route path="/stock/insumos/:id/ajuste" element={<AjusteStock />} />
        <Route path="/stock/categorias" element={<CategoriasInsumos />} />

        {/* Proveedores */}
        <Route path="/proveedores" element={<ProveedoresList />} />
        <Route path="/proveedores/nuevo" element={<ProveedorForm />} />
        <Route path="/proveedores/:id" element={<ProveedorDetail />} />
        <Route path="/proveedores/:id/editar" element={<ProveedorForm />} />
        <Route path="/proveedores/:id/productos" element={<ComingSoon title="Productos del Proveedor" />} />
        <Route path="/proveedores/ordenes" element={<OrdenesCompraListPage />} />
        <Route path="/proveedores/ordenes/nueva" element={<OrdenCompraFormPage />} />
        <Route path="/proveedores/ordenes/:id" element={<OrdenCompraDetailPage />} />
        <Route path="/proveedores/ordenes/:id/editar" element={<OrdenCompraFormPage />} />

        {/* Producción */}
        <Route path="/produccion" element={<KanbanBoardPage />} />
        <Route path="/produccion/lotes" element={<LotesListPage />} />
        <Route path="/produccion/lotes/nuevo" element={<LoteFormPage />} />
        <Route path="/produccion/lotes/:id" element={<LoteDetailPage />} />
        <Route path="/produccion/lotes/:id/editar" element={<LoteFormPage />} />
        <Route path="/produccion/etapas" element={<ComingSoon title="Etapas de Producción" />} />
        <Route path="/produccion/maquinas" element={<ComingSoon title="Máquinas" />} />

        {/* Clientes */}
        <Route path="/clientes" element={<ClientesListPage />} />
        <Route path="/clientes/nuevo" element={<ClienteFormPage />} />
        <Route path="/clientes/:id" element={<ClienteDetailPage />} />
        <Route path="/clientes/:id/editar" element={<ClienteFormPage />} />

        {/* Pedidos */}
        <Route path="/pedidos" element={<PedidosListPage />} />
        <Route path="/pedidos/nuevo" element={<PedidoFormPage />} />
        <Route path="/pedidos/:id" element={<PedidoDetailPage />} />
        <Route path="/pedidos/:id/editar" element={<PedidoFormPage />} />

        {/* Finanzas */}
        <Route path="/finanzas" element={<Navigate to="/finanzas/caja" replace />} />
        <Route path="/finanzas/caja" element={<CajaPage />} />
        <Route path="/finanzas/bancos" element={<ComingSoon title="Cuentas Bancarias" />} />
        <Route path="/finanzas/resumen" element={<ComingSoon title="Resumen Financiero" />} />

        {/* Costos */}
        <Route path="/costos" element={<CostosPage />} />
        <Route path="/costos/*" element={<CostosPage />} />

        {/* Empleados */}
        <Route path="/empleados" element={<EmpleadosListPage />} />
        <Route path="/empleados/nuevo" element={<EmpleadoFormPage />} />
        <Route path="/empleados/:id" element={<EmpleadoDetailPage />} />
        <Route path="/empleados/:id/editar" element={<EmpleadoFormPage />} />
        <Route path="/empleados/asistencia" element={<AsistenciaPage />} />
        <Route path="/empleados/nomina" element={<ComingSoon title="Nómina" />} />
        <Route path="/empleados/liquidaciones" element={<ComingSoon title="Liquidaciones" />} />

        {/* Reportes */}
        <Route path="/reportes" element={<ReportesPage />} />

        {/* Actividades */}
        <Route path="/actividades" element={<ActividadesPage />} />

        {/* Usuarios */}
        <Route path="/usuarios" element={<UsuariosPage />} />

        {/* Configuración */}
        <Route path="/configuracion" element={<ConfiguracionPage />} />

        {/* Perfil */}
        <Route path="/perfil" element={<PerfilPage />} />
      </Route>

      {/* Página de acceso no autorizado */}
      <Route
        path="/unauthorized"
        element={
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-destructive mb-2">403</h1>
              <p className="text-xl text-text-primary mb-4">Acceso no autorizado</p>
              <p className="text-muted-foreground">No tienes permisos para acceder a esta página</p>
            </div>
          </div>
        }
      />

      {/* Redirect default */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* 404 */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-primary mb-2">404</h1>
              <p className="text-xl text-text-primary mb-4">Página no encontrada</p>
              <p className="text-muted-foreground">La página que buscas no existe</p>
            </div>
          </div>
        }
      />
    </Routes>
  );
}

export default App;
