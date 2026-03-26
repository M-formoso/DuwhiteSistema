"""add jornales fields to movimientos_nomina and empleados

Revision ID: 20260324_jornales
Revises: 20260323100000
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260324_jornales'
down_revision = '20260323100000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar campos a movimientos_nomina
    op.add_column('movimientos_nomina', sa.Column('fecha', sa.Date(), nullable=True))
    op.add_column('movimientos_nomina', sa.Column('semana', sa.Integer(), nullable=True))
    op.add_column('movimientos_nomina', sa.Column('cantidad_horas', sa.Numeric(5, 2), nullable=True))
    op.add_column('movimientos_nomina', sa.Column('valor_hora', sa.Numeric(10, 2), nullable=True))
    
    # Crear índice para fecha
    op.create_index('ix_movimientos_nomina_fecha', 'movimientos_nomina', ['fecha'])
    
    # Agregar campo valor_hora_extra a empleados
    op.add_column('empleados', sa.Column('valor_hora_extra', sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('empleados', 'valor_hora_extra')
    op.drop_index('ix_movimientos_nomina_fecha', 'movimientos_nomina')
    op.drop_column('movimientos_nomina', 'valor_hora')
    op.drop_column('movimientos_nomina', 'cantidad_horas')
    op.drop_column('movimientos_nomina', 'semana')
    op.drop_column('movimientos_nomina', 'fecha')
