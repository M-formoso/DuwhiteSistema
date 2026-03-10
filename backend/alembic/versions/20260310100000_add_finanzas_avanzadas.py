"""add finanzas avanzadas: cc proveedor, ordenes pago, cruces, conciliacion

Revision ID: 20260310100000
Revises: 20260304092500
Create Date: 2026-03-10 10:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260310100000'
down_revision = '20260304092500'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ==================== PROVEEDOR: agregar saldo_cuenta_corriente ====================
    op.add_column(
        'proveedores',
        sa.Column('saldo_cuenta_corriente', sa.Numeric(14, 2), nullable=False, server_default='0')
    )

    # ==================== MOVIMIENTOS BANCARIOS: campos conciliación ====================
    op.add_column(
        'movimientos_bancarios',
        sa.Column('conciliacion_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.add_column(
        'movimientos_bancarios',
        sa.Column('conciliado_por_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.add_column(
        'movimientos_bancarios',
        sa.Column('referencia_conciliacion', sa.String(100), nullable=True)
    )

    # ==================== CUENTA CORRIENTE PROVEEDOR ====================
    op.create_table(
        'movimientos_cc_proveedor',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('proveedor_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('tipo', sa.String(20), nullable=False),
        sa.Column('concepto', sa.String(500), nullable=False),
        sa.Column('monto', sa.Numeric(14, 2), nullable=False),
        sa.Column('saldo_anterior', sa.Numeric(14, 2), nullable=False),
        sa.Column('saldo_posterior', sa.Numeric(14, 2), nullable=False),
        sa.Column('fecha_movimiento', sa.Date(), nullable=False),
        sa.Column('factura_numero', sa.String(50), nullable=True),
        sa.Column('fecha_factura', sa.Date(), nullable=True),
        sa.Column('fecha_vencimiento', sa.Date(), nullable=True),
        sa.Column('saldo_comprobante', sa.Numeric(14, 2), nullable=True),
        sa.Column('estado_pago', sa.String(20), nullable=True, server_default='pendiente'),
        sa.Column('recepcion_compra_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('orden_pago_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('registrado_por_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('anulado', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('fecha_anulacion', sa.DateTime(), nullable=True),
        sa.Column('motivo_anulacion', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['proveedor_id'], ['proveedores.id']),
        sa.ForeignKeyConstraint(['recepcion_compra_id'], ['recepciones_compra.id']),
        sa.ForeignKeyConstraint(['registrado_por_id'], ['usuarios.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_movimientos_cc_proveedor_proveedor_id', 'movimientos_cc_proveedor', ['proveedor_id'])
    op.create_index('ix_movimientos_cc_proveedor_fecha', 'movimientos_cc_proveedor', ['fecha_movimiento'])
    op.create_index('ix_movimientos_cc_proveedor_tipo', 'movimientos_cc_proveedor', ['tipo'])

    # ==================== ÓRDENES DE PAGO ====================
    op.create_table(
        'ordenes_pago',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('numero', sa.String(20), unique=True, nullable=False),
        sa.Column('proveedor_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('fecha_emision', sa.Date(), nullable=False),
        sa.Column('fecha_pago_programada', sa.Date(), nullable=True),
        sa.Column('fecha_pago_real', sa.Date(), nullable=True),
        sa.Column('estado', sa.String(20), nullable=False, server_default='borrador'),
        sa.Column('monto_total', sa.Numeric(14, 2), nullable=False),
        sa.Column('monto_pagado', sa.Numeric(14, 2), nullable=True),
        sa.Column('medio_pago', sa.String(50), nullable=True),
        sa.Column('cuenta_bancaria_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('referencia_pago', sa.String(100), nullable=True),
        sa.Column('concepto', sa.String(500), nullable=True),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('anulado', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('fecha_anulacion', sa.DateTime(), nullable=True),
        sa.Column('motivo_anulacion', sa.Text(), nullable=True),
        sa.Column('anulado_por_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('creado_por_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('pagado_por_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['proveedor_id'], ['proveedores.id']),
        sa.ForeignKeyConstraint(['cuenta_bancaria_id'], ['cuentas_bancarias.id']),
        sa.ForeignKeyConstraint(['creado_por_id'], ['usuarios.id']),
        sa.ForeignKeyConstraint(['pagado_por_id'], ['usuarios.id']),
        sa.ForeignKeyConstraint(['anulado_por_id'], ['usuarios.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ordenes_pago_numero', 'ordenes_pago', ['numero'])
    op.create_index('ix_ordenes_pago_proveedor_id', 'ordenes_pago', ['proveedor_id'])
    op.create_index('ix_ordenes_pago_estado', 'ordenes_pago', ['estado'])

    # Agregar FK de orden_pago_id en movimientos_cc_proveedor (circular)
    op.create_foreign_key(
        'fk_movimientos_cc_proveedor_orden_pago',
        'movimientos_cc_proveedor',
        'ordenes_pago',
        ['orden_pago_id'],
        ['id']
    )

    # ==================== DETALLE ORDEN DE PAGO ====================
    op.create_table(
        'detalle_ordenes_pago',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('orden_pago_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('movimiento_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('descripcion', sa.String(500), nullable=True),
        sa.Column('monto_comprobante', sa.Numeric(14, 2), nullable=False),
        sa.Column('monto_pendiente_antes', sa.Numeric(14, 2), nullable=False),
        sa.Column('monto_a_pagar', sa.Numeric(14, 2), nullable=False),
        sa.Column('numero_linea', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['orden_pago_id'], ['ordenes_pago.id']),
        sa.ForeignKeyConstraint(['movimiento_id'], ['movimientos_cc_proveedor.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_detalle_ordenes_pago_orden', 'detalle_ordenes_pago', ['orden_pago_id'])

    # ==================== IMPUTACIONES PAGO PROVEEDOR ====================
    op.create_table(
        'imputaciones_pago_proveedor',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('movimiento_cargo_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('movimiento_pago_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('orden_pago_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('monto_imputado', sa.Numeric(14, 2), nullable=False),
        sa.Column('fecha_imputacion', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('usuario_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['movimiento_cargo_id'], ['movimientos_cc_proveedor.id']),
        sa.ForeignKeyConstraint(['movimiento_pago_id'], ['movimientos_cc_proveedor.id']),
        sa.ForeignKeyConstraint(['orden_pago_id'], ['ordenes_pago.id']),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_imputaciones_pago_cargo', 'imputaciones_pago_proveedor', ['movimiento_cargo_id'])

    # ==================== ENTIDADES CONSOLIDADAS (CRUCES) ====================
    op.create_table(
        'entidades_consolidadas',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('cuit', sa.String(15), unique=True, nullable=False),
        sa.Column('razon_social', sa.String(200), nullable=False),
        sa.Column('es_cliente', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('es_proveedor', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('cliente_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('proveedor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('saldo_como_cliente', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('saldo_como_proveedor', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('saldo_neto', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['cliente_id'], ['clientes.id']),
        sa.ForeignKeyConstraint(['proveedor_id'], ['proveedores.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_entidades_consolidadas_cuit', 'entidades_consolidadas', ['cuit'])
    op.create_index('ix_entidades_consolidadas_cliente', 'entidades_consolidadas', ['cliente_id'])
    op.create_index('ix_entidades_consolidadas_proveedor', 'entidades_consolidadas', ['proveedor_id'])

    # ==================== CONCILIACIÓN BANCARIA ====================
    op.create_table(
        'conciliaciones_bancarias',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('cuenta_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('fecha_desde', sa.Date(), nullable=False),
        sa.Column('fecha_hasta', sa.Date(), nullable=False),
        sa.Column('estado', sa.String(20), nullable=False, server_default='en_proceso'),
        sa.Column('saldo_extracto_bancario', sa.Numeric(14, 2), nullable=True),
        sa.Column('saldo_sistema', sa.Numeric(14, 2), nullable=True),
        sa.Column('diferencia', sa.Numeric(14, 2), nullable=True),
        sa.Column('cantidad_conciliados', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('monto_conciliado', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('creado_por_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('finalizado_por_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('fecha_finalizacion', sa.DateTime(), nullable=True),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['cuenta_id'], ['cuentas_bancarias.id']),
        sa.ForeignKeyConstraint(['creado_por_id'], ['usuarios.id']),
        sa.ForeignKeyConstraint(['finalizado_por_id'], ['usuarios.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_conciliaciones_bancarias_cuenta', 'conciliaciones_bancarias', ['cuenta_id'])
    op.create_index('ix_conciliaciones_bancarias_estado', 'conciliaciones_bancarias', ['estado'])

    # Agregar FK de conciliacion_id en movimientos_bancarios
    op.create_foreign_key(
        'fk_movimientos_bancarios_conciliacion',
        'movimientos_bancarios',
        'conciliaciones_bancarias',
        ['conciliacion_id'],
        ['id']
    )
    op.create_foreign_key(
        'fk_movimientos_bancarios_conciliado_por',
        'movimientos_bancarios',
        'usuarios',
        ['conciliado_por_id'],
        ['id']
    )

    # ==================== ITEMS CONCILIACIÓN ====================
    op.create_table(
        'items_conciliacion',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('conciliacion_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('movimiento_bancario_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('conciliado', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('fecha_conciliacion', sa.DateTime(), nullable=True),
        sa.Column('conciliado_por_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('referencia_extracto', sa.String(100), nullable=True),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['conciliacion_id'], ['conciliaciones_bancarias.id']),
        sa.ForeignKeyConstraint(['movimiento_bancario_id'], ['movimientos_bancarios.id']),
        sa.ForeignKeyConstraint(['conciliado_por_id'], ['usuarios.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_items_conciliacion_conciliacion', 'items_conciliacion', ['conciliacion_id'])
    op.create_index('ix_items_conciliacion_movimiento', 'items_conciliacion', ['movimiento_bancario_id'])


def downgrade() -> None:
    # Items conciliación
    op.drop_index('ix_items_conciliacion_movimiento', table_name='items_conciliacion')
    op.drop_index('ix_items_conciliacion_conciliacion', table_name='items_conciliacion')
    op.drop_table('items_conciliacion')

    # FK movimientos bancarios
    op.drop_constraint('fk_movimientos_bancarios_conciliado_por', 'movimientos_bancarios', type_='foreignkey')
    op.drop_constraint('fk_movimientos_bancarios_conciliacion', 'movimientos_bancarios', type_='foreignkey')

    # Conciliaciones bancarias
    op.drop_index('ix_conciliaciones_bancarias_estado', table_name='conciliaciones_bancarias')
    op.drop_index('ix_conciliaciones_bancarias_cuenta', table_name='conciliaciones_bancarias')
    op.drop_table('conciliaciones_bancarias')

    # Entidades consolidadas
    op.drop_index('ix_entidades_consolidadas_proveedor', table_name='entidades_consolidadas')
    op.drop_index('ix_entidades_consolidadas_cliente', table_name='entidades_consolidadas')
    op.drop_index('ix_entidades_consolidadas_cuit', table_name='entidades_consolidadas')
    op.drop_table('entidades_consolidadas')

    # Imputaciones pago proveedor
    op.drop_index('ix_imputaciones_pago_cargo', table_name='imputaciones_pago_proveedor')
    op.drop_table('imputaciones_pago_proveedor')

    # Detalle órdenes de pago
    op.drop_index('ix_detalle_ordenes_pago_orden', table_name='detalle_ordenes_pago')
    op.drop_table('detalle_ordenes_pago')

    # FK en movimientos_cc_proveedor
    op.drop_constraint('fk_movimientos_cc_proveedor_orden_pago', 'movimientos_cc_proveedor', type_='foreignkey')

    # Órdenes de pago
    op.drop_index('ix_ordenes_pago_estado', table_name='ordenes_pago')
    op.drop_index('ix_ordenes_pago_proveedor_id', table_name='ordenes_pago')
    op.drop_index('ix_ordenes_pago_numero', table_name='ordenes_pago')
    op.drop_table('ordenes_pago')

    # Movimientos CC proveedor
    op.drop_index('ix_movimientos_cc_proveedor_tipo', table_name='movimientos_cc_proveedor')
    op.drop_index('ix_movimientos_cc_proveedor_fecha', table_name='movimientos_cc_proveedor')
    op.drop_index('ix_movimientos_cc_proveedor_proveedor_id', table_name='movimientos_cc_proveedor')
    op.drop_table('movimientos_cc_proveedor')

    # Campos en movimientos bancarios
    op.drop_column('movimientos_bancarios', 'referencia_conciliacion')
    op.drop_column('movimientos_bancarios', 'conciliado_por_id')
    op.drop_column('movimientos_bancarios', 'conciliacion_id')

    # Campo en proveedores
    op.drop_column('proveedores', 'saldo_cuenta_corriente')
