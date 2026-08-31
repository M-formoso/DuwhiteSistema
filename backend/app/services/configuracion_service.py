"""
Service de configuración del sistema (singleton).

`get_configuracion` garantiza que siempre haya una fila: si la tabla está
vacía (por ejemplo en un ambiente nuevo donde la migración no aplicó el
seed), la crea con los valores actuales de `settings.EMPRESA_*`.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.configuracion_sistema import ConfiguracionSistema
from app.schemas.configuracion import ConfiguracionUpdate


def get_configuracion(db: Session) -> ConfiguracionSistema:
    """Devuelve la fila singleton, creándola si no existe."""
    config = db.query(ConfiguracionSistema).first()
    if config:
        return config

    config = ConfiguracionSistema(
        empresa_nombre=settings.EMPRESA_NOMBRE or "",
        empresa_razon_social=settings.EMPRESA_RAZON_SOCIAL or "",
        empresa_cuit=settings.EMPRESA_CUIT or "",
        empresa_condicion_iva=settings.EMPRESA_CONDICION_IVA or "Responsable Inscripto",
        empresa_direccion=settings.EMPRESA_DIRECCION or "",
        empresa_localidad=settings.EMPRESA_LOCALIDAD or "",
        empresa_provincia=settings.EMPRESA_PROVINCIA or "",
        empresa_codigo_postal="",
        empresa_telefono="",
        empresa_email=settings.EMAIL_FROM or "",
        empresa_sitio_web="",
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def actualizar_configuracion(
    db: Session,
    config: ConfiguracionSistema,
    data: ConfiguracionUpdate,
) -> ConfiguracionSistema:
    """Aplica cambios parciales al singleton."""
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(config, field, value)
    db.commit()
    db.refresh(config)
    return config


def get_empresa_dict(db: Session) -> dict:
    """
    Devuelve un dict con los datos de la empresa listos para pasar a los
    templates PDF (factura, remito, lista de precios, estado de cuenta).

    Mezcla los datos editables desde la UI (nombre, razón social, CUIT,
    dirección, contacto) con los fiscales estáticos que siguen viviendo
    en `settings` (IIBB, CBU, inicio de actividades). Esos últimos no se
    exponen en la UI porque cambiarlos accidentalmente rompe la lógica
    de AFIP/ARCA.
    """
    c = get_configuracion(db)
    return {
        "nombre": c.empresa_nombre,
        "razon_social": c.empresa_razon_social,
        "cuit": c.empresa_cuit,
        "condicion_iva": c.empresa_condicion_iva,
        "direccion": c.empresa_direccion,
        "localidad": c.empresa_localidad,
        "provincia": c.empresa_provincia,
        "codigo_postal": c.empresa_codigo_postal,
        "telefono": c.empresa_telefono,
        "email": c.empresa_email or settings.EMAIL_FROM,
        "sitio_web": c.empresa_sitio_web,
        # Campos fiscales/AFIP — no editables desde UI.
        "iibb": settings.EMPRESA_IIBB,
        "inicio_actividades": settings.EMPRESA_INICIO_ACTIVIDADES,
        "cbu": settings.EMPRESA_CBU,
        "banco": settings.EMPRESA_BANCO,
        "cuenta_titular": settings.EMPRESA_CUENTA_TITULAR or c.empresa_razon_social,
        "leyenda_cbu": settings.EMPRESA_LEYENDA_CBU,
    }
