from __future__ import annotations

import json
import os
from base64 import b64encode
from urllib.parse import parse_qs, urlsplit
from unittest.mock import AsyncMock, patch

import httpx
from authlib.integrations.base_client.errors import OAuthError
from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner


os.environ["OIDC_DISCOVERY_URL"] = (
    "https://intraauth.femh.org.tw/INTRAAUTHSERVER/.well-known/openid-configuration"
)
os.environ["OIDC_CLIENT_ID"] = "integration-test-client"
os.environ["OIDC_CLIENT_SECRET"] = "integration-test-secret"
os.environ["OIDC_REDIRECT_URI"] = "http://localhost:8000/auth/callback"
os.environ["SESSION_SECRET"] = "integration-test-session-secret-at-least-32-characters"
os.environ["APP_BASE_URL"] = "http://localhost:8000"
os.environ["APP_ENV"] = "development"
os.environ["OIDC_DEBUG_CLAIMS"] = "false"

from backend.main import app, oidc, sessions, settings  # noqa: E402
from backend.auth import OIDCConfigurationError  # noqa: E402


def signed_session_cookie(session_id: str) -> str:
    payload = b64encode(json.dumps({"session_id": session_id}).encode("utf-8"))
    return TimestampSigner(settings.session_secret).sign(payload).decode("utf-8")


def main() -> None:
    with TestClient(app, follow_redirects=False) as client:
        home = client.get("/")
        assert home.status_code == 200
        assert "醫學研究部" in home.text

        anonymous = client.get("/api/me")
        assert anonymous.status_code == 200
        assert anonymous.json() == {"authenticated": False}
        assert anonymous.headers["cache-control"] == "no-store"

        assert client.get("/.env").status_code == 404
        assert client.get("/backend/config.py").status_code == 404
        assert client.get("/.git/config").status_code == 404

        for error in (
            OAuthError(error="invalid_scope", description="private-provider-detail"),
            OAuthError(error="access_denied", description="private-provider-detail"),
            OAuthError(error="mismatching_state"),
            httpx.ConnectError("private-provider-detail"),
            OIDCConfigurationError("private-provider-detail"),
        ):
            with patch.object(oidc, "complete_login", AsyncMock(side_effect=error)):
                failure = client.get("/auth/callback?code=private-code&error_description=private-detail")
            assert failure.status_code == 303
            assert failure.headers["location"] == "http://localhost:8000/login.html"
            assert failure.headers["cache-control"] == "no-store"
            assert "private" not in failure.text + failure.headers["location"]
            assert client.get("/api/me").json() == {"authenticated": False}

        with patch.object(oidc, "login", AsyncMock(side_effect=httpx.ConnectError("private-detail"))):
            assert client.get("/auth/login").headers["location"] == "http://localhost:8000/login.html"
        retry = client.get("/login.html")
        assert retry.status_code == 200
        assert "登入未完成" in retry.text and 'href="auth/login"' in retry.text
        assert "密碼錯誤" not in retry.text

        session_id = sessions.create(
            {
                "id": "test-subject",
                "name": "測試使用者",
                "email": None,
                "department": None,
                "unit_id": None,
                "role": "internal_user",
                "claim_names": ["sub"],
            },
            {"sub": "test-subject"},
        )
        client.cookies.set("medresearch_session", signed_session_cookie(session_id))
        authenticated = client.get("/api/me")
        assert authenticated.json()["authenticated"] is True
        assert authenticated.json()["user"]["role"] == "internal_user"
        assert authenticated.json()["user"]["claims"] == {}

        logout = client.get("/auth/logout")
        assert logout.status_code == 303
        assert sessions.get(session_id) is None

        if os.getenv("CHECK_OIDC_DISCOVERY") == "1":
            login = client.get("/auth/login")
            assert login.status_code in {302, 307}
            location = login.headers["location"]
            query = parse_qs(urlsplit(location).query)
            assert urlsplit(location).netloc == "intraauth.femh.org.tw"
            assert query["response_type"] == ["code"]
            assert set(query) == {"response_type", "client_id", "redirect_uri", "state"}
            assert query.get("state")
            assert "client_secret" not in query

    print("Backend checks passed")


if __name__ == "__main__":
    main()
