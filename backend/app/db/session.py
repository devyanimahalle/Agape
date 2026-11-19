"""Engine, session factory and FastAPI dependency.

`DATABASE_URL` selects the database. PostgreSQL is the target (`postgresql+psycopg://...` for the psycopg v3 driver,
which is what Role D's tests use; `postgresql+psycopg2://` works if that driver is installed instead). When it is
unset the app falls back to a local SQLite file so `uvicorn app.main:app` still starts for quick local runs.
SQLite is fine for Role B's tests; Role D's concurrency tests require PostgreSQL.
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DEFAULT_URL = "sqlite:///./agape_dev.db"


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL") or DEFAULT_URL
    if url.startswith("postgres://"):  # some hosts still hand out the legacy scheme
        url = "postgresql://" + url[len("postgres://"):]
    return url


DATABASE_URL = _database_url()
_kwargs: dict = {"future": True}
if DATABASE_URL.startswith("sqlite"):
    _kwargs["connect_args"] = {"check_same_thread": False}  # FastAPI serves requests from a thread pool
else:
    _kwargs["pool_pre_ping"] = True

engine = create_engine(DATABASE_URL, **_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
Base = declarative_base()


def get_db():
    """Yield a session per request and always close it. Routes commit explicitly."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
