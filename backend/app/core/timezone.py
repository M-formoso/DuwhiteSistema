"""
Helpers de timezone para Argentina.

El servidor corre en UTC (Railway). Usar `date.today()` o `datetime.now()`
sin timezone devuelve la fecha/hora del server (UTC), lo que hace que
entre las 21:00-23:59 hora ARG los defaults queden con el día siguiente.

Reglas de uso:
- Para setear fechas de operaciones (fecha_pedido, fecha_emision,
  fecha_movimiento, fecha_alta, etc.) usar `today_ar()`.
- Para timestamps de "hora actual" usar `now_ar()` (aware con tz ARG).
- Para persistir en columnas `DateTime` naive que representan UTC, usar
  `now_utc_naive()` — es equivalente al viejo `datetime.utcnow()` pero
  con el nombre explícito.
"""

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo


TZ_AR = ZoneInfo("America/Argentina/Buenos_Aires")


def now_ar() -> datetime:
    """Datetime actual con tzinfo=America/Argentina/Buenos_Aires."""
    return datetime.now(TZ_AR)


def today_ar() -> date:
    """Fecha actual según hora ARG (evita el corrimiento por UTC en Railway)."""
    return now_ar().date()


def now_utc_naive() -> datetime:
    """
    Datetime actual en UTC pero sin tzinfo (compatible con columnas
    `DateTime` naive existentes en los modelos).
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
