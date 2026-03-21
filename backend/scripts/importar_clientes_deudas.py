"""
Script para importar clientes y sus deudas desde el Excel.

Uso:
    cd backend

    # Con variable de entorno DATABASE_URL:
    DATABASE_URL="postgresql://..." python scripts/importar_clientes_deudas.py

    # O con argumento:
    python scripts/importar_clientes_deudas.py --database-url "postgresql://..."

    # O con .env configurado:
    python scripts/importar_clientes_deudas.py

El script:
1. Lee el archivo Excel "CLIENTES DUWHITE - deudas.xlsx"
2. Crea los clientes que no existen
3. Actualiza el saldo_cuenta_corriente
4. Crea un movimiento de cargo en cuenta corriente por cada deuda
"""

import sys
import os
import argparse
from pathlib import Path

# Agregar el directorio raíz al path
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import date
from decimal import Decimal
from uuid import uuid4

import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Importar todos los modelos para que SQLAlchemy resuelva las relaciones
from app.models.cliente import Cliente, TipoCliente, CondicionIVA
from app.models.lote_produccion import LoteProduccion
from app.models.cuenta_corriente import MovimientoCuentaCorriente, TipoMovimientoCC


def get_database_url(cli_url=None):
    """Obtiene la URL de la base de datos."""
    # Prioridad: argumento CLI > variable de entorno > config de settings
    if cli_url:
        return cli_url

    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url

    # Importar settings solo si no hay otra opción
    from app.core.config import settings
    return settings.DATABASE_URL


def generar_codigo_cliente(session, prefijo="CLI"):
    """Genera un código único de cliente."""
    ultimo = session.query(Cliente).filter(
        Cliente.codigo.like(f"{prefijo}-%")
    ).order_by(Cliente.codigo.desc()).first()

    if ultimo:
        numero = int(ultimo.codigo.split("-")[1]) + 1
    else:
        numero = 1

    return f"{prefijo}-{numero:04d}"


def normalizar_nombre(nombre):
    """Normaliza el nombre del cliente para comparaciones."""
    if pd.isna(nombre):
        return ""
    return str(nombre).strip().upper()


