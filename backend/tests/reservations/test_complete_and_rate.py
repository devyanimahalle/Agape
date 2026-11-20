"""Complete-pickup (proof) and rate-provider rules."""
from pathlib import Path

from app.db.models import Document, Listing, Proof, ProviderProfile

from .helpers import PDF, PNG, h


def url(listing_id, action):
    return f"/api/v1/listings/{listing_id}/{action}"


def reserved(make, client, category="restaurant"):
    provider = make.provider(category)
    ngo = make.ngo()
    listing_id = make.listing(provider)
    assert client.post(url(listing_id, "reserve"), headers=h(ngo)).status_code == 200
    return provider, ngo, listing_id


def test_complete_without_proof_rejected(make, client, Session):
    _, ngo, listing_id = reserved(make, client)
    r = client.post(url(listing_id, "complete"), headers=h(ngo), data={"note": "no files"})
    assert r.status_code == 400 and r.json()["code"] == "PROOF_REQUIRED"
    with Session() as s:
        assert s.get(Listing, listing_id).status == "reserved"
        assert s.query(Proof).count() == 0


def test_complete_with_proof_marks_completed_and_leaves_board(make, client, Session, tmp_path):
    _, ngo, listing_id = reserved(make, client)
    r = client.post(
        url(listing_id, "complete"),
        headers=h(ngo),
        data={"note": "collected 20kg"},
        files=[("files", ("photo.png", PNG, "image/png")), ("files", ("letter.pdf", PDF, "application/pdf"))],
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "completed" and body["completed_at"] is not None
    with Session() as s:
        proofs = s.query(Proof).filter_by(listing_id=listing_id).all()
        assert len(proofs) == 2 and all(p.review_status == "pending" and p.note == "collected 20kg" for p in proofs)
        docs = s.query(Document).all()
        assert {d.kind for d in docs} == {"proof_photo", "proof_letter"}
        for d in docs:
            path = Path(d.private_path)
            assert path.exists() and str(tmp_path) in str(path)
            assert path.name.split(".")[0] not in ("photo", "letter")  # random filenames
    assert client.get("/api/v1/board", headers=h(ngo)).json() == []
    kept = client.get("/api/v1/ngo/reservations", params={"status": "completed"}, headers=h(ngo)).json()
    assert [k["id"] for k in kept] == [listing_id]


def test_complete_rejects_bad_file_types_and_keeps_state(make, client, Session):
    _, ngo, listing_id = reserved(make, client)
    r = client.post(
        url(listing_id, "complete"),
        headers=h(ngo),
        files=[("files", ("evil.png", b"<script>alert(1)</script>", "image/png"))],
    )
    assert r.status_code == 400 and r.json()["code"] == "INVALID_FILE_TYPE"
    with Session() as s:
        assert s.get(Listing, listing_id).status == "reserved"
        assert s.query(Document).count() == 0


def test_complete_rejects_oversized_file(make, client, monkeypatch):
    from app.reservations import storage

    monkeypatch.setattr(storage, "MAX_BYTES", 100)
    _, ngo, listing_id = reserved(make, client)
    r = client.post(
        url(listing_id, "complete"), headers=h(ngo), files=[("files", ("big.png", PNG + b"0" * 200, "image/png"))]
    )
    assert r.status_code == 400 and r.json()["code"] == "FILE_TOO_LARGE"


def test_only_reserving_ngo_can_complete_and_only_once(make, client):
    _, ngo, listing_id = reserved(make, client)
    other = make.ngo()
    f = [("files", ("p.png", PNG, "image/png"))]
    assert client.post(url(listing_id, "complete"), headers=h(other), files=f).status_code == 403
    assert client.post(url(listing_id, "complete"), headers=h(ngo), files=f).status_code == 200
    again = client.post(url(listing_id, "complete"), headers=h(ngo), files=f)
    assert again.status_code == 409 and again.json()["code"] == "INVALID_STATE"
    assert client.post(url(9999, "complete"), headers=h(ngo), files=f).status_code == 404


def test_complete_unreserved_listing_rejected(make, client):
    provider = make.provider()
    ngo = make.ngo()
    listing_id = make.listing(provider)
    r = client.post(url(listing_id, "complete"), headers=h(ngo), files=[("files", ("p.png", PNG, "image/png"))])
    assert r.status_code == 409


def complete(client, ngo, listing_id):
    r = client.post(url(listing_id, "complete"), headers=h(ngo), files=[("files", ("p.png", PNG, "image/png"))])
    assert r.status_code == 200


def test_duplicate_rating_rejected(make, client):
    _, ngo, listing_id = reserved(make, client)
    complete(client, ngo, listing_id)
    first = client.post(url(listing_id, "rate-provider"), headers=h(ngo), json={"stars": 5, "comment": "great"})
    assert first.status_code == 201
    second = client.post(url(listing_id, "rate-provider"), headers=h(ngo), json={"stars": 1})
    assert second.status_code == 409 and second.json()["code"] == "ALREADY_RATED"
    assert first.json()["provider_rating_avg"] == 5.0 and first.json()["provider_rating_count"] == 1


def test_rating_average_covers_all_rated_exchanges(make, client, Session):
    provider = make.provider("caterer", rating_avg=None)
    ngo = make.ngo()
    ids = [make.listing(provider) for _ in range(3)]
    for stars, lid in zip((5, 4, 3), ids):
        client.post(url(lid, "reserve"), headers=h(ngo))
        complete(client, ngo, lid)
        out = client.post(url(lid, "rate-provider"), headers=h(ngo), json={"stars": stars}).json()
    assert out["provider_rating_avg"] == 4.0 and out["provider_rating_count"] == 3
    with Session() as s:
        p = s.get(ProviderProfile, provider.id)
        assert p.rating_avg == 4.0 and p.rating_count == 3


def test_general_provider_is_never_rated(make, client):
    _, ngo, listing_id = reserved(make, client, category="general")
    complete(client, ngo, listing_id)
    r = client.post(url(listing_id, "rate-provider"), headers=h(ngo), json={"stars": 4})
    assert r.status_code == 400 and r.json()["code"] == "NOT_RATEABLE"


def test_rating_validation_and_state_rules(make, client):
    provider, ngo, listing_id = reserved(make, client)
    body = {"stars": 5}
    # not completed yet
    assert client.post(url(listing_id, "rate-provider"), headers=h(ngo), json=body).status_code == 409
    complete(client, ngo, listing_id)
    for bad in (0, 6, "x"):
        assert client.post(url(listing_id, "rate-provider"), headers=h(ngo), json={"stars": bad}).status_code == 422
    # another NGO cannot rate this pickup
    assert client.post(url(listing_id, "rate-provider"), headers=h(make.ngo()), json=body).status_code == 403
    assert client.post(url(9999, "rate-provider"), headers=h(ngo), json=body).status_code == 404


def test_reservations_list_reports_has_rated_and_filters(make, client):
    provider, ngo, listing_id = reserved(make, client)
    other = make.listing(provider)
    client.post(url(other, "reserve"), headers=h(ngo))
    complete(client, ngo, listing_id)
    rows = {r["id"]: r for r in client.get("/api/v1/ngo/reservations", headers=h(ngo)).json()}
    assert rows[listing_id]["has_rated"] is False and rows[listing_id]["org_name"].startswith("Provider")
    client.post(url(listing_id, "rate-provider"), headers=h(ngo), json={"stars": 4})
    rows = {r["id"]: r for r in client.get("/api/v1/ngo/reservations", headers=h(ngo)).json()}
    assert rows[listing_id]["has_rated"] is True
    reserved_only = client.get("/api/v1/ngo/reservations", params={"status": "reserved"}, headers=h(ngo)).json()
    assert [r["id"] for r in reserved_only] == [other]
    assert client.get("/api/v1/ngo/reservations", params={"status": "bogus"}, headers=h(ngo)).status_code == 422
