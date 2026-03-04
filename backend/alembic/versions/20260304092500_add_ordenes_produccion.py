"""add ordenes produccion, asignaciones e incidencias

Revision ID: 20260304092500
Revises: 20260304092218
Create Date: 2026-03-04 09:25:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260304092500'
down_revision = '20260304092218'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Crear tabla ordenes_produccion
    op.create_table(
        'ordenes_produccion',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('numero', sa.String(20), nullable=False),
        sa.Column('cliente_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('pedido_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('estado', sa.String(20), nullable=False, server_default='borrador'),
        sa.Column('prioridad', sa.String(20), nullable=False, server_default='normal'),
        sa.Column('fecha_emision', sa.Date(), nullable=False),
        sa.Column('fecha_programada_inicio', sa.Date(), nullable=True),
        sa.Column('fecha_programada_fin', sa.Date(), nullable=True),
        sa.Column('fecha_inicio_real', sa.DateTime(), nullable=True),
        sa.Column('fecha_fin_real', sa.DateTime(), nullable=True),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('instrucciones_especiales', sa.Text(), nullable=True),
        sa.Column('cantidad_prendas_estimada', sa.Integer(), nullable=True),
        sa.Column('peso_estimado_kg', sa.Numeric(10, 2), nullable=True),
        sa.Column('cantidad_prendas_real', sa.Integer(), nullable=True),
        sa.Column('peso_real_kg', sa.Numeric(10, 2), nullable=True),
        sa.Column('responsable_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('creado_por_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('notas_internas', sa.Text(), nullable=True),
        sa.Column('notas_produccion', sa.Text(), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['cliente_id'], ['clientes.id']),
        sa.ForeignKeyConstraint(['pedido_id'], ['pedidos.id']),
        sa.ForeignKeyConstraint(['responsable_id'], ['usuarios.id']),
        sa.ForeignKeyConstraint(['creado_por_id'], ['usuarios.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ordenes_produccion_numero', 'ordenes_produccion', ['numero'], unique=True)
    op.create_index('ix_ordenes_produccion_estado', 'ordenes_produccion', ['estado'])
    op.create_index('ix_ordenes_produccion_cliente_id', 'ordenes_produccion', ['cliente_id'])

    # Agregar columna orden_produccion_id a lotes_produccion
    op.add_column('lotes_produccion', sa.Column('orden_produccion_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_lotes_orden_produccion', 'lotes_produccion', 'ordenes_produccion', ['orden_produccion_id'], ['id'])
    op.create_index('ix_lotes_produccion_orden_id', 'lotes_produccion', ['orden_produccion_id'])

    # Crear tabla asignaciones_empleado_op
    op.create_table(
        'asignaciones_empleado_op',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('orden_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('empleado_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('etapa_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('fecha_asignacion', sa.Date(), nullable=False),
        sa.Column('fecha_fin_asignacion', sa.Date(), nullable=True),
        sa.Column('turno', sa.String(20), nullable=True),
        sa.Column('horas_estimadas', sa.Numeric(5, 2), nullable=True),
        sa.Column('horas_trabajadas', sa.Numeric(5, 2), nullable=True),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['orden_id'], ['ordenes_produccion.id']),
        sa.ForeignKeyConstraint(['empleado_id'], ['usuarios.id']),
        sa.ForeignKeyConstraint(['etapa_id'], ['etapas_produccion.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_asignaciones_empleado_op_orden_id', 'asignaciones_empleado_op', ['orden_id'])

    # Crear tabla incidencias_produccion
    op.create_table(
        'incidencias_produccion',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('orden_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('lote_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('etapa_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('tipo', sa.String(50), nullable=False),
        sa.Column('severidad', sa.String(20), nullable=False, server_default='media'),
        sa.Column('titulo', sa.String(255), nullable=False),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('fecha_incidencia', sa.DateTime(), nullable=False),
        sa.Column('fecha_resolucion', sa.DateTime(), nullable=True),
        sa.Column('estado', sa.String(20), nullable=False, server_default='abierta'),
        sa.Column('fotos', sa.Text(), nullable=True),
        sa.Column('reportado_por_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('resuelto_por_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('acciones_tomadas', sa.Text(), nullable=True),
        sa.Column('tiempo_perdido_minutos', sa.Integer(), nullable=True),
        sa.Column('costo_estimado', sa.Numeric(12, 2), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['orden_id'], ['ordenes_produccion.id']),
        sa.ForeignKeyConstraint(['lote_id'], ['lotes_produccion.id']),
        sa.ForeignKeyConstraint(['etapa_id'], ['etapas_produccion.id']),
        sa.ForeignKeyConstraint(['reportado_por_id'], ['usuarios.id']),
        sa.ForeignKeyConstraint(['resuelto_por_id'], ['usuarios.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_incidencias_produccion_orden_id', 'incidencias_produccion', ['orden_id'])


def downgrade() -> None:
    op.drop_table('incidencias_produccion')
    op.drop_table('asignaciones_empleado_op')
    op.drop_constraint('fk_lotes_orden_produccion', 'lotes_produccion', type_='foreignkey')
    op.drop_index('ix_lotes_produccion_orden_id', 'lotes_produccion')
    op.drop_column('lotes_produccion', 'orden_produccion_id')
    op.drop_table('ordenes_produccion')
