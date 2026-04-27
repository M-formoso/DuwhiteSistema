# Alta del Módulo de Facturación Electrónica (ARCA / AFIP)

Guía operativa, paso a paso, para poner en marcha el módulo de facturación
electrónica del sistema DUWHITE contra los Web Services de ARCA (WSFEv1).

> **A quién le sirve esto**: la persona técnica que despliega el módulo
> + la administración / contadora que gestiona la clave fiscal.
> Si solo querés saber **cómo emitir** facturas una vez que está todo
> configurado, mirá `docs/facturacion.md`.

---

## 0. Mapa del flujo

```
┌────────────────────────┐                  ┌────────────────────────┐
│   CONTABLE / EMPRESA   │                  │    PERSONA TÉCNICA     │
│   (clave fiscal nivel  │                  │   (deploy en Railway)  │
│    3 sobre el CUIT)    │                  │                        │
└───────────┬────────────┘                  └────────────┬───────────┘
            │                                            │
   1. Alta de Punto de Venta                  2. Generar CSR + key
      "RECE para web services"                   (script local)
            │                                            │
            ├──────────────┬──── envía .csr ─────────────┤
            ▼              │                             ▼
   3. Si emite Factura A:  │                   key (queda en mac)
      - Solicitar          │
        habilitación       │
      - Declarar CBU       │
            │              │                    +
            │              ▼
            │   4. Subir CSR al portal ARCA
            │      → Asociar al servicio "wsfe"
            │      → Descargar .crt
            │              │
            │              └──── envía .crt ─────────────┐
            ▼                                            ▼
   5. Pasa CBU + datos                         6. Configurar Railway:
      bancarios al técnico                        - Env vars
            │                                       - Secret Files
            └──────────────────────────────────────┘  (.crt + .key)
                                                       │
                                                       ▼
                                            7. Validar con endpoint
                                               /facturas/estado-arca
                                                       │
                                                       ▼
                                            8. Probar emisión 1 factura
                                                       │
                                                       ▼
                                            9. Repetir 2-7 para producción
```

---

## 1. Pre-requisitos del lado del contribuyente (ARCA)

> **Quién lo hace**: contador o socio con clave fiscal nivel 3 + relación
> de servicios sobre el CUIT.

### 1.1 Punto de venta electrónico

ARCA → portal con clave fiscal → **PVE - Gestión de Puntos de Venta** →
crear un PV de tipo **"RECE para aplicativo y web services"**.

> En DUWHITE el PV ya existe: **número 2**, alias "DUWHITE".
> El PV 1 ("Factura en Línea") **NO sirve** para emitir desde un sistema —
> es solo para tipear facturas a mano en el portal de ARCA.

### 1.2 (Opcional pero típico) Habilitación de Factura A

Si el RI factura por encima de cierto monto / antigüedad, ARCA puede pedirle
una **habilitación específica** para emitir Factura A. Hay dos modalidades:

- **Régimen normal**: Factura A sin requisitos extra.
- **Régimen "Pago en CBU informada" (RG 1575/03 / RG 5762/25)**: Factura A
  pero con la obligación de imprimir una leyenda fiscal y la CBU declarada
  en cada comprobante.

> En DUWHITE, ARCA habilitó el régimen de **Pago en CBU informada** el
> 20/04/2026 (solicitud 1582078). Eso significa que **las Facturas A van
> a salir con un bloque obligatorio que muestra la CBU + leyenda RG 1575/03**.
> Sin esa CBU cargada en el sistema, las Factura A **no son válidas**.

### 1.3 (Si aplica) Declarar la CBU receptora

Bajo el régimen 1575/03, ARCA exige declarar **una CBU específica** donde
los clientes deben depositar/transferir el pago. Esa CBU queda registrada
en ARCA y debe coincidir exactamente con la que se imprime en cada
factura.

> Cómo encontrarla:
> - Preguntar al contador o socio que tramitó la habilitación.
> - O en el portal ARCA → buscar la solicitud 1582078 → ver detalle.

---

## 2. Generar el CSR (Certificate Signing Request)

