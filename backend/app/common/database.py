"""Database session and engine configuration.

Aliases app.db.session for backward compatibility.
"""
try:
    from app.db.session import Base, engine, SessionLocal, get_db
except ImportError:
    from backend.app.db.session import Base, engine, SessionLocal, get_db

__all__ = ["Base", "engine", "SessionLocal", "get_db"]
