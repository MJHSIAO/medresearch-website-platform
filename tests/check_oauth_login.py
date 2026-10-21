"""Exercise Authlib's real OAuth2 flow against an offline mock provider.

Run: python -m tests.check_oauth_login
No hospital credentials, remote requests or real login are used.
"""
from __future__ import annotations

import os
import time
from dataclasses import replace
from unittest import TestCase
from unittest.mock import patch
from urllib.parse import parse_qs, urlencode, urlsplit

import httpx
from authlib.jose import JsonWebKey, JsonWebToken
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
    "OIDC_AUDIENCE": "",
})

from backend import main as backend  # noqa: E402
from backend.auth import OIDCConfigurationError, OIDCManager  # noqa: E402

METADATA = {
    "authorization_endpoint": "https://provider.example/authorize",
    "token_endpoint": "https://provider.example/token",
    "userinfo_endpoint": "https://provider.example/userinfo",
    "scopes_supported": ["openid", "profile", "email"],
    "code_challenge_methods_supported": ["S256"],
}
BASE = "https://site.example/medresearch"
SIGNING_KEY = JsonWebKey.generate_key("RSA", 2048, is_private=True, options={"kid": "test-key"})
OTHER_KEY = JsonWebKey.generate_key("RSA", 2048, is_private=True, options={"kid": "test-key"})


