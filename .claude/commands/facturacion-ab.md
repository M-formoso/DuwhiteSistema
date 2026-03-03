# Skill: Facturación A/B Argentina

Instrucciones específicas para implementar la facturación A/B según normativa argentina.

## Contexto Fiscal Argentino

### Tipos de Comprobante
| Tipo | Destinatario | IVA |
|------|--------------|-----|
| **Factura A** | Responsable Inscripto (RI) | Discriminado |
| **Factura B** | Consumidor Final, Monotributo, Exento | Incluido |

### Condiciones IVA
- `responsable_inscripto` → Emitir Factura A
- `monotributista` → Emitir Factura B
- `consumidor_final` → Emitir Factura B
- `exento` → Emitir Factura B

---

## Implementación

### 1. Determinar Tipo de Factura

```python
def determinar_tipo_factura(condicion_iva_cliente: str) -> str:
    """
    Determina si emitir Factura A o B según la condición IVA del cliente.

    DUWHITE es Responsable Inscripto, por lo tanto:
    - A otro RI → Factura A
    - A CF/Mono/Exento → Factura B
    """
    if condicion_iva_cliente == "responsable_inscripto":
        return "A"
    return "B"
```

### 2. Estructura de Factura A (IVA Discriminado)

```python
# Precios NETOS (sin IVA)
# El IVA se muestra por separado

factura_a = {
    "tipo": "A",
    "detalle": [
        {
            "descripcion": "Lavado industrial - Sábanas",
            "cantidad": 100,
            "precio_unitario": 826.45,  # NETO (sin IVA)
            "subtotal": 82645.00,
            "iva_porcentaje": 21,
        }
    ],
    "neto_gravado_21": 82645.00,
    "neto_gravado_105": 0.00,
    "neto_gravado_0": 0.00,
    "iva_21": 17355.45,  # 82645 * 0.21
    "iva_105": 0.00,
    "percepciones": 0.00,
    "total": 100000.45,  # neto + IVA
}
```

### 3. Estructura de Factura B (IVA Incluido)

```python
# Precios con IVA INCLUIDO
# El IVA NO se muestra por separado

factura_b = {
    "tipo": "B",
    "detalle": [
        {
            "descripcion": "Lavado industrial - Sábanas",
            "cantidad": 100,
            "precio_unitario": 1000.00,  # CON IVA incluido
            "subtotal": 100000.00,
        }
    ],
    "subtotal": 100000.00,
    "descuento": 0.00,
    "total": 100000.00,
    # NO se muestran campos de IVA discriminado
}
```

### 4. Conversión de Precios

```python
def precio_neto_a_final(precio_neto: Decimal, iva_porcentaje: Decimal) -> Decimal:
    """Convierte precio neto a precio con IVA incluido."""
    return precio_neto * (1 + iva_porcentaje / 100)

def precio_final_a_neto(precio_final: Decimal, iva_porcentaje: Decimal) -> Decimal:
    """Convierte precio con IVA a precio neto."""
    return precio_final / (1 + iva_porcentaje / 100)

# Ejemplo:
# Precio neto: $826.45
# IVA 21%: $173.55
# Precio final: $1000.00
```

### 5. Numeración de Comprobantes

```
Formato: PPPP-NNNNNNNN
- PPPP: Punto de venta (4 dígitos)
- NNNNNNNN: Número de comprobante (8 dígitos)

Ejemplo: 0001-00000123

Numeración INDEPENDIENTE por:
- Tipo (A / B)
- Punto de venta
```

```python
def generar_numero_factura(db, tipo: str, punto_venta: int) -> str:
    ultimo = db.query(Factura).filter(
        Factura.tipo == tipo,
        Factura.punto_venta == punto_venta
    ).order_by(Factura.numero_comprobante.desc()).first()

    numero = (ultimo.numero_comprobante + 1) if ultimo else 1

    return f"{punto_venta:04d}-{numero:08d}"
```

---

## PDF de Factura

### Layout Factura A
```
┌────────────────────────────────────────────────────────┐
│ DUWHITE                              FACTURA A         │
│ CUIT: XX-XXXXXXXX-X                  Nº 0001-00000123  │
│ Responsable Inscripto                Fecha: 15/01/2026 │
├────────────────────────────────────────────────────────┤
│ Cliente: Hotel XYZ                                     │
│ CUIT: XX-XXXXXXXX-X                                    │
│ Condición IVA: Responsable Inscripto                   │
├────────────────────────────────────────────────────────┤
│ Descripción           Cant   P.Unit    Subtotal  IVA%  │
│ Lavado sábanas         100   $826.45  $82.645,00  21%  │
├────────────────────────────────────────────────────────┤
│                        Neto Gravado 21%: $82.645,00    │
│                        IVA 21%:          $17.355,45    │
│                        TOTAL:           $100.000,45    │
└────────────────────────────────────────────────────────┘
```

### Layout Factura B
```
┌────────────────────────────────────────────────────────┐
│ DUWHITE                              FACTURA B         │
│ CUIT: XX-XXXXXXXX-X                  Nº 0001-00000456  │
│ Responsable Inscripto                Fecha: 15/01/2026 │
├────────────────────────────────────────────────────────┤
│ Cliente: Juan Pérez                                    │
│ DNI: 12.345.678                                        │
│ Condición IVA: Consumidor Final                        │
├────────────────────────────────────────────────────────┤
│ Descripción           Cant   P.Unit    Subtotal        │
│ Lavado ropa            10   $1.000,00  $10.000,00      │
├────────────────────────────────────────────────────────┤
│                        TOTAL:           $10.000,00     │
│                        (IVA incluido)                  │
└────────────────────────────────────────────────────────┘
```

---

## Notas de Crédito/Débito

Siguen la misma lógica:
- **NC A / ND A**: Para facturas A, con IVA discriminado
- **NC B / ND B**: Para facturas B, con IVA incluido

```python
def crear_nota_credito(factura_original_id: UUID, motivo: str, monto: Decimal):
    factura = obtener_factura(factura_original_id)

    tipo_nc = f"NC {factura.tipo}"  # "NC A" o "NC B"

    # La NC hereda el mismo tratamiento de IVA que la factura original
```

---

## Checklist de Implementación

- [ ] Modelo `Factura` con campos para A y B
- [ ] Servicio que determina tipo según cliente
- [ ] Cálculo correcto de IVA (discriminado vs incluido)
- [ ] Numeración independiente por tipo y punto de venta
- [ ] PDF con layout correcto para A y B
- [ ] Movimiento automático en cuenta corriente
- [ ] Notas de crédito/débito
