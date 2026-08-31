"""Servicio de TitularFiscal."""

from typing import List, Optional
from uuid import uuid4

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.cliente import Cliente
from app.models.titular_fiscal import TitularFiscal
from app.schemas.titular_fiscal import TitularFiscalCreate, TitularFiscalUpdate


class TitularFiscalService:
    def __init__(self, db: Session):
        self.db = db

    def get(self, titular_id: str) -> Optional[TitularFiscal]:
        return self.db.query(TitularFiscal).filter(TitularFiscal.id == titular_id).first()

    def get_by_cuit(self, cuit: str) -> Optional[TitularFiscal]:
        return self.db.query(TitularFiscal).filter(TitularFiscal.cuit == cuit).first()

    def list(
        self,
        skip: int = 0,
        limit: int = 50,
        activo: Optional[bool] = None,
        buscar: Optional[str] = None,
    ) -> tuple[List[TitularFiscal], int]:
        q = self.db.query(TitularFiscal)
        if activo is not None:
            q = q.filter(TitularFiscal.activo == activo)
        if buscar:
            s = f"%{buscar}%"
            q = q.filter(
                or_(
                    TitularFiscal.cuit.ilike(s),
                    TitularFiscal.razon_social_fiscal.ilike(s),
                )
            )
        total = q.count()
        rows = q.order_by(TitularFiscal.razon_social_fiscal).offset(skip).limit(limit).all()
        return rows, total

    def list_activos_para_select(self) -> List[TitularFiscal]:
        return (
            self.db.query(TitularFiscal)
            .filter(TitularFiscal.activo == True)
            .order_by(TitularFiscal.razon_social_fiscal)
            .all()
        )

    def clientes_del_titular(self, titular_id: str) -> List[Cliente]:
        return (
            self.db.query(Cliente)
            .filter(Cliente.titular_fiscal_id == titular_id, Cliente.activo == True)
            .order_by(Cliente.razon_social)
            .all()
        )

    def create(self, data: TitularFiscalCreate) -> TitularFiscal:
        titular = TitularFiscal(id=uuid4(), **data.model_dump())
        self.db.add(titular)
        self.db.commit()
        self.db.refresh(titular)
        return titular

    def update(self, titular_id: str, data: TitularFiscalUpdate) -> Optional[TitularFiscal]:
        titular = self.get(titular_id)
        if not titular:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(titular, field, value)
        self.db.commit()
        self.db.refresh(titular)
        return titular

    def soft_delete(self, titular_id: str) -> bool:
        titular = self.get(titular_id)
        if not titular:
            return False
        titular.activo = False
        self.db.commit()
        return True

    def contar_clientes(self, titular_id: str) -> int:
        return (
            self.db.query(func.count(Cliente.id))
            .filter(Cliente.titular_fiscal_id == titular_id)
            .scalar()
            or 0
        )
