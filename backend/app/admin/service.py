"""Admin business logic / service layer."""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from backend.app.admin import schemas
from backend.app.db.models import (
    Listing,
    NgoProfile,
    Proof,
    ProviderProfile,
    Rating,
    User,
)


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------


def get_stats(db: Session) -> schemas.StatsResponse:
    total_users = db.query(func.count(User.id)).scalar() or 0

    ngos_pending = (
        db.query(func.count(NgoProfile.user_id))
        .filter(NgoProfile.status == "pending")
        .scalar()
        or 0
    )

    providers_pending = (
        db.query(func.count(ProviderProfile.user_id))
        .filter(ProviderProfile.verification_status == "pending")
        .scalar()
        or 0
    )

    status_counts = (
        db.query(Listing.status, func.count(Listing.id))
        .group_by(Listing.status)
        .all()
    )
    status_map = {s: c for s, c in status_counts}

    return schemas.StatsResponse(
        total_users=total_users,
        ngos_pending=ngos_pending,
        providers_pending=providers_pending,
        listings_by_status=schemas.ListingsByStatus(
            listed=status_map.get("listed", 0),
            reserved=status_map.get("reserved", 0),
            completed=status_map.get("completed", 0),
            cancelled=status_map.get("cancelled", 0),
            expired=status_map.get("expired", 0),
        ),
    )


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


def _user_to_out(user: User) -> schemas.UserOut:
    """Map a User ORM instance to UserOut, attaching profile if present."""
    profile: Optional[schemas.ProfileOut] = None
    if user.role == "provider" and user.provider_profile:
        pp = user.provider_profile
        profile = schemas.ProfileOut(
            org_name=pp.org_name,
            category=pp.category,
            verification_status=pp.verification_status,
            rating_avg=pp.rating_avg,
            rating_count=pp.rating_count,
        )
    elif user.role == "ngo" and user.ngo_profile:
        np = user.ngo_profile
        profile = schemas.ProfileOut(
            org_name=np.org_name,
            status=np.status,
            rating_avg=np.rating_avg,
            rating_count=np.rating_count,
        )

    return schemas.UserOut(
        id=user.id,
        email=user.email,
        role=user.role,
        name=user.name,
        phone=user.phone,
        is_active=user.is_active,
        created_at=user.created_at,
        profile=profile,
    )


def get_users(db: Session) -> list[schemas.UserOut]:
    users = (
        db.query(User)
        .options(
            joinedload(User.provider_profile),
            joinedload(User.ngo_profile),
        )
        .all()
    )
    return [_user_to_out(u) for u in users]


def patch_user(
    db: Session, user_id: int, patch: schemas.UserPatch
) -> schemas.UserOut:
    user = (
        db.query(User)
        .options(
            joinedload(User.provider_profile),
            joinedload(User.ngo_profile),
        )
        .filter(User.id == user_id)
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    user.is_active = patch.is_active
    db.commit()
    db.refresh(user)
    return _user_to_out(user)


# ---------------------------------------------------------------------------
# Proofs
# ---------------------------------------------------------------------------


def _proof_to_out(proof: Proof) -> schemas.ProofOut:
    """Convert a Proof ORM object (with joined listing/ngo) to ProofOut."""
    listing_info: Optional[schemas.ProofListingInfo] = None
    if proof.listing:
        provider_org: Optional[str] = None
        if proof.listing.provider and hasattr(proof.listing.provider, "provider_profile"):
            pp = proof.listing.provider.provider_profile
            if pp:
                provider_org = pp.org_name
        listing_info = schemas.ProofListingInfo(
            id=proof.listing.id,
            title=proof.listing.title,
            food_type=proof.listing.food_type,
            quantity=proof.listing.quantity,
            unit=proof.listing.unit,
            provider_org_name=provider_org,
        )

    ngo_info: Optional[schemas.ProofNgoInfo] = None
    if proof.ngo and proof.ngo.ngo_profile:
        ngo_info = schemas.ProofNgoInfo(
            id=proof.ngo.id,
            org_name=proof.ngo.ngo_profile.org_name or "",
        )

    return schemas.ProofOut(
        id=proof.id,
        listing_id=proof.listing_id,
        ngo_id=proof.ngo_id,
        document_id=proof.document_id,
        note=proof.note,
        review_status=proof.review_status,
        created_at=proof.created_at,
        listing=listing_info,
        ngo=ngo_info,
    )


def get_proofs(
    db: Session, review_status: Optional[str] = None
) -> list[schemas.ProofOut]:
    query = db.query(Proof).options(
        joinedload(Proof.listing).joinedload(Listing.provider).joinedload(User.provider_profile),
        joinedload(Proof.ngo).joinedload(User.ngo_profile),
    )
    if review_status:
        query = query.filter(Proof.review_status == review_status)
    proofs = query.all()
    return [_proof_to_out(p) for p in proofs]


def review_proof(
    db: Session,
    proof_id: int,
    review: schemas.ProofReviewRequest,
    admin_user_id: int,
) -> schemas.ProofOut:
    proof = (
        db.query(Proof)
        .options(
            joinedload(Proof.listing).joinedload(Listing.provider).joinedload(User.provider_profile),
            joinedload(Proof.ngo).joinedload(User.ngo_profile),
        )
        .filter(Proof.id == proof_id)
        .first()
    )
    if not proof:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proof not found",
        )

    if proof.review_status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="ALREADY_REVIEWED",
        )

    # Update proof status
    proof.review_status = review.decision.value

    # Insert rating
    rating = Rating(
        listing_id=proof.listing_id,
        kind="admin_to_ngo",
        stars=review.stars,
        comment=review.comment,
    )
    db.add(rating)

    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="ALREADY_REVIEWED",
        )

    # Recompute NGO rating
    ngo_profile = (
        db.query(NgoProfile)
        .filter(NgoProfile.user_id == proof.ngo_id)
        .first()
    )
    if ngo_profile:
        # Gather all admin_to_ngo ratings for listings where this NGO was the reserved_by
        ngo_listing_ids = (
            db.query(Proof.listing_id)
            .filter(Proof.ngo_id == proof.ngo_id)
            .scalar_subquery()
        )
        agg = (
            db.query(
                func.avg(Rating.stars),
                func.count(Rating.id),
            )
            .filter(
                Rating.kind == "admin_to_ngo",
                Rating.listing_id.in_(ngo_listing_ids),
            )
            .first()
        )
        if agg and agg[0] is not None:
            ngo_profile.rating_avg = round(float(agg[0]), 2)
            ngo_profile.rating_count = agg[1]

    db.commit()
    db.refresh(proof)

    return _proof_to_out(proof)