> **Quién lo hace**: la persona técnica, en su máquina local.
> **Qué se obtiene**: dos archivos por entorno (homologación y producción):
> - `afip.key` — clave privada (queda local, **nunca se comparte**).
> - `afip.csr` — el "pedido" de certificado, en formato PEM/PKCS#10
>   (esto es lo que se sube a ARCA).

### Comando

```bash
cd backend
./scripts/generar_csr_arca.sh homologacion
./scripts/generar_csr_arca.sh produccion
```

El script crea las carpetas:

```
backend/afip_homologacion/
  ├── afip.key  ← clave privada (RSA 2048, queda en la mac)
  └── afip.csr  ← pedido a ARCA (este se manda)

backend/afip_produccion/
  ├── afip.key
  └── afip.csr
```

> El `.gitignore` ya está configurado para que nunca se suban estos
> archivos al repo.

### Qué contiene el CSR (por si lo preguntan)

Es un archivo de texto en base64, con un encabezado y pie estándar.
Adentro tiene:

- **Subject**: `C=AR, O=DUWHITE S.R.L., CN=duwhite-wsfe-<entorno>,
  serialNumber=CUIT 30719255694`. ARCA identifica al contribuyente
  por el campo `serialNumber`.
- **Clave pública RSA 2048 bits**.
- **Firma SHA-256** sobre los datos anteriores hecha con la clave privada
  recién generada — esto le demuestra a ARCA que el solicitante
  realmente posee la clave privada.

Para inspeccionarlo:

```bash
openssl req -in backend/afip_homologacion/afip.csr -text -noout
```

---

## 3. Subir el CSR a ARCA y descargar el `.crt`

> **Quién lo hace**: contador / socio con clave fiscal.

Hay **dos portales distintos** (homologación y producción) — son
certificados independientes, generados con CSRs distintos. Empezar
**siempre por homologación** para validar que el sistema funciona sin
emitir comprobantes con validez fiscal.

### 3.1 Homologación (testing / sandbox)

1. Ir a **`https://wsass-homo.afip.gob.ar/wsass/portal`**.
2. Loguear con la clave fiscal de la persona representante (en DUWHITE:
   Nicola Jeremias).
3. **"Nuevo Alias"** → pegar el contenido completo del archivo
   `afip.csr` de homologación, **incluyendo** las líneas
   `-----BEGIN CERTIFICATE REQUEST-----` y
   `-----END CERTIFICATE REQUEST-----`.
4. Asociar al servicio **`wsfe`** (Web Service de Facturación Electrónica).
5. Descargar el certificado generado (`.crt`) — guardarlo como
   `backend/afip_homologacion/afip.crt`.

### 3.2 Producción

1. Ir a **`https://auth.afip.gob.ar/contribuyente_/login.xhtml`** con la
   clave fiscal nivel 3.
2. **Administrador de Relaciones** → seleccionar el CUIT representado
   (DUWHITE S.R.L. - 30719255694).
3. **Nueva Relación** → buscar y agregar **"wsfe - Facturación
   Electrónica"**.
4. **Computador Fiscal** → subir el `afip.csr` de producción → ARCA
   genera el `.crt` → descargarlo como
   `backend/afip_produccion/afip.crt`.
5. Confirmar que el servicio quedó **asociado al certificado recién
   creado** dentro del Administrador de Relaciones.

### Resultado

Al final del paso 3 deberías tener 4 archivos por entorno:

```
backend/afip_homologacion/
  ├── afip.key
  ├── afip.csr
  └── afip.crt   ← agregado por ARCA

backend/afip_produccion/
  ├── afip.key
  ├── afip.csr
  └── afip.crt
```

---

## 4. Configurar Railway

> **Quién lo hace**: persona técnica.

### 4.1 Variables de entorno (Variables tab)

