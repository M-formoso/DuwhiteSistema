"""Servicio de Recolección.

Maneja el flujo donde el chico que retira la ropa del cliente registra
el inicio del retiro con su PIN. Eso crea un Pedido en estado
'confirmado' sin detalles, que aparece como "en camino" en el Kanban
de producción hasta que recepción lo recibe y lo pesa.
"""

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.cliente import Cliente
from app.models.pedido import EstadoPedido, Pedido
from app.models.lote_produccion import LoteProduccion
from app.models.usuario import Usuario
from app.schemas.recoleccion import (
    IniciarRecoleccionRequest,
    IniciarRecoleccionResponse,
    RecoleccionItem,
)


class RecoleccionService:
    def __init__(self, db: Session):
        self.db = db

    def _generar_numero_pedido(self) -> str:
        """Mismo formato que cliente_service: PED-YYMMDD-XXXX."""
        hoy = date.today()
        prefijo = f"PED-{hoy.strftime('%y%m%d')}"

        ultimo = (
            self.db.query(Pedido)
            .filter(Pedido.numero.like(f"{prefijo}-%"))
            .order_by(Pedido.numero.desc())
            .first()
        )

        if ultimo:
            try:
                numero = int(ultimo.numero.split("-")[-1]) + 1
            except (ValueError, IndexError):
                numero = 1
        else:
            numero = 1

        return f"{prefijo}-{numero:04d}"

    def iniciar_recoleccion(
        self,
        data: IniciarRecoleccionRequest,
        usuario_logueado_id: UUID,
    ) -> IniciarRecoleccionResponse:
        """Valida el PIN del repartidor y crea el pedido en camino."""

        # 1. Validar cliente
        cliente = (
            self.db.query(Cliente)
            .filter(Cliente.id == data.cliente_id, Cliente.activo == True)
            .first()
        )
        if not cliente:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cliente no encontrado",
            )

        # 2. Validar repartidor + PIN
        repartidor = (
            self.db.query(Usuario)
            .filter(Usuario.id == data.repartidor_id, Usuario.activo == True)
            .first()
        )
        if not repartidor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repartidor no encontrado",
            )
        if not repartidor.pin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El repartidor no tiene PIN configurado",
            )
        if repartidor.pin != data.pin:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="PIN incorrecto",
            )

        # 3. Crear el pedido (sin detalles, sin precios — solo el alta del retiro)
        ahora = datetime.utcnow()
        pedido = Pedido(
            id=uuid4(),
            numero=self._generar_numero_pedido(),
            cliente_id=cliente.id,
            estado=EstadoPedido.CONFIRMADO.value,
            fecha_pedido=date.today(),
            fecha_retiro=date.today(),
            creado_por_id=usuario_logueado_id,
            retirado_por_id=repartidor.id,
            hora_inicio_retiro=ahora,
            notas=data.notas,
            subtotal=0,
            iva=0,
            total=0,
            saldo_pendiente=0,
        )
        self.db.add(pedido)
        self.db.commit()
        self.db.refresh(pedido)

        return IniciarRecoleccionResponse(
            pedido_id=pedido.id,
            numero=pedido.numero,
            cliente_id=cliente.id,
            cliente_nombre=cliente.razon_social or cliente.nombre_fantasia or "—",
            repartidor_id=repartidor.id,
            repartidor_nombre=repartidor.nombre_completo,
            hora_inicio_retiro=ahora,
            mensaje=f"Recolección iniciada para {cliente.razon_social or 'cliente'}.",
        )

    def listar_recolecciones_del_dia(
        self,
        fecha: Optional[date] = None,
        repartidor_id: Optional[UUID] = None,
    ) -> List[RecoleccionItem]:
        """Pedidos creados como recolección en una fecha dada.

        Útil para que el repartidor (o un admin) vea qué se retiró hoy.
        Filtra por hora_inicio_retiro IS NOT NULL para distinguir las
        recolecciones de los pedidos creados desde otros lados.
        """
        fecha = fecha or date.today()

        query = (
            self.db.query(Pedido)
            .filter(
                Pedido.activo == True,
                Pedido.fecha_retiro == fecha,
                Pedido.hora_inicio_retiro.isnot(None),
            )
            .options(joinedload(Pedido.cliente))
        )
        if repartidor_id:
            query = query.filter(Pedido.retirado_por_id == repartidor_id)

        pedidos = query.order_by(Pedido.hora_inicio_retiro.desc()).all()

        # ¿Cuáles ya tienen lote? Hace un solo query para evitar N+1.
        pedido_ids = [p.id for p in pedidos]
        con_lote_ids = set()
        if pedido_ids:
            con_lote_rows = (
                self.db.query(LoteProduccion.pedido_id)
                .filter(
                    LoteProduccion.activo == True,
                    LoteProduccion.pedido_id.in_(pedido_ids),
                )
                .all()
            )
            con_lote_ids = {r[0] for r in con_lote_rows}

        return [
            RecoleccionItem(
                pedido_id=p.id,
                numero=p.numero,
                cliente_id=p.cliente_id,
                cliente_nombre=(
                    p.cliente.razon_social
                    or p.cliente.nombre_fantasia
                    or "—"
                ) if p.cliente else "—",
                direccion=p.cliente.direccion if p.cliente else None,
                hora_inicio_retiro=p.hora_inicio_retiro,
                tiene_lote=p.id in con_lote_ids,
            )
            for p in pedidos
        ]
