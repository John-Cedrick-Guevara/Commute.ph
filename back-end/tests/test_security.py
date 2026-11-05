from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.security import RateLimiter

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
def test_writes_need_admin_key(method, path):
    assert anonymous.request(method, path, json={}).status_code == 401
    assert anonymous.request(method, path, json={}, headers={"X-Admin-Key": "wrong"}).status_code == 401


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
