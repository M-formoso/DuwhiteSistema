"""Agregar tabla ajustes_manuales_cuenta

Historial de cambios manuales al saldo de una cuenta bancaria/efectivo/
billetera. Cada edición manual deja fila con quién, cuándo, saldo
anterior / nuevo / diff y motivo opcional. Los movimientos de tesorería
normales NO pasan por acá — se siguen registrando en movimientos_tesoreria.

Revision ID: 20261104100000
Revises: 20261102110000
Create Date: 2026-11-04
"""

from alembic import op


revision = "20261104100000"
down_revision = "20261102110000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ajustes_manuales_cuenta (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            cuenta_id UUID NOT NULL REFERENCES cuentas_bancarias(id),
            saldo_anterior NUMERIC(14, 2) NOT NULL,
            saldo_nuevo NUMERIC(14, 2) NOT NULL,
            diff NUMERIC(14, 2) NOT NULL,
            motivo TEXT,
            usuario_id UUID NOT NULL REFERENCES usuarios(id),
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ajustes_manuales_cuenta_cuenta_id "
        "ON ajustes_manuales_cuenta(cuenta_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ajustes_manuales_cuenta")
