"""Idempotent local demo data. Run from `backend/`:  python -m app.db.seed

Creates (or refreshes) demo accounts and a few open listings so the live stack works end to end:

    provider@agape.demo  / Provider@123   restaurant, admin-approved
    ngo@agape.demo       / Ngo@12345       NGO, approved, saved location in Delhi (lat/lng)
    admin@agape.demo     / Admin@123       admin

Safe to run repeatedly: accounts are matched by email and listings by (provider, title). Re-running resets the
demo passwords, makes sure the NGO and provider are approved, and moves each demo listing's collection window
forward so the board is never empty. Demo data only; never run this against a real database.
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


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)  # SQLite returns naive datetimes


def seed(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    provider = _upsert_user(db, "provider", "Demo Donor", "+91 90000 00001")
    ngo = _upsert_user(db, "ngo", "Demo NGO", "+91 90000 00002")
    _upsert_user(db, "admin", "Demo Admin", "+91 90000 00003")
    _upsert_profiles(db, provider, ngo)
    touched = _upsert_listings(db, provider, now)
    db.commit()
    return {"listings_created_or_refreshed": touched}


def main() -> None:
    init_db()
    with SessionLocal() as db:
        result = seed(db)
    print("Seeded demo data:", result)
    for role, (email, password) in DEMO_PASSWORDS.items():
        print(f"  {role:<9} {email}  /  {password}")


if __name__ == "__main__":
    main()
