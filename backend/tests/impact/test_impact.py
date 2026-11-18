"""Tests for GET /api/v1/impact (public endpoint)."""
import pytest


class TestImpactAggregation:
    """Tests for the impact aggregation endpoint."""

    def test_impact_aggregation_maths(self, client, seed_impact_data):
        """Verify totals match seed data exactly.

        Seeded completed listings:
          id=500: est_meals=100, est_kg=50.0  (Jan 2024, provider=50, ngo=60)
          id=501: est_meals=200, est_kg=80.0  (Jan 2024, provider=50, ngo=61)
          id=502: est_meals=50,  est_kg=25.0  (Feb 2024, provider=51, ngo=60)
        Non-completed id=503 is EXCLUDED.
        """
        resp = client.get("/api/v1/impact")
        assert resp.status_code == 200
        data = resp.json()

        assert data["meals_redistributed"] == 350  # 100 + 200 + 50
        assert data["kg_saved"] == pytest.approx(155.0)  # 50 + 80 + 25
        assert data["listings_completed"] == 3
        assert data["active_ngos"] == 2  # ngo 60, 61
        assert data["active_providers"] == 2  # provider 50, 51

    def test_impact_by_month_grouping(self, client, seed_impact_data):
        """Verify month grouping and ordering."""
        resp = client.get("/api/v1/impact")
        assert resp.status_code == 200
        data = resp.json()

        by_month = data["by_month"]
        assert len(by_month) == 2  # Jan 2024 and Feb 2024

        # Sorted ascending
        assert by_month[0]["month"] == "2024-01"
        assert by_month[1]["month"] == "2024-02"

        # January: listings 500 + 501
        assert by_month[0]["meals"] == 300  # 100 + 200
        assert by_month[0]["kg"] == pytest.approx(130.0)  # 50 + 80

        # February: listing 502
        assert by_month[1]["meals"] == 50
        assert by_month[1]["kg"] == pytest.approx(25.0)

    def test_impact_is_public(self, client, seed_impact_data):
        """No auth required — 200 without any token."""
        # `client` fixture has no auth override → unauthenticated
        resp = client.get("/api/v1/impact")
        assert resp.status_code == 200

    def test_impact_empty_database(self, client):
        """All zeros and empty by_month on a fresh database."""
        resp = client.get("/api/v1/impact")
        assert resp.status_code == 200
        data = resp.json()

        assert data["meals_redistributed"] == 0
        assert data["kg_saved"] == pytest.approx(0.0)
        assert data["listings_completed"] == 0
        assert data["active_ngos"] == 0
        assert data["active_providers"] == 0
        assert data["by_month"] == []
