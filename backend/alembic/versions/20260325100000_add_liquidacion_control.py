"""Add liquidacion and control stage

Revision ID: 20260325100000
Revises: 20260324_jornales
Create Date: 2026-03-25

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = '20260325100000'
down_revision = '20260324_jornales'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Crear tabla liquidaciones_pedido
    op.create_table(
        'liquidaciones_pedido',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('numero', sa.String(20), unique=True, nullable=False, index=True),

        # Referencias
        sa.Column('pedido_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('pedidos.id'), nullable=False),
        sa.Column('cliente_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clientes.id'), nullable=False),
        sa.Column('lista_precios_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('listas_precios.id'), nullable=True),

        # Totales
        sa.Column('subtotal', sa.Numeric(12, 2), nullable=False, default=0),
        sa.Column('descuento_porcentaje', sa.Numeric(5, 2), nullable=True, default=0),
        sa.Column('descuento_monto', sa.Numeric(12, 2), nullable=True, default=0),
        sa.Column('iva_porcentaje', sa.Numeric(5, 2), nullable=True, default=21),
        sa.Column('iva_monto', sa.Numeric(12, 2), nullable=True, default=0),
        sa.Column('total', sa.Numeric(12, 2), nullable=False, default=0),

        # Estado: borrador, confirmada, facturada, anulada
        sa.Column('estado', sa.String(20), nullable=False, default='borrador'),

        # Fechas
        sa.Column('fecha_liquidacion', sa.Date, nullable=False),

        # Vinculación con cuenta corriente
        sa.Column('movimiento_cc_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('movimientos_cuenta_corriente.id'), nullable=True),

        # Control
        sa.Column('liquidado_por_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.id'), nullable=False),
        sa.Column('confirmado_por_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.id'), nullable=True),
        sa.Column('fecha_confirmacion', sa.DateTime, nullable=True),

        # Anulación
        sa.Column('anulado', sa.Boolean, default=False),
        sa.Column('anulado_por_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('usuarios.id'), nullable=True),
        sa.Column('fecha_anulacion', sa.DateTime, nullable=True),
        sa.Column('motivo_anulacion', sa.Text, nullable=True),

        # Observaciones
        sa.Column('notas', sa.Text, nullable=True),

        # Timestamps y activo
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=True, onupdate=sa.func.now()),
        sa.Column('activo', sa.Boolean, default=True, nullable=False),
    )

    # Índices para liquidaciones
    op.create_index('ix_liquidaciones_pedido_pedido_id', 'liquidaciones_pedido', ['pedido_id'])
    op.create_index('ix_liquidaciones_pedido_cliente_id', 'liquidaciones_pedido', ['cliente_id'])
    op.create_index('ix_liquidaciones_pedido_estado', 'liquidaciones_pedido', ['estado'])
    op.create_index('ix_liquidaciones_pedido_fecha', 'liquidaciones_pedido', ['fecha_liquidacion'])

    # 2. Crear tabla detalles_liquidacion
    op.create_table(
        'detalles_liquidacion',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('liquidacion_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('liquidaciones_pedido.id', ondelete='CASCADE'), nullable=False),

        # Servicio
        sa.Column('servicio_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('servicios.id'), nullable=True),
        sa.Column('servicio_nombre', sa.String(100), nullable=False),  # Snapshot del nombre
        sa.Column('descripcion', sa.String(255), nullable=True),

        # Cantidades
        sa.Column('cantidad', sa.Numeric(10, 2), nullable=False),
        sa.Column('unidad', sa.String(20), nullable=False, default='kg'),

        # Precios
        sa.Column('precio_unitario', sa.Numeric(12, 2), nullable=False),
        sa.Column('subtotal', sa.Numeric(12, 2), nullable=False),

        # Referencia al lote (opcional)
        sa.Column('lote_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lotes_produccion.id'), nullable=True),

        # Orden y notas
        sa.Column('numero_linea', sa.Integer, nullable=False, default=1),
        sa.Column('notas', sa.Text, nullable=True),
    )

    op.create_index('ix_detalles_liquidacion_liquidacion_id', 'detalles_liquidacion', ['liquidacion_id'])

    # 3. Agregar campo liquidacion_id a movimientos_cuenta_corriente
    op.add_column('movimientos_cuenta_corriente',
        sa.Column('liquidacion_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('liquidaciones_pedido.id'), nullable=True)
    )

    # 4. Insertar etapa "Control y Revisión" en etapas_produccion
    # Primero actualizar el orden de las etapas existentes
    op.execute("""
        UPDATE etapas_produccion
        SET orden = orden + 1
        WHERE orden >= 5 AND codigo NOT IN ('CONTROL')
    """)

    # Insertar la nueva etapa
    control_id = str(uuid.uuid4())
    op.execute(f"""
        INSERT INTO etapas_produccion
        (id, codigo, nombre, descripcion, orden, color, es_inicial, es_final, requiere_peso, requiere_maquina, tiempo_estimado_minutos, activo, created_at, updated_at)
        VALUES
        ('{control_id}', 'CONTROL', 'Control y Revisión', 'Verificación de cantidades reales procesadas y control de calidad', 5, '#F97316', false, false, true, false, 30, true, NOW(), NOW())
        ON CONFLICT (codigo) DO NOTHING
    """)


def downgrade() -> None:
    # Eliminar campo liquidacion_id de movimientos_cuenta_corriente
    op.drop_column('movimientos_cuenta_corriente', 'liquidacion_id')

    # Eliminar tablas
    op.drop_table('detalles_liquidacion')
    op.drop_table('liquidaciones_pedido')

    # Eliminar etapa Control
    op.execute("DELETE FROM etapas_produccion WHERE codigo = 'CONTROL'")

    # Restaurar orden de etapas
    op.execute("""
        UPDATE etapas_produccion
        SET orden = orden - 1
        WHERE orden > 5
    """)
