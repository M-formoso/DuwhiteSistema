"""Add estado_pago / monto_pagado / fecha_ultimo_cobro a facturas

Revision ID: 20260423110000
Revises: 20260423100000
Create Date: 2026-04-23

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260423110000"
down_revision = "20260423100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "facturas",
        sa.Column(
            "estado_pago",
            sa.String(20),
            nullable=False,
            server_default="sin_cobrar",
        ),
    )
    op.add_column(
        "facturas",
        sa.Column(
            "monto_pagado",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "facturas",
        sa.Column("fecha_ultimo_cobro", sa.Date(), nullable=True),
    )
    op.create_index("ix_facturas_estado_pago", "facturas", ["estado_pago"])

    # NC existentes (si las hubiera) marcar como no_aplica
    op.execute(
        "UPDATE facturas SET estado_pago = 'no_aplica' "
        "WHERE tipo IN ('nota_credito_a', 'nota_credito_b')"
    )


def downgrade() -> None:
    op.drop_index("ix_facturas_estado_pago", table_name="facturas")
    op.drop_column("facturas", "fecha_ultimo_cobro")
    op.drop_column("facturas", "monto_pagado")
    op.drop_column("facturas", "estado_pago")
