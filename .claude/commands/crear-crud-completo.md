# Crear CRUD Completo

Crea un CRUD completo (backend + frontend) para una entidad del Sistema DUWHITE.

## Parámetros
- **$ARGUMENTS**: Nombre de la entidad (ej: "insumo", "proveedor", "cliente", "pedido")

## Instrucciones

Ejecuta en orden:

### 1. Backend

**Modelo** (`backend/app/models/{entidad}.py`):
```python
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.db.base import Base

class {Entidad}(Base):
    __tablename__ = "{entidad}s"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # ... campos específicos según esquema de BD
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

**Schema** (`backend/app/schemas/{entidad}.py`):
```python
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List

class {Entidad}Base(BaseModel):
    # campos comunes
    pass

class {Entidad}Create({Entidad}Base):
    pass

class {Entidad}Update(BaseModel):
    # todos opcionales
    pass

class {Entidad}Response({Entidad}Base):
    id: UUID
    activo: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

**Service** (`backend/app/services/{entidad}_service.py`):
- `obtener_todos()` con filtros y paginación
- `obtener_por_id()`
- `crear()`
- `actualizar()`
- `eliminar()` (soft delete)

**Endpoints** (`backend/app/api/v1/endpoints/{entidad}s.py`):
- GET `/api/v1/{entidad}s`
- GET `/api/v1/{entidad}s/{id}`
- POST `/api/v1/{entidad}s`
- PUT `/api/v1/{entidad}s/{id}`
- DELETE `/api/v1/{entidad}s/{id}`

### 2. Frontend

**Tipos** (`frontend/src/types/{entidad}.ts`)

**Servicio** (`frontend/src/services/{entidad}Service.ts`)

**Componentes**:
- `{Entidad}List.tsx` - Tabla con shadcn DataTable
- `{Entidad}Form.tsx` - Formulario con React Hook Form
- `{Entidad}Detail.tsx` - Vista detalle

**Páginas**:
- `/src/pages/{entidad}s/index.tsx`
- `/src/pages/{entidad}s/create.tsx`
- `/src/pages/{entidad}s/[id].tsx`

### 3. Migración y Tests

```bash
alembic revision --autogenerate -m "add {entidad} table"
alembic upgrade head
```

## Ejemplo de uso
```
/crear-crud-completo proveedor
```
