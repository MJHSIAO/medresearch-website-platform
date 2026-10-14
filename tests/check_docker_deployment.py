"""Offline regression checks for the HTTPS /medresearch reverse-proxy mount.

Run from the project root: python tests/check_docker_deployment.py
Provider responses are mocked; this does not validate real hospital login.
"""
from __future__ import annotations

import os
from http.cookies import SimpleCookie
from unittest.mock import AsyncMock, patch

from authlib.integrations.base_client.errors import OAuthError
from fastapi.testclient import TestClient

os.environ.update({
    "OIDC_DISCOVERY_URL": "https://provider.example/.well-known/openid-configuration",
    "OIDC_CLIENT_ID": "docker-test-client",
    "OIDC_CLIENT_SECRET": "docker-test-secret",
    "OIDC_REDIRECT_URI": "https://aics.femh.org.tw/medresearch/auth/callback",
    "SESSION_SECRET": "docker-test-session-secret-at-least-32-characters",
    "APP_BASE_URL": "https://aics.femh.org.tw/medresearch",
    "APP_ENV": "production",
    "OIDC_DEBUG_CLAIMS": "false",
})

from backend.main import app, oidc, settings  # noqa: E402


async def mock_complete_login(request):
    return ({"id": "test-subject", "name": "測試", "role": "internal_user"}, {"sub": "test-subject"})


def main():
    assert settings.cookie_path == "/medresearch"
    with TestClient(app, base_url="https://aics.femh.org.tw", root_path="/medresearch", follow_redirects=False) as client:
        for path in ("/", "/ai-center/", "/admin-demo/", "/data/units.json", "/assets/js/main.js"):
            assert client.get(f"/medresearch{path}").status_code == 200, path
        assert client.get("/medresearch/healthz").json() == {"status": "ok"}
        anonymous = client.get("/medresearch/api/me")
        assert anonymous.json() == {"authenticated": False}
        assert anonymous.headers["cache-control"] == "no-store"
        for path in ("/.env", "/.env.docker", "/backend/config.py", "/.git/config", "/Dockerfile"):
            assert client.get(f"/medresearch{path}").status_code == 404, path
        for directory in ("ai-center", "admin-demo"):
            redirect = client.get(f"/medresearch/{directory}")
            assert redirect.status_code == 307
            assert redirect.headers["location"] == f"https://aics.femh.org.tw/medresearch/{directory}/"

        with patch.object(oidc, "complete_login", AsyncMock(side_effect=OAuthError(error="access_denied"))):
            failure = client.get("/medresearch/auth/callback?error=access_denied")
        assert failure.status_code == 400
        assert "location" not in failure.headers
        assert failure.headers["cache-control"] == "no-store"
        legacy = client.get("/medresearch/login.html")
        assert legacy.status_code == 303
        assert legacy.headers["location"] == "https://aics.femh.org.tw/medresearch/auth/login"
        assert legacy.headers["cache-control"] == "no-store"
        assert client.get("/medresearch/api/me").json() == {"authenticated": False}

        with patch.object(oidc, "complete_login", mock_complete_login):
            callback = client.get("/medresearch/auth/callback")
        assert callback.status_code == 303
        assert callback.headers["location"] == "https://aics.femh.org.tw/medresearch/"
        assert callback.headers["cache-control"] == "no-store"
        cookies = callback.headers.get_list("set-cookie")
        assert len(cookies) == 2
        parsed = SimpleCookie()
        for cookie in cookies:
            parsed.load(cookie)
        assert all(cookie["path"] == "/medresearch" and cookie["secure"] for cookie in parsed.values())
        assert parsed["medresearch_session"]["httponly"]
        assert client.get("/medresearch/api/me").json()["authenticated"] is True
        assert client.get("/medresearch/api/me").json()["user"]["claims"] == {}

        logout = client.get("/medresearch/auth/logout")
        assert logout.headers["location"] == "https://aics.femh.org.tw/medresearch/"
        deleted = SimpleCookie()
        for cookie in logout.headers.get_list("set-cookie"):
            deleted.load(cookie)
        assert all(cookie["path"] == "/medresearch" for cookie in deleted.values())
        assert client.get("/medresearch/api/me").json() == {"authenticated": False}
    print("PASS HTTPS subpath, static assets, redirects, cookie scope, mocked callback and logout")


if __name__ == "__main__":
    main()
