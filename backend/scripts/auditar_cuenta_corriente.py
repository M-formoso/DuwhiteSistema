"""
Auditoría de cuenta corriente de un cliente puntual.

Genera un listado completo de movimientos con saldo antes/después, más
agregados mensuales (cargos vs pagos vs ajustes) para cruzar contra un
Excel externo del cliente. Pensado para reconciliaciones donde el saldo
del sistema no coincide con el que lleva el cliente.

Uso (desde ./backend con Railway CLI):

    railway run python scripts/auditar_cuenta_corriente.py CLI-0033

O apuntando a otra base:

    DATABASE_URL="postgresql://..." python scripts/auditar_cuenta_corriente.py CLI-0033

El código del cliente es el que aparece en el sistema (ej: CLI-0033 para
LE MIRAGE). Si querés forzar salida CSV en vez de tabla, pasá --csv.
"""

import sys
import argparse
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.cliente import Cliente
from app.models.cuenta_corriente import MovimientoCuentaCorriente


def formatear_monto(v) -> str:
    return f"${Decimal(v or 0):>16,.2f}"


def auditar(db: Session, codigo: str, salida_csv: bool = False) -> int:
    cliente = db.query(Cliente).filter(Cliente.codigo == codigo).first()
    if not cliente:
        print(f"[ERROR] No se encontró el cliente con código {codigo}")
        return 1

    movs = (
        db.query(MovimientoCuentaCorriente)
        .filter(MovimientoCuentaCorriente.cliente_id == cliente.id)
        .filter(MovimientoCuentaCorriente.activo == True)
        .order_by(
            MovimientoCuentaCorriente.fecha_movimiento,
            MovimientoCuentaCorriente.created_at,
        )
        .all()
    )

    if salida_csv:
        print("fecha,tipo,monto,saldo_anterior,saldo_posterior,concepto,comprobante")
        for m in movs:
            fecha = m.fecha_movimiento.isoformat() if m.fecha_movimiento else ""
            comprobante = (
                m.factura_numero
                or m.recibo_numero
                or (m.remito.numero if getattr(m, "remito", None) else "")
                or ""
            )
            concepto = (m.concepto or "").replace(",", " ")
            print(
                f"{fecha},{m.tipo},{m.monto or 0},{m.saldo_anterior or 0},"
                f"{m.saldo_posterior or 0},{concepto},{comprobante}"
            )
        return 0

    # Salida tabular legible
    print(f"═══ {cliente.nombre_display} ({cliente.codigo}) ═══")
    print(f"Saldo actual en el sistema: ${Decimal(cliente.saldo_cuenta_corriente or 0):,.2f}")
    print(f"Total de movimientos activos: {len(movs)}")
    print()
    print(
        f"{'FECHA':<12} {'TIPO':<10} {'MONTO':>16} {'SALDO ANT.':>16} "
        f"{'SALDO POST.':>16}  CONCEPTO"
    )
    print("-" * 130)

    cargos_mes: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    pagos_mes: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    ajustes_mes: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))

    for m in movs:
        fecha_str = m.fecha_movimiento.strftime("%d/%m/%Y") if m.fecha_movimiento else "-"
        mes_key = m.fecha_movimiento.strftime("%Y-%m") if m.fecha_movimiento else "sin-fecha"
        monto = Decimal(m.monto or 0)
        sa = Decimal(m.saldo_anterior or 0)
        sp = Decimal(m.saldo_posterior or 0)
        print(
            f"{fecha_str:<12} {m.tipo:<10} {formatear_monto(monto)} "
            f"{formatear_monto(sa)} {formatear_monto(sp)}  {m.concepto or ''}"
        )

        if m.tipo == "cargo":
            cargos_mes[mes_key] += monto
        elif m.tipo == "pago":
            pagos_mes[mes_key] += monto
        elif m.tipo == "ajuste":
            # Para ajustes, el signo lo da el delta del saldo
            ajustes_mes[mes_key] += sp - sa

    print()
    print("═══ AGREGADOS MENSUALES ═══")
    print(f"{'MES':<10} {'CARGOS':>16} {'PAGOS':>16} {'AJUSTES (δ)':>16}")
    print("-" * 62)
    meses = sorted(
        set(list(cargos_mes.keys()) + list(pagos_mes.keys()) + list(ajustes_mes.keys()))
    )
    tot_c = tot_p = tot_a = Decimal("0")
    for mes in meses:
        c = cargos_mes.get(mes, Decimal("0"))
        p = pagos_mes.get(mes, Decimal("0"))
        a = ajustes_mes.get(mes, Decimal("0"))
        tot_c += c
        tot_p += p
        tot_a += a
        print(f"{mes:<10} {formatear_monto(c)} {formatear_monto(p)} {formatear_monto(a)}")
    print("-" * 62)
    print(f"{'TOTAL':<10} {formatear_monto(tot_c)} {formatear_monto(tot_p)} {formatear_monto(tot_a)}")
    print()
    print(f"Neto histórico (cargos − pagos + ajustesδ): ${tot_c - tot_p + tot_a:,.2f}")
    print(f"Saldo actual del sistema:                  ${Decimal(cliente.saldo_cuenta_corriente or 0):,.2f}")
    print()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("codigo", help="Código del cliente, ej: CLI-0033")
    parser.add_argument("--csv", action="store_true", help="Salida en CSV")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        return auditar(db, args.codigo, salida_csv=args.csv)
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
