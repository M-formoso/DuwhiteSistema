# Skill: Flujo de Producción DUWHITE

Instrucciones para implementar el módulo de producción de lavandería industrial.

## Etapas del Proceso Productivo

```
1. RECEPCIÓN → 2. CLASIFICACIÓN → 3. LAVADO → 4. SECADO →
5. PLANCHADO → 6. DOBLADO → 7. CONTROL CALIDAD → 8. DESPACHO → 9. ENTREGADO
```

### Detalle de Etapas

| # | Etapa | Descripción | Responsable |
|---|-------|-------------|-------------|
| 1 | Recepción | Ingreso de ropa sucia. Pesaje, clasificación, conteo | Operador |
| 2 | Clasificación | Separación por tipo de tela, color, nivel de suciedad | Operador |
| 3 | Lavado | Proceso de lavado en máquinas industriales | Operador |
| 4 | Secado | Proceso de secado en secadoras | Operador |
| 5 | Planchado | Planchado industrial (calandras, manuales) | Operador |
| 6 | Doblado/Embalaje | Doblado, embolsado, etiquetado | Operador |
| 7 | Control Calidad | Inspección final (manchas, daños, olor) | Jefe Producción |
| 8 | Despacho | Preparación para entrega, asignación a ruta | Logística |
| 9 | Entregado | Confirmación de entrega al cliente | Logística |

---

## Modelo de Datos

### Orden de Producción
```python
class OrdenProduccion(Base):
    __tablename__ = "ordenes_produccion"

    id = Column(UUID, primary_key=True)
    numero_orden = Column(String(20), unique=True)  # OP-2026-0001
    cliente_id = Column(UUID, ForeignKey("clientes.id"))
    pedido_id = Column(UUID, ForeignKey("pedidos.id"), nullable=True)

    fecha_ingreso = Column(Date)
    fecha_entrega_prometida = Column(Date)
    prioridad = Column(Enum("normal", "urgente", "express"))

    peso_total_kg = Column(Numeric(10, 2))
    cantidad_prendas = Column(Integer)
    tipo_lavado = Column(String(100))
    instrucciones_especiales = Column(Text)

    estado = Column(Enum("pendiente", "en_proceso", "completada", "entregada", "cancelada"))

    # Costos calculados
    costo_insumos = Column(Numeric(12, 2), default=0)
    costo_mano_obra = Column(Numeric(12, 2), default=0)
    costo_total = Column(Numeric(12, 2), default=0)

    # Relaciones
    etapas = relationship("EtapaProduccionRegistro", back_populates="orden")
    consumos = relationship("ConsumoProduccion", back_populates="orden")
    incidencias = relationship("IncidenciaProduccion", back_populates="orden")
```

### Registro de Etapas
```python
class EtapaProduccionRegistro(Base):
    __tablename__ = "etapas_produccion_registro"

    id = Column(UUID, primary_key=True)
    orden_produccion_id = Column(UUID, ForeignKey("ordenes_produccion.id"))
    etapa_config_id = Column(UUID, ForeignKey("etapas_produccion_config.id"))

    estado = Column(Enum("pendiente", "en_proceso", "completada", "saltada"))
    empleado_id = Column(UUID, ForeignKey("empleados.id"), nullable=True)

    fecha_inicio = Column(DateTime)
    fecha_fin = Column(DateTime)
    duracion_minutos = Column(Integer)  # Calculado

    observaciones = Column(Text)
```

---

## Flujo de Estados

```
ORDEN DE PRODUCCIÓN:
pendiente ─────────────────────┐
    │                          │
    ▼                          │
en_proceso ───────────────────>│──> cancelada
    │                          │
    ▼                          │
completada ────────────────────┘
    │
    ▼
entregada

ETAPA:
pendiente → en_proceso → completada
                     └─> saltada (si se omite)
```

---

## Implementación del Tablero Kanban

