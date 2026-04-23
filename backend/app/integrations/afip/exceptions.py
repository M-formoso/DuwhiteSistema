"""Excepciones específicas de la integración AFIP."""

from typing import List, Optional


class AfipError(Exception):
    """Error genérico de AFIP (red, certificado, respuesta malformada)."""


class AfipAuthError(AfipError):
    """Falló la obtención del ticket WSAA (token + sign)."""


class AfipRechazoError(AfipError):
    """AFIP devolvió resultado 'R' (rechazado)."""

    def __init__(
        self,
        mensaje: str,
        errores: Optional[List] = None,
        observaciones: Optional[List] = None,
    ):
        super().__init__(mensaje)
        self.errores = errores or []
        self.observaciones = observaciones or []


class AfipObservacionError(AfipError):
    """AFIP aceptó el comprobante pero con observaciones relevantes."""

    def __init__(self, mensaje: str, observaciones: list):
        super().__init__(mensaje)
        self.observaciones = observaciones
