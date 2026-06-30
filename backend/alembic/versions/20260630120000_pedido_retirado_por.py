"""Agregar retirado_por_id y hora_inicio_retiro al pedido

Para el flujo de recolección: cuando el chico que va a buscar la ropa
inicia un retiro, queda registrado quién es (validado por PIN) y la
hora exacta en que arrancó. Después esos pedidos aparecen como
"en camino" en el Kanban hasta que recepción los pesa y crea el lote.

Revision ID: 20260630120000
Revises: 20260623110000
Create Date: 2026-06-30
"""

from alembic import op
import sqlalchemy as sa


revision = "20260630120000"
down_revision = "20260623110000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pedidos",
        sa.Column("retirado_por_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "pedidos",
        sa.Column("hora_inicio_retiro", sa.DateTime(), nullable=True),
    )
    op.create_foreign_key(
        "fk_pedidos_retirado_por",
        "pedidos",
        "usuarios",
        ["retirado_por_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_pedidos_retirado_por", "pedidos", type_="foreignkey")
    op.drop_column("pedidos", "hora_inicio_retiro")
    op.drop_column("pedidos", "retirado_por_id")
