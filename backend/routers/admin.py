"""Super Admin router — platform-wide control endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core.database import db
from core.security import current_user
from services.admin_service import admin_service, require_super_admin
from services.audit_service import audit_service
from repositories.audit_repo import audit_repo

router = APIRouter(prefix="/admin", tags=["admin"])


async def admin_user(user: dict = Depends(current_user)) -> dict:
    """FastAPI dependency — restrict to super_admin."""
    require_super_admin(user)
    return user


@router.get("/dashboard")
async def dashboard(user: dict = Depends(admin_user)):
    return await admin_service.dashboard()


@router.get("/users")
async def list_users(
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
    user: dict = Depends(admin_user),
):
    return await admin_service.list_users(skip=skip, limit=min(limit, 200), search=search)


class BanIn(BaseModel):
    banned: bool


@router.post("/users/{user_id}/ban")
async def ban_user(user_id: str, payload: BanIn, request: Request, user: dict = Depends(admin_user)):
    r = await admin_service.toggle_ban(user_id, payload.banned)
    await audit_service.log_event(
        event_type="admin.ban_toggle", user=user, request=request,
        metadata={"target": user_id, "banned": payload.banned}, severity="warn",
    )
    return r


class GrantIn(BaseModel):
    days: int = 30


@router.post("/users/{user_id}/grant-premium")
async def grant_premium(user_id: str, payload: GrantIn, request: Request, user: dict = Depends(admin_user)):
    if payload.days <= 0 or payload.days > 365 * 5:
        raise HTTPException(400, "days entre 1 e 1825")
    r = await admin_service.grant_premium(user_id, payload.days)
    await audit_service.log_event(
        event_type="admin.grant_premium", user=user, request=request,
        metadata={"target": user_id, "days": payload.days},
    )
    return r


@router.get("/audit")
async def all_audit(limit: int = 100, event_type: str | None = None, user: dict = Depends(admin_user)):
    items = await audit_repo.list_all(limit=min(limit, 500), event_type=event_type)
    return {"items": items}


@router.get("/transactions")
async def transactions(limit: int = 50, user: dict = Depends(admin_user)):
    items = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 200))
    return {"items": items, "count": len(items)}


@router.get("/db-stats")
async def db_stats(user: dict = Depends(admin_user)):
    return await admin_service.db_stats()
