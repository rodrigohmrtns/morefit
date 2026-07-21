"""Common utilities (pure functions)."""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def today_iso() -> str:
    return now_utc().date().isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def extract_json(text: str) -> dict:
    """Best-effort JSON extraction from LLM text."""
    m = re.search(r"\{[\s\S]*\}", text or "")
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except Exception:
        return {}


def client_ip(request) -> str:  # type: ignore[no-untyped-def]
    """Best-effort client IP from headers (X-Forwarded-For -> Real-IP -> peer)."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.headers.get("x-real-ip") or (request.client.host if request.client else "unknown")
