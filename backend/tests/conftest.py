"""Shared fixtures. Uses DATABASE_URL (Postgres service container in CI);
falls back to in-memory SQLite for quick local runs."""
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import models  # noqa: F401  (registers tables on Base)
from app.db.session import Base, get_db
from app.main import create_app

_URL = os.getenv("TEST_DATABASE_URL") or os.getenv("DATABASE_URL") or "sqlite://"


@pytest.fixture()
def engine():
    kwargs = {}
    if _URL.startswith("sqlite"):
        kwargs = {"connect_args": {"check_same_thread": False}, "poolclass": StaticPool}
    eng = create_engine(_URL, **kwargs)
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def db(engine):
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = Session()
    yield session
    session.close()


@pytest.fixture()
def app(engine):
    application = create_app()
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def _get_db():
        s = Session()
        try:
            yield s
        finally:
            s.close()

    application.dependency_overrides[get_db] = _get_db
    return application


@pytest.fixture()
def client(app):
    return TestClient(app)


PROVIDER = {
    "email": "p@example.com",
    "password": "Passw0rd!",
    "role": "provider",
    "name": "Pat Provider",
    "phone": "+91 98765 43210",
    "category": "restaurant",
    "org_name": "Pat's Kitchen",
    "address": "MG Road, Bengaluru",
    "lat": 12.9716,
    "lng": 77.5946,
}
NGO = {
    "email": "n@example.com",
    "password": "Passw0rd!",
    "role": "ngo",
    "name": "Nina NGO",
    "phone": "9876543210",
    "org_name": "Helping Hands",
    "reg_number": "KA/2020/123",
    "address": "Indiranagar, Bengaluru",
    "lat": 12.9784,
    "lng": 77.6408,
}


@pytest.fixture()
def provider_payload():
    return dict(PROVIDER)


@pytest.fixture()
def ngo_payload():
    return dict(NGO)


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
