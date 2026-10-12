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
    "issuer",
    "authorization_endpoint",
    "token_endpoint",
    "jwks_uri",
}
PREFERRED_SCOPES = ("openid", "profile", "email")
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
    """Raised when the provider metadata cannot safely configure OIDC."""


class OIDCManager:
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
                metadata = response.json()

            missing = sorted(REQUIRED_METADATA.difference(metadata))
            if missing:
                raise OIDCConfigurationError(
                    f"OIDC Discovery 缺少必要欄位：{', '.join(missing)}"
                )

            advertised_scopes = metadata.get("scopes_supported")
            if isinstance(advertised_scopes, list):
                scopes = [scope for scope in PREFERRED_SCOPES if scope in advertised_scopes]
            else:
                scopes = list(PREFERRED_SCOPES)
            if "openid" not in scopes:
                raise OIDCConfigurationError("OIDC Provider 未宣告支援 openid scope。")

            client_kwargs: dict[str, Any] = {"scope": " ".join(scopes)}
            code_challenge_methods = metadata.get("code_challenge_methods_supported", [])
            if "S256" in code_challenge_methods:
                client_kwargs["code_challenge_method"] = "S256"

            self.oauth.register(
                name="femh",
                client_id=self.settings.oidc_client_id,
                client_secret=self.settings.oidc_client_secret,
                server_metadata_url=self.settings.oidc_discovery_url,
                client_kwargs=client_kwargs,
            )
            self._metadata = metadata
            self._client = self.oauth.create_client("femh")
            return self._client

    @property
    def metadata(self) -> dict[str, Any] | None:
        return self._metadata

    async def login(self, request: Request) -> RedirectResponse:
        client = await self._configure()
        # Authlib stores state, nonce, and the PKCE verifier in the signed session.
        return await client.authorize_redirect(request, self.settings.oidc_redirect_uri)

    async def complete_login(self, request: Request) -> tuple[dict[str, Any], dict[str, Any]]:
        client = await self._configure()
        # authorize_access_token validates callback state and, for OIDC, verifies
        # the ID Token signature/JWKS, issuer, audience, expiry, and nonce.
        token = await client.authorize_access_token(request)
        id_token_claims = dict(token.get("userinfo") or {})

        claims = id_token_claims
        if self._metadata and self._metadata.get("userinfo_endpoint"):
            userinfo = await client.userinfo(token=token)
            claims = {**id_token_claims, **dict(userinfo)}

        if not claims.get("sub"):
            raise OIDCConfigurationError("登入結果缺少 OIDC 必要的 sub claim。")

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

        LOGGER.info("OIDC login succeeded; claim names=%s", ", ".join(sorted(claims)))
        if self.settings.oidc_debug_claims and not self.settings.is_production:
            debug_values = {key: claims.get(key) for key in sorted(DEBUG_VALUE_CLAIMS) if key in claims}
            LOGGER.info("OIDC development claim sample=%s", json.dumps(debug_values, ensure_ascii=False, default=str))

        return user, claims
