from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ListingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider_id: int
    title: str
    food_type: str
    quantity: float
    unit: str
    est_meals: int
    est_kg: float
    window_start: datetime
    window_end: datetime
    address: str
    lat: float | None
    lng: float | None
    notes: str | None
    status: str
    reserved_by_ngo_id: int | None
    reserved_at: datetime | None
    completed_at: datetime | None
    created_at: datetime


class BoardListingOut(ListingOut):
    distance_km: float | None
    org_name: str
    rating_avg: float | None  # null for general providers (never rated)
    rating_count: int = 0
    provider_category: str


class ReservationOut(ListingOut):
    org_name: str
    provider_category: str
    has_rated: bool


class GeocodeOut(BaseModel):
    label: str
    lat: float
    lng: float


class RateProviderIn(BaseModel):
    stars: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class RateProviderOut(BaseModel):
    listing_id: int
    stars: int
    comment: str | None
    provider_rating_avg: float | None
    provider_rating_count: int
