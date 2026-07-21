"""Repository for audit_logs — data access only, no business logic."""
from __future__ import annotations

from typing import Optional

from core.database import db
from core.utils import new_id, now_utc


class AuditRepository:
    """Simple Mongo-backed repository following Repository Pattern.

    Kept synchronous-looking API (async methods) to match motor conventions.
    """

    COLLECTION = "audit_logs"

    async def add(
        self,
        *,
        event_type: str,
        user_id: Optional[str] = None,
        email: Optional[str] = None,
        ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[dict] = None,
        severity: str = "info",  # info | warn | error
    ) -> dict:
        entry = {
            "id": new_id("aud"),
            "event_type": event_type,
            "user_id": user_id,
            "email": email,
            "ip": ip,
            "user_agent": (user_agent or "")[:250],
            "metadata": metadata or {},
            "severity": severity,
            "timestamp": now_utc().isoformat(),
        }
        await db[self.COLLECTION].insert_one(entry)
        return {k: v for k, v in entry.items() if k != "_id"}

    async def list_for_user(self, user_id: str, limit: int = 100) -> list[dict]:
        return await db[self.COLLECTION].find(
            {"user_id": user_id}, {"_id": 0}
        ).sort("timestamp", -1).to_list(limit)

    async def list_all(self, limit: int = 500, event_type: Optional[str] = None) -> list[dict]:
        q: dict = {}
        if event_type:
            q["event_type"] = event_type
        return await db[self.COLLECTION].find(q, {"_id": 0}).sort("timestamp", -1).to_list(limit)


audit_repo = AuditRepository()
