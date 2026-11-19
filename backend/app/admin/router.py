"""Admin API router — requires admin role for all endpoints."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

try:
    from app.db.session import get_db
except ImportError:
    try:
        from app.common.database import get_db
    except ImportError:
        from backend.app.common.database import get_db

try:
    from app.auth.dependencies import require_role
except ImportError:
    try:
        from app.common.deps import require_role
    except ImportError:
        from backend.app.common.deps import require_role

from . import schemas, service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=schemas.StatsResponse)
async def get_stats(
    db: Session = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    return service.get_stats(db)


@router.get("/users", response_model=list[schemas.UserOut])
async def list_users(
    db: Session = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    return service.get_users(db)


@router.patch("/users/{user_id}", response_model=schemas.UserOut)
async def patch_user(
    user_id: int,
    patch: schemas.UserPatch,
    db: Session = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    return service.patch_user(db, user_id, patch)


@router.get("/proofs", response_model=list[schemas.ProofOut])
async def list_proofs(
    review: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    return service.get_proofs(db, review_status=review)


@router.post("/proofs/{proof_id}/review", response_model=schemas.ProofOut)
async def review_proof(
    proof_id: int,
    body: schemas.ProofReviewRequest,
    db: Session = Depends(get_db),
    admin=Depends(require_role("admin")),
):
    return service.review_proof(db, proof_id, body, admin.id)
