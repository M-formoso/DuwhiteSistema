"""
Tests unitarios de cálculos y reglas del factura_service.
No tocan DB (funciones puras).
"""

from decimal import Decimal

import pytest

from app.models.factura import TipoComprobante
from app.services.factura_service import (
    determinar_tipo_factura,
    calcular_linea,
    calcular_totales,
)


# ---------- determinar_tipo_factura ----------


@pytest.mark.parametrize(
    "condicion, esperado",
    [
        ("responsable_inscripto", TipoComprobante.FACTURA_A),
        ("monotributo", TipoComprobante.FACTURA_B),
        ("consumidor_final", TipoComprobante.FACTURA_B),
        ("exento", TipoComprobante.FACTURA_B),
        ("no_responsable", TipoComprobante.FACTURA_B),
    ],
)
def test_determinar_tipo_factura(condicion, esperado):
    assert determinar_tipo_factura(condicion) == esperado


# ---------- calcular_linea ----------


def test_calcular_linea_21_sin_descuento():
    # 100 unidades a 826.45 neto c/u, IVA 21%
    r = calcular_linea(Decimal("826.45"), Decimal("100"), Decimal("0"), Decimal("21"))
    assert r["subtotal_neto"] == Decimal("82645.00")
    assert r["iva_monto"] == Decimal("17355.45")
    assert r["total_linea"] == Decimal("100000.45")


def test_calcular_linea_con_descuento():
    r = calcular_linea(Decimal("1000"), Decimal("10"), Decimal("10"), Decimal("21"))
    # 10000 - 10% = 9000 neto; IVA 21% = 1890; total = 10890
    assert r["subtotal_neto"] == Decimal("9000.00")
    assert r["iva_monto"] == Decimal("1890.00")
    assert r["total_linea"] == Decimal("10890.00")


def test_calcular_linea_iva_105():
    r = calcular_linea(Decimal("100"), Decimal("10"), Decimal("0"), Decimal("10.5"))
    assert r["subtotal_neto"] == Decimal("1000.00")
    assert r["iva_monto"] == Decimal("105.00")
    assert r["total_linea"] == Decimal("1105.00")


def test_calcular_linea_iva_cero():
    r = calcular_linea(Decimal("500"), Decimal("2"), Decimal("0"), Decimal("0"))
    assert r["subtotal_neto"] == Decimal("1000.00")
    assert r["iva_monto"] == Decimal("0.00")
    assert r["total_linea"] == Decimal("1000.00")


# ---------- calcular_totales ----------


class _LineaFake:
    """Mock mínimo de FacturaDetalle para testear calcular_totales."""

    def __init__(self, subtotal_neto, iva_monto, iva_porcentaje):
        self.subtotal_neto = Decimal(subtotal_neto)
        self.iva_monto = Decimal(iva_monto)
        self.iva_porcentaje = Decimal(iva_porcentaje)


def test_calcular_totales_multiple_iva():
    detalles = [
        _LineaFake("1000.00", "210.00", "21"),
        _LineaFake("500.00", "52.50", "10.5"),
        _LineaFake("300.00", "0.00", "0"),
    ]
    t = calcular_totales(detalles)
    assert t["neto_gravado_21"] == Decimal("1000.00")
    assert t["iva_21"] == Decimal("210.00")
    assert t["neto_gravado_105"] == Decimal("500.00")
    assert t["iva_105"] == Decimal("52.50")
    assert t["neto_no_gravado"] == Decimal("300.00")
    assert t["subtotal"] == Decimal("1800.00")
    assert t["total"] == Decimal("2062.50")


def test_calcular_totales_vacio():
    t = calcular_totales([])
    assert t["total"] == Decimal("0.00")
    assert t["subtotal"] == Decimal("0.00")
