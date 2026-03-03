# Agent Instructions - Sistema de Gestión DUWHITE

## Contexto del Proyecto

Estás trabajando en un **Sistema de Gestión Integral para DUWHITE**, una lavandería industrial de Córdoba, Argentina con más de 18 años de trayectoria.

### Módulos del Sistema
- **Stock**: Control de insumos con alertas automáticas (stock bajo, vencimientos, sobrestock)
- **Proveedores**: Gestión de proveedores, catálogos, historial de precios, órdenes de compra
- **Producción**: Control del proceso productivo con etapas configurables, tablero Kanban, consumo de insumos
- **Clientes**: Panel de clientes con pedidos, estado en tiempo real, cuenta corriente
- **Listas de Precios**: Múltiples listas con asignación por cliente, precios especiales
- **Empleados**: Gestión de personal, control de asistencia, reportes de productividad
- **Finanzas**: Facturación A/B argentina, ingresos, egresos, flujo de caja
- **Costos**: Análisis de costos de producción, recomendaciones de precios
- **Actividades**: Gestión de tareas internas (vista lista, Kanban, calendario)
- **Dashboard**: Vista consolidada de la operación diaria
- **Reportes**: Centro de reportes con exportación PDF/Excel

### Usuarios y Roles
- **~25 usuarios**: superadmin, administrador, jefe_produccion, operador, comercial, contador, solo_lectura
- **Acceso**: Web responsive (desktop + mobile)

---

## Stack Tecnológico

### Backend
| Tecnología | Uso |
|------------|-----|
| Python 3.11+ | Lenguaje principal |
| FastAPI 0.104+ | Framework web |
| PostgreSQL 15+ | Base de datos |
| SQLAlchemy 2.0 | ORM |
| Alembic | Migraciones |
| Pydantic v2 | Validación |
| python-jose + passlib | JWT + Hashing |
| Celery + Redis | Tareas asíncronas |
| WeasyPrint | PDFs |
| Pytest | Testing |

### Frontend
| Tecnología | Uso |
|------------|-----|
| React 18 + TypeScript | Framework UI |
| Vite | Build tool |
| Tailwind CSS | Estilos |
| shadcn/ui + lucide-react | Componentes + Iconos |
| Zustand | State management |
| TanStack Query | Data fetching |
| React Hook Form + Zod | Formularios |
| TanStack Table | Tablas |
| React Router v6 | Enrutamiento |
| Recharts | Gráficos |

### Infraestructura
- Docker + Docker Compose
- Nginx (producción)
- Cloudflare (DNS + SSL)

---

## Paleta de Colores DUWHITE

```css
/* Colores principales */
--primary: #00BCD4;        /* Turquesa - botones, links, acentos */
--primary-hover: #00959F;  /* Turquesa oscuro - hover states */
--sidebar: #3D3D3D;        /* Gris oscuro - sidebar, header */
--background: #F7F8FA;     /* Gris claro - fondo contenido */
--text-primary: #333333;   /* Gris muy oscuro - textos */
--text-secondary: #777777; /* Gris medio - labels, placeholders */
--border: #E0E0E0;         /* Gris suave - bordes, divisores */

/* Estados */
--success: #22C55E;        /* Verde - confirmaciones */
--error: #EF4444;          /* Rojo - errores, alertas */
--warning: #F59E0B;        /* Ámbar - advertencias */
--info: #3B82F6;           /* Azul - información */
```

---

## Principios de Desarrollo

### Arquitectura Backend
- **Capas**: Endpoints → Services → Models
- **NUNCA** lógica de negocio en endpoints
- Dependency injection de FastAPI
- Validación Pydantic en todos los endpoints
- **Soft deletes** (campo `activo`, no eliminar registros)
- Transacciones de BD para operaciones críticas
- **Logs de auditoría** en TODAS las operaciones de escritura

### Arquitectura Frontend
- Componentes pequeños y reutilizables
- Custom hooks para lógica compartida
- Separación: `components/` → `pages/` → `services/` → `stores/`
- **TypeScript SIEMPRE**, nunca usar `any`
- Loading states y error handling en todas las operaciones
- **Responsive design** (mobile-first para vistas de operarios)