def importar_clientes(database_url=None):
    """Importa los clientes desde el Excel."""

    # Ruta al archivo Excel
    excel_path = Path(__file__).parent.parent.parent / "CLIENTES DUWHITE - deudas.xlsx"

    if not excel_path.exists():
        print(f"ERROR: No se encontró el archivo: {excel_path}")
        return

    print(f"Leyendo archivo: {excel_path}")

    # Leer Excel
    df = pd.read_excel(excel_path)
    df.columns = ['cliente', 'deuda', 'extra']
    df = df[['cliente', 'deuda']].dropna(subset=['cliente'])
    df['deuda'] = pd.to_numeric(df['deuda'], errors='coerce').fillna(0)

    # La deuda viene como valor negativo, la convertimos a positivo
    df['deuda'] = df['deuda'].abs()

    print(f"\nClientes a importar: {len(df)}")
    print(f"Clientes con deuda: {len(df[df['deuda'] > 0])}")
    print(f"Total deuda: ${df['deuda'].sum():,.2f}")

    # Conectar a la base de datos
    db_url = get_database_url(database_url)
    print(f"Conectando a: {db_url[:50]}...")
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        clientes_creados = 0
        clientes_actualizados = 0
        movimientos_creados = 0
        errores = []

        for idx, row in df.iterrows():
            nombre = normalizar_nombre(row['cliente'])
            deuda = Decimal(str(row['deuda']))

            if not nombre:
                continue

            # Buscar si el cliente ya existe (por nombre similar)
            cliente_existente = session.query(Cliente).filter(
                Cliente.razon_social.ilike(f"%{nombre}%")
            ).first()

            if not cliente_existente:
                cliente_existente = session.query(Cliente).filter(
                    Cliente.nombre_fantasia.ilike(f"%{nombre}%")
                ).first()

            if cliente_existente:
                # Cliente existe - actualizar saldo si tiene deuda
                if deuda > 0 and cliente_existente.saldo_cuenta_corriente != deuda:
                    print(f"  Actualizando: {nombre} -> Saldo: ${deuda:,.2f}")

                    # Crear movimiento de ajuste si hay diferencia
                    diferencia = deuda - cliente_existente.saldo_cuenta_corriente
                    if diferencia != 0:
                        movimiento = MovimientoCuentaCorriente(
                            id=str(uuid4()),
                            cliente_id=str(cliente_existente.id),
                            tipo=TipoMovimientoCC.CARGO.value if diferencia > 0 else TipoMovimientoCC.AJUSTE.value,
                            concepto=f"Ajuste por importación de saldos iniciales",
                            monto=abs(diferencia),
                            saldo_anterior=cliente_existente.saldo_cuenta_corriente,
                            saldo_posterior=deuda,
                            fecha_movimiento=date.today(),
                            registrado_por_id="12b80de2-f104-4da3-872f-145bbcc49a3b",  # Admin
                            notas="Importado desde Excel CLIENTES DUWHITE - deudas.xlsx",
                            estado_facturacion="sin_facturar",
                        )
                        session.add(movimiento)
                        movimientos_creados += 1

                    cliente_existente.saldo_cuenta_corriente = deuda
                    clientes_actualizados += 1
                else:
                    print(f"  Ya existe: {nombre}")
            else:
                # Crear nuevo cliente
                codigo = generar_codigo_cliente(session)

                # Determinar tipo de cliente por nombre
                tipo = TipoCliente.HOTEL.value
                nombre_lower = nombre.lower()
                if "colegio" in nombre_lower or "colonia" in nombre_lower:
                    tipo = TipoCliente.OTRO.value
                elif "posada" in nombre_lower:
                    tipo = TipoCliente.HOTEL.value

                nuevo_cliente = Cliente(
                    id=str(uuid4()),
                    codigo=codigo,
                    tipo=tipo,
                    razon_social=nombre.title(),  # Capitalizar
                    nombre_fantasia=nombre.title(),
                    condicion_iva=CondicionIVA.CONSUMIDOR_FINAL.value,
                    saldo_cuenta_corriente=deuda,
                    ciudad="Villa Carlos Paz",
                    provincia="Córdoba",
                    fecha_alta=date.today(),
                    activo=True,
                )

                session.add(nuevo_cliente)
                session.flush()  # Para obtener el ID

                print(f"  Creado: {codigo} - {nombre} -> Saldo: ${deuda:,.2f}")

                # Crear movimiento de cargo inicial si tiene deuda
                if deuda > 0:
                    movimiento = MovimientoCuentaCorriente(
                        id=str(uuid4()),
                        cliente_id=str(nuevo_cliente.id),
                        tipo=TipoMovimientoCC.CARGO.value,
                        concepto="Saldo inicial - Importación de deudas",
                        monto=deuda,
                        saldo_anterior=Decimal("0"),
                        saldo_posterior=deuda,
                        fecha_movimiento=date.today(),
                        registrado_por_id="12b80de2-f104-4da3-872f-145bbcc49a3b",  # Admin
                        notas="Importado desde Excel CLIENTES DUWHITE - deudas.xlsx",
                        estado_facturacion="sin_facturar",
                    )
                    session.add(movimiento)
                    movimientos_creados += 1

                clientes_creados += 1

        # Confirmar transacción
        session.commit()

        print("\n" + "=" * 50)
        print("IMPORTACIÓN COMPLETADA")
        print("=" * 50)
        print(f"Clientes creados: {clientes_creados}")
        print(f"Clientes actualizados: {clientes_actualizados}")
        print(f"Movimientos creados: {movimientos_creados}")

        if errores:
            print(f"\nErrores ({len(errores)}):")
            for error in errores:
                print(f"  - {error}")

    except Exception as e:
        session.rollback()
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Importar clientes y deudas desde Excel")
    parser.add_argument(
        "--database-url",
        help="URL de conexión a la base de datos PostgreSQL",
        default=None
    )
    parser.add_argument(
        "--skip-confirmation",
        "-y",
        action="store_true",
        help="Omitir confirmación y ejecutar directamente"
    )
    args = parser.parse_args()

    print("=" * 50)
    print("IMPORTACIÓN DE CLIENTES Y DEUDAS - DUWHITE")
    print("=" * 50)

    # Confirmar antes de ejecutar (a menos que se use -y)
    if not args.skip_confirmation:
        respuesta = input("\n¿Desea continuar con la importación? (s/n): ")
        if respuesta.lower() != 's':
            print("Importación cancelada.")
            sys.exit(0)

    importar_clientes(database_url=args.database_url)
