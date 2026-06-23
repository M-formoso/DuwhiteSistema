"""Renombrar códigos de productos_lavado a numéricos (lista DUWHITE)

Reemplaza los códigos actuales (ALF-002, CAM-007, etc.) por los códigos
numéricos pedidos por el cliente. Match por nombre normalizado
(UPPERCASE + trim + collapse de espacios), con aliases para casos
singular/plural/abreviado. Los productos del listado que no existan
se crean. Los productos huérfanos (que no aparecen en el listado y no
están en la lista de aliases) se dejan tal cual están — no se borran.

Casos especiales:
- "SERVICIO DE LAVANDERIA" aparece dos veces (códigos 75 y 76). Ambos
  se crean/asignan; el operario elige cuál en el lookup.
- "CAMINO DE CAMA" y "CAMINO DE MESA" se desactivan (soft delete:
  activo=false). Se crea "CAMINOS" (17) nuevo. Los viejos quedan en BD
  por integridad referencial con remitos históricos.

Revision ID: 20260623100000
Revises: 20260622100000
Create Date: 2026-06-23
"""

from alembic import op
import sqlalchemy as sa


revision = "20260623100000"
down_revision = "20260622100000"
branch_labels = None
depends_on = None


# (codigo, nombre, categoria)
# Categorías válidas: toallas | ropa_cama | manteleria | alfombras | cortinas | otros
PRODUCTOS_DESEADOS: list[tuple[str, str, str]] = [
    ("1",   "SABANAS",                 "ropa_cama"),
    ("2",   "FUNDAS",                  "ropa_cama"),
    ("3",   "CUBRE CAMAS",             "ropa_cama"),
    ("4",   "FRAZADAS",                "ropa_cama"),
    ("5",   "TOALLA",                  "toallas"),
    ("6",   "TOALLON",                 "toallas"),
    ("7",   "MANTELES",                "manteleria"),
    ("8",   "MANTEL REDONDO",          "manteleria"),
    ("9",   "MANTEL GRANDE",           "manteleria"),
    ("10",  "REPASADOR",               "manteleria"),
    ("11",  "SERVILLETA",              "manteleria"),
    ("12",  "CUBRE MANTEL",            "manteleria"),
    ("13",  "CORTINAS 1",              "cortinas"),
    ("14",  "CORTINAS 2",              "cortinas"),
    ("15",  "CORTINAS 3",              "cortinas"),
    ("16",  "CUBRE SOMIERE",           "ropa_cama"),
    ("17",  "CAMINOS",                 "manteleria"),
    ("18",  "ALFOMBRITAS",             "alfombras"),
    ("19",  "ALMOHADAS",               "ropa_cama"),
    ("20",  "BATAS",                   "otros"),
    ("21",  "ROPA GASTRONOMICA",       "otros"),
    ("22",  "MANTEL V",                "manteleria"),
    ("23",  "CUBRE MANTEL V",          "manteleria"),
    ("26",  "FUNDAS ALMOHADON",        "ropa_cama"),
    ("27",  "LAVADO",                  "otros"),
    ("28",  "SECADO",                  "otros"),
    ("31",  "CUBRE SILLA",             "otros"),
    ("34",  "ACOLCHADO",               "ropa_cama"),
    ("41",  "COLCHON CUNA",            "ropa_cama"),
    ("47",  "POLLERIN",                "otros"),
    ("53",  "MANTEL IMPERIAL",         "manteleria"),
    ("55",  "REJILLA",                 "otros"),
    ("73",  "FUNDON",                  "ropa_cama"),
    ("75",  "SERVICIO DE LAVANDERIA",  "otros"),
    ("76",  "SERVICIO DE LAVANDERIA",  "otros"),
    ("80",  "MANTEL REDONDO GRANDE",   "manteleria"),
    ("81",  "DESMANCHADO",             "otros"),
    ("83",  "CUBRE COLCHON",           "ropa_cama"),
    ("89",  "ALFOMBRA GRANDE",         "alfombras"),
    ("91",  "TOALLA FACIAL",           "toallas"),
    ("92",  "MOPA",                    "otros"),
    ("104", "COLCHONETA",              "ropa_cama"),
]


def _norm(nombre: str) -> str:
    """Normaliza un nombre para comparar: UPPERCASE + trim + collapse espacios."""
    return " ".join((nombre or "").strip().upper().split())


