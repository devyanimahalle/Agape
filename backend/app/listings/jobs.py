"""Background job: expire `listed` listings past window_end (runs in-process)."""
import logging
import os

from apscheduler.schedulers.background import BackgroundScheduler

from app.db.session import SessionLocal
from app.listings import config
from app.listings.service import expire_listings

log = logging.getLogger(__name__)


def run_expiry() -> None:
    try:
        with SessionLocal() as db:
            count = expire_listings(db)
        if count:
            log.info("Expired %s listing(s)", count)
    except Exception:  # never let the job crash the scheduler
        log.exception("Listing expiry job failed")


def start_scheduler() -> BackgroundScheduler | None:
    if os.getenv("EXPIRY_JOB_ENABLED", "1") == "0":
        return None
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        run_expiry,
        "interval",
        seconds=config.EXPIRY_INTERVAL_SECONDS,
        id="expire_listings",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    run_expiry()  # catch up immediately on startup
    return scheduler
