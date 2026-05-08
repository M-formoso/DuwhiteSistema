"""add factura_id FK to movimientos_cuenta_corriente

Revision ID: 20260507100000
Revises: 20260423110000
Create Date: 2026-05-07
"""

from alembic import op
import sqlalchemy as sa


revision = "20260507100000"
down_revision = "20260423110000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Columna FK
    op.add_column(
        "movimientos_cuenta_corriente",
        sa.Column("factura_id", sa.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_movimientos_cc_factura",
        "movimientos_cuenta_corriente",
        "facturas",
        ["factura_id"],
        ["id"],
    )
    op.create_index(
        "ix_movimientos_cc_factura_id",
        "movimientos_cuenta_corriente",
        ["factura_id"],
    )

    # Backfill: para movimientos viejos, intentar matchear factura_numero ↔ facturas.numero_completo
    op.execute(
        """
        UPDATE movimientos_cuenta_corriente m
        SET factura_id = f.id
        FROM facturas f
        WHERE m.factura_numero IS NOT NULL
          AND m.factura_numero = f.numero_completo
          AND m.factura_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_movimientos_cc_factura_id", table_name="movimientos_cuenta_corriente")
    op.drop_constraint("fk_movimientos_cc_factura", "movimientos_cuenta_corriente", type_="foreignkey")
    op.drop_column("movimientos_cuenta_corriente", "factura_id")
