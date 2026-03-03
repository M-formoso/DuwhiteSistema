"""
Punto de entrada principal de la aplicación DUWHITE.
"""

from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.usuario import Usuario


def run_migrations():
    """Ejecutar migraciones de Alembic."""
    import subprocess
    try:
        print("Ejecutando migraciones de Alembic...")
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            cwd="/app"
        )
        if result.returncode == 0:
            print("Migraciones ejecutadas correctamente")
            print(result.stdout)
        else:
            print(f"Error en migraciones: {result.stderr}")
    except Exception as e:
        print(f"Error ejecutando migraciones: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ejecutar migraciones y crear usuario admin al iniciar."""

    # Ejecutar migraciones primero
    run_migrations()

    # Crear usuario admin si no existe
    db = SessionLocal()
    try:
        admin = db.query(Usuario).filter(Usuario.email == "admin@duwhite.com").first()
        if not admin:
            admin = Usuario(
                id=uuid4(),
                email="admin@duwhite.com",
                password_hash=get_password_hash("Admin123!"),
                nombre="Administrador",
                apellido="Sistema",
                rol="superadmin",
                activo=True,
                debe_cambiar_password=False,
            )
            db.add(admin)
            db.commit()
            print("Usuario admin creado: admin@duwhite.com / Admin123!")
        else:
            print("Usuario admin ya existe")
    except Exception as e:
        print(f"Error creando admin: {e}")
        db.rollback()
    finally:
        db.close()

    yield

    pass

# Crear aplicación FastAPI
app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
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
