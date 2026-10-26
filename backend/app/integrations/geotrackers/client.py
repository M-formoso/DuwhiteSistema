"""
Cliente de la API REST de GeoTrackers (geolocalización de la flota).

La API tiene dos restricciones duras que este cliente respeta:
- Rate limit: 6 segundos mínimos entre requests al mismo endpoint. Si no
  se respeta, GeoTrackers responde HTTP 429 y consume un crédito igual.
- Créditos limitados: cada request consume 1 crédito. Hay que cachear.

Para evitar quemar créditos y respetar el rate limit, mantenemos una
caché TTL in-memory por endpoint:

- ubicaciones / listado de dispositivos → TTL corto (10s) para que la UI
  pueda refrescar seguido sin saturar.
- historial → TTL moderado (60s) por el combo de parámetros (id + rango).

El rate limit (6s mínimos entre consultas al MISMO endpoint) se cumple
automáticamente porque mientras el cache esté caliente devolvemos el
cacheado y no hay request real a GeoTrackers.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any, Dict, Optional

import requests

from app.core.config import settings


logger = logging.getLogger(__name__)


class GeoTrackersError(Exception):
    """Error genérico del cliente GeoTrackers."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class _TTLCache:
    """Cache sencilla key→(expira_at, value) con locking."""

    def __init__(self) -> None:
        self._store: Dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            item = self._store.get(key)
            if not item:
                return None
            expira_at, value = item
            if expira_at < time.time():
                self._store.pop(key, None)
                return None
            return value

    def set(self, key: str, value: Any, ttl_segundos: float) -> None:
        with self._lock:
            self._store[key] = (time.time() + ttl_segundos, value)

    def invalidate(self, prefix: Optional[str] = None) -> None:
        with self._lock:
            if prefix is None:
                self._store.clear()
                return
            for k in list(self._store.keys()):
                if k.startswith(prefix):
                    self._store.pop(k, None)


_cache = _TTLCache()


# TTLs por endpoint (segundos). Más alto = menos créditos quemados.
# Pensado para el flujo real: el mapa refresca cada 15s; con TTL 10s una
# vez cada ~15s se dispara request real.
TTL_UBICACIONES = 10
TTL_LISTADO = 60
TTL_INFO_VEHICULO = 60
TTL_HISTORIAL = 60


def _request(path: str, params: Optional[Dict[str, Any]] = None, ttl: float = 10.0) -> Dict[str, Any]:
    """
    Hace GET a la API de GeoTrackers con cache TTL.

    Devuelve el JSON crudo tal como lo manda la API (incluye claves
    `success`, `data`, `creditos` y, cuando corresponde, `pagination`).

    Lanza GeoTrackersError con status_code en 4xx/5xx. Si no hay API key
    configurada, lanza antes de hacer el request.
    """
    if not settings.GEOTRACKERS_API_KEY:
        raise GeoTrackersError(
            "GEOTRACKERS_API_KEY no está configurada en el servidor",
            status_code=503,
        )

    # Cache key = path + params ordenados
    param_part = "&".join(f"{k}={v}" for k, v in sorted((params or {}).items()))
    cache_key = f"{path}?{param_part}"

    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    url = f"{settings.GEOTRACKERS_BASE_URL.rstrip('/')}/{path.lstrip('/')}"
    headers = {"X-API-Key": settings.GEOTRACKERS_API_KEY}

    try:
        resp = requests.get(url, params=params, headers=headers, timeout=15)
    except requests.RequestException as exc:
        logger.exception("GeoTrackers: fallo de red consultando %s", path)
        raise GeoTrackersError(f"No se pudo conectar con GeoTrackers: {exc}", status_code=503)

    if resp.status_code == 429:
        retry_after = resp.headers.get("Retry-After", "6")
        logger.warning("GeoTrackers rate limit — Retry-After %s", retry_after)
        raise GeoTrackersError(
            f"GeoTrackers aplicó rate limit (reintentar en {retry_after}s)",
            status_code=429,
        )

    if resp.status_code >= 400:
        detalle = resp.text[:300]
        logger.warning("GeoTrackers %s %s → %s: %s", path, params, resp.status_code, detalle)
        raise GeoTrackersError(
            f"GeoTrackers respondió {resp.status_code}: {detalle}",
            status_code=resp.status_code,
        )

    try:
        payload = resp.json()
    except ValueError:
        raise GeoTrackersError("Respuesta no-JSON de GeoTrackers", status_code=502)

    if not payload.get("success", False):
        error = payload.get("error", {})
        raise GeoTrackersError(
            error.get("message") or "GeoTrackers reportó error sin mensaje",
            status_code=400,
        )

    _cache.set(cache_key, payload, ttl_segundos=ttl)
    return payload


# ==================== API pública ====================


def listar_dispositivos(limit: int = 50, offset: int = 0) -> Dict[str, Any]:
    """Listado de vehículos del cliente autenticado."""
    return _request(
        "/dispositivos",
        params={"limit": limit, "offset": offset},
        ttl=TTL_LISTADO,
    )


def info_dispositivo(dispositivo_id: int) -> Dict[str, Any]:
    """Datos de un vehículo por ID."""
    return _request(f"/dispositivos/{dispositivo_id}", ttl=TTL_INFO_VEHICULO)


def ubicacion_dispositivo(dispositivo_id: int) -> Dict[str, Any]:
    """Última ubicación GPS de un vehículo por ID."""
    return _request(f"/dispositivos/{dispositivo_id}/ubicacion", ttl=TTL_UBICACIONES)


def historial_dispositivo(
    dispositivo_id: int,
    desde: str,
    hasta: str,
    limit: int = 100,
    offset: int = 0,
) -> Dict[str, Any]:
    """
    Historial de posiciones de un vehículo entre dos fechas.

    ``desde``/``hasta`` admiten `YYYY-MM-DD` (día completo) o
    `YYYY-MM-DD HH:MM:SS` (momento exacto).
    """
    return _request(
        f"/dispositivos/{dispositivo_id}/historial",
        params={"desde": desde, "hasta": hasta, "limit": limit, "offset": offset},
        ttl=TTL_HISTORIAL,
    )


def ubicaciones_todos(limit: int = 200, offset: int = 0) -> Dict[str, Any]:
    """
    Ubicación actual de TODOS los vehículos (hasta 200 por página).
    Este es el endpoint que alimenta el mapa principal — una sola llamada
    y devuelve toda la flota.
    """
    return _request(
        "/dispositivos/ubicaciones",
        params={"limit": limit, "offset": offset},
        ttl=TTL_UBICACIONES,
    )


def invalidar_cache() -> None:
    """Limpiar toda la cache (debug / tests)."""
    _cache.invalidate()
