"""
Configuración de base de datos SQLAlchemy.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings

# Crear engine de SQLAlchemy.
# connect_timeout corta el TCP/SSL handshake si Postgres no responde
# (clave en Railway, donde el deploy nuevo no debe colgarse esperando
# locks tomados por las conexiones del deploy anterior).
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args={
        "connect_timeout": 10,
        # Si una query queda esperando un lock más de 10s, falla con
        # canceling statement debido a statement timeout. Mejor reventar
        # rápido al startup que dejar el healthcheck en timeout.
        "options": "-c statement_timeout=10000 -c lock_timeout=5000",
    },
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base para modelos
Base = declarative_base()
