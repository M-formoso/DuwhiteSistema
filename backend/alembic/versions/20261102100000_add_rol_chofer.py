"""Agregar rol 'chofer' al enum rol_usuario

El rol 'chofer' tiene permisos acotados: solo ve y opera recolecciones,
entregas en curso y geolocalización de la flota. No ve stock, clientes,
pedidos, facturación ni ninguna sección administrativa. Pensado para que
los choferes de la lavandería tengan una app concreta que les diga qué
pedido levantar, qué entregar y en qué estado está cada vehículo.

Revision ID: 20261102100000
Revises: 20261020120000
Create Date: 2026-11-02
"""

from alembic import op


revision = "20261102100000"
down_revision = "20261020120000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Postgres no permite ALTER TYPE ... ADD VALUE dentro de una transacción
    # explícita. Usamos COMMIT antes para asegurar que la op esté en autocommit.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE rol_usuario ADD VALUE IF NOT EXISTS 'chofer'")


def downgrade() -> None:
    # Postgres no soporta remover valores de un ENUM sin recrearlo entero.
    # Dejamos el downgrade vacío: el rol queda en la BD pero nadie lo usa
    # si rollbackeamos el deploy. Es seguro — no rompe nada.
    pass
