from typing import Dict, List, Optional

from pydantic import BaseModel


class MonthlyImpact(BaseModel):
    month: str  # "YYYY-MM"
    meals: int
    kg: float


class CategoryImpact(BaseModel):
    category: str  # restaurant | caterer | general | other
    listings: int
    meals: int
    kg: float


class RecentPickup(BaseModel):
    """One collected pickup. Public lists carry no organisation names; signed-in lists name the counterpart."""

    id: int
    title: str
    food_type: str
    quantity: float
    unit: str
    est_meals: int
    est_kg: float
    completed_at: Optional[str] = None
    donor_category: Optional[str] = None
    proof_status: str = "none"  # none | pending | approved | rejected: proof of donation
    donor: Optional[str] = None
    ngo: Optional[str] = None


class ImpactResponse(BaseModel):
    # Totals over collected (completed) pickups. Meals and kg are estimates from quantity.
    meals_redistributed: int
    kg_saved: float
    listings_completed: int
    active_ngos: int
    active_providers: int
    by_month: List[MonthlyImpact]
    # Of those, what an admin has confirmed through an approved proof of donation.
    listings_confirmed: int = 0
    meals_confirmed: int = 0
    # The people on the platform (admin-approved accounts).
    verified_donors: int = 0
    verified_ngos: int = 0
    # Every listing by status, and collected food by donor category.
    by_status: Dict[str, int] = {}
    by_category: List[CategoryImpact] = []
    recent: List[RecentPickup] = []


class MyImpactResponse(BaseModel):
    """What the signed-in account has done, taken from the same records as the public figures."""

    role: str
    summary: Dict[str, float]
    recent: List[RecentPickup]
