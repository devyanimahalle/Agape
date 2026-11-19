"""Tests verifying model definitions, defaults, and constraints on SQLite."""
from datetime import datetime, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from app.db.models import (
    Base,
    Document,
    Listing,
    NgoProfile,
    Proof,
    ProviderProfile,
    Rating,
    User,
    VerificationRequest,
)


def test_models_metadata_has_all_tables():
    expected_tables = {
        "users",
        "provider_profiles",
        "ngo_profiles",
        "verification_requests",
        "documents",
        "listings",
        "proofs",
        "ratings",
    }
    assert expected_tables.issubset(set(Base.metadata.tables.keys()))


def test_create_and_persist_all_models(db):
    # 1. User
    user = User(
        email="general_user@example.com",
        password_hash="hashedpass",
        role="provider",
        name="Gen Provider",
        phone="9876543210",
    )
    db.add(user)
    db.commit()
    assert user.id is not None
    assert user.is_active is True
    assert user.created_at is not None

    # 2. ProviderProfile
    provider = ProviderProfile(
        user_id=user.id,
        category="general",
        org_name="General Store",
        address="Connaught Place, New Delhi",
        lat=28.63,
        lng=77.21,
    )
    db.add(provider)
    db.commit()
    assert provider.verification_status == "pending"
    assert provider.rating_count == 0

    # 3. NGO User and NgoProfile
    ngo_user = User(
        email="ngo_user@example.com",
        password_hash="hashedpass",
        role="ngo",
        name="NGO Lead",
        phone="9876543211",
    )
    db.add(ngo_user)
    db.commit()

    ngo_prof = NgoProfile(
        user_id=ngo_user.id,
        org_name="Food Angels",
        reg_number="REG-12345",
        address="Karol Bagh, New Delhi",
        lat=None,
        lng=None,
    )
    db.add(ngo_prof)
    db.commit()
    assert ngo_prof.status == "pending"
    assert ngo_prof.rating_count == 0

    # 4. VerificationRequest
    v_req = VerificationRequest(
        subject_user_id=user.id,
        subject_type="provider",
        step=1,
    )
    db.add(v_req)
    db.commit()
    assert v_req.id is not None
    assert v_req.status == "pending"

    # 5. Document
    doc = Document(
        owner_id=user.id,
        kind="pan",
        private_path="/data/private/identity/sample.pdf",
    )
    db.add(doc)
    db.commit()
    assert doc.id is not None
    assert doc.deleted_at is None

    # 6. Listing
    now = datetime.now(timezone.utc)
    listing = Listing(
        provider_id=user.id,
        title="Surplus Meals",
        food_type="Rice and Lentils",
        quantity=25.0,
        unit="portions",
        est_meals=25,
        est_kg=10.0,
        window_start=now,
        window_end=now,
        address="Connaught Place, New Delhi",
        lat=28.63,
        lng=77.21,
    )
    db.add(listing)
    db.commit()
    assert listing.id is not None
    assert listing.status == "listed"

    # 7. Proof
    proof = Proof(
        listing_id=listing.id,
        ngo_id=ngo_user.id,
        document_id=doc.id,
        note="Received in good condition",
    )
    db.add(proof)
    db.commit()
    assert proof.id is not None
    assert proof.review_status == "pending"

    # 8. Rating
    rating = Rating(
        listing_id=listing.id,
        kind="ngo_to_provider",
        stars=5,
        comment="Great food!",
    )
    db.add(rating)
    db.commit()
    assert rating.id is not None


def test_unique_rating_constraint(db):
    user = User(
        email="rater@example.com",
        password_hash="hashedpass",
        role="provider",
        name="Rater",
        phone="9876543210",
    )
    db.add(user)
    db.commit()

    now = datetime.now(timezone.utc)
    listing = Listing(
        provider_id=user.id,
        title="Sample Meals",
        food_type="Meals",
        quantity=10.0,
        unit="kg",
        est_meals=25,
        est_kg=10.0,
        window_start=now,
        window_end=now,
        address="Delhi",
        lat=28.6,
        lng=77.2,
    )
    db.add(listing)
    db.commit()

    r1 = Rating(listing_id=listing.id, kind="ngo_to_provider", stars=5)
    db.add(r1)
    db.commit()

    # Second rating with same (listing_id, kind) must raise IntegrityError
    r2 = Rating(listing_id=listing.id, kind="ngo_to_provider", stars=4)
    db.add(r2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