### Formato Argentino
```typescript
// Fechas: DD/MM/YYYY
const formatearFecha = (fecha: string) => new Date(fecha).toLocaleDateString('es-AR');

// Moneda: $ con separador de miles (punto) y decimales (coma)
const formatearMoneda = (monto: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(monto);

// CUIT: XX-XXXXXXXX-X
// Condiciones IVA: RI, Monotributo, CF, Exento
```

---

## Flujos Críticos del Sistema

### Pedido → Producción → Factura
1. Comercial crea pedido (precios desde lista del cliente)
2. Se genera orden de producción
3. Producción procesa por etapas (registra consumo de insumos)
4. Al completar → pedido pasa a "listo"
5. Se genera factura A o B (según condición IVA del cliente)
6. Factura genera movimiento en cuenta corriente

### Compra de Insumos
1. Alerta de stock bajo
2. Crear orden de compra al proveedor
3. Enviar OC por email
4. Registrar recepción → ingreso automático de stock
5. Actualización de precio del insumo

### Facturación A/B Argentina
- **Factura A**: Para Responsables Inscriptos → precios NETOS + IVA discriminado
- **Factura B**: Para CF/Monotributo/Exento → precios con IVA INCLUIDO
- Sistema elige automáticamente según `condicion_iva` del cliente

---

## Estructura de Archivos

### Backend (nuevo módulo)
```
backend/app/
├── models/{modulo}.py
├── schemas/{modulo}.py
├── services/{modulo}_service.py
├── api/v1/endpoints/{modulo}.py
└── tests/api/test_{modulo}.py
```

### Frontend (nuevo módulo)
```
frontend/src/
├── components/{modulo}/
│   ├── {Modulo}List.tsx
│   ├── {Modulo}Form.tsx
│   ├── {Modulo}Detail.tsx
│   └── index.ts
├── pages/{modulo}/
│   ├── index.tsx
│   ├── create.tsx
│   └── [id].tsx
├── services/{modulo}Service.ts
└── types/{modulo}.ts
```

---

## Convenciones de Código

### Python
```python
# Nombres descriptivos en español
def obtener_pedidos_por_cliente(cliente_id: UUID) -> List[PedidoSchema]:
    pass

# Type hints SIEMPRE
def crear_factura_desde_pedido(
    db: Session,
    pedido_id: UUID,
    usuario_id: UUID
) -> Factura:
    pass

# Docstrings para funciones públicas
def descontar_stock_insumo(
    db: Session,
    insumo_id: UUID,
    cantidad: Decimal,
    referencia_tipo: str,
    referencia_id: UUID,
    usuario_id: UUID
) -> None:
    """
    Descuenta stock de un insumo y crea movimiento.

    Raises:
        HTTPException 400: Si no hay stock suficiente
        HTTPException 404: Si el insumo no existe
    """
    pass
```

### TypeScript
```typescript
// Interfaces descriptivas
interface PedidoFormData {
  clienteId: string;
  fechaRetiro: string;
  fechaEntregaSolicitada: string;
  instruccionesEspeciales?: string;
  detalle: PedidoDetalleItem[];
}

// Nunca usar 'any'
// Siempre manejar loading y error states
```

---

## Seguridad (CRÍTICO)

- ✅ Validación de permisos en TODOS los endpoints
- ✅ Middleware de verificación de rol
- ✅ Passwords hasheados con bcrypt
- ✅ JWT con expiración (access: 30min, refresh: 7 días)
- ✅ Logs de todas las operaciones críticas
- ✅ Sanitización de inputs
- ✅ Rate limiting en login
- ✅ Soft deletes en todas las entidades

---

## Comandos Útiles

```bash
# Backend
cd backend && uvicorn app.main:app --reload --port 8000
alembic upgrade head
pytest tests/ -v

# Frontend
cd frontend && npm run dev
npm run build
npm run lint

# Docker
docker-compose up -d
docker-compose logs -f backend

# Celery
celery -A app.core.celery_app worker --loglevel=info
```

---

## Fases de Desarrollo

1. **Setup + Auth**: Estructura, Docker, FastAPI, React, JWT, Login
2. **Stock + Proveedores**: CRUD insumos, alertas, proveedores, OC
3. **Producción**: Etapas, órdenes, Kanban, consumo insumos
4. **Clientes + Pedidos**: CRUD, listas precios, cuenta corriente
5. **Finanzas**: Facturación A/B, PDF, flujo de caja
6. **Empleados**: CRUD, asistencia, actividades
7. **Costos + Reportes**: Análisis, dashboard, exportaciones
