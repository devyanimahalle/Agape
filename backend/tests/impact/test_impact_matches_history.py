"""/impact and /impact/mine are aggregated from the real records: they move when pickups are completed, proofs are
approved, accounts are verified, deleted or reset, and they match what each signed-in user sees as their own history."""
from datetime import datetime, timedelta, timezone

import pytest

from app.auth.security import hash_password
from app.db.models import Listing, NgoProfile, ProviderProfile, User
from tests.conftest import auth_header

API = "/api/v1"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


@pytest.fixture(autouse=True)
def private_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))


@pytest.fixture()
def admin(client, db):
    db.add(User(email="admin@example.com", password_hash=hash_password("Admin1234!"), role="admin", name="Admin", is_active=True))
    db.commit()
    return auth_header(client.post(f"{API}/auth/login", json={"email": "admin@example.com", "password": "Admin1234!"}).json()["access_token"])


def register(client, db, role, n=1, approved=True, category="restaurant"):
    body = {"email": f"{role}{n}@example.com", "password": "Password1!", "role": role, "name": f"{role} {n}", "phone": "+919000000000",
            "org_name": f"{role.title()} Org {n}", "address": "Delhi", "lat": 28.6, "lng": 77.2}
    body.update({"reg_number": f"R{n}"} if role == "ngo" else {"category": category})
    token = client.post(f"{API}/auth/register", json=body).json()["access_token"]
    if approved:
        db.query(NgoProfile if role == "ngo" else ProviderProfile).filter_by(org_name=body["org_name"]).update(
            {"status" if role == "ngo" else "verification_status": "approved"}
        )
        db.commit()
    return auth_header(token)


def list_food(client, donor, title="Veg biryani", quantity=10, unit="kg"):
    now = datetime.now(timezone.utc)
    r = client.post(f"{API}/listings", headers=donor, json={
        "title": title, "food_type": "cooked meal", "quantity": quantity, "unit": unit,
        "window_start": (now + timedelta(seconds=30)).isoformat(), "window_end": (now + timedelta(hours=3)).isoformat(),
        "address": "Delhi", "lat": 28.6, "lng": 77.2,
    })
    assert r.status_code == 201, r.text
    listing_id = r.json()["id"]
    return listing_id, r.json()


def open_window(db, listing_id):
    db.query(Listing).filter_by(id=listing_id).update({"window_start": datetime.now(timezone.utc) - timedelta(minutes=5)})
    db.commit()


def collect(client, db, donor, ngo, **kw):
    listing_id, row = list_food(client, donor, **kw)
    open_window(db, listing_id)
    assert client.post(f"{API}/listings/{listing_id}/reserve", headers=ngo).status_code == 200
    assert client.post(f"{API}/listings/{listing_id}/complete", headers=ngo).status_code == 200
    return listing_id, row


def impact(client):
    return client.get(f"{API}/impact").json()


# ---------------------------------------------------------------- the public figures follow the records
def test_empty_platform_reports_zeros_and_no_history(client):
    data = impact(client)
    assert (data["meals_redistributed"], data["kg_saved"], data["listings_completed"]) == (0, 0, 0)
    assert (data["verified_donors"], data["verified_ngos"], data["meals_confirmed"]) == (0, 0, 0)
    assert data["by_month"] == [] and data["by_category"] == [] and data["recent"] == []
    assert data["by_status"] == {"listed": 0, "reserved": 0, "completed": 0, "cancelled": 0, "expired": 0}


def test_completing_a_pickup_moves_the_totals_the_breakdowns_and_recent_history(client, db):
    donor, ngo = register(client, db, "provider"), register(client, db, "ngo")
    listing_id, row = list_food(client, donor, quantity=10, unit="kg")
    assert impact(client)["by_status"]["listed"] == 1 and impact(client)["listings_completed"] == 0
    open_window(db, listing_id)
    client.post(f"{API}/listings/{listing_id}/reserve", headers=ngo)
    assert impact(client)["by_status"]["reserved"] == 1 and impact(client)["meals_redistributed"] == 0  # not collected yet

    client.post(f"{API}/listings/{listing_id}/complete", headers=ngo)
    data = impact(client)
    assert data["listings_completed"] == 1
    assert data["meals_redistributed"] == row["est_meals"] and data["kg_saved"] == pytest.approx(row["est_kg"])
    assert (data["active_ngos"], data["active_providers"]) == (1, 1)
    assert data["by_status"]["completed"] == 1 and data["by_status"]["reserved"] == 0
    assert data["by_category"] == [{"category": "restaurant", "listings": 1, "meals": row["est_meals"], "kg": pytest.approx(row["est_kg"])}]
    assert len(data["by_month"]) == 1 and data["by_month"][0]["meals"] == row["est_meals"]
    [recent] = data["recent"]
    assert (recent["id"], recent["title"], recent["est_meals"]) == (listing_id, "Veg biryani", row["est_meals"])
    assert recent["donor_category"] == "restaurant" and recent["proof_status"] == "none"


