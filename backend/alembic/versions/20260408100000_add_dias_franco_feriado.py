"""add dias franco feriado fields

Revision ID: 20260408_dias
Revises: 20260327100000
Create Date: 2026-04-08
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260408_dias'
down_revision = '20260327100000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar campos de valor por día a empleados
    op.add_column('empleados', sa.Column('valor_dia_franco', sa.Numeric(10, 2), nullable=True))
    op.add_column('empleados', sa.Column('valor_dia_feriado', sa.Numeric(10, 2), nullable=True))

    # Agregar campos de días a movimientos_nomina
    op.add_column('movimientos_nomina', sa.Column('cantidad_dias', sa.Numeric(3, 1), nullable=True))
    op.add_column('movimientos_nomina', sa.Column('valor_dia', sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('movimientos_nomina', 'valor_dia')
    op.drop_column('movimientos_nomina', 'cantidad_dias')
    op.drop_column('empleados', 'valor_dia_feriado')
    op.drop_column('empleados', 'valor_dia_franco')
