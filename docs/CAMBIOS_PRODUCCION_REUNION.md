# Cambios Módulo de Producción - Reunión con Cliente

**Fecha reunión:** 9 de Abril 2026
**Cliente:** DUWHITE - Lavandería Industrial

---

## 1. FLUJO DE POSTAS DEFINITIVO

El proceso de producción tendrá **5 postas** en el siguiente orden:

```
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────┐
│   EN CAMINO     │ → │ RECEPCIÓN Y PESAJE  │ → │     LAVADO      │
│                 │    │                     │    │                 │
│ • Transportista │    │ • Ingreso físico    │    │ • Seleccionar   │
│   recoge ropa   │    │ • Pesaje en balanza │    │   CANASTO(S)    │
│ • Selecciona    │    │ • Registro de kg    │    │ • Seleccionar   │
│   cliente       │    │                     │    │   LAVADORA(S)   │
│ • Crea el lote  │    │                     │    │ • Múltiple      │
│                 │    │                     │    │   asignación    │
└─────────────────┘    └─────────────────────┘    └─────────────────┘
                                                          │
                                                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            SECADO                                    │
│                                                                      │
│ • Seleccionar CANASTO(S) - puede ser el mismo u otros               │
│ • Seleccionar SECADORA(S) - múltiple asignación                     │
│ • Continúa el tracking de canastos                                   │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          PLANCHADO                                   │
│                                                                      │
│ • Seleccionar PLANCHADORA(S)                                        │
│ • Al FINALIZAR esta etapa → CANASTOS QUEDAN LIBRES automáticamente  │
│ • Los canastos vuelven a estado "disponible"                        │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CONTEO Y FINALIZACIÓN                            │
│                         (Última posta)                               │
│                                                                      │
│ • Conversión de KG → UNIDADES                                       │
│ • Seleccionar qué productos y cantidades (del catálogo)             │
│ • Sistema calcula precio según LISTA DE PRECIOS del cliente         │
│ • Muestra TOTAL a cobrar                                            │
│ • Al FINALIZAR:                                                      │
│   - Se genera REMITO automáticamente                                │
│   - Se ACREDITA el total con detalle a la CC del cliente            │
│   - Lote queda COMPLETADO                                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. DETALLE DE CADA POSTA

### 2.1 POSTA 1: En Camino
**Disparador:** El transportista recoge la ropa del cliente

| Campo | Descripción |
|-------|-------------|
| Cliente | Selección obligatoria del cliente |
| Fecha/Hora recogida | Timestamp automático |
| Observaciones | Notas del transportista |
| Transportista | Usuario que registra (automático) |

**Acciones:**
- Crea el lote en estado "en_camino"
- Notifica a recepción que viene un lote

---

### 2.2 POSTA 2: Recepción y Pesaje
**Disparador:** La ropa llega físicamente a la planta

| Campo | Descripción |
|-------|-------------|
| Peso entrada (kg) | **Obligatorio** - Pesaje en balanza |
| Fecha/Hora recepción | Timestamp automático |
| Observaciones | Estado de la ropa, manchas, roturas |
| Responsable | Usuario que recepciona |

**Acciones:**
- Registra el peso oficial del lote
- Lote pasa a estado "recepcionado"

---

### 2.3 POSTA 3: Lavado
**Disparador:** Se inicia el proceso de lavado

| Campo | Descripción |
|-------|-------------|
| Canasto(s) | **Múltiple selección** - Uno o más canastos (1-50) |
| Lavadora(s) | **Múltiple selección** - Una o más lavadoras |
| Fecha/Hora inicio | Timestamp automático |
| Fecha/Hora fin | Al finalizar etapa |
| Responsable | Operario que opera |

**Lógica especial:**
- Un lote puede usar **múltiples canastos** (ej: lote grande → canastos 1, 2 y 3)
- Un lote puede usar **múltiples lavadoras** simultáneamente
- Los canastos pasan a estado "en_uso" y se asocian al lote
- Las lavadoras pasan a estado "en_uso"

---

### 2.4 POSTA 4: Secado
**Disparador:** Termina el lavado, pasa a secado

| Campo | Descripción |
|-------|-------------|
| Canasto(s) | Puede mantener los mismos o cambiar |
| Secadora(s) | **Múltiple selección** - Una o más secadoras |
| Fecha/Hora inicio | Timestamp automático |
| Fecha/Hora fin | Al finalizar etapa |
| Responsable | Operario que opera |

**Lógica especial:**
- Puede reasignar canastos si es necesario
- Las secadoras pasan a estado "en_uso"

---

### 2.5 POSTA 5: Planchado
**Disparador:** Termina el secado, pasa a planchado

| Campo | Descripción |
|-------|-------------|
| Planchadora(s) | **Múltiple selección** |
| Fecha/Hora inicio | Timestamp automático |
| Fecha/Hora fin | Al finalizar etapa |
| Responsable | Operario que opera |

**Lógica especial - AL FINALIZAR:**
- **TODOS los canastos asignados al lote quedan LIBRES**
- Canastos vuelven a estado "disponible"
- Canastos quedan disponibles para asignar a otro lote

---

### 2.6 POSTA 6: Conteo y Finalización
**Disparador:** Termina el planchado, última etapa

| Campo | Descripción |
|-------|-------------|
| Productos | Selección del catálogo de productos |
| Cantidad por producto | Unidades de cada producto |
| Precio unitario | Auto-calculado según lista de precios del cliente |
| Subtotal por producto | cantidad × precio |
| **TOTAL** | Suma de todos los subtotales |
| Observaciones | Notas finales |

**Formulario de conversión kg → unidades:**
```
┌────────────────────────────────────────────────────────────────┐
│ LOTE: L260409-0001 | Cliente: Hotel Córdoba | Peso: 45.5 kg   │
├────────────────────────────────────────────────────────────────┤
│ Producto              │ Cantidad │ Precio Unit. │ Subtotal    │
├───────────────────────┼──────────┼──────────────┼─────────────┤
│ Toalla grande         │    50    │    $150      │   $7,500    │
│ Sábana 1 plaza        │    30    │    $200      │   $6,000    │
│ Funda almohada        │    40    │     $80      │   $3,200    │
│ Mantel común          │    10    │    $250      │   $2,500    │
├───────────────────────┴──────────┴──────────────┼─────────────┤
│                                          TOTAL: │  $19,200    │
└─────────────────────────────────────────────────┴─────────────┘
│ [+ Agregar producto]                                          │
│                                                               │
│ [ Cancelar ]                    [ Finalizar y Generar Remito ]│
└───────────────────────────────────────────────────────────────┘
```

**Lógica AL FINALIZAR:**
1. Se genera **REMITO** automáticamente con número correlativo
2. Se crea **CARGO en Cuenta Corriente** del cliente con:
   - Concepto: "Remito REM-260409-0001"
   - Monto: Total calculado
   - Detalle: Lista de productos y cantidades
   - Referencia: ID del remito
3. Lote pasa a estado **COMPLETADO**

---

## 3. SISTEMA DE CANASTOS/CARROS

### 3.1 Modelo de Datos
```
Canasto:
- id: UUID
- numero: Integer (1-50) ÚNICO
- codigo: String ("C-01", "C-02", ... "C-50")
- estado: Enum (disponible, en_uso, mantenimiento, fuera_servicio)
- capacidad_kg: Decimal (opcional, para validaciones)
- ubicacion: String (opcional)
- activo: Boolean
```

### 3.2 Relación con Lotes (Muchos a Muchos)
```
LoteCanasto:
- id: UUID
- lote_id: FK → LoteProduccion
- canasto_id: FK → Canasto
- etapa_id: FK → EtapaProduccion (en qué etapa se asignó)
- fecha_asignacion: DateTime
- fecha_liberacion: DateTime (nullable, cuando se libera)
- activo: Boolean
```

### 3.3 Estados del Canasto
| Estado | Descripción | Color UI |
|--------|-------------|----------|
| disponible | Libre para usar | Verde |
| en_uso | Asignado a un lote activo | Amarillo |
| mantenimiento | En reparación | Naranja |
| fuera_servicio | No disponible | Rojo |

### 3.4 Lógica de Liberación Automática
```python
# Al finalizar etapa de PLANCHADO:
def finalizar_planchado(lote_id):
    # ... lógica normal de finalizar etapa ...

    # Liberar TODOS los canastos del lote
    canastos_lote = db.query(LoteCanasto).filter(
        LoteCanasto.lote_id == lote_id,
        LoteCanasto.fecha_liberacion == None
    ).all()

    for asignacion in canastos_lote:
        asignacion.fecha_liberacion = datetime.utcnow()
        asignacion.canasto.estado = "disponible"

    db.commit()
