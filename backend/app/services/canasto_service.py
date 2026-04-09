"""
Servicio de Canastos.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.canasto import Canasto, LoteCanasto, EstadoCanasto
from app.models.lote_produccion import LoteProduccion
from app.models.etapa_produccion import EtapaProduccion
from app.schemas.canasto import (
    CanastoCreate,
    CanastoUpdate,
    CanastoResponse,
    CanastoListResponse,
    CanastoGridItem,
    CanastosGridResponse,
    AsignarCanastosRequest,
    LiberarCanastosRequest,
    LoteCanastoResponse,
)
from app.services.log_service import LogService


class CanastoService:
    """Servicio para gestión de canastos."""

    @staticmethod
    def get_all(
        db: Session,
        estado: Optional[str] = None,
        solo_disponibles: bool = False,
        solo_activos: bool = True
    ) -> List[Canasto]:
        """Obtiene todos los canastos."""
        query = db.query(Canasto)

        if solo_activos:
            query = query.filter(Canasto.activo == True)

        if estado:
            query = query.filter(Canasto.estado == estado)

        if solo_disponibles:
            query = query.filter(Canasto.estado == EstadoCanasto.DISPONIBLE.value)

        return query.order_by(Canasto.numero).all()

    @staticmethod
    def get_by_id(db: Session, canasto_id: UUID) -> Optional[Canasto]:
        """Obtiene un canasto por ID."""
        return db.query(Canasto).filter(Canasto.id == canasto_id).first()

    @staticmethod
    def get_by_numero(db: Session, numero: int) -> Optional[Canasto]:
        """Obtiene un canasto por número."""
        return db.query(Canasto).filter(Canasto.numero == numero).first()

    @staticmethod
    def get_by_codigo(db: Session, codigo: str) -> Optional[Canasto]:
        """Obtiene un canasto por código."""
        return db.query(Canasto).filter(Canasto.codigo == codigo).first()

    @staticmethod
    def update(
        db: Session,
        canasto_id: UUID,
        data: CanastoUpdate,
        usuario_id: UUID
    ) -> Canasto:
        """Actualiza un canasto."""
        canasto = CanastoService.get_by_id(db, canasto_id)
        if not canasto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Canasto no encontrado"
            )

        # Actualizar campos
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(canasto, field, value)

        db.commit()
        db.refresh(canasto)

        # Log
        LogService.log(
            db=db,
            usuario_id=usuario_id,
            accion="actualizar",
            modulo="canastos",
            descripcion=f"Canasto {canasto.codigo} actualizado",
            entidad_tipo="canasto",
            entidad_id=canasto.id
        )

        return canasto

    @staticmethod
    def cambiar_estado(
        db: Session,
        canasto_id: UUID,
        nuevo_estado: str,
        usuario_id: UUID
    ) -> Canasto:
        """Cambia el estado de un canasto."""
        canasto = CanastoService.get_by_id(db, canasto_id)
        if not canasto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Canasto no encontrado"
            )

        # Validar estado
        estados_validos = [e.value for e in EstadoCanasto]
        if nuevo_estado not in estados_validos:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Estado inválido. Debe ser uno de: {estados_validos}"
            )

        # No se puede cambiar a "en_uso" manualmente
        if nuevo_estado == EstadoCanasto.EN_USO.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El estado 'en_uso' se asigna automáticamente al asignar a un lote"
            )

        # Si está en uso, no se puede cambiar estado
        if canasto.estado == EstadoCanasto.EN_USO.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede cambiar el estado de un canasto en uso. Primero debe liberarse del lote."
            )

        estado_anterior = canasto.estado
        canasto.estado = nuevo_estado
        db.commit()
        db.refresh(canasto)

        # Log
        LogService.log(
            db=db,
            usuario_id=usuario_id,
            accion="cambiar_estado",
            modulo="canastos",
            descripcion=f"Canasto {canasto.codigo}: {estado_anterior} → {nuevo_estado}",
            entidad_tipo="canasto",
            entidad_id=canasto.id
        )

        return canasto

    @staticmethod
    def get_grid(db: Session) -> CanastosGridResponse:
        """Obtiene el grid completo de canastos con información de lotes."""
        canastos = db.query(Canasto).filter(Canasto.activo == True).order_by(Canasto.numero).all()

        items = []
        resumen = {
            "disponible": 0,
            "en_uso": 0,
            "mantenimiento": 0,
            "fuera_servicio": 0
        }

        for canasto in canastos:
            # Contar para resumen
            if canasto.estado in resumen:
                resumen[canasto.estado] += 1

            # Buscar lote actual si está en uso
            lote_id = None
            lote_numero = None
            cliente_id = None
            cliente_nombre = None
            etapa_actual = None
            tiempo_en_uso = None

            if canasto.estado == EstadoCanasto.EN_USO.value:
                # Buscar asignación activa
                asignacion = db.query(LoteCanasto).filter(
                    LoteCanasto.canasto_id == canasto.id,
                    LoteCanasto.fecha_liberacion == None,
                    LoteCanasto.activo == True
                ).first()

                if asignacion and asignacion.lote:
                    lote = asignacion.lote
                    lote_id = lote.id
                    lote_numero = lote.numero
                    if lote.cliente:
                        cliente_id = lote.cliente.id
                        cliente_nombre = lote.cliente.nombre_fantasia or lote.cliente.razon_social
                    if lote.etapa_actual:
                        etapa_actual = lote.etapa_actual.nombre
                    tiempo_en_uso = asignacion.duracion_minutos

            items.append(CanastoGridItem(
                id=canasto.id,
                numero=canasto.numero,
                codigo=canasto.codigo,
                estado=canasto.estado,
                esta_disponible=canasto.esta_disponible,
                lote_id=lote_id,
                lote_numero=lote_numero,
                cliente_id=cliente_id,
                cliente_nombre=cliente_nombre,
                etapa_actual=etapa_actual,
                tiempo_en_uso_minutos=tiempo_en_uso
            ))

        return CanastosGridResponse(canastos=items, resumen=resumen)

    @staticmethod
    def asignar_canastos(
        db: Session,
        lote_id: UUID,
        request: AsignarCanastosRequest,
        usuario_id: UUID
    ) -> List[LoteCanasto]:
        """Asigna múltiples canastos a un lote."""
        # Verificar que el lote existe
        lote = db.query(LoteProduccion).filter(LoteProduccion.id == lote_id).first()
        if not lote:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lote no encontrado"
            )

        # Verificar etapa si se especifica
        etapa = None
        if request.etapa_id:
            etapa = db.query(EtapaProduccion).filter(EtapaProduccion.id == request.etapa_id).first()
            if not etapa:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Etapa no encontrada"
                )

        asignaciones = []
        for canasto_id in request.canasto_ids:
            # Verificar canasto
            canasto = CanastoService.get_by_id(db, canasto_id)
            if not canasto:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Canasto {canasto_id} no encontrado"
                )

            # Verificar disponibilidad
            if not canasto.esta_disponible:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Canasto {canasto.codigo} no está disponible (estado: {canasto.estado})"
                )

            # Crear asignación
            asignacion = LoteCanasto(
                lote_id=lote_id,
                canasto_id=canasto_id,
                etapa_id=request.etapa_id,
                fecha_asignacion=datetime.utcnow(),
                asignado_por_id=usuario_id,
                notas=request.notas
            )
            db.add(asignacion)

            # Cambiar estado del canasto
            canasto.estado = EstadoCanasto.EN_USO.value

            asignaciones.append(asignacion)

        db.commit()

        # Log
        codigos = [CanastoService.get_by_id(db, cid).codigo for cid in request.canasto_ids]
        LogService.log(
            db=db,
            usuario_id=usuario_id,
            accion="asignar_canastos",
            modulo="produccion",
            descripcion=f"Canastos {', '.join(codigos)} asignados a lote {lote.numero}",
            entidad_tipo="lote",
            entidad_id=lote_id
        )

        return asignaciones

    @staticmethod
    def liberar_canastos(
        db: Session,
        lote_id: UUID,
        request: LiberarCanastosRequest,
        usuario_id: UUID
    ) -> List[LoteCanasto]:
        """Libera canastos de un lote."""
        # Verificar que el lote existe
        lote = db.query(LoteProduccion).filter(LoteProduccion.id == lote_id).first()
        if not lote:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lote no encontrado"
            )

        # Obtener asignaciones activas
        query = db.query(LoteCanasto).filter(
            LoteCanasto.lote_id == lote_id,
            LoteCanasto.fecha_liberacion == None,
            LoteCanasto.activo == True
        )

        # Si se especifican canastos, filtrar
        if request.canasto_ids:
            query = query.filter(LoteCanasto.canasto_id.in_(request.canasto_ids))

        asignaciones = query.all()

        if not asignaciones:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No hay canastos asignados para liberar"
            )

        liberados = []
        for asignacion in asignaciones:
            asignacion.fecha_liberacion = datetime.utcnow()
            asignacion.liberado_por_id = usuario_id
            if request.notas:
                asignacion.notas = (asignacion.notas or "") + f"\nLiberación: {request.notas}"

            # Cambiar estado del canasto a disponible
            canasto = asignacion.canasto
            canasto.estado = EstadoCanasto.DISPONIBLE.value

            liberados.append(asignacion)

        db.commit()

        # Log
        codigos = [a.canasto.codigo for a in liberados]
        LogService.log(
            db=db,
            usuario_id=usuario_id,
            accion="liberar_canastos",
            modulo="produccion",
            descripcion=f"Canastos {', '.join(codigos)} liberados de lote {lote.numero}",
            entidad_tipo="lote",
            entidad_id=lote_id
        )

        return liberados

    @staticmethod
    def liberar_todos_canastos_lote(db: Session, lote_id: UUID, usuario_id: UUID) -> int:
        """Libera todos los canastos de un lote. Usado al finalizar planchado."""
        request = LiberarCanastosRequest(canasto_ids=None, notas="Liberación automática post-planchado")
        try:
            liberados = CanastoService.liberar_canastos(db, lote_id, request, usuario_id)
            return len(liberados)
        except HTTPException:
            # No hay canastos para liberar
            return 0

    @staticmethod
    def get_canastos_lote(db: Session, lote_id: UUID) -> List[LoteCanasto]:
        """Obtiene los canastos asignados a un lote (activos)."""
        return db.query(LoteCanasto).filter(
            LoteCanasto.lote_id == lote_id,
            LoteCanasto.fecha_liberacion == None,
            LoteCanasto.activo == True
        ).all()

    @staticmethod
    def get_historial_canasto(db: Session, canasto_id: UUID, limit: int = 50) -> List[LoteCanasto]:
        """Obtiene el historial de uso de un canasto."""
        return db.query(LoteCanasto).filter(
            LoteCanasto.canasto_id == canasto_id,
            LoteCanasto.activo == True
        ).order_by(LoteCanasto.fecha_asignacion.desc()).limit(limit).all()

    @staticmethod
    def get_disponibles(db: Session) -> List[Canasto]:
        """Obtiene canastos disponibles."""
        return CanastoService.get_all(db, solo_disponibles=True)

    @staticmethod
    def get_disponibles_count(db: Session) -> int:
        """Obtiene cantidad de canastos disponibles."""
        return db.query(func.count(Canasto.id)).filter(
            Canasto.estado == EstadoCanasto.DISPONIBLE.value,
            Canasto.activo == True
        ).scalar()
