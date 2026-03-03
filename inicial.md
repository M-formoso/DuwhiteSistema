# Sistema de Gestión DUWHITE - Documentación Técnica Completa

---

## 📋 Información del Proyecto

| Campo | Detalle |
|-------|---------|
| **Nombre** | Sistema de Gestión Integral DUWHITE |
| **Versión** | 1.0.0 |
| **Cliente** | DUWHITE - Lavandería Industrial (Córdoba, Argentina) |
| **Usuarios estimados** | ~25 (administradores + operadores + empleados) |
| **Tipo** | Sistema ERP de gestión operativa, producción, finanzas y clientes |
| **Entorno** | Web responsive (desktop + mobile) |

---

## 🎨 Identidad Visual / Paleta de Colores

Basada en la identidad de marca de DUWHITE:

| Elemento | Color | Hex | Uso |
|----------|-------|-----|-----|
| Sidebar / Header | Gris oscuro | `#3D3D3D` | Navegación principal, barras superiores |
| Primario / Acento | Turquesa | `#00BCD4` | Botones principales, links, badges activos, iconos destacados |
| Hover primario | Turquesa oscuro | `#00959F` | Estados hover de botones y links |
| Fondo contenido | Gris claro | `#F7F8FA` | Background de áreas de contenido |
| Texto principal | Gris muy oscuro | `#333333` | Textos body, títulos |
| Texto secundario | Gris medio | `#777777` | Labels, placeholders, textos de ayuda |
| Bordes / Divisores | Gris suave | `#E0E0E0` | Separadores, bordes de cards y tablas |
| Éxito | Verde | `#22C55E` | Confirmaciones, estados positivos |
| Error / Peligro | Rojo | `#EF4444` | Errores, eliminaciones, alertas críticas |
| Warning | Ámbar | `#F59E0B` | Advertencias, stock bajo |
| Info | Azul | `#3B82F6` | Información, notificaciones |

---

## 🛠️ Stack Tecnológico

### Backend

| Tecnología | Versión | Uso |
|------------|---------|-----|
| FastAPI | 0.104+ | Framework web principal |
| Python | 3.11+ | Lenguaje backend |
| SQLAlchemy | 2.0 | ORM |
| Alembic | Latest | Migraciones de BD |
| Pydantic | v2 | Validación de datos |
| python-jose + passlib | Latest | JWT + Hashing passwords |
| PostgreSQL | 15+ | Base de datos relacional |
| Celery + Redis | Latest | Tareas asíncronas (alertas, reportes) |
| WeasyPrint | Latest | Generación de PDFs (facturas, remitos, reportes) |
| openpyxl | Latest | Exportación a Excel |
| Pytest + pytest-asyncio | Latest | Testing |

### Frontend

| Tecnología | Versión | Uso |
|------------|---------|-----|
| React | 18+ | Framework UI |
| Vite | Latest | Build tool |
| TypeScript | 5+ | Tipado estático |
| Tailwind CSS | 3+ | Estilos utilitarios |
| shadcn/ui + lucide-react | Latest | Componentes UI + Iconos |
| Zustand | Latest | State management global |
| TanStack Query | Latest | Data fetching + cache |
| React Hook Form + Zod | Latest | Formularios + validación |
| TanStack Table | Latest | Tablas con filtros, paginación, sorting |
| React Router | v6 | Enrutamiento |
| Axios | Latest | HTTP client |
| Recharts | Latest | Gráficos y reportes visuales |
| react-to-print | Latest | Impresión de facturas/remitos |

### Infraestructura

| Tecnología | Uso |
|------------|-----|
| Docker + Docker Compose | Containerización |
| Nginx | Proxy reverso (producción) |
| Railway / DigitalOcean | Deploy VPS |
| Cloudflare | DNS + SSL |
| Sentry | Monitoreo de errores |
| GitHub Actions | CI/CD (opcional) |

### Desarrollo

| Herramienta | Uso |
|-------------|-----|
| Ruff | Linting Python |
| Black | Formatting Python |
| ESLint | Linting TypeScript |
| Prettier | Formatting TypeScript |
| husky + lint-staged | Pre-commit hooks |
| Git + GitHub | Control de versiones |

---

## 📁 Estructura del Proyecto (Monorepo)

```
duwhite-gestion/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui components
│   │   │   ├── layout/             # Header, Sidebar, Footer, Breadcrumbs
│   │   │   ├── dashboard/          # Widgets del dashboard
│   │   │   ├── stock/              # Componentes módulo stock
│   │   │   ├── proveedores/        # Componentes módulo proveedores
│   │   │   ├── produccion/         # Componentes módulo producción
│   │   │   ├── clientes/           # Componentes módulo clientes
│   │   │   ├── listas-precios/     # Componentes listas de precios
│   │   │   ├── empleados/          # Componentes módulo empleados
│   │   │   ├── finanzas/           # Componentes módulo finanzas
│   │   │   ├── facturacion/        # Componentes facturación A/B
│   │   │   ├── costos/            # Componentes módulo costos
│   │   │   ├── actividades/        # Componentes módulo actividades
│   │   │   ├── reportes/           # Componentes reportes y estadísticas
│   │   │   └── shared/             # Componentes compartidos
│   │   ├── pages/
│   │   │   ├── auth/               # Login, recuperar contraseña
│   │   │   ├── dashboard/          # Dashboard principal
│   │   │   ├── stock/              # CRUD stock y alertas
│   │   │   ├── proveedores/        # CRUD proveedores, productos, precios
│   │   │   ├── produccion/         # Gestión proceso productivo
│   │   │   ├── clientes/           # Panel clientes + cuenta corriente
│   │   │   ├── listas-precios/     # ABM listas de precios
│   │   │   ├── empleados/          # Gestión empleados + reportes
│   │   │   ├── finanzas/           # Finanzas, facturación, A/B
│   │   │   ├── costos/            # Análisis costos + recomendaciones
│   │   │   ├── actividades/        # Gestión de actividades
│   │   │   ├── reportes/           # Reportes generales
│   │   │   └── configuracion/      # Settings del sistema
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── services/               # API calls (Axios)
│   │   ├── stores/                 # Zustand stores
│   │   ├── types/                  # TypeScript interfaces y types
│   │   ├── utils/                  # Utilidades (formateo AR, cálculos)
│   │   ├── constants/              # Constantes del sistema
│   │   └── lib/                    # Config shadcn/ui
│   ├── public/
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── endpoints/
│   │   │   │   │   ├── auth.py
│   │   │   │   │   ├── usuarios.py
│   │   │   │   │   ├── stock.py
│   │   │   │   │   ├── proveedores.py
│   │   │   │   │   ├── productos.py
│   │   │   │   │   ├── produccion.py
│   │   │   │   │   ├── ordenes_produccion.py
│   │   │   │   │   ├── clientes.py
│   │   │   │   │   ├── cuenta_corriente.py
│   │   │   │   │   ├── pedidos.py
│   │   │   │   │   ├── listas_precios.py
│   │   │   │   │   ├── empleados.py
│   │   │   │   │   ├── finanzas.py
│   │   │   │   │   ├── facturacion.py
│   │   │   │   │   ├── costos.py
│   │   │   │   │   ├── actividades.py
│   │   │   │   │   ├── reportes.py
│   │   │   │   │   ├── dashboard.py
│   │   │   │   │   └── configuracion.py
│   │   │   │   └── api.py          # Router principal
│   │   ├── core/
│   │   │   ├── config.py           # Settings con Pydantic
│   │   │   ├── security.py         # JWT, hashing
│   │   │   ├── deps.py             # Dependencies FastAPI
│   │   │   ├── permissions.py      # Sistema de permisos por rol
│   │   │   └── celery_app.py       # Celery config
│   │   ├── db/
│   │   │   ├── base.py             # Base SQLAlchemy
│   │   │   ├── session.py          # DB session
│   │   │   └── init_db.py          # Datos iniciales / seeds
│   │   ├── models/
│   │   │   ├── base.py             # Base model (timestamps, soft delete)
│   │   │   ├── usuario.py
│   │   │   ├── insumo.py           # Stock / insumos
│   │   │   ├── movimiento_stock.py
│   │   │   ├── proveedor.py
│   │   │   ├── producto_proveedor.py
│   │   │   ├── orden_compra.py
│   │   │   ├── produccion.py       # Orden de producción
│   │   │   ├── etapa_produccion.py
│   │   │   ├── cliente.py
│   │   │   ├── pedido.py
│   │   │   ├── cuenta_corriente.py
│   │   │   ├── lista_precios.py
│   │   │   ├── lista_precios_item.py
│   │   │   ├── empleado.py
│   │   │   ├── asistencia.py
│   │   │   ├── factura.py
│   │   │   ├── factura_detalle.py
│   │   │   ├── movimiento_financiero.py
│   │   │   ├── costo_produccion.py
│   │   │   ├── actividad.py
│   │   │   ├── alerta.py
│   │   │   └── configuracion.py
│   │   ├── schemas/
│   │   │   ├── usuario.py
│   │   │   ├── insumo.py
│   │   │   ├── proveedor.py
│   │   │   ├── produccion.py
│   │   │   ├── cliente.py
│   │   │   ├── pedido.py
│   │   │   ├── cuenta_corriente.py
│   │   │   ├── lista_precios.py
│   │   │   ├── empleado.py
│   │   │   ├── factura.py
│   │   │   ├── finanzas.py
│   │   │   ├── costo.py
│   │   │   ├── actividad.py
│   │   │   ├── reporte.py
│   │   │   └── common.py           # Schemas compartidos (paginación, filtros)
│   │   ├── services/
│   │   │   ├── auth_service.py
│   │   │   ├── usuario_service.py
│   │   │   ├── stock_service.py
│   │   │   ├── proveedor_service.py
│   │   │   ├── produccion_service.py
│   │   │   ├── cliente_service.py
│   │   │   ├── pedido_service.py
│   │   │   ├── cuenta_corriente_service.py
│   │   │   ├── lista_precios_service.py
│   │   │   ├── empleado_service.py
│   │   │   ├── facturacion_service.py
│   │   │   ├── finanzas_service.py
│   │   │   ├── costo_service.py
│   │   │   ├── actividad_service.py
│   │   │   ├── reporte_service.py
│   │   │   └── dashboard_service.py
│   │   ├── tasks/                   # Celery tasks
│   │   │   ├── alertas.py           # Alertas de stock, vencimientos
│   │   │   ├── reportes.py          # Generación de reportes pesados
│   │   │   ├── costos.py            # Cálculo de costos de producción
│   │   │   └── recordatorios.py     # Recordatorios de actividades
│   │   ├── utils/
│   │   │   ├── validators.py
│   │   │   ├── helpers.py
│   │   │   ├── formatters.py        # Formato argentino
│   │   │   └── calculators.py       # Cálculos de costos, márgenes
│   │   └── main.py                  # App FastAPI
│   ├── alembic/
│   │   ├── versions/
│   │   └── env.py
│   ├── tests/
│   │   ├── api/
│   │   ├── services/
│   │   └── conftest.py
│   ├── .env.example
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   └── pyproject.toml
│
├── docs/
│   ├── agent.md                     # Instrucciones para Claude Code
│   ├── skills/
│   │   ├── fastapi-crud.md
│   │   ├── react-forms.md
│   │   ├── database-design.md
│   │   ├── auth-flow.md
│   │   ├── facturacion-ab.md        # Skill: Facturación A/B argentina
│   │   └── docker-setup.md
│   ├── api-documentation.md
│   ├── database-schema.md
│   └── deployment.md
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── .gitignore
├── README.md
└── LICENSE
```

---

## 🗂️ Módulos del Sistema

---

### 1. Autenticación y Usuarios del Sistema

**Descripción:** Sistema completo de autenticación, gestión de usuarios y control de acceso basado en roles.

#### 1.1 Roles del Sistema

