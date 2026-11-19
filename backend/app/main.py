"""FastAPI entrypoint. Created by Role B (deviation D2: no role owned it).

Other roles register their router in ROUTERS below (one line each) and nothing else.
"""
import os
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import config as auth_config
from app.auth.router import router as auth_router
from app.errors import register_error_handlers
from app.listings.jobs import start_scheduler
from app.listings.router import router as listings_router
from app.reservations import register_error_handlers as register_reservation_errors
from app.reservations import router as board_router

API_PREFIX = "/api/v1"

# One line per module router. Role C/D/E: add yours here.
ROUTERS = [
    auth_router,  # Role B
    listings_router,  # Role B
    # verification_router,   # Role C
    board_router,  # Role D (NGO board and reservations)
    # admin_router, impact_router,  # Role E
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    auth_config.assert_safe_config()
    scheduler = start_scheduler()  # listing expiry job (Role B)
    yield
    if scheduler:
        scheduler.shutdown(wait=False)


def create_app() -> FastAPI:
    app = FastAPI(title="SharePlate API", version="1.0.0", lifespan=lifespan)
    register_error_handlers(app)  # Role B (app.errors)
    register_reservation_errors(app)  # Role D (reservations ApiError)

    origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])

    api = APIRouter(prefix=API_PREFIX)
    for r in ROUTERS:
        api.include_router(r)
    app.include_router(api)

    @app.get("/health", tags=["health"])
    def health():
        return {"status": "ok"}

    return app


app = create_app()
