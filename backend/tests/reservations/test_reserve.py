"""Reserve, cancel, verification and expiry rules."""
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from app.db.models import Listing
from app.reservations import service

from .helpers import h, now


def url(listing_id, action):
    return f"/api/v1/listings/{listing_id}/{action}"


def test_double_reservation_race_exactly_one_wins_service_level(make, Session):
    provider = make.provider()
    listing_id = make.listing(provider)
    ngos = [make.ngo() for _ in range(10)]
    barrier = threading.Barrier(len(ngos))

    def attempt(ngo):
        with Session() as s:
            barrier.wait()
            try:
                service.reserve_listing(s, ngo.id, listing_id)
                return "ok"
            except Exception as exc:
                return getattr(exc, "status_code", repr(exc))

    with ThreadPoolExecutor(len(ngos)) as pool:
        results = list(pool.map(attempt, ngos))

    assert results.count("ok") == 1
    assert results.count(409) == len(ngos) - 1
    with Session() as s:
        row = s.get(Listing, listing_id)
        assert row.status == "reserved"
        assert row.reserved_by_ngo_id in {n.id for n in ngos}


def test_double_reservation_race_exactly_one_wins_http(make, client):
    provider = make.provider()
    listing_id = make.listing(provider)
    a, b = make.ngo(), make.ngo()
    barrier = threading.Barrier(2)

    def attempt(ngo):
        barrier.wait()
        return client.post(url(listing_id, "reserve"), headers=h(ngo))

    with ThreadPoolExecutor(2) as pool:
        responses = list(pool.map(attempt, [a, b]))

    codes = sorted(r.status_code for r in responses)
    assert codes == [200, 409]
    loser = next(r for r in responses if r.status_code == 409)
    assert loser.json()["code"] == "ALREADY_RESERVED"


def test_ngo_can_hold_several_listings(make, client):
    provider = make.provider()
    ngo = make.ngo()
    ids = [make.listing(provider) for _ in range(3)]
    for i in ids:
        assert client.post(url(i, "reserve"), headers=h(ngo)).status_code == 200
    mine = client.get("/api/v1/ngo/reservations", headers=h(ngo)).json()
    assert {m["id"] for m in mine} == set(ids)


def test_unverified_ngo_blocked_everywhere(make, client):
    provider = make.provider()
    listing_id = make.listing(provider)
    for status in ("pending", "rejected"):
        ngo = make.ngo(status=status)
        r = client.get("/api/v1/board", headers=h(ngo))
        assert r.status_code == 403 and r.json()["code"] == "NOT_VERIFIED"
        r = client.post(url(listing_id, "reserve"), headers=h(ngo))
        assert r.status_code == 403 and r.json()["code"] == "NOT_VERIFIED"


def test_non_ngo_roles_blocked(make, client):
    provider = make.provider()
    listing_id = make.listing(provider)
    assert client.get("/api/v1/board", headers=h(provider)).status_code == 403
    assert client.post(url(listing_id, "reserve"), headers=h(provider)).status_code == 403
    assert client.post(url(listing_id, "reserve")).status_code == 401


def test_expired_listing_blocked_and_marked_expired(make, client, Session):
    provider = make.provider()
    ngo = make.ngo()
    listing_id = make.listing(provider, window_end=now() - timedelta(minutes=5))
    r = client.post(url(listing_id, "reserve"), headers=h(ngo))
    assert r.status_code == 409 and r.json()["code"] == "LISTING_EXPIRED"
    with Session() as s:
        assert s.get(Listing, listing_id).status == "expired"
    assert client.get("/api/v1/board", headers=h(ngo)).json() == []


def test_reserve_unknown_listing_404(make, client):
    ngo = make.ngo()
    r = client.post(url(9999, "reserve"), headers=h(ngo))
    assert r.status_code == 404 and r.json()["code"] == "NOT_FOUND"


def test_reserved_listing_leaves_board(make, client):
    provider = make.provider()
    listing_id = make.listing(provider)
    a, b = make.ngo(), make.ngo()
    assert len(client.get("/api/v1/board", headers=h(b)).json()) == 1
    client.post(url(listing_id, "reserve"), headers=h(a))
    assert client.get("/api/v1/board", headers=h(b)).json() == []


def test_cancel_returns_listing_to_board_when_window_open(make, client):
    provider = make.provider()
    ngo = make.ngo()
    listing_id = make.listing(provider)
    client.post(url(listing_id, "reserve"), headers=h(ngo))
    r = client.post(url(listing_id, "cancel-reservation"), headers=h(ngo))
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "listed" and body["reserved_by_ngo_id"] is None
    assert len(client.get("/api/v1/board", headers=h(ngo)).json()) == 1


def test_cancel_after_window_end_expires_listing(make, client, Session):
    provider = make.provider()
    ngo = make.ngo()
    listing_id = make.listing(provider, window_end=now() + timedelta(hours=1))
    client.post(url(listing_id, "reserve"), headers=h(ngo))
    with Session() as s:
        s.get(Listing, listing_id).window_end = now() - timedelta(minutes=1)
        s.commit()
    r = client.post(url(listing_id, "cancel-reservation"), headers=h(ngo))
    assert r.status_code == 200 and r.json()["status"] == "expired"


def test_only_reserving_ngo_can_cancel(make, client):
    provider = make.provider()
    owner, other = make.ngo(), make.ngo()
    listing_id = make.listing(provider)
    client.post(url(listing_id, "reserve"), headers=h(owner))
    assert client.post(url(listing_id, "cancel-reservation"), headers=h(other)).status_code == 403
    # a listing that is not reserved cannot be cancelled
    free = make.listing(provider)
    r = client.post(url(free, "cancel-reservation"), headers=h(owner))
    assert r.status_code == 409 and r.json()["code"] == "INVALID_STATE"
    assert client.post(url(9999, "cancel-reservation"), headers=h(owner)).status_code == 404


def test_expire_overdue_job_only_touches_listed(make, Session):
    provider = make.provider()
    ngo = make.ngo()
    past = now() - timedelta(hours=1)
    overdue = make.listing(provider, window_end=past)
    held = make.listing(provider, status="reserved", window_end=past, reserved_by_ngo_id=ngo.id)
    fresh = make.listing(provider)
    with Session() as s:
        assert service.expire_overdue(s) == 1
        assert s.get(Listing, overdue).status == "expired"
        assert s.get(Listing, held).status == "reserved"
        assert s.get(Listing, fresh).status == "listed"


def test_expiry_job_run_once_and_lifespan(make, Session, monkeypatch):
    import asyncio

    from app.reservations import expiry

    provider = make.provider()
    overdue = make.listing(provider, window_end=now() - timedelta(hours=1))
    monkeypatch.setattr(expiry, "SessionLocal", Session)
    assert expiry._run_once() == 1
    with Session() as s:
        assert s.get(Listing, overdue).status == "expired"

    async def run():
        async with expiry.expiry_lifespan(None):
            await asyncio.sleep(0.2)  # let the loop tick once

    asyncio.run(run())
