"""
Servicio de Conciliación Bancaria.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Tuple
from uuid import uuid4

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.conciliacion_bancaria import ConciliacionBancaria, ItemConciliacion, EstadoConciliacion
from app.models.cuenta_bancaria import CuentaBancaria, MovimientoBancario
from app.schemas.conciliacion_bancaria import (
    ConciliacionBancariaCreate,
    ConciliarMovimientoRequest,
)


class ConciliacionBancariaService:
    """Servicio para conciliación bancaria."""

    def __init__(self, db: Session):
        self.db = db

    def iniciar_conciliacion(
        self,
        data: ConciliacionBancariaCreate,
        usuario_id: str,
    ) -> ConciliacionBancaria:
        """Inicia una nueva sesión de conciliación."""
        cuenta = self.db.query(CuentaBancaria).filter(
            CuentaBancaria.id == data.cuenta_id
        ).first()

        if not cuenta:
            raise ValueError("Cuenta bancaria no encontrada")

        # Verificar que no haya conciliación abierta para esta cuenta
        conciliacion_abierta = self.db.query(ConciliacionBancaria).filter(
            ConciliacionBancaria.cuenta_id == data.cuenta_id,
            ConciliacionBancaria.estado == EstadoConciliacion.EN_PROCESO,
        ).first()

        if conciliacion_abierta:
            raise ValueError(
                f"Ya existe una conciliación en proceso para esta cuenta (ID: {conciliacion_abierta.id})"
            )

        # Obtener movimientos del período
        movimientos = self.db.query(MovimientoBancario).filter(
            MovimientoBancario.cuenta_id == data.cuenta_id,
            MovimientoBancario.fecha_movimiento >= data.fecha_desde,
            MovimientoBancario.fecha_movimiento <= data.fecha_hasta,
        ).all()

        # Calcular saldo del sistema
        saldo_sistema = cuenta.saldo_actual

        # Crear conciliación
        conciliacion = ConciliacionBancaria(
            id=str(uuid4()),
            cuenta_id=data.cuenta_id,
            fecha_desde=data.fecha_desde,
            fecha_hasta=data.fecha_hasta,
            estado=EstadoConciliacion.EN_PROCESO,
            saldo_extracto_bancario=data.saldo_extracto_bancario,
            saldo_sistema=saldo_sistema,
            creado_por_id=usuario_id,
        )

        self.db.add(conciliacion)

        # Crear items para cada movimiento del período
        for mov in movimientos:
            item = ItemConciliacion(
                id=str(uuid4()),
                conciliacion_id=conciliacion.id,
                movimiento_bancario_id=str(mov.id),
                conciliado=mov.conciliado,  # Mantener estado previo si ya estaba conciliado
                fecha_conciliacion=mov.fecha_conciliacion,
            )
            self.db.add(item)

        self.db.commit()
        self.db.refresh(conciliacion)

        return conciliacion

    def get_conciliaciones(
        self,
        cuenta_id: Optional[str] = None,
        estado: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[ConciliacionBancaria], int]:
        """Obtiene lista de conciliaciones."""
        query = self.db.query(ConciliacionBancaria)

        if cuenta_id:
            query = query.filter(ConciliacionBancaria.cuenta_id == cuenta_id)
        if estado:
            query = query.filter(ConciliacionBancaria.estado == estado)

        total = query.count()
        conciliaciones = query.order_by(
            ConciliacionBancaria.created_at.desc()
        ).offset(skip).limit(limit).all()

        return conciliaciones, total

    def get_conciliacion(self, conciliacion_id: str) -> Optional[ConciliacionBancaria]:
        """Obtiene una conciliación por ID."""
        return self.db.query(ConciliacionBancaria).filter(
            ConciliacionBancaria.id == conciliacion_id
        ).first()

    def conciliar_movimiento(
        self,
        conciliacion_id: str,
        data: ConciliarMovimientoRequest,
        usuario_id: str,
    ) -> ItemConciliacion:
        """Marca un movimiento como conciliado."""
        conciliacion = self.get_conciliacion(conciliacion_id)
        if not conciliacion:
            raise ValueError("Conciliación no encontrada")

        if conciliacion.esta_finalizada:
            raise ValueError("No se puede modificar una conciliación finalizada")

        item = self.db.query(ItemConciliacion).filter(
            ItemConciliacion.conciliacion_id == conciliacion_id,
            ItemConciliacion.movimiento_bancario_id == data.movimiento_bancario_id,
        ).first()

        if not item:
            raise ValueError("Item de conciliación no encontrado")

        if item.conciliado:
            raise ValueError("El movimiento ya está conciliado")

        # Marcar item como conciliado
        item.conciliado = True
        item.fecha_conciliacion = datetime.utcnow()
        item.conciliado_por_id = usuario_id
        item.referencia_extracto = data.referencia_extracto
        item.notas = data.notas

        # Actualizar movimiento bancario
        movimiento = self.db.query(MovimientoBancario).filter(
            MovimientoBancario.id == data.movimiento_bancario_id
        ).first()

        if movimiento:
            movimiento.conciliado = True
            movimiento.fecha_conciliacion = datetime.utcnow()
            movimiento.conciliacion_id = conciliacion_id
            movimiento.conciliado_por_id = usuario_id
            movimiento.referencia_conciliacion = data.referencia_extracto

            # Actualizar totales de conciliación
            conciliacion.cantidad_conciliados = (conciliacion.cantidad_conciliados or 0) + 1
            conciliacion.monto_conciliado = (conciliacion.monto_conciliado or Decimal("0")) + movimiento.monto

        self.db.commit()
        self.db.refresh(item)

        return item

    def desconciliar_movimiento(
        self,
        conciliacion_id: str,
        movimiento_bancario_id: str,
        usuario_id: str,
    ) -> ItemConciliacion:
        """Desmarca un movimiento como conciliado."""
        conciliacion = self.get_conciliacion(conciliacion_id)
        if not conciliacion:
            raise ValueError("Conciliación no encontrada")

        if conciliacion.esta_finalizada:
            raise ValueError("No se puede modificar una conciliación finalizada")

        item = self.db.query(ItemConciliacion).filter(
            ItemConciliacion.conciliacion_id == conciliacion_id,
            ItemConciliacion.movimiento_bancario_id == movimiento_bancario_id,
        ).first()

        if not item:
            raise ValueError("Item de conciliación no encontrado")

        if not item.conciliado:
            raise ValueError("El movimiento no está conciliado")

        monto_anterior = Decimal("0")

        # Actualizar movimiento bancario
        movimiento = self.db.query(MovimientoBancario).filter(
            MovimientoBancario.id == movimiento_bancario_id
        ).first()

        if movimiento and movimiento.conciliado:
            monto_anterior = movimiento.monto
            movimiento.conciliado = False
            movimiento.fecha_conciliacion = None
            movimiento.conciliacion_id = None
            movimiento.conciliado_por_id = None
            movimiento.referencia_conciliacion = None

        # Desmarcar item
        item.conciliado = False
        item.fecha_conciliacion = None
        item.conciliado_por_id = None
        item.referencia_extracto = None

        # Actualizar totales
        conciliacion.cantidad_conciliados = max(0, (conciliacion.cantidad_conciliados or 0) - 1)
        conciliacion.monto_conciliado = max(
            Decimal("0"),
            (conciliacion.monto_conciliado or Decimal("0")) - monto_anterior
        )

        self.db.commit()
        self.db.refresh(item)

        return item

    def conciliar_varios(
        self,
        conciliacion_id: str,
        movimientos_ids: List[str],
        usuario_id: str,
    ) -> int:
        """Concilia varios movimientos a la vez. Retorna cantidad conciliada."""
        conciliados = 0
        for mov_id in movimientos_ids:
            try:
                self.conciliar_movimiento(
                    conciliacion_id=conciliacion_id,
                    data=ConciliarMovimientoRequest(movimiento_bancario_id=mov_id),
                    usuario_id=usuario_id,
                )
                conciliados += 1
            except ValueError:
                # Ignorar errores individuales
                continue

        return conciliados

    def finalizar_conciliacion(
        self,
        conciliacion_id: str,
        saldo_extracto: Decimal,
        usuario_id: str,
        notas: Optional[str] = None,
    ) -> ConciliacionBancaria:
        """Finaliza una sesión de conciliación."""
        conciliacion = self.get_conciliacion(conciliacion_id)
        if not conciliacion:
            raise ValueError("Conciliación no encontrada")

        if conciliacion.esta_finalizada:
            raise ValueError("La conciliación ya está finalizada")

        conciliacion.estado = EstadoConciliacion.COMPLETADA
        conciliacion.saldo_extracto_bancario = saldo_extracto
        conciliacion.diferencia = saldo_extracto - (conciliacion.saldo_sistema or Decimal("0"))
        conciliacion.finalizado_por_id = usuario_id
        conciliacion.fecha_finalizacion = datetime.utcnow()
        if notas:
            conciliacion.notas = notas

        self.db.commit()
        self.db.refresh(conciliacion)

        return conciliacion

    def get_movimientos_sin_conciliar(
        self,
        cuenta_id: str,
        fecha_hasta: Optional[date] = None,
    ) -> List[MovimientoBancario]:
        """Obtiene movimientos sin conciliar de una cuenta."""
        query = self.db.query(MovimientoBancario).filter(
            MovimientoBancario.cuenta_id == cuenta_id,
            MovimientoBancario.conciliado == False,
        )

        if fecha_hasta:
            query = query.filter(MovimientoBancario.fecha_movimiento <= fecha_hasta)

        return query.order_by(MovimientoBancario.fecha_movimiento.desc()).all()

    def get_resumen_cuenta(self, cuenta_id: str) -> dict:
        """Obtiene resumen de conciliación de una cuenta."""
        cuenta = self.db.query(CuentaBancaria).filter(
            CuentaBancaria.id == cuenta_id
        ).first()

        if not cuenta:
            raise ValueError("Cuenta no encontrada")

        total_movimientos = self.db.query(MovimientoBancario).filter(
            MovimientoBancario.cuenta_id == cuenta_id
        ).count()

        sin_conciliar = self.db.query(MovimientoBancario).filter(
            MovimientoBancario.cuenta_id == cuenta_id,
            MovimientoBancario.conciliado == False,
        ).count()

        conciliados = total_movimientos - sin_conciliar

        # Última conciliación
        ultima_conciliacion = self.db.query(ConciliacionBancaria).filter(
            ConciliacionBancaria.cuenta_id == cuenta_id,
            ConciliacionBancaria.estado == EstadoConciliacion.COMPLETADA,
        ).order_by(ConciliacionBancaria.fecha_finalizacion.desc()).first()

        return {
            "cuenta_id": str(cuenta.id),
            "cuenta_nombre": cuenta.nombre,
            "saldo_actual": cuenta.saldo_actual,
            "total_movimientos": total_movimientos,
            "movimientos_conciliados": conciliados,
            "movimientos_sin_conciliar": sin_conciliar,
            "porcentaje_conciliado": round(conciliados / total_movimientos * 100, 2) if total_movimientos > 0 else 0,
            "ultima_conciliacion_fecha": ultima_conciliacion.fecha_finalizacion if ultima_conciliacion else None,
            "ultima_conciliacion_diferencia": ultima_conciliacion.diferencia if ultima_conciliacion else None,
        }
