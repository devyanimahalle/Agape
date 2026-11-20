"""The demo seed creates only the admin, and never overwrites real state."""
import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.security import verify_password
from app.db import models
from app.db.models import Base, User
from app.db.seed import DEMO_PASSWORDS, seed


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    yield session
    session.close()
    engine.dispose()


def _count(db, model):
    return db.scalar(select(func.count()).select_from(model))


def test_seed_creates_only_the_admin(db):
    result = seed(db)
    assert result == {"accounts_created": 1}
    users = db.scalars(select(User)).all()
    assert [(u.email, u.role, u.is_active) for u in users] == [("admin@agape.demo", "admin", True)]


def test_seed_leaves_every_other_table_empty(db):
    seed(db)
    for model in (models.ProviderProfile, models.NgoProfile, models.Listing, models.VerificationRequest,
                  models.Proof, models.Document, models.Rating):
        assert _count(db, model) == 0, model.__name__


def test_the_only_demo_login_is_the_admin(db):
    assert list(DEMO_PASSWORDS) == ["admin"]
    seed(db)
    email, password = DEMO_PASSWORDS["admin"]
    assert (email, password) == ("admin@agape.demo", "Admin@123")
    assert verify_password(password, db.scalar(select(User).where(User.email == email)).password_hash)


def test_seed_is_idempotent(db):
    seed(db)
    result = seed(db)
    assert result == {"accounts_created": 0}
    assert _count(db, User) == 1


def test_seed_does_not_overwrite_an_existing_admin(db):
    seed(db)
    admin = db.scalar(select(User))
    admin.password_hash = "changed-by-admin"
    admin.is_active = False
    db.commit()
    seed(db)
    db.expire_all()
    admin = db.scalar(select(User))
    assert admin.password_hash == "changed-by-admin" and admin.is_active is False
