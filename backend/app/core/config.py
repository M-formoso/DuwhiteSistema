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
    EMPRESA_CUIT: str = "XX-XXXXXXXX-X"
    EMPRESA_DIRECCION: str = "Córdoba, Argentina"
    EMPRESA_CONDICION_IVA: str = "Responsable Inscripto"

    # Pagination defaults
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100


settings = Settings()
