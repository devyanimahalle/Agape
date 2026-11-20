"""Nominatim proxy.

Follows the Nominatim usage policy (https://operations.osmfoundation.org/policies/nominatim/):
  * identifying User-Agent (configure NOMINATIM_USER_AGENT with a real contact)
  * at most 1 request per second (process-wide throttle)
  * results cached (24h) so repeated searches never hit Nominatim again
  * no autocomplete: the frontend only calls this when the user presses Search
"""
import os
import threading
import time

import httpx

from app.reservations.errors import ApiError

NOMINATIM_URL = os.environ.get("NOMINATIM_URL", "https://nominatim.openstreetmap.org/search")
USER_AGENT = os.environ.get(
    "NOMINATIM_USER_AGENT", "SharePlate/1.0 (food surplus platform; contact: set NOMINATIM_USER_AGENT)"
)
COUNTRY_CODES = os.environ.get("NOMINATIM_COUNTRY_CODES", "in")  # "" disables the filter
MIN_INTERVAL_S = 1.0
CACHE_TTL_S = 24 * 3600
CACHE_MAX = 500
TIMEOUT_S = 8.0

_lock = threading.Lock()
_last_call = 0.0
_cache: dict[str, tuple[float, list[dict]]] = {}


def _normalise(q: str) -> str:
    return " ".join(q.lower().split())


def _fetch(q: str) -> list[dict]:
    params = {"q": q, "format": "jsonv2", "limit": 5}
    if COUNTRY_CODES:
        params["countrycodes"] = COUNTRY_CODES
    resp = httpx.get(NOMINATIM_URL, params=params, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT_S)
    resp.raise_for_status()
    return resp.json()


def clear_cache() -> None:
    global _last_call
    with _lock:
        _cache.clear()
        _last_call = 0.0


def search(q: str) -> list[dict]:
    """Return [{label, lat, lng}] for a free-text address."""
    global _last_call
    key = _normalise(q)
    with _lock:  # serialises upstream calls, which is what enforces the 1 req/s limit
        hit = _cache.get(key)
        if hit and time.monotonic() - hit[0] < CACHE_TTL_S:
            return hit[1]
        wait = MIN_INTERVAL_S - (time.monotonic() - _last_call)
        if wait > 0:
            time.sleep(wait)
        try:
            raw = _fetch(key)
        except (httpx.HTTPError, ValueError) as exc:
            raise ApiError(502, "GEOCODER_UNAVAILABLE", "Address search is temporarily unavailable") from exc
        finally:
            _last_call = time.monotonic()
        results = []
        for item in raw:
            try:
                results.append(
                    {"label": item["display_name"], "lat": float(item["lat"]), "lng": float(item["lon"])}
                )
            except (KeyError, TypeError, ValueError):
                continue
        if len(_cache) >= CACHE_MAX:
            _cache.pop(next(iter(_cache)))
        _cache[key] = (time.monotonic(), results)
        return results
