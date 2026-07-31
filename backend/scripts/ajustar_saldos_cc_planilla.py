"""
Ajusta saldos de cuenta corriente para dejarlos como en la planilla del cliente.

- Signo: planilla negativo = deuda. En BD positivo = deuda. Se invierte el signo.
- Grupos (ej. CONTINENTAL Y RUCA): monto total al cliente principal, el resto en 0.
- Clientes fuera de la lista no se tocan.
- Por cada cambio, crea un MovimientoCuentaCorriente tipo AJUSTE.
"""

import psycopg2
from decimal import Decimal
from uuid import uuid4
from datetime import date

DB_URL = "postgresql://postgres:UNGoyGcJpJzCTHjVgncnWxmodZQwYICh@shuttle.proxy.rlwy.net:18471/railway"
ADMIN_USER_ID = "12b80de2-f104-4da3-872f-145bbcc49a3b"  # admin@duwhite.com
CONCEPTO = "Ajuste de saldo según planilla del cliente"
NOTAS = "Ajuste masivo por planilla enviada por el cliente (2026-07-31)"

# (codigo_cliente, saldo_bd)   saldo_bd: positivo=deuda, negativo=crédito
# Consolidación de grupos: al principal el monto total, los otros en 0.
AJUSTES = [
    # === Individuales ===
    ("CLI-0005", Decimal("10084.76")),       # AOMA -> Organización SJV (fant. AOMA)
    ("CLI-0007", Decimal("326447.00")),      # BRISA DEL LAGO
    ("CLI-0008", Decimal("0")),              # BUENA VISTA
    ("CLI-0072", Decimal("202683.00")),      # CASA BLANCA (CASABLANCA en BD)
    ("CLI-0009", Decimal("0")),              # CASEROS 248
    ("CLI-0010", Decimal("1615834.00")),     # CATEDRAL
    ("CLI-0012", Decimal("763386.00")),      # COLEGIO FARMACEUTICOS
    ("CLI-0013", Decimal("0")),              # COLONIA 12 DE OCTUBRE
    ("CLI-0014", Decimal("246804.00")),      # COLONIA 8 DE MARZO
    ("CLI-0035", Decimal("0")),              # COLONIA DE TANTI (FATLYF)
    ("CLI-0015", Decimal("108556.00")),      # COMARCA
    ("CLI-0016", Decimal("7233665.24")),     # CONDADO
    ("CLI-0018", Decimal("1011830.00")),     # CORONADO
    ("CLI-0019", Decimal("790923.00")),      # COSTA LAGO
    ("CLI-0020", Decimal("3853992.00")),     # DOMUS AUDITORIUM
    ("CLI-0022", Decimal("2903750.00")),     # DOMUS LAKE
    ("CLI-0051", Decimal("0")),              # EL CID
    ("CLI-0025", Decimal("0")),              # ERNESTINA
    ("CLI-0026", Decimal("0")),              # ESTILO
    ("CLI-0027", Decimal("0")),              # GALA
    ("CLI-0028", Decimal("0")),              # HENIA
    ("CLI-0029", Decimal("-835844.00")),     # HOTEL 376 (verde = crédito a favor del cliente)
    ("CLI-0030", Decimal("0")),              # IMPERIAL
    ("CLI-0031", Decimal("1815733.00")),     # INTERLAC
    ("CLI-0032", Decimal("35692460.00")),    # INTI HUASI/NEVADO/LAGO AZUL/CONDOR
    ("CLI-0033", Decimal("0")),              # LE MIRAGE
    ("CLI-0062", Decimal("0")),              # LOS ARRAYANES
    ("CLI-0061", Decimal("0")),              # LOS NOGALES
    ("CLI-0036", Decimal("0")),              # MIRADOR DE LA VILLA
    ("CLI-0037", Decimal("0")),              # MIRADOR DE LAS SIERRAS
    ("CLI-0089", Decimal("0")),              # RESIDENCIA FRANCISCANA
    ("CLI-0039", Decimal("0")),              # NAZARETH
    ("CLI-0077", Decimal("0")),              # PANORAMA 1 (PANORAMA en planilla, ambos en 0)
    ("CLI-0086", Decimal("0")),              # PANORAMA 2
    ("CLI-0040", Decimal("0")),              # PINARES DEL CERRO HOTEL
    ("CLI-0041", Decimal("0")),              # PINARES DEL CERRO MANTELERIA
    ("CLI-0042", Decimal("0")),              # PINARES PANORAMA HOTEL
    ("CLI-0043", Decimal("0")),              # PINARES PANORAMA MANTELERIA
    ("CLI-0090", Decimal("0")),              # ACA -> ACA CESAR CARMAN
    ("CLI-0045", Decimal("0")),              # QUORUM
    ("CLI-0046", Decimal("0")),              # RANQUELES
    ("CLI-0047", Decimal("0")),              # RITZ
    ("CLI-0048", Decimal("0")),              # RIVIERA
    ("CLI-0049", Decimal("353424.00")),      # TAGORE
    ("CLI-0006", Decimal("450048.00")),      # TANTO
    ("CLI-0050", Decimal("1566386.00")),     # TOULON
    ("CLI-0075", Decimal("0")),              # URUGUAY
    ("CLI-0052", Decimal("2163936.00")),     # VAIVEN POSADA
    ("CLI-0053", Decimal("0")),              # VENETO
    ("CLI-0054", Decimal("1470178.00")),     # VILLA PAZ
    ("CLI-0056", Decimal("101214.00")),      # VITTO
    ("CLI-0057", Decimal("0")),              # Y 111

    # === Grupos consolidados: monto total al principal, otros a 0 ===
    # CONTINENTAL Y RUCA -> -$914.467
    ("CLI-0017", Decimal("914467.00")),      # CONTINENTAL (principal)
    ("CLI-0073", Decimal("0")),              # RUCA

    # DUPLEX - CYBELES - WYNWOOD -> -$504.144
    ("CLI-0023", Decimal("504144.00")),      # DUPLEX (principal)
    ("CLI-0080", Decimal("0")),              # CYBELES
    ("CLI-0081", Decimal("0")),              # WYNWOOD

    # VILLA PIREN -> -$3.186.560
    ("CLI-0055", Decimal("3186560.00")),     # VILLA PIREN CABAÑAS (principal)
    ("CLI-0079", Decimal("0")),              # VILLA PIREN APART
]