| Rol | Descripción | Nivel de Acceso |
|-----|-------------|-----------------|
| `superadmin` | Dueño / Gerente general | Acceso total sin restricciones. Puede gestionar otros admins. |
| `administrador` | Encargado administrativo | Acceso total a módulos operativos, clientes, finanzas. No puede gestionar superadmins. |
| `jefe_produccion` | Responsable de planta | Acceso a producción, stock, empleados asignados. Vista de costos. |
| `operador` | Empleado operativo | Acceso a producción (registrar etapas), stock (consultar), actividades asignadas. |
| `comercial` | Vendedor / Atención al cliente | Acceso a clientes, pedidos, listas de precios, cuenta corriente (consulta). |
| `contador` | Contable / Financiero | Acceso a finanzas, facturación, reportes financieros, costos. |
| `solo_lectura` | Auditor / Consultor | Puede ver todos los módulos pero no puede crear, editar ni eliminar nada. |

#### 1.2 Funcionalidades

- ✅ Login con JWT (access token 30 min + refresh token 7 días)
- ✅ Recuperación de contraseña por email
- ✅ Cambio de contraseña (requiere contraseña actual)
- ✅ Forzar cambio de contraseña en primer login
- ✅ CRUD de usuarios (solo superadmin/admin)
- ✅ Asignación de roles y permisos
- ✅ Activar / Desactivar usuarios (soft delete)
- ✅ Foto de perfil
- ✅ Registro de último acceso
- ✅ Log de actividad de usuario (auditoría)
- ✅ Sesiones activas (permite cerrar sesión remota)

#### 1.3 Permisos por Módulo

| Módulo | superadmin | admin | jefe_prod | operador | comercial | contador | solo_lectura |
|--------|-----------|-------|-----------|----------|-----------|----------|-------------|
| Usuarios | CRUD | CRUD* | ❌ | ❌ | ❌ | ❌ | Ver |
| Stock | CRUD | CRUD | CRUD | Ver | Ver | Ver | Ver |
| Proveedores | CRUD | CRUD | Ver | ❌ | Ver | CRUD | Ver |
| Producción | CRUD | CRUD | CRUD | Registrar | ❌ | Ver | Ver |
| Clientes | CRUD | CRUD | Ver | ❌ | CRUD | Ver | Ver |
| Pedidos | CRUD | CRUD | Ver | ❌ | CRUD | Ver | Ver |
| Cta. Corriente | CRUD | CRUD | ❌ | ❌ | Ver | CRUD | Ver |
| Listas Precios | CRUD | CRUD | Ver | ❌ | Ver | CRUD | Ver |
| Empleados | CRUD | CRUD | Ver equipo | ❌ | ❌ | Ver | Ver |
| Finanzas | CRUD | CRUD | ❌ | ❌ | ❌ | CRUD | Ver |
| Facturación | CRUD | CRUD | ❌ | ❌ | ❌ | CRUD | Ver |
| Costos | CRUD | CRUD | Ver | ❌ | ❌ | CRUD | Ver |
| Actividades | CRUD | CRUD | CRUD equipo | Propias | Propias | Propias | Ver |
| Reportes | Todos | Todos | Producción | ❌ | Comerciales | Financieros | Todos |
| Config | CRUD | CRUD | ❌ | ❌ | ❌ | ❌ | ❌ |

*\*CRUD excepto gestión de superadmins*

#### 1.4 Endpoints

```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
GET    /api/v1/auth/me
PUT    /api/v1/auth/change-password

GET    /api/v1/usuarios
POST   /api/v1/usuarios
GET    /api/v1/usuarios/{id}
PUT    /api/v1/usuarios/{id}
DELETE /api/v1/usuarios/{id}
PUT    /api/v1/usuarios/{id}/toggle-activo
GET    /api/v1/usuarios/{id}/actividad
```

---

### 2. Control de Stock y Alertas

**Descripción:** Gestión completa de insumos, materiales y productos necesarios para el proceso de lavado industrial. Control de inventario con alertas automáticas.

#### 2.1 Inventario de Insumos

**Funcionalidades:**

- ✅ CRUD completo de insumos/materiales
- ✅ Datos: Nombre, código interno, código de barras (opcional), categoría, subcategoría
- ✅ Unidad de medida (litros, kg, unidades, metros, etc.)
- ✅ Stock actual, stock mínimo, stock máximo (óptimo)
- ✅ Precio unitario de costo (último precio de compra)
- ✅ Precio promedio ponderado
- ✅ Proveedor habitual asociado
- ✅ Ubicación en depósito (estante/sector)
- ✅ Fecha de vencimiento (para insumos químicos)
- ✅ Foto del insumo
- ✅ Estado: Activo / Discontinuado
- ✅ Notas/observaciones

#### 2.2 Categorías de Insumos

Categorías predefinidas (configurables):

- Productos químicos de lavado (detergentes, suavizantes, blanqueadores, etc.)
- Productos de limpieza especial (desmanchadores, solventes)
- Envases y embalaje (bolsas, film, perchas, fundas)
- Repuestos de maquinaria (correas, rodamientos, filtros, bombas)
- Materiales de consumo (etiquetas, tags, cintas)
- Combustible / Energía (gas, gasoil si aplica)
- Otros

#### 2.3 Movimientos de Stock

**Tipos de movimiento:**

| Tipo | Descripción | Efecto |
|------|-------------|--------|
| `ingreso_compra` | Compra a proveedor | +Stock |
| `ingreso_devolucion` | Devolución de producción | +Stock |
| `ingreso_ajuste` | Ajuste manual positivo | +Stock |
| `egreso_produccion` | Consumo en producción | -Stock |
| `egreso_merma` | Pérdida, rotura, vencimiento | -Stock |
| `egreso_ajuste` | Ajuste manual negativo | -Stock |
| `transferencia` | Mover entre ubicaciones | Neutro |

**Cada movimiento registra:**
- Fecha y hora
- Insumo afectado
- Tipo de movimiento
- Cantidad
- Stock anterior → Stock resultante
- Referencia (orden de compra, orden de producción, etc.)
- Usuario que registró
- Observaciones

#### 2.4 Alertas de Stock

**Alertas automáticas (vía Celery):**

- 🔴 **Crítico:** Stock actual = 0 (sin stock)
- 🟡 **Bajo:** Stock actual ≤ Stock mínimo
- 🟠 **Próximo a vencer:** Insumo vence en los próximos 30 días
- 🔵 **Sobrestock:** Stock actual > Stock máximo (capital inmovilizado)

**Configuración de alertas:**
- Notificación en dashboard (badge con cantidad)
- Notificación push en navegador (opcional)
- Email automático a responsables de compras
- Frecuencia configurable: tiempo real / diaria / semanal

#### 2.5 Endpoints

```
GET    /api/v1/stock/insumos
POST   /api/v1/stock/insumos
GET    /api/v1/stock/insumos/{id}
PUT    /api/v1/stock/insumos/{id}
DELETE /api/v1/stock/insumos/{id}

GET    /api/v1/stock/insumos/alertas
GET    /api/v1/stock/insumos/bajo-stock
GET    /api/v1/stock/insumos/por-vencer
GET    /api/v1/stock/insumos/sobrestock
GET    /api/v1/stock/insumos/{id}/movimientos

POST   /api/v1/stock/movimientos
GET    /api/v1/stock/movimientos
GET    /api/v1/stock/movimientos/{id}

GET    /api/v1/stock/categorias
POST   /api/v1/stock/categorias
PUT    /api/v1/stock/categorias/{id}
DELETE /api/v1/stock/categorias/{id}

GET    /api/v1/stock/resumen
GET    /api/v1/stock/valorizado
```

---

### 3. Control de Proveedores, Productos y Precios

**Descripción:** Gestión de proveedores, sus productos/servicios y el historial de precios para optimizar compras.

#### 3.1 Proveedores

**Funcionalidades:**

- ✅ CRUD completo de proveedores
- ✅ Datos obligatorios: Razón social, CUIT, tipo (Responsable Inscripto, Monotributista, etc.)
- ✅ Datos de contacto: Teléfono, email, dirección, ciudad, provincia
- ✅ Persona de contacto (nombre + teléfono directo)
- ✅ Rubro/categoría del proveedor (químicos, maquinaria, packaging, servicios, etc.)
- ✅ Condición de pago habitual (contado, 30 días, 60 días, cheque, transferencia)
- ✅ Cuenta bancaria (CBU/Alias) para transferencias
- ✅ Calificación del proveedor (1-5 estrellas basado en historial)
- ✅ Notas internas
- ✅ Estado: Activo / Inactivo / Bloqueado
- ✅ Historial de compras
- ✅ Saldo pendiente de pago

#### 3.2 Productos del Proveedor (Catálogo)

**Funcionalidades:**

- ✅ Cada proveedor tiene su catálogo de productos
- ✅ Relación: Proveedor → Producto → Insumo del sistema
- ✅ Nombre del producto (como lo llama el proveedor)
- ✅ Código del proveedor
- ✅ Mapeo a insumo interno del sistema
- ✅ Unidad de venta (bidon 20L, bolsa 25kg, etc.)
- ✅ Factor de conversión a unidad interna
- ✅ Precio actual
- ✅ Moneda (ARS / USD)
- ✅ Fecha de última actualización de precio
- ✅ Tiempo de entrega estimado (días)
- ✅ Pedido mínimo

#### 3.3 Historial de Precios

**Funcionalidades:**

- ✅ Registro automático cada vez que se actualiza un precio
- ✅ Fecha del cambio
- ✅ Precio anterior → Precio nuevo
- ✅ Variación porcentual
- ✅ Gráfico de evolución de precio por producto
- ✅ Comparativa de precios entre proveedores para el mismo insumo
- ✅ Alerta cuando un proveedor sube precio más del X% configurable

#### 3.4 Órdenes de Compra

**Funcionalidades:**

- ✅ Crear orden de compra a proveedor
- ✅ Selección de productos del catálogo del proveedor
- ✅ Cantidades y precios acordados
- ✅ Condición de pago
- ✅ Fecha estimada de entrega
- ✅ Estados: Borrador → Enviada → Parcialmente recibida → Recibida → Cancelada
- ✅ Recepción parcial (se puede recibir parte del pedido)
- ✅ Al recibir: ingreso automático de stock + movimiento de stock
- ✅ Generar PDF de orden de compra
- ✅ Enviar por email al proveedor
- ✅ Historial de órdenes por proveedor

#### 3.5 Endpoints

```
GET    /api/v1/proveedores
POST   /api/v1/proveedores
GET    /api/v1/proveedores/{id}
PUT    /api/v1/proveedores/{id}
DELETE /api/v1/proveedores/{id}
GET    /api/v1/proveedores/{id}/productos
GET    /api/v1/proveedores/{id}/historial-compras
GET    /api/v1/proveedores/{id}/saldo

GET    /api/v1/proveedores/{id}/catalogo
POST   /api/v1/proveedores/{id}/catalogo
PUT    /api/v1/proveedores/{id}/catalogo/{producto_id}
DELETE /api/v1/proveedores/{id}/catalogo/{producto_id}
GET    /api/v1/proveedores/{id}/catalogo/{producto_id}/historial-precios

GET    /api/v1/compras/ordenes
POST   /api/v1/compras/ordenes
GET    /api/v1/compras/ordenes/{id}
PUT    /api/v1/compras/ordenes/{id}
DELETE /api/v1/compras/ordenes/{id}
POST   /api/v1/compras/ordenes/{id}/enviar
POST   /api/v1/compras/ordenes/{id}/recibir
GET    /api/v1/compras/ordenes/{id}/pdf

GET    /api/v1/compras/comparar-precios?insumo_id={id}
```

---

### 4. Control del Proceso de Producción

**Descripción:** Gestión integral de todo el proceso productivo de lavado industrial, desde la recepción de la ropa sucia hasta la entrega al cliente.

#### 4.1 Etapas del Proceso Productivo

El flujo completo de producción configurable (etapas por defecto):

| # | Etapa | Descripción |
|---|-------|-------------|
| 1 | **Recepción** | Ingreso de ropa sucia. Pesaje, clasificación, conteo de prendas |
| 2 | **Clasificación** | Separación por tipo de tela, color, nivel de suciedad, tipo de lavado |
| 3 | **Lavado** | Proceso de lavado en máquinas. Diferentes programas según tipo |
| 4 | **Secado** | Proceso de secado en secadoras industriales |
| 5 | **Planchado** | Planchado industrial (calandras, planchas manuales) |
| 6 | **Doblado / Embalaje** | Doblado, embolsado, etiquetado |
| 7 | **Control de Calidad** | Inspección final. Verificación de manchas, daños, olor |
| 8 | **Despacho** | Preparación para entrega. Asignación a ruta/transporte |
| 9 | **Entregado** | Confirmación de entrega al cliente |

