"""Franco ya no suma al sueldo: poner monto=0 en registros existentes

A pedido del cliente, el franco pasa a ser solo un registro/conteo
(cuántos días de franco tomó el empleado) y NO se suma al sueldo final.
El que sí se paga aparte es el feriado trabajado.

Esta migración limpia los registros históricos de tipo 'franco' poniendo
monto=0 y valor_dia=NULL, para que el detalle del empleado no muestre
montos fantasma que no se están sumando al sueldo.

Revision ID: 20260623110000
Revises: 20260623100000
Create Date: 2026-06-23
"""

from alembic import op
import sqlalchemy as sa


revision = "20260623110000"
down_revision = "20260623100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("""
        UPDATE movimientos_nomina
           SET monto = 0,
               valor_dia = NULL
         WHERE tipo = 'franco'
    """))


def downgrade() -> None:
    # No se puede revertir: los valores originales no quedaron registrados.
    pass