```

---

## 4. CATÁLOGO DE PRODUCTOS DE LAVADO

### 4.1 Modelo de Datos
```
ProductoLavado:
- id: UUID
- codigo: String (único)
- nombre: String
- categoria: Enum (ver abajo)
- descripcion: String (opcional)
- peso_promedio_kg: Decimal (para estimaciones/sugerencias)
- activo: Boolean
```

### 4.2 Categorías y Productos
```
TOALLAS:
  - TOA-CH    Toalla chica
  - TOA-GR    Toalla grande
  - TOALLON   Toallón
  - TOA-PIL   Toallón de pileta

ROPA_CAMA:
  - FUNDA     Funda
  - FUNDON    Fundón
  - FUN-ALM   Funda y almohadón
  - FRAZADA   Frazada
  - CUB-CAM   Cubre cama
  - CUB-SOM   Cubre somier
  - ALMOHADA  Almohadas

MANTELERIA:
  - MAN-RED   Mantel redondo
  - MAN-GR    Mantel grande
  - MAN-COM   Mantel común
  - REPASAD   Repasadores
  - SERVILL   Servilletas
  - CUB-MAN   Cubremanteles
  - CAMINO    Caminos

ALFOMBRAS:
  - ALFOMB    Alfombrista
  - ALF-GR    Alfombra grande

