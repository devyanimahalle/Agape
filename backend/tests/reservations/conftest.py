"""Fixtures for the reservations tests. They need PostgreSQL (the race test is meaningless on SQLite).

Set TEST_DATABASE_URL, e.g. postgresql+psycopg://postgres:postgres@localhost:5432/shareplate_test
"""
import os
from datetime import timedelta
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

_LOCAL_DEFAULT = "postgresql+psycopg://postgres:postgres@localhost:5432/shareplate_test"
_env_db = os.environ.get("DATABASE_URL", "")
# Prefer an explicit TEST_DATABASE_URL, then a Postgres DATABASE_URL (as set by CI), then local default.
TEST_URL = os.environ.get("TEST_DATABASE_URL") or (
    _env_db if _env_db.startswith("postgresql") else _LOCAL_DEFAULT
)
os.environ.setdefault("DATABASE_URL", TEST_URL)

from app.db.models import Base, Listing, NgoProfile, ProviderProfile, User  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.reservations import deps, geocode, register_error_handlers, router  # noqa: E402

from .helpers import DELHI, now  # noqa: E402


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(TEST_URL, future=True)
    if eng.dialect.name != "postgresql":
        pytest.exit("reservations tests require PostgreSQL (set TEST_DATABASE_URL)")
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def Session(engine):
    with engine.begin() as conn:
        names = ", ".join(t.name for t in Base.metadata.sorted_tables)
        conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture()
def db(Session):
    with Session() as s:
        yield s


@pytest.fixture(autouse=True)
def _private_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    geocode.clear_cache()


@pytest.fixture()
def app(Session):
    application = FastAPI()
    register_error_handlers(application)
    application.include_router(router, prefix="/api/v1")

    def _db():
        with Session() as s:
            yield s

    def _user(request: Request):
        uid = request.headers.get("X-User-Id")
        if not uid:
            from app.reservations.errors import ApiError

            raise ApiError(401, "NOT_LOGGED_IN", "not logged in")
        with Session() as s:
            u = s.get(User, int(uid))
            return SimpleNamespace(id=u.id, role=u.role)

    application.dependency_overrides[get_db] = _db
    application.dependency_overrides[deps.current_user] = _user
    return application


@pytest.fixture()
def client(app):
    return TestClient(app)


class Factory:
    def __init__(self, Session):
        self.Session = Session
        self.n = 0

    def _id(self):
        self.n += 1
        return self.n

    def user(self, role):
        with self.Session() as s:
            u = User(email=f"{role}{self._id()}@t.test", role=role, name=role)
            s.add(u)
            s.commit()
            return SimpleNamespace(id=u.id, role=role)

    def ngo(self, status="approved", lat=DELHI[0], lng=DELHI[1]):
        u = self.user("ngo")
        with self.Session() as s:
            s.add(NgoProfile(user_id=u.id, org_name=f"NGO {u.id}", status=status, lat=lat, lng=lng))
            s.commit()
        return u

    def provider(self, category="restaurant", rating_avg=None, rating_count=0):
        u = self.user("provider")
        with self.Session() as s:
            s.add(
                ProviderProfile(
                    user_id=u.id,
                    category=category,
                    org_name=f"Provider {u.id}",
                    verification_status="approved",
                    rating_avg=rating_avg,
                    rating_count=rating_count,
                )
            )
            s.commit()
        return u

    def listing(self, provider, status="listed", lat=DELHI[0], lng=DELHI[1], hours_left=3, **kw):
        end = kw.pop("window_end", now() + timedelta(hours=hours_left))
        with self.Session() as s:
            row = Listing(
                provider_id=provider.id,
                title=kw.pop("title", "Dal and rice"),
                food_type="cooked",
                quantity=20,
                unit="kg",
                est_meals=50,
                est_kg=20,
                window_start=end - timedelta(hours=4),
                window_end=end,
                address="somewhere",
                lat=lat,
                lng=lng,
                status=status,
                **kw,
            )
            s.add(row)
            s.commit()
            return row.id


@pytest.fixture()
def make(Session):
    return Factory(Session)
