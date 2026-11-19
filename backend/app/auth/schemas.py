import re
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE_RE = re.compile(r"^\+?[0-9][0-9\s-]{6,17}$")


def _normalise_email(v: str) -> str:
    v = v.strip().lower()
    if not _EMAIL_RE.match(v) or len(v) > 255:
        raise ValueError("invalid email address")
    return v


class RegisterIn(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=72)  # bcrypt limit is 72 bytes
    role: Literal["provider", "ngo", "admin"]
    name: str = Field(min_length=1, max_length=120)
    phone: str

    # provider
    category: Optional[Literal["restaurant", "caterer", "general"]] = None
    # provider + ngo
    org_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    address: Optional[str] = Field(default=None, min_length=1, max_length=500)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)
    # ngo
    reg_number: Optional[str] = Field(default=None, min_length=1, max_length=100)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _normalise_email(v)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        v = v.strip()
        if not _PHONE_RE.match(v):
            raise ValueError("invalid phone number")
        return v

    @model_validator(mode="after")
    def _role_fields(self):
        if self.role == "provider":
            required = ["category", "org_name", "address", "lat", "lng"]
        elif self.role == "ngo":
            required = ["org_name", "reg_number", "address", "lat", "lng"]
        else:
            return self
        missing = [f for f in required if getattr(self, f) in (None, "")]
        if missing:
            raise ValueError(f"{self.role} registration requires: {', '.join(missing)}")
        return self


class LoginIn(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=72)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return v.strip().lower()
