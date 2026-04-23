"""
Configuración del sistema DUWHITE.
Carga variables de entorno y define settings globales.
"""

import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración global de la aplicación."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # App
    PROJECT_NAME: str = "DUWHITE Gestión"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql://duwhite:duwhite_secret@localhost:5432/duwhite_gestion"

    # Security
    SECRET_KEY: str = "tu-clave-secreta-cambiar-en-produccion-12345678901234567890"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS - Acepta todos los orígenes en producción o lista específica desde env
    @property
    def CORS_ORIGINS(self) -> List[str]:
        cors_env = os.getenv("CORS_ORIGINS", "")
        if cors_env:
            # Si hay variable de entorno, usar esos valores (separados por coma)
            return [origin.strip() for origin in cors_env.split(",") if origin.strip()]

        # Detectar si estamos en Railway (producción)
        railway_env = os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RAILWAY_STATIC_URL")
        if railway_env:
            # En Railway, permitir orígenes de Railway y otros comunes
            return [
                "https://frontend-production-2d95.up.railway.app",
                "https://duwhite-frontend.up.railway.app",
                "https://duwhite.up.railway.app",
                # Permitir cualquier subdominio de railway.app
                "https://*.up.railway.app",
                "http://localhost:5173",
                "http://localhost:3000",
            ]

        # Default para desarrollo local
        return [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
        ]

    # Redis/Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # Email (SMTP)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "gestion@duwhite.com"

    # Empresa (defaults)
    EMPRESA_NOMBRE: str = "DUWHITE"
    EMPRESA_RAZON_SOCIAL: str = "DUWHITE S.A."
    EMPRESA_CUIT: str = "XX-XXXXXXXX-X"
    EMPRESA_DIRECCION: str = "Córdoba, Argentina"
    EMPRESA_LOCALIDAD: str = "Córdoba"
    EMPRESA_PROVINCIA: str = "Córdoba"
    EMPRESA_CONDICION_IVA: str = "Responsable Inscripto"
    EMPRESA_IIBB: str = ""
    EMPRESA_INICIO_ACTIVIDADES: str = "2008-01-01"

    # AFIP - Facturación Electrónica (WSFEv1 + WSAA)
    AFIP_ENTORNO: str = "homologacion"  # "homologacion" | "produccion"
    AFIP_PUNTO_VENTA: int = 1
    AFIP_CERT_PATH: str = ""  # Ruta al certificado .crt emitido por AFIP
    AFIP_KEY_PATH: str = ""  # Ruta a la clave privada .key
    AFIP_CACHE_DIR: str = "/tmp/duwhite/afip"  # Cache del ticket WSAA
    AFIP_WSAA_URL_HOMO: str = "https://wsaahomo.afip.gov.ar/ws/services/LoginCms?wsdl"
    AFIP_WSAA_URL_PROD: str = "https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl"
    AFIP_WSFEV1_URL_HOMO: str = "https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL"
    AFIP_WSFEV1_URL_PROD: str = "https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL"

    # Pagination defaults
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    @property
    def AFIP_WSAA_URL(self) -> str:
        return self.AFIP_WSAA_URL_PROD if self.AFIP_ENTORNO == "produccion" else self.AFIP_WSAA_URL_HOMO

    @property
    def AFIP_WSFEV1_URL(self) -> str:
        return self.AFIP_WSFEV1_URL_PROD if self.AFIP_ENTORNO == "produccion" else self.AFIP_WSFEV1_URL_HOMO

    @property
    def EMPRESA_CUIT_NUMERICO(self) -> int:
        """CUIT sin guiones, como entero (formato requerido por AFIP)."""
        return int(self.EMPRESA_CUIT.replace("-", "").replace(" ", ""))


settings = Settings()