### Frontend (React)
```tsx
// components/produccion/KanbanBoard.tsx

interface KanbanColumn {
  id: string;
  title: string;
  orders: OrdenProduccion[];
}

const COLUMNAS_KANBAN: KanbanColumn[] = [
  { id: 'recepcion', title: 'Recepción', orders: [] },
  { id: 'clasificacion', title: 'Clasificación', orders: [] },
  { id: 'lavado', title: 'Lavado', orders: [] },
  { id: 'secado', title: 'Secado', orders: [] },
  { id: 'planchado', title: 'Planchado', orders: [] },
  { id: 'doblado', title: 'Doblado', orders: [] },
  { id: 'control_calidad', title: 'Control Calidad', orders: [] },
  { id: 'despacho', title: 'Despacho', orders: [] },
];

export function KanbanBoard() {
  const { data: ordenes } = useQuery({
    queryKey: ['produccion', 'kanban'],
    queryFn: () => produccionService.obtenerKanban(),
  });

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNAS_KANBAN.map((columna) => (
        <KanbanColumn
          key={columna.id}
          title={columna.title}
          orders={ordenes?.filter(o => o.etapaActual === columna.id) ?? []}
        />
      ))}
    </div>
  );
}

function KanbanColumn({ title, orders }: { title: string; orders: OrdenProduccion[] }) {
  return (
    <div className="flex-shrink-0 w-72 bg-gray-100 rounded-lg p-3">
      <h3 className="font-semibold text-gray-700 mb-3 flex items-center justify-between">
        {title}
        <Badge variant="secondary">{orders.length}</Badge>
      </h3>
      <div className="space-y-2">
        {orders.map((orden) => (
          <KanbanCard key={orden.id} orden={orden} />
        ))}
      </div>
    </div>
  );
}

function KanbanCard({ orden }: { orden: OrdenProduccion }) {
  const prioridadColor = {
    normal: 'border-l-green-500',
    urgente: 'border-l-yellow-500',
    express: 'border-l-red-500',
  };

  const esRetrasada = new Date(orden.fechaEntregaPrometida) < new Date();

  return (
    <Card className={cn(
      'border-l-4 cursor-pointer hover:shadow-md transition-shadow',
      prioridadColor[orden.prioridad],
      esRetrasada && 'bg-red-50'
    )}>
      <CardContent className="p-3">
        <div className="flex justify-between items-start mb-2">
          <span className="font-mono text-sm font-medium">{orden.numeroOrden}</span>
          <Badge variant={orden.prioridad === 'express' ? 'destructive' : 'outline'}>
            {orden.prioridad}
          </Badge>
        </div>
        <p className="text-sm text-gray-600 truncate">{orden.cliente.nombreFantasia}</p>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{orden.pesoTotalKg} kg</span>
          <span>{formatearFecha(orden.fechaEntregaPrometida)}</span>
        </div>
        {esRetrasada && (
          <p className="text-xs text-red-600 mt-1 font-medium">⚠️ RETRASADA</p>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Vista del Operario (Mobile-First)

```tsx
// pages/produccion/operario.tsx

