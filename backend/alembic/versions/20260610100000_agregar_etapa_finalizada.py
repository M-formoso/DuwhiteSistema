"""agregar etapa FIN (Finalizada) antes de Conteo

Revision ID: 20260610100000
Revises: 20260602120000
Create Date: 2026-06-10

Separa "Conteo y Finalización" en dos postas:
- FIN (Finalizada, orden=6): resumen visual del lote procesado (kg y tiempos).
- CONT/CON renombrado a "Conteo" (orden=7, es_final=true): paso operativo de conteo.

Flujo nuevo: ... SEC/PLA → FIN → CONT/CON
Lotes en curso que aún no están en Conteo van a pasar por FIN.
Lotes que ya estaban en Conteo se quedan ahí.
"""

from alembic import op


revision = "20260610100000"
down_revision = "20260602120000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Renombrar la etapa final actual a "Conteo" y moverla a orden 7.
    op.execute(
        """
        UPDATE etapas_produccion
           SET nombre = 'Conteo',
               descripcion = 'Conteo de unidades por producto y generación de remito.',
               orden = 7,
               es_final = TRUE,
               activo = TRUE
         WHERE codigo IN ('CONT', 'CON')
        """
    )

    # 2) Insertar la nueva etapa FIN si no existe. Color verde lima para
    #    diferenciarla del verde de Conteo.
    op.execute(
        """
        INSERT INTO etapas_produccion (
            id, codigo, nombre, descripcion, orden, color,
            es_inicial, es_final, requiere_peso, requiere_maquina,
            permite_bifurcacion, tiempo_estimado_minutos, activo,
            created_at, updated_at
        )
        SELECT
            gen_random_uuid(), 'FIN', 'Finalizada',
            'Lote terminado de procesar. Muestra el resumen (kg y tiempo por posta) antes del conteo.',
            6, '#84CC16',
            FALSE, FALSE, FALSE, FALSE,
            FALSE, 5, TRUE,
            NOW(), NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM etapas_produccion WHERE codigo = 'FIN'
        )
        """
    )

    # 3) Configurar flujo: SEC/PLA → FIN, FIN → Conteo.
    op.execute(
        """
        UPDATE etapas_produccion
           SET siguiente_etapa_id = (SELECT id FROM etapas_produccion WHERE codigo = 'FIN')
         WHERE codigo IN ('SEC', 'PLA')
        """
    )
    op.execute(
        """
        UPDATE etapas_produccion
           SET siguiente_etapa_id = (
                SELECT id FROM etapas_produccion
                 WHERE codigo IN ('CONT', 'CON')
                 ORDER BY orden DESC
                 LIMIT 1
           )
         WHERE codigo = 'FIN'
        """
    )

    # 4) Reordenar lote_etapa de Conteo a orden=7 (antes era 6) para mantener
    #    consistencia visual al listar el historial del lote.
    op.execute(
        """
        UPDATE lotes_etapas
           SET orden = 7
         WHERE etapa_id IN (
                SELECT id FROM etapas_produccion WHERE codigo IN ('CONT', 'CON')
           )
        """
    )

    # 5) Crear LoteEtapa de FIN (estado=pendiente, orden=6) para todos los
    #    lotes que aún no llegaron a Conteo y no están completados, así pueden
    #    pasar por la nueva posta. Se omite si el lote ya tiene LoteEtapa de FIN.
    op.execute(
        """
        INSERT INTO lotes_etapas (id, lote_id, etapa_id, orden, estado, created_at, updated_at)
        SELECT
            gen_random_uuid(),
            lp.id,
            (SELECT id FROM etapas_produccion WHERE codigo = 'FIN'),
            6,
            'pendiente',
            NOW(),
            NOW()
          FROM lotes_produccion lp
         WHERE lp.activo = TRUE
           AND lp.estado NOT IN ('completado', 'cancelado')
           AND lp.etapa_actual_id NOT IN (
                SELECT id FROM etapas_produccion WHERE codigo IN ('CONT', 'CON')
           )
           AND NOT EXISTS (
                SELECT 1 FROM lotes_etapas le
                 WHERE le.lote_id = lp.id
                   AND le.etapa_id = (SELECT id FROM etapas_produccion WHERE codigo = 'FIN')
           )
        """
    )


def downgrade() -> None:
    # Revertir flujo: SEC/PLA → Conteo directo.
    op.execute(
        """
        UPDATE etapas_produccion
           SET siguiente_etapa_id = (
                SELECT id FROM etapas_produccion WHERE codigo IN ('CONT', 'CON') LIMIT 1
           )
         WHERE codigo IN ('SEC', 'PLA')
        """
    )

    # Borrar LoteEtapa de FIN.
    op.execute(
        """
        DELETE FROM lotes_etapas
         WHERE etapa_id = (SELECT id FROM etapas_produccion WHERE codigo = 'FIN')
        """
    )

    # Desactivar la etapa FIN (no la borramos por si hay FKs históricas).
    op.execute(
        "UPDATE etapas_produccion SET activo = FALSE, siguiente_etapa_id = NULL WHERE codigo = 'FIN'"
    )

    # Volver Conteo a orden=6 y nombre anterior.
    op.execute(
        """
        UPDATE etapas_produccion
           SET nombre = 'Conteo y Finalización',
               descripcion = 'Conversión de kg a unidades, asignación de precios, generación de remito y cargo a cuenta corriente.',
               orden = 6
         WHERE codigo IN ('CONT', 'CON')
        """
    )

    op.execute(
        """
        UPDATE lotes_etapas
           SET orden = 6
         WHERE etapa_id IN (
                SELECT id FROM etapas_produccion WHERE codigo IN ('CONT', 'CON')
           )
        """
    )
