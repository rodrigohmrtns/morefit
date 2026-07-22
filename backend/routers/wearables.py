"""Wearables sync — HealthKit (iOS) / Health Connect (Android) / Google Fit.

Endpoints accept batch pushes from the mobile app. The mobile side is
scaffolded but only fully functional in a native build; the web preview /
Expo Go fall back to manual entry.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from deps import current_user, db, new_id, now_utc, today_iso

router = APIRouter(tags=["wearables"])


class StepsSample(BaseModel):
    date: str                       # YYYY-MM-DD
    steps: int = Field(ge=0)


class HeartRateSample(BaseModel):
    timestamp: str                  # ISO-8601
    bpm: float = Field(ge=20, le=250)


class SleepSample(BaseModel):
    date: str
    hours: float = Field(ge=0, le=24)
    rem_hours: Optional[float] = None
    deep_hours: Optional[float] = None
    light_hours: Optional[float] = None
    bedtime: Optional[str] = None
    wake_time: Optional[str] = None


class WeightSample(BaseModel):
    date: str
    weight_kg: float = Field(gt=0, lt=500)
    body_fat_pct: Optional[float] = None


class ActiveEnergySample(BaseModel):
    date: str
    calories: float = Field(ge=0)


class WearablesSyncIn(BaseModel):
    source: Literal["healthkit", "google-fit", "health-connect", "manual"] = "healthkit"
    device_name: Optional[str] = None
    steps: Optional[list[StepsSample]] = None
    heart_rate: Optional[list[HeartRateSample]] = None
    sleep: Optional[list[SleepSample]] = None
    weights: Optional[list[WeightSample]] = None
    active_energy: Optional[list[ActiveEnergySample]] = None


@router.post("/wearables/sync")
async def wearables_sync(payload: WearablesSyncIn, user: dict = Depends(current_user)):
    """Ingest a batch of samples from the device. Deduplicates by user+date+source."""
    uid = user["user_id"]
    now = now_utc()
    counters = {"steps": 0, "heart_rate": 0, "sleep": 0, "weights": 0, "active_energy": 0}

    # --- Steps: upsert daily aggregate ---
    for s in payload.steps or []:
        await db.steps.update_one(
            {"user_id": uid, "date": s.date},
            {"$set": {
                "user_id": uid, "date": s.date, "steps": s.steps,
                "source": payload.source, "updated_at": now.isoformat(),
            }},
            upsert=True,
        )
        counters["steps"] += 1

    # --- Heart rate: append raw samples (small collection) ---
    for hr in payload.heart_rate or []:
        await db.heart_rate.insert_one({
            "id": new_id("hr"),
            "user_id": uid,
            "timestamp": hr.timestamp,
            "bpm": hr.bpm,
            "source": payload.source,
        })
        counters["heart_rate"] += 1

    # --- Sleep: upsert per-day (last sample wins) ---
    for sl in payload.sleep or []:
        await db.sleeps.update_one(
            {"user_id": uid, "date": sl.date, "source": payload.source},
            {"$set": {
                "user_id": uid,
                "date": sl.date,
                "hours": sl.hours,
                "rem_hours": sl.rem_hours,
                "deep_hours": sl.deep_hours,
                "light_hours": sl.light_hours,
                "bedtime": sl.bedtime,
                "wake_time": sl.wake_time,
                "source": payload.source,
                "created_at": now.isoformat(),
            }},
            upsert=True,
        )
        counters["sleep"] += 1

    # --- Weight: append (each measurement is meaningful history) ---
    for w in payload.weights or []:
        exists = await db.weights.find_one(
            {"user_id": uid, "date": w.date, "source": payload.source}, {"_id": 1}
        )
        if exists:
            continue
        await db.weights.insert_one({
            "id": new_id("wt"),
            "user_id": uid,
            "date": w.date,
            "weight_kg": w.weight_kg,
            "body_fat_pct": w.body_fat_pct,
            "source": payload.source,
            "created_at": now.isoformat(),
        })
        counters["weights"] += 1

    # --- Active energy: append to exercises as "wearable activity" ---
    for ae in payload.active_energy or []:
        exists = await db.exercises.find_one(
            {"user_id": uid, "date": ae.date, "source": payload.source,
             "name": f"Atividade {payload.source}"}, {"_id": 1}
        )
        if exists:
            continue
        await db.exercises.insert_one({
            "id": new_id("ex"),
            "user_id": uid,
            "date": ae.date,
            "name": f"Atividade {payload.source}",
            "category": "custom",
            "duration_min": 0,
            "calories_burned": ae.calories,
            "intensity": "moderate",
            "source": payload.source,
            "created_at": now.isoformat(),
        })
        counters["active_energy"] += 1

    # --- Record sync event ---
    await db.wearable_syncs.insert_one({
        "id": new_id("ws"),
        "user_id": uid,
        "source": payload.source,
        "device_name": payload.device_name,
        "at": now.isoformat(),
        "counters": counters,
    })

    return {"ok": True, "ingested": counters, "at": now.isoformat()}


@router.get("/wearables/status")
async def wearables_status(user: dict = Depends(current_user)):
    """Last sync per source and connected devices."""
    uid = user["user_id"]
    syncs = await db.wearable_syncs.find({"user_id": uid}, {"_id": 0})\
        .sort("at", -1).to_list(50)
    per_source: dict[str, dict] = {}
    for s in syncs:
        src = s["source"]
        if src not in per_source:
            per_source[src] = {
                "last_sync_at": s["at"],
                "device_name": s.get("device_name"),
                "total_syncs": 1,
                "last_counters": s.get("counters", {}),
            }
        else:
            per_source[src]["total_syncs"] += 1
    return {"sources": per_source, "total": len(syncs)}


@router.get("/wearables/heart-rate")
async def heart_rate_history(user: dict = Depends(current_user), limit: int = 200):
    """Last N heart-rate samples for the current user."""
    items = await db.heart_rate.find({"user_id": user["user_id"]}, {"_id": 0})\
        .sort("timestamp", -1).to_list(limit)
    return {"items": items}