```
# Entorno
AFIP_ENTORNO=homologacion          # cambiar a "produccion" cuando se valide
AFIP_CERT_PATH=/secrets/afip.crt
AFIP_KEY_PATH=/secrets/afip.key
AFIP_CACHE_DIR=/tmp/duwhite/afip   # cache del ticket WSAA (TTL 12h)

# Empresa (los defaults ya están en config.py para DUWHITE,
# solo sobreescribir si difieren)
EMPRESA_CUIT=30-71925569-4
EMPRESA_RAZON_SOCIAL=DUWHITE S.R.L.
EMPRESA_DIRECCION=<dirección fiscal real>
EMPRESA_LOCALIDAD=Córdoba
EMPRESA_PROVINCIA=Córdoba
EMPRESA_IIBB=<si aplica>
EMPRESA_INICIO_ACTIVIDADES=<YYYY-MM-DD>
AFIP_PUNTO_VENTA=2

# Régimen RG 5762/25 (Pago en CBU informada) — obligatorio para Factura A
EMPRESA_CBU=<22 dígitos sin guiones>
EMPRESA_BANCO=<nombre del banco, cosmético>
EMPRESA_CUENTA_TITULAR=DUWHITE S.R.L.
```

### 4.2 Secret Files (Files tab)

Agregar **dos archivos secretos** apuntando a las rutas que el código
espera:

| Path en el container       | Contenido                                          |
|----------------------------|----------------------------------------------------|
| `/secrets/afip.crt`        | Pegar contenido completo del `.crt` (con headers)  |
| `/secrets/afip.key`        | Pegar contenido completo del `.key` (con headers)  |

> **Importante**: cada vez que se cambia entre homologación y producción
> hay que **reemplazar ambos archivos** (los certificados son distintos).

### 4.3 Verificar que el contenedor toma los secrets

Después de actualizar variables y archivos, Railway hace un redeploy
automático. En los logs del backend deberías ver:

```
[fix_alembic_heads] alembic_version actual: ['20260423110000']
[fix_alembic_heads] Una sola revisión, nada que hacer.
INFO [alembic.runtime.migration] ...
INFO Started server process
INFO Waiting for application startup.
INFO Application startup complete.
```

Si no levanta, mirar los logs y revisar cuál de los archivos / vars
falta o tiene formato incorrecto.

---

## 5. Validar la configuración (endpoint de diagnóstico)

Una vez levantado el contenedor con los secrets cargados, abrir en el
navegador (autenticado):

```
GET /api/v1/facturas/estado-arca
```

O desde la UI: **Facturación → banner de estado** (si todo está OK lo
muestra en verde, si falta algo lo muestra en rojo con el detalle).

Checks que hace:
- ✅/❌ CUIT no es placeholder
- ✅/❌ Certificado existe y es legible
- ✅/❌ Clave privada existe y matchea el certificado
- ✅/❌ Autenticación WSAA exitosa (consigue token+sign)
- ✅/❌ WSFEv1 responde (último comprobante autorizado)
- ✅/❌ CBU configurada (si régimen 1575/03 aplica)

Si todo verde, **estás listo para emitir**.

---

## 6. Primera factura de prueba (homologación)

1. En el sistema, crear un cliente **Responsable Inscripto** con un CUIT
   válido de prueba (cualquier CUIT real sirve — en homologación ARCA
   no controla padrón).
2. Crear un pedido para ese cliente con al menos un ítem.
3. Marcar el pedido como `listo` o `entregado` (cualquier estado postérmino
   de producción).
4. Ir a `/facturacion` → pestaña **Pendientes de facturar** → botón
   **"Facturar"** en la fila del pedido.
5. Se crea una **factura BORRADOR**. Revisar el detalle.
6. Click en **"Emitir a AFIP"** → si vuelve con un CAE de 14 dígitos,
   **funciona**.
7. Click en **"Descargar PDF"** → el archivo debería:
   - Tener la letra A o B según condición IVA del cliente.
   - Mostrar CAE y vencimiento del CAE.
   - Tener un QR escaneable (validable en
     `https://www.afip.gob.ar/fe/qr/`).
   - Si es Factura A: incluir el **bloque azul** con la leyenda RG 1575/03
     y la CBU.

8. Repetir con un cliente Consumidor Final → debe emitir Factura B.

9. Repetir con una factura ya autorizada → botón **"Nota de Crédito"** →
   total → emitir → debe autorizar y dejar la factura original como
   `anulada`.

> Las facturas en homologación **no tienen validez fiscal**. Es ARCA
> sandbox. Sirve solo para validar que la integración funciona.

---

## 7. Pasaje a producción

Cuando todo lo anterior está OK en homologación:

