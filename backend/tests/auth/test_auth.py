from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import APIRouter, Depends

from app.auth import config
from app.auth.dependencies import require_role, require_verified, require_verified_role
from app.auth.security import hash_password, verify_password
from app.db.models import NgoProfile, ProviderProfile, User
from tests.conftest import auth_header

API = "/api/v1"


def register(client, payload):
    return client.post(f"{API}/auth/register", json=payload)


# ------------------------------------------------------------------ register
def test_register_provider_restaurant_starts_pending(client, provider_payload):
    r = register(client, provider_payload)
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["role"] == "provider"
    assert body["access_token"]
    me = client.get(f"{API}/auth/me", headers=auth_header(body["access_token"])).json()
    assert me["verification_status"] == "pending"
    assert me["profile"]["category"] == "restaurant"


def test_register_general_provider_is_approved(client, provider_payload):
    provider_payload["category"] = "general"
    token = register(client, provider_payload).json()["access_token"]
    me = client.get(f"{API}/auth/me", headers=auth_header(token)).json()
    assert me["verification_status"] == "approved"


def test_register_ngo_starts_pending(client, ngo_payload):
    token = register(client, ngo_payload).json()["access_token"]
    me = client.get(f"{API}/auth/me", headers=auth_header(token)).json()
    assert me["verification_status"] == "pending"
    assert me["profile"]["reg_number"] == "KA/2020/123"


def test_register_admin_is_forbidden(client, provider_payload):
    provider_payload["role"] = "admin"
    r = register(client, provider_payload)
    assert r.status_code == 403
    assert r.json()["code"] == "ROLE_NOT_ALLOWED"


def test_register_duplicate_email_case_insensitive(client, provider_payload):
    assert register(client, provider_payload).status_code == 201
    provider_payload["email"] = provider_payload["email"].upper()
    r = register(client, provider_payload)
    assert r.status_code == 409
    assert r.json() == {
        "detail": "An account with this email already exists",
        "code": "EMAIL_EXISTS",
    }


@pytest.mark.parametrize(
    "mutation",
    [
        {"password": "short"},
        {"email": "not-an-email"},
        {"phone": "abc"},
        {"role": "superuser"},
        {"lat": 123},
        {"category": "bakery"},
    ],
)
def test_register_validation_errors_use_contract_shape(client, provider_payload, mutation):
    provider_payload.update(mutation)
    r = register(client, provider_payload)
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"
    assert isinstance(r.json()["detail"], str)


def test_register_provider_missing_org_name(client, provider_payload):
    del provider_payload["org_name"]
    r = register(client, provider_payload)
    assert r.status_code == 422
    assert "org_name" in r.json()["detail"]


def test_register_ngo_missing_reg_number(client, ngo_payload):
    del ngo_payload["reg_number"]
    r = register(client, ngo_payload)
    assert r.status_code == 422
    assert "reg_number" in r.json()["detail"]


