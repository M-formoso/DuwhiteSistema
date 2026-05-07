"""
Workaround SSL para hablar con AFIP.

Los servidores de ARCA/AFIP siguen usando parámetros Diffie-Hellman de 1024
bits, que las versiones modernas de OpenSSL rechazan por seguridad
(``DH_KEY_TOO_SMALL``). Bajamos el security level mediante un HTTPAdapter
de ``requests``.

El cipher tuning depende de la lib SSL del sistema:
  - OpenSSL 3.x (Linux / Railway): acepta ``DEFAULT@SECLEVEL=0``.
  - LibreSSL 2.x (macOS): no soporta ``@SECLEVEL`` y tira "No cipher can be
    selected"; en ese caso dejamos el contexto default. AFIP a través de
    LibreSSL puede o no funcionar — pero Railway corre Linux/OpenSSL.

Uso:
    from app.integrations.afip.ssl_helper import crear_session_afip
    session = crear_session_afip()
    transport = Transport(session=session, timeout=30)
"""

from __future__ import annotations

import logging
import ssl

import requests
from requests.adapters import HTTPAdapter

logger = logging.getLogger(__name__)

_CIPHER_FALLBACKS = (
    "DEFAULT@SECLEVEL=0",
    "DEFAULT@SECLEVEL=1",
    "ALL:@SECLEVEL=0",
)


class _AfipSSLAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.create_default_context()
        # Algunos servers AFIP requieren legacy renegotiation (Python 3.12+)
        for opt_name in ("OP_LEGACY_SERVER_CONNECT", "OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION"):
            opt = getattr(ssl, opt_name, None)
            if opt is not None:
                ctx.options |= opt
        # Probar cipher strings hasta encontrar uno aceptado por la lib SSL local
        for ciphers in _CIPHER_FALLBACKS:
            try:
                ctx.set_ciphers(ciphers)
                logger.debug("AFIP SSL: ciphers=%s aceptado", ciphers)
                break
            except ssl.SSLError:
                continue
        else:
            logger.warning("AFIP SSL: ningún cipher fallback funcionó, queda default")
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)


def crear_session_afip() -> requests.Session:
    s = requests.Session()
    s.mount("https://", _AfipSSLAdapter())
    return s
