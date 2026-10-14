from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import httpx
from authlib.integrations.starlette_client import OAuth
from starlette.requests import Request
from starlette.responses import RedirectResponse

from .config import Settings
from .permissions import initial_access_profile


LOGGER = logging.getLogger(__name__)
REQUIRED_METADATA = {
    "authorization_endpoint",
    "token_endpoint",
    "userinfo_endpoint",
}
DEBUG_VALUE_CLAIMS = {
    "sub",
    "name",
    "preferred_username",
    "email",
    "employee_id",
    "employeeid",
    "department",
    "role",
    "roles",
    "group",
    "groups",
}


class OIDCConfigurationError(RuntimeError):
    """OAuth2 configuration error; keep the legacy name for compatibility."""

    SAFE_REASONS = frozenset({
        "discovery_invalid_json", "discovery_invalid_object", "discovery_missing_endpoints",
        "token_invalid_json", "token_missing_access_token", "userinfo_invalid_response",
        "userinfo_missing_sub",
    })

    def __init__(self, message: str, *, reason: str = "configuration_error") -> None:
        super().__init__(message)
        # Only fixed local codes may reach production logs, never response data.
        self.reason = reason if reason in self.SAFE_REASONS else "configuration_error"


class OIDCManager:
    """Hospital OAuth2 login using Discovery endpoints and verified state.

    Keep the existing class and environment names so deployments need no
    credential migration. Identity comes only from the protected UserInfo API.
    """
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.oauth = OAuth()
        self._client: Any | None = None
        self._metadata: dict[str, Any] | None = None
        self._lock = asyncio.Lock()

    async def _configure(self) -> Any:
        if self._client is not None:
            return self._client

        async with self._lock:
            if self._client is not None:
                return self._client

            async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as http:
                response = await http.get(self.settings.oidc_discovery_url)
                response.raise_for_status()
                try:
                    metadata = response.json()
                except ValueError as error:
                    raise OIDCConfigurationError("Discovery 回應不是有效 JSON。", reason="discovery_invalid_json") from error

            if not isinstance(metadata, dict):
                raise OIDCConfigurationError("Discovery 回應必須是 JSON 物件。", reason="discovery_invalid_object")

            missing = sorted(key for key in REQUIRED_METADATA if not metadata.get(key))
            if missing:
                raise OIDCConfigurationError(
                    f"OAuth2 Discovery 缺少必要欄位：{', '.join(missing)}",
                    reason="discovery_missing_endpoints",
                )

            self.oauth.register(
                name="femh",
                client_id=self.settings.oidc_client_id,
                client_secret=self.settings.oidc_client_secret,
                server_metadata_url=self.settings.oidc_discovery_url,
                # The hospital accepts response_type, client_id, redirect_uri
                # and state only. Advertising OIDC/PKCE does not enable them.
                client_kwargs={
                    "scope": None,
                    "code_challenge_method": None,
                    # Match the hospital integration's form-based token exchange.
                    "token_endpoint_auth_method": "client_secret_post",
                },
            )
            self._metadata = metadata
            self._client = self.oauth.create_client("femh")
            return self._client

    @property
    def metadata(self) -> dict[str, Any] | None:
        return self._metadata

    async def login(self, request: Request) -> RedirectResponse:
        client = await self._configure()
        # Authlib stores a fresh state for callback validation in the session.
        return await client.authorize_redirect(request, self.settings.oidc_redirect_uri)

    async def complete_login(self, request: Request) -> tuple[dict[str, Any], dict[str, Any]]:
        client = await self._configure()
        # Validate the single-use callback state before exchanging the code.
        # No openid scope/nonce is requested, so do not trust ID Token contents.
        try:
            token = await client.authorize_access_token(request)
        except ValueError as error:
            raise OIDCConfigurationError("Token 回應不是有效 JSON。", reason="token_invalid_json") from error
        if not token.get("access_token"):
            raise OIDCConfigurationError("登入結果缺少 Access Token。", reason="token_missing_access_token")
        try:
            userinfo = await client.userinfo(token=token)
        except (ValueError, TypeError) as error:
            raise OIDCConfigurationError("UserInfo 回應不是有效的身分資料。", reason="userinfo_invalid_response") from error
        claims = dict(userinfo)
        if not isinstance(claims.get("sub"), str) or not claims["sub"].strip():
            raise OIDCConfigurationError("UserInfo 缺少有效的 sub 身分識別。", reason="userinfo_missing_sub")

        profile = initial_access_profile(claims)
        user = {
            "id": profile["user_id"],
            "name": claims.get("name") or claims.get("preferred_username") or profile["user_id"],
            "email": claims.get("email"),
            "department": profile["department"],
            "unit_id": profile["unit_id"],
            "role": profile["role"],
            "claim_names": sorted(claims),
        }

        LOGGER.info("OAuth2 login succeeded; claim names=%s", ", ".join(sorted(claims)))
        if self.settings.oidc_debug_claims and not self.settings.is_production:
            debug_values = {key: claims.get(key) for key in sorted(DEBUG_VALUE_CLAIMS) if key in claims}
            LOGGER.info("OAuth2 development claim sample=%s", json.dumps(debug_values, ensure_ascii=False, default=str))

        return user, claims
