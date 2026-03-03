"""
Modelo de Usuario del sistema DUWHITE.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.base import BaseModelMixin


class Usuario(Base, BaseModelMixin):
    """
    Usuario del sistema.

    Roles disponibles:
    - superadmin: Acceso total, gestiona otros admins
    - administrador: Acceso a módulos operativos, clientes, finanzas
    - jefe_produccion: Producción, stock, empleados de su equipo
    - operador: Producción (registrar etapas), stock (consultar)
    - comercial: Clientes, pedidos, listas de precios
    - contador: Finanzas, facturación, reportes financieros
    - solo_lectura: Solo puede ver, no puede modificar nada
    """

    __tablename__ = "usuarios"

    # Campos de autenticación
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)

    # Datos personales
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    avatar = Column(String(500), nullable=True)

    # Rol y permisos
    rol = Column(
        Enum(
            "superadmin",
            "administrador",
            "jefe_produccion",
            "operador",
            "comercial",
            "contador",
            "solo_lectura",
            name="rol_usuario",
        ),
        nullable=False,
        default="operador",
    )

    # Estado y seguridad
    debe_cambiar_password = Column(Boolean, default=True)
    ultimo_acceso = Column(DateTime, nullable=True)
    intentos_fallidos = Column(String(10), default="0")  # Para rate limiting

    # Relaciones
    logs = relationship("LogActividad", back_populates="usuario", lazy="dynamic")
    movimientos_stock = relationship("MovimientoStock", back_populates="usuario")
    empleado = relationship("Empleado", back_populates="user", uselist=False)

    def __repr__(self) -> str:
        return f"<Usuario {self.email} ({self.rol})>"

    @property
    def nombre_completo(self) -> str:
        """Retorna el nombre completo del usuario."""
        return f"{self.nombre} {self.apellido}"

    def actualizar_ultimo_acceso(self) -> None:
        """Actualiza la fecha de último acceso."""
        self.ultimo_acceso = datetime.utcnow()
