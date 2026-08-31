"""Endpoints de TitularFiscal."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.usuario import Usuario
from app.schemas.common import PaginatedResponse
from app.schemas.titular_fiscal import (
    TitularFiscalCreate,
    TitularFiscalResponse,
    TitularFiscalSelect,
    TitularFiscalUpdate,
)
from app.services.titular_fiscal_service import TitularFiscalService


router = APIRouter()


def _to_response(svc: TitularFiscalService, t) -> TitularFiscalResponse:
    return TitularFiscalResponse(
        id=str(t.id),
        cuit=t.cuit,
        razon_social_fiscal=t.razon_social_fiscal,
        condicion_iva=t.condicion_iva,
        direccion_fiscal=t.direccion_fiscal,
        ciudad_fiscal=t.ciudad_fiscal,
        provincia_fiscal=t.provincia_fiscal,
        codigo_postal_fiscal=t.codigo_postal_fiscal,
        notas=t.notas,
        activo=t.activo,
        created_at=t.created_at,
        updated_at=t.updated_at,
        cantidad_clientes=svc.contar_clientes(str(t.id)),
    )


@router.get("", response_model=PaginatedResponse[TitularFiscalResponse])
def listar(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    activo: Optional[bool] = None,
    buscar: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    svc = TitularFiscalService(db)
    rows, total = svc.list(skip=skip, limit=limit, activo=activo, buscar=buscar)
    return {
        "items": [_to_response(svc, t) for t in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/lista", response_model=List[TitularFiscalSelect])
def listar_para_select(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    svc = TitularFiscalService(db)
    return [
        TitularFiscalSelect(
            id=str(t.id),
            cuit=t.cuit,
            razon_social_fiscal=t.razon_social_fiscal,
            condicion_iva=t.condicion_iva,
        )
        for t in svc.list_activos_para_select()
    ]


@router.get("/{titular_id}", response_model=TitularFiscalResponse)
def obtener(
    titular_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    svc = TitularFiscalService(db)
    t = svc.get(titular_id)
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Titular fiscal no encontrado")
    return _to_response(svc, t)


@router.get("/{titular_id}/clientes")
def clientes_del_titular(
    titular_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    svc = TitularFiscalService(db)
    if not svc.get(titular_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Titular fiscal no encontrado")
    return [
        {
            "id": str(c.id),
            "codigo": c.codigo,
            "razon_social": c.razon_social,
            "nombre_fantasia": c.nombre_fantasia,
            "saldo_cuenta_corriente": float(c.saldo_cuenta_corriente or 0),
        }
        for c in svc.clientes_del_titular(titular_id)
    ]


@router.post("", response_model=TitularFiscalResponse, status_code=status.HTTP_201_CREATED)
def crear(
    data: TitularFiscalCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    svc = TitularFiscalService(db)
    if svc.get_by_cuit(data.cuit):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Ya existe un titular fiscal con ese CUIT",
        )
    t = svc.create(data)
    return _to_response(svc, t)


@router.put("/{titular_id}", response_model=TitularFiscalResponse)
def actualizar(
    titular_id: str,
    data: TitularFiscalUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    svc = TitularFiscalService(db)
    actual = svc.get(titular_id)
    if not actual:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Titular fiscal no encontrado")
    if data.cuit and data.cuit != actual.cuit:
        colisiona = svc.get_by_cuit(data.cuit)
        if colisiona and str(colisiona.id) != titular_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Ya existe otro titular fiscal con ese CUIT",
            )
    t = svc.update(titular_id, data)
    return _to_response(svc, t)


@router.delete("/{titular_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(
    titular_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    svc = TitularFiscalService(db)
    t = svc.get(titular_id)
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Titular fiscal no encontrado")
    # No permitir soft-delete si tiene clientes activos vinculados
    if svc.contar_clientes(titular_id) > 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "El titular tiene clientes vinculados; desasocielos antes de eliminar",
        )
    svc.soft_delete(titular_id)
    return None
