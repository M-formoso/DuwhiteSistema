"""Add etapa Estirado y campos de bifurcacion

Revision ID: 20260415100000
Revises: 20260411100000
Create Date: 2026-04-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from uuid import uuid4

# revision identifiers, used by Alembic.
revision = '20260415100000'
down_revision = '20260411100000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Agregar campos de bifurcacion a etapas_produccion
    op.add_column('etapas_produccion', sa.Column('permite_bifurcacion', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('etapas_produccion', sa.Column('etapa_destino_principal_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('etapas_produccion', sa.Column('etapa_destino_alternativa_id', postgresql.UUID(as_uuid=True), nullable=True))

    # 2. Insertar la etapa ESTIRADO
    # Primero obtener los IDs de LAV y SEC para configurar la bifurcacion
    conn = op.get_bind()

    # Obtener ID de etapa Lavado
    result = conn.execute(sa.text("SELECT id FROM etapas_produccion WHERE codigo = 'LAV' AND activo = true LIMIT 1"))
    row = result.fetchone()
    lavado_id = str(row[0]) if row else None

    # Obtener ID de etapa Secado
    result = conn.execute(sa.text("SELECT id FROM etapas_produccion WHERE codigo = 'SEC' AND activo = true LIMIT 1"))
    row = result.fetchone()
    secado_id = str(row[0]) if row else None

    # Actualizar orden de etapas posteriores a LAV (orden > 2) para hacer espacio
    conn.execute(sa.text("""
        UPDATE etapas_produccion
        SET orden = orden + 1
        WHERE orden > 2 AND activo = true
    """))

    # Generar nuevo ID para ESTIRADO
    estirado_id = str(uuid4())

    # Insertar etapa ESTIRADO
    conn.execute(sa.text("""
        INSERT INTO etapas_produccion (
            id, codigo, nombre, descripcion, orden, color,
            es_inicial, es_final, requiere_peso, requiere_maquina,
            tiempo_estimado_minutos, activo, permite_bifurcacion,
            etapa_destino_principal_id, etapa_destino_alternativa_id,
            created_at, updated_at
        ) VALUES (
            :id, 'EST', 'Estirado',
            'Etapa de estirado donde se decide si el producto va a Secado o vuelve a Lavado',
            3, '#9C27B0',
            false, false, true, false,
            15, true, true,
            :secado_id, :lavado_id,
            NOW(), NOW()
        )
    """), {
        'id': estirado_id,
        'secado_id': secado_id,
        'lavado_id': lavado_id,
    })


def downgrade() -> None:
    conn = op.get_bind()

    # Eliminar etapa ESTIRADO
    conn.execute(sa.text("DELETE FROM etapas_produccion WHERE codigo = 'EST'"))

    # Restaurar orden de etapas
    conn.execute(sa.text("""
        UPDATE etapas_produccion
        SET orden = orden - 1
        WHERE orden > 3 AND activo = true
    """))

    # Eliminar columnas de bifurcacion
    op.drop_column('etapas_produccion', 'etapa_destino_alternativa_id')
    op.drop_column('etapas_produccion', 'etapa_destino_principal_id')
    op.drop_column('etapas_produccion', 'permite_bifurcacion')
