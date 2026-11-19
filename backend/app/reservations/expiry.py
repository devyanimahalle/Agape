"""Background job for rule 6: periodically expire overdue `listed` listings.

Use as the app lifespan (or inside an existing one):

    app = FastAPI(lifespan=expiry_lifespan)
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from app.db.session import SessionLocal
from app.reservations.service import expire_overdue

log = logging.getLogger(__name__)
INTERVAL_S = 60


def _run_once() -> int:
    with SessionLocal() as db:
        return expire_overdue(db)


async def _loop() -> None:
    while True:
        try:
            changed = await asyncio.to_thread(_run_once)
            if changed:
                log.info("expired %s overdue listings", changed)
        except Exception:  # never let the job die
            log.exception("expiry job failed")
        await asyncio.sleep(INTERVAL_S)


@asynccontextmanager
async def expiry_lifespan(_app):
    task = asyncio.create_task(_loop())
    try:
        yield
    finally:
        task.cancel()