CORTINAS:
  - CORT-1    Cortinas 1
  - CORT-2    Cortinas 2
  - CORT-3    Cortinas 3

OTROS:
  - ROPA-GAS  Ropa gastronómica
  - BATA      Batas
  - TRAPO-P   Trapo de piso
  - MAPA      Mapas
```

### 4.3 Integración con Listas de Precios
Los precios de cada producto vienen de la **Lista de Precios asignada al cliente**.

Tabla existente: `lista_precios` → `detalle_lista_precios`

Necesitamos agregar:
```
DetallePrecioProductoLavado:
- id: UUID
- lista_precios_id: FK
- producto_lavado_id: FK
- precio_unitario: Decimal
- activo: Boolean
```

---

## 5. MEJORAS A LA VISTA DE PRODUCCIÓN (KANBAN)

### 5.1 Información en cada Tarjeta de Lote
```
┌──────────────────────────────────────┐
│ L260409-0001          🟡 En Proceso  │
│ Hotel Córdoba                        │
├──────────────────────────────────────┤
│ ⚖️  45.5 kg                          │
│ 🧺 Canastos: 1, 2, 3                 │
│ 🔧 Lavadora: LAV-001, LAV-002        │
│ ⏱️  En esta etapa: 00:45:23          │
│ ⏱️  Tiempo total: 02:15:00           │
└──────────────────────────────────────┘
```

### 5.2 Footer de cada Columna/Posta
```
┌──────────────────────────────────────┐
│           LAVADO (3 lotes)           │
├──────────────────────────────────────┤
│  [Tarjeta Lote 1]                    │
│  [Tarjeta Lote 2]                    │
│  [Tarjeta Lote 3]                    │
├──────────────────────────────────────┤
│ 📊 Total por procesar: 125.5 kg      │
└──────────────────────────────────────┘
```

### 5.3 Timer en Tiempo Real
- Mostrar tiempo transcurrido desde que **inició** la etapa actual
- Mostrar tiempo **total** desde que el lote entró al sistema
- Actualizar cada segundo (o cada 30 seg para menos carga)

### 5.4 Indicadores Visuales
| Indicador | Significado |
|-----------|-------------|
| 🟢 Verde | Lote en tiempo normal |
| 🟡 Amarillo | Lote con más de 2 horas en etapa |
| 🔴 Rojo | Lote atrasado (supera fecha compromiso) |
| 🧺 Icono canasto | Muestra canastos asignados |
| ⚖️ Icono balanza | Peso del lote |

---

## 6. GENERACIÓN DE REMITOS

### 6.1 Modelo de Datos
```
Remito:
- id: UUID
- numero: String (REM-YYMMDD-XXXX) ÚNICO
- lote_id: FK → LoteProduccion
- cliente_id: FK → Cliente
- fecha_emision: Date
- peso_total_kg: Decimal
- total: Decimal
- estado: Enum (emitido, entregado, anulado)
- movimiento_cc_id: FK → MovimientoCuentaCorriente
- emitido_por_id: FK → Usuario
- notas: Text
- activo: Boolean