def test_public_history_names_nobody(client, db):
    donor, ngo = register(client, db, "provider"), register(client, db, "ngo")
    collect(client, db, donor, ngo)
    [recent] = impact(client)["recent"]
    assert recent["donor"] is None and recent["ngo"] is None
    assert "Org" not in client.get(f"{API}/impact").text


def test_verified_counts_follow_approvals(client, db):
    register(client, db, "provider", 1, approved=True)
    register(client, db, "provider", 2, approved=False)
    register(client, db, "ngo", 1, approved=True)
    register(client, db, "ngo", 2, approved=False)
    data = impact(client)
    assert (data["verified_donors"], data["verified_ngos"]) == (1, 1)
    db.query(NgoProfile).update({"status": "approved"})
    db.commit()
    assert impact(client)["verified_ngos"] == 2


def test_meals_are_confirmed_only_once_an_admin_approves_a_proof_of_donation(client, db, admin):
    donor, ngo = register(client, db, "provider"), register(client, db, "ngo")
    listing_id, row = collect(client, db, donor, ngo)
    assert (impact(client)["listings_confirmed"], impact(client)["meals_confirmed"]) == (0, 0)
    client.post(f"{API}/listings/{listing_id}/proof", headers=ngo, files=[("files", ("a.png", PNG, "image/png"))])
    assert impact(client)["meals_confirmed"] == 0 and impact(client)["recent"][0]["proof_status"] == "pending"

    proof_id = client.get(f"{API}/admin/proofs", headers=admin).json()[0]["id"]
    client.post(f"{API}/admin/proofs/{proof_id}/review", headers=admin, json={"decision": "approved", "stars": 5})
    data = impact(client)
    assert (data["listings_confirmed"], data["meals_confirmed"]) == (1, row["est_meals"])
    assert data["recent"][0]["proof_status"] == "approved"
    assert data["meals_redistributed"] == row["est_meals"]  # collected is unchanged by the review


def test_categories_split_collected_food_by_donor_kind(client, db):
    ngo = register(client, db, "ngo")
    collect(client, db, register(client, db, "provider", 1, category="restaurant"), ngo, quantity=10, unit="kg")
    collect(client, db, register(client, db, "provider", 2, category="general"), ngo, quantity=20, unit="portions")
    cats = {c["category"]: c for c in impact(client)["by_category"]}
    assert set(cats) == {"restaurant", "general"}
    assert cats["general"]["meals"] == 20 and cats["restaurant"]["listings"] == 1


def test_cancelled_pickups_never_count_as_impact(client, db):
    donor, ngo = register(client, db, "provider"), register(client, db, "ngo")
    listing_id, _ = list_food(client, donor)
    open_window(db, listing_id)
    client.post(f"{API}/listings/{listing_id}/reserve", headers=ngo)
    client.post(f"{API}/listings/{listing_id}/cancel-reservation", headers=ngo)
    data = impact(client)
    assert data["meals_redistributed"] == 0 and data["recent"] == []
    assert data["by_status"]["listed"] == 1


def test_deleting_and_resetting_accounts_updates_impact_at_once(client, db, admin):
    ngo = register(client, db, "ngo")
    d1, d2 = register(client, db, "provider", 1), register(client, db, "provider", 2)
    collect(client, db, d1, ngo)
    collect(client, db, d2, ngo)
    assert impact(client)["listings_completed"] == 2
    donor_id = db.query(ProviderProfile).filter_by(org_name="Provider Org 1").one().user_id
    assert client.delete(f"{API}/admin/users/{donor_id}", headers=admin).status_code == 200
    after = impact(client)
    assert after["listings_completed"] == 1 and after["active_providers"] == 1 and after["verified_donors"] == 1
    assert client.post(f"{API}/admin/users/reset", headers=admin).status_code == 200
    zero = impact(client)
    assert (zero["meals_redistributed"], zero["listings_completed"], zero["verified_donors"], zero["verified_ngos"]) == (0, 0, 0, 0)
    assert zero["recent"] == [] and zero["by_month"] == [] and sum(zero["by_status"].values()) == 0


# ---------------------------------------------------------------- the signed-in history matches
def test_my_impact_needs_a_session(client):
    assert client.get(f"{API}/impact/mine").status_code == 401


