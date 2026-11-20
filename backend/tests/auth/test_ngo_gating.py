"""NGOs must be admin-approved before they can see the board, list reservations or reserve food."""
from datetime import datetime, timedelta, timezone

import pytest

from app.db.models import Listing, NgoProfile, ProviderProfile, User
from tests.conftest import auth_header

API = "/api/v1"


def _ngo(client, db, status):
    payload = {
        "email": f"ngo-{status}@example.com", "password": "Password1!", "role": "ngo", "name": "NGO",
        "phone": "+919000000000", "org_name": "Helpers", "reg_number": "R1",
        "address": "Delhi", "lat": 28.61, "lng": 77.2,
    }
    token = client.post(f"{API}/auth/register", json=payload).json()["access_token"]
    db.query(NgoProfile).update({"status": status})
    db.commit()
    return token


@pytest.fixture()
def open_listing(db):
    provider = User(email="donor@example.com", password_hash="x", role="provider", name="Donor", is_active=True)
    db.add(provider)
    db.flush()
    db.add(ProviderProfile(user_id=provider.id, category="restaurant", org_name="Kitchen", verification_status="approved"))
    now = datetime.now(timezone.utc)
    listing = Listing(
        provider_id=provider.id, title="Rice", food_type="meal", quantity=5, unit="kg", est_meals=12, est_kg=5,
        window_start=now - timedelta(minutes=5), window_end=now + timedelta(hours=2), address="Delhi",
        lat=28.62, lng=77.21, status="listed",
    )
    db.add(listing)
    db.commit()
    return listing.id


@pytest.mark.parametrize("status", ["pending", "rejected"])
def test_unapproved_ngo_is_blocked_everywhere(client, db, open_listing, status):
    h = auth_header(_ngo(client, db, status))
    for method, path in (
        ("get", f"{API}/board"),
        ("get", f"{API}/ngo/reservations"),
        ("post", f"{API}/listings/{open_listing}/reserve"),
    ):
        r = getattr(client, method)(path, headers=h)
        assert r.status_code == 403, path
        assert r.json()["code"] == "NOT_VERIFIED", path


def test_approved_ngo_sees_the_board_reservations_and_donor_listings(client, db, open_listing):
    h = auth_header(_ngo(client, db, "approved"))
    board = client.get(f"{API}/board", headers=h)
    assert board.status_code == 200
    assert [row["title"] for row in board.json()] == ["Rice"]
    assert client.get(f"{API}/ngo/reservations", headers=h).status_code == 200
    assert client.post(f"{API}/listings/{open_listing}/reserve", headers=h).status_code == 200


def test_ngo_without_a_session_gets_401(client):
    assert client.get(f"{API}/board").status_code == 401


def test_board_timestamps_carry_a_timezone_even_on_sqlite(client, db, open_listing):
    """Naive timestamps are read as local time by browsers, which hid listings hours early (e.g. in India)."""
    h = auth_header(_ngo(client, db, "approved"))
    row = client.get(f"{API}/board", headers=h).json()[0]
    for key in ("window_start", "window_end", "created_at"):
        assert row[key].endswith("Z") or row[key].endswith("+00:00"), (key, row[key])
