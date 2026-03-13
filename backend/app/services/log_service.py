"""
Servicio de Logging de Actividad.
Registra todas las acciones para auditoría.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.log_actividad import LogActividad


def _serializar_para_json(data: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    """
    Convierte valores no serializables a JSON (Decimal, UUID, date, datetime) a tipos básicos.
    """
    if data is None:
        return None

    resultado = {}
    for key, value in data.items():
        if isinstance(value, Decimal):
            resultado[key] = str(value)
        elif isinstance(value, UUID):
            resultado[key] = str(value)
        elif isinstance(value, datetime):
            resultado[key] = value.isoformat()
        elif isinstance(value, date):
            resultado[key] = value.isoformat()
        elif isinstance(value, dict):
            resultado[key] = _serializar_para_json(value)
        elif isinstance(value, list):
            resultado[key] = [
                _serializar_para_json(item) if isinstance(item, dict)
                else str(item) if isinstance(item, (Decimal, UUID))
                else item.isoformat() if isinstance(item, (date, datetime))
                else item
                for item in value
            ]
        else:
            resultado[key] = value

    return resultado


class LogService:
    """Servicio para registro de actividad de auditoría."""

    def registrar(
        self,
        db: Session,
        usuario_id: UUID,
        accion: str,
        modulo: str,
        entidad_tipo: Optional[str] = None,
        entidad_id: Optional[UUID] = None,
        datos_anteriores: Optional[dict[str, Any]] = None,
        datos_nuevos: Optional[dict[str, Any]] = None,
        descripcion: Optional[str] = None,
        ip: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> LogActividad:
        """
        Registra una actividad en el log de auditoría.

        Args:
            db: Sesión de base de datos
            usuario_id: ID del usuario que realizó la acción
            accion: Tipo de acción ('crear', 'editar', 'eliminar', 'login', 'logout', 'ver')
            modulo: Módulo afectado ('usuarios', 'stock', 'clientes', etc.)
            entidad_tipo: Tipo de entidad específica (opcional)
            entidad_id: ID de la entidad (opcional)
            datos_anteriores: Estado antes del cambio (opcional)
            datos_nuevos: Estado después del cambio (opcional)
            descripcion: Descripción legible de la acción (opcional)
            ip: IP del cliente (opcional)
            user_agent: User-Agent del navegador (opcional)

        Returns:
            LogActividad creado
        """
        log = LogActividad(
            usuario_id=usuario_id,
            accion=accion,
            modulo=modulo,
            entidad_tipo=entidad_tipo,
            entidad_id=entidad_id,
            datos_anteriores=_serializar_para_json(datos_anteriores),
            datos_nuevos=_serializar_para_json(datos_nuevos),
            descripcion=descripcion,
            ip=ip,
            user_agent=user_agent,
        )

        db.add(log)
        db.commit()
        db.refresh(log)

        return log

    def registrar_creacion(
        self,
        db: Session,
        usuario_id: UUID,
        modulo: str,
        entidad_tipo: str,
        entidad_id: UUID,
        datos: dict[str, Any],
        ip: Optional[str] = None,
    ) -> LogActividad:
        """Atajo para registrar una creación."""
        return self.registrar(
            db=db,
            usuario_id=usuario_id,
            accion="crear",
            modulo=modulo,
            entidad_tipo=entidad_tipo,
            entidad_id=entidad_id,
            datos_nuevos=datos,
            descripcion=f"Creación de {entidad_tipo}",
            ip=ip,
        )

    def registrar_edicion(
        self,
        db: Session,
        usuario_id: UUID,
        modulo: str,
        entidad_tipo: str,
        entidad_id: UUID,
        datos_anteriores: dict[str, Any],
        datos_nuevos: dict[str, Any],
        ip: Optional[str] = None,
    ) -> LogActividad:
        """Atajo para registrar una edición."""
        return self.registrar(
            db=db,
            usuario_id=usuario_id,
            accion="editar",
            modulo=modulo,
            entidad_tipo=entidad_tipo,
            entidad_id=entidad_id,
            datos_anteriores=datos_anteriores,
            datos_nuevos=datos_nuevos,
            descripcion=f"Edición de {entidad_tipo}",
            ip=ip,
        )

    def registrar_eliminacion(
        self,
        db: Session,
        usuario_id: UUID,
        modulo: str,
        entidad_tipo: str,
        entidad_id: UUID,
        datos: dict[str, Any],
        ip: Optional[str] = None,
    ) -> LogActividad:
        """Atajo para registrar una eliminación (soft delete)."""
        return self.registrar(
            db=db,
            usuario_id=usuario_id,
            accion="eliminar",
            modulo=modulo,
            entidad_tipo=entidad_tipo,
            entidad_id=entidad_id,
            datos_anteriores=datos,
            descripcion=f"Eliminación de {entidad_tipo}",
            ip=ip,
        )


# Instancia singleton del servicio
log_service = LogService()
