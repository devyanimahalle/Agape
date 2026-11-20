"""Verification endpoint tests: one combined provider request, NGO request, admin decision.

Coverage:
  1. Format validation (FSSAI, PAN, Aadhaar) and the ID requirement
  2. Masking: raw PAN and Aadhaar never stored, returned or listed
  3. One request per provider submission, with every document attached
  4. Every provider category needs verification (no general bypass)
  5. Resubmission after rejection; duplicate pending blocked
  6. Admin-only endpoints
  7. Decision effects (profile status, document minimisation, reason on reject, double decision)
  8. NGO request and status; new requests appear in the admin queue
"""
from __future__ import annotations

from tests.verification.conftest import (
    GENERAL_PAYLOAD,
    NGO_PAYLOAD,
    RESTAURANT_PAYLOAD,
    auth_headers,
    register_and_login,
    tiny_pdf,
)

PROVIDER = "/api/v1/verification/provider"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def provider_form(pan="ABCDE1234F", aadhaar="987654321098", fssai="11112222333344", passport=False):
    """Return (data, files) for the combined provider multipart request."""
    data = {"entity_name": "Test Co", "fssai_number": fssai}
    if pan is not None:
        data["pan_number"] = pan
    if aadhaar is not None:
        data["aadhaar_number"] = aadhaar
    files = {
        "business_proof": ("proof.pdf", tiny_pdf(), "application/pdf"),
        "fssai_cert": ("cert.pdf", tiny_pdf(), "application/pdf"),
    }
    if passport:
        files["passport"] = ("passport.pdf", tiny_pdf(), "application/pdf")
    return data, files


def ngo_files(reg="NGO-REG-123"):
    data = {"reg_number": reg}
    files = {"ngo_reg": ("reg.pdf", tiny_pdf(), "application/pdf")}
    return data, files


def submit(client, token, **kw):
    data, files = provider_form(**kw)
    return client.post(PROVIDER, headers=auth_headers(token), data=data, files=files)


def _decide(client, admin_token, vr_id, decision, reason=None):
    form = {"decision": decision}
    if reason:
        form["reason"] = reason
    return client.post(
        f"/api/v1/admin/verifications/{vr_id}/decision",
        headers=auth_headers(admin_token),
        data=form,
    )


def _create_admin(client, db):
    """Create an admin user directly in DB (can't self-register)."""
    from app.auth.security import hash_password
    from app.db.models import User

    db.add(User(
        email="admin@test.com", password_hash=hash_password("Admin1234!"), role="admin",
        name="Test Admin", phone="+919999999999", is_active=True,
    ))
    db.commit()
    r = client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "Admin1234!"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _queue(client, admin_token, **params):
    r = client.get("/api/v1/admin/verifications", headers=auth_headers(admin_token), params=params)
    assert r.status_code == 200, r.text
    return r.json()


# ===========================================================================
# 1. Validation
# ===========================================================================


class TestValidation:
    def test_fssai_wrong_length_or_letters_rejected(self, client):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        for bad in ("1234", "123456789012345", "1234567890123A"):
            r = submit(client, token, fssai=bad)
            assert r.status_code == 422, bad
            assert r.json()["code"] == "INVALID_FSSAI"

    def test_fssai_14_digits_accepted(self, client):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        assert submit(client, token).status_code == 201

    def test_invalid_pan_rejected(self, client):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        r = submit(client, token, pan="BADPAN")
        assert r.status_code == 422
        assert r.json()["code"] == "INVALID_PAN"

    def test_invalid_aadhaar_rejected(self, client):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        r = submit(client, token, aadhaar="123")
        assert r.status_code == 422
        assert r.json()["code"] == "INVALID_AADHAAR"

    def test_id_required_without_pan_aadhaar_or_passport(self, client):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        r = submit(client, token, pan=None, aadhaar=None)
        assert r.status_code == 422
        assert r.json()["code"] == "ID_REQUIRED"

    def test_passport_can_replace_pan_and_aadhaar(self, client):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        assert submit(client, token, pan=None, aadhaar=None, passport=True).status_code == 201

    def test_missing_fssai_certificate_is_422(self, client):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        data, files = provider_form()
        files.pop("fssai_cert")
        r = client.post(PROVIDER, headers=auth_headers(token), data=data, files=files)
        assert r.status_code == 422


