"""Add lote_id and estado_facturacion to movimientos_cuenta_corriente

Revision ID: 20260320100000
Revises: 20260310120000
Create Date: 2026-03-20 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260320100000'
down_revision: Union[str, None] = '20260310120000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Agregar campo lote_id a movimientos_cuenta_corriente
    op.add_column(
        'movimientos_cuenta_corriente',
        sa.Column('lote_id', sa.UUID(), nullable=True)
    )

    # Agregar campo estado_facturacion a movimientos_cuenta_corriente
    op.add_column(
        'movimientos_cuenta_corriente',
        sa.Column('estado_facturacion', sa.String(20), nullable=True, server_default='sin_facturar')
    )

    # Crear foreign key para lote_id
    op.create_foreign_key(
        'fk_movimientos_cc_lote',
        'movimientos_cuenta_corriente',
        'lotes_produccion',
        ['lote_id'],
        ['id']
    )


def downgrade() -> None:
    # Eliminar foreign key
    op.drop_constraint('fk_movimientos_cc_lote', 'movimientos_cuenta_corriente', type_='foreignkey')

    # Eliminar columnas
    op.drop_column('movimientos_cuenta_corriente', 'estado_facturacion')
    op.drop_column('movimientos_cuenta_corriente', 'lote_id')
