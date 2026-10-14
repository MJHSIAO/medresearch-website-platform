"""Exercise Authlib's real OAuth2 flow against an offline mock provider.

Run: python -m tests.check_oauth_login
No hospital credentials, remote requests or real login are used.
"""
from __future__ import annotations

import os
from unittest.mock import patch
from urllib.parse import parse_qs, urlencode, urlsplit

import httpx
from fastapi.testclient import TestClient

os.environ.update({
    "OIDC_DISCOVERY_URL": "https://provider.example/discovery",
    "OIDC_CLIENT_ID": "oauth-test-client",
    "OIDC_CLIENT_SECRET": "oauth-test-secret",
    "OIDC_REDIRECT_URI": "https://site.example/medresearch/auth/callback",
    "SESSION_SECRET": "oauth-test-session-secret-at-least-32-characters",
    "APP_BASE_URL": "https://site.example/medresearch",
    "APP_ENV": "production",
    "OIDC_DEBUG_CLAIMS": "false",
})

from backend import main as backend  # noqa: E402
from backend.auth import OIDCManager  # noqa: E402

METADATA = {
    "authorization_endpoint": "https://provider.example/authorize",
    "token_endpoint": "https://provider.example/token",
    "userinfo_endpoint": "https://provider.example/userinfo",
    "scopes_supported": ["openid", "profile", "email"],
    "code_challenge_methods_supported": ["S256"],
}
BASE = "https://site.example/medresearch"


def check_flow(case: str) -> None:
    calls: list[str] = []

    async def provider_send(client, request, **kwargs):
        calls.append(request.url.path)
        if request.url.path == "/discovery":
            return httpx.Response(200, json=METADATA, request=request)
        if request.url.path == "/token":
            assert request.method == "POST"
            body = parse_qs(request.content.decode())
            assert body["grant_type"] == ["authorization_code"]
            assert body["code"] == ["test-code"]
            assert body["redirect_uri"] == [BASE + "/auth/callback"]
            assert "scope" not in body and "code_verifier" not in body
            assert body["client_id"] == ["oauth-test-client"]
            assert body["client_secret"] == ["oauth-test-secret"]
            assert "authorization" not in request.headers
            assert request.headers["content-type"].startswith("application/x-www-form-urlencoded")
            if case == "token_error":
                return httpx.Response(400, json={"error": "invalid_grant"}, request=request)
            if case == "token_non_json":
                return httpx.Response(200, text="not-json", request=request)
            return httpx.Response(200, json={
                "access_token": "test-access-token",
                "token_type": "Bearer",
                # Unverified token fields must never be an identity fallback.
                "id_token": "unverified-id-token",
                "userinfo": {"sub": "untrusted-sub", "role": "system_admin"},
            }, request=request)
        if request.url.path == "/userinfo":
            assert request.method == "GET"
            assert request.headers["authorization"] == "Bearer test-access-token"
            if case == "userinfo_error":
                return httpx.Response(401, json={"error": "invalid_token"}, request=request)
            if case == "userinfo_non_json":
                return httpx.Response(200, text="not-json", request=request)
            claims = {"sub": "test-subject", "name": "測試使用者", "role": "system_admin"}
            if case == "missing_subject":
                claims.pop("sub")
            return httpx.Response(200, json=claims, request=request)
        raise AssertionError(f"Unexpected remote request: {request.url}")

    manager = OIDCManager(backend.settings)
    # Intercept transport after httpx applies OAuth client/Bearer authentication.
    with patch.object(backend, "oidc", manager), patch.object(httpx.AsyncClient, "_send_single_request", provider_send):
        with TestClient(backend.app, base_url="https://site.example", root_path="/medresearch", follow_redirects=False) as client:
            login = client.get("/medresearch/auth/login")
            assert login.status_code == 302
            query = parse_qs(urlsplit(login.headers["location"]).query, keep_blank_values=True)
            assert set(query) == {"response_type", "client_id", "redirect_uri", "state"}
            assert query["response_type"] == ["code"]
            assert query["client_id"] == ["oauth-test-client"]
            assert query["redirect_uri"] == [BASE + "/auth/callback"]
            assert query["state"][0]
            params = {"code": "test-code", "state": query["state"][0]}
            if case == "missing_state":
                params.pop("state")
            elif case == "wrong_state":
                params["state"] = "wrong-state"
            elif case == "provider_error":
                params = {"error": "access_denied", "state": params["state"], "error_description": "private-description"}
            elif case == "missing_cookie":
                client.cookies.clear()

            callback_url = "/medresearch/auth/callback?" + urlencode(params)
            callback = client.get(callback_url)
            assert callback.headers["cache-control"] == "no-store"
            me = client.get("/medresearch/api/me").json()
            if case == "success":
                assert callback.status_code == 303
                assert callback.headers["location"] == BASE + "/"
                assert me["authenticated"] is True
                assert me["user"]["id"] == "test-subject"
                assert me["user"]["role"] == "internal_user"
                assert me["user"]["unit_id"] is None
                assert "test-access-token" not in str(me)
                token_count = calls.count("/token")
                replay = client.get(callback_url)
                assert replay.status_code == 400
                assert "location" not in replay.headers
                assert calls.count("/token") == token_count
            else:
                assert callback.status_code == 400
                assert "location" not in callback.headers
                assert me == {"authenticated": False}
                assert "private-description" not in callback.text
            if case in {"missing_state", "wrong_state", "missing_cookie", "provider_error"}:
                assert "/token" not in calls and "/userinfo" not in calls


def main() -> None:
    for case in (
        "success", "missing_state", "wrong_state", "missing_cookie", "provider_error",
        "token_error", "token_non_json", "userinfo_error", "userinfo_non_json", "missing_subject",
    ):
        check_flow(case)
    print("PASS OAuth2 four parameters, code/token/UserInfo flow, state rejection/replay and safe failures")


if __name__ == "__main__":
    main()