1. **Cambiar variables en Railway**:
   ```
   AFIP_ENTORNO=produccion
   ```
2. **Reemplazar Secret Files**:
   - `/secrets/afip.crt` ← contenido del `.crt` de **producción**
   - `/secrets/afip.key` ← contenido del `.key` de **producción**
3. **Borrar la cache WSAA** (el ticket es de homologación):
   - Reiniciar el contenedor en Railway, o
   - Conectarse al shell: `rm -rf /tmp/duwhite/afip/*`
4. Esperar redeploy.
5. Validar con `/api/v1/facturas/estado-arca` que ahora apunta a producción
   y todo está verde.
6. Emitir **una factura de monto bajo** a un cliente real como prueba
   final. Verificar que el CAE es real (puede validarse en
   `https://servicios1.afip.gov.ar/comprobantes-electronicos/...`).

---

## 8. Operación normal

Una vez en producción y validado:

- **Emitir factura desde pedido**: Pedido `listo`/`entregado` → cola en
  `/facturacion` → Facturar → Revisar borrador → Emitir a AFIP → CAE.
- **Emitir factura masiva**: en la cola, seleccionar varios pedidos con
  los checkboxes → "Facturar N seleccionados" → crea N borradores; cada
  uno se emite individualmente.
- **Registrar cobro**: detalle de factura autorizada → "Registrar cobro"
  → impacta cuenta corriente del cliente y actualiza estado_pago.
- **Nota de crédito**: detalle de factura autorizada → "Nota de Crédito"
  → motivo + total/parcial → emitir.
- **Descargar PDF**: detalle de factura autorizada → "Descargar PDF".

---

## 9. Anexo: errores comunes

| Error en logs | Causa probable | Solución |
|---------------|----------------|----------|
| `AFIP_CERT_PATH no configurado` | Faltan vars de Railway | Cargar las env vars |
| `Certificado no encontrado: /secrets/afip.crt` | Falta el Secret File | Agregar el Secret File |
| `Error 600: ValidacionDeToken: Computador no autorizado` | El cert no está asociado al servicio wsfe | Volver al Administrador de Relaciones y asociar |
| `Error 10015: Fecha de comprobante invalida` | Fecha emisión > 10 días o < -10 días | Ajustar `fecha_emision` |
| `Error 10063: Observación de CAE` | Datos receptor incompletos (DocTipo/DocNro inválido) | Revisar CUIT del cliente |
| `revisions overlap` al bootear | DB con múltiples heads en `alembic_version` | Resuelto automático por `scripts/fix_alembic_heads.py` |
| `KeyError: '20260408100000'` | Migración con down_revision roto | Ya resuelto en main |
| Factura A sin bloque CBU | `EMPRESA_CBU` vacío | Cargar en Railway |

---

## 10. Anexo: cuándo regenerar el certificado

- **Vence el CRT**: ARCA emite certificados con vigencia típica de 2 años.
  Cuando vence hay que repetir todo el proceso (CSR → portal → CRT). El
  endpoint `/facturas/estado-arca` te avisa cuando faltan menos de 30
  días para vencer.
- **Compromiso de la clave privada**: si la `.key` se filtró (subiste
  por error a un repo público, alguien la copió, etc.) hay que
  **revocar el certificado en ARCA** y generar uno nuevo.
- **Cambio de socio gerente / clave fiscal**: si la persona que tenía la
  representación deja la empresa, la nueva persona tiene que repetir
  el alta de la relación de servicio.

---

## 11. Anexo: glosario rápido

| Término | Significa |
|---------|-----------|
| **WSAA** | Web Service de Autenticación y Autorización. Da el token+sign que se usa en cada llamada a otros WS. |
| **WSFEv1** | Web Service de Factura Electrónica versión 1. Es el que solicita CAE. |
| **CAE** | Código de Autorización Electrónico. Lo da ARCA al autorizar una factura. 14 dígitos. |
| **CSR** | Certificate Signing Request. Pedido de certificado, en formato PEM. |
| **CRT** | Certificado X.509 emitido por ARCA, en formato PEM. |
| **Subject** | Campo del certificado que dice a quién pertenece (CUIT, organización). |
| **PV** | Punto de Venta. Cada PV tiene su propia secuencia de numeración. |
| **CbteTipo** | Código numérico AFIP del tipo de comprobante. Factura A = 1, B = 6, NCA = 3, etc. |
| **Concepto** | Tipo de operación: 1=Productos, 2=Servicios, 3=Ambos. |
| **CondicionIVAReceptor** | Campo obligatorio desde RG 5616/2024: 1=RI, 4=Exento, 5=CF, 6=Mono. |

