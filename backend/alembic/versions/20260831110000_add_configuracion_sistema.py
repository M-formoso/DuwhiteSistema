"""Add configuracion_sistema (singleton)

Persiste los datos de la empresa (nombre, razón social, CUIT, dirección,
contacto, etc.) que antes vivían solo en env vars (`settings.EMPRESA_*`).
Al aplicar la migración se inserta la fila inicial con los valores
actuales de settings, para no romper el output de PDFs ya generados.

Revision ID: 20260831110000
Revises: 20260831100000
Create Date: 2026-08-31
"""

import uuid

from alembic import op
from sqlalchemy import text


revision = "20260831110000"
down_revision = "20260831100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS configuracion_sistema (
            id UUID PRIMARY KEY,
            empresa_nombre VARCHAR(150) NOT NULL DEFAULT '',
            empresa_razon_social VARCHAR(200) NOT NULL DEFAULT '',
            empresa_cuit VARCHAR(20) NOT NULL DEFAULT '',
            empresa_condicion_iva VARCHAR(50) NOT NULL DEFAULT 'Responsable Inscripto',
            empresa_direccion VARCHAR(200) NOT NULL DEFAULT '',
            empresa_localidad VARCHAR(100) NOT NULL DEFAULT '',
            empresa_provincia VARCHAR(100) NOT NULL DEFAULT '',
            empresa_codigo_postal VARCHAR(20) NOT NULL DEFAULT '',
            empresa_telefono VARCHAR(50) NOT NULL DEFAULT '',
            empresa_email VARCHAR(150) NOT NULL DEFAULT '',
            empresa_sitio_web VARCHAR(150) NOT NULL DEFAULT '',
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """
    )

    # Seed inicial: si no hay filas, insertar una tomando los valores
    # actuales de settings (env vars o defaults en config.py).
    from app.core.config import settings

    connection = op.get_bind()
    existe = connection.execute(
        text("SELECT 1 FROM configuracion_sistema LIMIT 1")
    ).first()
    if existe:
        return

    connection.execute(
        text(
            """
            INSERT INTO configuracion_sistema (
                id, empresa_nombre, empresa_razon_social, empresa_cuit,
                empresa_condicion_iva, empresa_direccion, empresa_localidad,
                empresa_provincia, empresa_codigo_postal, empresa_telefono,
                empresa_email, empresa_sitio_web
            ) VALUES (
                :id, :nombre, :razon_social, :cuit,
                :condicion_iva, :direccion, :localidad,
                :provincia, :codigo_postal, :telefono,
                :email, :sitio_web
            )
            """
        ),
        {
            "id": str(uuid.uuid4()),
            "nombre": settings.EMPRESA_NOMBRE or "",
            "razon_social": settings.EMPRESA_RAZON_SOCIAL or "",
            "cuit": settings.EMPRESA_CUIT or "",
            "condicion_iva": settings.EMPRESA_CONDICION_IVA or "Responsable Inscripto",
            "direccion": settings.EMPRESA_DIRECCION or "",
            "localidad": settings.EMPRESA_LOCALIDAD or "",
            "provincia": settings.EMPRESA_PROVINCIA or "",
            "codigo_postal": "",
            "telefono": "",
            "email": settings.EMAIL_FROM or "",
            "sitio_web": "",
        },
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS configuracion_sistema")
