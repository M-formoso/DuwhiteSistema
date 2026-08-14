"""
Diagnostica remitos que existen pero NO tienen su cargo correspondiente en
cuenta corriente.

Contexto: el portal cliente muestra remitos desde la tabla `remitos`. El
panel admin muestra movimientos desde `movimientos_cuenta_corriente`.
Cuando se emite un remito, el sistema debería crear el cargo en CC.
Si por algún bug no se creó, el remito aparece en el portal pero no en la
CC del admin, y el saldo del cliente queda descuadrado.

Uso:

    # 1) Modo diagnóstico (default, no toca nada):
    DATABASE_URL="postgresql://..." python scripts/diagnosticar_remitos_sin_movimiento_cc.py \
        --cliente-nombre RIVIERA

    # Con rango de fechas:
    ... --cliente-nombre RIVIERA --desde 2026-08-01 --hasta 2026-08-31

    # Por código:
    ... --cliente-codigo CLI-0048

    # 2) Modo reparación (crea los movimientos faltantes + ajusta saldo del cliente):
    ... --cliente-nombre RIVIERA --reparar --usuario-email admin@duwhite.com
"""

import argparse
import os
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import and_, create_engine, or_
from sqlalchemy.orm import sessionmaker

from app.models.cliente import Cliente
from app.models.cuenta_corriente import MovimientoCuentaCorriente, TipoMovimientoCC
from app.models.remito import Remito
from app.models.usuario import Usuario


def get_db_url(cli_url):
    return cli_url or os.getenv("DATABASE_URL")


def _resolver_cliente(session, nombre, codigo):
    q = session.query(Cliente).filter(Cliente.activo == True)
    if codigo:
        q = q.filter(Cliente.codigo == codigo)
    if nombre:
        q = q.filter(Cliente.razon_social.ilike(f"%{nombre}%"))
    clientes = q.all()
    if not clientes:
        raise SystemExit(f"❌ No se encontró cliente (nombre={nombre!r}, codigo={codigo!r})")
    if len(clientes) > 1:
        print(f"⚠️  Múltiples matches — usando el primero. Todos:")
        for c in clientes:
            print(f"   - {c.codigo} / {c.razon_social} / id={c.id}")
    return clientes[0]


def _cargo_para_remito(session, cliente_id, remito):
    """Busca un MovimientoCC de tipo CARGO cuyo concepto haga referencia al remito."""
    return (
        session.query(MovimientoCuentaCorriente)
        .filter(
            MovimientoCuentaCorriente.cliente_id == str(cliente_id),
            MovimientoCuentaCorriente.tipo == TipoMovimientoCC.CARGO.value,
            MovimientoCuentaCorriente.activo == True,
            MovimientoCuentaCorriente.concepto.ilike(f"%{remito.numero}%"),
        )
        .first()
    )


def diagnosticar(session, cliente, desde, hasta):
    q = session.query(Remito).filter(
        Remito.cliente_id == str(cliente.id),
        Remito.activo == True,
    )
    if desde:
        q = q.filter(Remito.fecha_emision >= desde)
    if hasta:
        q = q.filter(Remito.fecha_emision <= hasta)
    remitos = q.order_by(Remito.fecha_emision.asc()).all()

    faltantes = []
    ok = 0
    print(f"\n📋 Cliente: {cliente.codigo} / {cliente.razon_social}")
    print(f"   Saldo actual en BD: ${cliente.saldo_cuenta_corriente or 0}")
    print(f"   Rango: {desde or '-'} → {hasta or '-'}")
    print(f"   Remitos encontrados: {len(remitos)}\n")

    for r in remitos:
        cargo = _cargo_para_remito(session, cliente.id, r)
        marca = "✅" if cargo else "❌ FALTANTE"
        total = f"${r.total or 0}"
        print(
            f"   {marca}  {r.fecha_emision}  {r.numero}  {total:>15}  "
            f"estado={r.estado}"
        )
        if cargo:
            ok += 1
        else:
            faltantes.append(r)

    print(f"\n📊 Resumen: {ok} con cargo, {len(faltantes)} sin cargo")
    if faltantes:
        total_faltante = sum(Decimal(r.total or 0) for r in faltantes)
        print(f"   Monto total faltante en CC: ${total_faltante}")
    return faltantes


def reparar(session, cliente, faltantes, usuario_id):
    """Crea el cargo en CC por cada remito faltante y actualiza el saldo."""
    if not faltantes:
        print("\nNada para reparar.")
        return

    print(f"\n🛠  Creando {len(faltantes)} movimiento(s) faltante(s)...")
    for r in faltantes:
        saldo_anterior = Decimal(cliente.saldo_cuenta_corriente or 0)
        monto = Decimal(r.total or 0)
        saldo_posterior = saldo_anterior + monto

        mov = MovimientoCuentaCorriente(
            id=str(uuid4()),
            cliente_id=str(cliente.id),
            tipo=TipoMovimientoCC.CARGO.value,
            concepto=f"Remito {r.numero}",
            monto=monto,
            saldo_anterior=saldo_anterior,
            saldo_posterior=saldo_posterior,
            fecha_movimiento=r.fecha_emision or date.today(),
            estado_facturacion="sin_facturar",
            registrado_por_id=str(usuario_id),
            notas=f"Cargo generado por script (remito preexistente sin movimiento CC)",
            activo=True,
        )
        cliente.saldo_cuenta_corriente = saldo_posterior
        session.add(mov)
        print(f"   + {r.numero}  ${monto}  → saldo {saldo_posterior}")

    session.commit()
    print("\n✅ Reparación completada.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--database-url")
    ap.add_argument("--cliente-nombre")
    ap.add_argument("--cliente-codigo")
    ap.add_argument("--desde", type=lambda s: date.fromisoformat(s))
    ap.add_argument("--hasta", type=lambda s: date.fromisoformat(s))
    ap.add_argument("--reparar", action="store_true", help="Crear los movimientos faltantes")
    ap.add_argument("--usuario-email", help="Email del usuario que quedará como registrado_por en la reparación")
    args = ap.parse_args()

    if not (args.cliente_nombre or args.cliente_codigo):
        ap.error("Especificá --cliente-nombre o --cliente-codigo")

    db_url = get_db_url(args.database_url)
    if not db_url:
        ap.error("Falta DATABASE_URL (env o --database-url)")

    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        cliente = _resolver_cliente(session, args.cliente_nombre, args.cliente_codigo)
        faltantes = diagnosticar(session, cliente, args.desde, args.hasta)

        if args.reparar:
            if not args.usuario_email:
                ap.error("Para --reparar hace falta --usuario-email")
            usuario = (
                session.query(Usuario).filter(Usuario.email == args.usuario_email).first()
            )
            if not usuario:
                raise SystemExit(f"❌ Usuario no encontrado: {args.usuario_email}")
            reparar(session, cliente, faltantes, usuario.id)
    finally:
        session.close()


if __name__ == "__main__":
    main()