# --------------------------------------------------------------------- login
@pytest.mark.parametrize(
    "fixture_name,landing",
    [("provider_payload", "/provider"), ("ngo_payload", "/ngo")],
)
def test_login_returns_landing(client, request, fixture_name, landing):
    payload = request.getfixturevalue(fixture_name)
    register(client, payload)
    r = client.post(
        f"{API}/auth/login", json={"email": payload["email"], "password": payload["password"]}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["landing"] == landing
    assert set(body["user"]) == {"id", "email", "role", "name"}


def test_login_admin_landing(client, db):
    db.add(
        User(
            email="admin@shareplate.demo",
            password_hash=hash_password("Admin@123"),
            role="admin",
            name="Admin",
            is_active=True,
        )
    )
    db.commit()
    r = client.post(
        f"{API}/auth/login", json={"email": "Admin@SharePlate.demo", "password": "Admin@123"}
    )
    assert r.status_code == 200
    assert r.json()["landing"] == "/admin"


def test_login_wrong_password(client, provider_payload):
    register(client, provider_payload)
    r = client.post(f"{API}/auth/login", json={"email": provider_payload["email"], "password": "nope"})
    assert r.status_code == 401
    assert r.json()["code"] == "INVALID_CREDENTIALS"


def test_login_unknown_email_same_error(client):
    r = client.post(f"{API}/auth/login", json={"email": "ghost@example.com", "password": "whatever1"})
    assert r.status_code == 401
    assert r.json()["code"] == "INVALID_CREDENTIALS"


def test_login_disabled_account(client, db, provider_payload):
    register(client, provider_payload)
    user = db.query(User).filter_by(email=provider_payload["email"]).one()
    user.is_active = False
    db.commit()
    r = client.post(
        f"{API}/auth/login",
        json={"email": provider_payload["email"], "password": provider_payload["password"]},
    )
    assert r.status_code == 403
    assert r.json()["code"] == "ACCOUNT_DISABLED"


# ---------------------------------------------------------------------- /me
def test_me_requires_token(client):
    r = client.get(f"{API}/auth/me")
    assert r.status_code == 401
    assert r.json()["code"] == "NOT_AUTHENTICATED"


def test_me_rejects_garbage_token(client):
    r = client.get(f"{API}/auth/me", headers=auth_header("garbage"))
    assert r.status_code == 401
    assert r.json()["code"] == "TOKEN_INVALID"


def test_me_rejects_expired_token(client, provider_payload):
    uid = register(client, provider_payload).json()["user"]["id"]
    expired = jwt.encode(
        {"sub": str(uid), "role": "provider", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        config.JWT_SECRET,
        algorithm=config.JWT_ALGORITHM,
    )
    r = client.get(f"{API}/auth/me", headers=auth_header(expired))
    assert r.status_code == 401
    assert r.json()["code"] == "TOKEN_EXPIRED"


def test_me_rejects_token_signed_with_other_secret(client, provider_payload):
    uid = register(client, provider_payload).json()["user"]["id"]
    forged = jwt.encode({"sub": str(uid)}, "some-other-secret-some-other-secret", algorithm="HS256")
    assert client.get(f"{API}/auth/me", headers=auth_header(forged)).status_code == 401


def test_me_blocks_user_disabled_after_login(client, db, provider_payload):
    token = register(client, provider_payload).json()["access_token"]
    user = db.query(User).filter_by(email=provider_payload["email"]).one()
    user.is_active = False
    db.commit()
    r = client.get(f"{API}/auth/me", headers=auth_header(token))
    assert r.status_code == 403
    assert r.json()["code"] == "ACCOUNT_DISABLED"


# ------------------------------------------------------------------ helpers
def test_password_hash_roundtrip():
    h = hash_password("Secret123")
    assert h != "Secret123"
    assert verify_password("Secret123", h)
    assert not verify_password("secret123", h)
    assert not verify_password("x", "not-a-hash")


# ------------------------------------------- require_role / require_verified
@pytest.fixture()
def guarded(app):
    r = APIRouter()

    @r.get("/_t/admin")
    def admin_only(user=Depends(require_role("admin"))):
        return {"id": user.id}

    @r.get("/_t/verified")
    def verified(user=Depends(require_verified)):
        return {"id": user.id}

    @r.get("/_t/verified-ngo")
    def verified_ngo(user=Depends(require_verified_role("ngo"))):
        return {"id": user.id}

    app.include_router(r)
    return app


def _token(client, payload):
    return register(client, payload).json()["access_token"]


def test_require_role_forbidden(guarded, client, provider_payload):
    token = _token(client, provider_payload)
    r = client.get("/_t/admin", headers=auth_header(token))
    assert r.status_code == 403
    assert r.json()["code"] == "FORBIDDEN"


def test_require_role_unauthenticated(guarded, client):
    assert client.get("/_t/admin").status_code == 401


def test_require_verified_blocks_pending_ngo(guarded, client, ngo_payload):
    token = _token(client, ngo_payload)
    r = client.get("/_t/verified", headers=auth_header(token))
    assert r.status_code == 403
    assert r.json()["code"] == "NOT_VERIFIED"


def test_require_verified_allows_approved_ngo(guarded, client, db, ngo_payload):
    token = _token(client, ngo_payload)
    db.query(NgoProfile).update({"status": "approved"})
    db.commit()
    assert client.get("/_t/verified", headers=auth_header(token)).status_code == 200


def test_require_verified_blocks_pending_restaurant(guarded, client, provider_payload):
    token = _token(client, provider_payload)
    r = client.get("/_t/verified", headers=auth_header(token))
    assert r.status_code == 403
    assert r.json()["code"] == "NOT_VERIFIED"


def test_require_verified_allows_approved_restaurant(guarded, client, db, provider_payload):
    token = _token(client, provider_payload)
    db.query(ProviderProfile).update({"verification_status": "approved"})
    db.commit()
    assert client.get("/_t/verified", headers=auth_header(token)).status_code == 200


def test_require_verified_allows_general_even_if_status_not_approved(
    guarded, client, db, provider_payload
):
    provider_payload["category"] = "general"
    token = _token(client, provider_payload)
    db.query(ProviderProfile).update({"verification_status": "pending"})
    db.commit()
    assert client.get("/_t/verified", headers=auth_header(token)).status_code == 200


def test_require_verified_role_wrong_role_is_forbidden_not_unverified(
    guarded, client, provider_payload
):
    token = _token(client, provider_payload)
    r = client.get("/_t/verified-ngo", headers=auth_header(token))
    assert r.status_code == 403
    assert r.json()["code"] == "FORBIDDEN"


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