export function VistaOperario() {
  const { user } = useAuth();
  const { data: ordenesAsignadas } = useQuery({
    queryKey: ['produccion', 'mis-ordenes', user.empleadoId],
    queryFn: () => produccionService.obtenerOrdenesOperario(user.empleadoId),
  });

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Mis Órdenes</h1>

      {ordenesAsignadas?.map((orden) => (
        <Card key={orden.id} className="mb-4">
          <CardHeader>
            <CardTitle className="flex justify-between">
              <span>{orden.numeroOrden}</span>
              <Badge>{orden.etapaActual}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">{orden.cliente.nombreFantasia}</p>

            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <p className="text-gray-500">Peso</p>
                <p className="font-medium">{orden.pesoTotalKg} kg</p>
              </div>
              <div>
                <p className="text-gray-500">Entrega</p>
                <p className="font-medium">{formatearFecha(orden.fechaEntregaPrometida)}</p>
              </div>
            </div>

            {orden.instruccionesEspeciales && (
              <Alert className="mb-4">
                <AlertDescription>{orden.instruccionesEspeciales}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => iniciarEtapa(orden.id)}
                disabled={orden.etapaEnCurso}
              >
                {orden.etapaEnCurso ? 'En proceso...' : 'Iniciar'}
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => finalizarEtapa(orden.id)}
                disabled={!orden.etapaEnCurso}
              >
                Finalizar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

---

## Consumo de Insumos por Orden

```python
# services/produccion_service.py

def registrar_consumo_insumo(
    db: Session,
    orden_id: UUID,
    insumo_id: UUID,
    cantidad: Decimal,
    etapa_id: UUID | None,
    usuario_id: UUID
) -> ConsumoProduccion:
    """
    Registra consumo de insumo en una orden de producción.
    - Descuenta automáticamente del stock
    - Actualiza costo de la orden
    """
    # Verificar stock disponible
    insumo = db.query(Insumo).filter(Insumo.id == insumo_id).first()
    if not insumo:
        raise HTTPException(404, "Insumo no encontrado")

    if insumo.stock_actual < cantidad:
        raise HTTPException(400, f"Stock insuficiente. Disponible: {insumo.stock_actual}")

    # Crear registro de consumo
    consumo = ConsumoProduccion(
        orden_produccion_id=orden_id,
        insumo_id=insumo_id,
        cantidad=cantidad,
        precio_unitario=insumo.precio_unitario_costo,
        subtotal=cantidad * insumo.precio_unitario_costo,
        etapa_registro_id=etapa_id,
        registrado_por=usuario_id,
    )
    db.add(consumo)

    # Descontar stock
    stock_service.descontar_stock(
        db=db,
        insumo_id=insumo_id,
        cantidad=cantidad,
        tipo_movimiento="egreso_produccion",
        referencia_tipo="orden_produccion",
        referencia_id=orden_id,
        usuario_id=usuario_id,
    )

    # Actualizar costo de la orden
    orden = db.query(OrdenProduccion).filter(OrdenProduccion.id == orden_id).first()
    orden.costo_insumos += consumo.subtotal
    orden.costo_total = orden.costo_insumos + orden.costo_mano_obra

    db.commit()
    return consumo
```

---

## Endpoints de Producción

```
GET    /api/v1/produccion/ordenes              # Listar órdenes
POST   /api/v1/produccion/ordenes              # Crear orden
GET    /api/v1/produccion/ordenes/{id}         # Detalle orden
PUT    /api/v1/produccion/ordenes/{id}         # Actualizar orden
DELETE /api/v1/produccion/ordenes/{id}         # Cancelar orden

GET    /api/v1/produccion/ordenes/{id}/etapas  # Ver etapas de la orden
POST   /api/v1/produccion/ordenes/{id}/etapas/{etapa}/iniciar
POST   /api/v1/produccion/ordenes/{id}/etapas/{etapa}/finalizar
POST   /api/v1/produccion/ordenes/{id}/etapas/{etapa}/incidencia

POST   /api/v1/produccion/ordenes/{id}/consumir-insumo
GET    /api/v1/produccion/ordenes/{id}/insumos-consumidos
GET    /api/v1/produccion/ordenes/{id}/costo

GET    /api/v1/produccion/kanban               # Vista Kanban
GET    /api/v1/produccion/ordenes/retrasadas   # Órdenes retrasadas
GET    /api/v1/produccion/mis-ordenes          # Órdenes del operario actual
```

## Checklist de Implementación

- [ ] Modelos: OrdenProduccion, EtapaConfig, EtapaRegistro, Incidencia, Consumo
- [ ] Servicio con flujo de estados
- [ ] Endpoints con permisos
- [ ] Consumo de insumos con descuento de stock
- [ ] Vista Kanban (desktop)
- [ ] Vista Operario (mobile)
- [ ] Alertas de órdenes retrasadas
- [ ] Cálculo de costos por orden
