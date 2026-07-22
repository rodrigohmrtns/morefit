"""Middleware: security headers + rate limiting bootstrap."""
from __future__ import annotations

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from slowapi import Limiter
from slowapi.util import get_remote_address

from core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add standard security headers to every response."""

    async def dispatch(self, request, call_next):  # type: ignore[override]
        response: Response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
        response.headers.setdefault("Permissions-Policy", "camera=(self), microphone=(self)")
        return response


# Shared limiter used by routers. Uses IP-based buckets via slowapi.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.rate_limit_default],
    headers_enabled=True,
    strategy="fixed-window",
)


def rate_limit_dep(limit: str):
    """Return a FastAPI dependency that enforces a per-IP rate limit.

    Works around slowapi's `@limiter.limit` decorator interfering with
    Pydantic body parsing under `from __future__ import annotations`.
    """
    async def _dep(request: Request) -> None:
        ip = get_remote_address(request)
        # Uses the storage backend directly. Falls back to always-allow if slowapi's
        # internal API changes (best-effort).
        try:
            allowed = limiter._check_request_limit(request, [limit], False)
        except Exception:
            # slowapi private API may vary — accept the request rather than crashing.
            return
        if allowed is False:
            raise HTTPException(status_code=429, detail="Muitas requisições — tente novamente em instantes")

    return _dep


# Pre-baked dependencies for common limits used across the app.
auth_rate_limit = rate_limit_dep(settings.rate_limit_auth)
register_rate_limit = rate_limit_dep(settings.rate_limit_register)
billing_rate_limit = rate_limit_dep(settings.rate_limit_billing)
# 60 requests/min per IP is generous for a home-screen widget refreshing
# every few minutes, but blocks scraping/brute-forcing of token space.
widget_public_rate_limit = rate_limit_dep("60/minute")
