"""PENDING NGOS and PENDING DONORS on the admin overview follow the verification queue exactly.

These run the real app end to end (register, submit, decide, delete, reset), not fixtures, so the overview and the
verification flow cannot drift apart.
"""
import pytest

from app.auth.security import hash_password
from app.db.models import NgoProfile, ProviderProfile, User, VerificationRequest
from tests.conftest import auth_header

API = "/api/v1"
PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"


@pytest.fixture(autouse=True)
def private_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))


@pytest.fixture()
def admin(client, db):
    db.add(User(email="admin@example.com", password_hash=hash_password("Admin1234!"), role="admin", name="Admin", is_active=True))
    db.commit()
    token = client.post(f"{API}/auth/login", json={"email": "admin@example.com", "password": "Admin1234!"}).json()["access_token"]
    return auth_header(token)


def stats(client, admin):
    body = client.get(f"{API}/admin/stats", headers=admin).json()
    return body["ngos_pending"], body["providers_pending"]


def register(client, role, n):
    base = {"email": f"{role}{n}@example.com", "password": "Password1!", "role": role, "name": f"{role} {n}", "phone": "+919000000000",
            "org_name": f"Org {role} {n}", "address": "Delhi", "lat": 28.6, "lng": 77.2}
    base.update({"reg_number": f"R{n}"} if role == "ngo" else {"category": "restaurant"})
    token = client.post(f"{API}/auth/register", json=base).json()["access_token"]
    return auth_header(token)


def submit_ngo(client, headers):
    r = client.post(f"{API}/verification/ngo", headers=headers, data={"reg_number": "REG/1"}, files={"ngo_reg": ("r.pdf", PDF, "application/pdf")})
    assert r.status_code == 201, r.text


def submit_donor(client, headers):
    r = client.post(
        f"{API}/verification/provider", headers=headers,
        data={"entity_name": "Kitchen", "pan_number": "ABCDE1234F", "aadhaar_number": "987654321098", "fssai_number": "11112222333344"},
        files={"business_proof": ("b.pdf", PDF, "application/pdf"), "fssai_cert": ("c.pdf", PDF, "application/pdf")},
    )
    assert r.status_code == 201, r.text


def queue(client, admin, **params):
    return client.get(f"{API}/admin/verifications", headers=admin, params=params).json()


def decide(client, admin, vr_id, decision, reason=None):
    data = {"decision": decision, **({"reason": reason} if reason else {})}
    r = client.post(f"{API}/admin/verifications/{vr_id}/decision", headers=admin, data=data)
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------- counts follow the queue
def test_empty_platform_has_no_pending(client, admin):
    assert stats(client, admin) == (0, 0)


def test_registering_alone_is_not_pending_until_a_request_is_submitted(client, admin):
    register(client, "ngo", 1)
    register(client, "provider", 1)
    assert stats(client, admin) == (0, 0)  # nobody is waiting for an admin yet


def test_submitting_adds_one_and_approving_each_returns_both_to_zero(client, admin):
    ngo, donor = register(client, "ngo", 1), register(client, "provider", 1)
    submit_ngo(client, ngo)
    assert stats(client, admin) == (1, 0)
    submit_donor(client, donor)
    assert stats(client, admin) == (1, 1)

    rows = {r["subject_type"]: r["id"] for r in queue(client, admin, status="pending")}
    decide(client, admin, rows["ngo"], "approved")
    assert stats(client, admin) == (0, 1)
    decide(client, admin, rows["provider"], "approved")
    assert stats(client, admin) == (0, 0)
    assert queue(client, admin, status="pending") == []


def test_approving_marks_the_account_verified(client, admin, db):
    ngo, donor = register(client, "ngo", 1), register(client, "provider", 1)
    submit_ngo(client, ngo)
    submit_donor(client, donor)
    for row in queue(client, admin, status="pending"):
        decide(client, admin, row["id"], "approved")
    db.expire_all()
    assert db.query(NgoProfile).one().status == "approved"
    assert db.query(ProviderProfile).one().verification_status == "approved"
    assert client.get(f"{API}/auth/me", headers=ngo).json()["verification_status"] == "approved"


