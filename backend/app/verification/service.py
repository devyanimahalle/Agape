"""Verification service: business logic, no HTTP concerns.

A provider (donor) submits ONE combined verification request: identity and business details with their documents
(step 1 in the UI) together with the FSSAI licence number and certificate (step 2 in the UI). The two UI steps are
only a form wizard; the admin sees and decides a single request. NGOs submit one request with their registration.
Only masked PAN and Aadhaar values are ever stored or returned.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    Document,
    NgoProfile,
    ProviderProfile,
    User,
    VerificationRequest,
)
from app.errors import AppError

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_PROVIDER_KINDS = {"business_proof", "pan", "aadhaar", "passport", "fssai_cert"}
_NGO_KINDS = {"ngo_reg"}
_SENSITIVE_KINDS = {"pan", "aadhaar", "passport"}

_PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
_AADHAAR_RE = re.compile(r"^\d{12}$")
_FSSAI_RE = re.compile(r"^\d{14}$")

EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
FAR_FUTURE = datetime(9999, 1, 1, tzinfo=timezone.utc)


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
    """Return masked PAN: first 5 chars replaced with X, last 5 kept."""
    return "XXXXX" + pan[-5:]


def mask_aadhaar(aadhaar: str) -> str:
    """Return masked Aadhaar: all but the last 4 digits replaced with X. The full number is never stored."""
    return "XXXX-XXXX-" + aadhaar[-4:]


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)  # SQLite returns naive datetimes


# ---------------------------------------------------------------------------
# Document-to-request linking
# ---------------------------------------------------------------------------

def _docs_for_request(db: Session, vr: VerificationRequest, kinds: set[str]) -> list[Document]:
    """Documents of `kinds` uploaded for this request (there is no FK column).

    A request owns the documents its subject uploaded after the previous request of the same type was decided and
    before the next request of that type was created. Documents from an earlier attempt are excluded.
    """
    siblings = db.scalars(
        select(VerificationRequest).where(
            VerificationRequest.subject_user_id == vr.subject_user_id,
            VerificationRequest.subject_type == vr.subject_type,
            VerificationRequest.id != vr.id,
        )
    ).all()
    mine = _aware(vr.created_at)
    lower = EPOCH
    upper = FAR_FUTURE
    for other in siblings:
        created = _aware(other.created_at)
        if created < mine:
            if other.reviewed_at is not None:
                lower = max(lower, _aware(other.reviewed_at))
        elif created > mine:
            upper = min(upper, created)
    rows = db.scalars(
        select(Document).where(
            Document.owner_id == vr.subject_user_id,
            Document.kind.in_(kinds),
            Document.deleted_at.is_(None),
        ).order_by(Document.id)
    ).all()
    return [d for d in rows if lower < _aware(d.created_at) < upper]


def _latest_request(db: Session, user_id: int, subject_type: str) -> VerificationRequest | None:
    return db.scalar(
        select(VerificationRequest)
        .where(VerificationRequest.subject_user_id == user_id, VerificationRequest.subject_type == subject_type)
        .order_by(VerificationRequest.created_at.desc(), VerificationRequest.id.desc())
    )


def _block_if_pending(db: Session, user_id: int, subject_type: str) -> None:
    latest = _latest_request(db, user_id, subject_type)
    if latest is not None and latest.status == "pending":
        raise AppError(409, "ALREADY_PENDING", "A verification request is already pending review")


# ---------------------------------------------------------------------------
# Provider: one combined request
# ---------------------------------------------------------------------------

def submit_provider(
    db: Session,
    provider_user_id: int,
    masked_pan: str | None,
    masked_aadhaar: str | None,
    fssai_number: str,
    entity_name: str,
) -> VerificationRequest:
    """Create (or resubmit after rejection) the provider's single combined verification request."""
    _block_if_pending(db, provider_user_id, "provider")
    vr = VerificationRequest(
        subject_user_id=provider_user_id,
        subject_type="provider",
        step=1,
        status="pending",
        masked_pan=masked_pan,
        masked_aadhaar=masked_aadhaar,
        fssai_number=fssai_number,
        entity_name=entity_name,
    )
    db.add(vr)
    db.flush()
    profile = db.get(ProviderProfile, provider_user_id)
    if profile is not None and profile.verification_status != "approved":
        profile.verification_status = "pending"
    return vr


