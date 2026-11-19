"""Impact-specific test fixtures — seed completed listings for predictable aggregation."""
from datetime import datetime, timezone

import pytest
from sqlalchemy.orm import Session

try:
    from app.db.models import Listing, User, NgoProfile, ProviderProfile
except ImportError:
    from backend.app.db.models import Listing, User, NgoProfile, ProviderProfile


@pytest.fixture()
def seed_impact_data(db_session: Session):
    """
    Seed data for impact tests.

    Users:
      id=50 provider
      id=51 provider
      id=60 ngo
      id=61 ngo

    Completed listings (3):
      id=500: provider=50, ngo=60, est_meals=100, est_kg=50.0, completed_at=2024-01-15
      id=501: provider=50, ngo=61, est_meals=200, est_kg=80.0, completed_at=2024-01-20
      id=502: provider=51, ngo=60, est_meals=50,  est_kg=25.0, completed_at=2024-02-10

    Non-completed listing (should be excluded):
      id=503: provider=51, status=listed
    """
    p1 = User(id=50, email="p1@test.com", password_hash="x", role="provider", name="P1", is_active=True, created_at=datetime(2024, 1, 1, tzinfo=timezone.utc))
    p2 = User(id=51, email="p2@test.com", password_hash="x", role="provider", name="P2", is_active=True, created_at=datetime(2024, 1, 1, tzinfo=timezone.utc))
    n1 = User(id=60, email="n1@test.com", password_hash="x", role="ngo", name="N1", is_active=True, created_at=datetime(2024, 1, 1, tzinfo=timezone.utc))
    n2 = User(id=61, email="n2@test.com", password_hash="x", role="ngo", name="N2", is_active=True, created_at=datetime(2024, 1, 1, tzinfo=timezone.utc))
    db_session.add_all([p1, p2, n1, n2])
    db_session.flush()

    l1 = Listing(
        window_start=datetime(2024, 1, 1, tzinfo=timezone.utc), window_end=datetime(2024, 1, 2, tzinfo=timezone.utc), address="1 Test Rd",
        id=500, provider_id=50, title="Meals A", food_type="rice",
        quantity=50.0, unit="kg", est_meals=100, est_kg=50.0,
        status="completed", reserved_by_ngo_id=60,
        completed_at=datetime(2024, 1, 15, tzinfo=timezone.utc),
        created_at=datetime(2024, 1, 10, tzinfo=timezone.utc),
    )
    l2 = Listing(
        window_start=datetime(2024, 1, 1, tzinfo=timezone.utc), window_end=datetime(2024, 1, 2, tzinfo=timezone.utc), address="1 Test Rd",
        id=501, provider_id=50, title="Meals B", food_type="bread",
        quantity=80.0, unit="kg", est_meals=200, est_kg=80.0,
        status="completed", reserved_by_ngo_id=61,
        completed_at=datetime(2024, 1, 20, tzinfo=timezone.utc),
        created_at=datetime(2024, 1, 12, tzinfo=timezone.utc),
    )
    l3 = Listing(
        window_start=datetime(2024, 1, 1, tzinfo=timezone.utc), window_end=datetime(2024, 1, 2, tzinfo=timezone.utc), address="1 Test Rd",
        id=502, provider_id=51, title="Meals C", food_type="curry",
        quantity=25.0, unit="portions", est_meals=50, est_kg=25.0,
        status="completed", reserved_by_ngo_id=60,
        completed_at=datetime(2024, 2, 10, tzinfo=timezone.utc),
        created_at=datetime(2024, 2, 1, tzinfo=timezone.utc),
    )
    l4 = Listing(
        window_start=datetime(2024, 1, 1, tzinfo=timezone.utc), window_end=datetime(2024, 1, 2, tzinfo=timezone.utc), address="1 Test Rd",
        id=503, provider_id=51, title="Still Listed", food_type="fruit",
        quantity=10.0, unit="kg", est_meals=20, est_kg=10.0,
        status="listed",
        created_at=datetime(2024, 2, 5, tzinfo=timezone.utc),
    )
    db_session.add_all([l1, l2, l3, l4])
    db_session.commit()

    return {
        "listings": [l1, l2, l3, l4],
        "total_meals": 350,  # 100 + 200 + 50
        "total_kg": 155.0,   # 50 + 80 + 25
        "completed_count": 3,
        "active_ngos": 2,     # 60, 61
        "active_providers": 2,  # 50, 51
    }
