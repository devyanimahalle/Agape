"""Impact API router — public, no auth required."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.common.database import get_db
from backend.app.impact import schemas, service

router = APIRouter(tags=["impact"])


@router.get("/impact", response_model=schemas.ImpactResponse)
async def get_impact(db: Session = Depends(get_db)):
    return service.get_impact(db)
