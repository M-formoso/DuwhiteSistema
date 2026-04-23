"""
WSAA — autenticación AFIP.

Flujo:
  1. Se genera un TRA (XML con loginTicketRequest).
  2. Se firma con el certificado .crt + clave .key emitidos por AFIP (CMS/PKCS7).
  3. Se envía a WSAA LoginCms → responde (token, sign) válido 12h.
  4. Se cachea en disco hasta cerca del vencimiento.

Notas:
  - Certificado y clave privada se cargan desde rutas configuradas en settings.
  - La firma CMS se hace con `cryptography.hazmat.primitives.serialization.pkcs7`.
  - El cache usa un archivo JSON con token/sign/expiration_time.
"""

from __future__ import annotations

import base64
import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from lxml import etree
import zeep
from zeep.transports import Transport

from app.core.config import settings
from app.integrations.afip.exceptions import AfipAuthError, AfipError

logger = logging.getLogger(__name__)


# Renueva el ticket si le quedan menos de este delta
MARGEN_RENOVACION = timedelta(minutes=5)
TICKET_TTL_HOURS = 12


@dataclass
class TicketAcceso:
    token: str
    sign: str
    expiration_time: datetime  # UTC

    def esta_vencido(self) -> bool:
        return datetime.now(timezone.utc) >= (self.expiration_time - MARGEN_RENOVACION)

    def to_dict(self) -> dict:
        return {
            "token": self.token,
            "sign": self.sign,
            "expiration_time": self.expiration_time.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "TicketAcceso":
        return cls(
            token=data["token"],
            sign=data["sign"],
            expiration_time=datetime.fromisoformat(data["expiration_time"]),
        )


# ==================== CACHE ====================


def _cache_path(service: str) -> str:
    os.makedirs(settings.AFIP_CACHE_DIR, exist_ok=True)
    return os.path.join(
        settings.AFIP_CACHE_DIR, f"wsaa_{settings.AFIP_ENTORNO}_{service}.json"
    )


def _load_cache(service: str) -> Optional[TicketAcceso]:
    path = _cache_path(service)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return TicketAcceso.from_dict(json.load(f))
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        logger.warning("Cache WSAA inválido en %s: %s", path, exc)
        return None


def _save_cache(service: str, ticket: TicketAcceso) -> None:
    path = _cache_path(service)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(ticket.to_dict(), f)


# ==================== TRA ====================


def _generar_tra(service: str) -> bytes:
    """Genera el XML LoginTicketRequest (TRA) para el servicio pedido (ej: 'wsfe')."""
    ahora = datetime.now(timezone.utc)
    desde = ahora - timedelta(minutes=5)
    hasta = ahora + timedelta(hours=TICKET_TTL_HOURS)

    root = etree.Element("loginTicketRequest", version="1.0")
    header = etree.SubElement(root, "header")
    etree.SubElement(header, "uniqueId").text = str(int(ahora.timestamp()))
    etree.SubElement(header, "generationTime").text = desde.isoformat(timespec="seconds")
    etree.SubElement(header, "expirationTime").text = hasta.isoformat(timespec="seconds")
    etree.SubElement(root, "service").text = service

    return etree.tostring(root, xml_declaration=True, encoding="UTF-8")


def _firmar_cms(tra_xml: bytes) -> bytes:
    """Firma el TRA con el certificado + clave en formato CMS/PKCS7 (DER)."""
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.serialization import pkcs7
        from cryptography import x509
    except ImportError as exc:  # pragma: no cover
        raise AfipAuthError(f"Falta la lib 'cryptography': {exc}")

    if not settings.AFIP_CERT_PATH or not settings.AFIP_KEY_PATH:
        raise AfipAuthError(
            "AFIP_CERT_PATH / AFIP_KEY_PATH no configurados — imposible firmar el TRA."
        )
    if not os.path.exists(settings.AFIP_CERT_PATH):
        raise AfipAuthError(f"Certificado no encontrado: {settings.AFIP_CERT_PATH}")
    if not os.path.exists(settings.AFIP_KEY_PATH):
        raise AfipAuthError(f"Clave privada no encontrada: {settings.AFIP_KEY_PATH}")

    with open(settings.AFIP_CERT_PATH, "rb") as f:
        cert = x509.load_pem_x509_certificate(f.read())

    with open(settings.AFIP_KEY_PATH, "rb") as f:
        private_key = serialization.load_pem_private_key(f.read(), password=None)

    cms = (
        pkcs7.PKCS7SignatureBuilder()
        .set_data(tra_xml)
        .add_signer(cert, private_key, hashes.SHA256())
        .sign(serialization.Encoding.DER, [pkcs7.PKCS7Options.Binary])
    )
    return cms


# ==================== LLAMADA A WSAA ====================


def _llamar_wsaa(cms_der: bytes) -> dict:
    """Envía el CMS firmado a WSAA y devuelve el XML de respuesta parseado."""
    try:
        transport = Transport(timeout=30)
        client = zeep.Client(settings.AFIP_WSAA_URL, transport=transport)
        cms_b64 = base64.b64encode(cms_der).decode("ascii")
        response_xml = client.service.loginCms(cms_b64)
    except Exception as exc:
        raise AfipAuthError(f"Error llamando a WSAA: {exc}") from exc

    try:
        root = etree.fromstring(response_xml.encode("utf-8") if isinstance(response_xml, str) else response_xml)
        credentials = root.find(".//credentials")
        if credentials is None:
            raise AfipAuthError(f"Respuesta WSAA sin credentials: {response_xml[:500]}")

        token_el = credentials.find("token")
        sign_el = credentials.find("sign")
        exp_el = root.find(".//expirationTime")

        if token_el is None or sign_el is None or exp_el is None:
            raise AfipAuthError(f"Respuesta WSAA incompleta: {response_xml[:500]}")

        exp = datetime.fromisoformat(exp_el.text)
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        else:
            exp = exp.astimezone(timezone.utc)

        return {
            "token": token_el.text,
            "sign": sign_el.text,
            "expiration_time": exp,
        }
    except AfipAuthError:
        raise
    except Exception as exc:
        raise AfipAuthError(f"Error parseando respuesta WSAA: {exc}") from exc


# ==================== API PÚBLICA ====================


def obtener_ticket_acceso(service: str = "wsfe", force_refresh: bool = False) -> TicketAcceso:
    """
    Obtiene un ticket WSAA válido para ``service`` (por default ``wsfe``).

    Se apoya en un cache local por (entorno, servicio). Si hay uno vigente lo
    devuelve; si no, genera un TRA, lo firma y lo cambia por un nuevo ticket.
    """
    if not force_refresh:
        cached = _load_cache(service)
        if cached and not cached.esta_vencido():
            return cached

    tra = _generar_tra(service)
    cms = _firmar_cms(tra)
    datos = _llamar_wsaa(cms)

    ticket = TicketAcceso(
        token=datos["token"],
        sign=datos["sign"],
        expiration_time=datos["expiration_time"],
    )
    _save_cache(service, ticket)
    return ticket
