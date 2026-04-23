# Facturación Electrónica AFIP (A/B + NC/ND)

Módulo de facturación fiscal con integración directa al **WSFEv1** (Web Service
de Factura Electrónica, AFIP). Emite Factura A, Factura B, Notas de Crédito y
Notas de Débito con CAE válido para consumo fiscal.

## Flujo

1. **Crear borrador** desde un pedido (botón *Facturar* en `/pedidos/:id`).
   - El sistema determina A o B según `cliente.condicion_iva`.
   - Se toma snapshot de los datos fiscales del cliente (razón social, CUIT,
     condición IVA, domicilio). Si el cliente se edita después, la factura
     histórica no cambia.
2. **Revisar** el borrador en `/facturacion/:id`.
3. **Emitir a AFIP**: el botón "Emitir a AFIP" llama al endpoint
   `POST /facturas/:id/emitir`:
   - Consulta `FECompUltimoAutorizado` → N.
   - Solicita CAE vía `FECAESolicitar` para `N+1`.
   - Si AFIP responde **A** (autorizado): guarda CAE, numera la factura,
     cambia estado a `autorizada`, actualiza el pedido (`factura_numero`,
     `estado=facturado`) y crea un movimiento en la cuenta corriente del
     cliente.
   - Si AFIP responde **R** (rechazado): guarda los errores/observaciones y
     deja el estado como `rechazada` (podés corregir y reintentar).
4. **Descargar PDF** (`/facturas/:id/pdf`) con layout A o B + QR AFIP según
   RG 4892.
5. **Notas de Crédito / Débito**: desde el detalle de una factura
   **autorizada**, botones "Nota de Crédito" y "Nota de Débito" abren
   formularios que generan la NC/ND en borrador. Se emiten con el mismo flujo
   (`/facturas/:ncId/emitir`). Una NC por el total de la factura original
   marca la factura original como `anulada`.

## Configuración

Las variables viven en `backend/.env` (modelo: `backend/.env.example`):

```
EMPRESA_CUIT=30-12345678-9
EMPRESA_RAZON_SOCIAL=DUWHITE S.A.
EMPRESA_DOMICILIO=Av. Colón 1234, Córdoba
EMPRESA_CONDICION_IVA=Responsable Inscripto
EMPRESA_IIBB=901-123456-7
EMPRESA_INICIO_ACTIVIDADES=2008-01-01

AFIP_ENTORNO=homologacion       # "homologacion" para testing, "produccion" para real
AFIP_PUNTO_VENTA=1
AFIP_CERT_PATH=/secrets/afip.crt
AFIP_KEY_PATH=/secrets/afip.key
AFIP_CACHE_DIR=/tmp/duwhite/afip
```

### Certificado AFIP

AFIP pide autenticar con un certificado X.509 propio:

```bash
# 1. Generar clave privada
openssl genrsa -out afip.key 2048

# 2. Generar el CSR (Certificate Signing Request)
openssl req -new -key afip.key -subj "/C=AR/O=DUWHITE S.A./CN=duwhite-wsfe/serialNumber=CUIT 30123456789" -out afip.csr

# 3. Subir afip.csr a AFIP → Administrador de Relaciones de Clave Fiscal →
#    Nuevo Relación → Web Services → Computador Fiscal → Generar Certificado.
#    Descargar el .crt y guardarlo junto con la .key.

# 4. Dar de alta el servicio WSFE a ese certificado:
#    Administrador de Relaciones → Nueva Relación → "Facturación Electrónica".
```

Al final tenés:
- `afip.crt`: certificado público, corresponde a `AFIP_CERT_PATH`.
- `afip.key`: clave privada, corresponde a `AFIP_KEY_PATH`.

**Importante**: en homologación y producción los certificados son distintos.

## Endpoints

