"""Verification service — business logic, no HTTP concerns."""
from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    Document,
    NgoProfile,
    ProviderProfile,
    VerificationRequest,
)
from app.errors import AppError

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_STEP1_PROVIDER_KINDS = {"business_proof", "pan", "aadhaar", "passport"}
_STEP2_PROVIDER_KINDS = {"fssai_cert"}
_NGO_KINDS = {"ngo_reg"}

_PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
_AADHAAR_RE = re.compile(r"^\d{12}$")
_FSSAI_RE = re.compile(r"^\d{14}$")

EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def validate_pan(pan: str) -> None:
    """Validate PAN format AAAAA9999A. Raises AppError on failure."""
    if not _PAN_RE.match(pan):
        raise AppError(422, "INVALID_PAN", "PAN must be in format AAAAA9999A (5 letters, 4 digits, 1 letter)")


def validate_aadhaar(aadhaar: str) -> None:
    """Validate Aadhaar is exactly 12 digits. Raises AppError on failure."""
    if not _AADHAAR_RE.match(aadhaar):
        raise AppError(422, "INVALID_AADHAAR", "Aadhaar number must be exactly 12 digits")


def validate_fssai(fssai: str) -> None:
    """Validate FSSAI is exactly 14 digits. Raises AppError on failure."""
    if not _FSSAI_RE.match(fssai):
        raise AppError(422, "INVALID_FSSAI", "FSSAI number must be exactly 14 digits")


def mask_pan(pan: str) -> str:
    """Return masked PAN — first 6 chars replaced with X, last 4 kept."""
    return "XXXXX" + pan[-5:]


def mask_aadhaar(aadhaar: str) -> str:
    """Return masked Aadhaar — all but last 4 digits replaced with X."""
    return "XXXX-XXXX-" + aadhaar[-4:]


# ---------------------------------------------------------------------------
# Document-to-request linking helper
# ---------------------------------------------------------------------------

def _docs_for_step(
    db: Session,
    owner_id: int,
    kinds: set[str],
    after: datetime,
) -> list[Document]:
    """Return non-deleted documents owned by `owner_id` with kind in `kinds`
    created after `after`.

    This links documents to a verification request without a FK column:
    we find all documents of the relevant kinds created since the previous
    review (or epoch if there was none). Documents uploaded before the
    previous review are from an earlier attempt and are excluded.
    """
    rows = db.scalars(
        select(Document).where(
            Document.owner_id == owner_id,
            Document.kind.in_(kinds),
            Document.deleted_at.is_(None),
            Document.created_at > after,
        )
    ).all()
    return list(rows)


def _last_review_time(
    db: Session,
    subject_user_id: int,
    subject_type: str,
    step: int,
) -> datetime:
    """Return the reviewed_at of the most recent non-pending request for this
    subject+step, or EPOCH if none exists. Used to anchor document linking."""
    row = db.scalar(
        select(VerificationRequest.reviewed_at).where(
            VerificationRequest.subject_user_id == subject_user_id,
            VerificationRequest.subject_type == subject_type,
            VerificationRequest.step == step,
            VerificationRequest.status != "pending",
        ).order_by(VerificationRequest.reviewed_at.desc())
    )
    return row if row is not None else EPOCH


# ---------------------------------------------------------------------------
# Provider Step 1
# ---------------------------------------------------------------------------

def submit_provider_step1(
    db: Session,
    provider_user_id: int,
    masked_pan: str | None,
    masked_aadhaar: str | None,
    entity_name: str,
) -> VerificationRequest:
    """Create (or resubmit after rejection) a step-1 verification request."""
    # Block while pending
    pending = db.scalar(
        select(VerificationRequest).where(
            VerificationRequest.subject_user_id == provider_user_id,
            VerificationRequest.subject_type == "provider",
            VerificationRequest.step == 1,
            VerificationRequest.status == "pending",
        )
    )
    if pending:
        raise AppError(409, "ALREADY_PENDING", "A verification request is already pending review")

    vr = VerificationRequest(
        subject_user_id=provider_user_id,
        subject_type="provider",
        step=1,
        status="pending",
        masked_pan=masked_pan,
        masked_aadhaar=masked_aadhaar,
        entity_name=entity_name,
    )
    db.add(vr)
    db.flush()
    return vr


# ---------------------------------------------------------------------------
# Provider Step 2
# ---------------------------------------------------------------------------

