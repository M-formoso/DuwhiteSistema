"""Add vehiculos (GeoTrackers) + vehiculo_id en remitos y lotes

Crea la tabla `vehiculos` que es el catálogo local sincronizado con
GeoTrackers (el `geotrackers_id` es la clave externa estable). Agrega
columnas opcionales:

- `remitos.vehiculo_id` → vehículo que hace la ENTREGA.
- `lotes_produccion.vehiculo_recoleccion_id` → vehículo que hace la
  RECOLECCIÓN de la ropa sucia.

Con estos dos campos + la telemetría de GeoTrackers, en el mapa cada
auto puede mostrar qué pedido está llevando y en qué instancia (recolección
o entrega).

Revision ID: 20261020120000
Revises: 20260831120000
Create Date: 2026-10-20
"""

from alembic import op


revision = "20261020120000"
down_revision = "20260831120000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Tabla vehiculos (catálogo local sincronizado con GeoTrackers)
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS vehiculos (
            id UUID PRIMARY KEY,
            geotrackers_id INTEGER NOT NULL UNIQUE,
            patente VARCHAR(20) NOT NULL,
            nombre VARCHAR(100),
            imei VARCHAR(30),
            chofer_default VARCHAR(100),
            notas VARCHAR(500),
            activo BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_vehiculos_geotrackers_id ON vehiculos(geotrackers_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_vehiculos_patente ON vehiculos(patente)"
    )

    # 2. Columna vehiculo_id en remitos (entrega)
    op.execute(
        """
        ALTER TABLE remitos
            ADD COLUMN IF NOT EXISTS vehiculo_id UUID REFERENCES vehiculos(id)
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_remitos_vehiculo_id ON remitos(vehiculo_id)"
    )

    # 3. Columna vehiculo_recoleccion_id en lotes_produccion (recolección)
    op.execute(
        """
        ALTER TABLE lotes_produccion
            ADD COLUMN IF NOT EXISTS vehiculo_recoleccion_id UUID REFERENCES vehiculos(id)
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_lotes_vehiculo_recoleccion_id ON lotes_produccion(vehiculo_recoleccion_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_lotes_vehiculo_recoleccion_id")
    op.execute("ALTER TABLE lotes_produccion DROP COLUMN IF EXISTS vehiculo_recoleccion_id")
    op.execute("DROP INDEX IF EXISTS ix_remitos_vehiculo_id")
    op.execute("ALTER TABLE remitos DROP COLUMN IF EXISTS vehiculo_id")
    op.execute("DROP INDEX IF EXISTS ix_vehiculos_patente")
    op.execute("DROP INDEX IF EXISTS ix_vehiculos_geotrackers_id")
    op.execute("DROP TABLE IF EXISTS vehiculos")
