"""Tests for GET/POST /api/v1/admin/proofs."""
import pytest


class TestListProofs:
    """Tests for listing proofs."""

    def test_list_proofs_all(self, admin_client, seed_admin_data):
        """All proofs returned."""
        resp = admin_client.get("/api/v1/admin/proofs")
        assert resp.status_code == 200
        proofs = resp.json()
        assert len(proofs) == 2

    def test_list_proofs_filtered_by_review_status(self, admin_client, seed_admin_data):
        """Filter by review_status=pending returns only pending proofs."""
        resp = admin_client.get("/api/v1/admin/proofs?review=pending")
        assert resp.status_code == 200
        proofs = resp.json()
        assert len(proofs) == 1
        assert proofs[0]["review_status"] == "pending"
        assert proofs[0]["id"] == 300

        # Filter by approved
        resp2 = admin_client.get("/api/v1/admin/proofs?review=approved")
        assert resp2.status_code == 200
        proofs2 = resp2.json()
        assert len(proofs2) == 1
        assert proofs2[0]["review_status"] == "approved"

    def test_list_proofs_requires_admin(self, provider_client, seed_admin_data):
        resp = provider_client.get("/api/v1/admin/proofs")
        assert resp.status_code == 403


class TestReviewProof:
    """Tests for reviewing a proof."""

    def test_review_proof_approve_updates_ngo_rating(self, admin_client, seed_admin_data, db_session):
        """Approve proof 300 → review_status=approved, rating inserted, ngo rating recomputed."""
        resp = admin_client.post(
            "/api/v1/admin/proofs/300/review",
            json={"decision": "approved", "stars": 5, "comment": "Excellent"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["review_status"] == "approved"
        assert data["id"] == 300

        # Verify NGO rating was updated
        from backend.app.db.models import NgoProfile
        ngo_profile = db_session.query(NgoProfile).filter(NgoProfile.user_id == 31).first()
        assert ngo_profile is not None
        assert ngo_profile.rating_count >= 1
        assert ngo_profile.rating_avg == 5.0  # only one admin_to_ngo rating for this NGO

    def test_review_proof_reject(self, admin_client, seed_admin_data):
        """Reject proof 300."""
        resp = admin_client.post(
            "/api/v1/admin/proofs/300/review",
            json={"decision": "rejected", "stars": 2, "comment": "Poor quality"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["review_status"] == "rejected"

    def test_review_proof_already_reviewed_returns_409(self, admin_client, seed_admin_data):
        """Proof 301 is already approved → 409."""
        resp = admin_client.post(
            "/api/v1/admin/proofs/301/review",
            json={"decision": "approved", "stars": 3},
        )
        assert resp.status_code == 409
        assert "ALREADY_REVIEWED" in resp.json()["detail"]

    def test_review_proof_not_found_returns_404(self, admin_client, seed_admin_data):
        resp = admin_client.post(
            "/api/v1/admin/proofs/9999/review",
            json={"decision": "approved", "stars": 3},
        )
        assert resp.status_code == 404

    def test_review_proof_stars_validation(self, admin_client, seed_admin_data):
        """Stars < 1 or > 5 → 422."""
        # Stars = 0
        resp = admin_client.post(
            "/api/v1/admin/proofs/300/review",
            json={"decision": "approved", "stars": 0},
        )
        assert resp.status_code == 422

        # Stars = 6
        resp2 = admin_client.post(
            "/api/v1/admin/proofs/300/review",
            json={"decision": "approved", "stars": 6},
        )
        assert resp2.status_code == 422

    def test_review_proof_requires_admin(self, ngo_client, seed_admin_data):
        resp = ngo_client.post(
            "/api/v1/admin/proofs/300/review",
            json={"decision": "approved", "stars": 4},
        )
        assert resp.status_code == 403
