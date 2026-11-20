"""Impact API router — public, no auth required."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

try:
    from app.db.session import get_db
except ImportError:
    try:
        from app.common.database import get_db
    except ImportError:
        from backend.app.common.database import get_db

from . import schemas, service

try:
    from app.auth.dependencies import get_current_user
except ImportError:  # pragma: no cover
    get_current_user = None

router = APIRouter(tags=["impact"])


@router.get("/impact", response_model=schemas.ImpactResponse)
async def get_impact(db: Session = Depends(get_db)):
    return service.get_impact(db)


@router.get("/impact/mine", response_model=schemas.MyImpactResponse)
async def get_my_impact(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """The signed-in donor's, NGO's or admin's own impact history (401 when signed out)."""
    return service.get_my_impact(db, user)
