"""Verification endpoint tests — provider step1/2, NGO, admin decision.

Coverage targets:
  1. FSSAI format validation
  2. PAN masking (full number never echoed)
  3. Aadhaar masking
  4. Step gating (step2 without approved step1)
  5. General provider blocked from step1 and step2
  6. Resubmission allowed after rejection
  7. Admin-only endpoints reject anon + non-admin
  8. Overall 'approved' only after both steps approved
  9. Document soft-delete after step1 decision
  10. Reject requires reason
  11. Double decision (409 ALREADY_DECIDED)
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def step1_files(pan="ABCDE1234F", aadhaar="123456789012"):
    """Return (data, files) for a step1 multipart request."""
    data = {"pan_number": pan, "aadhaar_number": aadhaar, "entity_name": "Test Co"}
    files = {"business_proof": ("proof.pdf", tiny_pdf(), "application/pdf")}
    return data, files


def step2_files(fssai="12345678901234"):
    data = {"fssai_number": fssai, "entity_name": "Test Co"}
    files = {"fssai_cert": ("cert.pdf", tiny_pdf(), "application/pdf")}
    return data, files


def ngo_files(reg="NGO-REG-123"):
    data = {"reg_number": reg}
    files = {"ngo_reg": ("reg.pdf", tiny_pdf(), "application/pdf")}
    return data, files


def _do_step1(client, token):
    data, files = step1_files()
    return client.post(
        "/api/v1/verification/provider/step1",
        headers=auth_headers(token),
        data=data,
        files=files,
    )


def _do_step2(client, token):
    data, files = step2_files()
    return client.post(
        "/api/v1/verification/provider/step2",
        headers=auth_headers(token),
        data=data,
        files=files,
    )


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

    admin = User(
        email="admin@test.com",
        password_hash=hash_password("Admin1234!"),
        role="admin",
        name="Test Admin",
        phone="+919999999999",
        is_active=True,
    )
    db.add(admin)
    db.commit()

    r = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "Admin1234!"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# ===========================================================================
# 1. FSSAI format validation
# ===========================================================================


class TestFssaiValidation:
    def test_fssai_too_short_rejected(self, client, db):
        token = register_and_login(client, RESTAURANT_PAYLOAD)
        # First get step1 approved
        data, files = step1_files()
        r = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        assert r.status_code == 201
        vr_id = r.json()["id"]
        admin_tok = _create_admin(client, db)
        _decide(client, admin_tok, vr_id, "approved")

        d, f = step2_files(fssai="1234567890123")  # 13 digits
        r2 = client.post(
            "/api/v1/verification/provider/step2",
            headers=auth_headers(token),
            data=d,
            files=f,
        )
        assert r2.status_code == 422
        assert r2.json()["code"] == "INVALID_FSSAI"

    def test_fssai_too_long_rejected(self, client, db):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "rest2@test.com"})
        data, files = step1_files()
        r = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        vr_id = r.json()["id"]
        admin_tok = _create_admin(client, db)
        _decide(client, admin_tok, vr_id, "approved")

        d, f = step2_files(fssai="123456789012345")  # 15 digits
        r2 = client.post(
            "/api/v1/verification/provider/step2",
            headers=auth_headers(token),
            data=d,
            files=f,
        )
        assert r2.status_code == 422
        assert r2.json()["code"] == "INVALID_FSSAI"

    def test_fssai_letters_rejected(self, client, db):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "rest3@test.com"})
        data, files = step1_files()
        r = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        vr_id = r.json()["id"]
        admin_tok = _create_admin(client, db)
        _decide(client, admin_tok, vr_id, "approved")

        d, f = step2_files(fssai="1234567890ABCD")  # letters
        r2 = client.post(
            "/api/v1/verification/provider/step2",
            headers=auth_headers(token),
            data=d,
            files=f,
        )
        assert r2.status_code == 422
        assert r2.json()["code"] == "INVALID_FSSAI"

    def test_fssai_14_digits_accepted(self, client, db):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "rest4@test.com"})
        data, files = step1_files()
        r = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        vr_id = r.json()["id"]
        admin_tok = _create_admin(client, db)
        _decide(client, admin_tok, vr_id, "approved")

        d, f = step2_files(fssai="12345678901234")  # exactly 14
        r2 = client.post(
            "/api/v1/verification/provider/step2",
            headers=auth_headers(token),
            data=d,
            files=f,
        )
        assert r2.status_code == 201


# ===========================================================================
# 2. PAN masking — full number never in response
# ===========================================================================


class TestPanMasking:
    def test_pan_masked_in_response(self, client):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "pan@test.com"})
        full_pan = "ABCDE1234F"
        data = {"pan_number": full_pan, "aadhaar_number": "123456789012", "entity_name": "Co"}
        files = {"business_proof": ("p.pdf", tiny_pdf(), "application/pdf")}
        r = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        assert r.status_code == 201
        body = r.json()
        assert full_pan not in str(body)
        assert "masked_pan" in body
        assert body["masked_pan"] is not None
        assert body["masked_pan"] != full_pan

    def test_invalid_pan_rejected(self, client):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "badpan@test.com"})
        data = {"pan_number": "INVALID", "aadhaar_number": "123456789012", "entity_name": "Co"}
        files = {"business_proof": ("p.pdf", tiny_pdf(), "application/pdf")}
        r = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        assert r.status_code == 422
        assert r.json()["code"] == "INVALID_PAN"


# ===========================================================================
# 3. Aadhaar masking
# ===========================================================================


class TestAadhaarMasking:
    def test_aadhaar_masked_in_response(self, client):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "aadh@test.com"})
        full_aadhaar = "987654321098"
        data = {
            "pan_number": "ABCDE1234F",
            "aadhaar_number": full_aadhaar,
            "entity_name": "Co",
        }
        files = {"business_proof": ("p.pdf", tiny_pdf(), "application/pdf")}
        r = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        assert r.status_code == 201
        body = r.json()
        assert full_aadhaar not in str(body)
        assert body["masked_aadhaar"] is not None
        assert body["masked_aadhaar"] != full_aadhaar

    def test_invalid_aadhaar_rejected(self, client):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "badaadh@test.com"})
        data = {"pan_number": "ABCDE1234F", "aadhaar_number": "12345", "entity_name": "Co"}
        files = {"business_proof": ("p.pdf", tiny_pdf(), "application/pdf")}
        r = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        assert r.status_code == 422
        assert r.json()["code"] == "INVALID_AADHAAR"


# ===========================================================================
# 4. Step gating — step2 without approved step1
# ===========================================================================


class TestStepGating:
    def test_step2_without_step1_forbidden(self, client):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "gate@test.com"})
        d, f = step2_files()
        r = client.post(
            "/api/v1/verification/provider/step2",
            headers=auth_headers(token),
            data=d,
            files=f,
        )
        assert r.status_code == 403
        assert r.json()["code"] == "STEP1_NOT_APPROVED"

    def test_step2_with_pending_step1_forbidden(self, client):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "pend@test.com"})
        # Submit step1 (now pending, not approved)
        data, files = step1_files()
        r = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        assert r.status_code == 201

        d, f = step2_files()
        r2 = client.post(
            "/api/v1/verification/provider/step2",
            headers=auth_headers(token),
            data=d,
            files=f,
        )
        assert r2.status_code == 403
        assert r2.json()["code"] == "STEP1_NOT_APPROVED"


# ===========================================================================
# 5. General provider blocked
# ===========================================================================


class TestGeneralProviderBlocked:
    def test_general_step1_forbidden(self, client):
        token = register_and_login(client, GENERAL_PAYLOAD)
        data, files = step1_files()
        r = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        assert r.status_code == 403
        assert r.json()["code"] == "NOT_REQUIRED"

    def test_general_step2_forbidden(self, client):
        token = register_and_login(client, {**GENERAL_PAYLOAD, "email": "gen2@test.com"})
        d, f = step2_files()
        r = client.post(
            "/api/v1/verification/provider/step2",
            headers=auth_headers(token),
            data=d,
            files=f,
        )
        assert r.status_code == 403
        assert r.json()["code"] == "NOT_REQUIRED"


# ===========================================================================
# 6. Resubmission allowed after rejection
# ===========================================================================


class TestResubmissionAfterRejection:
    def test_resubmit_after_rejection_ok(self, client, db):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "resub@test.com"})
        admin_tok = _create_admin(client, db)

        # First submission
        data, files = step1_files()
        r1 = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        assert r1.status_code == 201
        vr_id = r1.json()["id"]

        # Reject it
        rj = _decide(client, admin_tok, vr_id, "rejected", reason="Missing info")
        assert rj.status_code == 200

        # Resubmit — should succeed (not 409)
        data2, files2 = step1_files()
        r2 = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data2,
            files=files2,
        )
        assert r2.status_code == 201, r2.text

    def test_duplicate_pending_blocked(self, client):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "dup@test.com"})
        data, files = step1_files()
        r1 = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files={"business_proof": ("p.pdf", tiny_pdf(), "application/pdf")},
        )
        assert r1.status_code == 201

        # Second submission while pending → 409
        data2, files2 = step1_files()
        r2 = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data2,
            files={"business_proof": ("p2.pdf", tiny_pdf(), "application/pdf")},
        )
        assert r2.status_code == 409
        assert r2.json()["code"] == "ALREADY_PENDING"


# ===========================================================================
# 7. Admin-only endpoints reject anonymous + non-admin
# ===========================================================================


class TestAdminOnlyAccess:
    def test_list_verifications_anonymous_401(self, client):
        r = client.get("/api/v1/admin/verifications")
        assert r.status_code == 401

    def test_list_verifications_provider_403(self, client):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "prov401@test.com"})
        r = client.get("/api/v1/admin/verifications", headers=auth_headers(token))
        assert r.status_code == 403

    def test_list_verifications_ngo_403(self, client):
        token = register_and_login(client, {**NGO_PAYLOAD, "email": "ngo401@test.com"})
        r = client.get("/api/v1/admin/verifications", headers=auth_headers(token))
        assert r.status_code == 403

    def test_decision_anonymous_401(self, client):
        r = client.post("/api/v1/admin/verifications/1/decision", data={"decision": "approved"})
        assert r.status_code == 401

    def test_document_anonymous_401(self, client):
        r = client.get("/api/v1/admin/documents/1")
        assert r.status_code == 401

    def test_admin_can_list_verifications(self, client, db):
        admin_tok = _create_admin(client, db)
        r = client.get("/api/v1/admin/verifications", headers=auth_headers(admin_tok))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ===========================================================================
# 8. Overall 'approved' only after both steps approved
# ===========================================================================


class TestOverallStatus:
    def test_overall_not_submitted_initially(self, client):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "ov1@test.com"})
        r = client.get("/api/v1/verification/provider/status", headers=auth_headers(token))
        assert r.status_code == 200
        body = r.json()
        assert body["overall"] == "not_submitted"
        assert body["step1"]["status"] == "not_submitted"

    def test_overall_pending_after_step1(self, client):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "ov2@test.com"})
        data, files = step1_files()
        client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        r = client.get("/api/v1/verification/provider/status", headers=auth_headers(token))
        assert r.json()["overall"] == "pending"

    def test_overall_approved_only_after_both_steps(self, client, db):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "ov3@test.com"})
        admin_tok = _create_admin(client, db)

        # Step 1
        data, files = step1_files()
        r1 = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        vr1_id = r1.json()["id"]
        _decide(client, admin_tok, vr1_id, "approved")

        # Overall still pending (step2 not done)
        status = client.get(
            "/api/v1/verification/provider/status", headers=auth_headers(token)
        ).json()
        assert status["overall"] != "approved"

        # Step 2
        d2, f2 = step2_files()
        r2 = client.post(
            "/api/v1/verification/provider/step2",
            headers=auth_headers(token),
            data=d2,
            files=f2,
        )
        vr2_id = r2.json()["id"]
        _decide(client, admin_tok, vr2_id, "approved")

        # Now overall = approved
        status2 = client.get(
            "/api/v1/verification/provider/status", headers=auth_headers(token)
        ).json()
        assert status2["overall"] == "approved"
        assert status2["step1"]["status"] == "approved"
        assert status2["step2"]["status"] == "approved"


# ===========================================================================
# 9. Document soft-delete after step1 decision (passport path)
# ===========================================================================


class TestDocumentDeletion:
    def test_passport_soft_deleted_after_decision(self, client, db):
        from app.db.models import Document

        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "docdel@test.com"})
        admin_tok = _create_admin(client, db)

        data = {"entity_name": "Co"}
        files = {
            "business_proof": ("proof.pdf", tiny_pdf(), "application/pdf"),
            "passport": ("pass.pdf", tiny_pdf(), "application/pdf"),
        }
        r = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        assert r.status_code == 201
        vr_id = r.json()["id"]

        # Before decision: passport doc exists and is not deleted
        passport_docs = db.query(Document).filter(Document.kind == "passport").all()
        assert len(passport_docs) == 1
        assert passport_docs[0].deleted_at is None

        # Approve
        _decide(client, admin_tok, vr_id, "approved")

        # After decision: passport should be soft-deleted
        db.expire_all()
        passport_docs2 = db.query(Document).filter(Document.kind == "passport").all()
        assert all(d.deleted_at is not None for d in passport_docs2)


# ===========================================================================
# 10. Reject requires reason
# ===========================================================================


class TestRejectRequiresReason:
    def test_reject_without_reason_422(self, client, db):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "noreason@test.com"})
        admin_tok = _create_admin(client, db)

        data, files = step1_files()
        r = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        vr_id = r.json()["id"]

        rj = client.post(
            f"/api/v1/admin/verifications/{vr_id}/decision",
            headers=auth_headers(admin_tok),
            data={"decision": "rejected"},
            # No reason field
        )
        assert rj.status_code == 422
        assert rj.json()["code"] == "REASON_REQUIRED"

    def test_reject_with_reason_ok(self, client, db):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "reason@test.com"})
        admin_tok = _create_admin(client, db)

        data, files = step1_files()
        r = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        vr_id = r.json()["id"]

        rj = _decide(client, admin_tok, vr_id, "rejected", reason="Blurry documents")
        assert rj.status_code == 200
        assert rj.json()["status"] == "rejected"
        assert rj.json()["reason"] == "Blurry documents"


# ===========================================================================
# 11. Double decision → 409 ALREADY_DECIDED
# ===========================================================================


class TestDoubleDecision:
    def test_decide_twice_409(self, client, db):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "dbl@test.com"})
        admin_tok = _create_admin(client, db)

        data, files = step1_files()
        r = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        vr_id = r.json()["id"]

        # First decision
        r1 = _decide(client, admin_tok, vr_id, "approved")
        assert r1.status_code == 200

        # Second decision on same VR
        r2 = _decide(client, admin_tok, vr_id, "approved")
        assert r2.status_code == 409
        assert r2.json()["code"] == "ALREADY_DECIDED"


# ===========================================================================
# 12. NGO verification
# ===========================================================================


class TestNgoVerification:
    def test_ngo_step1_success(self, client):
        token = register_and_login(client, NGO_PAYLOAD)
        d, f = ngo_files()
        r = client.post(
            "/api/v1/verification/ngo",
            headers=auth_headers(token),
            data=d,
            files=f,
        )
        assert r.status_code == 201
        body = r.json()
        assert body["step"] == 1
        assert body["status"] == "pending"

    def test_ngo_duplicate_pending_409(self, client):
        token = register_and_login(client, {**NGO_PAYLOAD, "email": "ngodup@test.com"})
        d, f = ngo_files()
        r1 = client.post(
            "/api/v1/verification/ngo",
            headers=auth_headers(token),
            data=d,
            files={"ngo_reg": ("r.pdf", tiny_pdf(), "application/pdf")},
        )
        assert r1.status_code == 201

        d2, f2 = ngo_files()
        r2 = client.post(
            "/api/v1/verification/ngo",
            headers=auth_headers(token),
            data=d2,
            files={"ngo_reg": ("r2.pdf", tiny_pdf(), "application/pdf")},
        )
        assert r2.status_code == 409

    def test_provider_cannot_use_ngo_endpoint(self, client):
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "prvngo@test.com"})
        d, f = ngo_files()
        r = client.post(
            "/api/v1/verification/ngo",
            headers=auth_headers(token),
            data=d,
            files=f,
        )
        assert r.status_code == 403


# ===========================================================================
# 13. Provider cannot use NGO endpoint and vice versa
# ===========================================================================


class TestRoleSeparation:
    def test_ngo_cannot_use_provider_step1(self, client):
        token = register_and_login(client, {**NGO_PAYLOAD, "email": "ngoprv@test.com"})
        data, files = step1_files()
        r = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        assert r.status_code == 403

    def test_missing_id_on_step1(self, client):
        """Step1 without pan+aadhaar and without passport → 422."""
        token = register_and_login(client, {**RESTAURANT_PAYLOAD, "email": "noid@test.com"})
        data = {"entity_name": "Co"}  # no pan, no aadhaar, no passport
        files = {"business_proof": ("p.pdf", tiny_pdf(), "application/pdf")}
        r = client.post(
            "/api/v1/verification/provider/step1",
            headers=auth_headers(token),
            data=data,
            files=files,
        )
        assert r.status_code == 422
        assert r.json()["code"] == "ID_REQUIRED"
