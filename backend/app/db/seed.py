"""Idempotent local demo data. Run from `backend/`:  python -m app.db.seed

Creates ONE account, the admin, so a fresh database starts completely empty and everything else is done live:

    admin@agape.demo / Admin@123    admin

There are no NGO or donor accounts, no listings, no verification requests, no proofs and no documents. NGOs and donors
register at /register, submit their verification, and the admin approves them at /admin/verifications.

The admin is created ONCE. When an account with that email already exists it is left exactly as it is (password,
status), so changes survive restarts and re-runs. "Reset demo accounts" on /admin/users deletes every donor and NGO and
keeps the admin(s), which gets you back to this same empty state. Demo data only; never run this against a real
database.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.db.models import User, init_db
from app.db.session import SessionLocal

DEMO_PASSWORDS = {
    "admin": ("admin@agape.demo", "Admin@123"),
}


def _ensure_admin(db: Session) -> bool:
    """Create the demo admin if missing. Returns True when it was created; an existing account is never touched."""
    email, password = DEMO_PASSWORDS["admin"]
    if db.scalar(select(User).where(User.email == email)) is not None:
        return False
    db.add(User(email=email, role="admin", name="Demo Admin", phone="+91 90000 00003",
                password_hash=hash_password(password), is_active=True))
    return True


def seed(db: Session) -> dict:
    created = _ensure_admin(db)
    db.commit()
    return {"accounts_created": int(created)}


def main() -> None:
    init_db()
    with SessionLocal() as db:
        result = seed(db)
    print("Seeded demo data:", result)
    for role, (email, password) in DEMO_PASSWORDS.items():
        print(f"  {role:<9} {email}  /  {password}")
    print("No NGOs, donors or listings are created: register them live, then approve them as admin.")


if __name__ == "__main__":
    main()
