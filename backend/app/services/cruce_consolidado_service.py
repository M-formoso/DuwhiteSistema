"""
Servicio de Cruces Consolidados Cliente-Proveedor.
"""

from decimal import Decimal
from typing import Optional, List
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.cruce_cliente_proveedor import EntidadConsolidada
from app.models.cliente import Cliente
from app.models.proveedor import Proveedor
from app.models.cuenta_corriente import MovimientoCuentaCorriente
from app.models.cuenta_corriente_proveedor import MovimientoCuentaCorrienteProveedor, TipoMovimientoCCProveedor
from app.schemas.cruce_consolidado import SaldoConsolidadoDetalle, SincronizarEntidadesResponse


class CruceConsolidadoService:
    """Servicio para gestión de cruces consolidados cliente-proveedor."""

    def __init__(self, db: Session):
        self.db = db

    def sincronizar_entidades(self) -> SincronizarEntidadesResponse:
        """
        Sincroniza entidades consolidadas basándose en CUIT.
        Detecta clientes que también son proveedores y viceversa.
        Retorna estadísticas de la sincronización.
        """
        creadas = 0
        actualizadas = 0

        # Obtener todos los CUITs de clientes y proveedores activos
        clientes = self.db.query(Cliente).filter(
            Cliente.cuit.isnot(None),
            Cliente.cuit != "",
            Cliente.activo == True
        ).all()

        proveedores = self.db.query(Proveedor).filter(
            Proveedor.cuit.isnot(None),
            Proveedor.cuit != "",
            Proveedor.activo == True
        ).all()

        # Mapear por CUIT normalizado (sin guiones)
        cuits_clientes = {}
        for c in clientes:
            if c.cuit:
                cuit_normalizado = c.cuit.replace("-", "")
                cuits_clientes[cuit_normalizado] = c

        cuits_proveedores = {}
        for p in proveedores:
            if p.cuit:
                cuit_normalizado = p.cuit.replace("-", "")
                cuits_proveedores[cuit_normalizado] = p

        todos_cuits = set(cuits_clientes.keys()) | set(cuits_proveedores.keys())

        for cuit in todos_cuits:
            cliente = cuits_clientes.get(cuit)
            proveedor = cuits_proveedores.get(cuit)

            # Buscar entidad existente
            entidad = self.db.query(EntidadConsolidada).filter(
                func.replace(EntidadConsolidada.cuit, "-", "") == cuit
            ).first()

            if not entidad:
                # Crear nueva entidad
                cuit_formateado = cliente.cuit if cliente else proveedor.cuit
                razon_social = cliente.razon_social if cliente else proveedor.razon_social

                entidad = EntidadConsolidada(
                    id=str(uuid4()),
                    cuit=cuit_formateado,
                    razon_social=razon_social,
                )
                self.db.add(entidad)
                creadas += 1
            else:
                actualizadas += 1

            # Actualizar referencias y saldos
            if cliente:
                entidad.cliente_id = cliente.id
                entidad.es_cliente = True
                entidad.saldo_como_cliente = cliente.saldo_cuenta_corriente
            else:
                entidad.es_cliente = False
                entidad.cliente_id = None
                entidad.saldo_como_cliente = Decimal("0")

            if proveedor:
                entidad.proveedor_id = proveedor.id
                entidad.es_proveedor = True
                entidad.saldo_como_proveedor = proveedor.saldo_cuenta_corriente
            else:
                entidad.es_proveedor = False
                entidad.proveedor_id = None
                entidad.saldo_como_proveedor = Decimal("0")

            # Actualizar saldo neto
            entidad.actualizar_saldo_neto()

        self.db.commit()

        return SincronizarEntidadesResponse(
            entidades_creadas=creadas,
            entidades_actualizadas=actualizadas,
            total_procesadas=len(todos_cuits),
        )

    def get_entidades_consolidadas(
        self,
        solo_cruzadas: bool = False,
        con_saldo: bool = False,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[List[EntidadConsolidada], int]:
        """Obtiene lista de entidades consolidadas con filtros."""
        query = self.db.query(EntidadConsolidada).filter(EntidadConsolidada.activo == True)

        if solo_cruzadas:
            query = query.filter(
                EntidadConsolidada.es_cliente == True,
                EntidadConsolidada.es_proveedor == True
            )

        if con_saldo:
            query = query.filter(EntidadConsolidada.saldo_neto != 0)

        total = query.count()
        entidades = query.order_by(EntidadConsolidada.razon_social).offset(skip).limit(limit).all()

        return entidades, total

    def get_entidad_por_cuit(self, cuit: str) -> Optional[EntidadConsolidada]:
        """Obtiene una entidad consolidada por CUIT."""
        cuit_normalizado = cuit.replace("-", "")
        return self.db.query(EntidadConsolidada).filter(
            func.replace(EntidadConsolidada.cuit, "-", "") == cuit_normalizado
        ).first()

    def get_saldo_consolidado(self, cuit: str) -> Optional[SaldoConsolidadoDetalle]:
        """Obtiene detalle de saldo consolidado por CUIT."""
        entidad = self.get_entidad_por_cuit(cuit)

        if not entidad:
            return None

        # Contar facturas pendientes de cliente
        cantidad_cli = 0
        if entidad.cliente_id:
            cantidad_cli = self.db.query(MovimientoCuentaCorriente).filter(
                MovimientoCuentaCorriente.cliente_id == entidad.cliente_id,
                MovimientoCuentaCorriente.tipo == "cargo",
            ).count()

        # Contar facturas pendientes de proveedor
        cantidad_prov = 0
        if entidad.proveedor_id:
            cantidad_prov = self.db.query(MovimientoCuentaCorrienteProveedor).filter(
                MovimientoCuentaCorrienteProveedor.proveedor_id == entidad.proveedor_id,
                MovimientoCuentaCorrienteProveedor.tipo == TipoMovimientoCCProveedor.CARGO.value,
                MovimientoCuentaCorrienteProveedor.saldo_comprobante > 0,
            ).count()

        return SaldoConsolidadoDetalle(
            entidad_id=str(entidad.id),
            cuit=entidad.cuit,
            razon_social=entidad.razon_social,
            saldo_cliente=entidad.saldo_como_cliente,
            saldo_proveedor=entidad.saldo_como_proveedor,
            saldo_neto=entidad.saldo_neto,
            cliente_id=str(entidad.cliente_id) if entidad.cliente_id else None,
            proveedor_id=str(entidad.proveedor_id) if entidad.proveedor_id else None,
            cantidad_facturas_cliente=cantidad_cli,
            cantidad_facturas_proveedor=cantidad_prov,
        )

    def actualizar_saldos_entidad(self, cuit: str) -> Optional[EntidadConsolidada]:
        """Actualiza los saldos de una entidad específica."""
        entidad = self.get_entidad_por_cuit(cuit)

        if not entidad:
            return None

        # Actualizar saldo como cliente
        if entidad.cliente_id:
            cliente = self.db.query(Cliente).filter(Cliente.id == entidad.cliente_id).first()
            if cliente:
                entidad.saldo_como_cliente = cliente.saldo_cuenta_corriente
            else:
                entidad.saldo_como_cliente = Decimal("0")
        else:
            entidad.saldo_como_cliente = Decimal("0")

        # Actualizar saldo como proveedor
        if entidad.proveedor_id:
            proveedor = self.db.query(Proveedor).filter(Proveedor.id == entidad.proveedor_id).first()
            if proveedor:
                entidad.saldo_como_proveedor = proveedor.saldo_cuenta_corriente
            else:
                entidad.saldo_como_proveedor = Decimal("0")
        else:
            entidad.saldo_como_proveedor = Decimal("0")

        # Recalcular saldo neto
        entidad.actualizar_saldo_neto()

        self.db.commit()
        self.db.refresh(entidad)

        return entidad

    def get_resumen_cruces(self) -> dict:
        """Obtiene resumen de cruces consolidados."""
        total_entidades = self.db.query(EntidadConsolidada).filter(
            EntidadConsolidada.activo == True
        ).count()

        total_cruzadas = self.db.query(EntidadConsolidada).filter(
            EntidadConsolidada.activo == True,
            EntidadConsolidada.es_cliente == True,
            EntidadConsolidada.es_proveedor == True,
        ).count()

        # Saldos netos
        saldo_a_favor = self.db.query(func.sum(EntidadConsolidada.saldo_neto)).filter(
            EntidadConsolidada.activo == True,
            EntidadConsolidada.saldo_neto > 0,
        ).scalar() or Decimal("0")

        saldo_en_contra = self.db.query(func.sum(EntidadConsolidada.saldo_neto)).filter(
            EntidadConsolidada.activo == True,
            EntidadConsolidada.saldo_neto < 0,
        ).scalar() or Decimal("0")

        return {
            "total_entidades": total_entidades,
            "total_cruzadas": total_cruzadas,
            "saldo_total_a_favor": saldo_a_favor,  # Lo que nos deben
            "saldo_total_en_contra": abs(saldo_en_contra),  # Lo que debemos
            "saldo_neto_global": saldo_a_favor + saldo_en_contra,
        }
