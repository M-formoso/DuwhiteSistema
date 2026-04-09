"""Update etapas produccion to 6 postas

Revision ID: 20260409110000
Revises: 20260409100000
Create Date: 2026-04-09 11:00:00.000000

Esta migración actualiza las etapas de producción a las 6 postas definidas:
1. En Camino - Transportista recoge la ropa
2. Recepción y Pesaje - Ingreso y pesaje
3. Lavado - Selección de canastos y lavadoras
4. Secado - Selección de secadoras
5. Planchado - Al finalizar, libera canastos
6. Conteo y Finalización - Conversión kg→unidades, genera remito
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from uuid import uuid4

# revision identifiers, used by Alembic.
revision = '20260409110000'
down_revision = '20260409100000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Primero desactivar las etapas existentes
    op.execute("UPDATE etapas_produccion SET activo = false")

    # Insertar las nuevas 6 etapas
    etapas = [
        {
            'id': str(uuid4()),
            'codigo': 'CAM',
            'nombre': 'En Camino',
            'descripcion': 'El transportista recoge la ropa del cliente y la lleva a la planta',
            'orden': 1,
            'color': '#6366F1',  # Indigo
            'es_inicial': True,
            'es_final': False,
            'requiere_peso': False,
            'requiere_maquina': False,
            'tiempo_estimado_minutos': 60,
            'activo': True
        },
        {
            'id': str(uuid4()),
            'codigo': 'REC',
            'nombre': 'Recepción y Pesaje',
            'descripcion': 'Ingreso físico de la ropa y pesaje en balanza',
            'orden': 2,
            'color': '#8B5CF6',  # Violet
            'es_inicial': False,
            'es_final': False,
            'requiere_peso': True,
            'requiere_maquina': False,
            'tiempo_estimado_minutos': 15,
            'activo': True
        },
        {
            'id': str(uuid4()),
            'codigo': 'LAV',
            'nombre': 'Lavado',
            'descripcion': 'Proceso de lavado. Requiere seleccionar canastos y lavadoras.',
            'orden': 3,
            'color': '#3B82F6',  # Blue
            'es_inicial': False,
            'es_final': False,
            'requiere_peso': False,
            'requiere_maquina': True,
            'tiempo_estimado_minutos': 45,
            'activo': True
        },
        {
            'id': str(uuid4()),
            'codigo': 'SEC',
            'nombre': 'Secado',
            'descripcion': 'Proceso de secado industrial. Requiere seleccionar secadoras.',
            'orden': 4,
            'color': '#F59E0B',  # Amber
            'es_inicial': False,
            'es_final': False,
            'requiere_peso': False,
            'requiere_maquina': True,
            'tiempo_estimado_minutos': 40,
            'activo': True
        },
        {
            'id': str(uuid4()),
            'codigo': 'PLA',
            'nombre': 'Planchado',
            'descripcion': 'Proceso de planchado. Al finalizar, los canastos quedan libres automáticamente.',
            'orden': 5,
            'color': '#EF4444',  # Red
            'es_inicial': False,
            'es_final': False,
            'requiere_peso': False,
            'requiere_maquina': True,
            'tiempo_estimado_minutos': 30,
            'activo': True
        },
        {
            'id': str(uuid4()),
            'codigo': 'CON',
            'nombre': 'Conteo y Finalización',
            'descripcion': 'Conversión de kg a unidades, asignación de precios, generación de remito y cargo a cuenta corriente.',
            'orden': 6,
            'color': '#22C55E',  # Green
            'es_inicial': False,
            'es_final': True,
            'requiere_peso': False,
            'requiere_maquina': False,
            'tiempo_estimado_minutos': 20,
            'activo': True
        },
    ]

    for etapa in etapas:
        op.execute(f"""
            INSERT INTO etapas_produccion (
                id, codigo, nombre, descripcion, orden, color,
                es_inicial, es_final, requiere_peso, requiere_maquina,
                tiempo_estimado_minutos, activo, created_at, updated_at
            ) VALUES (
                '{etapa['id']}',
                '{etapa['codigo']}',
                '{etapa['nombre']}',
                '{etapa['descripcion']}',
                {etapa['orden']},
                '{etapa['color']}',
                {etapa['es_inicial']},
                {etapa['es_final']},
                {etapa['requiere_peso']},
                {etapa['requiere_maquina']},
                {etapa['tiempo_estimado_minutos']},
                {etapa['activo']},
                NOW(),
                NOW()
            )
        """)


def downgrade() -> None:
    # Desactivar las nuevas etapas
    op.execute("UPDATE etapas_produccion SET activo = false WHERE codigo IN ('CAM', 'REC', 'LAV', 'SEC', 'PLA', 'CON')")

    # Reactivar las etapas originales si existen
    op.execute("UPDATE etapas_produccion SET activo = true WHERE codigo NOT IN ('CAM', 'REC', 'LAV', 'SEC', 'PLA', 'CON')")
