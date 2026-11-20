"""Reservation business logic (rules 4-7 of the contract).

Every state change is a single conditional UPDATE (or a row lock) so concurrent requests can
never both succeed. Callers pass a SQLAlchemy Session; this module commits.
"""
from datetime import datetime, timezone

from fastapi import UploadFile
from sqlalchemy import case, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Listing, NgoProfile, Proof, ProviderProfile, Rating
from app.reservations import storage
from app.reservations.errors import ApiError
from app.reservations.geo import haversine_km

RATEABLE_CATEGORIES = ("restaurant", "caterer")
LISTING_STATUSES = ("listed", "reserved", "completed", "cancelled", "expired")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _load(db: Session, listing_id: int, lock: bool = False) -> Listing | None:
    stmt = select(Listing).where(Listing.id == listing_id).execution_options(populate_existing=True)
    if lock:
        stmt = stmt.with_for_update()
    return db.execute(stmt).scalar_one_or_none()


def _not_found() -> ApiError:
    return ApiError(404, "NOT_FOUND", "Listing not found")


# ---------------------------------------------------------------- board

def get_board(db: Session, lat: float, lng: float, now: datetime | None = None) -> list[dict]:
    now = now or now_utc()
    rows = db.execute(
        select(Listing, ProviderProfile)
        .join(ProviderProfile, ProviderProfile.user_id == Listing.provider_id)
        .where(Listing.status == "listed", Listing.window_end > now)
    ).all()
    items = []
    for listing, provider in rows:
        distance = None
        if listing.lat is not None and listing.lng is not None:
            distance = round(haversine_km(lat, lng, listing.lat, listing.lng), 2)
        rateable = provider.category in RATEABLE_CATEGORIES
        items.append(
            {
                "listing": listing,
                "distance_km": distance,
                "org_name": provider.org_name,
                "provider_category": provider.category,
                "rating_avg": provider.rating_avg if rateable else None,
                "rating_count": provider.rating_count if rateable else 0,
            }
        )
    items.sort(
        key=lambda i: (
            i["distance_km"] is None,
            i["distance_km"] or 0.0,
            _aware(i["listing"].window_end),
            i["listing"].id,
        )
    )
    return items


def ngo_location(db: Session, ngo_id: int) -> tuple[float, float] | None:
    profile = db.get(NgoProfile, ngo_id)
    if profile and profile.lat is not None and profile.lng is not None:
        return profile.lat, profile.lng
    return None


# ---------------------------------------------------------------- reserve

