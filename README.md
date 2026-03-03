# DUWHITE Gestión

Sistema de Gestión Integral para Lavandería Industrial - Córdoba, Argentina

## Descripción

Sistema ERP completo que incluye:

- 🔐 **Autenticación**: JWT con roles y permisos
- 📦 **Stock**: Control de insumos con alertas automáticas
- 🏭 **Proveedores**: Gestión de proveedores y órdenes de compra
- ⚙️ **Producción**: Control del proceso productivo con Kanban
- 👥 **Clientes**: Panel de clientes con cuenta corriente
- 💰 **Finanzas**: Facturación A/B, ingresos, egresos
- 📊 **Reportes**: Reportes completos con exportación PDF/Excel
- 👷 **Empleados**: Control de asistencia y productividad

## Stack Tecnológico

### Backend
- Python 3.11+
- FastAPI
- PostgreSQL 15+
- SQLAlchemy 2.0
- Celery + Redis

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui

## Inicio Rápido

### Con Docker (Recomendado)

```bash
# 1. Clonar repositorio
git clone <repo-url>
cd duwhite-gestion

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Iniciar servicios
docker-compose up -d

# 4. Ejecutar migraciones
docker-compose exec backend alembic upgrade head

# 5. Crear usuario inicial
docker-compose exec backend python -m app.db.init_db
```

Acceder a:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/v1/docs
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Sin Docker

#### Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Instalar dependencias
pip install -r requirements.txt

# Configurar .env
cp .env.example .env
# Editar .env con tus valores

# Ejecutar migraciones
alembic upgrade head

# Crear usuario inicial
python -m app.db.init_db

# Iniciar servidor
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Configurar .env
cp .env.example .env

# Iniciar servidor de desarrollo
npm run dev
```

## Usuario Inicial

Después de ejecutar `init_db`:

- **Email**: admin@duwhite.com
- **Password**: Admin123!
- **Rol**: superadmin

⚠️ Cambiar la contraseña en el primer login.

## Estructura del Proyecto

```
duwhite-gestion/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   ├── alembic/
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── types/
│   │   └── utils/
│   └── package.json
├── docker-compose.yml
├── CLAUDE.md
└── README.md
```

## Deploy en Railway

### Pasos para deployar

1. **Crear proyecto en Railway**
   - Ir a [railway.app](https://railway.app)
   - Crear nuevo proyecto desde GitHub
   - Conectar el repositorio `M-formoso/DuwhiteSistema`

2. **Agregar servicios**

   **PostgreSQL:**
   - Click en "New" → "Database" → "PostgreSQL"
   - Railway configurará automáticamente la variable `DATABASE_URL`

   **Redis:**
   - Click en "New" → "Database" → "Redis"
   - Railway configurará automáticamente la variable `REDIS_URL`

   **Backend:**
   - Click en "New" → "GitHub Repo" → seleccionar repositorio
   - En Settings → "Root Directory": `backend`
   - Agregar variables de entorno:
     ```
     SECRET_KEY=<generar con: openssl rand -hex 32>
     ALGORITHM=HS256
     ACCESS_TOKEN_EXPIRE_MINUTES=30
     REFRESH_TOKEN_EXPIRE_DAYS=7
     CORS_ORIGINS=https://<tu-frontend>.railway.app
     DEBUG=false
     ENVIRONMENT=production
     ```
   - Railway inyecta automáticamente `DATABASE_URL`, `REDIS_URL` y `PORT`

   **Frontend:**
   - Click en "New" → "GitHub Repo" → seleccionar repositorio
   - En Settings → "Root Directory": `frontend`
   - Agregar variables de entorno:
     ```
     VITE_API_URL=https://<tu-backend>.railway.app/api/v1
     ```

3. **Ejecutar migraciones** (primera vez)
   - En el servicio backend, ir a "Settings" → "Deploy"
   - El comando de inicio ya incluye `alembic upgrade head`

4. **Crear usuario admin**
   - En el servicio backend, abrir la terminal
   - Ejecutar: `python -m app.db.init_db`

### Variables de entorno requeridas

| Variable | Servicio | Descripción |
|----------|----------|-------------|
| `DATABASE_URL` | Backend | URL de PostgreSQL (auto-inyectada) |
| `REDIS_URL` | Backend | URL de Redis (auto-inyectada) |
| `SECRET_KEY` | Backend | Clave secreta para JWT |
| `CORS_ORIGINS` | Backend | URL del frontend |
| `VITE_API_URL` | Frontend | URL del backend API |

### Dominios personalizados

En cada servicio, ir a "Settings" → "Domains" para configurar dominios personalizados.

---

## Desarrollo

### Crear migración
```bash
cd backend
alembic revision --autogenerate -m "descripcion"
alembic upgrade head
```

### Tests
```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

## Licencia

Privado - DUWHITE © 2026
