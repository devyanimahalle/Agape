"""Admin-specific test fixtures — seed users, profiles, listings, proofs, ratings."""
from datetime import datetime, timezone

import pytest
from sqlalchemy.orm import Session

from backend.app.db.models import (
    Document,
    Listing,
    NgoProfile,
    Proof,
    ProviderProfile,
    Rating,
    User,
)


@pytest.fixture()
def seed_admin_data(db_session: Session):
    """
    Populate the DB with a known set of entities for admin tests.

    Users:
      id=10 admin
      id=20 provider (pending verification)
      id=21 provider (approved verification)
      id=30 ngo (pending status)
      id=31 ngo (approved status)

    Listings:
      id=100 listed (provider 20)
      id=101 reserved (provider 20, ngo 30)
      id=102 completed (provider 21, ngo 31)
      id=103 cancelled (provider 21)
      id=104 expired (provider 20)

    Documents:
      id=200

    Proofs:
      id=300 pending (listing 102, ngo 31)
      id=301 approved (listing 101, ngo 30) — already reviewed

    Ratings:
      id=400 admin_to_ngo for listing 101
    """
    # Users
    admin = User(id=10, email="admin@test.com", password_hash="x", role="admin", name="Admin", is_active=True, created_at=datetime(2024, 1, 1, tzinfo=timezone.utc))
    prov1 = User(id=20, email="prov1@test.com", password_hash="x", role="provider", name="Provider One", is_active=True, created_at=datetime(2024, 1, 2, tzinfo=timezone.utc))
    prov2 = User(id=21, email="prov2@test.com", password_hash="x", role="provider", name="Provider Two", is_active=True, created_at=datetime(2024, 1, 3, tzinfo=timezone.utc))
    ngo1 = User(id=30, email="ngo1@test.com", password_hash="x", role="ngo", name="NGO One", is_active=True, created_at=datetime(2024, 1, 4, tzinfo=timezone.utc))
    ngo2 = User(id=31, email="ngo2@test.com", password_hash="x", role="ngo", name="NGO Two", is_active=False, created_at=datetime(2024, 1, 5, tzinfo=timezone.utc))
    db_session.add_all([admin, prov1, prov2, ngo1, ngo2])
    db_session.flush()

    # Provider profiles
    pp1 = ProviderProfile(user_id=20, category="restaurant", org_name="Resto One", verification_status="pending", rating_avg=0.0, rating_count=0)
    pp2 = ProviderProfile(user_id=21, category="catering", org_name="Catering Two", verification_status="approved", rating_avg=4.5, rating_count=2)
    db_session.add_all([pp1, pp2])
    db_session.flush()

    # NGO profiles
    np1 = NgoProfile(user_id=30, org_name="NGO Alpha", reg_number="REG001", status="pending", rating_avg=0.0, rating_count=0)
    np2 = NgoProfile(user_id=31, org_name="NGO Beta", reg_number="REG002", status="approved", rating_avg=3.0, rating_count=1)
    db_session.add_all([np1, np2])
    db_session.flush()

    # Listings
    l1 = Listing(id=100, provider_id=20, title="Surplus Rice", food_type="rice", quantity=10.0, unit="kg", est_meals=20, est_kg=10.0, status="listed", created_at=datetime(2024, 2, 1, tzinfo=timezone.utc))
    l2 = Listing(id=101, provider_id=20, title="Extra Bread", food_type="bread", quantity=5.0, unit="kg", est_meals=10, est_kg=5.0, status="reserved", reserved_by_ngo_id=30, reserved_at=datetime(2024, 2, 5, tzinfo=timezone.utc), created_at=datetime(2024, 2, 2, tzinfo=timezone.utc))
    l3 = Listing(id=102, provider_id=21, title="Leftover Curry", food_type="curry", quantity=8.0, unit="portions", est_meals=8, est_kg=4.0, status="completed", reserved_by_ngo_id=31, completed_at=datetime(2024, 3, 1, tzinfo=timezone.utc), created_at=datetime(2024, 2, 3, tzinfo=timezone.utc))
    l4 = Listing(id=103, provider_id=21, title="Cancelled Meals", food_type="mixed", quantity=3.0, unit="portions", est_meals=3, est_kg=1.5, status="cancelled", created_at=datetime(2024, 2, 4, tzinfo=timezone.utc))
    l5 = Listing(id=104, provider_id=20, title="Expired Fruit", food_type="fruit", quantity=2.0, unit="kg", est_meals=4, est_kg=2.0, status="expired", created_at=datetime(2024, 2, 5, tzinfo=timezone.utc))
    db_session.add_all([l1, l2, l3, l4, l5])
    db_session.flush()

    # Documents
    doc = Document(id=200, owner_id=31, kind="proof_photo", private_path="/uploads/proof1.jpg", created_at=datetime(2024, 3, 1, tzinfo=timezone.utc))
    doc2 = Document(id=201, owner_id=30, kind="proof_photo", private_path="/uploads/proof2.jpg", created_at=datetime(2024, 3, 2, tzinfo=timezone.utc))
    db_session.add_all([doc, doc2])
    db_session.flush()

    # Proofs
    proof1 = Proof(id=300, listing_id=102, ngo_id=31, document_id=200, note="Delivered successfully", review_status="pending", created_at=datetime(2024, 3, 2, tzinfo=timezone.utc))
    proof2 = Proof(id=301, listing_id=101, ngo_id=30, document_id=201, note="Picked up", review_status="approved", created_at=datetime(2024, 3, 3, tzinfo=timezone.utc))
    db_session.add_all([proof1, proof2])
    db_session.flush()

    # Ratings (existing)
    rating1 = Rating(id=400, listing_id=101, kind="admin_to_ngo", stars=4, comment="Good work", created_at=datetime(2024, 3, 4, tzinfo=timezone.utc))
    db_session.add(rating1)
    db_session.commit()

    return {
        "users": [admin, prov1, prov2, ngo1, ngo2],
        "provider_profiles": [pp1, pp2],
        "ngo_profiles": [np1, np2],
        "listings": [l1, l2, l3, l4, l5],
        "proofs": [proof1, proof2],
        "ratings": [rating1],
    }
