"""backfill de booleanos NULL en etapas_produccion

Revision ID: 20260602120000
Revises: 20260602110000
Create Date: 2026-06-02

Algunos registros antiguos de etapas_produccion quedaron con NULL en
campos booleanos (especialmente `permite_bifurcacion`, agregado en
migraciones posteriores con server_default que no rellena filas
preexistentes). Eso rompe la serialización Pydantic y devuelve 500
en /produccion/etapas.

Esta migración normaliza esos NULL a sus defaults lógicos.
"""

from alembic import op


revision = "20260602120000"
down_revision = "20260602110000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE etapas_produccion SET es_inicial = FALSE WHERE es_inicial IS NULL")
    op.execute("UPDATE etapas_produccion SET es_final = FALSE WHERE es_final IS NULL")
    op.execute("UPDATE etapas_produccion SET requiere_peso = FALSE WHERE requiere_peso IS NULL")
    op.execute("UPDATE etapas_produccion SET requiere_maquina = FALSE WHERE requiere_maquina IS NULL")
    op.execute("UPDATE etapas_produccion SET permite_bifurcacion = FALSE WHERE permite_bifurcacion IS NULL")
    op.execute("UPDATE etapas_produccion SET activo = TRUE WHERE activo IS NULL")


def downgrade() -> None:
    # No revertimos: dejar booleanos en su forma normalizada es siempre seguro.
    pass
