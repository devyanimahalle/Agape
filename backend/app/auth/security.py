"""Password hashing (bcrypt) and JWT helpers.

Role C: use hash_password() when seeding demo accounts so logins work.
"""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.auth import config
from app.errors import AppError


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:  # malformed hash
        return False


# Used so unknown-email logins cost the same as wrong-password logins.
DUMMY_HASH = hash_password("not-a-real-password")


def create_access_token(user_id: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise AppError(401, "TOKEN_EXPIRED", "Session expired, please log in again")
    except jwt.PyJWTError:
        raise AppError(401, "TOKEN_INVALID", "Invalid authentication token")
