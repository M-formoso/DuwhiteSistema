"""add etapas_produccion_permitidas a usuarios

Revision ID: 20260602100000
Revises: 20260508100000
Create Date: 2026-06-02
"""

from alembic import op
import sqlalchemy as sa


revision = "20260602100000"
down_revision = "20260508100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "usuarios",
        sa.Column("etapas_produccion_permitidas", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("usuarios", "etapas_produccion_permitidas")
