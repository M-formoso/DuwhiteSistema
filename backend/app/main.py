"""
Punto de entrada principal de la aplicación DUWHITE.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import settings

# Crear aplicación FastAPI
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="""
## Sistema de Gestión Integral DUWHITE

Sistema ERP completo para lavandería industrial que incluye:

- 🔐 **Autenticación**: JWT con roles y permisos
- 📦 **Stock**: Control de insumos con alertas automáticas
- 🏭 **Proveedores**: Gestión de proveedores y órdenes de compra
- ⚙️ **Producción**: Control del proceso productivo con Kanban
- 👥 **Clientes**: Panel de clientes con cuenta corriente
- 💰 **Finanzas**: Facturación A/B, ingresos, egresos
- 📊 **Reportes**: Reportes completos con exportación PDF/Excel
- 👷 **Empleados**: Control de asistencia y productividad
    """,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["Root"])
async def root():
    """Endpoint raíz con información básica de la API."""
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": f"{settings.API_V1_PREFIX}/docs",
        "status": "running",
    }


@app.get("/health", tags=["Health"])
@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    """Health check para monitoreo."""
    return {
        "status": "healthy",
        "version": settings.VERSION,
    }
