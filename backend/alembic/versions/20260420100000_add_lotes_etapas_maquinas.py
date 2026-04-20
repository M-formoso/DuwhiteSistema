"""Add lotes_etapas_maquinas table for multiple machines per stage

Revision ID: 20260420100000
Revises: 20260415100000
Create Date: 2026-04-20

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260420100000"
down_revision = "20260415100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Crear tabla intermedia lotes_etapas_maquinas
    op.create_table(
        "lotes_etapas_maquinas",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lote_etapa_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("maquina_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fecha_asignacion", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("fecha_liberacion", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True, onupdate=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["lote_etapa_id"],
            ["lotes_etapas.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["maquina_id"],
            ["maquinas.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Crear índices
    op.create_index(
        "ix_lotes_etapas_maquinas_lote_etapa_id",
        "lotes_etapas_maquinas",
        ["lote_etapa_id"],
    )
    op.create_index(
        "ix_lotes_etapas_maquinas_maquina_id",
        "lotes_etapas_maquinas",
        ["maquina_id"],
    )

    # Migrar datos existentes: mover maquina_id de lotes_etapas a la nueva tabla
    op.execute("""
        INSERT INTO lotes_etapas_maquinas (id, lote_etapa_id, maquina_id, fecha_asignacion, created_at)
        SELECT
            gen_random_uuid(),
            le.id,
            le.maquina_id,
            COALESCE(le.fecha_inicio, le.created_at, NOW()),
            NOW()
        FROM lotes_etapas le
        WHERE le.maquina_id IS NOT NULL
    """)


def downgrade() -> None:
    # Migrar datos de vuelta: tomar la primera máquina asignada
    op.execute("""
        UPDATE lotes_etapas le
        SET maquina_id = (
            SELECT lem.maquina_id
            FROM lotes_etapas_maquinas lem
            WHERE lem.lote_etapa_id = le.id
            ORDER BY lem.fecha_asignacion
            LIMIT 1
        )
        WHERE EXISTS (
            SELECT 1 FROM lotes_etapas_maquinas lem
            WHERE lem.lote_etapa_id = le.id
        )
    """)

    # Eliminar índices
    op.drop_index("ix_lotes_etapas_maquinas_maquina_id", table_name="lotes_etapas_maquinas")
    op.drop_index("ix_lotes_etapas_maquinas_lote_etapa_id", table_name="lotes_etapas_maquinas")

    # Eliminar tabla
    op.drop_table("lotes_etapas_maquinas")
