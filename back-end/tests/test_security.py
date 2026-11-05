from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.security import RateLimiter
from tests.conftest import make_token

anonymous = TestClient(app)

NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000001"


def test_health():
    assert anonymous.get("/health").json() == {"status": "ok"}


@pytest.mark.parametrize("method, path", [
    ("post", "/v1/admin/routes"),
    ("put", f"/v1/admin/routes/{NON_EXISTENT_ID}"),
    ("delete", f"/v1/admin/routes/{NON_EXISTENT_ID}"),
    ("post", "/v1/admin/stops"),
    ("put", f"/v1/admin/stops/{NON_EXISTENT_ID}"),
    ("delete", f"/v1/admin/stops/{NON_EXISTENT_ID}"),
])
def test_writes_need_an_admin_login(method, path):
    def call(token=None):
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        return anonymous.request(method, path, json={}, headers=headers).status_code

    assert call() == 401
    assert call("not-a-jwt") == 401
    assert call(make_token(expires_in=-60)) == 401  # expired
    assert call(make_token(role=None)) == 403  # signed in, not an admin
    assert call(make_token(role="editor")) == 403
    assert call(make_token(aud="anon")) == 401


def test_token_signed_by_another_key_is_rejected():
    from cryptography.hazmat.primitives.asymmetric import ec
    import jwt as pyjwt
    forged = pyjwt.encode({"sub": "x", "aud": "authenticated", "app_metadata": {"role": "admin"}},
                          ec.generate_private_key(ec.SECP256R1()), algorithm="ES256")
    assert anonymous.post("/v1/admin/stops", json={}, headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_public_reads_need_no_key():
    assert anonymous.get("/v1/stops").status_code == 200


def test_cors_allows_the_web_app():
    response = anonymous.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    other = anonymous.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in other.headers


def test_rate_limiter_blocks_over_limit_per_ip():
    limiter = RateLimiter(limit=2)
    a, b = (SimpleNamespace(client=SimpleNamespace(host=ip)) for ip in ("1.1.1.1", "2.2.2.2"))

    limiter(a)
    limiter(a)
    with pytest.raises(HTTPException) as blocked:
        limiter(a)
    assert blocked.value.status_code == 429
    assert int(blocked.value.headers["Retry-After"]) > 0
    limiter(b)  # other clients are unaffected


def test_unreachable_signing_keys_is_503_not_expired(monkeypatch):
    import jwt as pyjwt
    from app import security

    def unreachable(token):
        raise pyjwt.PyJWKClientConnectionError("down")

    monkeypatch.setattr(security, "signing_key", unreachable)
    response = anonymous.get("/v1/admin/routes", headers={"Authorization": f"Bearer {make_token()}"})
    assert response.status_code == 503


def test_real_jwks_is_reachable():
    # Guards the CA bundle fix: the live Supabase key set must be fetchable over TLS
    from app import security
    assert security._jwks_client().get_signing_keys()
