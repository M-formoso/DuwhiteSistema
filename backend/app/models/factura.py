"""
Modelo de Factura, FacturaDetalle y enums asociados.

Representa comprobantes fiscales argentinos (Factura A/B, NC A/B, ND A/B).
La emisión pasa por AFIP WSFEv1 y obtiene CAE.
"""

from enum import Enum
from typing import Optional
from sqlalchemy import (
    Column,
    String,
    Numeric,
    Text,
    Date,
    DateTime,
    Integer,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base
from app.models.base import BaseModelMixin


class TipoComprobante(str, Enum):
    """Tipos de comprobante AFIP soportados.

    El valor del enum corresponde al código interno DUWHITE.
    Los códigos AFIP (CbteTipo) están en ``CODIGO_AFIP`` abajo.
    """

    FACTURA_A = "factura_a"
    FACTURA_B = "factura_b"
    NOTA_CREDITO_A = "nota_credito_a"
    NOTA_CREDITO_B = "nota_credito_b"
    NOTA_DEBITO_A = "nota_debito_a"
    NOTA_DEBITO_B = "nota_debito_b"


CODIGO_AFIP = {
    TipoComprobante.FACTURA_A: 1,
    TipoComprobante.NOTA_DEBITO_A: 2,
    TipoComprobante.NOTA_CREDITO_A: 3,
    TipoComprobante.FACTURA_B: 6,
    TipoComprobante.NOTA_DEBITO_B: 7,
    TipoComprobante.NOTA_CREDITO_B: 8,
}


LETRA_COMPROBANTE = {
    TipoComprobante.FACTURA_A: "A",
    TipoComprobante.NOTA_CREDITO_A: "A",
    TipoComprobante.NOTA_DEBITO_A: "A",
    TipoComprobante.FACTURA_B: "B",
    TipoComprobante.NOTA_CREDITO_B: "B",
    TipoComprobante.NOTA_DEBITO_B: "B",
}


class EstadoFactura(str, Enum):
    """Ciclo de vida de la factura."""

    BORRADOR = "borrador"         # Creada, editable, sin CAE
    AUTORIZADA = "autorizada"     # Con CAE, inmutable
    RECHAZADA = "rechazada"       # AFIP devolvió "R"
    ANULADA = "anulada"           # Cancelada por Nota de Crédito total


class ConceptoAfip(str, Enum):
    """Concepto de operación AFIP."""

    PRODUCTOS = "1"
    SERVICIOS = "2"
    PRODUCTOS_Y_SERVICIOS = "3"


class CondicionVenta(str, Enum):
    """Condición de venta del comprobante."""

    CONTADO = "contado"
    CUENTA_CORRIENTE = "cuenta_corriente"


class Factura(Base, BaseModelMixin):
    """
    Modelo de Factura / Nota de Crédito / Nota de Débito.

    Incluye snapshot de datos del cliente al momento de emitir, para que
    cambios posteriores en el cliente no alteren el comprobante histórico.
    """

    __tablename__ = "facturas"

    # Tipo y numeración
    tipo = Column(String(30), nullable=False, index=True)  # TipoComprobante
    punto_venta = Column(Integer, nullable=False)
    numero_comprobante = Column(Integer, nullable=True)  # Asignado al emitir a AFIP
    numero_completo = Column(String(20), nullable=True, index=True)  # "0001-00000123"

    # Cliente
    cliente_id = Column(UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=False)
    cliente_razon_social_snap = Column(String(200), nullable=False)
    cliente_cuit_snap = Column(String(13), nullable=True)
    cliente_documento_tipo_snap = Column(String(10), nullable=True)  # CUIT, DNI, CF
    cliente_documento_nro_snap = Column(String(20), nullable=True)
    cliente_condicion_iva_snap = Column(String(30), nullable=False)
    cliente_domicilio_snap = Column(String(255), nullable=True)

    # Origen
    pedido_id = Column(UUID(as_uuid=True), ForeignKey("pedidos.id"), nullable=True)
    factura_original_id = Column(
        UUID(as_uuid=True), ForeignKey("facturas.id"), nullable=True
    )  # Para NC / ND

    # Fechas
    fecha_emision = Column(Date, nullable=False)
    fecha_servicio_desde = Column(Date, nullable=True)
    fecha_servicio_hasta = Column(Date, nullable=True)
    fecha_vencimiento_pago = Column(Date, nullable=True)

    # Concepto (productos, servicios, ambos)
    concepto_afip = Column(String(1), nullable=False, default=ConceptoAfip.SERVICIOS.value)

    # Totales
    subtotal = Column(Numeric(14, 2), nullable=False, default=0)  # Suma de líneas
    descuento_monto = Column(Numeric(14, 2), nullable=False, default=0)
    neto_gravado_21 = Column(Numeric(14, 2), nullable=False, default=0)
    neto_gravado_105 = Column(Numeric(14, 2), nullable=False, default=0)
    neto_no_gravado = Column(Numeric(14, 2), nullable=False, default=0)
    iva_21 = Column(Numeric(14, 2), nullable=False, default=0)
    iva_105 = Column(Numeric(14, 2), nullable=False, default=0)
    percepciones = Column(Numeric(14, 2), nullable=False, default=0)
    total = Column(Numeric(14, 2), nullable=False, default=0)

    # Condición de venta
    condicion_venta = Column(
        String(30), nullable=False, default=CondicionVenta.CUENTA_CORRIENTE.value
    )

    # Estado / AFIP
    estado = Column(String(20), nullable=False, default=EstadoFactura.BORRADOR.value, index=True)
    cae = Column(String(20), nullable=True, index=True)
    cae_vencimiento = Column(Date, nullable=True)
    afip_resultado = Column(String(1), nullable=True)  # A (aceptado), R (rechazado), P (parcial)
    afip_observaciones = Column(Text, nullable=True)
    afip_errores = Column(Text, nullable=True)
    afip_response_raw = Column(JSONB, nullable=True)  # Para auditoría
    emitido_at = Column(DateTime, nullable=True)

    # Anulación
    anulada_por_nc_id = Column(UUID(as_uuid=True), ForeignKey("facturas.id"), nullable=True)

    # PDF cacheado
    pdf_path = Column(String(500), nullable=True)

    # Observaciones / motivo NC
    observaciones = Column(Text, nullable=True)
    motivo = Column(Text, nullable=True)  # Principalmente para NC/ND

    # Movimiento de cuenta corriente asociado
    movimiento_cuenta_corriente_id = Column(
        UUID(as_uuid=True),
        ForeignKey("movimientos_cuenta_corriente.id"),
        nullable=True,
    )

    # Control
    creado_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    emitido_por_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True)

    # Relaciones
    cliente = relationship("Cliente", foreign_keys=[cliente_id])
    pedido = relationship("Pedido", foreign_keys=[pedido_id], back_populates="facturas")
    detalles = relationship(
        "FacturaDetalle", back_populates="factura", cascade="all, delete-orphan"
    )
    factura_original = relationship(
        "Factura",
        remote_side="Factura.id",
        foreign_keys=[factura_original_id],
        backref="notas_asociadas",
    )
    creado_por = relationship("Usuario", foreign_keys=[creado_por_id])
    emitido_por = relationship("Usuario", foreign_keys=[emitido_por_id])
    movimiento_cuenta_corriente = relationship(
        "MovimientoCuentaCorriente", foreign_keys=[movimiento_cuenta_corriente_id]
    )

    def __repr__(self) -> str:
        return f"<Factura {self.tipo} {self.numero_completo or '(borrador)'}>"

    @property
    def letra(self) -> str:
        """Letra del comprobante (A o B)."""
        try:
            return LETRA_COMPROBANTE[TipoComprobante(self.tipo)]
        except ValueError:
            return ""

    @property
    def codigo_afip(self) -> Optional[int]:
        """Código de comprobante AFIP (CbteTipo)."""
        try:
            return CODIGO_AFIP[TipoComprobante(self.tipo)]
        except ValueError:
            return None

    @property
    def es_nota_credito(self) -> bool:
        return self.tipo in (
            TipoComprobante.NOTA_CREDITO_A.value,
            TipoComprobante.NOTA_CREDITO_B.value,
        )

    @property
    def es_nota_debito(self) -> bool:
        return self.tipo in (
            TipoComprobante.NOTA_DEBITO_A.value,
            TipoComprobante.NOTA_DEBITO_B.value,
        )


