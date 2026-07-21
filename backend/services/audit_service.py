"""Audit service — thin domain layer on top of AuditRepository."""
from __future__ import annotations

from typing import Optional

from fastapi import Request

from core.utils import client_ip
from repositories.audit_repo import audit_repo


class AuditService:
    """Application service to record audit events.

    Consumers should call `AuditService.log_event(...)` — the service enriches
    the record with request context (IP, user-agent) when a Request is provided.
    """

    async def log_event(
        self,
        *,
        event_type: str,
        user: Optional[dict] = None,
        request: Optional[Request] = None,
        metadata: Optional[dict] = None,
        severity: str = "info",
    ) -> dict:
        ip = client_ip(request) if request else None
        ua = request.headers.get("user-agent") if request else None
        return await audit_repo.add(
            event_type=event_type,
            user_id=(user or {}).get("user_id"),
            email=(user or {}).get("email"),
            ip=ip,
            user_agent=ua,
            metadata=metadata,
            severity=severity,
        )


audit_service = AuditService()
