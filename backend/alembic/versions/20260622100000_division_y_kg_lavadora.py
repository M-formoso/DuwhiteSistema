"""Renombrar EST→DIV (División) y agregar peso_kg a lotes_etapas_maquinas

Revision ID: 20260622100000
Revises: 20260610100000
Create Date: 2026-06-22
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260622100000"
down_revision = "20260610100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Renombrar etapa EST → DIV / "Estirado" → "División"
    op.execute(sa.text("""
        UPDATE etapas_produccion
        SET codigo = 'DIV', nombre = 'División',
            descripcion = 'Etapa de división donde se decide si el lote va a Secado, Planchado, o ambos'
        WHERE codigo = 'EST'
    """))

    # 2. Agregar peso_kg a lotes_etapas_maquinas para registrar kg por lavadora
    op.add_column(
        'lotes_etapas_maquinas',
        sa.Column('peso_kg', sa.Numeric(10, 2), nullable=True)
    )


def downgrade() -> None:
    op.execute(sa.text("""
        UPDATE etapas_produccion
        SET codigo = 'EST', nombre = 'Estirado',
            descripcion = 'Etapa de estirado donde se decide si el producto va a Secado o vuelve a Lavado'
        WHERE codigo = 'DIV'
    """))
    op.drop_column('lotes_etapas_maquinas', 'peso_kg')
