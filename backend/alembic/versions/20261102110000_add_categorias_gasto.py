"""Agrega tabla categorias_gasto + FK en movimientos_tesoreria + seed inicial

Las categorías pre-cargadas son las que la casa ya venía manejando en una
planilla externa (ARCA, EPEC, cuotas de autos, obras, sueldos, etc). La
admin puede agregar más desde la UI con un botón "+".

Revision ID: 20261102110000
Revises: 20261102100000
Create Date: 2026-11-02
"""

from alembic import op


revision = "20261102110000"
down_revision = "20261102100000"
branch_labels = None
depends_on = None


# Categorías iniciales que ya usa la casa. Si una ya existe (reruns), el
# ON CONFLICT la salta sin romper nada.
CATEGORIAS_INICIALES = [
    "ARCA-931",
    "IVA",
    "COOPERATIVA",
    "SINDICATO",
    "AUTOPLAN MERCEDES",
    "CUOTA CITROEN",
    "CONTADOR",
    "DOLARES ERNESTO",
    "SAMU - EMERGENCIAS",
    "SEGURO CAMIONETAS",
    "SEGURO EMPLEADOS",
    "SEGURO GALPON",
    "ECOGAS",
    "EPEC",
    "CLARO",
    "PLANES DE PAGO ARCA",
    "GASTOS MACRO",
    "SUELDO - HS. EXTR - FERIAD. - FRANC.",
    "GASTOS VARIOS",
    "PORCENTAJE JEREMIAS",
    "MONOTRIBUTO LU",
    "IND. Y COM MALAGUEÑO",
    "GPS",
    "OBRA CALDERA",
    "DOBLADORA LUCAS",
    "POZO",
    "ELECTRICISTA",
]


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS categorias_gasto (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            nombre VARCHAR(100) NOT NULL UNIQUE,
            activo BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_categorias_gasto_nombre ON categorias_gasto(nombre)"
    )

    # FK en movimientos_tesoreria
    op.execute(
        """
        ALTER TABLE movimientos_tesoreria
        ADD COLUMN IF NOT EXISTS categoria_gasto_id UUID
        REFERENCES categorias_gasto(id)
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_movimientos_tesoreria_categoria_gasto_id "
        "ON movimientos_tesoreria(categoria_gasto_id)"
    )

    # Seed: insertamos las categorías iniciales. ON CONFLICT (nombre) salta
    # las que ya existan, haciendo la migración segura ante reruns.
    for nombre in CATEGORIAS_INICIALES:
        # Escapamos comillas simples en el nombre (el único real sería un
        # apóstrofe tipo "D'Onofrio" si lo agregan después; por ahora ninguna).
        escaped = nombre.replace("'", "''")
        op.execute(
            f"""
            INSERT INTO categorias_gasto (nombre, activo)
            VALUES ('{escaped}', TRUE)
            ON CONFLICT (nombre) DO NOTHING
            """
        )


def downgrade() -> None:
    op.execute("ALTER TABLE movimientos_tesoreria DROP COLUMN IF EXISTS categoria_gasto_id")
    op.execute("DROP TABLE IF EXISTS categorias_gasto")
