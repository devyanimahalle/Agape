"""Verification router — provider endpoints (prefix /verification)
and admin endpoints (prefix /admin).

Role B: add these two lines to ROUTERS in app/main.py:
    from app.verification.router import router as verification_router, admin_router
    # Then in ROUTERS list:
    verification_router,   # Role C — prefix /verification
    admin_router,          # Role C — prefix /admin
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import require_role
from app.common.uploads import resolve_path, save_upload
from app.db.models import Document, ProviderProfile
from app.db.session import get_db
from app.errors import AppError
from app.verification import service
from app.verification.fssai import FssaiVerifier, get_fssai_verifier

router = APIRouter(prefix="/verification", tags=["verification"])
admin_router = APIRouter(prefix="/admin", tags=["admin-verification"])


# ---------------------------------------------------------------------------
# Provider Step 1
# ---------------------------------------------------------------------------

@router.post("/provider/step1", status_code=201)
def provider_step1(
    business_proof: UploadFile = File(...),
    pan_number: str | None = Form(None),
    aadhaar_number: str | None = Form(None),
    passport: UploadFile | None = File(None),
    entity_name: str = Form(...),
    user=Depends(require_role("provider")),
    db: Session = Depends(get_db),
):
    profile = db.get(ProviderProfile, user.id)
    if profile is None or profile.category == "general":
        raise AppError(403, "NOT_REQUIRED", "General providers do not require verification")

    # Validate and mask PAN / Aadhaar
    masked_pan: str | None = None
    masked_aadhaar: str | None = None

    if pan_number:
        service.validate_pan(pan_number)
        masked_pan = service.mask_pan(pan_number)
    if aadhaar_number:
        service.validate_aadhaar(aadhaar_number)
        masked_aadhaar = service.mask_aadhaar(aadhaar_number)

    # Must supply at least one ID: (pan+aadhaar) or passport
    has_pan_aadhaar = bool(pan_number and aadhaar_number)
    has_passport = passport is not None and passport.filename
    if not has_pan_aadhaar and not has_passport:
        raise AppError(
            422, "ID_REQUIRED",
            "Provide either PAN + Aadhaar number or a passport file"
        )

    # Create the verification request (blocks if already pending)
    vr = service.submit_provider_step1(db, user.id, masked_pan, masked_aadhaar, entity_name)

    # Save documents — business_proof always required
    save_upload(db, business_proof, user.id, "business_proof")

    if pan_number and aadhaar_number:
        # Store a placeholder pan doc; actual number is masked in the VR
        # We need a file — reuse business_proof for pan record is wrong;
        # for step1 the pan/aadhaar numbers are stored in the VR,
        # no separate document file is needed unless uploading actual scans.
        # If a separate pan/aadhaar scan upload is desired, it can be optional.
        pass

    if has_passport:
        save_upload(db, passport, user.id, "passport")

    db.commit()
    return {
        "id": vr.id,
        "step": 1,
        "status": vr.status,
        "masked_pan": vr.masked_pan,
        "masked_aadhaar": vr.masked_aadhaar,
    }


# ---------------------------------------------------------------------------
# Provider Step 2
# ---------------------------------------------------------------------------

@router.post("/provider/step2", status_code=201)
def provider_step2(
    fssai_cert: UploadFile = File(...),
    fssai_number: str = Form(...),
    entity_name: str = Form(...),
    user=Depends(require_role("provider")),
    db: Session = Depends(get_db),
    fssai_verifier: FssaiVerifier = Depends(get_fssai_verifier),
):
    profile = db.get(ProviderProfile, user.id)
    if profile is None or profile.category == "general":
        raise AppError(403, "NOT_REQUIRED", "General providers do not require verification")

    service.validate_fssai(fssai_number)
    fssai_verifier.verify(fssai_number)  # may raise AppError if external check fails

    vr = service.submit_provider_step2(db, user.id, fssai_number, entity_name)
    save_upload(db, fssai_cert, user.id, "fssai_cert")

    db.commit()
    return {
        "id": vr.id,
        "step": 2,
        "status": vr.status,
        "fssai_number": vr.fssai_number,
    }


# ---------------------------------------------------------------------------
# Provider status
# ---------------------------------------------------------------------------

@router.get("/provider/status")
def provider_status(
    user=Depends(require_role("provider")),
    db: Session = Depends(get_db),
):
    return service.get_provider_status(db, user.id)


# ---------------------------------------------------------------------------
# NGO
# ---------------------------------------------------------------------------

@router.post("/ngo", status_code=201)
def ngo_verification(
    ngo_reg: UploadFile = File(...),
    reg_number: str = Form(...),
    user=Depends(require_role("ngo")),
    db: Session = Depends(get_db),
):
    vr = service.submit_ngo(db, user.id, reg_number)
    save_upload(db, ngo_reg, user.id, "ngo_reg")
    db.commit()
    return {
        "id": vr.id,
        "step": 1,
        "status": vr.status,
        "reg_number": reg_number,
    }


@router.get("/ngo/status")
def ngo_status(
    user=Depends(require_role("ngo")),
    db: Session = Depends(get_db),
):
    return service.get_ngo_status(db, user.id)


# ---------------------------------------------------------------------------
# Admin: list verifications
# ---------------------------------------------------------------------------

@admin_router.get("/verifications")
def list_verifications(
    status: str | None = None,
    type: str | None = None,
    user=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    return service.list_verifications(db, status, type)


# ---------------------------------------------------------------------------
# Admin: decide
# ---------------------------------------------------------------------------

@admin_router.post("/verifications/{vr_id}/decision")
def make_decision(
    vr_id: int,
    decision: str = Form(...),
    reason: str | None = Form(None),
    user=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    if decision not in ("approved", "rejected"):
        raise AppError(422, "INVALID_DECISION", "Decision must be 'approved' or 'rejected'")
    return service.decide(db, vr_id, decision, reason, user.id)


# ---------------------------------------------------------------------------
# Admin: serve document
# ---------------------------------------------------------------------------

@admin_router.get("/documents/{doc_id}")
def serve_document(
    doc_id: int,
    user=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    doc = db.get(Document, doc_id)
    if doc is None or doc.deleted_at is not None:
        raise AppError(404, "DOCUMENT_NOT_FOUND", "Document not found or has been deleted")
    path = resolve_path(doc)
    return FileResponse(str(path))
