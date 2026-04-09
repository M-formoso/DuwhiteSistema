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
import ProductosProveedorPage from '@/pages/proveedores/ProductosProveedorPage';

// Producción
import { KanbanBoardPage, LotesListPage, LoteFormPage, LoteDetailPage, EtapasProduccionPage, MaquinasPage, PanelOperariosPage } from '@/pages/produccion';
import CanastosPage from '@/pages/produccion/CanastosPage';
import ProductosLavadoPage from '@/pages/produccion/ProductosLavadoPage';
import ConteoFinalizacionPage from '@/pages/produccion/ConteoFinalizacionPage';

// Clientes
import { ClientesListPage, ClienteFormPage, ClienteDetailPage, ClienteCuentaCorrientePage } from '@/pages/clientes';

// Pedidos
import { PedidosListPage, PedidoFormPage, PedidoDetailPage } from '@/pages/pedidos';

// Finanzas - Solo CuentaCorrienteClientesPage (el resto migrado a Tesorería)
import CuentaCorrienteClientesPage from '@/pages/finanzas/CuentaCorrienteClientesPage';

// Tesorería
import TesoreriaPage from '@/pages/tesoreria/TesoreriaPage';

// Empleados
import { EmpleadosListPage, EmpleadoFormPage, EmpleadoDetailPage, AsistenciaPage, NominaPage, LiquidacionesPage } from '@/pages/empleados';
import JornalesPage from '@/pages/empleados/JornalesPage';

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

// Portal Cliente
import { MisPedidosPage, MiCuentaCorrientePage } from '@/pages/cliente-portal';

// Servicios y Listas de Precios
import { ServiciosPage, ListaPreciosDetail } from '@/pages/servicios';

// Liquidaciones de Pedidos
import { LiquidacionesPedidosPage, LiquidacionDetail } from '@/pages/liquidaciones';

// Componente para redirección inteligente según rol
function HomeRedirect() {
  const user = useAuthStore((state) => state.user);

  if (user?.rol === 'cliente' && user?.cliente_id) {
    return <Navigate to={`/clientes/${user.cliente_id}`} replace />;
  }

  return <Navigate to="/dashboard" replace />;
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
        <Route path="/proveedores/:id/productos" element={<ProductosProveedorPage />} />
        <Route path="/proveedores/ordenes" element={<OrdenesCompraListPage />} />
        <Route path="/proveedores/ordenes/nueva" element={<OrdenCompraFormPage />} />
        <Route path="/proveedores/ordenes/:id" element={<OrdenCompraDetailPage />} />
        <Route path="/proveedores/ordenes/:id/editar" element={<OrdenCompraFormPage />} />

        {/* Producción */}
        <Route path="/produccion" element={<KanbanBoardPage />} />
        <Route path="/produccion/panel" element={<PanelOperariosPage />} />
        <Route path="/produccion/lotes" element={<LotesListPage />} />
        <Route path="/produccion/lotes/nuevo" element={<LoteFormPage />} />
        <Route path="/produccion/lotes/:id" element={<LoteDetailPage />} />
        <Route path="/produccion/lotes/:id/editar" element={<LoteFormPage />} />
        <Route path="/produccion/etapas" element={<EtapasProduccionPage />} />
        <Route path="/produccion/maquinas" element={<MaquinasPage />} />
        <Route path="/produccion/canastos" element={<CanastosPage />} />
        <Route path="/produccion/productos" element={<ProductosLavadoPage />} />
        <Route path="/produccion/lotes/:id/conteo" element={<ConteoFinalizacionPage />} />

        {/* Clientes */}
        <Route path="/clientes" element={<ClientesListPage />} />
        <Route path="/clientes/nuevo" element={<ClienteFormPage />} />
        <Route path="/clientes/:id" element={<ClienteDetailPage />} />
        <Route path="/clientes/:id/editar" element={<ClienteFormPage />} />
        <Route path="/clientes/:id/cuenta-corriente" element={<ClienteCuentaCorrientePage />} />

        {/* Pedidos */}
        <Route path="/pedidos" element={<PedidosListPage />} />
        <Route path="/pedidos/nuevo" element={<PedidoFormPage />} />
        <Route path="/pedidos/:id" element={<PedidoDetailPage />} />
        <Route path="/pedidos/:id/editar" element={<PedidoFormPage />} />

        {/* Tesorería (antes Finanzas - todo centralizado aquí) */}
        <Route path="/tesoreria" element={<TesoreriaPage />} />
        <Route path="/tesoreria/cuentas-corrientes" element={<CuentaCorrienteClientesPage />} />

        {/* Redirects de Finanzas antiguo a Tesorería */}
        <Route path="/finanzas" element={<Navigate to="/tesoreria" replace />} />
        <Route path="/finanzas/*" element={<Navigate to="/tesoreria" replace />} />

        {/* Servicios y Listas de Precios */}
        <Route path="/servicios" element={<ServiciosPage />} />
        <Route path="/servicios/listas/:id" element={<ListaPreciosDetail />} />

        {/* Liquidaciones de Pedidos */}
        <Route path="/liquidaciones" element={<LiquidacionesPedidosPage />} />
        <Route path="/liquidaciones/:id" element={<LiquidacionDetail />} />

        {/* Costos */}
        <Route path="/costos" element={<CostosPage />} />
        <Route path="/costos/*" element={<CostosPage />} />

        {/* Empleados */}
        <Route path="/empleados" element={<EmpleadosListPage />} />
        <Route path="/empleados/nuevo" element={<EmpleadoFormPage />} />
        <Route path="/empleados/:id" element={<EmpleadoDetailPage />} />
        <Route path="/empleados/:id/editar" element={<EmpleadoFormPage />} />
        <Route path="/empleados/asistencia" element={<AsistenciaPage />} />
        <Route path="/empleados/nomina" element={<NominaPage />} />
        <Route path="/empleados/liquidaciones" element={<LiquidacionesPage />} />
        <Route path="/empleados/jornales" element={<JornalesPage />} />

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

        {/* Portal Cliente */}
        <Route path="/mis-pedidos" element={<MisPedidosPage />} />
        <Route path="/mi-cuenta" element={<MiCuentaCorrientePage />} />
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

      {/* Redirect default - usa HomeRedirect para redirigir según rol */}
      <Route path="/" element={<HomeRedirect />} />

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
