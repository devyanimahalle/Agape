# Stub models — Role C owns the canonical version. Keep in sync.
"""
SQLAlchemy ORM models for the SharePlate database.
"""
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

try:
    from app.db.session import Base
except ImportError:
    try:
        from backend.app.db.session import Base
    except ImportError:
        from backend.app.common.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False, default="")
    role = Column(String(50), nullable=False)  # admin | provider | ngo
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    provider_profile = relationship(
        "ProviderProfile", back_populates="user", uselist=False
    )
    ngo_profile = relationship(
        "NgoProfile", back_populates="user", uselist=False
    )


class ProviderProfile(Base):
    __tablename__ = "provider_profiles"

    user_id = Column(
        Integer, ForeignKey("users.id"), primary_key=True
    )
    category = Column(String(100), nullable=True)
    org_name = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    verification_status = Column(
        String(50), default="pending", nullable=False
    )
    rating_avg = Column(Float, default=0.0)
    rating_count = Column(Integer, default=0)

    user = relationship("User", back_populates="provider_profile")


class NgoProfile(Base):
    __tablename__ = "ngo_profiles"

    user_id = Column(
        Integer, ForeignKey("users.id"), primary_key=True
    )
    org_name = Column(String(255), nullable=True)
    reg_number = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    status = Column(String(50), default="pending", nullable=False)
    rating_avg = Column(Float, default=0.0)
    rating_count = Column(Integer, default=0)

    user = relationship("User", back_populates="ngo_profile")


class VerificationRequest(Base):
    __tablename__ = "verification_requests"

    id = Column(Integer, primary_key=True, index=True)
    subject_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_type = Column(String(50), nullable=False)
    step = Column(String(100), nullable=True)
    status = Column(String(50), default="pending", nullable=False)
    reason = Column(Text, nullable=True)
    masked_pan = Column(String(50), nullable=True)
    masked_aadhaar = Column(String(50), nullable=True)
    fssai_number = Column(String(100), nullable=True)
    entity_name = Column(String(255), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    reviewed_at = Column(DateTime, nullable=True)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    kind = Column(String(100), nullable=False)
    private_path = Column(Text, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    deleted_at = Column(DateTime, nullable=True)


class Listing(Base):
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    food_type = Column(String(100), nullable=True)
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)  # kg | portions
    est_meals = Column(Integer, default=0)
    est_kg = Column(Float, default=0.0)
    window_start = Column(DateTime, nullable=True)
    window_end = Column(DateTime, nullable=True)
    address = Column(Text, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(
        String(50), default="listed", nullable=False
    )  # listed|reserved|completed|cancelled|expired
    reserved_by_ngo_id = Column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    reserved_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    provider = relationship(
        "User", foreign_keys=[provider_id]
    )
    reserved_by_ngo = relationship(
        "User", foreign_keys=[reserved_by_ngo_id]
    )


class Proof(Base):
    __tablename__ = "proofs"

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("listings.id"), nullable=False)
    ngo_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    note = Column(Text, nullable=True)
    review_status = Column(
        String(50), default="pending", nullable=False
    )  # pending|approved|rejected
    created_at = Column(DateTime, default=func.now(), nullable=False)

    listing = relationship("Listing")
    ngo = relationship("User", foreign_keys=[ngo_id])


class Rating(Base):
    __tablename__ = "ratings"
    __table_args__ = (
        UniqueConstraint("listing_id", "kind", name="uq_rating_listing_kind"),
    )

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("listings.id"), nullable=False)
    kind = Column(
        String(50), nullable=False
    )  # ngo_to_provider | admin_to_ngo
    stars = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
