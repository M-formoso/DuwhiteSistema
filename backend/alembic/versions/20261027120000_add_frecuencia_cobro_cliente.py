"""Add frecuencia_cobro + dia_corte_semana a clientes

Agrega la modalidad de cobro al cliente para soportar hoteles que pagan
por entrega (diaria) o semana, en lugar del cierre mensual tradicional.

- `frecuencia_cobro` VARCHAR(20) NOT NULL default 'mensual'
- `dia_corte_semana` INTEGER NOT NULL default 0  (0=lunes ... 6=domingo)

Clientes existentes quedan como 'mensual' → no cambia nada su comportamiento.

Revision ID: 20261027120000
Revises: 20261020120000
Create Date: 2026-10-27
"""

from alembic import op


revision = "20261027120000"
down_revision = "20261020120000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE clientes
            ADD COLUMN IF NOT EXISTS frecuencia_cobro VARCHAR(20) NOT NULL DEFAULT 'mensual',
            ADD COLUMN IF NOT EXISTS dia_corte_semana INTEGER NOT NULL DEFAULT 0
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE clientes
            DROP COLUMN IF EXISTS dia_corte_semana,
            DROP COLUMN IF EXISTS frecuencia_cobro
        """
    )
