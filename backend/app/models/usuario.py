"""
Modelo de Usuario del sistema DUWHITE.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, String, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.base import BaseModelMixin


# Módulos disponibles en el sistema
MODULOS_SISTEMA = [
    "dashboard",
    "stock",
    "proveedores",
    "produccion",
    "clientes",
    "pedidos",
    "finanzas",
    "costos",
    "empleados",
    "reportes",
    "usuarios",
    "configuracion",
]

# Permisos por defecto según rol
PERMISOS_POR_ROL = {
    "superadmin": {m: True for m in MODULOS_SISTEMA},
    "administrador": {
        "dashboard": True, "stock": True, "proveedores": True, "produccion": True,
        "clientes": True, "pedidos": True, "finanzas": True, "costos": True,
        "empleados": True, "reportes": True, "usuarios": False, "configuracion": True,
    },
    "jefe_produccion": {
        "dashboard": True, "stock": True, "proveedores": False, "produccion": True,
        "clientes": False, "pedidos": True, "finanzas": False, "costos": True,
        "empleados": True, "reportes": True, "usuarios": False, "configuracion": False,
    },
    "operador": {
        "dashboard": True, "stock": True, "proveedores": False, "produccion": True,
        "clientes": False, "pedidos": False, "finanzas": False, "costos": False,
        "empleados": False, "reportes": False, "usuarios": False, "configuracion": False,
    },
    "comercial": {
        "dashboard": True, "stock": False, "proveedores": False, "produccion": False,
        "clientes": True, "pedidos": True, "finanzas": False, "costos": False,
        "empleados": False, "reportes": True, "usuarios": False, "configuracion": False,
    },
    "contador": {
        "dashboard": True, "stock": False, "proveedores": True, "produccion": False,
        "clientes": True, "pedidos": True, "finanzas": True, "costos": True,
        "empleados": False, "reportes": True, "usuarios": False, "configuracion": False,
    },
    "solo_lectura": {
        "dashboard": True, "stock": True, "proveedores": True, "produccion": True,
        "clientes": True, "pedidos": True, "finanzas": True, "costos": True,
        "empleados": True, "reportes": True, "usuarios": False, "configuracion": False,
    },
    "cliente": {
        "dashboard": True, "stock": False, "proveedores": False, "produccion": False,
        "clientes": False, "pedidos": True, "finanzas": True, "costos": False,
        "empleados": False, "reportes": False, "usuarios": False, "configuracion": False,
    },
}


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
    - cliente: Usuario de cliente, solo ve sus propios datos
    """

    __tablename__ = "usuarios"

    # Campos de autenticación
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)

    # Password en texto plano (solo para usuarios cliente, para mostrar en panel admin)
    password_visible = Column(String(255), nullable=True)

    # PIN para validación rápida en producción (4-6 dígitos)
    pin = Column(String(6), nullable=True)

    # Datos personales
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    telefono = Column(String(50), nullable=True)
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
            "cliente",
            name="rol_usuario",
        ),
        nullable=False,
        default="operador",
    )

    # Permisos por módulo personalizados (JSON: {"dashboard": true, "stock": true, ...})
    # Si es null, usa permisos por defecto según rol
    permisos_modulos = Column(JSON, nullable=True)

    # Vinculación con cliente (para usuarios tipo "cliente")
    cliente_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clientes.id"),
        nullable=True,
        index=True,
    )

    # Estado y seguridad
    debe_cambiar_password = Column(Boolean, default=True)
    ultimo_acceso = Column(DateTime, nullable=True)
    intentos_fallidos = Column(String(10), default="0")  # Para rate limiting

    # Relaciones
    logs = relationship("LogActividad", back_populates="usuario", lazy="dynamic")
    movimientos_stock = relationship("MovimientoStock", back_populates="usuario")
    empleado = relationship("Empleado", back_populates="user", uselist=False)
    cliente = relationship("Cliente", back_populates="usuarios", foreign_keys=[cliente_id])

    def __repr__(self) -> str:
        return f"<Usuario {self.email} ({self.rol})>"

    @property
    def nombre_completo(self) -> str:
        """Retorna el nombre completo del usuario."""
        return f"{self.nombre} {self.apellido}"

    def actualizar_ultimo_acceso(self) -> None:
        """Actualiza la fecha de último acceso."""
        self.ultimo_acceso = datetime.utcnow()

    def get_permisos(self) -> dict:
        """Retorna los permisos efectivos del usuario."""
        if self.permisos_modulos:
            return self.permisos_modulos
        return PERMISOS_POR_ROL.get(self.rol, {})

    def tiene_permiso(self, modulo: str) -> bool:
        """Verifica si el usuario tiene acceso a un módulo."""
        permisos = self.get_permisos()
        return permisos.get(modulo, False)
