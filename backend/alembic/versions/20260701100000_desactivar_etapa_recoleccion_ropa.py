"""Desactivar etapa "Recolección de Ropa" — quedó redundante

La primera etapa del flujo ("Recolección de Ropa") quedó redundante
después de agregar el módulo /recoleccion, que ya cubre esa parte y
además arranca el lote directamente en Recepción y Recepción. Se
soft-deletea (activo=False) para que no aparezca más como primera
columna del Kanban, sin romper lotes históricos que puedan estar
apuntando a ella.

Si el ambiente todavía tenía es_inicial=True en esa etapa, se pasa a
la siguiente etapa activa por orden.

Revision ID: 20260701100000
Revises: 20260630130000
Create Date: 2026-07-01
"""

from alembic import op
import sqlalchemy as sa


revision = "20260701100000"
down_revision = "20260630130000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Desactivar por nombre (case-insensitive). Cubrimos las variantes
    #    típicas por si el nombre en producción difiere en tildes/case.
    op.execute(sa.text("""
        UPDATE etapas_produccion
           SET activo = FALSE,
               es_inicial = FALSE
         WHERE lower(nombre) IN (
                 'recolección de ropa',
                 'recoleccion de ropa'
             )
            OR upper(codigo) IN ('GIR', 'GIROS', 'RECOL', 'RECOLECCION')
    """))

    # 2) Asegurar que exista una etapa inicial. Si ninguna quedó con
    #    es_inicial=True, tomamos la de menor orden entre las activas.
    op.execute(sa.text("""
        DO $$
        DECLARE
            hay_inicial BOOLEAN;
            id_menor UUID;
        BEGIN
            SELECT EXISTS(
                SELECT 1 FROM etapas_produccion
                 WHERE es_inicial = TRUE AND activo = TRUE
            ) INTO hay_inicial;

            IF NOT hay_inicial THEN
                SELECT id INTO id_menor
                  FROM etapas_produccion
                 WHERE activo = TRUE
                 ORDER BY orden ASC
                 LIMIT 1;

                IF id_menor IS NOT NULL THEN
                    UPDATE etapas_produccion
                       SET es_inicial = TRUE
                     WHERE id = id_menor;
                END IF;
            END IF;
        END $$;
    """))

    # 3) Migrar lotes que estén apuntando a la etapa desactivada
    #    hacia la nueva etapa inicial (activo=True, orden mínimo). Sin
    #    esto los lotes quedarían "colgados" sin columna en el Kanban.
    op.execute(sa.text("""
        WITH etapa_destino AS (
            SELECT id
              FROM etapas_produccion
             WHERE activo = TRUE
             ORDER BY orden ASC
             LIMIT 1
        )
        UPDATE lotes_produccion l
           SET etapa_actual_id = ed.id
          FROM etapa_destino ed
         WHERE l.activo = TRUE
           AND l.etapa_actual_id IN (
                 SELECT id FROM etapas_produccion WHERE activo = FALSE
             )
    """))



def downgrade() -> None:
    # Reactivar la etapa por nombre. No podemos garantizar cuál era la
    # inicial antes, así que dejamos que el operador la marque si hace
    # falta.
    op.execute(sa.text("""
        UPDATE etapas_produccion
           SET activo = TRUE
         WHERE lower(nombre) IN (
                 'recolección de ropa',
                 'recoleccion de ropa'
             )
            OR upper(codigo) IN ('GIR', 'GIROS', 'RECOL', 'RECOLECCION')
    """))