DetalleRemito:
- id: UUID
- remito_id: FK
- producto_lavado_id: FK
- cantidad: Integer
- precio_unitario: Decimal
- subtotal: Decimal
```

### 6.2 Flujo de Generación
```python
def generar_remito(lote_id, detalle_productos, usuario_id):
    # 1. Validar que el lote esté en etapa "Conteo y Finalización"
    # 2. Calcular totales
    # 3. Crear remito
    # 4. Crear detalle del remito
    # 5. Crear cargo en cuenta corriente del cliente
    # 6. Marcar lote como completado
    # 7. Retornar remito generado
```

---

## 7. FUNCIONALIDAD DE RELEVADO (Relavar prendas)

### 7.1 Concepto
Durante el **Conteo y Finalización**, el operario puede detectar que algunas prendas necesitan **volver a lavarse** (manchas que no salieron, mal olor, etc.).

En lugar de retrasar toda la entrega, se permite:
- **Separar las prendas a relavar**
- **Generar una entrega parcial** con lo que está listo
- **Crear un nuevo lote de relevado** que vuelve a entrar al proceso

### 7.2 Flujo de Relevado

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTEO Y FINALIZACIÓN                                │
│                                                                         │
│  LOTE: L260409-0001 | Cliente: Hotel Córdoba | Peso: 45.5 kg           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─ PRODUCTOS LISTOS ─────────────────────────────────────────────┐    │
│  │ Producto          │ Cantidad │ Precio │ Subtotal │ ¿Relavar?   │    │
│  ├───────────────────┼──────────┼────────┼──────────┼─────────────┤    │
│  │ Toalla grande     │    50    │  $150  │  $7,500  │ [ ] 5 uds   │    │
│  │ Sábana 1 plaza    │    30    │  $200  │  $6,000  │ [ ]         │    │
│  │ Funda almohada    │    40    │   $80  │  $3,200  │ [ ] 3 uds   │    │
│  │ Mantel común      │    10    │  $250  │  $2,500  │ [ ]         │    │
│  └───────────────────┴──────────┴────────┴──────────┴─────────────┘    │
│                                                                         │
│  ┌─ RESUMEN ──────────────────────────────────────────────────────┐    │
│  │ Total productos listos: 122 unidades      │ Total: $19,200     │    │
│  │ Productos a relavar: 8 unidades (5 toallas + 3 fundas)         │    │
│  │ Se genera ENTREGA PARCIAL                                      │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  [ Cancelar ]    [ Solo Entrega Parcial ]    [ Finalizar con Relevado ]│
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Opciones al Finalizar

| Opción | Descripción |
|--------|-------------|
| **Finalizar Normal** | Todo está listo, genera remito completo |
| **Finalizar con Relevado** | Genera remito parcial + crea lote de relevado |
| **Solo Entrega Parcial** | Genera remito parcial, sin crear lote de relevado aún |

### 7.4 ¿Qué pasa al "Finalizar con Relevado"?

```
LOTE ORIGINAL (L260409-0001)
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. ENTREGA PARCIAL                                              │
│    - Se genera REMITO con productos listos (122 - 8 = 114 uds)  │
│    - Se carga a CC del cliente el monto parcial                 │
│    - Lote original pasa a estado "PARCIALMENTE_COMPLETADO"      │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. NUEVO LOTE DE RELEVADO                                       │
│    - Número: L260409-0001-R1 (sufijo -R1, -R2, etc.)            │
│    - Cliente: mismo cliente                                     │
│    - Peso: se registra el peso de las prendas a relavar         │
│    - Referencia: "Relevado de L260409-0001"                     │
│    - Tipo: "relevado"                                           │
│    - Estado: entra a posta LAVADO directamente                  │
│    - Prioridad: ALTA (para no demorar más al cliente)           │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. FLUJO DEL LOTE DE RELEVADO                                   │
│                                                                  │
│    LAVADO → SECADO → PLANCHADO → CONTEO                         │
│                                      │                           │
│                                      ▼                           │
│                         Cuando finaliza el relevado:             │
│                         - Se genera REMITO COMPLEMENTARIO        │
│                         - Se carga el resto a la CC              │
│                         - Lote original pasa a "COMPLETADO"      │
└─────────────────────────────────────────────────────────────────┘
```

### 7.5 Modelo de Datos - Cambios

```python
# Agregar a LoteProduccion:
class LoteProduccion:
    # ... campos existentes ...

    # Nuevos campos para relevado
    tipo_lote: Enum = "normal"  # normal, relevado
    lote_padre_id: UUID = None  # FK a LoteProduccion (si es relevado)
    estado: Enum  # Agregar: "parcialmente_completado"

