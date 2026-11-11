"""Agregar tesoreria_fecha_corte_totales a configuracion_sistema

Punto de corte opcional para que las cards de totales del dashboard de
Tesoreria solo cuenten movimientos a partir de una fecha. Permite
"empezar desde cero" sin perder la historia.

Revision ID: 20261105100000
Revises: 20261104100000
Create Date: 2026-11-05
"""

from alembic import op


revision = "20261105100000"
down_revision = "20261104100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE configuracion_sistema "
        "ADD COLUMN IF NOT EXISTS tesoreria_fecha_corte_totales DATE"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE configuracion_sistema "
        "DROP COLUMN IF EXISTS tesoreria_fecha_corte_totales"
    )
