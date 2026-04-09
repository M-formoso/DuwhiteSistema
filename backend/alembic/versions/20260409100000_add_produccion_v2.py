"""Add produccion v2: canastos, productos_lavado, remitos, relevado

Revision ID: 20260409100000
Revises: 20260408100000
Create Date: 2026-04-09 10:00:00.000000

Esta migración agrega:
1. Tabla canastos (50 carros de producción)
2. Tabla lotes_canastos (relación M:M entre lotes y canastos)
3. Tabla productos_lavado (catálogo de prendas)
4. Tabla precios_productos_lavado (precios por lista)
5. Tabla remitos y detalles_remito
6. Campos de relevado en lotes_produccion
7. Actualiza etapas de producción (6 postas)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260409100000'
down_revision = '20260408100000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Crear tabla canastos
    op.create_table(
        'canastos',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('numero', sa.Integer(), nullable=False, unique=True),
        sa.Column('codigo', sa.String(10), nullable=False, unique=True),
        sa.Column('estado', sa.String(20), nullable=False, default='disponible'),
        sa.Column('ubicacion', sa.String(100), nullable=True),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_canastos_numero', 'canastos', ['numero'])
    op.create_index('ix_canastos_estado', 'canastos', ['estado'])

    # 2. Crear tabla lotes_canastos (relación M:M)
    op.create_table(
        'lotes_canastos',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('lote_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lotes_produccion.id'), nullable=False),
        sa.Column('canasto_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('canastos.id'), nullable=False),
        sa.Column('etapa_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('etapas_produccion.id'), nullable=True),
        sa.Column('fecha_asignacion', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('fecha_liberacion', sa.DateTime(), nullable=True),
        sa.Column('asignado_por_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.id'), nullable=True),
        sa.Column('liberado_por_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.id'), nullable=True),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_lotes_canastos_lote_id', 'lotes_canastos', ['lote_id'])
    op.create_index('ix_lotes_canastos_canasto_id', 'lotes_canastos', ['canasto_id'])

    # 3. Crear tabla productos_lavado
    op.create_table(
        'productos_lavado',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('codigo', sa.String(20), nullable=False, unique=True),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('categoria', sa.String(30), nullable=False, default='otros'),
        sa.Column('peso_promedio_kg', sa.Numeric(6, 3), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_productos_lavado_codigo', 'productos_lavado', ['codigo'])
    op.create_index('ix_productos_lavado_categoria', 'productos_lavado', ['categoria'])

    # 4. Crear tabla precios_productos_lavado
    op.create_table(
        'precios_productos_lavado',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('lista_precios_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('producto_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('productos_lavado.id'), nullable=False),
        sa.Column('precio_unitario', sa.Numeric(12, 2), nullable=False),
        sa.Column('activo', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_precios_productos_lavado_lista', 'precios_productos_lavado', ['lista_precios_id'])
    op.create_index('ix_precios_productos_lavado_producto', 'precios_productos_lavado', ['producto_id'])

    # 5. Crear tabla remitos
    op.create_table(
        'remitos',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('numero', sa.String(20), nullable=False, unique=True),
        sa.Column('lote_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lotes_produccion.id'), nullable=False),
        sa.Column('cliente_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clientes.id'), nullable=False),
        sa.Column('tipo', sa.String(20), nullable=False, default='normal'),
        sa.Column('estado', sa.String(20), nullable=False, default='borrador'),
        sa.Column('fecha_emision', sa.Date(), nullable=False),
        sa.Column('fecha_entrega', sa.DateTime(), nullable=True),
        sa.Column('peso_total_kg', sa.Numeric(10, 2), nullable=True),
        sa.Column('subtotal', sa.Numeric(14, 2), nullable=False, default=0),
        sa.Column('descuento', sa.Numeric(14, 2), nullable=False, default=0),
        sa.Column('total', sa.Numeric(14, 2), nullable=False, default=0),
        sa.Column('remito_padre_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('remitos.id'), nullable=True),
        sa.Column('movimiento_cc_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('movimientos_cuenta_corriente.id'), nullable=True),
        sa.Column('emitido_por_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.id'), nullable=True),
        sa.Column('entregado_por_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.id'), nullable=True),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('notas_entrega', sa.Text(), nullable=True),
        sa.Column('fecha_anulacion', sa.DateTime(), nullable=True),
        sa.Column('motivo_anulacion', sa.Text(), nullable=True),
        sa.Column('anulado_por_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.id'), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_remitos_numero', 'remitos', ['numero'])
    op.create_index('ix_remitos_lote_id', 'remitos', ['lote_id'])
    op.create_index('ix_remitos_cliente_id', 'remitos', ['cliente_id'])
    op.create_index('ix_remitos_estado', 'remitos', ['estado'])

    # 6. Crear tabla detalles_remito
    op.create_table(
        'detalles_remito',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('remito_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('remitos.id'), nullable=False),
        sa.Column('producto_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('productos_lavado.id'), nullable=False),
        sa.Column('cantidad', sa.Integer(), nullable=False),
        sa.Column('precio_unitario', sa.Numeric(12, 2), nullable=False),
        sa.Column('subtotal', sa.Numeric(14, 2), nullable=False),
        sa.Column('descripcion', sa.String(255), nullable=True),
        sa.Column('pendiente_relevado', sa.Boolean(), nullable=False, default=False),
        sa.Column('cantidad_relevado', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_detalles_remito_remito_id', 'detalles_remito', ['remito_id'])

    # 7. Agregar campos de relevado a lotes_produccion
    op.add_column('lotes_produccion', sa.Column('tipo_lote', sa.String(20), nullable=True, default='normal'))
    op.add_column('lotes_produccion', sa.Column('lote_padre_id', postgresql.UUID(as_uuid=True), nullable=True))

    # Crear FK para lote_padre_id
    op.create_foreign_key(
        'fk_lotes_produccion_lote_padre',
        'lotes_produccion', 'lotes_produccion',
        ['lote_padre_id'], ['id']
    )
    op.create_index('ix_lotes_produccion_tipo_lote', 'lotes_produccion', ['tipo_lote'])
    op.create_index('ix_lotes_produccion_lote_padre_id', 'lotes_produccion', ['lote_padre_id'])

    # Actualizar tipo_lote existentes a 'normal'
    op.execute("UPDATE lotes_produccion SET tipo_lote = 'normal' WHERE tipo_lote IS NULL")
    op.alter_column('lotes_produccion', 'tipo_lote', nullable=False)

    # 8. Hacer tipo_servicio nullable (deprecado)
    op.alter_column('lotes_produccion', 'tipo_servicio', nullable=True)

    # 9. Insertar los 50 canastos
    from uuid import uuid4
    canastos_data = []
    for i in range(1, 51):
        canastos_data.append({
            'id': str(uuid4()),
            'numero': i,
            'codigo': f'C-{i:02d}',
            'estado': 'disponible',
            'activo': True
        })

    op.bulk_insert(
        sa.table(
            'canastos',
            sa.column('id', postgresql.UUID),
            sa.column('numero', sa.Integer),
            sa.column('codigo', sa.String),
            sa.column('estado', sa.String),
            sa.column('activo', sa.Boolean),
        ),
        canastos_data
    )

    # 10. Insertar productos de lavado
    productos_data = [
        # Toallas
        {'codigo': 'TOA-CH', 'nombre': 'Toalla chica', 'categoria': 'toallas', 'peso_promedio_kg': 0.15},
        {'codigo': 'TOA-GR', 'nombre': 'Toalla grande', 'categoria': 'toallas', 'peso_promedio_kg': 0.35},
        {'codigo': 'TOALLON', 'nombre': 'Toallón', 'categoria': 'toallas', 'peso_promedio_kg': 0.50},
        {'codigo': 'TOA-PIL', 'nombre': 'Toallón de pileta', 'categoria': 'toallas', 'peso_promedio_kg': 0.60},
        # Ropa de cama
        {'codigo': 'FUNDA', 'nombre': 'Funda', 'categoria': 'ropa_cama', 'peso_promedio_kg': 0.20},
        {'codigo': 'FUNDON', 'nombre': 'Fundón', 'categoria': 'ropa_cama', 'peso_promedio_kg': 0.80},
        {'codigo': 'FUN-ALM', 'nombre': 'Funda y almohadón', 'categoria': 'ropa_cama', 'peso_promedio_kg': 0.30},
        {'codigo': 'FRAZADA', 'nombre': 'Frazada', 'categoria': 'ropa_cama', 'peso_promedio_kg': 1.50},
        {'codigo': 'CUB-CAM', 'nombre': 'Cubre cama', 'categoria': 'ropa_cama', 'peso_promedio_kg': 1.20},
        {'codigo': 'CUB-SOM', 'nombre': 'Cubre somier', 'categoria': 'ropa_cama', 'peso_promedio_kg': 0.80},
        {'codigo': 'ALMOHADA', 'nombre': 'Almohada', 'categoria': 'ropa_cama', 'peso_promedio_kg': 0.70},
        # Mantelería
        {'codigo': 'MAN-RED', 'nombre': 'Mantel redondo', 'categoria': 'manteleria', 'peso_promedio_kg': 0.40},
        {'codigo': 'MAN-GR', 'nombre': 'Mantel grande', 'categoria': 'manteleria', 'peso_promedio_kg': 0.50},
        {'codigo': 'MAN-COM', 'nombre': 'Mantel común', 'categoria': 'manteleria', 'peso_promedio_kg': 0.30},
        {'codigo': 'REPASAD', 'nombre': 'Repasador', 'categoria': 'manteleria', 'peso_promedio_kg': 0.05},
        {'codigo': 'SERVILL', 'nombre': 'Servilleta', 'categoria': 'manteleria', 'peso_promedio_kg': 0.03},
        {'codigo': 'CUB-MAN', 'nombre': 'Cubremantel', 'categoria': 'manteleria', 'peso_promedio_kg': 0.25},
        {'codigo': 'CAMINO', 'nombre': 'Camino', 'categoria': 'manteleria', 'peso_promedio_kg': 0.15},
        # Alfombras
        {'codigo': 'ALFOMB', 'nombre': 'Alfombrista', 'categoria': 'alfombras', 'peso_promedio_kg': 0.40},
        {'codigo': 'ALF-GR', 'nombre': 'Alfombra grande', 'categoria': 'alfombras', 'peso_promedio_kg': 1.00},
        # Cortinas
        {'codigo': 'CORT-1', 'nombre': 'Cortina tipo 1', 'categoria': 'cortinas', 'peso_promedio_kg': 0.80},
        {'codigo': 'CORT-2', 'nombre': 'Cortina tipo 2', 'categoria': 'cortinas', 'peso_promedio_kg': 1.20},
        {'codigo': 'CORT-3', 'nombre': 'Cortina tipo 3', 'categoria': 'cortinas', 'peso_promedio_kg': 1.50},
        # Otros
        {'codigo': 'ROPA-GAS', 'nombre': 'Ropa gastronómica', 'categoria': 'otros', 'peso_promedio_kg': 0.30},
        {'codigo': 'BATA', 'nombre': 'Bata', 'categoria': 'otros', 'peso_promedio_kg': 0.50},
        {'codigo': 'TRAPO-P', 'nombre': 'Trapo de piso', 'categoria': 'otros', 'peso_promedio_kg': 0.20},
        {'codigo': 'MAPA', 'nombre': 'Mapa', 'categoria': 'otros', 'peso_promedio_kg': 0.25},
    ]

    for p in productos_data:
        p['id'] = str(uuid4())
        p['activo'] = True

    op.bulk_insert(
        sa.table(
            'productos_lavado',
            sa.column('id', postgresql.UUID),
            sa.column('codigo', sa.String),
            sa.column('nombre', sa.String),
            sa.column('categoria', sa.String),
            sa.column('peso_promedio_kg', sa.Numeric),
            sa.column('activo', sa.Boolean),
        ),
        productos_data
    )


def downgrade() -> None:
    # Eliminar tablas en orden inverso
    op.drop_table('detalles_remito')
    op.drop_table('remitos')
    op.drop_table('precios_productos_lavado')
    op.drop_table('productos_lavado')
    op.drop_table('lotes_canastos')
    op.drop_table('canastos')

    # Eliminar columnas de lotes_produccion
    op.drop_constraint('fk_lotes_produccion_lote_padre', 'lotes_produccion', type_='foreignkey')
    op.drop_index('ix_lotes_produccion_lote_padre_id', 'lotes_produccion')
    op.drop_index('ix_lotes_produccion_tipo_lote', 'lotes_produccion')
    op.drop_column('lotes_produccion', 'lote_padre_id')
    op.drop_column('lotes_produccion', 'tipo_lote')

    # Revertir tipo_servicio a no nullable
    op.alter_column('lotes_produccion', 'tipo_servicio', nullable=False)