#### 4.2 Órdenes de Producción

**Funcionalidades:**

- ✅ Crear orden de producción (puede generarse desde un pedido de cliente)
- ✅ Número de orden autoincremental con prefijo configurable (ej: OP-2026-0001)
- ✅ Cliente asociado
- ✅ Pedido asociado (opcional)
- ✅ Fecha de ingreso y fecha de entrega prometida
- ✅ Prioridad: Normal / Urgente / Express
- ✅ Detalle de prendas/kilos:
  - Tipo de prenda (sábanas, toallas, uniformes, manteles, etc.)
  - Cantidad de prendas
  - Peso total (kg)
  - Tipo de lavado requerido (estándar, delicado, industrial pesado, etc.)
  - Instrucciones especiales (temperatura, productos prohibidos, etc.)
- ✅ Estado general: Pendiente → En proceso → Completada → Entregada → Cancelada
- ✅ Estado por etapa: cada etapa tiene su estado individual
- ✅ Asignación de empleados por etapa
- ✅ Registro de tiempo por etapa (inicio/fin)
- ✅ Consumo de insumos por orden (descuento automático de stock)
- ✅ Registro de incidencias (prenda dañada, manchas que no salen, etc.)
- ✅ Fotos de evidencia (antes/después si aplica)
- ✅ Observaciones por etapa

#### 4.3 Registro de Producción (Operario)

**Vista simplificada para el operador:**

- ✅ Ver órdenes asignadas a su etapa
- ✅ Iniciar etapa (registra fecha/hora inicio)
- ✅ Finalizar etapa (registra fecha/hora fin)
- ✅ Marcar incidencias
- ✅ Registrar consumo de insumos en la etapa
- ✅ Pasar a siguiente etapa automáticamente
- ✅ Vista mobile-friendly para uso en planta

#### 4.4 Tablero Kanban de Producción

**Vista visual tipo Kanban:**

- ✅ Columnas = Etapas del proceso
- ✅ Cards = Órdenes de producción
- ✅ Color por prioridad (verde=normal, amarillo=urgente, rojo=express)
- ✅ Drag & drop para mover entre etapas
- ✅ Filtros: por cliente, por prioridad, por fecha
- ✅ Indicador de tiempo en cada etapa
- ✅ Alerta visual cuando una orden está retrasada

#### 4.5 Consumo de Insumos por Producción

**Funcionalidades:**

- ✅ Al procesar una orden, registrar insumos consumidos
- ✅ Selección de insumo + cantidad
- ✅ Descuento automático de stock
- ✅ Registro de movimiento de stock (tipo: egreso_produccion)
- ✅ Cálculo de costo de insumos por orden
- ✅ Base para cálculo de costo de producción

#### 4.6 Endpoints

```
GET    /api/v1/produccion/ordenes
POST   /api/v1/produccion/ordenes
GET    /api/v1/produccion/ordenes/{id}
PUT    /api/v1/produccion/ordenes/{id}
DELETE /api/v1/produccion/ordenes/{id}

GET    /api/v1/produccion/ordenes/{id}/etapas
POST   /api/v1/produccion/ordenes/{id}/etapas/{etapa_id}/iniciar
POST   /api/v1/produccion/ordenes/{id}/etapas/{etapa_id}/finalizar
POST   /api/v1/produccion/ordenes/{id}/etapas/{etapa_id}/incidencia

POST   /api/v1/produccion/ordenes/{id}/consumir-insumo
GET    /api/v1/produccion/ordenes/{id}/insumos-consumidos
GET    /api/v1/produccion/ordenes/{id}/costo

GET    /api/v1/produccion/kanban
GET    /api/v1/produccion/ordenes/por-cliente/{cliente_id}
GET    /api/v1/produccion/ordenes/retrasadas
GET    /api/v1/produccion/ordenes/por-etapa/{etapa}

GET    /api/v1/produccion/etapas-config
POST   /api/v1/produccion/etapas-config
PUT    /api/v1/produccion/etapas-config/{id}
DELETE /api/v1/produccion/etapas-config/{id}
```

---

### 5. Panel de Clientes, Pedidos y Cuenta Corriente

**Descripción:** Gestión completa de clientes, sus pedidos, estado de cada pedido, y sistema de cuenta corriente con saldos.

#### 5.1 Gestión de Clientes

**Funcionalidades:**

- ✅ CRUD completo de clientes
- ✅ Tipos de cliente: Empresa / Particular
- ✅ Datos fiscales: Razón social, CUIT/CUIL/DNI, Condición IVA (RI, Monotributo, Consumidor Final, Exento)
- ✅ Datos de contacto: Teléfono, email, dirección, ciudad, provincia
- ✅ Persona de contacto (para empresas)
- ✅ Dirección de retiro (donde se busca la ropa)
- ✅ Dirección de entrega (donde se devuelve, puede ser diferente)
- ✅ Frecuencia de servicio: Diario / Semanal / Quincenal / A demanda
- ✅ Día(s) de retiro y día(s) de entrega habituales
- ✅ Lista de precios asignada
- ✅ Condición de pago: Contado / 15 días / 30 días / 60 días
- ✅ Límite de crédito
- ✅ Descuento general (%)
- ✅ Estado: Activo / Suspendido (por deuda) / Inactivo
- ✅ Notas internas
- ✅ Saldo de cuenta corriente (calculado)
- ✅ Historial de pedidos
- ✅ Historial de facturas
- ✅ Historial de pagos
- ✅ Calificación / Categoría: A (premium), B (regular), C (ocasional)

#### 5.2 Gestión de Pedidos

**Funcionalidades:**

- ✅ Crear pedido (puede convertirse automáticamente en orden de producción)
- ✅ Número de pedido autoincremental
- ✅ Cliente asociado
- ✅ Fecha de retiro y fecha de entrega solicitada
- ✅ Detalle del pedido:
  - Tipo de servicio (lavado estándar, lavado delicado, planchado, tintorería, etc.)
  - Tipo de prenda
  - Cantidad de prendas o peso estimado (kg)
  - Precio unitario (desde lista de precios del cliente)
  - Subtotal por línea
  - Descuento por línea (opcional)
- ✅ Subtotal, descuento general, IVA, total
- ✅ Instrucciones especiales del cliente
- ✅ Estado del pedido:

| Estado | Descripción |
|--------|-------------|
| `pendiente` | Pedido creado, pendiente de retiro |
| `retirado` | Ropa retirada del cliente |
| `en_produccion` | Orden de producción creada y en proceso |
| `listo` | Producción finalizada, listo para entregar |
| `en_camino` | En ruta de entrega |
| `entregado` | Entregado al cliente |
| `facturado` | Factura emitida |
| `cancelado` | Pedido cancelado |

- ✅ Timeline visual del estado del pedido
- ✅ Generar orden de producción desde pedido
- ✅ Generar factura desde pedido
- ✅ Enviar estado por email/WhatsApp al cliente (opcional)

#### 5.3 Cuenta Corriente

**Funcionalidades:**

- ✅ Cada cliente tiene su cuenta corriente
- ✅ Tipos de movimiento:

| Tipo | Descripción | Efecto en saldo |
|------|-------------|-----------------|
| `factura` | Factura emitida al cliente | +Deuda (debe) |
| `nota_credito` | Nota de crédito (devolución, descuento) | -Deuda (haber) |
| `pago_efectivo` | Pago en efectivo | -Deuda (haber) |
| `pago_transferencia` | Pago por transferencia bancaria | -Deuda (haber) |
| `pago_cheque` | Pago con cheque | -Deuda (haber) |
| `pago_otro` | Otros medios de pago | -Deuda (haber) |
| `ajuste_debito` | Ajuste manual a favor de DUWHITE | +Deuda (debe) |
| `ajuste_credito` | Ajuste manual a favor del cliente | -Deuda (haber) |

- ✅ Cada movimiento registra: fecha, tipo, descripción, monto, referencia (factura/pago), usuario
- ✅ Saldo calculado en tiempo real
- ✅ Extracto de cuenta corriente por período
- ✅ Antigüedad de saldos (aging): 0-30 días, 30-60, 60-90, +90 días
- ✅ Alertas de clientes con deuda vencida
- ✅ Bloqueo automático cuando supera límite de crédito (configurable)
- ✅ Exportar estado de cuenta a PDF
- ✅ Enviar estado de cuenta por email

#### 5.4 Panel del Cliente (Vista resumen)

**Dashboard por cliente con:**
- Información general del cliente
- Saldo actual de cuenta corriente
- Pedidos activos con estado en tiempo real
- Últimas 10 facturas
- Últimos 10 pagos
- Gráfico de facturación mensual
- Antigüedad de deuda

#### 5.5 Endpoints

```
GET    /api/v1/clientes
POST   /api/v1/clientes
GET    /api/v1/clientes/{id}
PUT    /api/v1/clientes/{id}
DELETE /api/v1/clientes/{id}
GET    /api/v1/clientes/{id}/panel
GET    /api/v1/clientes/{id}/pedidos
GET    /api/v1/clientes/{id}/facturas
GET    /api/v1/clientes/{id}/pagos
GET    /api/v1/clientes/deudores
GET    /api/v1/clientes/morosos

GET    /api/v1/pedidos
POST   /api/v1/pedidos
GET    /api/v1/pedidos/{id}
PUT    /api/v1/pedidos/{id}
DELETE /api/v1/pedidos/{id}
PUT    /api/v1/pedidos/{id}/estado
POST   /api/v1/pedidos/{id}/generar-orden-produccion
POST   /api/v1/pedidos/{id}/generar-factura
GET    /api/v1/pedidos/por-estado/{estado}

GET    /api/v1/cuenta-corriente/{cliente_id}
POST   /api/v1/cuenta-corriente/{cliente_id}/movimiento
GET    /api/v1/cuenta-corriente/{cliente_id}/extracto
GET    /api/v1/cuenta-corriente/{cliente_id}/extracto/pdf
POST   /api/v1/cuenta-corriente/{cliente_id}/enviar-extracto
GET    /api/v1/cuenta-corriente/{cliente_id}/antiguedad-saldos
GET    /api/v1/cuenta-corriente/resumen-general
```

---

### 6. Listas de Precios

**Descripción:** Sistema de listas de precios múltiples que permite asignar diferentes tarifas a distintos clientes o segmentos.

#### 6.1 Gestión de Listas

**Funcionalidades:**

- ✅ CRUD de listas de precios
- ✅ Nombre de la lista (ej: "Lista General", "Lista Hoteles", "Lista Hospitales", "Lista VIP")
- ✅ Descripción
- ✅ Moneda: ARS (por defecto)
- ✅ Tipo: Por kilo / Por prenda / Mixta
- ✅ Estado: Activa / Inactiva
- ✅ Fecha de vigencia (desde/hasta)
- ✅ Lista "base" de la cual hereda precios (opcional)
- ✅ Porcentaje de ajuste sobre lista base (ej: base +10%)
- ✅ Posibilidad de duplicar lista existente
- ✅ Historial de cambios de precios

#### 6.2 Ítems de Lista de Precios

**Funcionalidades:**

- ✅ Cada lista tiene N ítems (servicios/prendas)
- ✅ Datos por ítem:
  - Servicio (lavado, planchado, tintorería, etc.)
  - Tipo de prenda o concepto (sábana, toalla, uniforme, kilo de ropa, etc.)
  - Precio unitario
  - Unidad (por prenda, por kg, por metro)
  - IVA aplicable (21%, 10.5%, 0%)
  - Activo/Inactivo
- ✅ Importar/Exportar lista a Excel
- ✅ Actualización masiva de precios (por porcentaje)
- ✅ Comparar dos listas de precios

#### 6.3 Asignación a Clientes

- ✅ Cada cliente tiene una lista de precios asignada
- ✅ Posibilidad de precio especial por cliente (override)
- ✅ Al crear un pedido, los precios se cargan automáticamente desde la lista del cliente
- ✅ Si hay precio especial para ese cliente, se usa el especial

