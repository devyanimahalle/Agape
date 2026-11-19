"""Auth dependencies. These are the public API other roles import:

    from app.auth.dependencies import (
        get_current_user, require_role, require_verified,
        require_verified_role, is_verified, get_profile,
    )

Usage:
    @router.get("/board")
    def board(user = Depends(require_verified_role("ngo")), db = Depends(get_db)): ...
"""
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import decode_access_token
from app.db.models import NgoProfile, ProviderProfile, User
from app.db.session import get_db
from app.errors import AppError

_bearer = HTTPBearer(auto_error=False)  # auto_error=False so we return 401, not 403


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise AppError(401, "NOT_AUTHENTICATED", "Not logged in")
    payload = decode_access_token(creds.credentials)
    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError):
        raise AppError(401, "TOKEN_INVALID", "Invalid authentication token")
    user = db.get(User, user_id)
    if user is None:
        raise AppError(401, "TOKEN_INVALID", "Invalid authentication token")
    if not user.is_active:
        raise AppError(403, "ACCOUNT_DISABLED", "This account has been disabled")
    return user


def require_role(*roles: str):
    """Dependency factory: 403 FORBIDDEN unless the user's role is in `roles`."""
    allowed = set(roles)

    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise AppError(403, "FORBIDDEN", "You do not have permission for this action")
        return user

    return _dep


def get_profile(db: Session, user: User):
    """Return the ProviderProfile / NgoProfile for the user (None for admins)."""
    if user.role == "provider":
        return db.scalar(select(ProviderProfile).where(ProviderProfile.user_id == user.id))
    if user.role == "ngo":
        return db.scalar(select(NgoProfile).where(NgoProfile.user_id == user.id))
    return None


def is_verified(db: Session, user: User) -> bool:
    """Every provider (any category) needs verification_status == approved; NGOs need status == approved."""
    profile = get_profile(db, user)
    if profile is None:
        return False
    if user.role == "provider":
        return profile.verification_status == "approved"
    if user.role == "ngo":
        return profile.status == "approved"
    return False


def require_verified(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> User:
    """403 NOT_VERIFIED unless a provider/NGO is verified. Admins are rejected
    with 403 FORBIDDEN (they should use require_role('admin'))."""
    if user.role not in ("provider", "ngo"):
        raise AppError(403, "FORBIDDEN", "You do not have permission for this action")
    if not is_verified(db, user):
        raise AppError(403, "NOT_VERIFIED", "Your account is not verified yet")
    return user


def require_verified_role(*roles: str):
    """Role check first (403 FORBIDDEN), then verification (403 NOT_VERIFIED)."""
    role_dep = require_role(*roles)

    def _dep(
        user: User = Depends(role_dep), db: Session = Depends(get_db)
    ) -> User:
        if not is_verified(db, user):
            raise AppError(403, "NOT_VERIFIED", "Your account is not verified yet")
        return user

    return _dep
