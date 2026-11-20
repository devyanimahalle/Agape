import math
from datetime import datetime, timezone

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.db.models import Listing
from app.listings import config


def utc(dt: datetime) -> datetime:
    """Treat naive datetimes as UTC; convert aware ones to UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def iso(dt: datetime | None) -> str | None:
    return None if dt is None else utc(dt).isoformat().replace("+00:00", "Z")


def estimate(quantity: float, unit: str) -> tuple[int, float]:
    """Return (est_meals, est_kg). These are ESTIMATES based on config.MEAL_KG."""
    if unit == "kg":
        est_kg = quantity
        est_meals = quantity / config.MEAL_KG
    else:  # portions
        est_meals = quantity
        est_kg = quantity * config.MEAL_KG
    return int(math.floor(est_meals + 0.5)), round(est_kg, 2)


def listing_out(listing: Listing) -> dict:
    out = {c.name: getattr(listing, c.name) for c in listing.__table__.columns}
    for key in ("window_start", "window_end", "reserved_at", "completed_at", "created_at"):
        out[key] = iso(out[key])
    return out


def expire_listings(db: Session, now: datetime | None = None) -> int:
    """Mark `listed` listings whose window_end has passed as `expired`.
    Reserved listings are left alone (deviation D9). Idempotent and safe to
    run from several workers at once."""
    now = now or datetime.now(timezone.utc)
    result = db.execute(
        update(Listing)
        .where(Listing.status == "listed", Listing.window_end < now)
        .values(status="expired")
    )
    db.commit()
    return result.rowcount