def test_rejecting_also_clears_the_pending_count(client, admin):
    ngo, donor = register(client, "ngo", 1), register(client, "provider", 1)
    submit_ngo(client, ngo)
    submit_donor(client, donor)
    for row in queue(client, admin, status="pending"):
        decide(client, admin, row["id"], "rejected", "Documents unclear")
    assert stats(client, admin) == (0, 0)


def test_resubmitting_after_a_rejection_counts_again_for_ngos_and_donors(client, admin, db):
    ngo, donor = register(client, "ngo", 1), register(client, "provider", 1)
    submit_ngo(client, ngo)
    submit_donor(client, donor)
    for row in queue(client, admin, status="pending"):
        decide(client, admin, row["id"], "rejected", "Try again")
    assert stats(client, admin) == (0, 0)
    submit_ngo(client, ngo)
    submit_donor(client, donor)
    assert stats(client, admin) == (1, 1)
    db.expire_all()
    assert db.query(NgoProfile).one().status == "pending"  # the NGO profile no longer reads rejected
    for row in queue(client, admin, status="pending"):
        decide(client, admin, row["id"], "approved")
    assert stats(client, admin) == (0, 0)


def test_several_pending_requests_count_one_per_account(client, admin):
    for n in (1, 2, 3):
        submit_ngo(client, register(client, "ngo", n))
    for n in (1, 2):
        submit_donor(client, register(client, "provider", n))
    assert stats(client, admin) == (3, 2)
    ids = [r["id"] for r in queue(client, admin, status="pending") if r["subject_type"] == "ngo"]
    decide(client, admin, ids[0], "approved")
    assert stats(client, admin) == (2, 2)


# ---------------------------------------------------------------- already-approved accounts are never pending
def test_approved_accounts_are_not_counted_even_with_a_stale_open_request(client, admin, db):
    ngo = register(client, "ngo", 1)
    submit_ngo(client, ngo)
    assert stats(client, admin) == (1, 0)
    db.query(NgoProfile).update({"status": "approved"})  # approved some other way; the request is still open
    db.commit()
    assert stats(client, admin) == (0, 0)


def test_a_pending_profile_without_a_request_is_not_counted(client, admin, db):
    register(client, "ngo", 1)
    assert db.query(NgoProfile).one().status == "pending"
    assert db.query(VerificationRequest).count() == 0
    assert stats(client, admin) == (0, 0)


# ---------------------------------------------------------------- deleting and resetting
def test_deleting_a_pending_account_removes_it_from_the_counts(client, admin, db):
    ngo = register(client, "ngo", 1)
    submit_ngo(client, ngo)
    donor = register(client, "provider", 1)
    submit_donor(client, donor)
    assert stats(client, admin) == (1, 1)
    ngo_id = db.query(NgoProfile).one().user_id
    assert client.delete(f"{API}/admin/users/{ngo_id}", headers=admin).status_code == 200
    assert stats(client, admin) == (0, 1)


def test_reset_returns_everything_to_zero(client, admin):
    for n in (1, 2):
        submit_ngo(client, register(client, "ngo", n))
        submit_donor(client, register(client, "provider", n))
    assert stats(client, admin) == (2, 2)
    assert client.post(f"{API}/admin/users/reset", headers=admin).status_code == 200
    assert stats(client, admin) == (0, 0)
    body = client.get(f"{API}/admin/stats", headers=admin).json()
    assert body["total_users"] == 1  # just the admin


def test_total_users_and_pending_stay_consistent_with_the_queue(client, admin):
    submit_ngo(client, register(client, "ngo", 1))
    submit_donor(client, register(client, "provider", 1))
    body = client.get(f"{API}/admin/stats", headers=admin).json()
    pending_rows = queue(client, admin, status="pending")
    assert body["ngos_pending"] + body["providers_pending"] == len(pending_rows) == 2
    assert body["total_users"] == 3
