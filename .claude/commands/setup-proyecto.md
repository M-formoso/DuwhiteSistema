# Setup Inicial del Proyecto DUWHITE

Configura la estructura base del proyecto desde cero.

## Estructura a Crear

```
duwhite-gestion/
├── frontend/                    # React + Vite + TypeScript
├── backend/                     # FastAPI + SQLAlchemy
├── docker-compose.yml           # PostgreSQL + Redis
├── docker-compose.prod.yml      # Producción
├── .env.example                 # Variables de entorno
├── .gitignore
├── README.md
└── CLAUDE.md                    # Instrucciones del agente
```

---

## Paso 1: Backend (FastAPI)

### 1.1 Crear estructura
```bash
mkdir -p backend/app/{api/v1/endpoints,core,db,models,schemas,services,tasks,utils}
mkdir -p backend/{alembic/versions,tests/{api,services}}
```

### 1.2 requirements.txt
```
# backend/requirements.txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
alembic==1.13.1
psycopg2-binary==2.9.9
pydantic==2.5.3
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
celery==5.3.6
redis==5.0.1
weasyprint==60.2
openpyxl==3.1.2
pytest==7.4.4
pytest-asyncio==0.23.3
httpx==0.26.0
python-dotenv==1.0.0
```

### 1.3 app/main.py
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import settings

app = FastAPI(
    title="DUWHITE Gestión",
    description="Sistema de Gestión Integral para Lavandería Industrial",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}
```

### 1.4 app/core/config.py
```python
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "DUWHITE Gestión"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]

    # Redis/Celery
    REDIS_URL: str = "redis://localhost:6379/0"

    class Config:
        env_file = ".env"


settings = Settings()
```

### 1.5 app/db/base.py
```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
```

### 1.6 app/core/deps.py
```python
from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.db.base import SessionLocal
from app.core.config import settings
from app.models.usuario import Usuario

security = HTTPBearer()


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_current_user(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Usuario:
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user or not user.activo:
        raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo")

    return user
```

---

## Paso 2: Frontend (React + Vite)

### 2.1 Crear proyecto
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

### 2.2 Dependencias
```bash
npm install @tanstack/react-query @tanstack/react-table zustand axios
npm install react-router-dom react-hook-form @hookform/resolvers zod
npm install recharts lucide-react date-fns
npm install tailwindcss postcss autoprefixer -D
npm install class-variance-authority clsx tailwind-merge
npx tailwindcss init -p
```

### 2.3 Instalar shadcn/ui
```bash
npx shadcn-ui@latest init
# Seguir wizard:
# - Style: Default
# - Base color: Slate
# - CSS variables: Yes
```

### 2.4 tailwind.config.js (colores DUWHITE)
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#00BCD4",
          hover: "#00959F",
        },
        sidebar: "#3D3D3D",
        background: "#F7F8FA",
        "text-primary": "#333333",
        "text-secondary": "#777777",
        border: "#E0E0E0",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### 2.5 Estructura de carpetas
```bash
mkdir -p src/{components/{ui,layout,shared},pages,services,stores,hooks,types,utils,constants,lib}
```

---

## Paso 3: Docker Compose

### docker-compose.yml
```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    container_name: duwhite_db
    environment:
      POSTGRES_USER: duwhite
      POSTGRES_PASSWORD: duwhite_secret
      POSTGRES_DB: duwhite_gestion
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    container_name: duwhite_redis
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    container_name: duwhite_backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    volumes:
      - ./backend:/app
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://duwhite:duwhite_secret@db:5432/duwhite_gestion
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis

  frontend:
    build: ./frontend
    container_name: duwhite_frontend
    command: npm run dev -- --host
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "5173:5173"

volumes:
  postgres_data:
```

---

## Paso 4: Variables de Entorno

### .env.example
```bash
# Backend
DATABASE_URL=postgresql://duwhite:duwhite_secret@localhost:5432/duwhite_gestion
SECRET_KEY=tu-clave-secreta-cambiar-en-produccion
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Redis/Celery
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=

# Frontend
VITE_API_URL=http://localhost:8000/api/v1
```

---

## Paso 5: Comandos de Inicio

```bash
# 1. Clonar y configurar
cp .env.example .env
# Editar .env con valores reales

# 2. Con Docker (recomendado)
docker-compose up -d

# 3. Sin Docker
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev

# 4. Crear migración inicial
cd backend
alembic revision --autogenerate -m "initial"
alembic upgrade head
```

---

## Ejemplo de uso
```
/setup-proyecto
```

Este comando te guiará para crear toda la estructura base del proyecto.
