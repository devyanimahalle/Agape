"""
Idempotent demo seed.

Run: docker compose exec backend python -m seed

Accounts created
----------------
admin@shareplate.demo      Admin@123   admin
restaurant@shareplate.demo Rest@123    provider/restaurant  both steps approved + rated
caterer@shareplate.demo    Cater@123   provider/caterer     step1 approved step2 pending
donor@shareplate.demo      Donor@123   provider/general     approved unrated
ngo1@shareplate.demo       Ngo1@123    ngo approved  (near providers, Bengaluru centre)
ngo2@shareplate.demo       Ngo2@123    ngo approved  (farther)
ngo3@shareplate.demo       Ngo3@123    ngo pending

Listings
--------
One listing per status: listed, reserved, completed, cancelled, expired
Two completed pickups have proofs + ratings (ngo_to_provider + admin_to_ngo).
"""

import io
import math
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.common.uploads import save_upload
from app.db.models import (
    Listing,
    NgoProfile,
    Proof,
    ProviderProfile,
    Rating,
    User,
    VerificationRequest,
)
from app.db.session import SessionLocal

# ---------------------------------------------------------------------------
# Coordinates (Bengaluru)
# ---------------------------------------------------------------------------
# Providers cluster near Indiranagar
RESTAURANT_LAT, RESTAURANT_LNG = 12.9784, 77.6408
CATERER_LAT, CATERER_LNG = 12.9790, 77.6400
DONOR_LAT, DONOR_LNG = 12.9800, 77.6420
# NGOs
NGO1_LAT, NGO1_LNG = 12.9780, 77.6410  # very close
NGO2_LAT, NGO2_LNG = 12.9200, 77.6000  # ~8 km away
NGO3_LAT, NGO3_LNG = 12.9500, 77.6200  # mid-range

MEAL_KG = float(os.getenv("MEAL_KG", "0.4"))


def est(quantity_kg: float) -> tuple[int, float]:
    """Return (est_meals, est_kg) using the same formula as listings/service.py."""
    meals = quantity_kg / MEAL_KG
    return int(math.floor(meals + 0.5)), round(quantity_kg, 2)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Tiny valid PDF and PNG bytes for proof uploads (magic bytes only)
