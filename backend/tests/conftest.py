"""
Shared test fixtures for the SharePlate backend.
Uses SQLite in-memory for fast isolated tests.
"""
import sys
import os
from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

try:
    from app.db.session import Base, get_db
    from app.common.deps import UserStub, get_current_user
    from app.db import models  # noqa: F401 — register all models with Base
    from app.main import app
except ImportError:
    from backend.app.db.session import Base, get_db
    from backend.app.common.deps import UserStub, get_current_user
    from backend.app.db import models  # noqa: F401 — register all models with Base
    from backend.app.main import app


# ---------------------------------------------------------------------------
# Database fixtures
# ---------------------------------------------------------------------------

SQLALCHEMY_DATABASE_URL = "sqlite://"


@pytest.fixture(scope="function")
def db_engine():
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Enable foreign keys for SQLite
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine):
    TestingSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=db_engine
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Auth override helpers
# ---------------------------------------------------------------------------

def _make_auth_override(user: UserStub):
    async def _override():
        return user
    return _override


ADMIN_USER = UserStub(id=1, email="admin@test.com", role="admin", name="Admin")
PROVIDER_USER = UserStub(id=2, email="provider@test.com", role="provider", name="Provider")
NGO_USER = UserStub(id=3, email="ngo@test.com", role="ngo", name="NGO User")


# ---------------------------------------------------------------------------
# TestClient fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def client(db_session: Session):
    """Unauthenticated TestClient with DB override only."""
    def _override_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    # Remove any auth override so unauthenticated calls get 401
    app.dependency_overrides.pop(get_current_user, None)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def admin_client(db_session: Session):
    """TestClient authenticated as admin."""
    def _override_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _make_auth_override(ADMIN_USER)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def provider_client(db_session: Session):
    """TestClient authenticated as provider."""
    def _override_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _make_auth_override(PROVIDER_USER)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def ngo_client(db_session: Session):
    """TestClient authenticated as NGO."""
    def _override_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _make_auth_override(NGO_USER)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
