from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from urllib.parse import urlparse

from dotenv import load_dotenv


class ConfigurationError(RuntimeError):
    """Raised when a required runtime setting is missing or unsafe."""


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None or not value.strip():
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    oidc_discovery_url: str
    oidc_client_id: str
    oidc_client_secret: str
    oidc_redirect_uri: str
    session_secret: str
    app_base_url: str
    app_env: str
    oidc_debug_claims: bool
    oidc_audience: str | None = None
    admin_identity_claim: str = ""
    system_admin_ids: tuple[str, ...] = ()

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def secure_cookie(self) -> bool:
        return urlparse(self.app_base_url).scheme == "https"

    @property
    def cookie_path(self) -> str:
        return urlparse(self.app_base_url).path.rstrip("/") or "/"


@lru_cache
def get_settings() -> Settings:
    load_dotenv()

    required = {
        "OIDC_DISCOVERY_URL": os.getenv("OIDC_DISCOVERY_URL", "").strip(),
        "OIDC_CLIENT_ID": os.getenv("OIDC_CLIENT_ID", "").strip(),
        "OIDC_CLIENT_SECRET": os.getenv("OIDC_CLIENT_SECRET", "").strip(),
        "OIDC_REDIRECT_URI": os.getenv("OIDC_REDIRECT_URI", "").strip(),
        "SESSION_SECRET": os.getenv("SESSION_SECRET", "").strip(),
        "APP_BASE_URL": os.getenv("APP_BASE_URL", "").strip(),
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise ConfigurationError(f"缺少必要環境變數：{', '.join(missing)}")

    if len(required["SESSION_SECRET"]) < 32:
        raise ConfigurationError("SESSION_SECRET 至少需要 32 個字元。")

    app_env = os.getenv("APP_ENV", "development").strip().lower()
    settings = Settings(
        oidc_discovery_url=required["OIDC_DISCOVERY_URL"],
        oidc_client_id=required["OIDC_CLIENT_ID"],
        oidc_client_secret=required["OIDC_CLIENT_SECRET"],
        oidc_redirect_uri=required["OIDC_REDIRECT_URI"],
        session_secret=required["SESSION_SECRET"],
        app_base_url=required["APP_BASE_URL"].rstrip("/"),
        app_env=app_env,
        oidc_debug_claims=_as_bool(os.getenv("OIDC_DEBUG_CLAIMS")),
        admin_identity_claim=os.getenv("ADMIN_IDENTITY_CLAIM", "").strip(),
        system_admin_ids=tuple(v.strip() for v in os.getenv("SYSTEM_ADMIN_IDS", "").split(",") if v.strip()),
        oidc_audience=os.getenv("OIDC_AUDIENCE", "").strip() or None,
    )

    if settings.system_admin_ids and not settings.admin_identity_claim:
        raise ConfigurationError("SYSTEM_ADMIN_IDS requires ADMIN_IDENTITY_CLAIM")
    if settings.is_production and not settings.secure_cookie:
        raise ConfigurationError("production 的 APP_BASE_URL 必須使用 HTTPS，以啟用 Secure Cookie。")
    return settings
