"""ORM tables. Every column here is read or written somewhere in `app/auth`, `app/listings`, `app/reservations`
or their tests. There are no migrations yet: call `init_db()` (or `Base.metadata.create_all(engine)`) once.

Notes
- `ProviderProfile.user_id` and `NgoProfile.user_id` are the primary keys (one profile per user), so
  `db.get(NgoProfile, user.id)` works (Role D's `require_verified_ngo` and `ngo_location`).
- `/auth/me` and `listing_out()` serialise `__table__.columns`, so adding or renaming a column changes the API.
- Statuses and roles are plain strings (validated in the routers), kept portable across PostgreSQL and SQLite.
- Timestamps are timezone-aware; SQLite hands them back naive, which the code treats as UTC.
- Relationships: only the read-only ones the Role E admin service navigates (User.provider_profile/ngo_profile,
  Listing.provider, Proof.listing/ngo). Everything else joins on the foreign keys explicitly.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base, engine


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _created() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), default=_now, server_default=func.now(), nullable=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    # "!" is never a valid bcrypt hash, so accounts created without a password (test factories) cannot log in.
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False, default="!")
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # provider | ngo | admin
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = _created()

    provider_profile = relationship("ProviderProfile", uselist=False, viewonly=True)  # Role E admin views
    ngo_profile = relationship("NgoProfile", uselist=False, viewonly=True)  # Role E admin views


class ProviderProfile(Base):
    __tablename__ = "provider_profiles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    category: Mapped[str] = mapped_column(String(20), nullable=False)  # restaurant | caterer | general
    org_name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500))
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    verification_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    rating_avg: Mapped[float | None] = mapped_column(Float)  # null until rated; general providers are never rated
    rating_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class NgoProfile(Base):
    __tablename__ = "ngo_profiles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    org_name: Mapped[str] = mapped_column(String(200), nullable=False)
    reg_number: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(String(500))
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending | approved | rejected
    rating_avg: Mapped[float | None] = mapped_column(Float)  # null until rated (set by admin proof review)
    rating_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Document(Base):
    """A privately stored uploaded file (proof of donation, verification documents)."""

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)  # proof_photo | proof_letter | ...
    private_path: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = _created()
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # soft delete (Role C uploads)


class VerificationRequest(Base):
    """Role C: one row per verification step awaiting (or past) admin review.

    Provider verification has two steps (1 = identity and business proof, 2 = FSSAI certificate); NGOs have one
    (registration). Only masked identifiers are stored, never the raw PAN or Aadhaar.
    """

    __tablename__ = "verification_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subject_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    subject_type: Mapped[str] = mapped_column(String(20), nullable=False)  # provider | ngo
    step: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 | 2
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending | approved | rejected
    reason: Mapped[str | None] = mapped_column(Text)
    masked_pan: Mapped[str | None] = mapped_column(String(20))
    masked_aadhaar: Mapped[str | None] = mapped_column(String(20))
    fssai_number: Mapped[str | None] = mapped_column(String(20))
    entity_name: Mapped[str | None] = mapped_column(String(255))
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = _created()
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    food_type: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)  # kg | portions
    est_meals: Mapped[int] = mapped_column(Integer, nullable=False)  # an estimate, not a measurement
    est_kg: Mapped[float] = mapped_column(Float, nullable=False)  # an estimate, not a measurement
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="listed")
    reserved_by_ngo_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reserved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _created()

    provider = relationship("User", foreign_keys=[provider_id], viewonly=True)  # Role E admin views

    __table_args__ = (
        Index("ix_listings_status_window_end", "status", "window_end"),
        Index("ix_listings_provider_id", "provider_id"),
        Index("ix_listings_reserved_by_ngo_id", "reserved_by_ngo_id"),
    )


class Proof(Base):
    """One row per uploaded proof file attached to a completed pickup."""

    __tablename__ = "proofs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"), index=True, nullable=False)
    ngo_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    note: Mapped[str | None] = mapped_column(String(1000))
    review_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[datetime] = _created()

    listing = relationship("Listing", viewonly=True)  # Role E admin views
    ngo = relationship("User", foreign_keys=[ngo_id], viewonly=True)  # Role E admin views


class Rating(Base):
    __tablename__ = "ratings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)  # ngo_to_provider
    stars: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(String(1000))
    created_at: Mapped[datetime] = _created()

    # One rating of each kind per listing: the last line of defence against double rating.
    __table_args__ = (UniqueConstraint("listing_id", "kind", name="uq_ratings_listing_kind"),)


def init_db(bind=None) -> None:
    """Create all tables (no migrations yet). Safe to call repeatedly."""
    Base.metadata.create_all(bind or engine)


__all__ = [
    "Base",
    "User",
    "ProviderProfile",
    "NgoProfile",
    "VerificationRequest",
    "Document",
    "Listing",
    "Proof",
    "Rating",
    "init_db",
]
