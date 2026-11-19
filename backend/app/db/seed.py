"""Idempotent local demo data. Run from `backend/`:  python -m app.db.seed

Creates (or refreshes) demo accounts and a few open listings so the live stack works end to end:

    provider@agape.demo  / Provider@123   restaurant, admin-approved
    ngo@agape.demo       / Ngo@12345       NGO, approved, saved location in Delhi (lat/lng)
    admin@agape.demo     / Admin@123       admin
    pending.ngo@agape.demo / Ngo@12345     NGO waiting for admin review (one pending verification request)

It also seeds one completed pickup (reserved and completed by the demo NGO) with a pending proof, so the admin
verification queue (/admin/verifications) and proof queue (/admin/proofs) have items out of the box. There is no
separate reservation table: a reservation is a listing with `reserved_by_ngo_id` set.

Uploaded files for those two items are written under PRIVATE_UPLOAD_DIR. When it is unset the seed uses
`backend/.private_uploads` and tells you to start the API with the same value so the admin document viewer works.

Safe to run repeatedly: accounts are matched by email and listings by (provider, title). Re-running resets the
demo passwords, makes sure the NGO and provider are approved, and moves each demo listing's collection window
forward so the board is never empty. Demo data only; never run this against a real database.
"""
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.common.uploads import get_private_upload_dir
from app.db.models import (
    Document,
    Listing,
    NgoProfile,
    Proof,
    ProviderProfile,
    User,
    VerificationRequest,
    init_db,
)
from app.db.session import SessionLocal
from app.listings.service import estimate

DEMO_PASSWORDS = {
    "provider": ("provider@agape.demo", "Provider@123"),
    "ngo": ("ngo@agape.demo", "Ngo@12345"),
    "admin": ("admin@agape.demo", "Admin@123"),
    "pending_ngo": ("pending.ngo@agape.demo", "Ngo@12345"),
}

PENDING_NGO_REG = "DEMO/2025/PENDING-007"
PICKUP_TITLE = "Rajma chawal, 18 portions (picked up)"

# Smallest valid files the upload layer accepts, so the admin document viewer has something to show.
_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d49444154789c6360f8cfc00000030101009ec9c7510000000049454e44ae426082"
)
_PDF = b"%PDF-1.4" + bytes([10]) + b"1 0 obj<</Type/Catalog>>endobj" + bytes([10]) + b"trailer<</Root 1 0 R>>" + bytes([10]) + b"%%EOF" + bytes([10])

# The NGO and the sample food are all in central Delhi, so the board shows sensible distances.
NGO_LOCATION = (28.6139, 77.2090)

LISTINGS = [
    # title, food_type, quantity, unit, lat, lng, address, hours until the window closes
    ("Dal and rice, 40 portions", "cooked meal", 40, "portions", 28.6129, 77.2295, "India Gate, New Delhi", 4),
    ("Fresh bread and buns", "bakery", 12, "kg", 28.6304, 77.2177, "Connaught Place, New Delhi", 3),
    ("Vegetable biryani, 25 portions", "cooked meal", 25, "portions", 28.5535, 77.2588, "Lajpat Nagar, New Delhi", 6),
]


def _upsert_user(db: Session, role: str, name: str, phone: str) -> User:
    email, password = DEMO_PASSWORDS[role]
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, role=role, name=name, phone=phone, password_hash=hash_password(password), is_active=True)
        db.add(user)
        db.flush()
    else:
        user.role, user.name, user.phone, user.is_active = role, name, phone, True
        user.password_hash = hash_password(password)
    return user


def _upsert_profiles(db: Session, provider: User, ngo: User) -> None:
    pp = db.get(ProviderProfile, provider.id)
    if pp is None:
        pp = ProviderProfile(user_id=provider.id, category="restaurant", org_name="Demo Kitchen")
        db.add(pp)
    pp.category, pp.org_name = "restaurant", "Demo Kitchen"
    pp.address, pp.lat, pp.lng = "Khan Market, New Delhi", 28.6003, 77.2273
    pp.verification_status = "approved"

    npf = db.get(NgoProfile, ngo.id)
    if npf is None:
        npf = NgoProfile(user_id=ngo.id, org_name="Demo Helping Hands Trust")
        db.add(npf)
    npf.org_name, npf.reg_number = "Demo Helping Hands Trust", "DEMO/2024/001"
    npf.address, npf.lat, npf.lng = "Connaught Place, New Delhi", NGO_LOCATION[0], NGO_LOCATION[1]
    npf.status = "approved"


