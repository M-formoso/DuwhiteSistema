"""
Purga física de lotes archivados con más de N días sin remitos asociados.

Pensado para correr como cron job de Railway una vez por día.
En Railway: crear un "Cron Schedule" service que ejecute:

    python scripts/purgar_lotes_archivados.py --dias 30

Uso local:
    DATABASE_URL=postgresql://... python scripts/purgar_lotes_archivados.py
    python scripts/purgar_lotes_archivados.py --dry-run
    python scripts/purgar_lotes_archivados.py --dias 60 --max 100
"""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.services.produccion_service import ProduccionService


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dias", type=int, default=30, help="Mínimo de días archivado")
    parser.add_argument("--max", type=int, default=None, help="Máximo de lotes a borrar en esta corrida")
    parser.add_argument("--dry-run", action="store_true", help="No borra, solo lista")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    args = parser.parse_args()

    if not args.database_url:
        print("ERROR: falta DATABASE_URL (variable de entorno o --database-url)", file=sys.stderr)
        return 2

    engine = create_engine(args.database_url)
    with Session(engine) as db:
        service = ProduccionService(db)
        resultado = service.purgar_lotes_archivados(
            dias_minimos=args.dias,
            dry_run=args.dry_run,
            max_lotes=args.max,
        )

    print(f"[purga] dry_run={resultado['dry_run']} dias_minimos={resultado['dias_minimos']}")
    print(f"[purga] borrados: {resultado['lotes_borrados']}")
    print(f"[purga] protegidos por remito: {resultado['lotes_protegidos_por_remito']}")
    if resultado["numeros_borrados"]:
        print(f"[purga] números borrados: {', '.join(resultado['numeros_borrados'][:50])}"
              + (" ..." if len(resultado["numeros_borrados"]) > 50 else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