#### 6.4 Endpoints

```
GET    /api/v1/listas-precios
POST   /api/v1/listas-precios
GET    /api/v1/listas-precios/{id}
PUT    /api/v1/listas-precios/{id}
DELETE /api/v1/listas-precios/{id}
POST   /api/v1/listas-precios/{id}/duplicar

GET    /api/v1/listas-precios/{id}/items
POST   /api/v1/listas-precios/{id}/items
PUT    /api/v1/listas-precios/{id}/items/{item_id}
DELETE /api/v1/listas-precios/{id}/items/{item_id}
POST   /api/v1/listas-precios/{id}/actualizar-masivo
POST   /api/v1/listas-precios/{id}/importar-excel
GET    /api/v1/listas-precios/{id}/exportar-excel

GET    /api/v1/listas-precios/comparar?lista_a={id}&lista_b={id}
GET    /api/v1/listas-precios/{id}/historial-cambios

GET    /api/v1/clientes/{id}/precios-especiales
POST   /api/v1/clientes/{id}/precios-especiales
PUT    /api/v1/clientes/{id}/precios-especiales/{item_id}
DELETE /api/v1/clientes/{id}/precios-especiales/{item_id}
```

---

### 7. Módulo de Empleados, Reportes y Estadísticas

**Descripción:** Gestión del personal de DUWHITE, control de asistencia, y métricas de rendimiento.

#### 7.1 Gestión de Empleados

**Funcionalidades:**

- ✅ CRUD completo de empleados
- ✅ Datos personales: Nombre completo, DNI, CUIL, fecha de nacimiento, domicilio, teléfono, email
- ✅ Datos laborales:
  - Fecha de ingreso
  - Puesto/cargo
  - Área/sector (producción, administración, logística, ventas)
  - Turno (mañana, tarde, noche, rotativo)
  - Tipo de contrato (efectivo, contratado, eventual)
  - Convenio colectivo (si aplica)
  - Categoría
  - Sueldo básico
  - Obra social
  - ART
- ✅ Usuario del sistema asociado (si tiene acceso)
- ✅ Foto de perfil
- ✅ Estado: Activo / Licencia / Suspendido / Desvinculado
- ✅ Fecha de baja (si desvinculado)
- ✅ Documentación adjunta (contrato, recibos, etc.)

#### 7.2 Control de Asistencia

**Funcionalidades:**

- ✅ Registro de ingreso/egreso por empleado
- ✅ Métodos: Manual por admin / Auto-registro (PIN o desde su usuario)
- ✅ Cálculo automático de horas trabajadas
- ✅ Tipos de registro:
  - Presente
  - Ausente justificado (con motivo)
  - Ausente injustificado
  - Llegada tarde
  - Salida anticipada
  - Horas extra
  - Licencia (enfermedad, vacaciones, estudio, maternidad/paternidad)
  - Feriado trabajado
- ✅ Calendario mensual visual por empleado
- ✅ Resumen mensual: días trabajados, horas normales, horas extra, ausencias
- ✅ Exportar planilla de asistencia a Excel (para liquidación)

#### 7.3 Reportes y Estadísticas de Empleados

**Reportes disponibles:**

- Asistencia mensual/semanal por empleado
- Horas trabajadas totales por período
- Ranking de productividad (órdenes procesadas por empleado)
- Costo laboral por empleado y por área
- Ausentismo: tasa de ausencias, motivos más frecuentes
- Horas extra por empleado y por mes
- Rotación de personal

#### 7.4 Endpoints

```
GET    /api/v1/empleados
POST   /api/v1/empleados
GET    /api/v1/empleados/{id}
PUT    /api/v1/empleados/{id}
DELETE /api/v1/empleados/{id}
GET    /api/v1/empleados/{id}/asistencia
GET    /api/v1/empleados/{id}/asistencia/resumen-mes

POST   /api/v1/asistencia/registrar
GET    /api/v1/asistencia/dia/{fecha}
GET    /api/v1/asistencia/mes/{año}/{mes}
POST   /api/v1/asistencia/exportar-excel

GET    /api/v1/empleados/reportes/productividad
GET    /api/v1/empleados/reportes/ausentismo
GET    /api/v1/empleados/reportes/horas-extra
GET    /api/v1/empleados/reportes/costo-laboral
```

---

### 8. Módulo de Finanzas y Facturación

**Descripción:** Control financiero completo con sistema de facturación dividido en A y B, gestión de ingresos, egresos y flujo de caja.

#### 8.1 Facturación (Factura A y B)

**Funcionalidades:**

- ✅ Emisión de Factura A (para clientes Responsables Inscriptos)
- ✅ Emisión de Factura B (para clientes Consumidor Final, Monotributistas, Exentos)
- ✅ El sistema selecciona automáticamente A o B según condición IVA del cliente
- ✅ Datos de la factura:
  - Tipo: A / B
  - Punto de venta
  - Número de comprobante (autoincremental por tipo y punto de venta)
  - Fecha de emisión
  - Fecha de vencimiento de pago
  - Cliente (datos fiscales completos)
  - Detalle de líneas:
    - Descripción del servicio
    - Cantidad
    - Precio unitario
    - Bonificación (%)
    - Subtotal
    - IVA (21%, 10.5%, 0%)
    - Total línea
  - Subtotal
  - Descuento general (%)
  - Total neto gravado (Factura A)
  - IVA 21%
  - IVA 10.5% (si aplica)
  - Percepciones (si aplica, configurable)
  - Total
  - Condición de pago
  - Observaciones
- ✅ Diferencia entre Factura A y B:

| Campo | Factura A | Factura B |
|-------|-----------|-----------|
| IVA discriminado | ✅ Sí | ❌ No |
| Precio unitario | Sin IVA (neto) | Con IVA incluido |
| Subtotal | Neto gravado | Final |
| IVA detallado | Por alícuota | No se muestra |

- ✅ Estados de factura: Borrador → Emitida → Pagada parcial → Pagada total → Anulada
- ✅ Al emitir factura → movimiento automático en cuenta corriente del cliente
- ✅ Generar PDF de factura con formato fiscal argentino
- ✅ Enviar factura por email
- ✅ Notas de crédito (asociadas a factura)
- ✅ Notas de débito
- ✅ Numeración independiente por tipo (A / B) y por punto de venta

#### 8.2 Control de Ingresos y Egresos

**Funcionalidades:**

- ✅ Registro de todos los movimientos financieros
- ✅ Tipos de movimiento:

**Ingresos:**
| Categoría | Ejemplos |
|-----------|----------|
| Cobro de facturas | Pago de cliente por factura X |
| Otros ingresos | Venta de activo, intereses, etc. |

**Egresos:**
| Categoría | Ejemplos |
|-----------|----------|
| Compra de insumos | Pago a proveedor por OC |
| Sueldos y jornales | Liquidación de haberes |
| Servicios | Luz, gas, agua, internet, alquiler |
| Impuestos | IIBB, IVA, Ganancias, monotributo |
| Mantenimiento | Reparación maquinaria |
| Combustible | Vehículos de reparto |
| Varios | Otros gastos |

- ✅ Cada movimiento registra: fecha, categoría, subcategoría, descripción, monto, medio de pago, referencia (factura, OC, etc.), comprobante adjunto (foto/PDF)
- ✅ Categorías y subcategorías configurables
- ✅ Conciliación con cuenta corriente de clientes y proveedores

#### 8.3 Flujo de Caja

**Funcionalidades:**

- ✅ Vista diaria / semanal / mensual del flujo de caja
- ✅ Saldo inicial + Ingresos - Egresos = Saldo final
- ✅ Gráfico de evolución del flujo de caja
- ✅ Proyección de flujo (facturas por cobrar + gastos fijos estimados)
- ✅ Alertas cuando el flujo proyectado es negativo

#### 8.4 Resumen Financiero

**Widgets del dashboard financiero:**

- Facturación del mes (A + B desglosado)
- Cobranzas del mes
- Pagos a proveedores del mes
- Gastos operativos del mes
- Resultado del período (ingresos - egresos)
- Cuentas por cobrar (total de deuda de clientes)
- Cuentas por pagar (total adeudado a proveedores)
- Top 10 clientes por facturación
- Top 10 clientes deudores

#### 8.5 Endpoints

```
GET    /api/v1/facturacion/facturas
POST   /api/v1/facturacion/facturas
GET    /api/v1/facturacion/facturas/{id}
PUT    /api/v1/facturacion/facturas/{id}
POST   /api/v1/facturacion/facturas/{id}/emitir
POST   /api/v1/facturacion/facturas/{id}/anular
GET    /api/v1/facturacion/facturas/{id}/pdf
POST   /api/v1/facturacion/facturas/{id}/enviar-email
GET    /api/v1/facturacion/facturas/por-cliente/{cliente_id}
GET    /api/v1/facturacion/facturas/por-tipo/{tipo}

POST   /api/v1/facturacion/notas-credito
POST   /api/v1/facturacion/notas-debito
GET    /api/v1/facturacion/comprobantes

GET    /api/v1/finanzas/movimientos
POST   /api/v1/finanzas/movimientos
GET    /api/v1/finanzas/movimientos/{id}
PUT    /api/v1/finanzas/movimientos/{id}
DELETE /api/v1/finanzas/movimientos/{id}

GET    /api/v1/finanzas/flujo-caja
GET    /api/v1/finanzas/flujo-caja/proyeccion
GET    /api/v1/finanzas/resumen-mes
GET    /api/v1/finanzas/resumen-periodo
GET    /api/v1/finanzas/cuentas-por-cobrar
GET    /api/v1/finanzas/cuentas-por-pagar

GET    /api/v1/finanzas/categorias
POST   /api/v1/finanzas/categorias
PUT    /api/v1/finanzas/categorias/{id}
DELETE /api/v1/finanzas/categorias/{id}
```

---

### 9. Módulo de Análisis de Costos de Producción y Recomendaciones

**Descripción:** Cálculo detallado de costos de producción por orden, por cliente, por tipo de servicio. Sistema de recomendación de precios basado en costos reales.

#### 9.1 Costos de Producción

**Componentes del costo:**

| Componente | Descripción | Cálculo |
|------------|-------------|---------|
| **Insumos directos** | Productos químicos, envases consumidos en la orden | Sumatoria de (cantidad × precio unitario) de cada insumo |
| **Mano de obra directa** | Costo del personal que trabajó en la orden | (Sueldo/hora del empleado) × horas trabajadas en la orden |
| **Energía** | Electricidad, gas, agua por orden | Costo energético mensual / total kg procesados × kg de la orden |
| **Depreciación maquinaria** | Amortización de lavadoras, secadoras, planchas | Valor maquinaria / vida útil / horas totales × horas usadas |
| **Gastos indirectos** | Alquiler, seguros, administrativos | Total gastos indirectos / total órdenes del mes |

**Funcionalidades:**

- ✅ Cálculo automático del costo por orden de producción
- ✅ Cálculo de costo por kilo procesado
- ✅ Cálculo de costo por tipo de servicio
- ✅ Cálculo de costo por cliente (promedio)
- ✅ Comparativa de costos mes a mes
- ✅ Desglose de costos en gráfico de torta/barras
- ✅ Identificación de los insumos que más impactan en el costo
- ✅ Costo promedio ponderado por tipo de prenda

#### 9.2 Recomendaciones de Precios

**Funcionalidades:**

- ✅ Basado en el costo real de producción, recomendar precio de venta
- ✅ Configurar margen de ganancia objetivo (%) por tipo de servicio
- ✅ Fórmula: Precio recomendado = Costo de producción / (1 - Margen%)
- ✅ Comparar precio actual vs precio recomendado
- ✅ Alertas cuando el margen real está por debajo del objetivo
- ✅ Simulador: "¿Qué pasa si el insumo X sube un Y%?" → nuevo costo y precio recomendado
- ✅ Historial de evolución de costos (mensual)
- ✅ Recomendación de cuánto subir precios basado en:
  - Inflación acumulada del período (input manual o desde API)
  - Aumento de costos de insumos (calculado automáticamente)
  - Aumento de costos laborales (si se actualizan sueldos)
