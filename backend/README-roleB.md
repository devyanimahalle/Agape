# Role B: Auth, Listings, Provider API

Run locally:  `pip install -r requirements.txt -r requirements-roleB.txt && pytest -q`
Run API:      `uvicorn app.main:app --reload`  (docs at /docs, health at /health)
Docker:       `docker build -t shareplate-backend backend`

Env vars: DATABASE_URL, JWT_SECRET (required when APP_ENV=production),
ACCESS_TOKEN_EXPIRE_MINUTES (1440), MEAL_KG (0.4), EXPIRY_INTERVAL_SECONDS (60),
EXPIRY_JOB_ENABLED (1).

Other roles import: app.auth.dependencies (get_current_user, require_role,
require_verified, require_verified_role) and app.errors.AppError.