# ===========================================================================
# 2. Masking: raw PAN / Aadhaar never stored, returned or listed
# ===========================================================================


class TestMasking:
    def test_response_is_masked(self, client):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        body = submit(client, token).json()
        assert body["masked_pan"] == "XXXXX" + "1234F"
        assert body["masked_aadhaar"] == "XXXX-XXXX-1098"
        assert "987654321098" not in str(body)
        assert "ABCDE1234F" not in str(body)

    def test_status_and_admin_queue_never_expose_raw_numbers(self, client, db):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        submit(client, token)
        status = client.get(f"{PROVIDER}/status", headers=auth_headers(token)).text
        admin = _create_admin(client, db)
        queue = client.get("/api/v1/admin/verifications", headers=auth_headers(admin)).text
        for text in (status, queue):
            assert "987654321098" not in text
            assert "ABCDE1234F" not in text
            assert "1098" in text  # only the last four digits survive

    def test_raw_numbers_not_in_database(self, client, db):
        from sqlalchemy import select
        from app.db.models import VerificationRequest

        token = register_and_login(client, RESTAURANT_PAYLOAD)
        submit(client, token)
        vr = db.scalar(select(VerificationRequest))
        stored = " ".join(str(getattr(vr, c.name)) for c in vr.__table__.columns)
        assert "987654321098" not in stored
        assert "ABCDE1234F" not in stored


# ===========================================================================
# 3. One combined request
# ===========================================================================


class TestCombinedRequest:
    def test_one_submission_makes_one_pending_request(self, client, db):
        from sqlalchemy import func, select
        from app.db.models import VerificationRequest

        token = register_and_login(client, RESTAURANT_PAYLOAD)
        r = submit(client, token)
        assert r.status_code == 201
        assert r.json()["status"] == "pending"
        assert db.scalar(select(func.count()).select_from(VerificationRequest)) == 1

    def test_old_step_endpoints_are_gone(self, client):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        for step in ("step1", "step2"):
            r = client.post(f"{PROVIDER}/{step}", headers=auth_headers(token))
            assert r.status_code in (404, 405)

    def test_admin_sees_identity_business_and_fssai_in_one_row(self, client, db):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        submit(client, token, passport=True)
        admin = _create_admin(client, db)
        rows = _queue(client, admin)
        assert len(rows) == 1
        row = rows[0]
        assert row["subject_type"] == "provider"
        assert row["user_email"] == RESTAURANT_PAYLOAD["email"]
        assert row["entity_name"] == "Test Co"
        assert row["fssai_number"] == "11112222333344"
        assert row["masked_pan"] and row["masked_aadhaar"]
        kinds = sorted(d["kind"] for d in row["documents"])
        assert kinds == ["business_proof", "fssai_cert", "passport"]
        assert row["document_ids"] == [d["id"] for d in row["documents"]]

    def test_status_progression(self, client, db):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        h = auth_headers(token)
        assert client.get(f"{PROVIDER}/status", headers=h).json()["status"] == "not_submitted"
        submit(client, token)
        assert client.get(f"{PROVIDER}/status", headers=h).json()["status"] == "pending"
        admin = _create_admin(client, db)
        _decide(client, admin, _queue(client, admin)[0]["id"], "approved")
        assert client.get(f"{PROVIDER}/status", headers=h).json()["status"] == "approved"

    def test_documents_are_served_to_admin(self, client, db):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        submit(client, token)
        admin = _create_admin(client, db)
        for doc in _queue(client, admin)[0]["documents"]:
            r = client.get(f"/api/v1/admin/documents/{doc['id']}", headers=auth_headers(admin))
            assert r.status_code == 200