- ✅ Reporte: "Deberías subir tu lista de precios un X% para mantener un margen del Y%"

#### 9.3 Endpoints

```
GET    /api/v1/costos/por-orden/{orden_id}
GET    /api/v1/costos/por-cliente/{cliente_id}
GET    /api/v1/costos/por-servicio/{tipo_servicio}
GET    /api/v1/costos/promedio-kilo

GET    /api/v1/costos/evolucion-mensual
GET    /api/v1/costos/desglose/{periodo}
GET    /api/v1/costos/comparativa

GET    /api/v1/costos/recomendacion-precios
GET    /api/v1/costos/recomendacion-precios/{lista_id}
POST   /api/v1/costos/simulacion
GET    /api/v1/costos/margen-real
GET    /api/v1/costos/alerta-margen-bajo

PUT    /api/v1/costos/config/margenes
PUT    /api/v1/costos/config/gastos-indirectos
PUT    /api/v1/costos/config/inflacion
```

---

### 10. Módulo de Actividades

**Descripción:** Sistema de gestión de tareas y actividades internas para la coordinación del equipo.

#### 10.1 Gestión de Actividades

**Funcionalidades:**

- ✅ Crear actividad/tarea
- ✅ Datos de la actividad:
  - Título
  - Descripción detallada
  - Tipo: Tarea / Reunión / Recordatorio / Mantenimiento / Otro
  - Prioridad: Baja / Media / Alta / Urgente
  - Fecha de inicio
  - Fecha límite (deadline)
  - Asignado a (uno o varios empleados/usuarios)
  - Creado por
  - Módulo relacionado (opcional): producción, clientes, stock, mantenimiento, etc.
  - Entidad relacionada (opcional): ID de orden, cliente, proveedor, etc.
  - Etiquetas/tags (configurables)
  - Adjuntos (archivos, fotos)
  - Checklist de sub-tareas
- ✅ Estado: Pendiente → En progreso → Completada → Cancelada
- ✅ Comentarios/notas en la actividad (historial de conversación)
- ✅ Recurrencia: Única / Diaria / Semanal / Mensual / Personalizada

#### 10.2 Vistas

- ✅ **Lista:** Vista tabla con filtros, búsqueda, paginación
- ✅ **Kanban:** Columnas por estado (Pendiente, En progreso, Completada)
- ✅ **Calendario:** Vista mensual/semanal con las actividades
- ✅ **Mis actividades:** Filtrado automático por usuario logueado

#### 10.3 Notificaciones y Recordatorios

- ✅ Notificación cuando te asignan una actividad
- ✅ Recordatorio configurable antes del deadline (1h, 1d, 3d antes)
- ✅ Notificación cuando vence una actividad
- ✅ Notificación cuando alguien comenta en tu actividad
- ✅ Badge de actividades pendientes en sidebar

#### 10.4 Endpoints

```
GET    /api/v1/actividades
POST   /api/v1/actividades
GET    /api/v1/actividades/{id}
PUT    /api/v1/actividades/{id}
DELETE /api/v1/actividades/{id}
PUT    /api/v1/actividades/{id}/estado
POST   /api/v1/actividades/{id}/comentario
GET    /api/v1/actividades/{id}/comentarios

GET    /api/v1/actividades/mis-actividades
GET    /api/v1/actividades/por-estado/{estado}
GET    /api/v1/actividades/por-asignado/{usuario_id}
GET    /api/v1/actividades/vencidas
GET    /api/v1/actividades/calendario

GET    /api/v1/actividades/etiquetas
POST   /api/v1/actividades/etiquetas
```

---

### 11. Dashboard Principal

**Descripción:** Vista consolidada de toda la operación del día.

#### Widgets del Dashboard

| Widget | Descripción | Roles que lo ven |
|--------|-------------|-----------------|
| 📊 Producción del día | Órdenes en proceso, completadas hoy, kg procesados | Todos |
| 💰 Facturación del mes | Total facturado A + B, comparado con mes anterior | admin, contador |
| 📦 Alertas de stock | Insumos bajo stock y próximos a vencer | admin, jefe_prod |
| 👥 Clientes con deuda vencida | Cantidad y monto total de deuda vencida | admin, comercial, contador |
| 🔄 Pedidos activos | Cantidad por estado (pendiente, en producción, listos) | Todos |
| 📋 Últimas 10 órdenes de producción | Lista rápida con estado | admin, jefe_prod |
| ⏰ Actividades pendientes del usuario | Mis tareas del día/semana | Todos |
| 📈 Gráfico: Producción últimos 30 días | Kg procesados por día | admin, jefe_prod |
| 📈 Gráfico: Facturación últimos 6 meses | Barras comparativas mensuales | admin, contador |
| ⚡ Servicios programados (mantenimiento maquinaria) | Próximos mantenimientos de máquinas | admin, jefe_prod |
| 💲 Flujo de caja del mes | Ingresos vs egresos del mes actual | admin, contador |
| 🔔 Centro de alertas | Todas las alertas activas del sistema | Todos (filtrado por rol) |

#### Endpoints

```
GET    /api/v1/dashboard/resumen-dia
GET    /api/v1/dashboard/resumen-mes
GET    /api/v1/dashboard/alertas
GET    /api/v1/dashboard/estadisticas
GET    /api/v1/dashboard/widgets/{widget_name}
```

---

### 12. Reportes Generales

**Descripción:** Centro de reportes con exportación a PDF y Excel.

#### 12.1 Reportes Disponibles

**Producción:**
- Producción por período (kg, prendas, órdenes)
- Producción por cliente
- Producción por tipo de servicio
- Tiempo promedio por etapa
- Órdenes con incidencias
- Rendimiento por empleado (órdenes/hora)

**Comercial:**
- Facturación por período (desglosado A/B)
- Facturación por cliente
- Top clientes por facturación
- Ranking de servicios más solicitados
- Tasa de retención de clientes
- Nuevos clientes por período

**Financiero:**
- Estado de resultados (ingresos - gastos = resultado)
- Flujo de caja por período
- Antigüedad de saldos (clientes)
- Cuentas por pagar (proveedores)
- Gastos por categoría
- Evolución de facturación mensual

**Stock:**
- Valorización de inventario
- Movimientos de stock por período
- Consumo de insumos por producto/servicio
- Insumos más consumidos (ranking)
- Stock valorizado por categoría

**Costos:**
- Costo de producción por período
- Evolución de costos mensuales
- Costo promedio por kg/prenda
- Margen de ganancia por servicio
- Comparativa costo vs precio

**Empleados:**
- Asistencia mensual
- Horas extra por empleado/período
- Productividad por empleado
- Costo laboral por área

#### 12.2 Funcionalidades Comunes

- ✅ Filtros: fecha desde/hasta, cliente, proveedor, servicio, empleado
- ✅ Exportar a PDF
- ✅ Exportar a Excel
- ✅ Gráficos interactivos (barras, líneas, torta, área)
- ✅ Comparativa entre períodos
- ✅ Enviar reporte por email
- ✅ Guardar filtros como "reporte favorito"

#### 12.3 Endpoints

```
GET    /api/v1/reportes/produccion
GET    /api/v1/reportes/comercial
GET    /api/v1/reportes/financiero
GET    /api/v1/reportes/stock
GET    /api/v1/reportes/costos
GET    /api/v1/reportes/empleados

POST   /api/v1/reportes/exportar-pdf
POST   /api/v1/reportes/exportar-excel
POST   /api/v1/reportes/enviar-email
GET    /api/v1/reportes/favoritos
POST   /api/v1/reportes/favoritos
```

---

### 13. Configuración del Sistema

**Descripción:** Parámetros generales configurables del sistema.

**Funcionalidades:**

- ✅ Datos de la empresa (nombre, CUIT, logo, dirección, datos fiscales)
- ✅ Punto de venta para facturación
- ✅ Numeración de comprobantes
- ✅ Etapas de producción (agregar, editar, reordenar, eliminar)
- ✅ Tipos de servicio de lavado
- ✅ Tipos de prendas
- ✅ Categorías de insumos
- ✅ Categorías financieras (ingresos/egresos)
- ✅ Etiquetas de actividades
- ✅ Parámetros de alertas (umbrales, frecuencia)
- ✅ Configuración de email (SMTP)
- ✅ Configuración de margen objetivo por servicio
- ✅ Gastos fijos mensuales (para cálculo de costos indirectos)
- ✅ Backup de base de datos
- ✅ Logs del sistema

#### Endpoints

```
GET    /api/v1/config/empresa
PUT    /api/v1/config/empresa
GET    /api/v1/config/facturacion
PUT    /api/v1/config/facturacion
GET    /api/v1/config/produccion
PUT    /api/v1/config/produccion
GET    /api/v1/config/servicios
POST   /api/v1/config/servicios
PUT    /api/v1/config/servicios/{id}
GET    /api/v1/config/tipos-prenda
POST   /api/v1/config/tipos-prenda
GET    /api/v1/config/alertas
PUT    /api/v1/config/alertas
GET    /api/v1/config/logs
POST   /api/v1/config/backup
```

---

## 💾 Esquema de Base de Datos

### Tablas Principales

---

#### `usuarios`

```sql
- id: UUID (PK)
- email: VARCHAR(255) UNIQUE NOT NULL
- password_hash: VARCHAR(255) NOT NULL
- nombre: VARCHAR(100) NOT NULL
- apellido: VARCHAR(100) NOT NULL
- rol: ENUM ('superadmin', 'administrador', 'jefe_produccion', 'operador', 'comercial', 'contador', 'solo_lectura')
- avatar: VARCHAR(500)
- debe_cambiar_password: BOOLEAN DEFAULT TRUE
- activo: BOOLEAN DEFAULT TRUE
- ultimo_acceso: TIMESTAMP
- empleado_id: UUID (FK empleados) NULL
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `empleados`

```sql
- id: UUID (PK)
- nombre: VARCHAR(100) NOT NULL
- apellido: VARCHAR(100) NOT NULL
- dni: VARCHAR(20) UNIQUE NOT NULL
- cuil: VARCHAR(20) UNIQUE
- fecha_nacimiento: DATE
- domicilio: VARCHAR(255)
- telefono: VARCHAR(50)
- email: VARCHAR(255)
- fecha_ingreso: DATE NOT NULL
- fecha_baja: DATE NULL
- puesto: VARCHAR(100)
- area: ENUM ('produccion', 'administracion', 'logistica', 'ventas', 'mantenimiento')
- turno: ENUM ('mañana', 'tarde', 'noche', 'rotativo')
- tipo_contrato: ENUM ('efectivo', 'contratado', 'eventual')
- categoria: VARCHAR(50)
- sueldo_basico: DECIMAL(12,2)
- obra_social: VARCHAR(100)
- foto: VARCHAR(500)
- estado: ENUM ('activo', 'licencia', 'suspendido', 'desvinculado') DEFAULT 'activo'
- observaciones: TEXT
- activo: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `asistencias`

```sql
- id: UUID (PK)
- empleado_id: UUID (FK empleados) NOT NULL
- fecha: DATE NOT NULL
- hora_ingreso: TIME
- hora_egreso: TIME
- horas_trabajadas: DECIMAL(5,2)  -- calculado
- horas_extra: DECIMAL(5,2) DEFAULT 0
- tipo: ENUM ('presente', 'ausente_justificado', 'ausente_injustificado', 'tarde', 'salida_anticipada', 'licencia', 'feriado_trabajado')
- motivo: TEXT
- registrado_por: UUID (FK usuarios)
- created_at: TIMESTAMP
- UNIQUE(empleado_id, fecha)
```

#### `insumos`

