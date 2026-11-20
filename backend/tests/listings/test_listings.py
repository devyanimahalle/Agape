from datetime import datetime, timedelta, timezone

import pytest

from app.db.models import Listing, ProviderProfile
from app.listings import config
from app.listings.service import estimate, expire_listings
from tests.conftest import NGO, PROVIDER, auth_header

API = "/api/v1"


def _dt(hours: float) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


_SAME = _dt(3)  # one fixed timestamp, so start and end are truly equal


def listing_body(**over):
    body = {
        "title": "Veg biryani",
        "food_type": "cooked meals",
        "quantity": 10,
        "unit": "kg",
        "window_start": _dt(1),
        "window_end": _dt(3),
        "address": "MG Road, Bengaluru",
        "lat": 12.97,
        "lng": 77.59,
        "notes": "Back gate",
    }
    body.update(over)
    return body


def make_provider(client, db, email="p@example.com", category="restaurant", verified=True):
    payload = dict(PROVIDER, email=email, category=category)
    token = client.post(f"{API}/auth/register", json=payload).json()["access_token"]
    if verified:
        db.query(ProviderProfile).filter(ProviderProfile.category == category).update(
            {"verification_status": "approved"}
        )
        db.commit()
    return token


@pytest.fixture()
def token(client, db):
    return make_provider(client, db)


def create(client, token, **over):
    return client.post(f"{API}/listings", json=listing_body(**over), headers=auth_header(token))


# ---------------------------------------------------------------- estimates
def test_estimate_kg_and_portions():
    assert estimate(10, "kg") == (25, 10.0)
    assert estimate(10, "portions") == (10, 4.0)


def test_estimate_uses_configurable_constant(monkeypatch):
    monkeypatch.setattr(config, "MEAL_KG", 0.5)
    assert estimate(10, "kg") == (20, 10.0)
    assert estimate(10, "portions") == (10, 5.0)


# ------------------------------------------------------------------- create
def test_create_listing_ok(client, token):
    r = create(client, token)
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "listed"
    assert body["est_meals"] == 25 and body["est_kg"] == 10.0
    assert body["reserved_by_ngo_id"] is None
    assert body["window_start"].endswith("Z")


def test_create_requires_login(client):
    r = client.post(f"{API}/listings", json=listing_body())
    assert r.status_code == 401


def test_create_ngo_forbidden(client):
    t = client.post(f"{API}/auth/register", json=NGO).json()["access_token"]
    r = create(client, t)
    assert r.status_code == 403 and r.json()["code"] == "FORBIDDEN"


@pytest.mark.parametrize("category", ["restaurant", "caterer"])
def test_create_unverified_provider_blocked(client, db, category):
    t = make_provider(client, db, category=category, verified=False)
    r = create(client, t)
    assert r.status_code == 403
    assert r.json()["code"] == "NOT_VERIFIED"


def test_create_general_provider_needs_no_verification(client, db):
    t = make_provider(client, db, email="g@example.com", category="general", verified=False)
    assert create(client, t).status_code == 201


@pytest.mark.parametrize(
    "override",
    [
        {"quantity": 0},
        {"quantity": -5},
        {"unit": "litres"},
        {"title": "   "},
        {"window_start": _dt(-1)},  # in the past
        {"window_start": _SAME, "window_end": _SAME},  # equal
        {"window_start": _dt(3), "window_end": _dt(1)},  # end before start
        {"lat": 200},
        {"window_start": "not-a-date"},
    ],
)
def test_create_validation_failures(client, token, override):
    r = create(client, token, **override)
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"


def test_create_missing_field(client, token):
    body = listing_body()
    del body["title"]
    r = client.post(f"{API}/listings", json=body, headers=auth_header(token))
    assert r.status_code == 422 and "title" in r.json()["detail"]


# --------------------------------------------------------------------- mine
def test_mine_only_returns_own_and_filters_status(client, db, token):
    other = make_provider(client, db, email="q@example.com", category="caterer")
    own1 = create(client, token).json()
    own2 = create(client, token, title="Second").json()
    create(client, other)
    client.post(f"{API}/listings/{own2['id']}/cancel", headers=auth_header(token))

    all_mine = client.get(f"{API}/listings/mine", headers=auth_header(token)).json()
    assert {x["id"] for x in all_mine} == {own1["id"], own2["id"]}

    cancelled = client.get(
        f"{API}/listings/mine?status=cancelled", headers=auth_header(token)
    ).json()
    assert [x["id"] for x in cancelled] == [own2["id"]]


