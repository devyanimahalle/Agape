"""One-click pickup confirmation, then proof of donation on its own step, visible to the admin."""
from datetime import datetime, timedelta, timezone

import pytest

from app.auth.security import hash_password
from app.db.models import Document, Listing, NgoProfile, Proof, ProviderProfile, User
from tests.conftest import auth_header

API = "/api/v1"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"


@pytest.fixture(autouse=True)
def private_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))


def _register_ngo(client, db, email="ngo@example.com", status="approved"):
    payload = {
        "email": email, "password": "Password1!", "role": "ngo", "name": "NGO", "phone": "+919000000000",
        "org_name": "Helpers", "reg_number": "R1", "address": "Delhi", "lat": 28.61, "lng": 77.2,
    }
    token = client.post(f"{API}/auth/register", json=payload).json()["access_token"]
    db.query(NgoProfile).filter(NgoProfile.org_name == "Helpers").update({"status": status})
    db.commit()
    return token


def _admin(client, db):
    db.add(User(email="admin@example.com", password_hash=hash_password("Admin1234!"), role="admin", name="Admin", is_active=True))
    db.commit()
    r = client.post(f"{API}/auth/login", json={"email": "admin@example.com", "password": "Admin1234!"})
    return r.json()["access_token"]


@pytest.fixture()
def listing_id(db):
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


@pytest.fixture()
def reserved(client, db, listing_id):
    token = _register_ngo(client, db)
    assert client.post(f"{API}/listings/{listing_id}/reserve", headers=auth_header(token)).status_code == 200
    return token


def reservation(client, token, listing_id):
    rows = client.get(f"{API}/ngo/reservations", headers=auth_header(token)).json()
    return next(r for r in rows if r["id"] == listing_id)


# ---------------------------------------------------------------- (a) confirm pickup without files
def test_confirm_pickup_needs_no_file(client, db, reserved, listing_id):
    r = client.post(f"{API}/listings/{listing_id}/complete", headers=auth_header(reserved))
    assert r.status_code == 200
    assert r.json()["status"] == "completed" and r.json()["completed_at"]
    assert db.query(Proof).count() == 0 and db.query(Document).count() == 0
    row = reservation(client, reserved, listing_id)
    assert (row["status"], row["proof_status"], row["proof_count"]) == ("completed", "none", 0)


def test_confirm_pickup_is_still_one_time_and_owner_only(client, db, reserved, listing_id):
    assert client.post(f"{API}/listings/{listing_id}/complete", headers=auth_header(reserved)).status_code == 200
    again = client.post(f"{API}/listings/{listing_id}/complete", headers=auth_header(reserved))
    assert again.status_code == 409 and again.json()["code"] == "INVALID_STATE"
    other = _register_ngo(client, db, email="other@example.com")
    r = client.post(f"{API}/listings/{listing_id}/complete", headers=auth_header(other))
    assert r.status_code in (403, 409)


def test_confirm_pickup_with_files_still_works_for_old_clients(client, db, reserved, listing_id):
    r = client.post(
        f"{API}/listings/{listing_id}/complete", headers=auth_header(reserved), data={"note": "all handed out"},
        files=[("files", ("a.png", PNG, "image/png"))],
    )
    assert r.status_code == 200
    assert db.query(Proof).count() == 1
    assert reservation(client, reserved, listing_id)["proof_status"] == "pending"


# ---------------------------------------------------------------- (b) proof of donation on its own step
def test_proof_of_donation_is_uploaded_after_the_pickup(client, db, reserved, listing_id):
    h = auth_header(reserved)
    client.post(f"{API}/listings/{listing_id}/complete", headers=h)
    r = client.post(
        f"{API}/listings/{listing_id}/proof", headers=h, data={"note": "62 meals handed out at the shelter"},
        files=[("files", ("photo.png", PNG, "image/png")), ("files", ("sheet.pdf", PDF, "application/pdf"))],
    )
    assert r.status_code == 201
    assert r.json() == {"listing_id": listing_id, "added": 2, "proof_status": "pending", "proof_count": 2}
    proofs = db.query(Proof).filter_by(listing_id=listing_id).all()
    assert len(proofs) == 2 and {p.note for p in proofs} == {"62 meals handed out at the shelter"}
    assert all(p.review_status == "pending" for p in proofs)
    row = reservation(client, reserved, listing_id)
    assert (row["proof_status"], row["proof_count"]) == ("pending", 2)


def test_proof_needs_at_least_one_file(client, db, reserved, listing_id):
    h = auth_header(reserved)
    client.post(f"{API}/listings/{listing_id}/complete", headers=h)
    r = client.post(f"{API}/listings/{listing_id}/proof", headers=h, data={"note": "no files"})
    assert r.status_code == 400 and r.json()["code"] == "PROOF_REQUIRED"
    assert db.query(Proof).count() == 0