def reserve_listing(db: Session, ngo_id: int, listing_id: int, now: datetime | None = None) -> Listing:
    """ATOMIC listed -> reserved. Exactly one concurrent caller gets rowcount == 1; others get 409."""
    now = now or now_utc()
    result = db.execute(
        update(Listing)
        .where(Listing.id == listing_id, Listing.status == "listed", Listing.window_end > now)
        .values(status="reserved", reserved_by_ngo_id=ngo_id, reserved_at=now)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount == 1:
        db.commit()
        return _load(db, listing_id)

    db.rollback()
    listing = _load(db, listing_id)
    if listing is None:
        raise _not_found()
    if listing.status == "listed":  # still listed, so the window must have closed
        db.execute(
            update(Listing)
            .where(Listing.id == listing_id, Listing.status == "listed", Listing.window_end <= now)
            .values(status="expired")
            .execution_options(synchronize_session=False)
        )
        db.commit()
        raise ApiError(409, "LISTING_EXPIRED", "The collection window for this listing has ended")
    raise ApiError(409, "ALREADY_RESERVED", "This listing is no longer available")


# ---------------------------------------------------------------- cancel

def cancel_reservation(db: Session, ngo_id: int, listing_id: int, now: datetime | None = None) -> Listing:
    now = now or now_utc()
    result = db.execute(
        update(Listing)
        .where(Listing.id == listing_id, Listing.status == "reserved", Listing.reserved_by_ngo_id == ngo_id)
        .values(
            status=case((Listing.window_end > now, "listed"), else_="expired"),
            reserved_by_ngo_id=None,
            reserved_at=None,
        )
        .execution_options(synchronize_session=False)
    )
    if result.rowcount == 1:
        db.commit()
        return _load(db, listing_id)

    db.rollback()
    listing = _load(db, listing_id)
    if listing is None:
        raise _not_found()
    if listing.reserved_by_ngo_id is not None and listing.reserved_by_ngo_id != ngo_id:
        raise ApiError(403, "FORBIDDEN", "You did not reserve this listing")
    raise ApiError(409, "INVALID_STATE", "Only a reserved listing can be cancelled")


# ---------------------------------------------------------------- complete

def complete_pickup(
    db: Session, ngo_id: int, listing_id: int, files: list[UploadFile], note: str | None
) -> Listing:
    files = [f for f in files if f is not None and getattr(f, "filename", None)]
    listing = _load(db, listing_id, lock=True)  # row lock: a second completion waits, then sees "completed"
    if listing is None:
        db.rollback()
        raise _not_found()
    if listing.status != "reserved":
        db.rollback()
        raise ApiError(409, "INVALID_STATE", "Only a reserved listing can be completed")
    if listing.reserved_by_ngo_id != ngo_id:
        db.rollback()
        raise ApiError(403, "FORBIDDEN", "You did not reserve this listing")
    if not files:
        db.rollback()
        raise ApiError(400, "PROOF_REQUIRED", "Upload at least one proof (photo or letter) to complete pickup")

    saved_paths: list[str] = []
    try:
        for upload in files:
            doc = storage.save_proof_file(db, ngo_id, upload)
            saved_paths.append(doc.private_path)
            db.add(Proof(listing_id=listing_id, ngo_id=ngo_id, document_id=doc.id, note=note))
        listing.status = "completed"
        listing.completed_at = now_utc()
        db.commit()
    except Exception:
        db.rollback()
        for path in saved_paths:
            storage.delete_file(path)
        raise
    return _load(db, listing_id)


# ---------------------------------------------------------------- my reservations

def my_reservations(db: Session, ngo_id: int, status: str | None) -> list[dict]:
    stmt = (
        select(Listing, ProviderProfile)
        .join(ProviderProfile, ProviderProfile.user_id == Listing.provider_id)
        .where(Listing.reserved_by_ngo_id == ngo_id)
        .order_by(Listing.reserved_at.desc(), Listing.id.desc())
    )
    if status:
        stmt = stmt.where(Listing.status == status)
    rows = db.execute(stmt).all()
    rated_ids = set(
        db.execute(
            select(Rating.listing_id).where(
                Rating.kind == "ngo_to_provider", Rating.listing_id.in_([row.id for row, _ in rows] or [0])
            )
        ).scalars()
    )
    return [
        {
            "listing": listing,
            "org_name": provider.org_name,
            "provider_category": provider.category,
            "has_rated": listing.id in rated_ids,
        }
        for listing, provider in rows
    ]


# ---------------------------------------------------------------- rate provider

def rate_provider(db: Session, ngo_id: int, listing_id: int, stars: int, comment: str | None) -> dict:
    listing = _load(db, listing_id, lock=True)
    if listing is None:
        db.rollback()
        raise _not_found()
    if listing.reserved_by_ngo_id != ngo_id:
        db.rollback()
        raise ApiError(403, "FORBIDDEN", "You did not reserve this listing")
    if listing.status != "completed":
        db.rollback()
        raise ApiError(409, "INVALID_STATE", "You can rate a provider only after pickup is completed")

    provider = db.execute(
        select(ProviderProfile).where(ProviderProfile.user_id == listing.provider_id).with_for_update()
    ).scalar_one()
    if provider.category not in RATEABLE_CATEGORIES:
        db.rollback()
        raise ApiError(400, "NOT_RATEABLE", "This provider is not rated")

    already = db.execute(
        select(Rating.id).where(Rating.listing_id == listing_id, Rating.kind == "ngo_to_provider")
    ).first()
    if already:
        db.rollback()
        raise ApiError(409, "ALREADY_RATED", "You have already rated this pickup")

    db.add(Rating(listing_id=listing_id, kind="ngo_to_provider", stars=stars, comment=comment))
    try:
        db.flush()
    except IntegrityError:  # UNIQUE(listing_id, kind) is the last line of defence
        db.rollback()
        raise ApiError(409, "ALREADY_RATED", "You have already rated this pickup")

    avg, count = db.execute(
        select(func.avg(Rating.stars), func.count(Rating.id))
        .join(Listing, Listing.id == Rating.listing_id)
        .where(Listing.provider_id == provider.user_id, Rating.kind == "ngo_to_provider")
    ).one()
    provider.rating_avg = round(float(avg), 2)
    provider.rating_count = int(count)
    db.commit()
    return {
        "listing_id": listing_id,
        "stars": stars,
        "comment": comment,
        "provider_rating_avg": provider.rating_avg,
        "provider_rating_count": provider.rating_count,
    }


# ---------------------------------------------------------------- expiry job

def expire_overdue(db: Session, now: datetime | None = None) -> int:
    """Rule 6: `listed` listings past window_end become `expired`. Returns how many changed.

    Reserved listings are deliberately left alone so an NGO that picked up near the end of the
    window can still upload proof; if they cancel, cancel_reservation() expires the listing.
    """
    now = now or now_utc()
    result = db.execute(
        update(Listing)
        .where(Listing.status == "listed", Listing.window_end <= now)
        .values(status="expired")
        .execution_options(synchronize_session=False)
    )
    db.commit()
    return result.rowcount
