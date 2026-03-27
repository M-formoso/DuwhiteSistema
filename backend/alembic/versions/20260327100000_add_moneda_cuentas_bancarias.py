"""Add moneda to cuentas_bancarias

Revision ID: 20260327100000
Revises: 20260325100000
Create Date: 2026-03-27

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260327100000'
down_revision = '20260325100000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar columna moneda a cuentas_bancarias
    op.add_column(
        'cuentas_bancarias',
        sa.Column('moneda', sa.String(3), nullable=False, server_default='ARS')
    )


def downgrade() -> None:
    op.drop_column('cuentas_bancarias', 'moneda')
