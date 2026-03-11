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
from app.models.etapa_produccion import EtapaProduccion


def run_migrations():
    """Ejecutar migraciones manuales para agregar columnas nuevas."""
    from app.db.base import engine
    from sqlalchemy import text

    migrations = [
        # Agregar valor 'cliente' al ENUM de roles
        "ALTER TYPE rol_usuario ADD VALUE IF NOT EXISTS 'cliente'",
        # Nuevas columnas para usuarios
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_visible VARCHAR(255)",
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(50)",
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permisos_modulos JSON",
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id)",
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pin VARCHAR(6)",
        # Calificación de proveedores
        "ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS calificacion NUMERIC(3,2) DEFAULT 0",
        # Saldo cuenta corriente de proveedores
        "ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS saldo_cuenta_corriente NUMERIC(15,2) DEFAULT 0",
        # Columna orden_produccion_id en lotes_produccion
        "ALTER TABLE lotes_produccion ADD COLUMN IF NOT EXISTS orden_produccion_id UUID",
    ]

    # Migraciones que crean tablas (ejecutar después de las columnas)
    table_migrations = [
        # Tabla ordenes_produccion
        """
        CREATE TABLE IF NOT EXISTS ordenes_produccion (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            numero VARCHAR(20) NOT NULL UNIQUE,
            cliente_id UUID REFERENCES clientes(id),
            pedido_id UUID REFERENCES pedidos(id),
            estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
            prioridad VARCHAR(20) NOT NULL DEFAULT 'normal',
            fecha_emision DATE NOT NULL,
            fecha_programada_inicio DATE,
            fecha_programada_fin DATE,
            fecha_inicio_real TIMESTAMP,
            fecha_fin_real TIMESTAMP,
            descripcion TEXT,
            instrucciones_especiales TEXT,
            cantidad_prendas_estimada INTEGER,
            peso_estimado_kg NUMERIC(10,2),
            cantidad_prendas_real INTEGER,
            peso_real_kg NUMERIC(10,2),
            responsable_id UUID REFERENCES usuarios(id),
            creado_por_id UUID NOT NULL REFERENCES usuarios(id),
            notas_internas TEXT,
            notas_produccion TEXT,
            activo BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP
        )
        """,
        # Índices para ordenes_produccion
        "CREATE INDEX IF NOT EXISTS ix_ordenes_produccion_numero ON ordenes_produccion(numero)",
        "CREATE INDEX IF NOT EXISTS ix_ordenes_produccion_estado ON ordenes_produccion(estado)",
        "CREATE INDEX IF NOT EXISTS ix_ordenes_produccion_cliente_id ON ordenes_produccion(cliente_id)",
        # Tabla asignaciones_empleado_op
        """
        CREATE TABLE IF NOT EXISTS asignaciones_empleado_op (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            orden_id UUID NOT NULL REFERENCES ordenes_produccion(id),
            empleado_id UUID NOT NULL REFERENCES usuarios(id),
            etapa_id UUID REFERENCES etapas_produccion(id),
            fecha_asignacion DATE NOT NULL,
            fecha_fin_asignacion DATE,
            turno VARCHAR(20),
            horas_estimadas NUMERIC(5,2),
            horas_trabajadas NUMERIC(5,2),
            notas TEXT,
            activo BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_asignaciones_empleado_op_orden_id ON asignaciones_empleado_op(orden_id)",
        # Tabla incidencias_produccion
        """
        CREATE TABLE IF NOT EXISTS incidencias_produccion (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            orden_id UUID REFERENCES ordenes_produccion(id),
            lote_id UUID REFERENCES lotes_produccion(id),
            etapa_id UUID REFERENCES etapas_produccion(id),
            tipo VARCHAR(50) NOT NULL,
            severidad VARCHAR(20) NOT NULL DEFAULT 'media',
            titulo VARCHAR(255) NOT NULL,
            descripcion TEXT,
            fecha_incidencia TIMESTAMP NOT NULL,
            fecha_resolucion TIMESTAMP,
            estado VARCHAR(20) NOT NULL DEFAULT 'abierta',
            fotos TEXT,
            reportado_por_id UUID NOT NULL REFERENCES usuarios(id),
            resuelto_por_id UUID REFERENCES usuarios(id),
            acciones_tomadas TEXT,
            tiempo_perdido_minutos INTEGER,
            costo_estimado NUMERIC(12,2),
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_incidencias_produccion_orden_id ON incidencias_produccion(orden_id)",
        # FK de lotes_produccion a ordenes_produccion (si no existe)
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_lotes_orden_produccion'
            ) THEN
                ALTER TABLE lotes_produccion
                ADD CONSTRAINT fk_lotes_orden_produccion
                FOREIGN KEY (orden_produccion_id) REFERENCES ordenes_produccion(id);
            END IF;
        END $$;
        """,
    ]

    with engine.connect() as conn:
        for migration in migrations:
            try:
                conn.execute(text(migration))
                conn.commit()
                print(f"Migración ejecutada: {migration[:50]}...")
            except Exception as e:
                # Ignorar errores si la columna ya existe o hay otro problema
                print(f"Migración saltada o error: {str(e)[:100]}")
                conn.rollback()

        # Ejecutar migraciones de tablas
        for migration in table_migrations:
            try:
                conn.execute(text(migration))
                conn.commit()
                print(f"Tabla/índice creado: {migration[:50]}...")
            except Exception as e:
                print(f"Tabla saltada o error: {str(e)[:100]}")
                conn.rollback()


def create_tables():
    """Crear todas las tablas en la base de datos. v4"""
    from app.db.base import Base, engine
    # Importar todos los modelos para que SQLAlchemy los registre
    from app.models import (
        usuario, cliente, pedido, empleado, insumo, proveedor,
        lote_produccion, etapa_produccion, maquina,
        categoria_insumo, movimiento_stock, orden_compra,
        lista_precios, cuenta_corriente, caja, cuenta_bancaria, costo,
        log_actividad, producto_proveedor, historial_precios_proveedor,
        orden_produccion
    )

    try:
        print("Creando tablas en la base de datos...")
        Base.metadata.create_all(bind=engine)
        print("Tablas creadas correctamente")

        # Ejecutar migraciones para columnas nuevas
        print("Ejecutando migraciones...")
        run_migrations()
        print("Migraciones completadas")
    except Exception as e:
        print(f"Error creando tablas: {e}")
        import traceback
        traceback.print_exc()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ejecutar migraciones y crear usuario admin al iniciar."""

    # Crear tablas primero
    create_tables()

    # Crear usuario admin si no existe
    db = SessionLocal()
    try:
        admin = db.query(Usuario).filter(Usuario.email == "admin@duwhite.com").first()
        if not admin:
            # Usar bcrypt directamente para evitar problemas con passlib
            import bcrypt
            password = "Admin123!"
            hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            admin = Usuario(
                id=uuid4(),
                email="admin@duwhite.com",
                password_hash=hashed,
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

        # Crear etapas de producción por defecto si no existen
        etapas_count = db.query(EtapaProduccion).count()
        if etapas_count == 0:
            etapas_default = [
                {
                    "codigo": "REC",
                    "nombre": "Recepción",
                    "descripcion": "Ingreso y pesaje de ropa",
                    "orden": 1,
                    "color": "#6366F1",
                    "es_inicial": True,
                    "es_final": False,
                    "requiere_peso": True,
                    "requiere_maquina": False,
                    "tiempo_estimado_minutos": 15,
                },
                {
                    "codigo": "CLA",
                    "nombre": "Clasificación",
                    "descripcion": "Separación por tipo, color y grado de suciedad",
                    "orden": 2,
                    "color": "#8B5CF6",
                    "es_inicial": False,
                    "es_final": False,
                    "requiere_peso": False,
                    "requiere_maquina": False,
                    "tiempo_estimado_minutos": 20,
                },
                {
                    "codigo": "LAV",
                    "nombre": "Lavado",
                    "descripcion": "Proceso de lavado industrial",
                    "orden": 3,
                    "color": "#3B82F6",
                    "es_inicial": False,
                    "es_final": False,
                    "requiere_peso": False,
                    "requiere_maquina": True,
                    "tiempo_estimado_minutos": 45,
                },
                {
                    "codigo": "SEC",
                    "nombre": "Secado",
                    "descripcion": "Secado industrial",
                    "orden": 4,
                    "color": "#F59E0B",
                    "es_inicial": False,
                    "es_final": False,
                    "requiere_peso": False,
                    "requiere_maquina": True,
                    "tiempo_estimado_minutos": 30,
                },
                {
                    "codigo": "PLA",
                    "nombre": "Planchado",
                    "descripcion": "Planchado y doblado",
                    "orden": 5,
                    "color": "#EF4444",
                    "es_inicial": False,
                    "es_final": False,
                    "requiere_peso": False,
                    "requiere_maquina": True,
                    "tiempo_estimado_minutos": 25,
                },
                {
                    "codigo": "CAL",
                    "nombre": "Control de Calidad",
                    "descripcion": "Inspección final de calidad",
                    "orden": 6,
                    "color": "#10B981",
                    "es_inicial": False,
                    "es_final": False,
                    "requiere_peso": False,
                    "requiere_maquina": False,
                    "tiempo_estimado_minutos": 10,
                },
                {
                    "codigo": "EMP",
                    "nombre": "Empaque",
                    "descripcion": "Preparación y empaque para entrega",
                    "orden": 7,
                    "color": "#14B8A6",
                    "es_inicial": False,
                    "es_final": False,
                    "requiere_peso": True,
                    "requiere_maquina": False,
                    "tiempo_estimado_minutos": 15,
                },
                {
                    "codigo": "ENT",
                    "nombre": "Listo para Entrega",
                    "descripcion": "Lote listo para despacho al cliente",
                    "orden": 8,
                    "color": "#22C55E",
                    "es_inicial": False,
                    "es_final": True,
                    "requiere_peso": False,
                    "requiere_maquina": False,
                    "tiempo_estimado_minutos": 0,
                },
            ]
            for etapa_data in etapas_default:
                etapa = EtapaProduccion(id=uuid4(), activo=True, **etapa_data)
                db.add(etapa)
            db.commit()
            print(f"Creadas {len(etapas_default)} etapas de producción por defecto")
        else:
            print(f"Ya existen {etapas_count} etapas de producción")

    except Exception as e:
        print(f"Error en inicialización: {e}")
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
# Usar allow_origin_regex para soportar patrones wildcard de Railway
import os
is_production = os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RAILWAY_STATIC_URL")

if is_production:
    # En producción, usar regex para permitir cualquier subdominio de railway.app
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"https://.*\.up\.railway\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # En desarrollo, usar lista específica
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