# ===========================================================================
# 4. Every provider needs verification
# ===========================================================================


class TestEveryProviderIsVerified:
    def test_general_provider_registers_pending_and_can_submit(self, client, db):
        from app.db.models import ProviderProfile
        token = register_and_login(client, GENERAL_PAYLOAD)
        profile = db.query(ProviderProfile).one()
        assert profile.verification_status == "pending"
        assert submit(client, token).status_code == 201

    def test_ngo_cannot_use_provider_endpoint(self, client):
        token = register_and_login(client, {**NGO_PAYLOAD, "email": "ngoprv@test.com"})
        assert submit(client, token).status_code == 403

    def test_provider_cannot_use_ngo_endpoint(self, client):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        d, f = ngo_files()
        assert client.post("/api/v1/verification/ngo", headers=auth_headers(token), data=d, files=f).status_code == 403


# ===========================================================================
# 5. Resubmission and duplicates
# ===========================================================================


class TestResubmission:
    def test_duplicate_pending_blocked(self, client):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        assert submit(client, token).status_code == 201
        r = submit(client, token)
        assert r.status_code == 409
        assert r.json()["code"] == "ALREADY_PENDING"

    def test_resubmit_after_rejection_makes_a_new_request_with_its_own_documents(self, client, db):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        submit(client, token)
        admin = _create_admin(client, db)
        first = _queue(client, admin)[0]
        _decide(client, admin, first["id"], "rejected", "Blurry scan")
        assert submit(client, token).status_code == 201

        rows = _queue(client, admin)
        assert len(rows) == 2
        new = next(r for r in rows if r["status"] == "pending")
        old = next(r for r in rows if r["status"] == "rejected")
        assert set(new["document_ids"]).isdisjoint(old["document_ids"])
        assert {d["kind"] for d in new["documents"]} == {"business_proof", "fssai_cert"}
        status = client.get(f"{PROVIDER}/status", headers=auth_headers(token)).json()
        assert status["status"] == "pending"


# ===========================================================================
# 6. Admin-only access
# ===========================================================================


class TestAdminOnlyAccess:
    def test_list_verifications_anonymous_401(self, client):
        assert client.get("/api/v1/admin/verifications").status_code == 401

    def test_list_verifications_non_admin_403(self, client):
        for payload in (RESTAURANT_PAYLOAD, {**NGO_PAYLOAD, "email": "ngo403@test.com"}):
            token = register_and_login(client, payload)
            assert client.get("/api/v1/admin/verifications", headers=auth_headers(token)).status_code == 403

    def test_decision_and_document_anonymous_401(self, client):
        assert client.post("/api/v1/admin/verifications/1/decision", data={"decision": "approved"}).status_code == 401
        assert client.get("/api/v1/admin/documents/1").status_code == 401

    def test_admin_can_list_empty_queue(self, client, db):
        admin = _create_admin(client, db)
        assert _queue(client, admin) == []


# ===========================================================================
# 7. Decisions
# ===========================================================================


