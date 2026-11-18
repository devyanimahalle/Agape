from pydantic import BaseModel
from typing import List


class MonthlyImpact(BaseModel):
    month: str  # "YYYY-MM"
    meals: int
    kg: float


class ImpactResponse(BaseModel):
    meals_redistributed: int
    kg_saved: float
    listings_completed: int
    active_ngos: int
    active_providers: int
    by_month: List[MonthlyImpact]
