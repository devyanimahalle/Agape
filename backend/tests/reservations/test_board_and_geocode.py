"""Board ordering, Haversine, and the Nominatim proxy."""
import time

import pytest

from app.reservations import geocode
from app.reservations.geo import haversine_km

from .helpers import h

DELHI = (28.6139, 77.2090)
MUMBAI = (19.0760, 72.8777)
JAIPUR = (26.9124, 75.7873)
AGRA = (27.1767, 78.0081)


def test_haversine_known_distances():
    assert haversine_km(*DELHI, *DELHI) == pytest.approx(0.0)
    assert haversine_km(*DELHI, *MUMBAI) == pytest.approx(1148, abs=8)
    assert haversine_km(*DELHI, *AGRA) == pytest.approx(178, abs=5)
    assert haversine_km(*DELHI, *JAIPUR) == haversine_km(*JAIPUR, *DELHI)


def test_board_sorted_nearest_first_with_distance_and_provider_fields(make, client):
    rest = make.provider("restaurant", rating_avg=4.5, rating_count=2)
    general = make.provider("general", rating_avg=3.0, rating_count=1)  # must be hidden
    ngo = make.ngo()
    far = make.listing(rest, title="far", lat=MUMBAI[0], lng=MUMBAI[1])
    mid = make.listing(rest, title="mid", lat=JAIPUR[0], lng=JAIPUR[1])
    near = make.listing(general, title="near", lat=28.62, lng=77.21)
    r = client.get("/api/v1/board", params={"lat": DELHI[0], "lng": DELHI[1]}, headers=h(ngo))
    assert r.status_code == 200
    rows = r.json()
    assert [x["id"] for x in rows] == [near, mid, far]
    distances = [x["distance_km"] for x in rows]
    assert distances == sorted(distances) and distances[0] < 5 and distances[1] == pytest.approx(237, abs=6)
    assert rows[0]["rating_avg"] is None and rows[0]["provider_category"] == "general"
    assert rows[1]["rating_avg"] == 4.5 and rows[1]["org_name"].startswith("Provider")


def test_board_order_changes_with_ngo_location(make, client):
    rest = make.provider()
    ngo = make.ngo()
    delhi_l = make.listing(rest, lat=DELHI[0], lng=DELHI[1])
    mumbai_l = make.listing(rest, lat=MUMBAI[0], lng=MUMBAI[1])
    from_mumbai = client.get("/api/v1/board", params={"lat": MUMBAI[0], "lng": MUMBAI[1]}, headers=h(ngo)).json()
    assert [x["id"] for x in from_mumbai] == [mumbai_l, delhi_l]


def test_board_excludes_non_listed_statuses(make, client):
    rest = make.provider()
    ngo = make.ngo()
    live = make.listing(rest)
    for status in ("reserved", "completed", "cancelled", "expired"):
        make.listing(rest, status=status)
    rows = client.get("/api/v1/board", params={"lat": 28.6, "lng": 77.2}, headers=h(ngo)).json()
    assert [x["id"] for x in rows] == [live]


def test_board_falls_back_to_saved_location_and_validates(make, client):
    rest = make.provider()
    ngo = make.ngo(lat=MUMBAI[0], lng=MUMBAI[1])
    make.listing(rest, lat=MUMBAI[0], lng=MUMBAI[1])
    rows = client.get("/api/v1/board", headers=h(ngo)).json()
    assert rows[0]["distance_km"] == pytest.approx(0, abs=0.01)
    assert client.get("/api/v1/board", params={"lat": 99, "lng": 0}, headers=h(ngo)).status_code == 422
    no_loc = make.ngo(lat=None, lng=None)
    r = client.get("/api/v1/board", headers=h(no_loc))
    assert r.status_code == 400 and r.json()["code"] == "LOCATION_REQUIRED"


# ------------------------------------------------------------------ geocode

RAW = [{"display_name": "Connaught Place, New Delhi", "lat": "28.6315", "lon": "77.2167"}, {"bad": 1}]


@pytest.fixture()
def upstream(monkeypatch):
    calls = []

    def fake(q):
        calls.append(q)
        return RAW

    monkeypatch.setattr(geocode, "_fetch", fake)
    monkeypatch.setattr(geocode, "MIN_INTERVAL_S", 0.0)
    return calls


def test_geocode_returns_label_lat_lng_and_caches(make, client, upstream):
    ngo = make.ngo()
    r1 = client.get("/api/v1/geocode", params={"q": "Connaught  Place"}, headers=h(ngo))
    r2 = client.get("/api/v1/geocode", params={"q": "connaught place"}, headers=h(make.provider()))
    assert r1.status_code == r2.status_code == 200
    assert r1.json() == [{"label": "Connaught Place, New Delhi", "lat": 28.6315, "lng": 77.2167}]
    assert len(upstream) == 1  # second call served from cache (case/whitespace-insensitive)


def test_geocode_validation_and_roles(make, client, upstream):
    ngo = make.ngo()
    assert client.get("/api/v1/geocode", params={"q": "ab"}, headers=h(ngo)).status_code == 422
    assert client.get("/api/v1/geocode", headers=h(ngo)).status_code == 422
    admin = make.user("admin")
    assert client.get("/api/v1/geocode", params={"q": "delhi"}, headers=h(admin)).status_code == 403
    assert client.get("/api/v1/geocode", params={"q": "delhi"}).status_code == 401
    assert upstream == []


def test_geocode_upstream_failure_is_502(make, client, monkeypatch):
    import httpx

    def boom(q):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(geocode, "_fetch", boom)
    r = client.get("/api/v1/geocode", params={"q": "somewhere"}, headers=h(make.ngo()))
    assert r.status_code == 502 and r.json()["code"] == "GEOCODER_UNAVAILABLE"


def test_geocode_throttles_to_one_request_per_second(monkeypatch):
    monkeypatch.setattr(geocode, "_fetch", lambda q: [])
    monkeypatch.setattr(geocode, "MIN_INTERVAL_S", 0.3)
    geocode.clear_cache()
    geocode.search("first place")
    start = time.monotonic()
    geocode.search("second place")
    assert time.monotonic() - start >= 0.25


def test_geocode_sends_identifying_user_agent(monkeypatch):
    seen = {}

    class Resp:
        def raise_for_status(self):
            pass

        def json(self):
            return []

    def fake_get(url, params, headers, timeout):
        seen.update(url=url, params=params, headers=headers)
        return Resp()

    monkeypatch.setattr(geocode.httpx, "get", fake_get)
    monkeypatch.setattr(geocode, "MIN_INTERVAL_S", 0.0)
    geocode.search("Pune station")
    assert "SharePlate" in seen["headers"]["User-Agent"]
    assert seen["params"]["format"] == "jsonv2" and seen["params"]["q"] == "pune station"
