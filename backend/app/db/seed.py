"""Idempotent local demo data. Run from `backend/`:  python -m app.db.seed

Creates the three core demo accounts, already verified, and a few open listings so the live stack works end to end:

    provider@agape.demo  / Provider@123   restaurant, admin-approved
    ngo@agape.demo       / Ngo@12345       NGO, approved, saved location in Delhi (lat/lng)
    admin@agape.demo     / Admin@123       admin

There is deliberately no verification-request or proof history: the platform starts with none, so the admin queues
(/admin/verifications, /admin/proofs) fill only with what people really submit during a demo.

Accounts are created ONCE. When an account with the same email already exists it is left exactly as it is: the
password, verification status and profile are not reset, so state that an admin changed (a password, an approval, a
deactivation) survives restarts and re-runs. To start over, use "Reset demo accounts" on /admin/users (or delete
`backend/agape_dev.db`) and run this again. The demo donor's own listings are matched by (provider, title); an
unclaimed one whose collection window is nearly over is moved forward so the board is never empty.
Demo data only; never run this against a real database.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.db.models import Listing, NgoProfile, ProviderProfile, User, init_db
from app.db.session import SessionLocal
from app.listings.service import estimate

DEMO_PASSWORDS = {
    "provider": ("provider@agape.demo", "Provider@123"),
    "ngo": ("ngo@agape.demo", "Ngo@12345"),
    "admin": ("admin@agape.demo", "Admin@123"),
}

# The NGO and the sample food are all in central Delhi, so the board shows sensible distances.
NGO_LOCATION = (28.6139, 77.2090)

LISTINGS = [
    # title, food_type, quantity, unit, lat, lng, address, hours until the window closes
    ("Dal and rice, 40 portions", "cooked meal", 40, "portions", 28.6129, 77.2295, "India Gate, New Delhi", 4),
    ("Fresh bread and buns", "bakery", 12, "kg", 28.6304, 77.2177, "Connaught Place, New Delhi", 3),
    ("Vegetable biryani, 25 portions", "cooked meal", 25, "portions", 28.5535, 77.2588, "Lajpat Nagar, New Delhi", 6),
]


def _ensure_user(db: Session, role: str, name: str, phone: str) -> tuple[User, bool]:
    """Return (user, created). An existing account is returned untouched."""
    email, password = DEMO_PASSWORDS[role]
    user = db.scalar(select(User).where(User.email == email))
    if user is not None:
        return user, False
    user = User(email=email, role=role, name=name, phone=phone, password_hash=hash_password(password), is_active=True)
    db.add(user)
    db.flush()
    return user, True


def _ensure_provider_profile(db: Session, provider: User) -> None:
    if db.get(ProviderProfile, provider.id) is None:
        db.add(ProviderProfile(
            user_id=provider.id, category="restaurant", org_name="Demo Kitchen",
            address="Khan Market, New Delhi", lat=28.6003, lng=77.2273, verification_status="approved",
        ))


def _ensure_ngo_profile(db: Session, ngo: User) -> None:
    if db.get(NgoProfile, ngo.id) is None:
        db.add(NgoProfile(
            user_id=ngo.id, org_name="Demo Helping Hands Trust", reg_number="DEMO/2024/001",
            address="Connaught Place, New Delhi", lat=NGO_LOCATION[0], lng=NGO_LOCATION[1], status="approved",
        ))


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


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)  # SQLite returns naive datetimes


def seed(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    provider, provider_new = _ensure_user(db, "provider", "Demo Donor", "+91 90000 00001")
    ngo, ngo_new = _ensure_user(db, "ngo", "Demo NGO", "+91 90000 00002")
    _, admin_new = _ensure_user(db, "admin", "Demo Admin", "+91 90000 00003")
    _ensure_provider_profile(db, provider)
    _ensure_ngo_profile(db, ngo)
    touched = _upsert_listings(db, provider, now)
    db.commit()
    return {
        "accounts_created": sum([provider_new, ngo_new, admin_new]),
        "listings_created_or_refreshed": touched,
    }


def main() -> None:
    init_db()
    with SessionLocal() as db:
        result = seed(db)
    print("Seeded demo data:", result)
    for role, (email, password) in DEMO_PASSWORDS.items():
        print(f"  {role:<9} {email}  /  {password}")


if __name__ == "__main__":
    main()
