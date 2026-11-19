"""Initial schema for SharePlate contract tables.

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-11-19 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("role IN ('admin', 'provider', 'ngo')", name=op.f("ck_users_role")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    # 2. provider_profiles
    op.create_table(
        "provider_profiles",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("org_name", sa.String(length=255), nullable=False),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column(
            "verification_status",
            sa.String(length=20),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("rating_avg", sa.Float(), nullable=True),
        sa.Column("rating_count", sa.Integer(), server_default="0", nullable=False),
        sa.CheckConstraint(
            "category IN ('restaurant', 'caterer', 'general')",
            name=op.f("ck_provider_profiles_category"),
        ),
        sa.CheckConstraint(
            "verification_status IN ('pending', 'approved', 'rejected')",
            name=op.f("ck_provider_profiles_verification_status"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_provider_profiles_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", name=op.f("pk_provider_profiles")),
    )

    # 3. ngo_profiles
    op.create_table(
        "ngo_profiles",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("org_name", sa.String(length=255), nullable=False),
        sa.Column("reg_number", sa.String(length=100), nullable=True),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("rating_avg", sa.Float(), nullable=True),
        sa.Column("rating_count", sa.Integer(), server_default="0", nullable=False),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name=op.f("ck_ngo_profiles_status"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_ngo_profiles_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", name=op.f("pk_ngo_profiles")),
    )

    # 4. verification_requests
    op.create_table(
        "verification_requests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("subject_user_id", sa.Integer(), nullable=False),
        sa.Column("subject_type", sa.String(length=20), nullable=False),
        sa.Column("step", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("masked_pan", sa.String(length=20), nullable=True),
        sa.Column("masked_aadhaar", sa.String(length=20), nullable=True),
        sa.Column("fssai_number", sa.String(length=20), nullable=True),
        sa.Column("entity_name", sa.String(length=255), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "subject_type IN ('provider', 'ngo')",
            name=op.f("ck_verification_requests_subject_type"),
        ),
        sa.CheckConstraint("step IN (1, 2)", name=op.f("ck_verification_requests_step")),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name=op.f("ck_verification_requests_status"),
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by"],
            ["users.id"],
            name=op.f("fk_verification_requests_reviewed_by_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["subject_user_id"],
            ["users.id"],
            name=op.f("fk_verification_requests_subject_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_verification_requests")),
    )

    # 5. documents
    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=50), nullable=False),
        sa.Column("private_path", sa.String(length=1000), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "kind IN ('business_proof', 'pan', 'aadhaar', 'passport', 'fssai_cert', "
            "'ngo_reg', 'proof_photo', 'proof_letter')",
            name=op.f("ck_documents_kind"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_documents_owner_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_documents")),
    )

    # 6. listings
    op.create_table(
        "listings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("provider_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("food_type", sa.String(length=100), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(length=20), nullable=False),
        sa.Column("est_meals", sa.Integer(), nullable=False),
        sa.Column("est_kg", sa.Float(), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("window_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("address", sa.String(length=500), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="listed", nullable=False),
        sa.Column("reserved_by_ngo_id", sa.Integer(), nullable=True),
        sa.Column("reserved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("unit IN ('kg', 'portions')", name=op.f("ck_listings_unit")),
        sa.CheckConstraint(
            "status IN ('listed', 'reserved', 'completed', 'cancelled', 'expired')",
            name=op.f("ck_listings_status"),
        ),
        sa.ForeignKeyConstraint(
            ["provider_id"],
            ["users.id"],
            name=op.f("fk_listings_provider_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reserved_by_ngo_id"],
            ["users.id"],
            name=op.f("fk_listings_reserved_by_ngo_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_listings")),
    )
    op.create_index(
        "ix_listings_status_window_end",
        "listings",
        ["status", "window_end"],
        unique=False,
    )

    # 7. proofs
    op.create_table(
        "proofs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column("ngo_id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "review_status",
            sa.String(length=20),
            server_default="pending",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "review_status IN ('pending', 'approved', 'rejected')",
            name=op.f("ck_proofs_review_status"),
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
            name=op.f("fk_proofs_document_id_documents"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["listing_id"],
            ["listings.id"],
            name=op.f("fk_proofs_listing_id_listings"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["ngo_id"],
            ["users.id"],
            name=op.f("fk_proofs_ngo_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_proofs")),
    )

    # 8. ratings
    op.create_table(
        "ratings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("stars", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "kind IN ('ngo_to_provider', 'admin_to_ngo')",
            name=op.f("ck_ratings_kind"),
        ),
        sa.CheckConstraint("stars >= 1 AND stars <= 5", name=op.f("ck_ratings_stars")),
        sa.ForeignKeyConstraint(
            ["listing_id"],
            ["listings.id"],
            name=op.f("fk_ratings_listing_id_listings"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ratings")),
        sa.UniqueConstraint("listing_id", "kind", name=op.f("uq_ratings_listing_id_kind")),
    )


def downgrade() -> None:
    op.drop_table("ratings")
    op.drop_table("proofs")
    op.drop_index("ix_listings_status_window_end", table_name="listings")
    op.drop_table("listings")
    op.drop_table("documents")
    op.drop_table("verification_requests")
    op.drop_table("ngo_profiles")
    op.drop_table("provider_profiles")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
