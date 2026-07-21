"""LGPD service — export user data, schedule/cancel deletion.

Follows Domain-Service pattern: the router orchestrates HTTP concerns while
the service owns business rules (grace period, cascade, etc.).
"""
from __future__ import annotations

from datetime import timedelta
from typing import Any

from core.config import settings
from core.database import db
from core.utils import now_utc

# Collections owned by the user that must be included in exports/deletes.
# Grouped explicitly to make the LGPD contract auditable.
USER_OWNED_COLLECTIONS: list[str] = [
    "weights", "meals", "waters", "exercises", "sleeps", "moods",
    "photos", "steps", "fasts", "food_favorites",
    "coach_messages",
    "shares",
    "posts", "comments",
    "payment_transactions", "webhook_events",
    "campaign_participations",
    "company_members",  # membership only — company itself not deleted (may have others)
    "audit_logs",
]


class LgpdService:
    """LGPD (Brazilian data protection law) operations."""

    async def export_user_data(self, user: dict) -> dict:
        """Return a serializable dict with every piece of user data.

        Excludes password hashes and internal Mongo `_id` fields.
        """
        uid = user["user_id"]
        payload: dict[str, Any] = {
            "exported_at": now_utc().isoformat(),
            "user": {k: v for k, v in user.items() if k not in ("password_hash", "_id")},
        }
        for coll in USER_OWNED_COLLECTIONS:
            payload[coll] = await db[coll].find({"user_id": uid}, {"_id": 0}).to_list(10_000)
        # Cross-reference: companies user owns (owner_id) — included separately
        payload["companies_owned"] = await db.companies.find({"owner_id": uid}, {"_id": 0}).to_list(50)
        return payload

    async def schedule_deletion(self, user: dict) -> dict:
        """Mark account for soft deletion after grace period.

        Sets `deletion_scheduled_at` and `deletion_effective_at` fields. The
        account remains logged out (current_user blocks `deleted_at` accounts).
        """
        effective = now_utc() + timedelta(days=settings.account_deletion_grace_days)
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {
                "deletion_scheduled_at": now_utc().isoformat(),
                "deletion_effective_at": effective.isoformat(),
            }},
        )
        return {
            "scheduled_at": now_utc().isoformat(),
            "effective_at": effective.isoformat(),
            "grace_days": settings.account_deletion_grace_days,
        }

    async def cancel_deletion(self, user: dict) -> dict:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$unset": {"deletion_scheduled_at": "", "deletion_effective_at": ""}},
        )
        return {"ok": True}

    async def hard_delete(self, user_id: str) -> dict:
        """Physically remove the user and all owned records.

        Intended for admin/cron use. Cascades over `USER_OWNED_COLLECTIONS`.
        """
        summary: dict[str, int] = {}
        for coll in USER_OWNED_COLLECTIONS:
            r = await db[coll].delete_many({"user_id": user_id})
            summary[coll] = r.deleted_count
        # Companies owned: transfer or delete? For MVP we delete companies with no other admin.
        owned = await db.companies.find({"owner_id": user_id}, {"_id": 0, "id": 1}).to_list(50)
        for co in owned:
            await db.companies.delete_one({"id": co["id"]})
            summary[f"company:{co['id']}"] = 1
        r = await db.users.delete_one({"user_id": user_id})
        summary["user"] = r.deleted_count
        return summary


lgpd_service = LgpdService()
