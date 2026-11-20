"""Verification package — exposes router (provider) and admin_router."""
from app.verification.router import admin_router, router

__all__ = ["router", "admin_router"]
