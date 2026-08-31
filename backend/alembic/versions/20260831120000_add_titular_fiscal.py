"""Add TitularFiscal and move fiscal data out of Cliente

Introduce la tabla `titulares_fiscales` (CUIT + condición IVA + domicilio
fiscal). `Cliente` deja de tener `cuit` y `condicion_iva`; en su lugar
apunta a un titular fiscal (nullable). Un titular puede ser compartido por
varios clientes (ej: hoteles del mismo grupo empresarial), lo que resuelve
el escenario donde el CUIT único por cliente impedía crear "clientes
operativos" bajo el mismo CUIT.

Backfill: por cada CUIT distinto en `clientes` se crea un titular con esos
datos (razón social, condición IVA, dirección) y se linkea el cliente.

Revision ID: 20260831120000
Revises: 20260831110000
Create Date: 2026-08-31
"""

from alembic import op


revision = "20260831120000"
down_revision = "20260831110000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Nueva tabla
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS titulares_fiscales (
            id UUID PRIMARY KEY,
            cuit VARCHAR(13) NOT NULL UNIQUE,
            razon_social_fiscal VARCHAR(200) NOT NULL,
            condicion_iva VARCHAR(30) NOT NULL DEFAULT 'responsable_inscripto',
            direccion_fiscal VARCHAR(255),
            ciudad_fiscal VARCHAR(100),
            provincia_fiscal VARCHAR(100) DEFAULT 'Córdoba',
            codigo_postal_fiscal VARCHAR(10),
            notas VARCHAR(500),
            activo BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_titulares_fiscales_cuit ON titulares_fiscales(cuit)")

    # 2. FK en clientes (nullable, primero sin llenar)
    op.execute(
        "ALTER TABLE clientes "
        "ADD COLUMN IF NOT EXISTS titular_fiscal_id UUID "
        "REFERENCES titulares_fiscales(id)"
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_clientes_titular_fiscal ON clientes(titular_fiscal_id)")

    # 3. Backfill: un titular por CUIT distinto (elegimos el primer registro
    # por orden de creación como fuente de razón social/dirección fiscal).
    op.execute(
        """
        WITH cuits_unicos AS (
            SELECT DISTINCT ON (cuit)
                cuit,
                razon_social,
                condicion_iva,
                direccion,
                ciudad,
                provincia,
                codigo_postal
            FROM clientes
            WHERE cuit IS NOT NULL AND cuit <> ''
            ORDER BY cuit, created_at ASC
        )
        INSERT INTO titulares_fiscales (
            id, cuit, razon_social_fiscal, condicion_iva,
            direccion_fiscal, ciudad_fiscal, provincia_fiscal, codigo_postal_fiscal
        )
        SELECT
            gen_random_uuid(),
            cuit,
            razon_social,
            COALESCE(condicion_iva, 'responsable_inscripto'),
            direccion,
            ciudad,
            provincia,
            codigo_postal
        FROM cuits_unicos
        ON CONFLICT (cuit) DO NOTHING
        """
    )

    # 4. Linkear cada cliente con CUIT a su titular
    op.execute(
        """
        UPDATE clientes c
        SET titular_fiscal_id = tf.id
        FROM titulares_fiscales tf
        WHERE c.cuit IS NOT NULL AND c.cuit = tf.cuit
        """
    )

    # 5. Sacar unique constraint de clientes.cuit antes de dropear la columna
    op.execute("ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_cuit_key")

    # 6. Dropear columnas fiscales del cliente (viven en el titular)
    op.execute("ALTER TABLE clientes DROP COLUMN IF EXISTS cuit")
    op.execute("ALTER TABLE clientes DROP COLUMN IF EXISTS condicion_iva")


def downgrade() -> None:
    # Recrear columnas fiscales en clientes (NULL por default; sin UNIQUE
    # porque tras el uso multi-cliente por titular podrían haber duplicados
    # legítimos).
    op.execute("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cuit VARCHAR(13)")
    op.execute(
        "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS condicion_iva "
        "VARCHAR(30) NOT NULL DEFAULT 'consumidor_final'"
    )

    # Repopular desde titular
    op.execute(
        """
        UPDATE clientes c
        SET cuit = tf.cuit,
            condicion_iva = tf.condicion_iva
        FROM titulares_fiscales tf
        WHERE c.titular_fiscal_id = tf.id
        """
    )

    # Sacar FK y tabla
    op.execute("DROP INDEX IF EXISTS ix_clientes_titular_fiscal")
    op.execute("ALTER TABLE clientes DROP COLUMN IF EXISTS titular_fiscal_id")
    op.execute("DROP INDEX IF EXISTS ix_titulares_fiscales_cuit")
    op.execute("DROP TABLE IF EXISTS titulares_fiscales")
