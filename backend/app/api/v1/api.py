"""
Router principal de la API v1.
Registra todos los endpoints de los módulos.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    usuarios,
    categorias_insumo,
    insumos,
    proveedores,
    ordenes_compra,
    produccion,
    clientes,
    pedidos,
    finanzas,
    empleados,
    costos,
    reportes,
    dashboard,
    seed,
    servicios,
    actividades,
    cuenta_corriente_proveedor,
    ordenes_pago,
    cruces_consolidados,
    conciliacion_bancaria,
)

api_router = APIRouter()

# Autenticación
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Autenticación"],
)

# Usuarios
api_router.include_router(
    usuarios.router,
    prefix="/usuarios",
    tags=["Usuarios"],
)

# Stock - Categorías
api_router.include_router(
    categorias_insumo.router,
    prefix="/categorias-insumo",
    tags=["Stock - Categorías"],
)

# Stock - Insumos
api_router.include_router(
    insumos.router,
    prefix="/insumos",
    tags=["Stock - Insumos"],
)

# Proveedores
api_router.include_router(
    proveedores.router,
    prefix="/proveedores",
    tags=["Proveedores"],
)

# Órdenes de Compra
api_router.include_router(
    ordenes_compra.router,
    prefix="/ordenes-compra",
    tags=["Órdenes de Compra"],
)

# Producción
api_router.include_router(
    produccion.router,
    prefix="/produccion",
    tags=["Producción"],
)

# Clientes
api_router.include_router(
    clientes.router,
    prefix="/clientes",
    tags=["Clientes"],
)

# Pedidos
api_router.include_router(
    pedidos.router,
    prefix="/pedidos",
    tags=["Pedidos"],
)

# Finanzas
api_router.include_router(
    finanzas.router,
    prefix="/finanzas",
    tags=["Finanzas"],
)

# Empleados
api_router.include_router(
    empleados.router,
    prefix="/empleados",
    tags=["Empleados"],
)

# Costos
api_router.include_router(
    costos.router,
    prefix="/costos",
    tags=["Costos"],
)

# Reportes
api_router.include_router(
    reportes.router,
    prefix="/reportes",
    tags=["Reportes"],
)

# Dashboard
api_router.include_router(
    dashboard.router,
    prefix="/dashboard",
    tags=["Dashboard"],
)

# Seed (datos de prueba)
api_router.include_router(
    seed.router,
    prefix="/seed",
    tags=["Seed"],
)

# Servicios y Listas de Precios
api_router.include_router(
    servicios.router,
    prefix="/servicios",
    tags=["Servicios y Listas de Precios"],
)

# Actividades
api_router.include_router(
    actividades.router,
    prefix="/actividades",
    tags=["Actividades"],
)

# Cuenta Corriente Proveedores
api_router.include_router(
    cuenta_corriente_proveedor.router,
    prefix="/proveedores/cuenta-corriente",
    tags=["Cuenta Corriente Proveedores"],
)

# Órdenes de Pago
api_router.include_router(
    ordenes_pago.router,
    prefix="/ordenes-pago",
    tags=["Órdenes de Pago"],
)

# Cruces Consolidados Cliente-Proveedor
api_router.include_router(
    cruces_consolidados.router,
    prefix="/cruces-consolidados",
    tags=["Cruces Consolidados"],
)

# Conciliación Bancaria
api_router.include_router(
    conciliacion_bancaria.router,
    prefix="/conciliacion-bancaria",
    tags=["Conciliación Bancaria"],
)

# Los siguientes routers se agregarán a medida que se implementen los módulos:
# api_router.include_router(facturacion.router, prefix="/facturacion", tags=["Facturación"])
# api_router.include_router(configuracion.router, prefix="/config", tags=["Configuración"])
