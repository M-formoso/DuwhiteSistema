"""
Inicialización de la base de datos.
Crea datos iniciales (seeds) necesarios para el sistema.
"""

from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.usuario import Usuario


def init_db(db: Session) -> None:
    """
    Inicializa la base de datos con datos necesarios.
    Ejecutar después de las migraciones.
    """
    # Crear superadmin inicial si no existe
    crear_superadmin_inicial(db)


def crear_superadmin_inicial(db: Session) -> None:
    """
    Crea el usuario superadmin inicial si no existe ningún usuario.
    """
    # Verificar si ya existe algún usuario
    usuario_existente = db.query(Usuario).first()
    if usuario_existente:
        return

    # Crear superadmin
    superadmin = Usuario(
        email="admin@duwhite.com",
        password_hash=get_password_hash("Admin123!"),  # Cambiar en producción
        nombre="Administrador",
        apellido="DUWHITE",
        rol="superadmin",
        debe_cambiar_password=True,  # Forzar cambio en primer login
        activo=True,
    )

    db.add(superadmin)
    db.commit()

    print("✅ Usuario superadmin creado:")
    print("   Email: admin@duwhite.com")
    print("   Password: Admin123!")
    print("   ⚠️  IMPORTANTE: Cambiar la contraseña en el primer login")


if __name__ == "__main__":
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        init_db(db)
    finally:
        db.close()
