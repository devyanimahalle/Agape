"""Tests for GET/PATCH /api/v1/admin/users."""


class TestListUsers:
    """Tests for listing users."""

    def test_list_users_returns_all_with_profiles(self, admin_client, seed_admin_data):
        """All 5 users returned, providers/ngos have profile data."""
        resp = admin_client.get("/api/v1/admin/users")
        assert resp.status_code == 200
        users = resp.json()
        assert len(users) == 5

        # Check a provider has profile
        providers = [u for u in users if u["role"] == "provider"]
        assert len(providers) == 2
        for p in providers:
            assert p["profile"] is not None
            assert "org_name" in p["profile"]

        # Check an NGO has profile
        ngos = [u for u in users if u["role"] == "ngo"]
        assert len(ngos) == 2
        for n in ngos:
            assert n["profile"] is not None

        # Admin has no profile
        admins = [u for u in users if u["role"] == "admin"]
        assert len(admins) == 1
        assert admins[0]["profile"] is None

    def test_list_users_requires_admin(self, provider_client, seed_admin_data):
        resp = provider_client.get("/api/v1/admin/users")
        assert resp.status_code == 403


class TestPatchUser:
    """Tests for patching user active status."""

    def test_patch_user_deactivate(self, admin_client, seed_admin_data):
        """Deactivate user id=20."""
        resp = admin_client.patch(
            "/api/v1/admin/users/20",
            json={"is_active": False},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == 20
        assert data["is_active"] is False

    def test_patch_user_activate(self, admin_client, seed_admin_data):
        """Activate user id=31 (initially inactive)."""
        resp = admin_client.patch(
            "/api/v1/admin/users/31",
            json={"is_active": True},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == 31
        assert data["is_active"] is True

    def test_patch_user_not_found(self, admin_client, seed_admin_data):
        resp = admin_client.patch(
            "/api/v1/admin/users/9999",
            json={"is_active": False},
        )
        assert resp.status_code == 404

    def test_patch_user_requires_admin(self, ngo_client, seed_admin_data):
        resp = ngo_client.patch(
            "/api/v1/admin/users/20",
            json={"is_active": False},
        )
        assert resp.status_code == 403
