from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.listings.service import utc

Unit = Literal["kg", "portions"]


class ListingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    food_type: str = Field(min_length=1, max_length=100)
    quantity: float = Field(gt=0, le=100000)
    unit: Unit
    window_start: datetime
    window_end: datetime
    address: str = Field(min_length=1, max_length=500)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    notes: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("title", "food_type", "address")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @model_validator(mode="after")
    def _window(self):
        start, end = utc(self.window_start), utc(self.window_end)
        if start <= datetime.now(timezone.utc):
            raise ValueError("window_start must be in the future")
        if end <= start:
            raise ValueError("window_end must be after window_start")
        self.window_start, self.window_end = start, end
        return self


class ListingPatch(BaseModel):
    """All fields optional; unknown fields (e.g. status) are rejected."""

    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    food_type: Optional[str] = Field(default=None, min_length=1, max_length=100)
    quantity: Optional[float] = Field(default=None, gt=0, le=100000)
    unit: Optional[Unit] = None
    window_start: Optional[datetime] = None
    window_end: Optional[datetime] = None
    address: Optional[str] = Field(default=None, min_length=1, max_length=500)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    notes: Optional[str] = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _no_null_required(self):
        for field in self.model_fields_set:
            if field != "notes" and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        if not self.model_fields_set:
            raise ValueError("no fields to update")
        return self
