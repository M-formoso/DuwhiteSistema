"""Add tesoreria tables

Revision ID: 20260323100000
Revises: 20260320100000
Create Date: 2026-03-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260323100000'
down_revision = '20260320100000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tabla de Cheques
    op.create_table(
        'cheques',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('numero', sa.String(50), nullable=False, index=True),
        sa.Column('tipo', sa.String(20), nullable=False, server_default='fisico'),
        sa.Column('origen', sa.String(30), nullable=False, server_default='recibido_cliente'),
        sa.Column('estado', sa.String(20), nullable=False, server_default='en_cartera'),

        sa.Column('monto', sa.Numeric(14, 2), nullable=False),
        sa.Column('fecha_emision', sa.Date, nullable=True),
        sa.Column('fecha_vencimiento', sa.Date, nullable=False),
        sa.Column('fecha_cobro', sa.Date, nullable=True),

        sa.Column('banco_origen', sa.String(100), nullable=True),
        sa.Column('cuenta_destino_id', sa.String(36), sa.ForeignKey('cuentas_bancarias.id'), nullable=True),
        sa.Column('banco_destino', sa.String(100), nullable=True),

        sa.Column('cliente_id', sa.String(36), sa.ForeignKey('clientes.id'), nullable=True),
        sa.Column('proveedor_id', sa.String(36), sa.ForeignKey('proveedores.id'), nullable=True),

        sa.Column('librador', sa.String(200), nullable=True),
        sa.Column('cuit_librador', sa.String(15), nullable=True),

        sa.Column('registrado_por_id', sa.String(36), sa.ForeignKey('usuarios.id'), nullable=False),
        sa.Column('cobrado_por_id', sa.String(36), sa.ForeignKey('usuarios.id'), nullable=True),
        sa.Column('fecha_registro', sa.DateTime, nullable=True),

        sa.Column('notas', sa.Text, nullable=True),
        sa.Column('motivo_rechazo', sa.Text, nullable=True),

        sa.Column('activo', sa.Boolean, server_default='true'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Tabla de Movimientos de Tesorería
    op.create_table(
        'movimientos_tesoreria',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('tipo', sa.String(30), nullable=False),
        sa.Column('concepto', sa.String(200), nullable=False),
        sa.Column('descripcion', sa.Text, nullable=True),

        sa.Column('monto', sa.Numeric(14, 2), nullable=False),
        sa.Column('es_ingreso', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('fecha_movimiento', sa.Date, nullable=False),
        sa.Column('fecha_valor', sa.Date, nullable=True),

        sa.Column('metodo_pago', sa.String(30), nullable=False),
        sa.Column('banco_origen', sa.String(100), nullable=True),
        sa.Column('banco_destino', sa.String(100), nullable=True),
        sa.Column('cuenta_destino_id', sa.String(36), sa.ForeignKey('cuentas_bancarias.id'), nullable=True),
        sa.Column('numero_transferencia', sa.String(100), nullable=True),

        sa.Column('cheque_id', sa.String(36), sa.ForeignKey('cheques.id'), nullable=True),
        sa.Column('cliente_id', sa.String(36), sa.ForeignKey('clientes.id'), nullable=True),
        sa.Column('proveedor_id', sa.String(36), sa.ForeignKey('proveedores.id'), nullable=True),

        sa.Column('registrado_por_id', sa.String(36), sa.ForeignKey('usuarios.id'), nullable=False),
        sa.Column('notas', sa.Text, nullable=True),
        sa.Column('comprobante', sa.String(100), nullable=True),

        sa.Column('anulado', sa.Boolean, server_default='false'),
        sa.Column('motivo_anulacion', sa.Text, nullable=True),
        sa.Column('anulado_por_id', sa.String(36), sa.ForeignKey('usuarios.id'), nullable=True),
        sa.Column('fecha_anulacion', sa.DateTime, nullable=True),

        sa.Column('activo', sa.Boolean, server_default='true'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Índices
    op.create_index('ix_cheques_estado', 'cheques', ['estado'])
    op.create_index('ix_cheques_fecha_vencimiento', 'cheques', ['fecha_vencimiento'])
    op.create_index('ix_cheques_cliente_id', 'cheques', ['cliente_id'])
    op.create_index('ix_movimientos_tesoreria_fecha', 'movimientos_tesoreria', ['fecha_movimiento'])
    op.create_index('ix_movimientos_tesoreria_tipo', 'movimientos_tesoreria', ['tipo'])


def downgrade() -> None:
    op.drop_index('ix_movimientos_tesoreria_tipo', 'movimientos_tesoreria')
    op.drop_index('ix_movimientos_tesoreria_fecha', 'movimientos_tesoreria')
    op.drop_index('ix_cheques_cliente_id', 'cheques')
    op.drop_index('ix_cheques_fecha_vencimiento', 'cheques')
    op.drop_index('ix_cheques_estado', 'cheques')
    op.drop_table('movimientos_tesoreria')
    op.drop_table('cheques')