def test_donor_history_matches_their_own_listings_and_pickups(client, db, admin):
    donor, other = register(client, db, "provider", 1), register(client, db, "provider", 2)
    ngo = register(client, db, "ngo")
    done_id, done = collect(client, db, donor, ngo, title="Collected rice", quantity=10, unit="kg")
    list_food(client, donor, title="Still open")
    collect(client, db, other, ngo, title="Someone else's")  # must not leak into the first donor's numbers
    client.post(f"{API}/listings/{done_id}/proof", headers=ngo, files=[("files", ("a.png", PNG, "image/png"))])
    proof_id = client.get(f"{API}/admin/proofs", headers=admin).json()[0]["id"]
    client.post(f"{API}/admin/proofs/{proof_id}/review", headers=admin, json={"decision": "approved", "stars": 4})

    me = client.get(f"{API}/impact/mine", headers=donor).json()
    assert me["role"] == "provider"
    s = me["summary"]
    assert (s["listings_total"], s["listings_open"], s["pickups_completed"]) == (2, 1, 1)
    assert s["meals_donated"] == done["est_meals"] and s["kg_donated"] == pytest.approx(done["est_kg"])
    assert (s["proofs_approved"], s["proofs_awaiting"]) == (1, 0)
    [recent] = me["recent"]
    assert recent["title"] == "Collected rice" and recent["ngo"] == "Ngo Org 1" and recent["proof_status"] == "approved"
    # and it agrees with the donor's own listings view
    mine = client.get(f"{API}/listings/mine", headers=donor).json()
    assert sorted(r["status"] for r in mine) == ["completed", "listed"]


def test_ngo_history_matches_its_reservations_and_proof_state(client, db):
    donor, ngo = register(client, db, "provider"), register(client, db, "ngo")
    a, _ = collect(client, db, donor, ngo, title="A")
    b, _ = collect(client, db, donor, ngo, title="B")
    c, _ = list_food(client, donor, title="C")
    open_window(db, c)
    client.post(f"{API}/listings/{c}/reserve", headers=ngo)
    client.post(f"{API}/listings/{a}/proof", headers=ngo, files=[("files", ("a.png", PNG, "image/png"))])

    me = client.get(f"{API}/impact/mine", headers=ngo).json()
    s = me["summary"]
    assert me["role"] == "ngo"
    assert (s["reservations_open"], s["pickups_completed"]) == (1, 2)
    assert (s["proofs_awaiting"], s["proofs_approved"], s["proofs_needed"]) == (1, 0, 1)
    reservations = client.get(f"{API}/ngo/reservations", headers=ngo).json()
    assert sorted(r["status"] for r in reservations) == ["completed", "completed", "reserved"]
    assert {r["id"]: r["proof_status"] for r in reservations if r["status"] == "completed"} == {a: "pending", b: "none"}
    assert {r["title"] for r in me["recent"]} == {"A", "B"} and all(r["donor"] == "Provider Org 1" for r in me["recent"])


def test_admin_summary_matches_the_platform(client, db, admin):
    donor, ngo = register(client, db, "provider"), register(client, db, "ngo")
    register(client, db, "ngo", 2, approved=False)
    listing_id, _ = collect(client, db, donor, ngo)
    client.post(f"{API}/listings/{listing_id}/proof", headers=ngo, files=[("files", ("a.png", PNG, "image/png"))])
    me = client.get(f"{API}/impact/mine", headers=admin).json()
    assert me["role"] == "admin"
    s = me["summary"]
    assert (s["users_total"], s["verified_donors"], s["verified_ngos"]) == (4, 1, 1)
    assert (s["proofs_awaiting_review"], s["pickups_completed"]) == (1, 1)
    stats = client.get(f"{API}/admin/stats", headers=admin).json()
    assert stats["total_users"] == s["users_total"] and stats["listings_by_status"]["completed"] == s["pickups_completed"]


def test_deleting_an_ngo_releases_its_pickups_so_they_leave_the_totals(client, db, admin):
    donor, ngo = register(client, db, "provider"), register(client, db, "ngo")
    collect(client, db, donor, ngo)
    assert impact(client)["listings_completed"] == 1
    ngo_id = db.query(NgoProfile).one().user_id
    assert client.delete(f"{API}/admin/users/{ngo_id}", headers=admin).status_code == 200
    data = impact(client)
    assert data["listings_completed"] == 0 and data["meals_redistributed"] == 0
    assert data["by_status"]["cancelled"] == 1 and data["verified_ngos"] == 0