def get_provider_status(db: Session, provider_user_id: int) -> dict:
    """The provider's latest request as {status, reason, entity_name, masked_pan, masked_aadhaar, fssai_number}.

    `status` is not_submitted, pending, approved or rejected. An account an admin approved directly (for example the
    seeded demo donor) has no request but an approved profile, and reads as approved.
    """
    vr = _latest_request(db, provider_user_id, "provider")
    if vr is None:
        profile = db.get(ProviderProfile, provider_user_id)
        approved = profile is not None and profile.verification_status == "approved"
        return {
            "status": "approved" if approved else "not_submitted",
            "reason": None,
            "entity_name": profile.org_name if approved and profile else None,
            "masked_pan": None,
            "masked_aadhaar": None,
            "fssai_number": None,
        }
    return {
        "status": vr.status,
        "reason": vr.reason,
        "entity_name": vr.entity_name,
        "masked_pan": vr.masked_pan,
        "masked_aadhaar": vr.masked_aadhaar,
        "fssai_number": vr.fssai_number,
    }


# ---------------------------------------------------------------------------
# NGO
# ---------------------------------------------------------------------------

def submit_ngo(
    db: Session,
    ngo_user_id: int,
    reg_number: str,
) -> VerificationRequest:
    """Create (or resubmit after rejection) an NGO verification request."""
    _block_if_pending(db, ngo_user_id, "ngo")

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


def get_ngo_status(db: Session, ngo_user_id: int) -> dict:
    """Return the NGO's latest verification request as {status, reason, reg_number, org_name}."""
    vr = _latest_request(db, ngo_user_id, "ngo")
    profile = db.get(NgoProfile, ngo_user_id)
    if vr is None:
        approved = profile is not None and profile.status == "approved"
        status = "approved" if approved else "not_submitted"
    else:
        status = vr.status
    return {
        "status": status,
        "reason": vr.reason if vr else None,
        "reg_number": vr.entity_name if vr else (profile.reg_number if profile else None),
        "org_name": profile.org_name if profile else None,
    }


# ---------------------------------------------------------------------------
# Admin: list
# ---------------------------------------------------------------------------

_KIND_LABEL = {
    "business_proof": "Business registration",
    "passport": "Passport",
    "fssai_cert": "FSSAI certificate",
    "ngo_reg": "NGO registration",
    "pan": "PAN",
    "aadhaar": "Aadhaar",
}


def list_verifications(
    db: Session,
    status: str | None,
    subject_type: str | None,
) -> list[dict]:
    """Return verification requests with subject info and their documents."""
    q = select(VerificationRequest)
    if status:
        q = q.where(VerificationRequest.status == status)
    if subject_type:
        q = q.where(VerificationRequest.subject_type == subject_type)
    q = q.order_by(VerificationRequest.created_at.desc(), VerificationRequest.id.desc())
    rows = db.scalars(q).all()

    result = []
    for vr in rows:
        kinds = _PROVIDER_KINDS if vr.subject_type == "provider" else _NGO_KINDS
        docs = _docs_for_request(db, vr, kinds)
        subject = db.get(User, vr.subject_user_id)
        profile = db.get(NgoProfile if vr.subject_type == "ngo" else ProviderProfile, vr.subject_user_id)
        result.append({
            "id": vr.id,
            "subject_user_id": vr.subject_user_id,
            "user_email": subject.email if subject else None,
            "user_name": subject.name if subject else None,
            "org_name": profile.org_name if profile else None,
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
            "documents": [{"id": d.id, "kind": d.kind, "label": _KIND_LABEL.get(d.kind, d.kind)} for d in docs],
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
    """Apply a verification decision. One transaction; updates the profile."""
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

    if vr.subject_type == "provider":
        _delete_identity_docs(db, vr.subject_user_id)  # data minimisation once decided
        _update_provider_status(db, vr.subject_user_id, decision)
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
    """Soft-delete passport (and any pan/aadhaar) documents after a decision."""
    from app.common.uploads import delete_document  # local import to avoid circular
    docs = db.scalars(
        select(Document).where(
            Document.owner_id == owner_id,
            Document.kind.in_(_SENSITIVE_KINDS),
            Document.deleted_at.is_(None),
        )
    ).all()
    for doc in docs:
        delete_document(db, doc)
    db.flush()


def _update_provider_status(db: Session, provider_user_id: int, decision: str) -> None:
    profile = db.get(ProviderProfile, provider_user_id)
    if profile:
        profile.verification_status = decision
        db.flush()


def _update_ngo_status(db: Session, ngo_user_id: int, decision: str) -> None:
    profile = db.get(NgoProfile, ngo_user_id)
    if profile:
        profile.status = decision
        db.flush()