def test_mine_invalid_status(client, token):
    r = client.get(f"{API}/listings/mine?status=bogus", headers=auth_header(token))
    assert r.status_code == 422 and r.json()["code"] == "VALIDATION_ERROR"


def test_mine_requires_provider(client):
    t = client.post(f"{API}/auth/register", json=NGO).json()["access_token"]
    assert client.get(f"{API}/listings/mine", headers=auth_header(t)).status_code == 403


# -------------------------------------------------------------------- patch
def test_patch_updates_and_recalculates_estimates(client, token):
    lid = create(client, token).json()["id"]
    r = client.patch(
        f"{API}/listings/{lid}",
        json={"quantity": 20, "unit": "portions", "title": "Updated"},
        headers=auth_header(token),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["title"] == "Updated"
    assert body["est_meals"] == 20 and body["est_kg"] == 8.0


def test_patch_owner_only(client, db, token):
    lid = create(client, token).json()["id"]
    other = make_provider(client, db, email="q@example.com", category="caterer")
    r = client.patch(f"{API}/listings/{lid}", json={"title": "Hack"}, headers=auth_header(other))
    assert r.status_code == 403 and r.json()["code"] == "NOT_OWNER"


def test_patch_not_found(client, token):
    r = client.patch(f"{API}/listings/9999", json={"title": "x"}, headers=auth_header(token))
    assert r.status_code == 404


def test_patch_blocked_when_not_listed(client, db, token):
    lid = create(client, token).json()["id"]
    db.query(Listing).filter(Listing.id == lid).update({"status": "reserved"})
    db.commit()
    r = client.patch(f"{API}/listings/{lid}", json={"title": "x"}, headers=auth_header(token))
    assert r.status_code == 409 and r.json()["code"] == "LISTING_NOT_EDITABLE"


@pytest.mark.parametrize(
    "payload",
    [
        {"status": "completed"},  # unknown/forbidden field
        {"reserved_by_ngo_id": 5},
        {"quantity": 0},
        {"title": None},
        {},
        {"window_start": _dt(-2)},
        {"window_end": _dt(0.5)},  # before existing start (1h)
    ],
)
def test_patch_validation_failures(client, token, payload):
    lid = create(client, token).json()["id"]
    r = client.patch(f"{API}/listings/{lid}", json=payload, headers=auth_header(token))
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"


# ------------------------------------------------------------------- cancel
def test_cancel_ok_then_conflict(client, token):
    lid = create(client, token).json()["id"]
    r = client.post(f"{API}/listings/{lid}/cancel", headers=auth_header(token))
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    again = client.post(f"{API}/listings/{lid}/cancel", headers=auth_header(token))
    assert again.status_code == 409


def test_cancel_owner_only(client, db, token):
    lid = create(client, token).json()["id"]
    other = make_provider(client, db, email="q@example.com", category="caterer")
    r = client.post(f"{API}/listings/{lid}/cancel", headers=auth_header(other))
    assert r.status_code == 403 and r.json()["code"] == "NOT_OWNER"


def test_cancel_reserved_listing_conflicts(client, db, token):
    lid = create(client, token).json()["id"]
    db.query(Listing).filter(Listing.id == lid).update({"status": "reserved"})
    db.commit()
    r = client.post(f"{API}/listings/{lid}/cancel", headers=auth_header(token))
    assert r.status_code == 409


# ------------------------------------------------------------------- expiry
def _insert(db, status, window_end, provider_id=1):
    now = datetime.now(timezone.utc)
    row = Listing(
        provider_id=provider_id,
        title="t",
        food_type="f",
        quantity=1,
        unit="kg",
        est_meals=3,
        est_kg=1.0,
        window_start=now - timedelta(hours=5),
        window_end=window_end,
        address="a",
        lat=1.0,
        lng=1.0,
        status=status,
    )
    db.add(row)
    db.commit()
    return row.id


def test_expiry_job_only_expires_listed_past_window(client, db, token):
    now = datetime.now(timezone.utc)
    past, future = now - timedelta(hours=1), now + timedelta(hours=1)
    expired_id = _insert(db, "listed", past)
    future_id = _insert(db, "listed", future)
    reserved_id = _insert(db, "reserved", past)
    completed_id = _insert(db, "completed", past)

    assert expire_listings(db) == 1
    db.expire_all()
    status = {r.id: r.status for r in db.query(Listing).all()}
    assert status[expired_id] == "expired"
    assert status[future_id] == "listed"
    assert status[reserved_id] == "reserved"
    assert status[completed_id] == "completed"
    assert expire_listings(db) == 0  # idempotent
