"""add calificacion to proveedores

Revision ID: 20260304092218
Revises:
Create Date: 2026-03-04 09:22:18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260304092218'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar campo calificacion a la tabla proveedores
    op.add_column('proveedores', sa.Column('calificacion', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('proveedores', 'calificacion')