def main():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    cambios = []
    no_encontrados = []
    sin_cambios = []

    try:
        for codigo, saldo_nuevo in AJUSTES:
            cur.execute(
                "SELECT id, razon_social, saldo_cuenta_corriente FROM clientes WHERE codigo = %s AND activo = true;",
                (codigo,),
            )
            row = cur.fetchone()
            if not row:
                no_encontrados.append(codigo)
                continue
            cid, razon, saldo_actual = row
            saldo_actual = Decimal(saldo_actual or 0)
            if saldo_actual == saldo_nuevo:
                sin_cambios.append((codigo, razon, saldo_actual))
                continue

            diferencia = saldo_nuevo - saldo_actual
            # Insertar movimiento de ajuste
            cur.execute(
                """
                INSERT INTO movimientos_cuenta_corriente
                    (id, cliente_id, tipo, concepto, monto, saldo_anterior, saldo_posterior,
                     fecha_movimiento, registrado_por_id, notas, estado_facturacion, activo, created_at, updated_at)
                VALUES (%s, %s, 'ajuste', %s, %s, %s, %s, %s, %s, %s, 'sin_facturar', true, NOW(), NOW());
                """,
                (
                    str(uuid4()),
                    str(cid),
                    CONCEPTO,
                    abs(diferencia),
                    saldo_actual,
                    saldo_nuevo,
                    date.today(),
                    ADMIN_USER_ID,
                    f"{NOTAS}. Diferencia aplicada: {diferencia:+}",
                ),
            )
            # Actualizar saldo del cliente
            cur.execute(
                "UPDATE clientes SET saldo_cuenta_corriente = %s, updated_at = NOW() WHERE id = %s;",
                (saldo_nuevo, str(cid)),
            )
            cambios.append((codigo, razon, saldo_actual, saldo_nuevo, diferencia))

        conn.commit()
        print("=" * 100)
        print("AJUSTES APLICADOS")
        print("=" * 100)
        for codigo, razon, ant, nuevo, dif in cambios:
            print(f"{codigo:<10} | {razon[:40]:<40} | {ant:>15} -> {nuevo:>15}  ({dif:+})")

        print()
        print(f"Cambios aplicados: {len(cambios)}")
        print(f"Sin cambios (ya coincidían): {len(sin_cambios)}")
        if sin_cambios:
            for c, r, s in sin_cambios:
                print(f"  - {c} {r[:40]:<40} saldo {s}")
        print(f"Códigos no encontrados: {len(no_encontrados)} -> {no_encontrados}")

    except Exception as e:
        conn.rollback()
        print(f"ERROR - rollback: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
