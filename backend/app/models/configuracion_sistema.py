"""
Configuración global del sistema (singleton).

Persiste los datos de la empresa que aparecen en facturas, remitos, listas
de precios y estados de cuenta. Antes vivían solo en `settings.EMPRESA_*`
(env vars) y no podían editarse desde la UI.
"""

from uuid import uuid4

from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base
from app.models.base import TimestampMixin


class ConfiguracionSistema(Base, TimestampMixin):
    """
    Singleton de configuración. Se espera una única fila; el service
    garantiza la unicidad al leer/crear.
    """

    __tablename__ = "configuracion_sistema"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Datos de la empresa
    empresa_nombre = Column(String(150), nullable=False, default="")
    empresa_razon_social = Column(String(200), nullable=False, default="")
    empresa_cuit = Column(String(20), nullable=False, default="")
    empresa_condicion_iva = Column(String(50), nullable=False, default="Responsable Inscripto")
    empresa_direccion = Column(String(200), nullable=False, default="")
    empresa_localidad = Column(String(100), nullable=False, default="")
    empresa_provincia = Column(String(100), nullable=False, default="")
    empresa_codigo_postal = Column(String(20), nullable=False, default="")
    empresa_telefono = Column(String(50), nullable=False, default="")
    empresa_email = Column(String(150), nullable=False, default="")
    empresa_sitio_web = Column(String(150), nullable=False, default="")

    def __repr__(self) -> str:
        return f"<ConfiguracionSistema {self.empresa_nombre or '(sin nombre)'}>"