```sql
- id: UUID (PK)
- codigo: VARCHAR(50) UNIQUE NOT NULL
- codigo_barras: VARCHAR(100)
- nombre: VARCHAR(255) NOT NULL
- categoria_id: UUID (FK categorias_insumo)
- subcategoria: VARCHAR(100)
- unidad: VARCHAR(20) NOT NULL  -- litros, kg, unidades, metros
- stock_actual: DECIMAL(12,2) NOT NULL DEFAULT 0
- stock_minimo: DECIMAL(12,2) DEFAULT 0
- stock_maximo: DECIMAL(12,2)
- precio_unitario_costo: DECIMAL(12,2)  -- último precio de compra
- precio_promedio_ponderado: DECIMAL(12,2)
- proveedor_habitual_id: UUID (FK proveedores) NULL
- ubicacion_deposito: VARCHAR(100)
- fecha_vencimiento: DATE NULL
- foto: VARCHAR(500)
- notas: TEXT
- activo: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `categorias_insumo`

```sql
- id: UUID (PK)
- nombre: VARCHAR(100) NOT NULL
- descripcion: TEXT
- orden: INTEGER DEFAULT 0
- activo: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP
```

#### `movimientos_stock`

```sql
- id: UUID (PK)
- insumo_id: UUID (FK insumos) NOT NULL
- tipo: ENUM ('ingreso_compra', 'ingreso_devolucion', 'ingreso_ajuste', 'egreso_produccion', 'egreso_merma', 'egreso_ajuste', 'transferencia')
- cantidad: DECIMAL(12,2) NOT NULL
- stock_anterior: DECIMAL(12,2) NOT NULL
- stock_resultante: DECIMAL(12,2) NOT NULL
- precio_unitario: DECIMAL(12,2)
- referencia_tipo: VARCHAR(50)  -- 'orden_compra', 'orden_produccion', 'ajuste_manual'
- referencia_id: UUID NULL
- observaciones: TEXT
- usuario_id: UUID (FK usuarios) NOT NULL
- created_at: TIMESTAMP
```

#### `proveedores`

```sql
- id: UUID (PK)
- razon_social: VARCHAR(255) NOT NULL
- cuit: VARCHAR(20) UNIQUE NOT NULL
- condicion_iva: ENUM ('responsable_inscripto', 'monotributista', 'exento')
- telefono: VARCHAR(50)
- email: VARCHAR(255)
- direccion: VARCHAR(255)
- ciudad: VARCHAR(100)
- provincia: VARCHAR(100)
- contacto_nombre: VARCHAR(100)
- contacto_telefono: VARCHAR(50)
- rubro: VARCHAR(100)
- condicion_pago: ENUM ('contado', '15_dias', '30_dias', '60_dias', 'cheque', 'transferencia')
- cuenta_bancaria_cbu: VARCHAR(30)
- cuenta_bancaria_alias: VARCHAR(50)
- calificacion: INTEGER DEFAULT 3  -- 1 a 5
- notas: TEXT
- estado: ENUM ('activo', 'inactivo', 'bloqueado') DEFAULT 'activo'
- activo: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `productos_proveedor`

```sql
- id: UUID (PK)
- proveedor_id: UUID (FK proveedores) NOT NULL
- insumo_id: UUID (FK insumos) NULL  -- mapeo a insumo interno
- nombre_producto: VARCHAR(255) NOT NULL
- codigo_proveedor: VARCHAR(100)
- unidad_venta: VARCHAR(100)  -- 'bidon 20L', 'bolsa 25kg'
- factor_conversion: DECIMAL(10,4) DEFAULT 1  -- para convertir a unidad interna
- precio_actual: DECIMAL(12,2) NOT NULL
- moneda: ENUM ('ARS', 'USD') DEFAULT 'ARS'
- fecha_precio: DATE NOT NULL
- tiempo_entrega_dias: INTEGER
- pedido_minimo: DECIMAL(10,2)
- activo: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `historial_precios_proveedor`

```sql
- id: UUID (PK)
- producto_proveedor_id: UUID (FK productos_proveedor) NOT NULL
- precio_anterior: DECIMAL(12,2) NOT NULL
- precio_nuevo: DECIMAL(12,2) NOT NULL
- variacion_porcentual: DECIMAL(6,2)  -- calculado
- fecha_cambio: DATE NOT NULL
- usuario_id: UUID (FK usuarios)
- created_at: TIMESTAMP
```

#### `ordenes_compra`

```sql
- id: UUID (PK)
- numero_orden: VARCHAR(20) UNIQUE NOT NULL  -- OC-2026-0001
- proveedor_id: UUID (FK proveedores) NOT NULL
- fecha_emision: DATE NOT NULL
- fecha_entrega_estimada: DATE
- condicion_pago: VARCHAR(100)
- estado: ENUM ('borrador', 'enviada', 'parcialmente_recibida', 'recibida', 'cancelada') DEFAULT 'borrador'
- subtotal: DECIMAL(12,2)
- iva: DECIMAL(12,2)
- total: DECIMAL(12,2)
- observaciones: TEXT
- created_by: UUID (FK usuarios) NOT NULL
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `ordenes_compra_detalle`

```sql
- id: UUID (PK)
- orden_compra_id: UUID (FK ordenes_compra) NOT NULL
- producto_proveedor_id: UUID (FK productos_proveedor) NOT NULL
- insumo_id: UUID (FK insumos) NULL
- cantidad_pedida: DECIMAL(12,2) NOT NULL
- cantidad_recibida: DECIMAL(12,2) DEFAULT 0
- precio_unitario: DECIMAL(12,2) NOT NULL
- subtotal: DECIMAL(12,2)  -- calculado
- created_at: TIMESTAMP
```

#### `clientes`

```sql
- id: UUID (PK)
- tipo: ENUM ('empresa', 'particular') NOT NULL
- razon_social: VARCHAR(255) NOT NULL
- nombre_fantasia: VARCHAR(255)
- cuit_cuil_dni: VARCHAR(20) UNIQUE NOT NULL
- condicion_iva: ENUM ('responsable_inscripto', 'monotributista', 'consumidor_final', 'exento') NOT NULL
- telefono: VARCHAR(50)
- email: VARCHAR(255)
- direccion: VARCHAR(255)
- ciudad: VARCHAR(100)
- provincia: VARCHAR(100)
- contacto_nombre: VARCHAR(100)
- contacto_telefono: VARCHAR(50)
- direccion_retiro: VARCHAR(255)
- direccion_entrega: VARCHAR(255)
- frecuencia_servicio: ENUM ('diario', 'semanal', 'quincenal', 'a_demanda')
- dias_retiro: JSONB  -- ['lunes', 'miercoles', 'viernes']
- dias_entrega: JSONB
- lista_precios_id: UUID (FK listas_precios) NULL
- condicion_pago: ENUM ('contado', '15_dias', '30_dias', '60_dias') DEFAULT 'contado'
- limite_credito: DECIMAL(12,2) DEFAULT 0
- descuento_general: DECIMAL(5,2) DEFAULT 0  -- porcentaje
- categoria: ENUM ('A', 'B', 'C') DEFAULT 'B'
- estado: ENUM ('activo', 'suspendido', 'inactivo') DEFAULT 'activo'
- notas: TEXT
- activo: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `pedidos`

```sql
- id: UUID (PK)
- numero_pedido: VARCHAR(20) UNIQUE NOT NULL  -- PED-2026-0001
- cliente_id: UUID (FK clientes) NOT NULL
- fecha_retiro: DATE
- fecha_entrega_solicitada: DATE
- estado: ENUM ('pendiente', 'retirado', 'en_produccion', 'listo', 'en_camino', 'entregado', 'facturado', 'cancelado') DEFAULT 'pendiente'
- instrucciones_especiales: TEXT
- subtotal: DECIMAL(12,2)
- descuento_porcentaje: DECIMAL(5,2) DEFAULT 0
- descuento_monto: DECIMAL(12,2) DEFAULT 0
- iva: DECIMAL(12,2)
- total: DECIMAL(12,2)
- orden_produccion_id: UUID (FK ordenes_produccion) NULL
- factura_id: UUID (FK facturas) NULL
- observaciones: TEXT
- created_by: UUID (FK usuarios) NOT NULL
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `pedidos_detalle`

```sql
- id: UUID (PK)
- pedido_id: UUID (FK pedidos) NOT NULL
- tipo_servicio: VARCHAR(100) NOT NULL  -- 'lavado_estandar', 'planchado', etc.
- tipo_prenda: VARCHAR(100) NOT NULL
- cantidad: DECIMAL(10,2) NOT NULL
- unidad: VARCHAR(20) NOT NULL  -- 'prenda', 'kg', 'metro'
- precio_unitario: DECIMAL(12,2) NOT NULL
- bonificacion: DECIMAL(5,2) DEFAULT 0
- subtotal: DECIMAL(12,2)  -- calculado
- iva_porcentaje: DECIMAL(5,2) DEFAULT 21
- created_at: TIMESTAMP
```

#### `ordenes_produccion`

```sql
- id: UUID (PK)
- numero_orden: VARCHAR(20) UNIQUE NOT NULL  -- OP-2026-0001
- cliente_id: UUID (FK clientes) NOT NULL
- pedido_id: UUID (FK pedidos) NULL
- fecha_ingreso: DATE NOT NULL
- fecha_entrega_prometida: DATE
- prioridad: ENUM ('normal', 'urgente', 'express') DEFAULT 'normal'
- peso_total_kg: DECIMAL(10,2)
- cantidad_prendas: INTEGER
- tipo_lavado: VARCHAR(100)
- instrucciones_especiales: TEXT
- estado: ENUM ('pendiente', 'en_proceso', 'completada', 'entregada', 'cancelada') DEFAULT 'pendiente'
- costo_insumos: DECIMAL(12,2) DEFAULT 0
- costo_mano_obra: DECIMAL(12,2) DEFAULT 0
- costo_total: DECIMAL(12,2) DEFAULT 0
- observaciones: TEXT
- created_by: UUID (FK usuarios) NOT NULL
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `ordenes_produccion_detalle`

```sql
- id: UUID (PK)
- orden_produccion_id: UUID (FK ordenes_produccion) NOT NULL
- tipo_prenda: VARCHAR(100) NOT NULL
- cantidad: INTEGER NOT NULL
- peso_kg: DECIMAL(10,2)
- tipo_lavado: VARCHAR(100)
- instrucciones: TEXT
- created_at: TIMESTAMP
```

#### `etapas_produccion_config`

```sql
- id: UUID (PK)
- nombre: VARCHAR(100) NOT NULL
- descripcion: TEXT
- orden: INTEGER NOT NULL
- duracion_estimada_minutos: INTEGER
- activo: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP
```

#### `etapas_produccion_registro`

```sql
- id: UUID (PK)
- orden_produccion_id: UUID (FK ordenes_produccion) NOT NULL
- etapa_config_id: UUID (FK etapas_produccion_config) NOT NULL
- estado: ENUM ('pendiente', 'en_proceso', 'completada', 'saltada') DEFAULT 'pendiente'
- empleado_id: UUID (FK empleados) NULL
- fecha_inicio: TIMESTAMP
- fecha_fin: TIMESTAMP
- duracion_minutos: INTEGER  -- calculado
- observaciones: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `incidencias_produccion`

```sql
- id: UUID (PK)
- orden_produccion_id: UUID (FK ordenes_produccion) NOT NULL
- etapa_registro_id: UUID (FK etapas_produccion_registro) NULL
- tipo: ENUM ('prenda_dañada', 'mancha_persistente', 'faltante', 'otro')
- descripcion: TEXT NOT NULL
- fotos: JSONB  -- URLs
- resuelta: BOOLEAN DEFAULT FALSE
- resolucion: TEXT
- reportado_por: UUID (FK usuarios) NOT NULL
- created_at: TIMESTAMP
```

#### `consumos_produccion`

```sql
- id: UUID (PK)
- orden_produccion_id: UUID (FK ordenes_produccion) NOT NULL
- insumo_id: UUID (FK insumos) NOT NULL
- cantidad: DECIMAL(12,2) NOT NULL
- precio_unitario: DECIMAL(12,2)
- subtotal: DECIMAL(12,2)  -- calculado
- etapa_registro_id: UUID (FK etapas_produccion_registro) NULL
- registrado_por: UUID (FK usuarios) NOT NULL
- created_at: TIMESTAMP
```

#### `cuenta_corriente`

