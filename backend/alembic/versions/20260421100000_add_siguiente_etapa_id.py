"""Add siguiente_etapa_id to etapas_produccion

Revision ID: 20260421100000
Revises: 20260420100000
Create Date: 2026-04-21

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260421100000"
down_revision = "20260420100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar campo siguiente_etapa_id
    op.add_column(
        "etapas_produccion",
        sa.Column("siguiente_etapa_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # Configurar Secado -> Conteo (para que salte Planchado)
    op.execute("""
        UPDATE etapas_produccion
        SET siguiente_etapa_id = (
            SELECT id FROM etapas_produccion WHERE codigo = 'CONT'
        )
        WHERE codigo = 'SEC'
    """)


def downgrade() -> None:
    op.drop_column("etapas_produccion", "siguiente_etapa_id")