def check_flow(case: str, jwt_mode: bool = False) -> None:
    calls: list[str] = []
    metadata = dict(METADATA)
    access_token = "test-access-token"
    if jwt_mode:
        metadata.pop("userinfo_endpoint")  # JWT flow must not need UserInfo.
        metadata.update(issuer="https://provider.example", jwks_uri="https://provider.example/keys")
        now = int(time.time())
        payload = {"iss": metadata["issuer"], "aud": "test-audience", "sub": "test-subject",
                   "iat": now - 5, "exp": now + 300, "role": "system_admin"}
        if case == "aud_list":
            payload["aud"] = ["another-audience", "test-audience"]
        elif case == "wrong_aud":
            payload["aud"] = "other-audience"
        elif case == "wrong_issuer":
            payload["iss"] = "https://wrong.example"
        elif case == "expired":
            payload["exp"] = now - 60
        elif case == "future_nbf":
            payload["nbf"] = now + 300
        elif case == "future_iat":
            payload["iat"] = now + 300
        elif case in {"missing_exp", "missing_iat", "missing_aud", "missing_iss"}:
            payload.pop(case.removeprefix("missing_"))
        elif case == "missing_subject":
            payload.pop("sub")
        elif case == "blank_subject":
            payload["sub"] = " "
        key = OTHER_KEY if case == "bad_signature" else SIGNING_KEY
        if case == "unknown_kid":
            key = {**SIGNING_KEY.as_dict(is_private=True), "kid": "unknown"}
        header = {"alg": "RS256", "kid": "unknown" if case == "unknown_kid" else "test-key"}
        access_token = JsonWebToken(["RS256"]).encode(header, payload, key).decode()
        if case == "wrong_algorithm":
            access_token = JsonWebToken(["HS256"]).encode({"alg": "HS256"}, payload, b"test-only-hmac-key").decode()
        elif case == "opaque_token":
            access_token = "not-a-jwt"

    async def provider_send(client, request, **kwargs):
        calls.append(request.url.path)
        if request.url.path == "/discovery":
            return httpx.Response(200, json=metadata, request=request)
        if request.url.path == "/keys":
            assert "authorization" not in request.headers
            if case == "jwks_error":
                return httpx.Response(503, text="private-response-body", request=request)
            if case == "jwks_non_json":
                return httpx.Response(200, text="private-response-body", request=request)
            return httpx.Response(200, json={"keys": [SIGNING_KEY.as_dict(is_private=False)]}, request=request)
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
                return httpx.Response(200, text="private-response-body", request=request)
            if case == "missing_access_token":
                return httpx.Response(200, json={"token_type": "Bearer"}, request=request)
            return httpx.Response(200, json={
                "access_token": access_token,
                "token_type": "Bearer",
                # Unverified token fields must never be an identity fallback.
                "id_token": "unverified-id-token",
                "userinfo": {"sub": "untrusted-sub", "role": "system_admin"},
            }, request=request)
        if request.url.path == "/userinfo":
            assert not jwt_mode
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

    manager = OIDCManager(replace(backend.settings, oidc_audience="test-audience" if jwt_mode else None))
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
            expected_reasons = {
                "token_non_json": "token_invalid_json",
                "missing_access_token": "token_missing_access_token",
                "userinfo_non_json": "userinfo_invalid_response",
                "missing_subject": "userinfo_missing_sub",
            }
            if jwt_mode:
                expected_reasons["missing_subject"] = "access_token_missing_sub"
                expected_reasons["blank_subject"] = "access_token_missing_sub"
                expected_reasons["jwks_error"] = "jwks_unavailable"
                expected_reasons["jwks_non_json"] = "jwks_invalid_response"
                expected_reasons.update({
                    "wrong_aud": "jwt_invalid_aud", "wrong_issuer": "jwt_invalid_iss",
                    "expired": "jwt_expired", "future_nbf": "jwt_not_yet_valid",
                    "future_iat": "jwt_not_yet_valid", "missing_exp": "jwt_missing_exp",
                    "missing_iat": "jwt_missing_iat", "missing_aud": "jwt_missing_aud",
                    "missing_iss": "jwt_missing_iss", "bad_signature": "jwt_bad_signature",
                    "unknown_kid": "jwt_signing_key_not_found", "wrong_algorithm": "jwt_unsupported_algorithm",
                    "opaque_token": "jwt_invalid_format",
                })
            if case in expected_reasons:
                with TestCase().assertLogs("backend.main", level="WARNING") as captured:
                    callback = client.get(callback_url)
                log = "\n".join(captured.output)
                assert f"OIDCConfigurationError reason={expected_reasons[case]}" in log, (case, log)
                for private in ("private-response-body", "oauth-test-secret", "test-code", "test-access-token", "test-subject", access_token, "other-audience", "https://wrong.example"):
                    assert private not in log
            else:
                callback = client.get(callback_url)
            assert callback.headers["cache-control"] == "no-store"
            me = client.get("/medresearch/api/me").json()
            if case in {"success", "aud_list"}:
                assert callback.status_code == 303
                assert callback.headers["location"] == BASE + "/internal"
                assert me["authenticated"] is True
                assert me["user"]["id"] == "test-subject"
                assert me["user"]["role"] == "internal_user"
                assert me["user"]["unit_id"] is None
                assert "test-access-token" not in str(me)
                assert access_token not in str(me)
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
                assert "/keys" not in calls
            if jwt_mode:
                assert "/userinfo" not in calls


def main() -> None:
    assert OIDCConfigurationError("private", reason="private").reason == "configuration_error"
    for case in (
        "success", "missing_state", "wrong_state", "missing_cookie", "provider_error",
        "token_error", "token_non_json", "missing_access_token", "userinfo_error", "userinfo_non_json", "missing_subject",
    ):
        check_flow(case)
    for case in (
        "success", "aud_list", "wrong_aud", "wrong_issuer", "expired", "future_nbf", "future_iat",
        "missing_exp", "missing_iat", "missing_aud", "missing_iss", "bad_signature", "unknown_kid",
        "wrong_algorithm", "opaque_token", "missing_subject", "blank_subject", "jwks_error", "jwks_non_json",
        "missing_state", "wrong_state", "missing_cookie", "provider_error",
    ):
        check_flow(case, jwt_mode=True)
    print("PASS RS256 access token, issuer/audience/time/sub checks, JWKS failures; no UserInfo fallback")
    print("PASS OAuth2 four parameters, code/token/UserInfo flow, state rejection/replay and safe failures")


if __name__ == "__main__":
    main()
