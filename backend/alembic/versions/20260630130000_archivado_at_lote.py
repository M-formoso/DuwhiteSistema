"""Agregar archivado_at a lotes_produccion

Permite "archivar" lotes que estorban en el Kanban (típicamente los que
quedaron en FIN/CONT y nunca avanzan) sin perderlos físicamente. Los lotes
con archivado_at != NULL no aparecen en el tablero. Un job posterior
podrá borrarlos físicamente cuando lleven >30 días archivados y no tengan
remitos asociados.

Revision ID: 20260630130000
Revises: 20260630120000
Create Date: 2026-06-30
"""

from alembic import op
import sqlalchemy as sa


revision = "20260630130000"
down_revision = "20260630120000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "lotes_produccion",
        sa.Column("archivado_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_lotes_produccion_archivado_at",
        "lotes_produccion",
        ["archivado_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_lotes_produccion_archivado_at", table_name="lotes_produccion")
    op.drop_column("lotes_produccion", "archivado_at")
