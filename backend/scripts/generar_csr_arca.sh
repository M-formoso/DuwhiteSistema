#!/usr/bin/env bash
# Genera clave privada + CSR para solicitar el certificado de WSFEv1 ante ARCA.
# Datos hardcodeados a DUWHITE S.R.L. (CUIT 30719255694).
#
# Uso:
#   ./generar_csr_arca.sh [homologacion|produccion]
#
# Después:
#   1. Subir el .csr al portal ARCA (o WSASS para homologación):
#      - Homologación: https://wsass-homo.afip.gob.ar/wsass/portal
#      - Producción: portal ARCA → Administrador de Relaciones de Clave Fiscal
#        → Nuevo Servicio → "wsfe - Facturación Electrónica" → subir CSR
#   2. ARCA devuelve un .crt → guardarlo junto a la .key.
#   3. Subir .crt y .key como Secret Files a Railway:
#      AFIP_CERT_PATH=/secrets/afip.crt
#      AFIP_KEY_PATH=/secrets/afip.key

set -e

ENTORNO="${1:-homologacion}"
CUIT="30719255694"
RAZON_SOCIAL="DUWHITE S.R.L."
CN="duwhite-wsfe-${ENTORNO}"

OUT_DIR="$(pwd)/afip_${ENTORNO}"
mkdir -p "${OUT_DIR}"

KEY="${OUT_DIR}/afip.key"
CSR="${OUT_DIR}/afip.csr"

if [[ -f "${KEY}" ]]; then
  echo "⚠️  Ya existe ${KEY}. Si querés regenerarlo, borralo primero."
  exit 1
fi

echo "→ Generando clave privada (RSA 2048) en ${KEY}"
openssl genrsa -out "${KEY}" 2048
chmod 600 "${KEY}"

echo "→ Generando CSR en ${CSR}"
openssl req -new -key "${KEY}" \
  -subj "/C=AR/O=${RAZON_SOCIAL}/CN=${CN}/serialNumber=CUIT ${CUIT}" \
  -out "${CSR}"

echo
echo "✅ Listo."
echo
echo "Archivos:"
echo "  ${KEY}    (clave privada — NO compartir)"
echo "  ${CSR}    (subir esto al portal ARCA)"
echo
echo "Próximos pasos:"
if [[ "${ENTORNO}" == "homologacion" ]]; then
  echo "  1. Ir a https://wsass-homo.afip.gob.ar/wsass/portal"
  echo "     (loguearte con la clave fiscal de Nicola Jeremias)"
  echo "  2. Crear un alias y pegar el contenido de ${CSR}"
  echo "  3. Asociar al servicio 'wsfe' (Web Service de Factura Electrónica)"
  echo "  4. Descargar el .crt → guardar en ${OUT_DIR}/afip.crt"
else
  echo "  1. Ir a ARCA → Administrador de Relaciones de Clave Fiscal"
  echo "     → Nueva Relación → Web Services → Computador Fiscal"
  echo "  2. Subir ${CSR} y descargar el .crt"
  echo "  3. Volver a Administrador de Relaciones → asociar el servicio"
  echo "     'wsfe - Facturación Electrónica' al certificado recién creado"
  echo "  4. Guardar el .crt en ${OUT_DIR}/afip.crt"
fi
echo
echo "  5. En Railway → servicio backend → Variables → Secret Files:"
echo "       /secrets/afip.crt  ← contenido de afip.crt"
echo "       /secrets/afip.key  ← contenido de afip.key"
echo "     Y asegurarse que estén:"
echo "       AFIP_ENTORNO=${ENTORNO}"
echo "       AFIP_CERT_PATH=/secrets/afip.crt"
echo "       AFIP_KEY_PATH=/secrets/afip.key"
