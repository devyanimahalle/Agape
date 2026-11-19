"""Impact service: every figure is aggregated from the database records, never stored or hardcoded.

"Collected" means a listing whose status is `completed` (an NGO confirmed the pickup). Meals and kg are the
estimates recorded on the listing from its quantity. A collected pickup is "confirmed" once an admin has approved a
proof of donation for it. Because each call re-reads the tables, completing a pickup, approving a proof or a user,
deleting an account or resetting changes the next response.
"""
from datetime import timezone

from sqlalchemy import exists, extract, func, select
from sqlalchemy.orm import Session

try:
    from app.db.models import Listing, NgoProfile, Proof, ProviderProfile, User, VerificationRequest
except ImportError:
    from backend.app.db.models import Listing, NgoProfile, Proof, ProviderProfile, User, VerificationRequest

from . import schemas

STATUSES = ("listed", "reserved", "completed", "cancelled", "expired")
RECENT_LIMIT = 8


def _iso(dt):
    if dt is None:
        return None
    return dt.isoformat() if dt.tzinfo else dt.replace(tzinfo=timezone.utc).isoformat()  # SQLite returns naive UTC


def _proof_states(db: Session, listing_ids: list[int]) -> dict[int, str]:
    """{listing_id: none | pending | approved | rejected}, the same rule as the NGO's reservations."""
    states: dict[int, str] = {}
    if not listing_ids:
        return states
    rows = db.execute(select(Proof.listing_id, Proof.review_status).where(Proof.listing_id.in_(listing_ids))).all()
    by_listing: dict[int, list[str]] = {}
    for lid, review in rows:
        by_listing.setdefault(lid, []).append(review)
    for lid, reviews in by_listing.items():
        states[lid] = "approved" if "approved" in reviews else "pending" if "pending" in reviews else "rejected"
    return states


def _approved_proof_exists():
    return exists().where(Proof.listing_id == Listing.id, Proof.review_status == "approved")


