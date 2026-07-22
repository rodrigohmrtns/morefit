"""Widget data endpoints — lightweight, cached, unauthenticated by long-lived
widget tokens.

Widgets on iOS (WidgetKit) and Android (Glance) fetch small payloads at
periodic intervals. Because widgets cannot store the full user session,
they use dedicated ``widget_tokens``: opaque tokens the user provisions once
from the app and pastes into the native widget config.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel

from deps import current_user, db, new_id, now_utc, today_iso
from middleware.security import widget_public_rate_limit

router = APIRouter(tags=["widgets"])


@router.post("/widgets/token")
async def create_widget_token(user: dict = Depends(current_user)):
    """Provision (or rotate) a widget token for the current user."""
    token = secrets.token_urlsafe(24)
    await db.widget_tokens.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "user_id": user["user_id"],
            "token": token,
            "created_at": now_utc().isoformat(),
        }},
        upsert=True,
    )
    return {"token": token, "instructions_url": "/wearables"}


@router.delete("/widgets/token")
async def revoke_widget_token(user: dict = Depends(current_user)):
    await db.widget_tokens.delete_one({"user_id": user["user_id"]})
    return {"ok": True}


async def _resolve_widget_user(token: str) -> dict:
    doc = await db.widget_tokens.find_one({"token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(401, "Token de widget inválido")
    user = await db.users.find_one({"user_id": doc["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "Usuário não encontrado")
    return user


@router.get("/widgets/summary/{token}")
async def widget_summary(token: str = Path(..., min_length=10),
                         _rl: None = Depends(widget_public_rate_limit)):
    """Small payload shaped for a compact home-screen widget."""
    user = await _resolve_widget_user(token)
    uid = user["user_id"]
    today = today_iso()
    meals = await db.meals.find({"user_id": uid, "date": today}, {"_id": 0}).to_list(50)
    waters = await db.waters.find({"user_id": uid, "date": today}, {"_id": 0}).to_list(50)
    steps_doc = await db.steps.find_one({"user_id": uid, "date": today}, {"_id": 0})
    latest_weight = await db.weights.find({"user_id": uid}, {"_id": 0, "weight_kg": 1})\
        .sort("date", -1).to_list(1)

    # Simple streak — same logic as gamification, condensed
    streak = 0
    now_date = now_utc().date()
    for i in range(0, 30):
        d = (now_date - timedelta(days=i)).isoformat()
        found = await db.weights.find_one({"user_id": uid, "date": d}, {"_id": 1}) \
            or await db.meals.find_one({"user_id": uid, "date": d}, {"_id": 1}) \
            or await db.waters.find_one({"user_id": uid, "date": d}, {"_id": 1})
        if found:
            streak += 1
        elif i > 0:
            break

    kcal_consumed = sum(m.get("calories", 0) for m in meals)
    kcal_goal = user.get("daily_calorie_goal") or 2000
    return {
        "user_name": (user.get("name") or "").split(" ")[0] or "Você",
        "date": today,
        "calories": {
            "consumed": int(kcal_consumed),
            "goal": kcal_goal,
            "remaining": max(0, int(kcal_goal - kcal_consumed)),
            "pct": min(100, round((kcal_consumed / kcal_goal) * 100)) if kcal_goal else 0,
        },
        "water": {
            "ml": sum(w.get("amount_ml", 0) for w in waters),
            "goal_ml": user.get("daily_water_ml_goal") or 2000,
        },
        "steps": {
            "count": steps_doc["steps"] if steps_doc else 0,
            "goal": user.get("daily_steps_goal") or 8000,
        },
        "weight_kg": latest_weight[0]["weight_kg"] if latest_weight else None,
        "goal_weight_kg": user.get("goal_weight_kg"),
        "streak_days": streak,
    }
