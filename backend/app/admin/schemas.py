from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ReviewDecision(str, Enum):
    approved = "approved"
    rejected = "rejected"


# --- Stats ---


class ListingsByStatus(BaseModel):
    listed: int = 0
    reserved: int = 0
    completed: int = 0
    cancelled: int = 0
    expired: int = 0


class StatsResponse(BaseModel):
    total_users: int
    ngos_pending: int
    providers_pending: int
    listings_by_status: ListingsByStatus


# --- Users ---


class ProfileOut(BaseModel):
    org_name: Optional[str] = None
    category: Optional[str] = None
    verification_status: Optional[str] = None
    status: Optional[str] = None  # for NGO
    rating_avg: Optional[float] = None
    rating_count: Optional[int] = None
    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    name: str
    phone: Optional[str] = None
    is_active: bool
    created_at: datetime
    profile: Optional[ProfileOut] = None
    model_config = {"from_attributes": True}


class UserPatch(BaseModel):
    is_active: bool


class DeleteResult(BaseModel):
    deleted: int


# --- Proofs ---


class ProofListingInfo(BaseModel):
    id: int
    title: str
    food_type: Optional[str] = None
    quantity: float
    unit: str
    provider_org_name: Optional[str] = None
    model_config = {"from_attributes": True}


class ProofNgoInfo(BaseModel):
    id: int
    org_name: str
    model_config = {"from_attributes": True}


class ProofOut(BaseModel):
    id: int
    listing_id: int
    ngo_id: int
    document_id: int
    note: Optional[str] = None
    review_status: str
    created_at: datetime
    listing: Optional[ProofListingInfo] = None
    ngo: Optional[ProofNgoInfo] = None
    model_config = {"from_attributes": True}


class ProofReviewRequest(BaseModel):
    decision: ReviewDecision
    stars: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
