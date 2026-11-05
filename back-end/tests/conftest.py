import os

import time

import jwt
from cryptography.hazmat.primitives.asymmetric import ec

# Set before the app is imported: a rate limit the suite never hits
os.environ.setdefault("PUBLIC_RATE_LIMIT_PER_MINUTE", "100000")

from app import security  # noqa: E402

# Admin tokens are signed with a throwaway key instead of Supabase's; the app verifies them
# exactly like real ones, only the public key lookup is swapped
TEST_KEY = ec.generate_private_key(ec.SECP256R1())
security.signing_key = lambda token: TEST_KEY.public_key()


def make_token(role="admin", expires_in=3600, **claims):
    """A Supabase-style access token signed with the test key."""
    payload = {
        "sub": "00000000-0000-0000-0000-00000000ad01", "email": "admin@test.local", "aud": "authenticated",
        "exp": int(time.time()) + expires_in, "app_metadata": {"role": role} if role else {}, **claims,
    }
    return jwt.encode(payload, TEST_KEY, algorithm="ES256")


ADMIN_HEADERS = {"Authorization": f"Bearer {make_token()}"}

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.db.database import get_db
from app.main import app


@pytest.fixture
def client():
    mock_db = MagicMock()

    def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()