class FacturaDetalle(Base):
    """Línea de detalle de factura."""

    __tablename__ = "facturas_detalle"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    factura_id = Column(UUID(as_uuid=True), ForeignKey("facturas.id"), nullable=False)

    # Origen opcional
    detalle_pedido_id = Column(
        UUID(as_uuid=True), ForeignKey("detalles_pedido.id"), nullable=True
    )
    producto_lavado_id = Column(
        UUID(as_uuid=True), ForeignKey("productos_lavado.id"), nullable=True
    )

    # Contenido
    descripcion = Column(String(500), nullable=False)
    cantidad = Column(Numeric(12, 2), nullable=False, default=1)
    unidad_medida = Column(String(30), nullable=False, default="unidad")

    # Precios (siempre en NETOS internamente, el layout B muestra con IVA)
    precio_unitario_neto = Column(Numeric(14, 4), nullable=False)
    descuento_porcentaje = Column(Numeric(5, 2), nullable=False, default=0)

    # IVA
    iva_porcentaje = Column(Numeric(5, 2), nullable=False, default=21)
    subtotal_neto = Column(Numeric(14, 2), nullable=False)
    iva_monto = Column(Numeric(14, 2), nullable=False)
    total_linea = Column(Numeric(14, 2), nullable=False)

    # Relaciones
    factura = relationship("Factura", back_populates="detalles")

    def __repr__(self) -> str:
        return f"<FacturaDetalle {self.descripcion}: ${self.total_linea}>"
