"""Impact service — aggregation queries for the public dashboard."""
from sqlalchemy import func, case, extract, cast, String
from sqlalchemy.orm import Session

from backend.app.db.models import Listing
from backend.app.impact import schemas


def get_impact(db: Session) -> schemas.ImpactResponse:
    """Return aggregate impact numbers from completed listings."""

    # Totals
    row = (
        db.query(
            func.coalesce(func.sum(Listing.est_meals), 0).label("meals"),
            func.coalesce(func.sum(Listing.est_kg), 0.0).label("kg"),
            func.count(Listing.id).label("count"),
            func.count(func.distinct(Listing.reserved_by_ngo_id)).label("ngos"),
            func.count(func.distinct(Listing.provider_id)).label("providers"),
        )
        .filter(Listing.status == "completed")
        .first()
    )

    meals_redistributed = int(row.meals) if row else 0
    kg_saved = float(row.kg) if row else 0.0
    listings_completed = int(row.count) if row else 0
    active_ngos = int(row.ngos) if row else 0
    active_providers = int(row.providers) if row else 0

    # Monthly breakdown — use strftime for SQLite compat, works with PostgreSQL too via raw SQL
    # We need to be database-agnostic: SQLite uses strftime, PostgreSQL uses to_char/date_trunc.
    # Strategy: extract year and month separately, combine.
    monthly_rows = (
        db.query(
            extract("year", Listing.completed_at).label("yr"),
            extract("month", Listing.completed_at).label("mo"),
            func.coalesce(func.sum(Listing.est_meals), 0).label("meals"),
            func.coalesce(func.sum(Listing.est_kg), 0.0).label("kg"),
        )
        .filter(Listing.status == "completed", Listing.completed_at.isnot(None))
        .group_by(
            extract("year", Listing.completed_at),
            extract("month", Listing.completed_at),
        )
        .order_by(
            extract("year", Listing.completed_at),
            extract("month", Listing.completed_at),
        )
        .all()
    )

    by_month = [
        schemas.MonthlyImpact(
            month=f"{int(r.yr):04d}-{int(r.mo):02d}",
            meals=int(r.meals),
            kg=float(r.kg),
        )
        for r in monthly_rows
    ]

    return schemas.ImpactResponse(
        meals_redistributed=meals_redistributed,
        kg_saved=kg_saved,
        listings_completed=listings_completed,
        active_ngos=active_ngos,
        active_providers=active_providers,
        by_month=by_month,
    )