def _upsert_listings(db: Session, provider: User, now: datetime) -> int:
    touched = 0
    for title, food_type, quantity, unit, lat, lng, address, hours in LISTINGS:
        end = now + timedelta(hours=hours)
        row = db.scalar(select(Listing).where(Listing.provider_id == provider.id, Listing.title == title))
        est_meals, est_kg = estimate(quantity, unit)
        if row is None:
            db.add(
                Listing(
                    provider_id=provider.id, title=title, food_type=food_type, quantity=quantity, unit=unit,
                    est_meals=est_meals, est_kg=est_kg, window_start=now - timedelta(minutes=15), window_end=end,
                    address=address, lat=lat, lng=lng, notes="Demo listing", status="listed",
                )
            )
            touched += 1
        elif row.status in ("listed", "expired") and _aware(row.window_end) < now + timedelta(hours=1):
            row.status, row.window_end = "listed", end  # keep the demo board populated on re-runs
            row.window_start = now - timedelta(minutes=15)
            touched += 1
    return touched


def _private_dir() -> Path:
    """The directory demo documents are written to (and the API must read from)."""
    if not os.environ.get("PRIVATE_UPLOAD_DIR"):
        os.environ["PRIVATE_UPLOAD_DIR"] = str(Path(__file__).resolve().parents[2] / ".private_uploads")
    return get_private_upload_dir()


def _seed_document(db: Session, owner: User, kind: str, subfolder: str, filename: str, content: bytes) -> Document:
    """Return a live Document of this kind for the owner, writing the placeholder file if it is missing."""
    path = _private_dir() / subfolder / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_bytes(content)
    doc = db.scalar(select(Document).where(Document.owner_id == owner.id, Document.kind == kind, Document.private_path == str(path.resolve())))
    if doc is None:
        doc = Document(owner_id=owner.id, kind=kind, private_path=str(path.resolve()))
        db.add(doc)
        db.flush()
    doc.deleted_at = None
    return doc


def _seed_pending_verification(db: Session) -> None:
    """A second NGO that has applied and is waiting for review. Created once; never reset after an admin decides."""
    email, password = DEMO_PASSWORDS["pending_ngo"]
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, role="ngo", name="Demo Pending NGO", phone="+91 90000 00004",
                    password_hash=hash_password(password), is_active=True)
        db.add(user)
        db.flush()
        db.add(NgoProfile(user_id=user.id, org_name="Demo Pending NGO Trust", reg_number=PENDING_NGO_REG,
                          address="Karol Bagh, New Delhi", lat=28.6519, lng=77.1909, status="pending"))
    request = db.scalar(select(VerificationRequest).where(
        VerificationRequest.subject_user_id == user.id, VerificationRequest.subject_type == "ngo"))
    if request is None:
        db.add(VerificationRequest(subject_user_id=user.id, subject_type="ngo", step=1, status="pending",
                                   entity_name=PENDING_NGO_REG))
    _seed_document(db, user, "ngo_reg", "identity", "seed-ngo-registration.pdf", _PDF)


def _seed_pickup_with_proof(db: Session, provider: User, ngo: User, now: datetime) -> None:
    """One completed pickup (listing reserved and completed by the demo NGO) with a pending proof to review."""
    est_meals, est_kg = estimate(18, "portions")
    listing = db.scalar(select(Listing).where(Listing.provider_id == provider.id, Listing.title == PICKUP_TITLE))
    if listing is None:
        listing = Listing(
            provider_id=provider.id, title=PICKUP_TITLE, food_type="cooked meal", quantity=18, unit="portions",
            est_meals=est_meals, est_kg=est_kg, window_start=now - timedelta(hours=5), window_end=now - timedelta(hours=2),
            address="Khan Market, New Delhi", lat=28.6003, lng=77.2273, notes="Demo pickup", status="completed",
            reserved_by_ngo_id=ngo.id, reserved_at=now - timedelta(hours=4), completed_at=now - timedelta(hours=3),
        )
        db.add(listing)
        db.flush()
    doc = _seed_document(db, ngo, "proof_photo", "proofs", "seed-pickup-proof.png", _PNG)
    if db.scalar(select(Proof).where(Proof.listing_id == listing.id)) is None:
        db.add(Proof(listing_id=listing.id, ngo_id=ngo.id, document_id=doc.id,
                     note="All 18 portions collected and handed out at the shelter.", review_status="pending"))


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)  # SQLite returns naive datetimes


def seed(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    provider = _upsert_user(db, "provider", "Demo Donor", "+91 90000 00001")
    ngo = _upsert_user(db, "ngo", "Demo NGO", "+91 90000 00002")
    _upsert_user(db, "admin", "Demo Admin", "+91 90000 00003")
    _upsert_profiles(db, provider, ngo)
    touched = _upsert_listings(db, provider, now)
    _seed_pending_verification(db)
    _seed_pickup_with_proof(db, provider, ngo, now)
    db.commit()
    return {"listings_created_or_refreshed": touched}


def main() -> None:
    init_db()
    with SessionLocal() as db:
        result = seed(db)
    print("Seeded demo data:", result)
    print("Private files in:", get_private_upload_dir(), "(start the API with PRIVATE_UPLOAD_DIR set to this)")
    for role, (email, password) in DEMO_PASSWORDS.items():
        print(f"  {role:<9} {email}  /  {password}")


if __name__ == "__main__":
    main()
