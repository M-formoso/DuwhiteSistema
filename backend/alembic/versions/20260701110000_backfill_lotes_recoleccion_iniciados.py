"""Backfill: auto-iniciar lotes creados por recolección

Los lotes que se crearon desde /recoleccion antes de que el service
auto-inicie la primera etapa siguen apareciendo como "Iniciar Etapa"
en el Kanban en vez de "Finalizar". Estos lotes se pueden identificar
porque su pedido asociado tiene retirado_por_id (o hora_inicio_retiro)
seteado.

Los ponemos en_proceso en su etapa actual y les copiamos la
hora_inicio_retiro del pedido como fecha_inicio de la LoteEtapa. Sin
esto habría que apretar "Iniciar Etapa" en cada tarjeta del Kanban
para desbloquear el flujo.

Revision ID: 20260701110000
Revises: 20260701100000
Create Date: 2026-07-01
"""

from alembic import op
import sqlalchemy as sa


revision = "20260701110000"
down_revision = "20260701100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Marca la LoteEtapa activa (la que apunta a etapa_actual_id del
    # lote) como en_proceso para todos los lotes cuya pedido asociado
    # venga de recolección (retirado_por_id no null). Sólo toca lotes
    # activos que todavía no arrancaron esa etapa.
    op.execute(sa.text("""
        UPDATE lotes_etapas le
           SET estado = 'en_proceso',
               fecha_inicio = COALESCE(
                   le.fecha_inicio,
                   p.hora_inicio_retiro,
                   NOW()
               ),
               responsable_id = COALESCE(
                   le.responsable_id,
                   p.retirado_por_id
               )
          FROM lotes_produccion l
          JOIN pedidos p ON p.id = l.pedido_id
         WHERE le.lote_id = l.id
           AND le.etapa_id = l.etapa_actual_id
           AND le.estado = 'pendiente'
           AND le.fecha_fin IS NULL
           AND l.activo = TRUE
           AND p.retirado_por_id IS NOT NULL
    """))

    # Y el lote en sí (si estaba pendiente) pasa a en_proceso.
    op.execute(sa.text("""
        UPDATE lotes_produccion l
           SET estado = 'en_proceso',
               fecha_inicio_proceso = COALESCE(
                   l.fecha_inicio_proceso,
                   p.hora_inicio_retiro,
                   NOW()
               )
          FROM pedidos p
         WHERE p.id = l.pedido_id
           AND l.activo = TRUE
           AND l.estado = 'pendiente'
           AND p.retirado_por_id IS NOT NULL
    """))


def downgrade() -> None:
    # No se puede revertir sin registrar los valores previos. Dejamos
    # noop; si hace falta, se revierte manualmente por lote.
    pass
