"""Auth settings, read from environment variables."""
import os

_DEV_SECRET = "dev-only-change-me-dev-only-change-me"

APP_ENV = os.getenv("APP_ENV", "development")
JWT_SECRET = os.getenv("JWT_SECRET", _DEV_SECRET)
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24h


def assert_safe_config() -> None:
    """Refuse to start in production with the built-in dev secret."""
    if APP_ENV == "production" and JWT_SECRET == _DEV_SECRET:
        raise RuntimeError("JWT_SECRET must be set when APP_ENV=production")
