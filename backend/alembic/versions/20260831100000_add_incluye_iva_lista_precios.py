"""Add incluye_iva column to listas_precios

Permite que cada lista de precios indique si sus valores deben mostrarse
con IVA (21%) o no al generar el PDF que se comparte con el cliente.

Revision ID: 20260831100000
Revises: 20260811100000
Create Date: 2026-08-31
"""

from alembic import op


revision = "20260831100000"
down_revision = "20260811100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE listas_precios "
        "ADD COLUMN IF NOT EXISTS incluye_iva BOOLEAN NOT NULL DEFAULT FALSE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE listas_precios DROP COLUMN IF EXISTS incluye_iva")
