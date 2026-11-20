"""Display names from verified OAuth claims; never used for authorization."""
import unicodedata


def display_name(value):
    if not isinstance(value, str):
        return ''
    value = value.strip()
    if not value or len(value) > 200 or any(unicodedata.category(c).startswith('C') for c in value):
        return ''
    return value


def oauth_display_name(claims, settings):
    """Only read the explicitly confirmed claim; do not guess from usernames."""
    if not settings.oidc_name_claim:
        return ''
    return display_name(claims.get(settings.oidc_name_claim))
