"""Shared fixtures for verification tests.

Creates a self-contained FastAPI test application that includes:
- auth router (register / login)
- verification router  (prefix /api/v1/verification)
- admin_router          (prefix /api/v1/admin)

This avoids depending on app.main.create_app(), which does NOT include the
verification routers until Role B adds the two lines noted in router.py.

Role B must add to ROUTERS in backend/app/main.py:
    from app.verification.router import router as verification_router, admin_router
    verification_router,   # Role C — prefix /verification
    admin_router,          # Role C — prefix /admin
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.router import router as auth_router
from app.db.models import Base
from app.db.session import get_db
from app.errors import register_error_handlers
from app.verification.router import admin_router
from app.verification.router import router as verification_router


# ---------------------------------------------------------------------------
# DB fixtures (SQLite in-memory, same as Role B's pattern)
# ---------------------------------------------------------------------------


@pytest.fixture()
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def SessionFactory(engine):  # noqa: N802
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture()
def db(SessionFactory):  # noqa: N803
    s = SessionFactory()
    yield s
    s.close()


# ---------------------------------------------------------------------------
# App + client fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def app(engine, SessionFactory, tmp_path, monkeypatch):  # noqa: N803
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "uploads"))
    monkeypatch.setenv("MAX_UPLOAD_BYTES", "10485760")  # 10 MB

    application = FastAPI()
    register_error_handlers(application)

    def _db():
        s = SessionFactory()
        try:
            yield s
        finally:
            s.close()

    application.dependency_overrides[get_db] = _db
    application.include_router(auth_router, prefix="/api/v1")
    application.include_router(verification_router, prefix="/api/v1")
    application.include_router(admin_router, prefix="/api/v1")
    return application


@pytest.fixture()
def client(app):
    return TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Helper callables (not fixtures — called directly in tests)
# ---------------------------------------------------------------------------


def register_and_login(client: TestClient, payload: dict) -> str:
    """Register a user then log in; return the JWT access token."""
    r = client.post("/api/v1/auth/register", json=payload)
    assert r.status_code == 201, r.text
    r2 = client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert r2.status_code == 200, r2.text
    return r2.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def tiny_pdf() -> bytes:
    """Minimal valid-ish PDF magic bytes."""
    return b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 0\ntrailer<<>>\nstartxref\n0\n%%EOF"


# ---------------------------------------------------------------------------
# Stock user payloads
# ---------------------------------------------------------------------------

RESTAURANT_PAYLOAD = {
    "email": "rest@test.com",
    "password": "Password1!",
    "role": "provider",
    "name": "Test Restaurant",
    "phone": "+919000000001",
    "category": "restaurant",
    "org_name": "Test Org",
    "address": "123 Main St",
    "lat": 12.9,
    "lng": 77.6,
}

CATERER_PAYLOAD = {
    "email": "cater@test.com",
    "password": "Password1!",
    "role": "provider",
    "name": "Test Caterer",
    "phone": "+919000000002",
    "category": "caterer",
    "org_name": "Cater Org",
    "address": "456 Side St",
    "lat": 12.9,
    "lng": 77.6,
}

GENERAL_PAYLOAD = {
    "email": "gen@test.com",
    "password": "Password1!",
    "role": "provider",
    "name": "General Provider",
    "phone": "+919000000003",
    "category": "general",
    "org_name": "Gen Org",
    "address": "789 Other St",
    "lat": 12.9,
    "lng": 77.6,
}

NGO_PAYLOAD = {
    "email": "ngo@test.com",
    "password": "Password1!",
    "role": "ngo",
    "name": "Test NGO",
    "phone": "+919000000004",
    "org_name": "NGO Org",
    "reg_number": "REG001",
    "address": "321 NGO St",
    "lat": 12.9,
    "lng": 77.6,
}
