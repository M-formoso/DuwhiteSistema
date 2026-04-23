"""Create facturas and facturas_detalle tables

Revision ID: 20260423100000
Revises: 20260421100000
Create Date: 2026-04-23

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260423100000"
down_revision = "20260421100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tabla facturas
    op.create_table(
        "facturas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        # Timestamps + soft delete (BaseModelMixin)
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        # Tipo y numeración
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("punto_venta", sa.Integer(), nullable=False),
        sa.Column("numero_comprobante", sa.Integer(), nullable=True),
        sa.Column("numero_completo", sa.String(20), nullable=True),
        # Cliente (con snapshot)
        sa.Column("cliente_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clientes.id"), nullable=False),
        sa.Column("cliente_razon_social_snap", sa.String(200), nullable=False),
        sa.Column("cliente_cuit_snap", sa.String(13), nullable=True),
        sa.Column("cliente_documento_tipo_snap", sa.String(10), nullable=True),
        sa.Column("cliente_documento_nro_snap", sa.String(20), nullable=True),
        sa.Column("cliente_condicion_iva_snap", sa.String(30), nullable=False),
        sa.Column("cliente_domicilio_snap", sa.String(255), nullable=True),
        # Origen
        sa.Column("pedido_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pedidos.id"), nullable=True),
        sa.Column("factura_original_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("facturas.id"), nullable=True),
        # Fechas
        sa.Column("fecha_emision", sa.Date(), nullable=False),
        sa.Column("fecha_servicio_desde", sa.Date(), nullable=True),
        sa.Column("fecha_servicio_hasta", sa.Date(), nullable=True),
        sa.Column("fecha_vencimiento_pago", sa.Date(), nullable=True),
        # Concepto
        sa.Column("concepto_afip", sa.String(1), nullable=False, server_default="2"),
        # Totales
        sa.Column("subtotal", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("descuento_monto", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("neto_gravado_21", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("neto_gravado_105", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("neto_no_gravado", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("iva_21", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("iva_105", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("percepciones", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        # Condición venta
        sa.Column("condicion_venta", sa.String(30), nullable=False, server_default="cuenta_corriente"),
        # Estado / AFIP
        sa.Column("estado", sa.String(20), nullable=False, server_default="borrador"),
        sa.Column("cae", sa.String(20), nullable=True),
        sa.Column("cae_vencimiento", sa.Date(), nullable=True),
        sa.Column("afip_resultado", sa.String(1), nullable=True),
        sa.Column("afip_observaciones", sa.Text(), nullable=True),
        sa.Column("afip_errores", sa.Text(), nullable=True),
        sa.Column("afip_response_raw", postgresql.JSONB(), nullable=True),
        sa.Column("emitido_at", sa.DateTime(), nullable=True),
        # Anulación
        sa.Column("anulada_por_nc_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("facturas.id"), nullable=True),
        # PDF
        sa.Column("pdf_path", sa.String(500), nullable=True),
        # Observaciones
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("motivo", sa.Text(), nullable=True),
        # Movimiento cta cte
        sa.Column(
            "movimiento_cuenta_corriente_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("movimientos_cuenta_corriente.id"),
            nullable=True,
        ),
        # Control
        sa.Column("creado_por_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("emitido_por_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("usuarios.id"), nullable=True),
    )

    op.create_index("ix_facturas_tipo", "facturas", ["tipo"])
    op.create_index("ix_facturas_estado", "facturas", ["estado"])
    op.create_index("ix_facturas_cae", "facturas", ["cae"])
    op.create_index("ix_facturas_numero_completo", "facturas", ["numero_completo"])
    op.create_index("ix_facturas_cliente_id", "facturas", ["cliente_id"])
    op.create_index("ix_facturas_fecha_emision", "facturas", ["fecha_emision"])
    # Número único dentro de un tipo + punto de venta (una vez emitido)
    op.create_unique_constraint(
        "uq_facturas_tipo_pv_numero",
        "facturas",
        ["tipo", "punto_venta", "numero_comprobante"],
    )

    # Tabla facturas_detalle
    op.create_table(
        "facturas_detalle",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("factura_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("facturas.id"), nullable=False),
        sa.Column("detalle_pedido_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("detalles_pedido.id"), nullable=True),
        sa.Column("producto_lavado_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("productos_lavado.id"), nullable=True),
        sa.Column("descripcion", sa.String(500), nullable=False),
        sa.Column("cantidad", sa.Numeric(12, 2), nullable=False, server_default="1"),
        sa.Column("unidad_medida", sa.String(30), nullable=False, server_default="unidad"),
        sa.Column("precio_unitario_neto", sa.Numeric(14, 4), nullable=False),
        sa.Column("descuento_porcentaje", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("iva_porcentaje", sa.Numeric(5, 2), nullable=False, server_default="21"),
        sa.Column("subtotal_neto", sa.Numeric(14, 2), nullable=False),
        sa.Column("iva_monto", sa.Numeric(14, 2), nullable=False),
        sa.Column("total_linea", sa.Numeric(14, 2), nullable=False),
    )

    op.create_index("ix_facturas_detalle_factura_id", "facturas_detalle", ["factura_id"])


def downgrade() -> None:
    op.drop_index("ix_facturas_detalle_factura_id", table_name="facturas_detalle")
    op.drop_table("facturas_detalle")

    op.drop_constraint("uq_facturas_tipo_pv_numero", "facturas", type_="unique")
    op.drop_index("ix_facturas_fecha_emision", table_name="facturas")
    op.drop_index("ix_facturas_cliente_id", table_name="facturas")
    op.drop_index("ix_facturas_numero_completo", table_name="facturas")
    op.drop_index("ix_facturas_cae", table_name="facturas")
    op.drop_index("ix_facturas_estado", table_name="facturas")
    op.drop_index("ix_facturas_tipo", table_name="facturas")
    op.drop_table("facturas")