def submit_provider_step2(
    db: Session,
    provider_user_id: int,
    fssai_number: str,
    entity_name: str,
) -> VerificationRequest:
    """Create (or resubmit after rejection) a step-2 verification request."""
    # Step 1 must be approved
    step1 = db.scalar(
        select(VerificationRequest).where(
            VerificationRequest.subject_user_id == provider_user_id,
            VerificationRequest.subject_type == "provider",
            VerificationRequest.step == 1,
            VerificationRequest.status == "approved",
        )
    )
    if not step1:
        raise AppError(403, "STEP1_NOT_APPROVED", "Step 1 verification must be approved before proceeding")

    # Block while pending
    pending = db.scalar(
        select(VerificationRequest).where(
            VerificationRequest.subject_user_id == provider_user_id,
            VerificationRequest.subject_type == "provider",
            VerificationRequest.step == 2,
            VerificationRequest.status == "pending",
        )
    )
    if pending:
        raise AppError(409, "ALREADY_PENDING", "A step 2 verification request is already pending")

    vr = VerificationRequest(
        subject_user_id=provider_user_id,
        subject_type="provider",
        step=2,
        status="pending",
        fssai_number=fssai_number,
        entity_name=entity_name,
    )
    db.add(vr)
    db.flush()
    return vr


# ---------------------------------------------------------------------------
# Provider status
# ---------------------------------------------------------------------------

def get_provider_status(db: Session, provider_user_id: int) -> dict:
    """Return {step1, step2, overall} dicts with status and optional reason."""
    def _latest(step: int) -> VerificationRequest | None:
        return db.scalar(
            select(VerificationRequest)
            .where(
                VerificationRequest.subject_user_id == provider_user_id,
                VerificationRequest.subject_type == "provider",
                VerificationRequest.step == step,
            )
            .order_by(VerificationRequest.created_at.desc())
        )

    s1 = _latest(1)
    s2 = _latest(2)

    def _shape(vr: VerificationRequest | None) -> dict:
        if vr is None:
            return {"status": "not_submitted", "reason": None}
        return {"status": vr.status, "reason": vr.reason}

    s1_shape = _shape(s1)
    s2_shape = _shape(s2)

    # Overall: approved only if both approved; rejected if either rejected; else pending
    if s1_shape["status"] == "approved" and s2_shape["status"] == "approved":
        overall = "approved"
    elif s1_shape["status"] == "rejected" or s2_shape["status"] == "rejected":
        overall = "rejected"
    elif s1_shape["status"] == "not_submitted":
        overall = "not_submitted"
    else:
        overall = "pending"

    return {"step1": s1_shape, "step2": s2_shape, "overall": overall}


# ---------------------------------------------------------------------------
# NGO
# ---------------------------------------------------------------------------

def submit_ngo(
    db: Session,
    ngo_user_id: int,
    reg_number: str,
) -> VerificationRequest:
    """Create (or resubmit after rejection) an NGO verification request."""
    # Block while pending
    pending = db.scalar(
        select(VerificationRequest).where(
            VerificationRequest.subject_user_id == ngo_user_id,
            VerificationRequest.subject_type == "ngo",
            VerificationRequest.step == 1,
            VerificationRequest.status == "pending",
        )
    )
    if pending:
        raise AppError(409, "ALREADY_PENDING", "A verification request is already pending review")

    # Update reg_number on profile
    profile = db.get(NgoProfile, ngo_user_id)
    if profile:
        profile.reg_number = reg_number
        db.flush()

    vr = VerificationRequest(
        subject_user_id=ngo_user_id,
        subject_type="ngo",
        step=1,
        status="pending",
        entity_name=reg_number,
    )
    db.add(vr)
    db.flush()
    return vr


# ---------------------------------------------------------------------------
# Admin: list
# ---------------------------------------------------------------------------

