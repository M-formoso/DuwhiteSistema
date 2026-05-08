"""create aplicaciones_pago_factura table

Revision ID: 20260508100000
Revises: 20260507100000
Create Date: 2026-05-08
"""

from alembic import op
import sqlalchemy as sa


revision = "20260508100000"
down_revision = "20260507100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "aplicaciones_pago_factura",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("factura_id", sa.UUID(as_uuid=True), sa.ForeignKey("facturas.id"), nullable=False),
        sa.Column(
            "movimiento_pago_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("movimientos_cuenta_corriente.id"),
            nullable=False,
        ),
        sa.Column("monto_aplicado", sa.Numeric(14, 2), nullable=False),
        sa.Column("fecha_aplicacion", sa.Date, nullable=False),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column("automatica", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("registrado_por_id", sa.UUID(as_uuid=True), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("factura_id", "movimiento_pago_id", name="uq_aplicacion_factura_pago"),
    )
    op.create_index("ix_aplicaciones_factura_id", "aplicaciones_pago_factura", ["factura_id"])
    op.create_index("ix_aplicaciones_movimiento_pago_id", "aplicaciones_pago_factura", ["movimiento_pago_id"])

    # Backfill: para cada PAGO con factura_id, generar una aplicación retrofitting
    op.execute(
        """
        INSERT INTO aplicaciones_pago_factura (
            id, factura_id, movimiento_pago_id, monto_aplicado, fecha_aplicacion,
            automatica, registrado_por_id, activo, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            m.factura_id,
            m.id,
            m.monto,
            m.fecha_movimiento,
            true,
            m.registrado_por_id,
            true,
            now(),
            now()
        FROM movimientos_cuenta_corriente m
        WHERE m.tipo = 'pago'
          AND m.factura_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_aplicaciones_movimiento_pago_id", table_name="aplicaciones_pago_factura")
    op.drop_index("ix_aplicaciones_factura_id", table_name="aplicaciones_pago_factura")
    op.drop_table("aplicaciones_pago_factura")
