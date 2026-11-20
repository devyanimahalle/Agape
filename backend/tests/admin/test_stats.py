"""Tests for GET /api/v1/admin/stats."""
import pytest


class TestStats:
    """Tests for the admin stats endpoint."""

    def test_stats_returns_correct_counts(self, admin_client, seed_admin_data):
        """Verify all counts match seeded data."""
        resp = admin_client.get("/api/v1/admin/stats")
        assert resp.status_code == 200
        data = resp.json()

        # 5 users total
        assert data["total_users"] == 5

        # 1 NGO with status=pending (ngo1, id=30)
        assert data["ngos_pending"] == 1

        # 1 provider with verification_status=pending (prov1, id=20)
        assert data["providers_pending"] == 1

        # Listings: 1 listed, 1 reserved, 1 completed, 1 cancelled, 1 expired
        lbs = data["listings_by_status"]
        assert lbs["listed"] == 1
        assert lbs["reserved"] == 1
        assert lbs["completed"] == 1
        assert lbs["cancelled"] == 1
        assert lbs["expired"] == 1

    def test_stats_requires_admin(self, provider_client, ngo_client, seed_admin_data):
        """403 for provider and ngo tokens."""
        resp_prov = provider_client.get("/api/v1/admin/stats")
        assert resp_prov.status_code == 403

        resp_ngo = ngo_client.get("/api/v1/admin/stats")
        assert resp_ngo.status_code == 403

    def test_stats_requires_auth(self, client, seed_admin_data):
        """401 with no token."""
        resp = client.get("/api/v1/admin/stats")
        assert resp.status_code == 401