def list_verifications(
    db: Session,
    status: str | None,
    subject_type: str | None,
) -> list[dict]:
    """Return verification requests with subject info and document IDs."""
    q = select(VerificationRequest)
    if status:
        q = q.where(VerificationRequest.status == status)
    if subject_type:
        q = q.where(VerificationRequest.subject_type == subject_type)
    q = q.order_by(VerificationRequest.created_at.desc())
    rows = db.scalars(q).all()

    result = []
    for vr in rows:
        step_kinds = (
            _STEP1_PROVIDER_KINDS if vr.subject_type == "provider" and vr.step == 1
            else _STEP2_PROVIDER_KINDS if vr.subject_type == "provider" and vr.step == 2
            else _NGO_KINDS
        )
        anchor = _last_review_time(db, vr.subject_user_id, vr.subject_type, vr.step)
        docs = _docs_for_step(db, vr.subject_user_id, step_kinds, anchor)
        result.append({
            "id": vr.id,
            "subject_user_id": vr.subject_user_id,
            "subject_type": vr.subject_type,
            "step": vr.step,
            "status": vr.status,
            "entity_name": vr.entity_name,
            "masked_pan": vr.masked_pan,
            "masked_aadhaar": vr.masked_aadhaar,
            "fssai_number": vr.fssai_number,
            "reason": vr.reason,
            "created_at": vr.created_at.isoformat() if vr.created_at else None,
            "reviewed_at": vr.reviewed_at.isoformat() if vr.reviewed_at else None,
            "document_ids": [d.id for d in docs],
        })
    return result


# ---------------------------------------------------------------------------
# Admin: decide
# ---------------------------------------------------------------------------

def decide(
    db: Session,
    vr_id: int,
    decision: str,
    reason: str | None,
    admin_user_id: int,
) -> dict:
    """Apply a verification decision. One transaction; updates profiles."""
    vr = db.get(VerificationRequest, vr_id)
    if vr is None:
        raise AppError(404, "NOT_FOUND", "Verification request not found")
    if vr.status != "pending":
        raise AppError(409, "ALREADY_DECIDED", "This request has already been decided")
    if decision == "rejected" and not reason:
        raise AppError(422, "REASON_REQUIRED", "A reason is required when rejecting")

    now = datetime.now(timezone.utc)
    vr.status = decision
    vr.reason = reason
    vr.reviewed_by = admin_user_id
    vr.reviewed_at = now
    db.flush()

    # Delete sensitive identity documents to minimise data retention
    if vr.subject_type == "provider" and vr.step == 1:
        _delete_identity_docs(db, vr.subject_user_id)
        _update_provider_status(db, vr.subject_user_id)
    elif vr.subject_type == "provider" and vr.step == 2:
        _update_provider_status(db, vr.subject_user_id)
    elif vr.subject_type == "ngo":
        _update_ngo_status(db, vr.subject_user_id, decision)

    db.commit()
    return {
        "id": vr.id,
        "status": vr.status,
        "reason": vr.reason,
        "reviewed_at": vr.reviewed_at.isoformat(),
    }


def _delete_identity_docs(db: Session, owner_id: int) -> None:
    """Soft-delete pan/aadhaar/passport documents (data minimisation after decision)."""
    from app.common.uploads import delete_document  # local import to avoid circular
    sensitive_kinds = {"pan", "aadhaar", "passport"}
    docs = db.scalars(
        select(Document).where(
            Document.owner_id == owner_id,
            Document.kind.in_(sensitive_kinds),
            Document.deleted_at.is_(None),
        )
    ).all()
    for doc in docs:
        delete_document(db, doc)
    db.flush()


def _update_provider_status(db: Session, provider_user_id: int) -> None:
    """Recompute provider_profiles.verification_status from step outcomes."""
    s1 = db.scalar(
        select(VerificationRequest.status).where(
            VerificationRequest.subject_user_id == provider_user_id,
            VerificationRequest.subject_type == "provider",
            VerificationRequest.step == 1,
        ).order_by(VerificationRequest.created_at.desc())
    )
    s2 = db.scalar(
        select(VerificationRequest.status).where(
            VerificationRequest.subject_user_id == provider_user_id,
            VerificationRequest.subject_type == "provider",
            VerificationRequest.step == 2,
        ).order_by(VerificationRequest.created_at.desc())
    )

    if s1 == "approved" and s2 == "approved":
        new_status = "approved"
    elif s1 == "rejected" or s2 == "rejected":
        new_status = "rejected"
    else:
        new_status = "pending"

    profile = db.get(ProviderProfile, provider_user_id)
    if profile:
        profile.verification_status = new_status
        db.flush()


def _update_ngo_status(db: Session, ngo_user_id: int, decision: str) -> None:
    profile = db.get(NgoProfile, ngo_user_id)
    if profile:
        profile.status = decision
        db.flush()