class TestDecisions:
    def test_approve_sets_profile_approved_and_unlocks_listings(self, client, db):
        from app.db.models import ProviderProfile
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        submit(client, token)
        admin = _create_admin(client, db)
        r = _decide(client, admin, _queue(client, admin)[0]["id"], "approved")
        assert r.status_code == 200
        db.expire_all()
        assert db.query(ProviderProfile).one().verification_status == "approved"

    def test_reject_sets_profile_rejected_and_reason_is_visible_to_provider(self, client, db):
        from app.db.models import ProviderProfile
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        submit(client, token)
        admin = _create_admin(client, db)
        _decide(client, admin, _queue(client, admin)[0]["id"], "rejected", "PAN does not match")
        db.expire_all()
        assert db.query(ProviderProfile).one().verification_status == "rejected"
        status = client.get(f"{PROVIDER}/status", headers=auth_headers(token)).json()
        assert (status["status"], status["reason"]) == ("rejected", "PAN does not match")

    def test_reject_without_reason_422(self, client, db):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        submit(client, token)
        admin = _create_admin(client, db)
        r = _decide(client, admin, _queue(client, admin)[0]["id"], "rejected")
        assert r.status_code == 422
        assert r.json()["code"] == "REASON_REQUIRED"

    def test_decide_twice_409(self, client, db):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        submit(client, token)
        admin = _create_admin(client, db)
        vr_id = _queue(client, admin)[0]["id"]
        assert _decide(client, admin, vr_id, "approved").status_code == 200
        r = _decide(client, admin, vr_id, "approved")
        assert r.status_code == 409
        assert r.json()["code"] == "ALREADY_DECIDED"

    def test_invalid_decision_422(self, client, db):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        submit(client, token)
        admin = _create_admin(client, db)
        assert _decide(client, admin, _queue(client, admin)[0]["id"], "maybe").status_code == 422

    def test_passport_soft_deleted_after_decision_but_business_documents_stay(self, client, db):
        from app.db.models import Document
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        submit(client, token, passport=True)
        admin = _create_admin(client, db)
        _decide(client, admin, _queue(client, admin)[0]["id"], "approved")
        db.expire_all()
        live = {d.kind for d in db.query(Document).filter(Document.deleted_at.is_(None)).all()}
        assert live == {"business_proof", "fssai_cert"}
        passport = db.query(Document).filter(Document.kind == "passport").one()
        assert passport.deleted_at is not None
        r = client.get(f"/api/v1/admin/documents/{passport.id}", headers=auth_headers(admin))
        assert r.status_code == 404


# ===========================================================================
# 8. NGO
# ===========================================================================


class TestNgoVerification:
    def test_ngo_submission_appears_in_admin_queue_immediately(self, client, db):
        token = register_and_login(client, {**NGO_PAYLOAD, "email": "ngoq@test.com"})
        d, f = ngo_files()
        r = client.post("/api/v1/verification/ngo", headers=auth_headers(token), data=d, files=f)
        assert r.status_code == 201
        admin = _create_admin(client, db)
        rows = _queue(client, admin)
        assert len(rows) == 1
        assert rows[0]["subject_type"] == "ngo" and rows[0]["status"] == "pending"
        assert rows[0]["user_email"] == "ngoq@test.com"
        assert [d["kind"] for d in rows[0]["documents"]] == ["ngo_reg"]

    def test_ngo_duplicate_pending_409(self, client):
        token = register_and_login(client, {**NGO_PAYLOAD, "email": "ngodup@test.com"})
        d, f = ngo_files()
        assert client.post("/api/v1/verification/ngo", headers=auth_headers(token), data=d, files=f).status_code == 201
        d2, f2 = ngo_files()
        r = client.post("/api/v1/verification/ngo", headers=auth_headers(token), data=d2, files=f2)
        assert r.status_code == 409

    def test_ngo_status_not_submitted_then_pending_then_approved(self, client, db):
        token = register_and_login(client, {**NGO_PAYLOAD, "email": "ngost@test.com"})
        h = auth_headers(token)
        assert client.get("/api/v1/verification/ngo/status", headers=h).json()["status"] == "not_submitted"
        d, f = ngo_files()
        client.post("/api/v1/verification/ngo", headers=h, data=d, files=f)
        body = client.get("/api/v1/verification/ngo/status", headers=h).json()
        assert (body["status"], body["reg_number"]) == ("pending", "NGO-REG-123")
        admin = _create_admin(client, db)
        _decide(client, admin, _queue(client, admin)[0]["id"], "approved")
        assert client.get("/api/v1/verification/ngo/status", headers=h).json()["status"] == "approved"

    def test_ngo_status_forbidden_for_provider(self, client):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        assert client.get("/api/v1/verification/ngo/status", headers=auth_headers(token)).status_code == 403
