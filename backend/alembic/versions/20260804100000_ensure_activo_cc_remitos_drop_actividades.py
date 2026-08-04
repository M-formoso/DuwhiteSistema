"""Ensure activo column on movimientos_cc and remitos + drop actividades table

Necesario para soportar el borrado soft-delete de remitos desde CC. El campo
`activo` viene del BaseModelMixin/SoftDeleteMixin, pero puede no estar en la
tabla si se creó antes que el mixin. Se agrega con IF NOT EXISTS para ser
idempotente.

Además, se elimina la tabla `actividades` (tareas internas) porque el módulo
Actividades pasa a ser "Historial de Lavados" y no persiste datos propios.

Revision ID: 20260804100000
Revises: 20260701110000
Create Date: 2026-08-04
"""

from alembic import op


revision = "20260804100000"
down_revision = "20260701110000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Asegurar columna activo en movimientos_cuenta_corriente
    op.execute(
        "ALTER TABLE movimientos_cuenta_corriente "
        "ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE"
    )
    op.execute(
        "UPDATE movimientos_cuenta_corriente SET activo = TRUE WHERE activo IS NULL"
    )

    # 2. Asegurar columna activo en remitos (ya declarada en el modelo)
    op.execute(
        "ALTER TABLE remitos "
        "ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE"
    )
    op.execute("UPDATE remitos SET activo = TRUE WHERE activo IS NULL")

    # 3. Drop tabla actividades (módulo reconvertido a Historial de Lavados)
    op.execute("DROP TABLE IF EXISTS actividades CASCADE")


def downgrade() -> None:
    # No recreamos la tabla actividades (los datos eran tareas internas
    # descartables). Solo revertimos las columnas activo si se prefiere.
    op.execute("ALTER TABLE movimientos_cuenta_corriente DROP COLUMN IF EXISTS activo")
    op.execute("ALTER TABLE remitos DROP COLUMN IF EXISTS activo")