```sql
- id: UUID (PK)
- cliente_id: UUID (FK clientes) NOT NULL
- fecha: DATE NOT NULL
- tipo: ENUM ('factura', 'nota_credito', 'pago_efectivo', 'pago_transferencia', 'pago_cheque', 'pago_otro', 'ajuste_debito', 'ajuste_credito')
- descripcion: VARCHAR(500) NOT NULL
- debe: DECIMAL(12,2) DEFAULT 0
- haber: DECIMAL(12,2) DEFAULT 0
- saldo_acumulado: DECIMAL(12,2)  -- calculado
- referencia_tipo: VARCHAR(50)  -- 'factura', 'nota_credito', 'pago'
- referencia_id: UUID NULL
- observaciones: TEXT
- usuario_id: UUID (FK usuarios) NOT NULL
- created_at: TIMESTAMP
```

#### `listas_precios`

```sql
- id: UUID (PK)
- nombre: VARCHAR(100) NOT NULL
- descripcion: TEXT
- tipo: ENUM ('por_kilo', 'por_prenda', 'mixta') DEFAULT 'mixta'
- moneda: ENUM ('ARS', 'USD') DEFAULT 'ARS'
- estado: ENUM ('activa', 'inactiva') DEFAULT 'activa'
- fecha_vigencia_desde: DATE
- fecha_vigencia_hasta: DATE NULL
- lista_base_id: UUID (FK listas_precios) NULL
- porcentaje_ajuste: DECIMAL(5,2) DEFAULT 0
- activo: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `listas_precios_items`

```sql
- id: UUID (PK)
- lista_precios_id: UUID (FK listas_precios) NOT NULL
- tipo_servicio: VARCHAR(100) NOT NULL
- tipo_prenda_concepto: VARCHAR(100) NOT NULL
- precio_unitario: DECIMAL(12,2) NOT NULL
- unidad: VARCHAR(20) NOT NULL  -- 'prenda', 'kg', 'metro'
- iva_porcentaje: DECIMAL(5,2) DEFAULT 21
- activo: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
- UNIQUE(lista_precios_id, tipo_servicio, tipo_prenda_concepto)
```

#### `precios_especiales_cliente`

```sql
- id: UUID (PK)
- cliente_id: UUID (FK clientes) NOT NULL
- tipo_servicio: VARCHAR(100) NOT NULL
- tipo_prenda_concepto: VARCHAR(100) NOT NULL
- precio_unitario: DECIMAL(12,2) NOT NULL
- activo: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `facturas`

```sql
- id: UUID (PK)
- tipo: ENUM ('A', 'B') NOT NULL
- punto_venta: INTEGER NOT NULL
- numero_comprobante: INTEGER NOT NULL
- numero_completo: VARCHAR(20)  -- 0001-00000123
- fecha_emision: DATE NOT NULL
- fecha_vencimiento_pago: DATE
- cliente_id: UUID (FK clientes) NOT NULL
- cliente_razon_social: VARCHAR(255)  -- snapshot
- cliente_cuit: VARCHAR(20)  -- snapshot
- cliente_condicion_iva: VARCHAR(50)  -- snapshot
- cliente_direccion: VARCHAR(255)  -- snapshot
- pedido_id: UUID (FK pedidos) NULL
- subtotal: DECIMAL(12,2) NOT NULL
- descuento_porcentaje: DECIMAL(5,2) DEFAULT 0
- descuento_monto: DECIMAL(12,2) DEFAULT 0
- neto_gravado_21: DECIMAL(12,2) DEFAULT 0
- neto_gravado_105: DECIMAL(12,2) DEFAULT 0
- neto_gravado_0: DECIMAL(12,2) DEFAULT 0
- iva_21: DECIMAL(12,2) DEFAULT 0
- iva_105: DECIMAL(12,2) DEFAULT 0
- percepciones: DECIMAL(12,2) DEFAULT 0
- total: DECIMAL(12,2) NOT NULL
- condicion_pago: VARCHAR(100)
- observaciones: TEXT
- estado: ENUM ('borrador', 'emitida', 'pagada_parcial', 'pagada_total', 'anulada') DEFAULT 'borrador'
- pdf_url: VARCHAR(500)
- enviada_email: BOOLEAN DEFAULT FALSE
- created_by: UUID (FK usuarios) NOT NULL
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
- UNIQUE(tipo, punto_venta, numero_comprobante)
```

#### `facturas_detalle`

```sql
- id: UUID (PK)
- factura_id: UUID (FK facturas) NOT NULL
- descripcion: VARCHAR(255) NOT NULL
- cantidad: DECIMAL(10,2) NOT NULL
- unidad: VARCHAR(20)
- precio_unitario: DECIMAL(12,2) NOT NULL
- bonificacion: DECIMAL(5,2) DEFAULT 0
- subtotal: DECIMAL(12,2)  -- calculado
- iva_porcentaje: DECIMAL(5,2) DEFAULT 21
- iva_monto: DECIMAL(12,2)  -- calculado
- total: DECIMAL(12,2)  -- calculado
- created_at: TIMESTAMP
```

#### `notas_credito_debito`

```sql
- id: UUID (PK)
- tipo: ENUM ('nota_credito', 'nota_debito') NOT NULL
- tipo_comprobante: ENUM ('A', 'B') NOT NULL
- punto_venta: INTEGER NOT NULL
- numero_comprobante: INTEGER NOT NULL
- fecha_emision: DATE NOT NULL
- cliente_id: UUID (FK clientes) NOT NULL
- factura_asociada_id: UUID (FK facturas) NULL
- motivo: TEXT NOT NULL
- subtotal: DECIMAL(12,2)
- iva: DECIMAL(12,2)
- total: DECIMAL(12,2) NOT NULL
- estado: ENUM ('borrador', 'emitida', 'anulada') DEFAULT 'borrador'
- created_by: UUID (FK usuarios) NOT NULL
- created_at: TIMESTAMP
```

#### `movimientos_financieros`

```sql
- id: UUID (PK)
- fecha: DATE NOT NULL
- tipo: ENUM ('ingreso', 'egreso') NOT NULL
- categoria_id: UUID (FK categorias_financieras) NOT NULL
- subcategoria: VARCHAR(100)
- descripcion: VARCHAR(500) NOT NULL
- monto: DECIMAL(12,2) NOT NULL
- medio_pago: ENUM ('efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro')
- referencia_tipo: VARCHAR(50)  -- 'factura', 'orden_compra', 'sueldo'
- referencia_id: UUID NULL
- comprobante_url: VARCHAR(500)
- proveedor_id: UUID (FK proveedores) NULL
- cliente_id: UUID (FK clientes) NULL
- observaciones: TEXT
- usuario_id: UUID (FK usuarios) NOT NULL
- created_at: TIMESTAMP
```

#### `categorias_financieras`

```sql
- id: UUID (PK)
- tipo: ENUM ('ingreso', 'egreso') NOT NULL
- nombre: VARCHAR(100) NOT NULL
- descripcion: TEXT
- orden: INTEGER DEFAULT 0
- activo: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP
```

#### `costos_produccion`

```sql
- id: UUID (PK)
- orden_produccion_id: UUID (FK ordenes_produccion) NOT NULL
- costo_insumos_directos: DECIMAL(12,2) DEFAULT 0
- costo_mano_obra_directa: DECIMAL(12,2) DEFAULT 0
- costo_energia: DECIMAL(12,2) DEFAULT 0
- costo_depreciacion: DECIMAL(12,2) DEFAULT 0
- costo_indirecto_asignado: DECIMAL(12,2) DEFAULT 0
- costo_total: DECIMAL(12,2) DEFAULT 0
- costo_por_kg: DECIMAL(12,2)  -- calculado
- margen_config: DECIMAL(5,2)  -- margen objetivo
- precio_venta_total: DECIMAL(12,2)  -- lo que se cobró
- margen_real_porcentaje: DECIMAL(5,2)  -- calculado
- calculado_at: TIMESTAMP
- created_at: TIMESTAMP
```

#### `config_margenes`

```sql
- id: UUID (PK)
- tipo_servicio: VARCHAR(100) NOT NULL
- margen_objetivo: DECIMAL(5,2) NOT NULL  -- porcentaje
- activo: BOOLEAN DEFAULT TRUE
- updated_by: UUID (FK usuarios)
- updated_at: TIMESTAMP
```

#### `actividades`

```sql
- id: UUID (PK)
- titulo: VARCHAR(255) NOT NULL
- descripcion: TEXT
- tipo: ENUM ('tarea', 'reunion', 'recordatorio', 'mantenimiento', 'otro') DEFAULT 'tarea'
- prioridad: ENUM ('baja', 'media', 'alta', 'urgente') DEFAULT 'media'
- fecha_inicio: DATE
- fecha_limite: DATE
- estado: ENUM ('pendiente', 'en_progreso', 'completada', 'cancelada') DEFAULT 'pendiente'
- modulo_relacionado: VARCHAR(50)  -- 'produccion', 'clientes', 'stock'
- entidad_relacionada_tipo: VARCHAR(50)
- entidad_relacionada_id: UUID NULL
- recurrencia: ENUM ('unica', 'diaria', 'semanal', 'mensual', 'personalizada') DEFAULT 'unica'
- recurrencia_config: JSONB NULL  -- config personalizada
- creado_por: UUID (FK usuarios) NOT NULL
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `actividades_asignados`

```sql
- id: UUID (PK)
- actividad_id: UUID (FK actividades) NOT NULL
- usuario_id: UUID (FK usuarios) NOT NULL
- created_at: TIMESTAMP
- UNIQUE(actividad_id, usuario_id)
```

#### `actividades_comentarios`

```sql
- id: UUID (PK)
- actividad_id: UUID (FK actividades) NOT NULL
- usuario_id: UUID (FK usuarios) NOT NULL
- contenido: TEXT NOT NULL
- created_at: TIMESTAMP
```

#### `actividades_checklist`

```sql
- id: UUID (PK)
- actividad_id: UUID (FK actividades) NOT NULL
- descripcion: VARCHAR(255) NOT NULL
- completada: BOOLEAN DEFAULT FALSE
- orden: INTEGER DEFAULT 0
- created_at: TIMESTAMP
```

#### `alertas`

```sql
- id: UUID (PK)
- usuario_id: UUID (FK usuarios) NOT NULL
- tipo: VARCHAR(50) NOT NULL  -- 'stock_bajo', 'stock_vencimiento', 'deuda_vencida', 'margen_bajo', 'actividad_vencida', 'orden_retrasada'
- titulo: VARCHAR(255) NOT NULL
- mensaje: TEXT NOT NULL
- prioridad: ENUM ('baja', 'media', 'alta', 'critica') DEFAULT 'media'
- entidad_tipo: VARCHAR(50)
- entidad_id: UUID NULL
- leida: BOOLEAN DEFAULT FALSE
- resuelta: BOOLEAN DEFAULT FALSE
- created_at: TIMESTAMP
```

#### `configuracion`

```sql
- id: UUID (PK)
- clave: VARCHAR(100) UNIQUE NOT NULL
- valor: JSONB NOT NULL
- descripcion: TEXT
- updated_by: UUID (FK usuarios)
- updated_at: TIMESTAMP
```

#### `logs_actividad`

```sql
- id: UUID (PK)
- usuario_id: UUID (FK usuarios) NOT NULL
- accion: VARCHAR(50) NOT NULL  -- 'crear', 'editar', 'eliminar', 'login', 'logout'
- modulo: VARCHAR(50) NOT NULL
- entidad_tipo: VARCHAR(50)
- entidad_id: UUID NULL
- datos_anteriores: JSONB NULL
- datos_nuevos: JSONB NULL
- ip: VARCHAR(50)
- created_at: TIMESTAMP
```

---

## 🤖 Archivo para Claude Code

### 📄 docs/agent.md

```markdown
# Agent Instructions - Sistema de Gestión DUWHITE

## Contexto del Proyecto

Estás trabajando en un **Sistema de Gestión Integral para DUWHITE**, una lavandería industrial
de Córdoba, Argentina con más de 18 años de trayectoria. El sistema administra:

- Control de stock de insumos con alertas automáticas
- Gestión de proveedores, sus productos y precios
- Control completo del proceso de producción (lavado industrial)
- Panel de clientes con pedidos y cuenta corriente
- Listas de precios múltiples con asignación por cliente
- Gestión de empleados con asistencia y reportes
- Finanzas: facturación A/B, ingresos, egresos, flujo de caja
- Análisis de costos de producción con recomendaciones de precios
- Gestión de actividades internas (tareas, recordatorios)
- Dashboard operativo y reportes completos