def test_proof_rejects_bad_files_and_keeps_nothing(client, db, reserved, listing_id):
    h = auth_header(reserved)
    client.post(f"{API}/listings/{listing_id}/complete", headers=h)
    r = client.post(
        f"{API}/listings/{listing_id}/proof", headers=h,
        files=[("files", ("good.png", PNG, "image/png")), ("files", ("evil.png", b"<script>1</script>", "image/png"))],
    )
    assert r.status_code == 400 and r.json()["code"] == "INVALID_FILE_TYPE"
    assert db.query(Proof).count() == 0 and db.query(Document).count() == 0


def test_proof_is_refused_before_the_pickup_is_confirmed(client, db, reserved, listing_id):
    r = client.post(f"{API}/listings/{listing_id}/proof", headers=auth_header(reserved), files=[("files", ("a.png", PNG, "image/png"))])
    assert r.status_code == 409 and r.json()["code"] == "INVALID_STATE"


def test_only_the_collecting_ngo_can_upload_proof(client, db, reserved, listing_id):
    client.post(f"{API}/listings/{listing_id}/complete", headers=auth_header(reserved))
    other = _register_ngo(client, db, email="other@example.com")
    r = client.post(f"{API}/listings/{listing_id}/proof", headers=auth_header(other), files=[("files", ("a.png", PNG, "image/png"))])
    assert r.status_code == 403
    assert client.post(f"{API}/listings/999/proof", headers=auth_header(reserved), files=[("files", ("a.png", PNG, "image/png"))]).status_code == 404
    assert client.post(f"{API}/listings/{listing_id}/proof", files=[("files", ("a.png", PNG, "image/png"))]).status_code == 401


def test_more_files_can_be_added_until_approved_and_a_rejection_can_be_redone(client, db, reserved, listing_id):
    h = auth_header(reserved)
    client.post(f"{API}/listings/{listing_id}/complete", headers=h)
    f1 = ("files", ("a.png", PNG, "image/png"))
    assert client.post(f"{API}/listings/{listing_id}/proof", headers=h, files=[f1]).status_code == 201
    second = client.post(f"{API}/listings/{listing_id}/proof", headers=h, files=[("files", ("b.pdf", PDF, "application/pdf"))])
    assert second.json()["proof_count"] == 2

    db.query(Proof).update({"review_status": "rejected"})
    db.commit()
    assert reservation(client, reserved, listing_id)["proof_status"] == "rejected"
    redo = client.post(f"{API}/listings/{listing_id}/proof", headers=h, files=[f1])
    assert redo.status_code == 201 and redo.json()["proof_status"] == "pending"

    db.query(Proof).filter(Proof.review_status == "pending").update({"review_status": "approved"})
    db.commit()
    blocked = client.post(f"{API}/listings/{listing_id}/proof", headers=h, files=[f1])
    assert blocked.status_code == 409 and blocked.json()["code"] == "PROOF_ALREADY_APPROVED"
    assert reservation(client, reserved, listing_id)["proof_status"] == "approved"


# ---------------------------------------------------------------- (c) admin sees and downloads the proof
def test_admin_sees_and_downloads_the_proof_of_donation(client, db, reserved, listing_id):
    h = auth_header(reserved)
    client.post(f"{API}/listings/{listing_id}/complete", headers=h)
    client.post(
        f"{API}/listings/{listing_id}/proof", headers=h, data={"note": "signed by the shelter warden"},
        files=[("files", ("sheet.pdf", PDF, "application/pdf"))],
    )
    admin = auth_header(_admin(client, db))

    proofs = client.get(f"{API}/admin/proofs", headers=admin, params={"review": "pending"}).json()
    assert len(proofs) == 1
    proof = proofs[0]
    assert proof["listing_id"] == listing_id and proof["note"] == "signed by the shelter warden"
    assert proof["listing"]["title"] == "Rice" and proof["ngo"]["org_name"] == "Helpers"

    doc = client.get(f"{API}/admin/documents/{proof['document_id']}", headers=admin)
    assert doc.status_code == 200 and doc.content == PDF


def test_admin_can_review_the_proof_and_the_ngo_sees_the_outcome(client, db, reserved, listing_id):
    h = auth_header(reserved)
    client.post(f"{API}/listings/{listing_id}/complete", headers=h)
    client.post(f"{API}/listings/{listing_id}/proof", headers=h, files=[("files", ("a.png", PNG, "image/png"))])
    admin = auth_header(_admin(client, db))
    proof_id = client.get(f"{API}/admin/proofs", headers=admin).json()[0]["id"]
    r = client.post(f"{API}/admin/proofs/{proof_id}/review", headers=admin, json={"decision": "approved", "stars": 5, "comment": "great"})
    assert r.status_code == 200
    assert reservation(client, reserved, listing_id)["proof_status"] == "approved"


def test_proofs_are_private_to_admins(client, db, reserved, listing_id):
    h = auth_header(reserved)
    client.post(f"{API}/listings/{listing_id}/complete", headers=h)
    client.post(f"{API}/listings/{listing_id}/proof", headers=h, files=[("files", ("a.png", PNG, "image/png"))])
    doc_id = db.query(Document).one().id
    assert client.get(f"{API}/admin/documents/{doc_id}", headers=h).status_code == 403  # the NGO itself is not an admin
    assert client.get(f"{API}/admin/documents/{doc_id}").status_code == 401
