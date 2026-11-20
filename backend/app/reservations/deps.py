"""Dependencies for the reservations module.

`current_user` is the single seam to Role B's auth. It must return an object with `.id` and `.role`.
"""
from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.models import NgoProfile
from app.db.session import get_db
from app.reservations.errors import ApiError

try:  # Role B's dependency; adjust this one import if the name differs after merge.
    from app.auth.dependencies import get_current_user as current_user
except ImportError:  # pragma: no cover - only hit before Role B's code is merged

    def current_user():
        raise ApiError(500, "AUTH_NOT_WIRED", "Auth dependency not found: see reservations/deps.py")


__all__ = ["current_user", "get_db", "require_ngo", "require_verified_ngo", "require_ngo_or_provider"]


def require_ngo(user=Depends(current_user)):
    if user.role != "ngo":
        raise ApiError(403, "FORBIDDEN", "Only NGOs can do this")
    return user


def require_verified_ngo(user=Depends(require_ngo), db: Session = Depends(get_db)):
    profile = db.get(NgoProfile, user.id)
    if profile is None or profile.status != "approved":
        raise ApiError(403, "NOT_VERIFIED", "Your NGO has not been approved yet")
    return user


def require_ngo_or_provider(user=Depends(current_user)):
    if user.role not in ("ngo", "provider"):
        raise ApiError(403, "FORBIDDEN", "Not allowed for this role")
    return user