**Usuarios del sistema:** ~25 (administradores + operadores + empleados)
**Acceso:** Web responsive (desktop + mobile)

---

## Stack Tecnológico

### Backend
- Python 3.11+ con FastAPI 0.104+
- PostgreSQL 15+ como base de datos
- SQLAlchemy 2.0 como ORM
- Alembic para migraciones
- Pydantic v2 para validación
- JWT con python-jose para autenticación
- Celery + Redis para tareas asíncronas
- WeasyPrint para generación de PDFs
- Pytest para testing

### Frontend
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui para componentes
- **Colores:** Paleta turquesa/gris basada en identidad DUWHITE
  - Primario: #00BCD4 (turquesa)
  - Hover: #00959F (turquesa oscuro)
  - Sidebar/Header: #3D3D3D (gris oscuro)
  - Fondo: #F7F8FA (gris claro)
  - Texto: #333333 (gris muy oscuro)
  - Secundario: #777777 (gris medio)
  - Bordes: #E0E0E0 (gris suave)
- Zustand para state management
- TanStack Query para data fetching
- React Hook Form + Zod para formularios
- TanStack Table para tablas
- React Router v6
- Recharts para gráficos

### Infraestructura
- Monorepo con Docker Compose
- Nginx como proxy reverso (producción)
- Cloudflare para DNS + SSL

---

## Principios de Desarrollo

### 1. Arquitectura

**Backend:**
- Sigue arquitectura en capas: Endpoints → Services → Models
- NUNCA pongas lógica de negocio en los endpoints
- Usa dependency injection de FastAPI
- Todos los endpoints deben tener validación Pydantic
- Implementa soft deletes (campo `activo`, no eliminar registros)
- Transacciones de BD para operaciones críticas
- Logs de auditoría en TODAS las operaciones de escritura

**Frontend:**
- Componentes pequeños y reutilizables
- Custom hooks para lógica compartida
- Separación: components / pages / services / stores
- TypeScript SIEMPRE, no uses `any`
- Loading states y error handling en todas las operaciones
- Responsive design (mobile-first para vistas de operarios)

### 2. Formato Argentino

- Fechas: DD/MM/YYYY
- Números: separador de miles con punto (1.000)
- Decimales: coma (10,5)
- Moneda: $ (peso argentino)
- CUIT: XX-XXXXXXXX-X
- Condiciones IVA: RI, Monotributo, CF, Exento

### 3. Flujos Críticos

**Flujo de Pedido → Producción → Factura:**
1. Comercial crea pedido para cliente
2. Sistema calcula precios desde lista del cliente
3. Se genera orden de producción desde el pedido
4. Producción procesa la orden por etapas
5. Cada etapa registra consumo de insumos (descuento automático de stock)
6. Al completar producción, pedido pasa a "listo"
7. Se genera factura (A o B según cliente)
8. Factura genera movimiento en cuenta corriente

**Flujo de Compra de Insumos:**
1. Se detecta stock bajo (alerta)
2. Se crea orden de compra al proveedor
3. Se envía OC por email
4. Al recibir mercadería, se registra recepción
5. Ingreso automático de stock + movimiento de stock
6. Actualización de precio del insumo

**Flujo de Facturación A/B:**
1. Se crea factura desde pedido (o manual)
2. Sistema detecta condición IVA del cliente → elige tipo A o B
3. Factura A: precios netos + IVA discriminado
4. Factura B: precios con IVA incluido
5. Se emite factura → genera movimiento en cuenta corriente (debe)
6. Se registra pago → genera movimiento en cuenta corriente (haber)

### 4. Convenciones de Código

**Python:**
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

    Args:
        db: Sesión de base de datos
        insumo_id: ID del insumo
        cantidad: Cantidad a descontar
        referencia_tipo: Tipo de referencia ('orden_produccion', 'ajuste')
        referencia_id: ID de la entidad de referencia
        usuario_id: ID del usuario que registra

    Raises:
        HTTPException 400: Si no hay stock suficiente
        HTTPException 404: Si el insumo no existe
    """
    pass
```

**TypeScript:**
```typescript
// Interfaces descriptivas
interface PedidoFormData {
  clienteId: string;
  fechaRetiro: string;
  fechaEntregaSolicitada: string;
  instruccionesEspeciales?: string;
  detalle: PedidoDetalleItem[];
}

interface PedidoDetalleItem {
  tipoServicio: string;
  tipoPrenda: string;
  cantidad: number;
  unidad: 'prenda' | 'kg' | 'metro';
  precioUnitario: number;
  bonificacion: number;
}

// Formateo argentino
const formatearMoneda = (monto: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(monto);
};

const formatearFecha = (fecha: string): string => {
  return new Date(fecha).toLocaleDateString('es-AR');
};
```

### 5. Estructura de Archivos

**Al crear nuevos módulos backend:**
```
1. models/{modulo}.py
2. schemas/{modulo}.py
3. services/{modulo}_service.py
4. api/v1/endpoints/{modulo}.py
5. tests/api/test_{modulo}.py
```

**Frontend por feature:**
```
src/
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

### 6. Seguridad

**CRÍTICO:**
- ✅ Validación de permisos en TODOS los endpoints
- ✅ Middleware de verificación de rol
- ✅ Passwords hasheados con bcrypt
- ✅ JWT con expiración (access: 30min, refresh: 7 días)
- ✅ Logs de todas las operaciones críticas (auditoría)
- ✅ Sanitización de inputs
- ✅ Rate limiting en login (prevenir fuerza bruta)
- ✅ Soft deletes en todas las entidades

---

## Tareas Celery

### Alertas automáticas
```python
@shared_task
def verificar_stock_bajo():
    """Verifica insumos bajo stock mínimo y genera alertas."""
    pass

@shared_task
def verificar_insumos_por_vencer():
    """Verifica insumos con fecha de vencimiento próxima."""
    pass

@shared_task
def verificar_deuda_vencida_clientes():
    """Verifica clientes con facturas vencidas y genera alertas."""
    pass

@shared_task
def verificar_ordenes_retrasadas():
    """Verifica órdenes de producción que pasaron fecha prometida."""
    pass

@shared_task
def recordar_actividades_vencidas():
    """Envía recordatorios de actividades por vencer."""
    pass

@shared_task
def calcular_costos_produccion_diario():
    """Recalcula costos de producción de órdenes completadas."""
    pass
```

---

## Variables de Entorno
```bash
# .env.example

# Backend
DATABASE_URL=postgresql://user:password@localhost:5432/duwhite_gestion
SECRET_KEY=your-super-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Celery & Redis
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Email (SMTP para envío de facturas, reportes, etc.)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=gestion@duwhite.com

# Frontend
VITE_API_URL=http://localhost:8000/api/v1

# Datos de la empresa (defaults)
EMPRESA_NOMBRE=DUWHITE
EMPRESA_CUIT=XX-XXXXXXXX-X
EMPRESA_DIRECCION=Córdoba, Argentina
```

---

## Comandos Útiles
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev

# Docker
docker-compose up -d
docker-compose logs -f backend
docker-compose exec backend alembic upgrade head
docker-compose down

# Tests
pytest
pytest tests/api/test_stock.py -v
pytest --cov=app tests/

# Celery
celery -A app.core.celery_app worker --loglevel=info
celery -A app.core.celery_app beat --loglevel=info
```

---

## Próximos Pasos (Fases de Desarrollo)

### Fase 1: Setup Inicial + Auth
1. Crear estructura de carpetas (backend + frontend)
2. Configurar Docker Compose (PostgreSQL + Redis)
3. Setup FastAPI + SQLAlchemy + Alembic
4. Setup React + Vite + Tailwind + shadcn/ui
5. Modelo Usuario + Auth (JWT + roles)
6. Frontend: Login + Layout principal (sidebar + header)

### Fase 2: Stock + Proveedores (Core operativo)
1. CRUD Insumos + Categorías
2. Movimientos de stock
3. Alertas de stock bajo
4. CRUD Proveedores
5. Catálogo de productos del proveedor
6. Historial de precios
7. Órdenes de compra

### Fase 3: Producción
1. Configuración de etapas
2. CRUD Órdenes de producción
3. Registro de etapas (vista operario)
4. Consumo de insumos por orden
5. Tablero Kanban
6. Incidencias

### Fase 4: Clientes + Pedidos + Listas de Precios
1. CRUD Clientes
2. CRUD Pedidos + detalle
3. Listas de precios + ítems
4. Precios especiales por cliente
5. Flujo pedido → orden de producción
6. Cuenta corriente

### Fase 5: Finanzas + Facturación
1. Facturación A/B
2. Notas de crédito/débito
3. Generación de PDF fiscal
4. Movimientos financieros (ingresos/egresos)
5. Flujo de caja

### Fase 6: Empleados + Actividades
1. CRUD Empleados
2. Control de asistencia
3. CRUD Actividades
4. Vistas: Lista, Kanban, Calendario
5. Notificaciones y recordatorios

### Fase 7: Costos + Reportes + Dashboard
1. Cálculo de costos de producción
2. Recomendaciones de precios
3. Simulador de costos
4. Dashboard principal con widgets
5. Reportes completos (producción, comercial, financiero, stock, empleados)
6. Exportación PDF/Excel

---

**¿Listo para empezar? Indica qué módulo quieres que implemente primero y te daré el código completo.**
```

---

## 📊 Diagramas de Relaciones

### Relaciones principales entre entidades

```
usuarios ←→ empleados (1:1 opcional)
usuarios → logs_actividad (1:N)
usuarios → alertas (1:N)

insumos → categorias_insumo (N:1)
insumos → movimientos_stock (1:N)
insumos → proveedores (N:1 habitual)

proveedores → productos_proveedor (1:N)
productos_proveedor → insumos (N:1 mapeo)
productos_proveedor → historial_precios_proveedor (1:N)

proveedores → ordenes_compra (1:N)
ordenes_compra → ordenes_compra_detalle (1:N)

clientes → pedidos (1:N)
clientes → listas_precios (N:1)
clientes → cuenta_corriente (1:N)
clientes → facturas (1:N)
clientes → precios_especiales_cliente (1:N)

pedidos → pedidos_detalle (1:N)
pedidos → ordenes_produccion (1:1)
pedidos → facturas (1:1)

ordenes_produccion → ordenes_produccion_detalle (1:N)
ordenes_produccion → etapas_produccion_registro (1:N)
ordenes_produccion → consumos_produccion (1:N)
ordenes_produccion → incidencias_produccion (1:N)
ordenes_produccion → costos_produccion (1:1)

etapas_produccion_registro → etapas_produccion_config (N:1)
etapas_produccion_registro → empleados (N:1)

listas_precios → listas_precios_items (1:N)

facturas → facturas_detalle (1:N)
facturas → notas_credito_debito (1:N)

empleados → asistencias (1:N)

actividades → actividades_asignados (1:N)
actividades → actividades_comentarios (1:N)
actividades → actividades_checklist (1:N)
```

Sidebar / Navbar: Gris oscuro (#3D3D3D o #4A4A4A) — consistente con su marca, da un look profesional y serio
Color primario / Acciones principales (botones, links, badges activos): El turquesa/cyan (#00BCD4 o #00C8C8) — es el color identitario de la marca y funciona perfecto como acento
Color hover / variantes: Un turquesa más oscuro (#00A3A3) para hovers y estados activos
Fondo general: Blanco o gris muy claro (#F7F8FA) para las áreas de contenido
Textos: Gris oscuro (#333333) para texto principal, gris medio (#777777) para secundarios
Alertas/estados: Podés mantener verde para éxito, rojo para errores, y amarillo para warnings — son universales y no chocan con la paleta

En resumen, la combinación clave sería:
ElementoColorHexSidebar/HeaderGris oscuro#3D3D3DPrimario/AcentoTurquesa#00BCD4Hover primarioTurquesa oscuro#00959FFondo contenidoGris claro#F7F8FATexto principalGris muy oscuro#333333Texto secundarioGris medio#777777Bordes/divisoresGris suave#E0E0E0

