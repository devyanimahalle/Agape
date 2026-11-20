from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.auth.dependencies import require_verified_role
from app.db.models import Listing, ProviderProfile, User
from app.db.session import get_db
from app.errors import AppError
from app.listings.schemas import ListingCreate, ListingPatch
from app.listings.service import estimate, listing_out, utc

router = APIRouter(prefix="/listings", tags=["listings"])

STATUSES = {"listed", "reserved", "completed", "cancelled", "expired"}

# Every provider (restaurant, caterer or general) must be admin-approved before creating or viewing listings.
provider_dep = require_verified_role("provider")


def _own_listing(db: Session, listing_id: int, user: User) -> Listing:
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise AppError(404, "NOT_FOUND", "Listing not found")
    if listing.provider_id != user.id:
        raise AppError(403, "NOT_OWNER", "You can only change your own listings")
    return listing


def _not_editable() -> AppError:
    return AppError(409, "LISTING_NOT_EDITABLE", "Only listings with status 'listed' can be changed")


@router.post("", status_code=201)
def create_listing(
    body: ListingCreate, user: User = Depends(provider_dep), db: Session = Depends(get_db)
):
    est_meals, est_kg = estimate(body.quantity, body.unit)
    listing = Listing(
        provider_id=user.id,
        title=body.title,
        food_type=body.food_type,
        quantity=body.quantity,
        unit=body.unit,
        est_meals=est_meals,
        est_kg=est_kg,
        window_start=body.window_start,
        window_end=body.window_end,
        address=body.address,
        lat=body.lat,
        lng=body.lng,
        notes=body.notes,
        status="listed",
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing_out(listing)


@router.get("/mine")
def my_listings(
    status: str | None = None,
    user: User = Depends(provider_dep),
    db: Session = Depends(get_db),
):
    if status is not None and status not in STATUSES:
        raise AppError(422, "VALIDATION_ERROR", f"status must be one of: {', '.join(sorted(STATUSES))}")
    stmt = select(Listing).where(Listing.provider_id == user.id)
    if status:
        stmt = stmt.where(Listing.status == status)
    rows = db.scalars(stmt.order_by(Listing.created_at.desc(), Listing.id.desc())).all()
    return [listing_out(r) for r in rows]


@router.get("/available")
def available_listings(user: User = Depends(provider_dep), db: Session = Depends(get_db)):
    """Open listings from the other donors (what NGOs can see on the board), so a donor can see the platform."""
    now = datetime.now(timezone.utc)
    rows = db.execute(
        select(Listing, ProviderProfile.org_name)
        .join(ProviderProfile, ProviderProfile.user_id == Listing.provider_id)
        .where(Listing.status == "listed", Listing.window_end > now, Listing.provider_id != user.id)
        .order_by(Listing.created_at.desc(), Listing.id.desc())
    ).all()
    return [{**listing_out(listing), "org_name": org_name} for listing, org_name in rows]


@router.patch("/{listing_id}")
def update_listing(
    listing_id: int,
    body: ListingPatch,
    user: User = Depends(provider_dep),
    db: Session = Depends(get_db),
):
    listing = _own_listing(db, listing_id, user)
    if listing.status != "listed":
        raise _not_editable()

    changes = body.model_dump(exclude_unset=True)
    now = datetime.now(timezone.utc)
    for key in ("window_start", "window_end"):
        if key in changes:
            changes[key] = utc(changes[key])
    start = changes.get("window_start", utc(listing.window_start))
    end = changes.get("window_end", utc(listing.window_end))
    if "window_start" in changes and start <= now:
        raise AppError(422, "VALIDATION_ERROR", "window_start must be in the future")
    if end <= now:
        raise AppError(422, "VALIDATION_ERROR", "window_end must be in the future")
    if end <= start:
        raise AppError(422, "VALIDATION_ERROR", "window_end must be after window_start")

    if "quantity" in changes or "unit" in changes:
        quantity = changes.get("quantity", listing.quantity)
        unit = changes.get("unit", listing.unit)
        changes["est_meals"], changes["est_kg"] = estimate(quantity, unit)

    # Conditional update: succeeds only if still `listed` (an NGO may have reserved meanwhile).
    result = db.execute(
        update(Listing)
        .where(Listing.id == listing_id, Listing.status == "listed")
        .values(**changes)
    )
    db.commit()
    if result.rowcount == 0:
        raise _not_editable()
    db.refresh(listing)
    return listing_out(listing)


@router.post("/{listing_id}/cancel")
def cancel_listing(
    listing_id: int, user: User = Depends(provider_dep), db: Session = Depends(get_db)
):
    listing = _own_listing(db, listing_id, user)
    if listing.status != "listed":
        raise _not_editable()
    result = db.execute(
        update(Listing)
        .where(Listing.id == listing_id, Listing.status == "listed")
        .values(status="cancelled")
    )
    db.commit()
    if result.rowcount == 0:
        raise _not_editable()
    db.refresh(listing)
    return listing_out(listing)
