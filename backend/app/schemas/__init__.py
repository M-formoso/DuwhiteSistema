# Schemas module

from datetime import date


def parse_date_without_timezone(v):
    """
    Parsea fecha asegurando que no haya conversión de timezone.
    Útil para validadores de Pydantic que reciben fechas del frontend.

    Uso en un schema:
        @field_validator('fecha', mode='before')
        @classmethod
        def validate_date(cls, v):
            return parse_date_without_timezone(v)
    """
    if v is None:
        return None
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        # Si viene como YYYY-MM-DD, parsearlo directamente
        if len(v) == 10 and v[4] == '-' and v[7] == '-':
            return date.fromisoformat(v)
        # Si viene con tiempo (ISO format con T), tomar solo la parte de fecha
        if 'T' in v:
            return date.fromisoformat(v.split('T')[0])
    return v
