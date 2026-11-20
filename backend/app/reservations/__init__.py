"""Role D: NGO board and reservations.

Wire-up (in main.py, owned by another role):

    from app.reservations import router as reservations_router, register_error_handlers
    register_error_handlers(app)
    app.include_router(reservations_router, prefix="/api/v1")
"""
from app.reservations.errors import ApiError, register_error_handlers
from app.reservations.router import router

__all__ = ["router", "ApiError", "register_error_handlers"]