# Relación
lote_padre = relationship("LoteProduccion", remote_side=[id])
lotes_relevado = relationship("LoteProduccion", back_populates="lote_padre")
```

### 7.6 Estados del Lote (actualizado)

| Estado | Descripción |
|--------|-------------|
| en_camino | Transportista recogiendo |
| recepcionado | Pesado y registrado |
| en_proceso | En alguna etapa de producción |
| pausado | Detenido temporalmente |
| **parcialmente_completado** | Entrega parcial hecha, pendiente relevado |
| completado | Todo entregado |
| cancelado | Cancelado |

### 7.7 Visualización en Kanban

```
┌──────────────────────────────────────┐
│ L260409-0001-R1      🔴 RELEVADO     │
│ Hotel Córdoba                        │
├──────────────────────────────────────┤
│ ⚖️  2.5 kg                           │
│ 📦 Relevado de: L260409-0001         │
│ 🔄 5 toallas + 3 fundas              │
│ ⚡ Prioridad: ALTA                   │
│ ⏱️  En esta etapa: 00:15:00          │
└──────────────────────────────────────┘
```

- Badge **"RELEVADO"** en color distintivo (rojo/naranja)
- Referencia al lote original
- Detalle de qué prendas se están relavando
- Prioridad alta visible

### 7.8 Tracking de Entregas Parciales

En el detalle del cliente, mostrar:

```
┌─────────────────────────────────────────────────────────────────┐
│ ENTREGAS PENDIENTES - Hotel Córdoba                             │
├─────────────────────────────────────────────────────────────────┤
│ Lote          │ Estado              │ Pendiente   │ Acción      │
├───────────────┼─────────────────────┼─────────────┼─────────────┤
│ L260409-0001  │ Parcial (90%)       │ 8 prendas   │ Ver detalle │
│               │ Relevado en proceso │ en lavado   │             │
└───────────────┴─────────────────────┴─────────────┴─────────────┘
```

### 7.9 Remitos Parciales y Complementarios

**Remito Parcial (al hacer entrega parcial):**
```
REMITO REM-260409-0001
Cliente: Hotel Córdoba
Fecha: 09/04/2026
Estado: ENTREGA PARCIAL

