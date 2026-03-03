# Crear Migración Alembic

Crea una migración de base de datos con Alembic para el proyecto DUWHITE.

## Parámetros
- **$ARGUMENTS**: Descripción de la migración (ej: "add clientes table", "add column telefono to proveedores")

## Instrucciones

### 1. Verificar modelo actualizado

Asegúrate de que el modelo SQLAlchemy esté correctamente definido en `backend/app/models/`.

### 2. Generar migración automática

```bash
cd backend
alembic revision --autogenerate -m "$ARGUMENTS"
```

### 3. Revisar migración generada

Abrir el archivo generado en `backend/alembic/versions/` y verificar:

```python
# Ejemplo de migración
def upgrade() -> None:
    op.create_table(
        'clientes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tipo', sa.Enum('empresa', 'particular', name='tipo_cliente'), nullable=False),
        sa.Column('razon_social', sa.String(255), nullable=False),
        sa.Column('cuit_cuil_dni', sa.String(20), unique=True, nullable=False),
        sa.Column('condicion_iva', sa.Enum('responsable_inscripto', 'monotributista', 'consumidor_final', 'exento', name='condicion_iva'), nullable=False),
        # ... más columnas
        sa.Column('activo', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Crear índices
    op.create_index('ix_clientes_cuit', 'clientes', ['cuit_cuil_dni'])
    op.create_index('ix_clientes_razon_social', 'clientes', ['razon_social'])


def downgrade() -> None:
    op.drop_index('ix_clientes_razon_social')
    op.drop_index('ix_clientes_cuit')
    op.drop_table('clientes')
    op.execute('DROP TYPE tipo_cliente')
    op.execute('DROP TYPE condicion_iva')
```

### 4. Aplicar migración

```bash
# Desarrollo
alembic upgrade head

# Ver estado
alembic current
alembic history

# Rollback (si es necesario)
alembic downgrade -1
```

## Convenciones DUWHITE

### Campos Obligatorios en Todas las Tablas
```python
sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
sa.Column('activo', sa.Boolean(), default=True)
sa.Column('created_at', sa.DateTime(), default=sa.func.now())
sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now())
```

### Tipos de Datos Frecuentes
```python
# UUID
sa.Column('id', postgresql.UUID(as_uuid=True))

# Moneda (decimales)
sa.Column('precio', sa.Numeric(12, 2))

# CUIT/CUIL
sa.Column('cuit', sa.String(20))

# Enums
sa.Enum('valor1', 'valor2', name='nombre_enum')

# JSON
sa.Column('configuracion', postgresql.JSONB)

# Foreign Key
sa.Column('cliente_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clientes.id'))
```

### Índices Recomendados
```python
# Búsqueda frecuente
op.create_index('ix_{tabla}_{campo}', '{tabla}', ['{campo}'])

# Búsqueda compuesta
op.create_index('ix_{tabla}_{campo1}_{campo2}', '{tabla}', ['{campo1}', '{campo2}'])

# Unique constraint
op.create_unique_constraint('uq_{tabla}_{campo}', '{tabla}', ['{campo}'])
```

## Ejemplo de uso
```
/crear-migracion add empleados table
/crear-migracion add fecha_vencimiento to insumos
```
