"""Tests for DELETE /api/v1/admin/users/{id} and POST /api/v1/admin/users/reset."""
from sqlalchemy import func, select

from app.db.models import (
    Document,
    Listing,
    NgoProfile,
    Proof,
    ProviderProfile,
    Rating,
    User,
    VerificationRequest,
)


def _count(db, model):
    db.expire_all()
    return db.scalar(select(func.count()).select_from(model))


def _add_request(db, user_id, subject_type):
    db.add(VerificationRequest(subject_user_id=user_id, subject_type=subject_type, step=1, status="pending", entity_name="x"))
    db.commit()


class TestDeleteUser:
    def test_deleting_a_donor_removes_their_listings_proofs_ratings_and_requests(self, admin_client, db_session, seed_admin_data):
        _add_request(db_session, 20, "provider")
        r = admin_client.delete("/api/v1/admin/users/20")
        assert r.status_code == 200
        assert r.json() == {"deleted": 1}

        assert db_session.get(User, 20) is None
        assert db_session.get(ProviderProfile, 20) is None
        # listings 100, 101, 104 belonged to provider 20; 102 and 103 to provider 21
        remaining = {row.id for row in db_session.scalars(select(Listing)).all()}
        assert remaining == {102, 103}
        # proof 301 sat on listing 101 and its rating 400 too
        assert db_session.get(Proof, 301) is None
        assert db_session.get(Rating, 400) is None
        assert db_session.get(Proof, 300) is not None  # someone else's proof is untouched
        left = db_session.scalars(select(VerificationRequest.subject_user_id)).all()
        assert 20 not in left and left == [30]  # only the NGO's request remains

    def test_deleting_an_ngo_removes_their_proofs_and_documents_and_releases_listings(self, admin_client, db_session, seed_admin_data):
        r = admin_client.delete("/api/v1/admin/users/31")
        assert r.status_code == 200
        assert db_session.get(User, 31) is None
        assert db_session.get(NgoProfile, 31) is None
        assert db_session.get(Proof, 300) is None
        assert db_session.get(Document, 200) is None
        # listing 102 (donor 21's, collected by NGO 31) stays, released from the deleted NGO
        listing = db_session.get(Listing, 102)
        assert listing is not None
        assert listing.reserved_by_ngo_id is None and listing.status == "cancelled"
        assert db_session.get(User, 21) is not None

    def test_cannot_delete_yourself(self, admin_client, db_session):
        db_session.add(User(id=1, email="me@test.com", password_hash="x", role="admin", name="Me", is_active=True))
        db_session.commit()
        r = admin_client.delete("/api/v1/admin/users/1")  # admin_client is signed in as id 1
        assert r.status_code == 400
        assert "own account" in r.json()["detail"]
        assert db_session.get(User, 1) is not None

    def test_cannot_delete_another_admin(self, admin_client, seed_admin_data):
        r = admin_client.delete("/api/v1/admin/users/10")
        assert r.status_code == 400

    def test_unknown_user_is_404(self, admin_client, seed_admin_data):
        assert admin_client.delete("/api/v1/admin/users/999").status_code == 404

    def test_admin_only(self, provider_client, ngo_client, seed_admin_data):
        assert provider_client.delete("/api/v1/admin/users/30").status_code == 403
        assert ngo_client.delete("/api/v1/admin/users/20").status_code == 403


class TestResetAccounts:
    def test_removes_every_donor_and_ngo_but_keeps_admins(self, admin_client, db_session, seed_admin_data):
        _add_request(db_session, 30, "ngo")
        r = admin_client.post("/api/v1/admin/users/reset")
        assert r.status_code == 200
        assert r.json() == {"deleted": 4}
        db_session.expire_all()
        assert [u.id for u in db_session.scalars(select(User)).all()] == [10]
        for model in (Listing, Proof, Rating, Document, VerificationRequest, ProviderProfile, NgoProfile):
            assert _count(db_session, model) == 0, model.__name__

    def test_keeps_every_admin_when_there_are_several(self, admin_client, db_session, seed_admin_data):
        db_session.add(User(id=11, email="admin2@test.com", password_hash="x", role="admin", name="Second Admin", is_active=True))
        db_session.commit()
        r = admin_client.post("/api/v1/admin/users/reset")
        assert r.json() == {"deleted": 4}
        db_session.expire_all()
        assert sorted(u.id for u in db_session.scalars(select(User)).all()) == [10, 11]

    def test_reset_with_nothing_to_delete_is_fine(self, admin_client):
        r = admin_client.post("/api/v1/admin/users/reset")
        assert r.status_code == 200
        assert r.json() == {"deleted": 0}

    def test_admin_only(self, provider_client, seed_admin_data):
        assert provider_client.post("/api/v1/admin/users/reset").status_code == 403
