# Crear Tests

Crea tests para el proyecto DUWHITE usando Pytest (backend) o Vitest (frontend).

## Parámetros
- **$ARGUMENTS**: Módulo o componente a testear (ej: "stock_service", "ClienteForm")

---

## Backend (Pytest)

### Estructura de Tests
```
backend/tests/
├── conftest.py           # Fixtures globales
├── api/
│   ├── test_auth.py
│   ├── test_stock.py
│   ├── test_clientes.py
│   └── ...
└── services/
    ├── test_stock_service.py
    ├── test_facturacion_service.py
    └── ...
```

### conftest.py
```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.base import Base
from app.core.deps import get_db

# Base de datos en memoria para tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """Crea una base de datos limpia para cada test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    """Cliente de test con base de datos inyectada."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client, db):
    """Headers de autenticación para tests."""
    # Crear usuario de test
    from app.models.usuario import Usuario
    from app.core.security import get_password_hash, create_access_token

    user = Usuario(
        email="test@duwhite.com",
        password_hash=get_password_hash("test123"),
        nombre="Test",
        apellido="User",
        rol="superadmin",
        activo=True,
    )
    db.add(user)
    db.commit()

    token = create_access_token(data={"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}
```

### Test de Endpoint
```python
# tests/api/test_stock.py

import pytest
from uuid import uuid4


class TestStockEndpoints:
    """Tests para endpoints de stock."""

    def test_listar_insumos_sin_auth(self, client):
        """Debe requerir autenticación."""
        response = client.get("/api/v1/stock/insumos")
        assert response.status_code == 403

    def test_listar_insumos(self, client, auth_headers, db):
        """Debe listar insumos correctamente."""
        # Arrange: crear insumos de test
        from app.models.insumo import Insumo
        insumo = Insumo(
            codigo="INS-001",
            nombre="Detergente Industrial",
            unidad="litros",
            stock_actual=100,
        )
        db.add(insumo)
        db.commit()

        # Act
        response = client.get("/api/v1/stock/insumos", headers=auth_headers)

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["codigo"] == "INS-001"

    def test_crear_insumo(self, client, auth_headers):
        """Debe crear un insumo correctamente."""
        payload = {
            "codigo": "INS-002",
            "nombre": "Suavizante",
            "unidad": "litros",
            "stock_actual": 50,
            "stock_minimo": 10,
        }

        response = client.post(
            "/api/v1/stock/insumos",
            json=payload,
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["codigo"] == "INS-002"
        assert data["id"] is not None

    def test_crear_insumo_duplicado(self, client, auth_headers, db):
        """Debe rechazar código duplicado."""
        from app.models.insumo import Insumo
        insumo = Insumo(codigo="INS-001", nombre="Existente", unidad="kg")
        db.add(insumo)
        db.commit()

        payload = {"codigo": "INS-001", "nombre": "Nuevo", "unidad": "litros"}
        response = client.post(
            "/api/v1/stock/insumos",
            json=payload,
            headers=auth_headers,
        )

        assert response.status_code == 400
        assert "código ya existe" in response.json()["detail"].lower()


class TestStockBajo:
    """Tests para alertas de stock bajo."""

    def test_obtener_insumos_bajo_stock(self, client, auth_headers, db):
        """Debe listar insumos con stock bajo."""
        from app.models.insumo import Insumo

        # Insumo con stock bajo
        insumo_bajo = Insumo(
            codigo="INS-001",
            nombre="Bajo Stock",
            unidad="litros",
            stock_actual=5,
            stock_minimo=10,
        )
        # Insumo con stock OK
        insumo_ok = Insumo(
            codigo="INS-002",
            nombre="Stock OK",
            unidad="litros",
            stock_actual=50,
            stock_minimo=10,
        )
        db.add_all([insumo_bajo, insumo_ok])
        db.commit()

        response = client.get("/api/v1/stock/insumos/bajo-stock", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["codigo"] == "INS-001"
```

### Test de Servicio
```python
# tests/services/test_stock_service.py

import pytest
from decimal import Decimal
from uuid import uuid4

from app.services.stock_service import stock_service
from app.models.insumo import Insumo


class TestStockService:
    """Tests para el servicio de stock."""

    def test_descontar_stock(self, db):
        """Debe descontar stock correctamente."""
        # Arrange
        insumo = Insumo(
            codigo="INS-001",
            nombre="Test",
            unidad="litros",
            stock_actual=Decimal("100"),
            precio_unitario_costo=Decimal("50.00"),
        )
        db.add(insumo)
        db.commit()

        usuario_id = uuid4()

        # Act
        stock_service.descontar_stock(
            db=db,
            insumo_id=insumo.id,
            cantidad=Decimal("30"),
            tipo_movimiento="egreso_produccion",
            referencia_tipo="orden_produccion",
            referencia_id=uuid4(),
            usuario_id=usuario_id,
        )

        # Assert
        db.refresh(insumo)
        assert insumo.stock_actual == Decimal("70")

    def test_descontar_stock_insuficiente(self, db):
        """Debe lanzar error si no hay stock suficiente."""
        insumo = Insumo(
            codigo="INS-001",
            nombre="Test",
            unidad="litros",
            stock_actual=Decimal("10"),
        )
        db.add(insumo)
        db.commit()

        with pytest.raises(Exception) as exc_info:
            stock_service.descontar_stock(
                db=db,
                insumo_id=insumo.id,
                cantidad=Decimal("50"),
                tipo_movimiento="egreso_produccion",
                referencia_tipo="test",
                referencia_id=uuid4(),
                usuario_id=uuid4(),
            )

        assert "stock insuficiente" in str(exc_info.value).lower()
```

---

## Frontend (Vitest)

### Setup
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Test de Componente
```typescript
// src/components/clientes/__tests__/ClienteForm.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import { ClienteForm } from '../ClienteForm';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>{children}</BrowserRouter>
  </QueryClientProvider>
);

describe('ClienteForm', () => {
  it('renderiza el formulario correctamente', () => {
    render(<ClienteForm mode="create" />, { wrapper });

    expect(screen.getByLabelText(/razón social/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cuit/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear/i })).toBeInTheDocument();
  });

  it('muestra errores de validación', async () => {
    render(<ClienteForm mode="create" />, { wrapper });

    const submitButton = screen.getByRole('button', { name: /crear/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/razón social es requerida/i)).toBeInTheDocument();
    });
  });

  it('formatea CUIT correctamente', async () => {
    render(<ClienteForm mode="create" />, { wrapper });

    const cuitInput = screen.getByLabelText(/cuit/i);
    await userEvent.type(cuitInput, '20123456789');

    expect(cuitInput).toHaveValue('20-12345678-9');
  });
});
```

---

## Comandos para Ejecutar Tests

```bash
# Backend
cd backend
pytest                          # Todos los tests
pytest tests/api/ -v            # Solo tests de API
pytest -k "stock" -v            # Tests que contengan "stock"
pytest --cov=app tests/         # Con cobertura

# Frontend
cd frontend
npm run test                    # Todos los tests
npm run test -- --coverage      # Con cobertura
npm run test -- ClienteForm     # Test específico
```

## Ejemplo de uso
```
/crear-test stock_service
/crear-test ClienteForm
```
