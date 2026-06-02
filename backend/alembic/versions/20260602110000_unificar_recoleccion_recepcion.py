"""unificar CAM (En Camino) + REC (Recepcion) en una sola posta

Revision ID: 20260602110000
Revises: 20260602100000
Create Date: 2026-06-02

- Mueve lotes activos en etapa CAM a la etapa REC (preservando fecha_inicio_etapa).
- Marca como saltadas las lotes_etapas pendientes de CAM (estado='omitida').
- Renombra REC a "Recolección y Recepción", la deja como única etapa inicial (orden=1).
- Desactiva CAM (activo=false, es_inicial=false).
"""

from alembic import op


revision = "20260602110000"
down_revision = "20260602100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Mover lotes que tengan etapa_actual_id = etapa CAM hacia etapa REC.
    op.execute(
        """
        UPDATE lotes_produccion lp
           SET etapa_actual_id = (SELECT id FROM etapas_produccion WHERE codigo = 'REC')
         WHERE lp.etapa_actual_id IN (SELECT id FROM etapas_produccion WHERE codigo = 'CAM')
        """
    )

    # 2) Marcar como 'omitida' las lotes_etapas pendientes de CAM (no se procesarán).
    op.execute(
        """
        UPDATE lotes_etapas le
           SET estado = 'omitida'
         WHERE le.etapa_id IN (SELECT id FROM etapas_produccion WHERE codigo = 'CAM')
           AND le.estado = 'pendiente'
        """
    )

    # 3) Renombrar REC y dejarla como etapa inicial.
    op.execute(
        """
        UPDATE etapas_produccion
           SET nombre = 'Recolección y Recepción',
               descripcion = 'Carga del cliente, ingreso a la planta y pesaje en balanza.',
               orden = 1,
               es_inicial = TRUE,
               activo = TRUE
         WHERE codigo = 'REC'
        """
    )

    # 4) Desactivar CAM y sacarle el flag de inicial.
    op.execute(
        """
        UPDATE etapas_produccion
           SET activo = FALSE,
               es_inicial = FALSE
         WHERE codigo = 'CAM'
        """
    )


def downgrade() -> None:
    # Reactivar CAM como etapa inicial original.
    op.execute(
        """
        UPDATE etapas_produccion
           SET activo = TRUE,
               es_inicial = TRUE
         WHERE codigo = 'CAM'
        """
    )
    # Revertir REC a su nombre/orden anterior.
    op.execute(
        """
        UPDATE etapas_produccion
           SET nombre = 'Recepción y Pesaje',
               descripcion = 'Ingreso físico de la ropa y pesaje en balanza',
               orden = 2,
               es_inicial = FALSE
         WHERE codigo = 'REC'
        """
    )
