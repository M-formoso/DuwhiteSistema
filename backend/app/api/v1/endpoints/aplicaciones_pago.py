"""
Endpoints para aplicar/desaplicar pagos a facturas.
"""

from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.usuario import Usuario
from app.services import aplicacion_pago_service


router = APIRouter()


class AplicarPagoRequest(BaseModel):
    factura_id: UUID
    monto: Decimal
    notas: Optional[str] = None


class AplicacionResponse(BaseModel):
    id: str
    factura_id: str
    factura_numero: Optional[str]
    movimiento_pago_id: str
    monto_aplicado: float
    fecha_aplicacion: str
    automatica: bool
    notas: Optional[str]


def _serializar(a) -> dict:
    return {
        "id": str(a.id),
        "factura_id": str(a.factura_id),
        "factura_numero": a.factura.numero_completo if a.factura else None,
        "movimiento_pago_id": str(a.movimiento_pago_id),
        "monto_aplicado": float(a.monto_aplicado),
        "fecha_aplicacion": a.fecha_aplicacion.isoformat(),
        "automatica": a.automatica,
        "notas": a.notas,
    }


@router.post("/pagos/{movimiento_pago_id}/aplicar")
def aplicar(
    movimiento_pago_id: UUID,
    data: AplicarPagoRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Aplica manualmente un monto del pago a una factura."""
    aplicacion = aplicacion_pago_service.aplicar_pago_a_factura(
        db=db,
        movimiento_pago_id=movimiento_pago_id,
        factura_id=data.factura_id,
        monto=data.monto,
        usuario_id=UUID(str(current_user.id)),
        automatica=False,
        notas=data.notas,
    )
    db.commit()
    db.refresh(aplicacion)
    return _serializar(aplicacion)


@router.delete("/aplicaciones/{aplicacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def desaplicar(
    aplicacion_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    aplicacion_pago_service.desaplicar(db, aplicacion_id, UUID(str(current_user.id)))
    db.commit()
    return None


@router.get("/facturas/{factura_id}/aplicaciones")
def listar_aplicaciones_factura(
    factura_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    aplicaciones = aplicacion_pago_service.listar_aplicaciones_de_factura(db, factura_id)
    return [_serializar(a) for a in aplicaciones]


@router.get("/pagos/{movimiento_pago_id}/aplicaciones")
def listar_aplicaciones_pago(
    movimiento_pago_id: UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    aplicaciones = aplicacion_pago_service.listar_aplicaciones_de_pago(db, movimiento_pago_id)
    return [_serializar(a) for a in aplicaciones]
