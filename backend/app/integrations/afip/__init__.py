"""Integración con AFIP (WSAA + WSFEv1).

Los submódulos `wsaa` y `wsfev1` requieren dependencias externas (zeep, lxml,
cryptography). Para evitar fallas de import cuando esas libs no están
presentes, no se re-exportan eagerly — cada consumidor debe importar directo
del submódulo que necesita:

    from app.integrations.afip.wsfev1 import WsfeClient
    from app.integrations.afip.exceptions import AfipError
"""
