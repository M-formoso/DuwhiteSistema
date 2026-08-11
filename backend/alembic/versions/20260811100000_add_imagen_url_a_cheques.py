"""Add imagen_url column to cheques

Nueva columna para guardar la ruta relativa a la imagen/PDF del cheque
adjunto al momento de registrarlo desde el modal unificado de Tesorería.

Revision ID: 20260811100000
Revises: 20260805100000
Create Date: 2026-08-11
"""

from alembic import op


revision = "20260811100000"
down_revision = "20260805100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE cheques "
        "ADD COLUMN IF NOT EXISTS imagen_url VARCHAR(500)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE cheques DROP COLUMN IF EXISTS imagen_url")
