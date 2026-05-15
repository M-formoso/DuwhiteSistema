"""
Script para limpiar movimientos de nómina (adelantos / HS extras / etc.)
con fecha o período en el futuro.

Por defecto borra todo lo que tenga periodo_anio/periodo_mes >= MAYO 2026.
Es DRY-RUN por defecto: solo muestra qué borraría.

Uso:
    cd backend

    # Dry-run (no borra, solo muestra):
    DATABASE_URL="postgresql://..." python scripts/limpiar_jornales_futuros.py

    # Soft delete (activo=False) — recomendado:
    DATABASE_URL="postgresql://..." python scripts/limpiar_jornales_futuros.py --confirm

    # Hard delete (DELETE FROM):
    DATABASE_URL="postgresql://..." python scripts/limpiar_jornales_futuros.py --confirm --hard

    # Cambiar el corte (default mes=5 anio=2026):
    python scripts/limpiar_jornales_futuros.py --desde-mes 6 --desde-anio 2026 --confirm
"""

import sys
import os
import argparse
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, or_, and_
from sqlalchemy.orm import sessionmaker

from app.models.empleado import MovimientoNomina, Empleado


def get_database_url(cli_url=None):
    if cli_url:
        return cli_url
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url
    from app.core.config import settings
    return settings.DATABASE_URL


def limpiar(database_url, desde_mes, desde_anio, confirm, hard):
    db_url = get_database_url(database_url)
    print(f"Conectando a: {db_url[:50]}...")
    print(f"Corte: borrar todo a partir de {desde_mes:02d}/{desde_anio}")

    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # periodo_anio > desde_anio  OR  (periodo_anio == desde_anio AND periodo_mes >= desde_mes)
        filtro_periodo = or_(
            MovimientoNomina.periodo_anio > desde_anio,
            and_(
                MovimientoNomina.periodo_anio == desde_anio,
                MovimientoNomina.periodo_mes >= desde_mes,
            ),
        )

        q = session.query(MovimientoNomina).filter(filtro_periodo)
        if not hard:
            # Solo afectamos a los activos (soft delete)
            q = q.filter(MovimientoNomina.activo == True)

        registros = q.all()
        total = len(registros)
        print(f"\nMovimientos encontrados: {total}")

        if total == 0:
            print("Nada para borrar. ¡Listo!")
            return

        # Breakdown por empleado y mes
        por_empleado = defaultdict(lambda: defaultdict(lambda: {"cant": 0, "monto": 0}))
        empleados_cache = {}

        for r in registros:
            if r.empleado_id not in empleados_cache:
                emp = session.query(Empleado).get(r.empleado_id)
                empleados_cache[r.empleado_id] = (
                    f"{emp.nombre} {emp.apellido}" if emp else f"({r.empleado_id})"
                )
            nombre = empleados_cache[r.empleado_id]
            clave_periodo = f"{r.periodo_anio}-{r.periodo_mes:02d}"
            por_empleado[nombre][clave_periodo]["cant"] += 1
            por_empleado[nombre][clave_periodo]["monto"] += float(r.monto or 0)

        print("\n" + "=" * 70)
        print("DETALLE POR EMPLEADO Y PERÍODO")
        print("=" * 70)
        for nombre in sorted(por_empleado.keys()):
            print(f"\n  {nombre}")
            for periodo in sorted(por_empleado[nombre].keys()):
                d = por_empleado[nombre][periodo]
                print(f"    {periodo}: {d['cant']} mov · total $ {d['monto']:,.2f}")

        print("\n" + "=" * 70)
        print(f"TOTAL: {total} movimientos a {'BORRAR (HARD)' if hard else 'desactivar (soft)'}")
        print("=" * 70)

        if not confirm:
            print("\n[DRY-RUN — no se modificó nada]")
            print("Para ejecutar de verdad pasá --confirm")
            return

        if hard:
            print("\nBorrando físicamente (DELETE)...")
            q.delete(synchronize_session=False)
        else:
            print("\nDesactivando (activo=False)...")
            for r in registros:
                r.activo = False

        session.commit()
        print(f"OK — {total} movimientos {'eliminados' if hard else 'desactivados'}.")

    except Exception as e:
        session.rollback()
        print(f"\nERROR: {e}")
        raise
    finally:
        session.close()


def main():
    parser = argparse.ArgumentParser(description="Limpia jornales con período futuro.")
    parser.add_argument("--database-url", help="URL de la BD")
    parser.add_argument("--desde-mes", type=int, default=5, help="Mes desde (incl). Default: 5")
    parser.add_argument("--desde-anio", type=int, default=2026, help="Año desde (incl). Default: 2026")
    parser.add_argument("--confirm", action="store_true", help="Ejecutar (sin esto es dry-run)")
    parser.add_argument("--hard", action="store_true", help="DELETE físico en vez de soft delete")
    args = parser.parse_args()

    limpiar(
        database_url=args.database_url,
        desde_mes=args.desde_mes,
        desde_anio=args.desde_anio,
        confirm=args.confirm,
        hard=args.hard,
    )


if __name__ == "__main__":
    main()
