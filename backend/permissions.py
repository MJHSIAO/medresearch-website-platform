from __future__ import annotations

from typing import Any


VALID_ROLES = frozenset({"internal_user", "unit_admin", "site_admin", "system_admin"})


def initial_access_profile(claims: dict[str, Any]) -> dict[str, str | None]:
    """Return the deliberately conservative phase-one authorization profile.

    Authentication alone never grants administrative access. Department and unit
    mappings stay empty until the hospital confirms the real custom claim names
    and an approved server-side mapping.
    """

    return {
        "user_id": str(claims["sub"]),
        "department": None,
        "unit_id": None,
        "role": "internal_user",
    }


def resolved_role(claims: dict[str, Any], settings) -> str:
    """Match only an explicitly configured verified string claim."""
    value = claims.get(settings.admin_identity_claim) if settings.admin_identity_claim else None
    if isinstance(value, str) and value and value in settings.system_admin_ids:
        return "system_admin"
    return "internal_user"