# Aliases para que un producto viejo (singular / abreviado) matchee con
# el nombre nuevo de la lista. Key: cómo está hoy en BD; Value: nombre
# del listado nuevo. Solo casos obvios y unívocos. Los nombres ambiguos
# (ej. "CAMINO DE CAMA" / "CAMINO DE MESA") NO se incluyen para no
# colisionar con el nuevo "CAMINOS"; el viejo se queda con su código.
ALIASES_NOMBRE_VIEJO_A_NUEVO: dict[str, str] = {
    "SABANA":           "SABANAS",
    "FUNDA":            "FUNDAS",
    "CUBRE CAMA":       "CUBRE CAMAS",
    "FRAZADA":          "FRAZADAS",
    "ALMOHADA":         "ALMOHADAS",
    "BATA":             "BATAS",
    "ALFOMBRITA":       "ALFOMBRITAS",
    "CORTINA TIPO 1":   "CORTINAS 1",
    "CORTINA TIPO 2":   "CORTINAS 2",
    "CORTINA TIPO 3":   "CORTINAS 3",
    "CUBRE SOMIER":     "CUBRE SOMIERE",
    "CUBREMANTEL":      "CUBRE MANTEL",
    "FUNDA ALMOHADON":  "FUNDAS ALMOHADON",
    "MANTEL":           "MANTELES",
    "FUNDA Y ALMOHADON": "FUNDAS ALMOHADON",
}


# Productos viejos a desactivar (soft delete: activo=false).
# Sus códigos viejos quedan, pero no aparecen más en lookups ni se pueden
# usar en remitos nuevos. NO se borran físicamente porque pueden estar
# referenciados en remitos / detalles históricos.
DESACTIVAR_POR_NOMBRE: list[str] = [
    "CAMINO DE CAMA",
    "CAMINO DE MESA",
]


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Soft delete de los productos que el cliente pidió quitar.
    if DESACTIVAR_POR_NOMBRE:
        conn.execute(
            sa.text("""
                UPDATE productos_lavado
                   SET activo = false
                 WHERE UPPER(TRIM(nombre)) = ANY(:nombres)
            """),
            {"nombres": [_norm(n) for n in DESACTIVAR_POR_NOMBRE]},
        )

    # 2. Cargar productos existentes ACTIVOS y agrupar por nombre normalizado.
    #    Solo activos: los desactivados en el paso 1 no participan del match.
    #    Si el nombre actual tiene un alias, lo indexamos bajo el nombre nuevo.
    rows_activos = conn.execute(
        sa.text("SELECT id, codigo, nombre FROM productos_lavado WHERE activo = true")
    ).mappings().all()
    existentes_por_nombre: dict[str, list[dict]] = {}
    for r in rows_activos:
        norm = _norm(r["nombre"])
        clave = ALIASES_NOMBRE_VIEJO_A_NUEVO.get(norm, norm)
        existentes_por_nombre.setdefault(clave, []).append(dict(r))

    # 3. Liberar los códigos que vamos a reasignar (evita conflicto unique).
    #    Tocamos TODOS los productos (activos o no) cuyo código actual
    #    coincide con alguno de los nuevos numéricos, para que el UPDATE
    #    posterior no choque con la unique constraint.
    nuevos_codigos = {c for c, _, _ in PRODUCTOS_DESEADOS}
    all_rows = conn.execute(
        sa.text("SELECT id, codigo FROM productos_lavado")
    ).mappings().all()
    for r in all_rows:
        if r["codigo"] in nuevos_codigos:
            conn.execute(
                sa.text("UPDATE productos_lavado SET codigo = :nc WHERE id = :id"),
                {"nc": f"__TMP_{r['id']}", "id": r["id"]},
            )

    # 4. Asignar nuevos códigos: UPDATE si hay match por nombre, INSERT si no.
    #    Para nombres duplicados (SERVICIO DE LAVANDERIA), se asigna 1 fila por iteración.
    ya_asignados: set[str] = set()  # ids ya asignados en esta corrida

    for codigo, nombre, categoria in PRODUCTOS_DESEADOS:
        candidatos = existentes_por_nombre.get(_norm(nombre), [])
        candidatos_libres = [c for c in candidatos if str(c["id"]) not in ya_asignados]

        if candidatos_libres:
            elegido = candidatos_libres[0]
            ya_asignados.add(str(elegido["id"]))
            conn.execute(
                sa.text("""
                    UPDATE productos_lavado
                       SET codigo = :codigo,
                           categoria = :categoria,
                           nombre = :nombre
                     WHERE id = :id
                """),
                {
                    "codigo": codigo,
                    "categoria": categoria,
                    "nombre": nombre,
                    "id": elegido["id"],
                },
            )
        else:
            conn.execute(
                sa.text("""
                    INSERT INTO productos_lavado
                        (id, codigo, nombre, categoria, activo, created_at, updated_at)
                    VALUES
                        (gen_random_uuid(), :codigo, :nombre, :categoria, true, NOW(), NOW())
                """),
                {"codigo": codigo, "nombre": nombre, "categoria": categoria},
            )


def downgrade() -> None:
    # Sin downgrade automático: revertir requiere conocer los códigos originales
    # de cada producto, que no quedan registrados. Si hace falta volver atrás,
    # restaurar la BD desde backup o reasignar códigos manualmente.
    pass
