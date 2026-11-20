"""
Shared dependencies for the SharePlate backend.
These are stubs that will be replaced when Role B delivers auth.
"""
from fastapi import Depends, HTTPException, status, Header
from typing import Optional


class UserStub:
    """Stub user model for development."""

    def __init__(
        self,
        id: int,
        email: str,
        role: str,
        name: str,
        is_active: bool = True,
    ):
        self.id = id
        self.email = email
        self.role = role
        self.name = name
        self.is_active = is_active


async def get_current_user(
    authorization: Optional[str] = Header(None),
) -> UserStub:
    """
    Stub: in production, Role B's JWT decoder replaces this.
    For now, we decode a simple scheme or raise 401.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1]
    token_map = {
        "admin-token": UserStub(
            id=1, email="admin@shareplate.demo", role="admin", name="Admin"
        ),
        "provider-token": UserStub(
            id=2, email="restaurant@shareplate.demo", role="provider", name="Provider"
        ),
        "ngo-token": UserStub(
            id=3, email="ngo1@shareplate.demo", role="ngo", name="NGO User"
        ),
    }
    user = token_map.get(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    return user


def require_role(*roles: str):
    """Dependency that checks the current user has one of the specified roles."""

    async def _check(
        current_user: UserStub = Depends(get_current_user),
    ):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _check