Detalle:
- 45 Toallas grandes     $6,750
- 30 Sábanas 1 plaza     $6,000
- 37 Fundas almohada     $2,960
- 10 Manteles comunes    $2,500
─────────────────────────────────
TOTAL PARCIAL:          $18,210

NOTA: Pendiente de entregar: 5 toallas, 3 fundas (en proceso de relevado)
```

**Remito Complementario (cuando termina el relevado):**
```
REMITO REM-260409-0001-C
Cliente: Hotel Córdoba
Fecha: 10/04/2026
Estado: COMPLEMENTO DE REM-260409-0001

Detalle:
- 5 Toallas grandes      $750
- 3 Fundas almohada      $240
─────────────────────────────────
TOTAL COMPLEMENTARIO:    $990

Referencia: Relevado de lote L260409-0001
```

---

## 8. EDICIÓN DE MOVIMIENTOS DE CUENTA CORRIENTE

### 7.1 Nuevos Endpoints
```
PUT  /clientes/{cliente_id}/cuenta-corriente/movimientos/{mov_id}
DELETE /clientes/{cliente_id}/cuenta-corriente/movimientos/{mov_id}
```

### 7.2 Campos Editables
- concepto
- monto (recalcula saldos posteriores)
- fecha_movimiento
- notas
- estado_facturacion
- factura_numero

### 7.3 Validaciones
- Solo usuarios con rol `administrador`, `contador` o `superadmin`
- Log de auditoría obligatorio con valores anteriores y nuevos
- Recálculo automático de todos los saldos posteriores

### 7.4 Lógica de Recálculo
```python
def editar_movimiento(mov_id, nuevo_monto):
    movimiento = get_movimiento(mov_id)
    diferencia = nuevo_monto - movimiento.monto

    # Actualizar este movimiento
    movimiento.monto = nuevo_monto
    movimiento.saldo_posterior += diferencia

    # Recalcular TODOS los movimientos posteriores
    movimientos_posteriores = get_movimientos_despues_de(movimiento)
    for mov in movimientos_posteriores:
        mov.saldo_anterior += diferencia
        mov.saldo_posterior += diferencia

    # Actualizar saldo actual del cliente
    cliente.saldo_cuenta_corriente += diferencia