def _recent(db: Session, *, where=(), names: bool = False, limit: int = RECENT_LIMIT) -> list[schemas.RecentPickup]:
    """Latest collected pickups. `names` adds the donor's and the NGO's organisation names (signed-in views only)."""
    stmt = (
        select(Listing, ProviderProfile.category, ProviderProfile.org_name, NgoProfile.org_name)
        .outerjoin(ProviderProfile, ProviderProfile.user_id == Listing.provider_id)
        .outerjoin(NgoProfile, NgoProfile.user_id == Listing.reserved_by_ngo_id)
        .where(Listing.status == "completed", *where)
        .order_by(Listing.completed_at.desc(), Listing.id.desc())
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    states = _proof_states(db, [r[0].id for r in rows])
    return [
        schemas.RecentPickup(
            id=listing.id, title=listing.title, food_type=listing.food_type, quantity=listing.quantity,
            unit=listing.unit, est_meals=listing.est_meals, est_kg=listing.est_kg,
            completed_at=_iso(listing.completed_at), donor_category=category,
            proof_status=states.get(listing.id, "none"),
            donor=donor_org if names else None, ngo=ngo_org if names else None,
        )
        for listing, category, donor_org, ngo_org in rows
    ]


def get_impact(db: Session) -> schemas.ImpactResponse:
    """Public figures from collected pickups, plus the status and category breakdowns and recent history."""
    row = (
        db.query(
            func.coalesce(func.sum(Listing.est_meals), 0).label("meals"),
            func.coalesce(func.sum(Listing.est_kg), 0.0).label("kg"),
            func.count(Listing.id).label("count"),
            func.count(func.distinct(Listing.reserved_by_ngo_id)).label("ngos"),
            func.count(func.distinct(Listing.provider_id)).label("providers"),
        )
        .filter(Listing.status == "completed")
        .first()
    )

    monthly_rows = (
        db.query(
            extract("year", Listing.completed_at).label("yr"),
            extract("month", Listing.completed_at).label("mo"),
            func.coalesce(func.sum(Listing.est_meals), 0).label("meals"),
            func.coalesce(func.sum(Listing.est_kg), 0.0).label("kg"),
        )
        .filter(Listing.status == "completed", Listing.completed_at.isnot(None))
        .group_by(extract("year", Listing.completed_at), extract("month", Listing.completed_at))
        .order_by(extract("year", Listing.completed_at), extract("month", Listing.completed_at))
        .all()
    )
    by_month = [
        schemas.MonthlyImpact(month=f"{int(r.yr):04d}-{int(r.mo):02d}", meals=int(r.meals), kg=float(r.kg))
        for r in monthly_rows
    ]

    confirmed = (
        db.query(func.count(Listing.id), func.coalesce(func.sum(Listing.est_meals), 0))
        .filter(Listing.status == "completed", _approved_proof_exists())
        .first()
    )

    status_rows = db.query(Listing.status, func.count(Listing.id)).group_by(Listing.status).all()
    by_status = {s: 0 for s in STATUSES}
    by_status.update({s: int(c) for s, c in status_rows})

    category = func.coalesce(ProviderProfile.category, "other")
    cat_rows = (
        db.query(
            category.label("cat"),
            func.count(Listing.id).label("n"),
            func.coalesce(func.sum(Listing.est_meals), 0).label("meals"),
            func.coalesce(func.sum(Listing.est_kg), 0.0).label("kg"),
        )
        .select_from(Listing)
        .outerjoin(ProviderProfile, ProviderProfile.user_id == Listing.provider_id)
        .filter(Listing.status == "completed")
        .group_by(category)
        .order_by(func.sum(Listing.est_meals).desc(), category)
        .all()
    )
    by_category = [schemas.CategoryImpact(category=r.cat, listings=int(r.n), meals=int(r.meals), kg=float(r.kg)) for r in cat_rows]

    verified_donors = db.query(func.count(ProviderProfile.user_id)).filter(ProviderProfile.verification_status == "approved").scalar() or 0
    verified_ngos = db.query(func.count(NgoProfile.user_id)).filter(NgoProfile.status == "approved").scalar() or 0

    return schemas.ImpactResponse(
        meals_redistributed=int(row.meals) if row else 0,
        kg_saved=float(row.kg) if row else 0.0,
        listings_completed=int(row.count) if row else 0,
        active_ngos=int(row.ngos) if row else 0,
        active_providers=int(row.providers) if row else 0,
        by_month=by_month,
        listings_confirmed=int(confirmed[0] or 0),
        meals_confirmed=int(confirmed[1] or 0),
        verified_donors=int(verified_donors),
        verified_ngos=int(verified_ngos),
        by_status=by_status,
        by_category=by_category,
        recent=_recent(db),
    )


def get_my_impact(db: Session, user: User) -> schemas.MyImpactResponse:
    """The signed-in account's own history, from the same listing, proof and account records as the public figures."""
    if user.role == "provider":
        mine = Listing.provider_id == user.id
        done = db.query(
            func.count(Listing.id), func.coalesce(func.sum(Listing.est_meals), 0), func.coalesce(func.sum(Listing.est_kg), 0.0)
        ).filter(mine, Listing.status == "completed").first()
        by_status = dict(db.query(Listing.status, func.count(Listing.id)).filter(mine).group_by(Listing.status).all())
        states = _proof_states(db, [i for (i,) in db.query(Listing.id).filter(mine, Listing.status == "completed")])
        summary = {
            "listings_total": float(sum(by_status.values())),
            "listings_open": float(by_status.get("listed", 0)),
            "listings_reserved": float(by_status.get("reserved", 0)),
            "pickups_completed": float(done[0]),
            "meals_donated": float(done[1]),
            "kg_donated": float(done[2]),
            "proofs_approved": float(sum(1 for s in states.values() if s == "approved")),
            "proofs_awaiting": float(sum(1 for s in states.values() if s == "pending")),
        }
        recent = _recent(db, where=(mine,), names=True)
    elif user.role == "ngo":
        mine = Listing.reserved_by_ngo_id == user.id
        done = db.query(
            func.count(Listing.id), func.coalesce(func.sum(Listing.est_meals), 0), func.coalesce(func.sum(Listing.est_kg), 0.0)
        ).filter(mine, Listing.status == "completed").first()
        open_ = db.query(func.count(Listing.id)).filter(mine, Listing.status == "reserved").scalar() or 0
        states = _proof_states(db, [i for (i,) in db.query(Listing.id).filter(mine, Listing.status == "completed")])
        completed_total = int(done[0])
        summary = {
            "reservations_open": float(open_),
            "pickups_completed": float(completed_total),
            "meals_collected": float(done[1]),
            "kg_collected": float(done[2]),
            "proofs_needed": float(completed_total - sum(1 for s in states.values() if s in ("pending", "approved"))),  # none or rejected
            "proofs_awaiting": float(sum(1 for s in states.values() if s == "pending")),
            "proofs_approved": float(sum(1 for s in states.values() if s == "approved")),
        }
        recent = _recent(db, where=(mine,), names=True)
    else:  # admin: the platform as a whole
        pending_requests = db.query(func.count(func.distinct(VerificationRequest.subject_user_id))).filter(VerificationRequest.status == "pending").scalar() or 0
        proofs_waiting = db.query(func.count(func.distinct(Proof.listing_id))).filter(Proof.review_status == "pending").scalar() or 0
        done = db.query(func.count(Listing.id)).filter(Listing.status == "completed").scalar() or 0
        summary = {
            "users_total": float(db.query(func.count(User.id)).scalar() or 0),
            "verified_donors": float(db.query(func.count(ProviderProfile.user_id)).filter(ProviderProfile.verification_status == "approved").scalar() or 0),
            "verified_ngos": float(db.query(func.count(NgoProfile.user_id)).filter(NgoProfile.status == "approved").scalar() or 0),
            "verifications_open": float(pending_requests),
            "proofs_awaiting_review": float(proofs_waiting),
            "pickups_completed": float(done),
        }
        recent = _recent(db, names=True)
    return schemas.MyImpactResponse(role=user.role, summary=summary, recent=recent)
