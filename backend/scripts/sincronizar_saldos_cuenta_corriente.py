"""
Script para sincronizar saldos de clientes con movimientos de cuenta corriente.

Este script:
1. Busca todos los clientes activos con saldo_cuenta_corriente > 0
2. Verifica si tienen al menos un MovimientoCuentaCorriente
3. Si no tienen movimientos, crea un movimiento de tipo CARGO con el saldo actual

Uso:
    cd backend

    # Con variable de entorno DATABASE_URL:
    DATABASE_URL="postgresql://..." python scripts/sincronizar_saldos_cuenta_corriente.py

    # O con argumento:
    python scripts/sincronizar_saldos_cuenta_corriente.py --database-url "postgresql://..."

    # O con .env configurado:
    python scripts/sincronizar_saldos_cuenta_corriente.py
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

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Importar modelos
from app.models.cliente import Cliente
from app.models.cuenta_corriente import MovimientoCuentaCorriente, TipoMovimientoCC


def get_database_url(cli_url=None):
    """Obtiene la URL de la base de datos."""
    if cli_url:
        return cli_url

    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url

    from app.core.config import settings
    return settings.DATABASE_URL


def sincronizar_saldos(database_url=None, dry_run=False):
    """Sincroniza los saldos de clientes con movimientos de cuenta corriente."""

    db_url = get_database_url(database_url)
    print(f"Conectando a: {db_url[:50]}...")

    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Buscar clientes activos con saldo > 0
        clientes_con_saldo = session.query(Cliente).filter(
            Cliente.activo == True,
            Cliente.saldo_cuenta_corriente > 0
        ).all()

        print(f"\nClientes activos con saldo > 0: {len(clientes_con_saldo)}")

        clientes_sin_movimientos = []
        clientes_con_movimientos = []

        for cliente in clientes_con_saldo:
            # Verificar si tiene movimientos
            tiene_movimientos = session.query(MovimientoCuentaCorriente).filter(
                MovimientoCuentaCorriente.cliente_id == str(cliente.id)
            ).first() is not None

            if tiene_movimientos:
                clientes_con_movimientos.append(cliente)
            else:
                clientes_sin_movimientos.append(cliente)

        print(f"Clientes con movimientos existentes: {len(clientes_con_movimientos)}")
        print(f"Clientes SIN movimientos (a sincronizar): {len(clientes_sin_movimientos)}")

        if not clientes_sin_movimientos:
            print("\n¡No hay clientes que necesiten sincronización!")
            return

        print("\n" + "=" * 60)
        print("CLIENTES A SINCRONIZAR:")
        print("=" * 60)

        total_deuda = Decimal("0")
        for cliente in clientes_sin_movimientos:
            print(f"  {cliente.codigo} - {cliente.razon_social}")
            print(f"    Saldo: ${cliente.saldo_cuenta_corriente:,.2f}")
            total_deuda += cliente.saldo_cuenta_corriente

        print(f"\nTotal deuda a sincronizar: ${total_deuda:,.2f}")

        if dry_run:
            print("\n[MODO SIMULACIÓN - No se realizaron cambios]")
            return

        # Crear movimientos para clientes sin movimientos
        print("\n" + "=" * 60)
        print("CREANDO MOVIMIENTOS...")
        print("=" * 60)

        movimientos_creados = 0

        # Buscar el usuario admin para registrar los movimientos
        # Usamos el ID del admin por defecto
        admin_id = "12b80de2-f104-4da3-872f-145bbcc49a3b"

        for cliente in clientes_sin_movimientos:
            movimiento = MovimientoCuentaCorriente(
                id=str(uuid4()),
                cliente_id=str(cliente.id),
                tipo=TipoMovimientoCC.CARGO.value,
                concepto="Saldo inicial - Sincronización de cuenta corriente",
                monto=cliente.saldo_cuenta_corriente,
                saldo_anterior=Decimal("0"),
                saldo_posterior=cliente.saldo_cuenta_corriente,
                fecha_movimiento=date.today(),
                registrado_por_id=admin_id,
                notas="Movimiento creado automáticamente para sincronizar saldo existente",
                estado_facturacion="sin_facturar",
            )
            session.add(movimiento)
            movimientos_creados += 1
            print(f"  ✓ {cliente.codigo}: Movimiento de ${cliente.saldo_cuenta_corriente:,.2f} creado")

        # Confirmar transacción
        session.commit()

        print("\n" + "=" * 60)
        print("SINCRONIZACIÓN COMPLETADA")
        print("=" * 60)
        print(f"Movimientos creados: {movimientos_creados}")
        print(f"Total sincronizado: ${total_deuda:,.2f}")

    except Exception as e:
        session.rollback()
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Sincronizar saldos de clientes con movimientos de cuenta corriente"
    )
    parser.add_argument(
        "--database-url",
        help="URL de conexión a la base de datos PostgreSQL",
        default=None
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simular sin hacer cambios reales"
    )
    parser.add_argument(
        "-y", "--yes",
        action="store_true",
        help="Omitir confirmación y ejecutar directamente"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("SINCRONIZACIÓN DE SALDOS - CUENTA CORRIENTE CLIENTES")
    print("=" * 60)

    if args.dry_run:
        print("\n[MODO SIMULACIÓN ACTIVADO]")

    if not args.yes and not args.dry_run:
        respuesta = input("\n¿Desea continuar con la sincronización? (s/n): ")
        if respuesta.lower() != 's':
            print("Sincronización cancelada.")
            sys.exit(0)

    sincronizar_saldos(database_url=args.database_url, dry_run=args.dry_run)
