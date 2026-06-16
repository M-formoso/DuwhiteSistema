"""
Crear o resetear un usuario superadmin desde variables de entorno.

Uso (en Railway shell o local):
    NUEVO_EMAIL=mateo@duwhite.com \
    NUEVO_PASSWORD='MiPassSegura123!' \
    NUEVO_NOMBRE=Mateo \
    NUEVO_APELLIDO=Formoso \
    python -m scripts.crear_superadmin

Si el email ya existe, le resetea password, rol=superadmin y activo=True.
Si no existe, lo crea desde cero.
"""

import os
import sys
from uuid import uuid4

import bcrypt

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import SessionLocal
from app.models.usuario import Usuario


def main() -> int:
    email = os.environ.get("NUEVO_EMAIL", "").strip().lower()
    password = os.environ.get("NUEVO_PASSWORD", "")
    nombre = os.environ.get("NUEVO_NOMBRE", "Super").strip()
    apellido = os.environ.get("NUEVO_APELLIDO", "Admin").strip()

    if not email or not password:
        print("ERROR: faltan NUEVO_EMAIL o NUEVO_PASSWORD en el entorno.")
        return 1
    if len(password) < 8:
        print("ERROR: la password debe tener al menos 8 caracteres.")
        return 1

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    db = SessionLocal()
    try:
        existente = db.query(Usuario).filter(Usuario.email == email).first()

        if existente:
            existente.password_hash = hashed
            existente.rol = "superadmin"
            existente.activo = True
            existente.debe_cambiar_password = False
            existente.intentos_fallidos = "0"
            existente.nombre = nombre
            existente.apellido = apellido
            db.commit()
            print(f"OK actualizado superadmin: {email}")
        else:
            nuevo = Usuario(
                id=uuid4(),
                email=email,
                password_hash=hashed,
                nombre=nombre,
                apellido=apellido,
                rol="superadmin",
                activo=True,
                debe_cambiar_password=False,
            )
            db.add(nuevo)
            db.commit()
            print(f"OK creado superadmin: {email}")

        return 0
    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        return 2
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
