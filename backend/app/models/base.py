"""
Modelo base con campos comunes para todas las entidades.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime
from sqlalchemy.dialects.postgresql import UUID


class TimestampMixin:
    """Mixin para timestamps de creación y actualización."""

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class SoftDeleteMixin:
    """Mixin para soft delete."""

    activo = Column(Boolean, default=True, nullable=False)


class BaseModelMixin(TimestampMixin, SoftDeleteMixin):
    """
    Mixin combinado con:
    - UUID como primary key
    - Timestamps (created_at, updated_at)
    - Soft delete (activo)
    """

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
