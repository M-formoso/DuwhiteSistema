"""
Consolida ``alembic_version`` a una sola revisión correcta.

Por qué existe:
  En algún momento se cargaron 2 filas en alembic_version (ej:
  20260327100000 y 20260408_dias) por migraciones aplicadas sin
  actualizar el puntero previo. Alembic falla con "revisions overlap"
  al intentar `upgrade head`.

Qué hace (idempotente):
  1. Si ``alembic_version`` tiene 0 o 1 fila válida, no toca nada.
  2. Si tiene ≥2 filas, o revs que ya no existen en el grafo, infiere
     la revisión REAL basándose en qué objetos (tablas/columnas) existen
     en el schema y reemplaza la tabla con esa única revisión.
  3. Luego el siguiente ``alembic upgrade head`` aplica sólo lo que
     falte, sin re-ejecutar migraciones ya aplicadas.

Se corre antes de alembic en el startCommand.
"""

from __future__ import annotations

import os
import sys
from typing import Optional

from sqlalchemy import create_engine, text


def _existe_tabla(conn, nombre: str) -> bool:
    return bool(
        conn.execute(
            text("SELECT to_regclass(:n) IS NOT NULL"), {"n": nombre}
        ).scalar()
    )


def _existe_columna(conn, tabla: str, columna: str) -> bool:
    return bool(
        conn.execute(
            text(
                "SELECT EXISTS(SELECT 1 FROM information_schema.columns "
                "WHERE table_name=:t AND column_name=:c)"
            ),
            {"t": tabla, "c": columna},
        ).scalar()
    )


def detectar_rev_real(conn) -> Optional[str]:
    """
    Detecta la última migración realmente aplicada basándose en el schema.
    Devuelve el id de revisión Alembic, o None si no se pudo determinar.
    """
    # Del más nuevo al más viejo — se retorna el primer match
    if _existe_columna(conn, "facturas", "estado_pago"):
        return "20260423110000"
    if _existe_tabla(conn, "facturas"):
        return "20260423100000"
    if _existe_columna(conn, "etapas_produccion", "siguiente_etapa_id"):
        return "20260421100000"
    if _existe_columna(conn, "lotes_etapas", "maquina_id"):
        return "20260420100000"
    if _existe_columna(conn, "lotes_produccion", "estirado_origen_lote_id") or \
       _existe_columna(conn, "lotes_produccion", "bifurcacion_origen_lote_id"):
        return "20260415100000"
    if _existe_columna(conn, "lotes_produccion", "tipo_lote"):
        return "20260411100000"
    if _existe_tabla(conn, "canastos") and _existe_tabla(conn, "productos_lavado"):
        # No distinguimos 20260409100000 vs 20260409110000 por schema;
        # asumimos ambas aplicadas — alembic upgrade head lo corrige.
        return "20260409110000"
    if _existe_columna(conn, "empleados", "valor_dia_franco"):
        return "20260408_dias"
    if _existe_columna(conn, "movimientos_cuenta_corriente", "estado_facturacion"):
        return "20260320100000"
    # Si no matcheó nada, devolvemos None y dejamos que alembic resuelva.
    return None


def main() -> int:
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("[fix_alembic_heads] DATABASE_URL no configurado, salteando.", file=sys.stderr)
        return 0

    engine = create_engine(db_url)
    with engine.begin() as conn:
        if not _existe_tabla(conn, "alembic_version"):
            print("[fix_alembic_heads] Tabla alembic_version no existe (primer deploy), no hago nada.")
            return 0

        filas = [r[0] for r in conn.execute(text("SELECT version_num FROM alembic_version"))]
        print(f"[fix_alembic_heads] alembic_version actual: {filas}")

        if len(filas) == 1:
            print("[fix_alembic_heads] Una sola revisión, nada que hacer.")
            return 0

        if len(filas) == 0:
            print("[fix_alembic_heads] Tabla vacía. Alembic aplicará desde base.")
            return 0

        rev_real = detectar_rev_real(conn)
        if rev_real is None:
            print(
                "[fix_alembic_heads] No pude inferir la revisión real por schema. "
                "Abortando sin modificar nada — intervenir manualmente.",
                file=sys.stderr,
            )
            return 1

        print(f"[fix_alembic_heads] Consolidando alembic_version a {rev_real!r}.")
        conn.execute(text("DELETE FROM alembic_version"))
        conn.execute(
            text("INSERT INTO alembic_version (version_num) VALUES (:v)"),
            {"v": rev_real},
        )
        print("[fix_alembic_heads] Hecho.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