---

## 12. Anexo: estructura de archivos del módulo

### Backend

```
backend/
├── alembic/versions/
│   ├── 20260423100000_create_facturas.py
│   └── 20260423110000_add_estado_pago_factura.py
├── app/
│   ├── api/v1/endpoints/facturas.py        ← endpoints REST
│   ├── core/config.py                      ← settings empresa + AFIP
│   ├── integrations/afip/
│   │   ├── exceptions.py
│   │   ├── types.py                        ← DTOs SolicitudCae, RespuestaCae
│   │   ├── wsaa.py                         ← cliente WSAA
│   │   └── wsfev1.py                       ← cliente WSFEv1
│   ├── models/factura.py                   ← Factura, FacturaDetalle, enums
│   ├── schemas/factura.py                  ← Pydantic
│   ├── services/
│   │   ├── factura_service.py              ← lógica de negocio
│   │   └── factura_pdf_service.py          ← generación PDF + QR
│   └── templates/factura.html              ← template Jinja del PDF
├── scripts/
│   ├── fix_alembic_heads.py                ← consolida alembic_version
│   └── generar_csr_arca.sh                 ← genera CSR + key
├── afip_homologacion/                      ← gitignored
│   ├── afip.key
│   ├── afip.csr
│   └── afip.crt (cuando llega de ARCA)
└── afip_produccion/                        ← gitignored
    ├── afip.key
    ├── afip.csr
    └── afip.crt
```

### Frontend

```
frontend/src/
├── pages/facturacion/
│   ├── FacturasListPage.tsx                ← listado con tabs
│   ├── FacturaDetailPage.tsx               ← detalle + emitir + cobrar
│   ├── PedidosPendientesPanel.tsx          ← cola de pedidos
│   ├── NotaCreditoFormPage.tsx
│   └── NotaDebitoFormPage.tsx
├── services/facturaService.ts
└── types/factura.ts
```

---

## 13. Checklist final

Antes de marcar "facturación operativa" hay que tener:

### En ARCA
- [ ] PV "RECE para web services" creado y activo (DUWHITE: PV 2)
- [ ] Habilitación de Factura A activa (en su régimen correspondiente)
- [ ] (Si aplica) CBU informada al solicitar la habilitación
- [ ] Certificado `.crt` de **homologación** descargado y asociado a wsfe
- [ ] Certificado `.crt` de **producción** descargado y asociado a wsfe

### En Railway
- [ ] Variables de empresa cargadas (CUIT, razón social, domicilio, etc.)
- [ ] Variables AFIP cargadas (entorno, PV, paths)
- [ ] Variables CBU cargadas (si aplica régimen 1575/03)
- [ ] Secret Files `/secrets/afip.crt` y `/secrets/afip.key`
  (los de homologación primero)
- [ ] Container booteando OK y migraciones aplicadas

### Pruebas en homologación
- [ ] `/facturas/estado-arca` muestra todos los checks en verde
- [ ] Emitir Factura A → CAE recibido + PDF correcto + bloque CBU visible
- [ ] Emitir Factura B → CAE recibido + PDF correcto sin bloque CBU
- [ ] Emitir Nota de Crédito total → factura original queda `anulada`
- [ ] Registrar cobro → factura pasa a `pagada` y baja saldo cta cte

### Pasaje a producción
- [ ] Reemplazados los Secret Files por los de producción
- [ ] `AFIP_ENTORNO=produccion`
- [ ] Cache WSAA limpio (`/tmp/duwhite/afip/*` borrado)
- [ ] `/facturas/estado-arca` verde apuntando a producción
- [ ] Primera factura de monto bajo emitida y validada en
      `https://servicios1.afip.gov.ar/comprobantes-electronicos/`

✅ Una vez completos todos los checks, el módulo está **100% operativo**.
