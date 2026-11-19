"""Shared constants and helpers for the reservations tests."""
from datetime import datetime, timezone

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
PDF = b"%PDF-1.4\n" + b"0" * 64
DELHI = (28.6139, 77.2090)


def now():
    return datetime.now(timezone.utc)


def h(user):
    """Auth header understood by the test app's dependency override."""
    return {"X-User-Id": str(user.id)}
