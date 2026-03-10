"""add pin to usuarios

Revision ID: 20260310120000
Revises: 20260310100000
Create Date: 2026-03-10 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260310120000'
down_revision: Union[str, None] = '20260310100000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Agregar campo PIN a usuarios
    op.add_column('usuarios', sa.Column('pin', sa.String(6), nullable=True))


def downgrade() -> None:
    op.drop_column('usuarios', 'pin')
