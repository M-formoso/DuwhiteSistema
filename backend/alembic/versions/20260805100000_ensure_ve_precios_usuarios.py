"""Ensure ve_precios column on usuarios

Nuevo permiso para usuarios rol=cliente: si es false, el portal cliente
oculta importes/deudas/precios.

Revision ID: 20260805100000
Revises: 20260804100000
Create Date: 2026-08-05
"""

from alembic import op


revision = "20260805100000"
down_revision = "20260804100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE usuarios "
        "ADD COLUMN IF NOT EXISTS ve_precios BOOLEAN NOT NULL DEFAULT TRUE"
    )
    op.execute("UPDATE usuarios SET ve_precios = TRUE WHERE ve_precios IS NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE usuarios DROP COLUMN IF EXISTS ve_precios")
