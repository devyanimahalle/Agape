"""The demo seed is idempotent and gives the admin queues live items."""
import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.common.uploads import resolve_path
from app.db.models import Base, Document, Listing, Proof, VerificationRequest
from app.db.seed import PICKUP_TITLE, seed


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


def test_seed_creates_pending_verification_and_pending_proof(db):
    seed(db)
    request = db.scalar(select(VerificationRequest))
    assert (request.subject_type, request.status) == ("ngo", "pending")
    proof = db.scalar(select(Proof))
    assert proof.review_status == "pending"
    listing = db.get(Listing, proof.listing_id)
    assert listing.title == PICKUP_TITLE
    assert listing.status == "completed" and listing.reserved_by_ngo_id == proof.ngo_id
    for doc in db.scalars(select(Document)).all():
        assert resolve_path(doc).is_file()  # the admin document viewer can serve it


def test_seed_is_idempotent(db):
    seed(db)
    before = (_count(db, VerificationRequest), _count(db, Proof), _count(db, Document), _count(db, Listing))
    seed(db)
    assert (_count(db, VerificationRequest), _count(db, Proof), _count(db, Document), _count(db, Listing)) == before
