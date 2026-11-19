from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_profile
from app.auth.schemas import LoginIn, RegisterIn
from app.auth.security import (
    DUMMY_HASH,
    create_access_token,
    hash_password,
    verify_password,
)
from app.db.models import NgoProfile, ProviderProfile, User
from app.db.session import get_db
from app.errors import AppError

router = APIRouter(prefix="/auth", tags=["auth"])

LANDING = {"provider": "/provider", "ngo": "/ngo", "admin": "/admin"}


def _user_out(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "name": user.name,
        "phone": user.phone,
    }


def _profile_out(profile) -> dict | None:
    if profile is None:
        return None
    return {c.name: getattr(profile, c.name) for c in profile.__table__.columns}


def _verification_status(profile, role: str) -> str | None:
    if profile is None:
        return None
    return profile.verification_status if role == "provider" else profile.status


@router.post("/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if body.role == "admin":
        raise AppError(403, "ROLE_NOT_ALLOWED", "Admin accounts cannot be self-registered")

    if db.scalar(select(User.id).where(User.email == body.email)):
        raise AppError(409, "EMAIL_EXISTS", "An account with this email already exists")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
        name=body.name,
        phone=body.phone,
        is_active=True,
    )
    db.add(user)
    try:
        db.flush()  # assigns user.id; raises on unique-email race
        if body.role == "provider":
            # general providers need no verification (contract rule 1)
            status = "approved" if body.category == "general" else "pending"
            db.add(
                ProviderProfile(
                    user_id=user.id,
                    category=body.category,
                    org_name=body.org_name,
                    address=body.address,
                    lat=body.lat,
                    lng=body.lng,
                    verification_status=status,
                    rating_count=0,
                )
            )
        else:
            db.add(
                NgoProfile(
                    user_id=user.id,
                    org_name=body.org_name,
                    reg_number=body.reg_number,
                    address=body.address,
                    lat=body.lat,
                    lng=body.lng,
                    status="pending",
                    rating_count=0,
                )
            )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(409, "EMAIL_EXISTS", "An account with this email already exists")

    return {
        "user": _user_out(user),
        "access_token": create_access_token(user.id, user.role),
    }


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email))
    # Always run a hash check so response time doesn't reveal whether the email exists.
    ok = verify_password(body.password, user.password_hash if user else DUMMY_HASH)
    if user is None or not ok:
        raise AppError(401, "INVALID_CREDENTIALS", "Incorrect email or password")
    if not user.is_active:
        raise AppError(403, "ACCOUNT_DISABLED", "This account has been disabled")
    return {
        "access_token": create_access_token(user.id, user.role),
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "role": user.role, "name": user.name},
        "landing": LANDING[user.role],
    }


@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = get_profile(db, user)
    return {
        "user": _user_out(user),
        "profile": _profile_out(profile),
        "verification_status": _verification_status(profile, user.role),
    }
