"""Add tipo_lote and lote_padre_id to lotes_produccion

Revision ID: 20260411100000
Revises: 20260409110000
Create Date: 2026-04-11 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260411100000'
down_revision = '20260409110000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add tipo_lote column with default value 'normal'
    op.add_column('lotes_produccion', sa.Column('tipo_lote', sa.String(20), nullable=False, server_default='normal'))

    # Add lote_padre_id for relevado relationship
    op.add_column('lotes_produccion', sa.Column('lote_padre_id', postgresql.UUID(as_uuid=True), nullable=True))

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_lotes_produccion_lote_padre_id',
        'lotes_produccion',
        'lotes_produccion',
        ['lote_padre_id'],
        ['id']
    )

    # Create index on tipo_lote
    op.create_index('ix_lotes_produccion_tipo_lote', 'lotes_produccion', ['tipo_lote'])


def downgrade() -> None:
    op.drop_index('ix_lotes_produccion_tipo_lote', 'lotes_produccion')
    op.drop_constraint('fk_lotes_produccion_lote_padre_id', 'lotes_produccion', type_='foreignkey')
    op.drop_column('lotes_produccion', 'lote_padre_id')
    op.drop_column('lotes_produccion', 'tipo_lote')