| Método | Ruta | Permiso |
|--------|------|---------|
| GET    | `/facturas` | facturacion.ver |
| GET    | `/facturas/:id` | facturacion.ver |
| GET    | `/facturas/tipos` | facturacion.ver |
| GET    | `/facturas/estados` | facturacion.ver |
| GET    | `/facturas/:id/pdf` | facturacion.ver |
| POST   | `/facturas/desde-pedido` | facturacion.crear |
| POST   | `/facturas/manual` | facturacion.crear |
| POST   | `/facturas/:id/emitir` | facturacion.crear |
| POST   | `/facturas/:id/notas-credito` | facturacion.crear |
| POST   | `/facturas/:id/notas-debito` | facturacion.crear |
| DELETE | `/facturas/:id` | facturacion.eliminar (solo borradores) |

## Modelo de datos

**Tabla `facturas`** (`app/models/factura.py`):
- Snapshot del cliente (razon_social_snap, cuit_snap, condicion_iva_snap, domicilio_snap).
- Totales: subtotal, neto_gravado_21 / 10.5, iva_21 / 10.5, neto_no_gravado, percepciones, total.
- AFIP: cae, cae_vencimiento, afip_resultado (A/R/P), afip_response_raw (JSONB para auditoría).
- Estado: borrador → autorizada → (anulada).
- Relación con `Factura` original (NC/ND) y con pedido + movimiento cta cte.

**Tabla `facturas_detalle`**: líneas. Precios siempre almacenados como NETO.
El cálculo A/B cambia sólo la presentación en el PDF.

## Regla A/B

- Cliente con `condicion_iva = responsable_inscripto` → **Factura A** (IVA discriminado).
- Cualquier otra condición IVA → **Factura B** (IVA incluido en PDF pero
  discriminado internamente hacia AFIP).

Implementado en `factura_service.determinar_tipo_factura()`.

## Numeración

Nunca confiamos en un contador local. Antes de cada emisión:

```python
ultimo = client.obtener_ultimo_comprobante(punto_venta, cbte_tipo)
numero = ultimo + 1   # → se envía en FECAESolicitar
```

Si AFIP ya tenía un número más alto (por emisión desde otro sistema), el
`FECAESolicitar` rebotaría por número duplicado. Este chequeo previo evita ese
caso en el 99% de las veces.

## QR Fiscal (RG 4892)

Cada PDF incluye un QR escaneable por el lector oficial AFIP. El payload es:

```json
{
  "ver": 1,
  "fecha": "2026-04-23",
  "cuit": 30123456789,
  "ptoVta": 1,
  "tipoCmp": 1,
  "nroCmp": 123,
  "importe": 12345.67,
  "moneda": "PES",
  "ctz": 1,
  "tipoDocRec": 80,
  "nroDocRec": 20123456789,
  "tipoCodAut": "E",
  "codAut": 65432109876543
}
```

Codificado en base64 URL-safe y concatenado a `https://www.afip.gob.ar/fe/qr/?p=...`.

## Troubleshooting

### "AFIP_CERT_PATH / AFIP_KEY_PATH no configurados"
Seteá las variables y apuntá a archivos existentes con la clave y el cert.

### "Errors 10015 — Fecha de comprobante invalida"
La fecha no puede ser más vieja que 10 días ni más nueva que 10 días. Ajustá
`fecha_emision`.

### "CbteTipo N no habilitado en Pto.Vta"
El punto de venta no tiene habilitado ese tipo en AFIP (ej: PV nuevo todavía
no registrado para Facturas B). Entrá a AFIP → Facturación Electrónica →
Puntos de Venta y asociá los tipos de comprobante.

### "Observación 10063 — CAE emitido con observación"
AFIP autorizó pero con advertencia — generalmente por condición IVA receptor
o DocTipo. El CAE igual es válido; revisá el mensaje y corregí para próximas
emisiones.

## Tests

```bash
cd backend
pytest tests/services/test_factura_service.py -v
```

Testea selección A/B, cálculo de línea (distintas alícuotas, descuentos) y
agregación de totales.
