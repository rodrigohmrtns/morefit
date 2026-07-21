"""LGPD & Audit endpoints — user privacy rights (Lei Geral de Proteção de Dados).

Endpoints:
- GET  /api/lgpd/summary          → visão geral (dados coletados + status)
- GET  /api/lgpd/export           → download JSON completo dos dados do usuário
- POST /api/lgpd/delete-account   → agenda exclusão (grace period configurável)
- POST /api/lgpd/cancel-deletion  → cancela exclusão agendada
- GET  /api/lgpd/audit            → histórico de auditoria do próprio usuário
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from core.database import db
from core.security import current_user, resolve_user
from repositories.audit_repo import audit_repo
from services.audit_service import audit_service
from services.lgpd_service import USER_OWNED_COLLECTIONS, lgpd_service

router = APIRouter(prefix="/lgpd", tags=["lgpd"])


@router.get("/summary")
async def lgpd_summary(user: dict = Depends(current_user)):
    """Return counts of records per collection + deletion status."""
    uid = user["user_id"]
    counts: dict[str, int] = {}
    for coll in USER_OWNED_COLLECTIONS:
        counts[coll] = await db[coll].count_documents({"user_id": uid})
    return {
        "user_id": uid,
        "email": user.get("email"),
        "counts": counts,
        "total_records": sum(counts.values()),
        "deletion_scheduled_at": user.get("deletion_scheduled_at"),
        "deletion_effective_at": user.get("deletion_effective_at"),
    }


@router.get("/export")
async def lgpd_export(request: Request, user: dict = Depends(current_user)):
    """Download a JSON file containing all data owned by the user."""
    payload = await lgpd_service.export_user_data(user)
    await audit_service.log_event(
        event_type="lgpd.export",
        user=user,
        request=request,
        metadata={"total_records": sum(len(v) if isinstance(v, list) else 0 for v in payload.values())},
    )
    body = json.dumps(payload, ensure_ascii=False, indent=2, default=str).encode("utf-8")
    filename = f"vitatracker-lgpd-{user.get('email','user').replace('@','_at_')}.json"
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/delete-account")
async def lgpd_delete_account(request: Request, user: dict = Depends(current_user)):
    """Schedule account deletion after configurable grace period (default 30 days)."""
    if user.get("deletion_scheduled_at"):
        raise HTTPException(400, "Exclusão já agendada")
    r = await lgpd_service.schedule_deletion(user)
    await audit_service.log_event(
        event_type="lgpd.deletion_scheduled",
        user=user,
        request=request,
        metadata=r,
        severity="warn",
    )
    return r


@router.post("/cancel-deletion")
async def lgpd_cancel_deletion(request: Request):
    """Cancel a scheduled deletion. Special path: `current_user` blocks deleted
    accounts, so we resolve the user manually here (must still be within grace)."""
    auth = request.headers.get("Authorization", "")
    token = auth.split(" ", 1)[1].strip() if auth.lower().startswith("bearer ") else ""
    user = await resolve_user(token)
    if not user:
        raise HTTPException(401, "Não autenticado")
    if not user.get("deletion_scheduled_at"):
        raise HTTPException(400, "Nenhuma exclusão agendada")
    r = await lgpd_service.cancel_deletion(user)
    await audit_service.log_event(
        event_type="lgpd.deletion_cancelled",
        user=user, request=request,
    )
    return r


@router.get("/audit")
async def my_audit(user: dict = Depends(current_user), limit: int = 100):
    """Return the last N audit events for the current user."""
    items = await audit_repo.list_for_user(user["user_id"], limit=limit)
    return {"items": items}
