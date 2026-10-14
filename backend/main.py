from __future__ import annotations

import logging
import secrets
import time
from pathlib import Path
from typing import Any

import httpx
from authlib.integrations.base_client.errors import OAuthError
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from .auth import OIDCConfigurationError, OIDCManager
from .config import get_settings


LOGGER = logging.getLogger(__name__)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_HTML_FILES = frozenset(path.name for path in PROJECT_ROOT.glob("*.html"))
SESSION_TTL_SECONDS = 8 * 60 * 60


class InMemorySessionStore:
    """Minimal single-process store; replace before multi-worker production use."""

    def __init__(self) -> None:
        self._sessions: dict[str, dict[str, Any]] = {}

    def create(self, user: dict[str, Any], claims: dict[str, Any]) -> str:
        now = int(time.time())
        self._delete_expired(now)
        session_id = secrets.token_urlsafe(32)
        self._sessions[session_id] = {
            "user": user,
            "claims": claims,
            "expires_at": now + SESSION_TTL_SECONDS,
        }
        return session_id

    def get(self, session_id: str | None) -> dict[str, Any] | None:
        if not session_id:
            return None
        record = self._sessions.get(session_id)
        if not record:
            return None
        if record["expires_at"] <= int(time.time()):
            self._sessions.pop(session_id, None)
            return None
        return record

    def delete(self, session_id: str | None) -> None:
        if session_id:
            self._sessions.pop(session_id, None)

    def _delete_expired(self, now: int) -> None:
        expired = [key for key, value in self._sessions.items() if value["expires_at"] <= now]
        for key in expired:
            self._sessions.pop(key, None)


settings = get_settings()
oidc = OIDCManager(settings)
sessions = InMemorySessionStore()
app = FastAPI(title="醫學研究部網站 OAuth2 Backend", docs_url=None, redoc_url=None)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    session_cookie="medresearch_session",
    max_age=SESSION_TTL_SECONDS,
    same_site="lax",
    https_only=settings.secure_cookie,
    path=settings.cookie_path,
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    path = request.url.path
    root_path = request.scope.get("root_path", "").rstrip("/")
    if root_path and path.startswith(f"{root_path}/"):
        path = path[len(root_path):]
    if path.startswith(("/api/", "/auth/")):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/auth/login", include_in_schema=False)
async def auth_login(request: Request):
    try:
        return await oidc.login(request)
    except (httpx.HTTPError, OIDCConfigurationError) as error:
        LOGGER.error("Unable to start OAuth2 login: %s", type(error).__name__)
        return RedirectResponse(url=f"{settings.app_base_url}/login.html", status_code=303)


@app.get("/auth/callback", include_in_schema=False)
async def auth_callback(request: Request):
    try:
        user, claims = await oidc.complete_login(request)
    except (OAuthError, httpx.HTTPError, OIDCConfigurationError) as error:
        # Log only known error codes; provider descriptions can contain secrets.
        known_errors = {
            "access_denied", "invalid_scope", "invalid_client", "invalid_grant",
            "invalid_request", "unauthorized_client", "unsupported_grant_type",
            "mismatching_state", "server_error", "temporarily_unavailable",
        }
        error_code = getattr(error, "error", None)
        category = error_code if isinstance(error_code, str) and error_code in known_errors else type(error).__name__
        LOGGER.warning("OAuth2 callback rejected: %s", category)
        return RedirectResponse(url=f"{settings.app_base_url}/login.html", status_code=303)

    request.session.clear()
    request.session["session_id"] = sessions.create(user, claims)
    response = RedirectResponse(url=f"{settings.app_base_url}/", status_code=303)
    # Non-sensitive UI hint only. Authorization always uses the HttpOnly session.
    response.set_cookie(
        "medresearch_auth",
        "1",
        max_age=SESSION_TTL_SECONDS,
        secure=settings.secure_cookie,
        httponly=False,
        samesite="lax",
        path=settings.cookie_path,
    )
    return response


@app.get("/api/me")
async def api_me(request: Request):
    record = sessions.get(request.session.get("session_id"))
    if not record:
        return JSONResponse({"authenticated": False})

    user = dict(record["user"])
    user["claims"] = (
        record["claims"]
        if settings.oidc_debug_claims and not settings.is_production
        else {}
    )
    return JSONResponse({"authenticated": True, "user": user})


@app.get("/auth/logout", include_in_schema=False)
async def auth_logout(request: Request):
    sessions.delete(request.session.get("session_id"))
    request.session.clear()
    # Provider logout can be added later when end_session_endpoint is advertised.
    response = RedirectResponse(url=f"{settings.app_base_url}/", status_code=303)
    response.delete_cookie(
        "medresearch_auth", path=settings.cookie_path,
        secure=settings.secure_cookie, samesite="lax",
    )
    return response


@app.get("/healthz", include_in_schema=False)
async def healthz():
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
async def website_home():
    return FileResponse(PROJECT_ROOT / "index.html")


@app.get("/{page_name}.html", include_in_schema=False)
async def website_page(page_name: str):
    filename = f"{page_name}.html"
    if filename not in PUBLIC_HTML_FILES:
        raise HTTPException(status_code=404)
    return FileResponse(PROJECT_ROOT / filename)


# Mount only known public directories. Never mount PROJECT_ROOT: doing so could
# expose .env, .git, backend source, or other non-public files.
app.mount("/assets", StaticFiles(directory=PROJECT_ROOT / "assets"), name="assets")
app.mount("/data", StaticFiles(directory=PROJECT_ROOT / "data"), name="data")
app.mount("/admin-demo", StaticFiles(directory=PROJECT_ROOT / "admin-demo", html=True), name="admin-demo")
app.mount("/ai-center", StaticFiles(directory=PROJECT_ROOT / "ai-center", html=True), name="ai-center")