# ---------------------------------------------------------------------------
TINY_PDF = (
    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj "
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj "
    b"3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\n"
    b"xref\n0 4\n0000000000 65535 f\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n9\n%%EOF"
)
TINY_PNG = (
    b"\x89PNG\r\n\x1a\n"  # PNG signature
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02"
    b"\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


class _FakeUpload:
    """Minimal UploadFile shim for save_upload (which calls upload_file.file.read)."""

    def __init__(self, filename: str, content: bytes, content_type: str):
        self.filename = filename
        self.content_type = content_type
        self.file = io.BytesIO(content)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_or_create_user(
    db: Session,
    email: str,
    password: str,
    role: str,
    name: str,
    phone: str | None = None,
) -> tuple[User, bool]:
    """Return (user, created). Idempotent on email."""
    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        return existing, False
    u = User(
        email=email,
        password_hash=hash_password(password),
        role=role,
        name=name,
        phone=phone,
        is_active=True,
    )
    db.add(u)
    db.flush()
    return u, True


def _ensure_provider_profile(
    db: Session,
    user_id: int,
    category: str,
    org_name: str,
    address: str,
    lat: float,
    lng: float,
    verification_status: str,
    rating_avg: float | None = None,
    rating_count: int = 0,
) -> ProviderProfile:
    p = db.get(ProviderProfile, user_id)
    if p:
        return p
    p = ProviderProfile(
        user_id=user_id,
        category=category,
        org_name=org_name,
        address=address,
        lat=lat,
        lng=lng,
        verification_status=verification_status,
        rating_avg=rating_avg,
        rating_count=rating_count,
    )
    db.add(p)
    db.flush()
    return p


def _ensure_ngo_profile(
    db: Session,
    user_id: int,
    org_name: str,
    lat: float,
    lng: float,
    status: str,
) -> NgoProfile:
    n = db.get(NgoProfile, user_id)
    if n:
        return n
    n = NgoProfile(
        user_id=user_id,
        org_name=org_name,
        lat=lat,
        lng=lng,
        status=status,
        rating_count=0,
    )
    db.add(n)
    db.flush()
    return n


def _ensure_verification_request(
    db: Session,
    subject_user_id: int,
    subject_type: str,
    step: int,
    status: str,
    reviewed_by_id: int | None = None,
    masked_pan: str | None = None,
    masked_aadhaar: str | None = None,
    fssai_number: str | None = None,
    entity_name: str | None = None,
) -> VerificationRequest:
    existing = db.scalar(
        select(VerificationRequest).where(
            VerificationRequest.subject_user_id == subject_user_id,
            VerificationRequest.step == step,
        )
    )
    if existing:
        return existing
    vr = VerificationRequest(
        subject_user_id=subject_user_id,
        subject_type=subject_type,
        step=step,
        status=status,
        reviewed_by=reviewed_by_id,
        reviewed_at=now_utc() if status != "pending" else None,
        masked_pan=masked_pan,
        masked_aadhaar=masked_aadhaar,
        fssai_number=fssai_number,
        entity_name=entity_name,
    )
    db.add(vr)
    db.flush()
    return vr


def _ensure_listing(
    db: Session,
    provider_id: int,
    title: str,
    food_type: str,
    quantity: float,
    unit: str,
    window_start: datetime,
    window_end: datetime,
    address: str,
    lat: float,
    lng: float,
    status: str,
    reserved_by_ngo_id: int | None = None,
    reserved_at: datetime | None = None,
    completed_at: datetime | None = None,
) -> tuple[Listing, bool]:
    existing = db.scalar(
        select(Listing).where(
            Listing.provider_id == provider_id,
            Listing.title == title,
        )
    )
    if existing:
        return existing, False
    meals, kg = est(quantity if unit == "kg" else quantity * MEAL_KG)
    row = Listing(
        provider_id=provider_id,
        title=title,
        food_type=food_type,
        quantity=quantity,
        unit=unit,
        est_meals=meals,
        est_kg=kg,
        window_start=window_start,
        window_end=window_end,
        address=address,
        lat=lat,
        lng=lng,
        status=status,
        reserved_by_ngo_id=reserved_by_ngo_id,
        reserved_at=reserved_at,
        completed_at=completed_at,
    )
    db.add(row)
    db.flush()
    return row, True


def _ensure_proof_and_rating(
    db: Session,
    listing: Listing,
    ngo_id: int,
    admin_id: int,
    provider_profile: ProviderProfile,
    proof_stars: int,
    admin_stars: int,
) -> None:
    """Add proof document, proof row, and both ratings. Idempotent."""
    # Check if rating already exists
    existing_rating = db.scalar(
        select(Rating).where(
            Rating.listing_id == listing.id,
            Rating.kind == "ngo_to_provider",
        )
    )
    if existing_rating:
        return  # already seeded

    # Ensure PRIVATE_UPLOAD_DIR is writable; fall back to /tmp/seed_uploads
    upload_dir = os.environ.get("PRIVATE_UPLOAD_DIR", "/data/private")
    try:
        os.makedirs(upload_dir, exist_ok=True)
        test_path = os.path.join(upload_dir, ".write_test")
        open(test_path, "w").close()
        os.remove(test_path)
    except (PermissionError, OSError):
        upload_dir = "/tmp/seed_uploads"
        os.environ["PRIVATE_UPLOAD_DIR"] = upload_dir
        os.makedirs(upload_dir, exist_ok=True)

    # Save proof document via save_upload (flushes, we commit at the end)
    upload = _FakeUpload("proof.pdf", TINY_PDF, "application/pdf")
    doc = save_upload(db, upload, ngo_id, "proof_photo")

    # Proof row
    db.add(
        Proof(
            listing_id=listing.id,
            ngo_id=ngo_id,
            document_id=doc.id,
            note="Food collected successfully",
            review_status="approved",
        )
    )
    db.flush()

    # ngo_to_provider rating
    db.add(
        Rating(
            listing_id=listing.id,
            kind="ngo_to_provider",
            stars=proof_stars,
            comment="Great food quality",
        )
    )
    db.flush()

    # admin_to_ngo rating
    db.add(
        Rating(
            listing_id=listing.id,
            kind="admin_to_ngo",
            stars=admin_stars,
            comment="Timely pickup",
        )
    )
    db.flush()

    # Recompute provider rating_avg / rating_count from all ngo_to_provider ratings
    from sqlalchemy import func

    avg, count = db.execute(
        select(func.avg(Rating.stars), func.count(Rating.id))
        .join(Listing, Listing.id == Rating.listing_id)
        .where(
            Listing.provider_id == provider_profile.user_id,
            Rating.kind == "ngo_to_provider",
        )
    ).one()
    provider_profile.rating_avg = round(float(avg), 2)
    provider_profile.rating_count = int(count)
    db.flush()


# ---------------------------------------------------------------------------
# Main seed
# ---------------------------------------------------------------------------

def seed() -> None:
    db: Session = SessionLocal()
    try:
        print("Seeding...")

        now = now_utc()

        # ------------------------------------------------------------------
        # Users
        # ------------------------------------------------------------------
        admin, _ = _get_or_create_user(
            db, "admin@shareplate.demo", "Admin@123", "admin", "Admin User"
        )

        restaurant_user, _ = _get_or_create_user(
            db, "restaurant@shareplate.demo", "Rest@123", "provider", "Restaurant Provider"
        )
        caterer_user, _ = _get_or_create_user(
            db, "caterer@shareplate.demo", "Cater@123", "provider", "Caterer Provider"
        )
        donor_user, _ = _get_or_create_user(
            db, "donor@shareplate.demo", "Donor@123", "provider", "General Donor"
        )
        ngo1_user, _ = _get_or_create_user(
            db, "ngo1@shareplate.demo", "Ngo1@123", "ngo", "NGO One"
        )
        ngo2_user, _ = _get_or_create_user(
            db, "ngo2@shareplate.demo", "Ngo2@123", "ngo", "NGO Two"
        )
        ngo3_user, _ = _get_or_create_user(
            db, "ngo3@shareplate.demo", "Ngo3@123", "ngo", "NGO Three"
        )

        # ------------------------------------------------------------------
        # Provider profiles
        # ------------------------------------------------------------------
        restaurant_prof = _ensure_provider_profile(
            db,
            restaurant_user.id,
            category="restaurant",
            org_name="Spice Garden Restaurant",
            address="12 MG Road, Indiranagar, Bengaluru",
            lat=RESTAURANT_LAT,
            lng=RESTAURANT_LNG,
            verification_status="approved",
        )
        caterer_prof = _ensure_provider_profile(
            db,
            caterer_user.id,
            category="caterer",
            org_name="Royal Caterers",
            address="45 HAL 2nd Stage, Bengaluru",
            lat=CATERER_LAT,
            lng=CATERER_LNG,
            verification_status="approved",
        )
        _ensure_provider_profile(
            db,
            donor_user.id,
            category="general",
            org_name="Community Donor",
            address="78 Koramangala, Bengaluru",
            lat=DONOR_LAT,
            lng=DONOR_LNG,
            verification_status="approved",
        )

        # ------------------------------------------------------------------
        # NGO profiles
        # ------------------------------------------------------------------
        _ensure_ngo_profile(db, ngo1_user.id, "Helping Hands Foundation",
                             NGO1_LAT, NGO1_LNG, "approved")
        _ensure_ngo_profile(db, ngo2_user.id, "City Care NGO",
                             NGO2_LAT, NGO2_LNG, "approved")
        _ensure_ngo_profile(db, ngo3_user.id, "New Hope Trust",
                             NGO3_LAT, NGO3_LNG, "pending")

        # ------------------------------------------------------------------
        # Verification requests
        # ------------------------------------------------------------------
        # Restaurant: both steps approved
        _ensure_verification_request(
            db, restaurant_user.id, "provider", 1, "approved",
            reviewed_by_id=admin.id,
            masked_pan="XXXXX1234X",
            masked_aadhaar="XXXX-XXXX-5678",
            entity_name="Spice Garden Restaurant",
        )
        _ensure_verification_request(
            db, restaurant_user.id, "provider", 2, "approved",
            reviewed_by_id=admin.id,
            fssai_number="12345678901234",
            entity_name="Spice Garden Restaurant",
        )

        # Caterer: step 1 approved, step 2 pending
        _ensure_verification_request(
            db, caterer_user.id, "provider", 1, "approved",
            reviewed_by_id=admin.id,
            masked_pan="XXXXX9876Y",
            masked_aadhaar="XXXX-XXXX-1111",
            entity_name="Royal Caterers",
        )
        _ensure_verification_request(
            db, caterer_user.id, "provider", 2, "pending",
            fssai_number="98765432109876",
            entity_name="Royal Caterers",
        )

        # NGO1: approved
        _ensure_verification_request(
            db, ngo1_user.id, "ngo", 1, "approved",
            reviewed_by_id=admin.id,
            entity_name="Helping Hands Foundation",
        )
        # NGO2: approved
        _ensure_verification_request(
            db, ngo2_user.id, "ngo", 1, "approved",
            reviewed_by_id=admin.id,
            entity_name="City Care NGO",
        )
        # NGO3: pending
        _ensure_verification_request(
            db, ngo3_user.id, "ngo", 1, "pending",
            entity_name="New Hope Trust",
        )

        # ------------------------------------------------------------------
        # Listings — one per status
        # ------------------------------------------------------------------
        # 1. listed (future window)
        listing_listed, _ = _ensure_listing(
            db, restaurant_user.id,
            title="Dal Makhani & Rice",
            food_type="cooked",
            quantity=20.0, unit="kg",
            window_start=now + timedelta(hours=1),
            window_end=now + timedelta(hours=4),
            address="12 MG Road, Indiranagar, Bengaluru",
            lat=RESTAURANT_LAT, lng=RESTAURANT_LNG,
            status="listed",
        )

        # 2. reserved (future window, reserved by ngo1)
        listing_reserved, _ = _ensure_listing(
            db, restaurant_user.id,
            title="Biryani Surplus",
            food_type="cooked",
            quantity=15.0, unit="kg",
            window_start=now + timedelta(hours=2),
            window_end=now + timedelta(hours=5),
            address="12 MG Road, Indiranagar, Bengaluru",
            lat=RESTAURANT_LAT, lng=RESTAURANT_LNG,
            status="reserved",
            reserved_by_ngo_id=ngo1_user.id,
            reserved_at=now - timedelta(hours=1),
        )

        # 3. completed — restaurant + ngo1 (with proof + rating)
        listing_completed1, _ = _ensure_listing(
            db, restaurant_user.id,
            title="South Indian Thali",
            food_type="cooked",
            quantity=30.0, unit="kg",
            window_start=now - timedelta(hours=6),
            window_end=now - timedelta(hours=3),
            address="12 MG Road, Indiranagar, Bengaluru",
            lat=RESTAURANT_LAT, lng=RESTAURANT_LNG,
            status="completed",
            reserved_by_ngo_id=ngo1_user.id,
            reserved_at=now - timedelta(hours=5),
            completed_at=now - timedelta(hours=3),
        )

        # 4. completed — caterer + ngo2 (with proof + rating)
        listing_completed2, _ = _ensure_listing(
            db, caterer_user.id,
            title="Wedding Surplus Food",
            food_type="cooked",
            quantity=50.0, unit="kg",
            window_start=now - timedelta(hours=10),
            window_end=now - timedelta(hours=7),
            address="45 HAL 2nd Stage, Bengaluru",
            lat=CATERER_LAT, lng=CATERER_LNG,
            status="completed",
            reserved_by_ngo_id=ngo2_user.id,
            reserved_at=now - timedelta(hours=9),
            completed_at=now - timedelta(hours=7),
        )

        # 5. cancelled
        _ensure_listing(
            db, donor_user.id,
            title="Homemade Rotis",
            food_type="cooked",
            quantity=5.0, unit="kg",
            window_start=now - timedelta(hours=4),
            window_end=now - timedelta(hours=2),
            address="78 Koramangala, Bengaluru",
            lat=DONOR_LAT, lng=DONOR_LNG,
            status="cancelled",
        )

        # 6. expired
        _ensure_listing(
            db, restaurant_user.id,
            title="Afternoon Snacks",
            food_type="cooked",
            quantity=10.0, unit="kg",
            window_start=now - timedelta(hours=8),
            window_end=now - timedelta(hours=5),
            address="12 MG Road, Indiranagar, Bengaluru",
            lat=RESTAURANT_LAT, lng=RESTAURANT_LNG,
            status="expired",
        )

        # ------------------------------------------------------------------
        # Proofs and ratings for completed listings
        # ------------------------------------------------------------------
        _ensure_proof_and_rating(
            db,
            listing_completed1,
            ngo_id=ngo1_user.id,
            admin_id=admin.id,
            provider_profile=restaurant_prof,
            proof_stars=5,
            admin_stars=4,
        )
        _ensure_proof_and_rating(
            db,
            listing_completed2,
            ngo_id=ngo2_user.id,
            admin_id=admin.id,
            provider_profile=caterer_prof,
            proof_stars=4,
            admin_stars=5,
        )

        db.commit()
        print("Done. Seed complete — all accounts and listings are ready.")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
