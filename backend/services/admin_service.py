"""Admin domain service — platform-wide operations (super_admin only)."""
from __future__ import annotations

from datetime import timedelta
from typing import Optional

from fastapi import HTTPException

from core.database import db
from core.utils import now_utc


def require_super_admin(user: dict) -> None:
    """Guard: raise 403 unless user has role == 'super_admin'."""
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Acesso restrito a super administradores")


class AdminService:
    """Aggregated read-only analytics + user/subscription management."""

    async def dashboard(self) -> dict:
        now = now_utc()
        d7 = (now - timedelta(days=7)).isoformat()
        d30 = (now - timedelta(days=30)).isoformat()

        total_users = await db.users.count_documents({})
        total_users_deleted = await db.users.count_documents({"deleted_at": {"$exists": True}})
        users_scheduled_deletion = await db.users.count_documents({"deletion_scheduled_at": {"$exists": True}})
        new_users_7d = await db.users.count_documents({"created_at": {"$gte": d7}})
        new_users_30d = await db.users.count_documents({"created_at": {"$gte": d30}})

        # Active users (had any log in last 7 days across weights/meals/waters/exercises)
        pipeline_uids = [
            {"$match": {"date": {"$gte": (now - timedelta(days=7)).date().isoformat()}}},
            {"$group": {"_id": "$user_id"}},
        ]
        active_ids: set[str] = set()
        for coll in ("weights", "meals", "waters", "exercises"):
            async for doc in db[coll].aggregate(pipeline_uids):
                if doc.get("_id"):
                    active_ids.add(doc["_id"])
        active_7d = len(active_ids)

        premium_now = await db.users.count_documents({"premium_expires_at": {"$gt": now.isoformat()}})

        # Revenue (all paid transactions, sum by currency)
        pipeline_rev = [
            {"$match": {"status": "paid"}},
            {"$group": {"_id": "$currency", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        ]
        revenue = await db.payment_transactions.aggregate(pipeline_rev).to_list(10)
        revenue_by_currency = {r["_id"]: {"total": round(r["total"], 2), "count": r["count"]} for r in revenue}

        # Recent audit summary
        recent_audits = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(10)

        # Content counts
        posts = await db.posts.count_documents({})
        companies = await db.companies.count_documents({})

        return {
            "generated_at": now.isoformat(),
            "users": {
                "total": total_users,
                "active_7d": active_7d,
                "new_7d": new_users_7d,
                "new_30d": new_users_30d,
                "premium_now": premium_now,
                "deleted": total_users_deleted,
                "scheduled_deletion": users_scheduled_deletion,
                "conversion_rate_pct": round((premium_now / total_users) * 100, 2) if total_users else 0,
            },
            "content": {"posts": posts, "companies": companies},
            "revenue": revenue_by_currency,
            "recent_audits": recent_audits,
        }

    async def list_users(self, skip: int = 0, limit: int = 50, search: Optional[str] = None) -> dict:
        q: dict = {}
        if search:
            q["$or"] = [
                {"email": {"$regex": search, "$options": "i"}},
                {"name": {"$regex": search, "$options": "i"}},
            ]
        total = await db.users.count_documents(q)
        cursor = db.users.find(
            q,
            {"_id": 0, "password_hash": 0},
        ).sort("created_at", -1).skip(skip).limit(limit)
        items = await cursor.to_list(limit)
        return {"total": total, "items": items, "skip": skip, "limit": limit}

    async def toggle_ban(self, user_id: str, banned: bool) -> dict:
        upd = {"banned": bool(banned), "banned_at": now_utc().isoformat() if banned else None}
        if not banned:
            upd.pop("banned_at")
            await db.users.update_one({"user_id": user_id}, {"$unset": {"banned_at": ""}, "$set": {"banned": False}})
        else:
            await db.users.update_one({"user_id": user_id}, {"$set": upd})
        return {"ok": True, "user_id": user_id, "banned": banned}

    async def grant_premium(self, user_id: str, days: int = 30) -> dict:
        exp = now_utc() + timedelta(days=days)
        u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "premium_expires_at": 1})
        base = now_utc()
        if u and u.get("premium_expires_at"):
            from datetime import datetime, timezone
            try:
                cur = u["premium_expires_at"]
                cur_dt = datetime.fromisoformat(cur.replace("Z", "+00:00")) if isinstance(cur, str) else cur
                if cur_dt.tzinfo is None:
                    cur_dt = cur_dt.replace(tzinfo=timezone.utc)
                if cur_dt > base:
                    base = cur_dt
            except Exception:
                pass
        new_exp = base + timedelta(days=days)
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"subscription_tier": "premium",
                      "premium_expires_at": new_exp.isoformat(),
                      "premium_since": now_utc().isoformat(),
                      "last_plan": f"admin_grant_{days}d"}},
        )
        return {"ok": True, "premium_expires_at": new_exp.isoformat()}

    async def db_stats(self) -> dict:
        """Collection sizes, doc counts, index list — for capacity planning."""
        names = await db.list_collection_names()
        out: dict[str, dict] = {}
        for name in sorted(names):
            try:
                stats = await db.command("collStats", name)
                count = await db[name].count_documents({})
                # index names
                idxs = []
                async for i in db[name].list_indexes():
                    idxs.append(i.get("name", "?"))
                out[name] = {
                    "count": count,
                    "size_bytes": stats.get("size", 0),
                    "storage_bytes": stats.get("storageSize", 0),
                    "avg_obj_size": stats.get("avgObjSize", 0),
                    "indexes": idxs,
                    "n_indexes": len(idxs),
                }
            except Exception as e:
                out[name] = {"error": str(e)}
        return {"database": db.name, "collections": out, "count": len(out)}


admin_service = AdminService()
