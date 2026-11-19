"""The demo seed: three verified accounts, no request history, and it never overwrites real state."""
import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.security import verify_password
from app.db.models import Base, Document, Listing, NgoProfile, Proof, ProviderProfile, User, VerificationRequest
from app.db.seed import DEMO_PASSWORDS, seed


@pytest.fixture()
def db(tmp_path, monkeypatch):
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    yield session
    session.close()
    engine.dispose()


def _count(db, model):
    return db.scalar(select(func.count()).select_from(model))


def test_seed_creates_three_verified_accounts_and_no_history(db):
    seed(db)
    assert {u.email for u in db.scalars(select(User)).all()} == {e for e, _ in DEMO_PASSWORDS.values()}
    assert db.scalar(select(ProviderProfile)).verification_status == "approved"
    assert db.scalar(select(NgoProfile)).status == "approved"
    # nothing pre-seeded in the admin queues
    for model in (VerificationRequest, Proof, Document):
        assert _count(db, model) == 0, model.__name__
    # and no completed pickups either
    assert db.scalars(select(Listing).where(Listing.status != "listed")).all() == []
    assert _count(db, Listing) == 3


def test_seed_is_idempotent(db):
    seed(db)
    before = (_count(db, User), _count(db, Listing), _count(db, ProviderProfile), _count(db, NgoProfile))
    result = seed(db)
    assert (_count(db, User), _count(db, Listing), _count(db, ProviderProfile), _count(db, NgoProfile)) == before
    assert result["accounts_created"] == 0


def test_seed_does_not_overwrite_existing_account_state(db):
    seed(db)
    ngo = db.scalar(select(User).where(User.email == DEMO_PASSWORDS["ngo"][0]))
    profile = db.get(NgoProfile, ngo.id)
    profile.status = "rejected"  # an admin changed it
    ngo.password_hash = "changed-by-admin"
    ngo.is_active = False
    db.commit()

    seed(db)
    db.expire_all()
    ngo = db.scalar(select(User).where(User.email == DEMO_PASSWORDS["ngo"][0]))
    assert db.get(NgoProfile, ngo.id).status == "rejected"
    assert ngo.password_hash == "changed-by-admin" and ngo.is_active is False


def test_demo_logins_work_after_first_seed(db):
    seed(db)
    for email, password in DEMO_PASSWORDS.values():
        user = db.scalar(select(User).where(User.email == email))
        assert verify_password(password, user.password_hash)