```

---

## 9. PLAN DE IMPLEMENTACIÓN ACTUALIZADO

### FASE 1: Fundamentos (Backend - Migraciones)

1. Migración: Crear tabla `canastos` (50 registros)
2. Migración: Crear tabla `lotes_canastos` (relación M:M)
3. Migración: Crear tabla `productos_lavado` (catálogo)
4. Migración: Crear tabla `detalle_precio_producto_lavado`
5. Migración: Crear tabla `remitos` y `detalle_remitos`
6. Migración: Modificar `etapas_produccion` (ajustar las 6 postas)
7. Migración: Agregar campos a `lotes_etapas` para múltiples máquinas
8. Migración: Agregar campos de relevado a `lotes_produccion`:
   - `tipo_lote` (normal, relevado)
   - `lote_padre_id` (FK nullable)
   - Nuevo estado: `parcialmente_completado`

### FASE 2: Lógica de Negocio (Backend Services)

1. `CanastoService`: CRUD + asignación/liberación
2. `ProductoLavadoService`: CRUD
3. Modificar `ProduccionService`:
   - Múltiples canastos por lote
   - Múltiples máquinas por etapa
   - Liberación automática post-planchado
   - **Lógica de relevado**: crear lote hijo, entrega parcial
4. `RemitoService`:
   - Generación de remitos normales
   - **Remitos parciales y complementarios**
   - Cargo a CC
   - **Generación de PDF**
5. Modificar `ClienteService`: Edición de movimientos CC

### FASE 3: Endpoints (Backend API)

1. `/produccion/canastos` - CRUD
2. `/produccion/productos-lavado` - CRUD
3. `/produccion/lotes/{id}/canastos` - Asignar/liberar
4. `/produccion/lotes/{id}/generar-remito` - Finalización normal
5. **`/produccion/lotes/{id}/finalizar-con-relevado`** - Entrega parcial + crear lote relevado
6. `/remitos` - Listado y detalle
7. **`/remitos/{id}/pdf`** - Generar PDF del remito
8. `/clientes/{id}/cuenta-corriente/movimientos/{id}` - Edición
9. **`/clientes/{id}/entregas-pendientes`** - Lotes con entrega parcial

### FASE 4: Frontend - Producción

1. Nueva página: Gestión de Canastos (grid visual 50 canastos)
2. Nueva página: Catálogo de Productos
3. Modificar Kanban:
   - Mostrar canastos en tarjetas
   - Total kg por columna
   - Timer en tiempo real
   - **Badge "RELEVADO" para lotes de relevado**
   - **Indicador de prioridad alta**
4. Modal de Lavado/Secado: Selección múltiple de canastos y máquinas
5. Nueva posta "Conteo y Finalización":
   - Formulario de conversión kg → unidades
   - **Checkbox "Relavar" por cada producto**
   - **Input cantidad a relavar**
   - **Botón "Finalizar con Relevado"**
6. **Modal de confirmación de relevado** (resumen de lo que se entrega vs lo que se relava)

### FASE 5: Frontend - Clientes

1. Botón editar en tabla de movimientos CC
2. Modal de edición
3. Confirmación y recálculo
4. **Nueva sección: "Entregas Pendientes"** (lotes parcialmente completados)

### FASE 6: Seed Data

1. Crear 50 canastos (C-01 a C-50)
2. Crear catálogo de productos (25+ productos)
3. Actualizar etapas de producción (6 postas)
4. Crear usuarios transportistas (si no existen)

---

## 10. PREGUNTAS RESUELTAS

| Pregunta | Respuesta |
|----------|-----------|
| ¿Múltiples canastos por lote? | ✅ SÍ, un lote puede usar varios canastos |
| ¿Múltiples máquinas por etapa? | ✅ SÍ, puede usar varias lavadoras/secadoras |
| ¿Cuándo se liberan los canastos? | Al finalizar PLANCHADO |
| ¿Quién crea el lote? | El transportista al recoger la ropa |
| ¿Precio de productos? | Según lista de precios del cliente |
| ¿Se genera remito automático? | ✅ SÍ, al finalizar última posta |
| ¿Se carga a CC automático? | ✅ SÍ, junto con el remito |
| ¿Capacidad de canastos? | ❌ NO, todos son del mismo tamaño |
| ¿Remito PDF? | ✅ SÍ, necesitan PDF imprimible |
| ¿Transportistas son usuarios? | ✅ SÍ, son empleados con acceso al sistema |
| ¿Se puede relavar prendas? | ✅ SÍ, entrega parcial + lote de relevado |

---

## 11. PREGUNTAS PENDIENTES

1. **Módulo de reparto:** ¿Alcance completo? ¿Para cuándo?
2. **Formato exacto del PDF del remito:** ¿Logo, datos fiscales, QR?
3. **Notificaciones:** ¿Avisar al cliente cuando hay relevado?

---

*Documento actualizado el 9 de Abril 2026*
