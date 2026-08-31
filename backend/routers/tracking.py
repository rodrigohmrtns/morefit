"""Tracking endpoints — weight, water, exercise, sleep, mood, steps, photos, fasting."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.image_safety import check_user_quota, sanitize_image_base64
from deps import (
    ExerciseIn,
    MoodIn,
    SleepIn,
    WaterIn,
    WeightIn,
    current_user,
    db,
    new_id,
    now_utc,
    today_iso,
)

router = APIRouter(tags=["tracking"])


# ============= Weight =============
@router.post("/weight")
async def add_weight(payload: WeightIn, user: dict = Depends(current_user)):
    entry = {
        "id": new_id("wt"),
        "user_id": user["user_id"],
        "date": payload.date or today_iso(),
        "time": payload.time,
        "note": payload.note,
        "source": payload.source or "manual",
        "weight_kg": payload.weight_kg,
        "body_fat_pct": payload.body_fat_pct,
        "muscle_mass_kg": payload.muscle_mass_kg,
        "body_water_pct": payload.body_water_pct,
        "protein_pct": payload.protein_pct,
        "lean_mass_kg": payload.lean_mass_kg,
        "bone_mass_kg": payload.bone_mass_kg,
        "visceral_fat": payload.visceral_fat,
        "bmr_kcal": payload.bmr_kcal,
        "metabolic_age": payload.metabolic_age,
        "waist_cm": payload.waist_cm,
        "hip_cm": payload.hip_cm,
        "arm_cm": payload.arm_cm,
        "chest_cm": payload.chest_cm,
        "abdomen_cm": payload.abdomen_cm,
        "thigh_cm": payload.thigh_cm,
        "calf_cm": payload.calf_cm,
        "neck_cm": payload.neck_cm,
        "shoulders_cm": payload.shoulders_cm,
        "created_at": now_utc().isoformat(),
    }
    await db.weights.insert_one(entry)
    if user.get("starting_weight_kg") is None:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"starting_weight_kg": payload.weight_kg}})
    return {k: v for k, v in entry.items() if k != "_id"}


@router.get("/weight")
async def list_weight(user: dict = Depends(current_user), limit: int = 90):
    items = await db.weights.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).to_list(limit)
    return {"items": items}


@router.delete("/weight/{entry_id}")
async def delete_weight(entry_id: str, user: dict = Depends(current_user)):
    await db.weights.delete_one({"id": entry_id, "user_id": user["user_id"]})
    return {"ok": True}


# ============= Water =============
@router.post("/water")
async def add_water(payload: WaterIn, user: dict = Depends(current_user)):
    entry = {
        "id": new_id("wat"),
        "user_id": user["user_id"],
        "amount_ml": payload.amount_ml,
        "date": payload.date or today_iso(),
        "created_at": now_utc().isoformat(),
    }
    await db.waters.insert_one(entry)
    return {k: v for k, v in entry.items() if k != "_id"}


@router.get("/water")
async def list_water(user: dict = Depends(current_user), date: Optional[str] = None):
    q = {"user_id": user["user_id"]}
    if date:
        q["date"] = date
    items = await db.waters.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    total = sum(i.get("amount_ml", 0) for i in items)
    return {"items": items, "total_ml": total}


# ============= Exercise =============
@router.post("/exercises")
async def add_exercise(payload: ExerciseIn, user: dict = Depends(current_user)):
    entry = payload.dict()
    entry.update({
        "id": new_id("ex"),
        "user_id": user["user_id"],
        "date": payload.date or today_iso(),
        "created_at": now_utc().isoformat(),
    })
    await db.exercises.insert_one(entry)
    return {k: v for k, v in entry.items() if k != "_id"}


@router.get("/exercises")
async def list_exercises(user: dict = Depends(current_user), date: Optional[str] = None):
    q = {"user_id": user["user_id"]}
    if date:
        q["date"] = date
    items = await db.exercises.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"items": items}


# ============= Sleep =============
@router.post("/sleep")
async def add_sleep(payload: SleepIn, user: dict = Depends(current_user)):
    entry = payload.dict()
    entry.update({
        "id": new_id("sl"),
        "user_id": user["user_id"],
        "date": payload.date or today_iso(),
        "created_at": now_utc().isoformat(),
    })
    await db.sleeps.insert_one(entry)
    return {k: v for k, v in entry.items() if k != "_id"}


@router.get("/sleep")
async def list_sleep(user: dict = Depends(current_user)):
    items = await db.sleeps.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).to_list(60)
    return {"items": items}


# ============= Mood =============
@router.post("/mood")
async def add_mood(payload: MoodIn, user: dict = Depends(current_user)):
    entry = payload.dict()
    entry.update({
        "id": new_id("mood"),
        "user_id": user["user_id"],
        "date": payload.date or today_iso(),
        "created_at": now_utc().isoformat(),
    })
    await db.moods.insert_one(entry)
    return {k: v for k, v in entry.items() if k != "_id"}


@router.get("/mood")
async def list_mood(user: dict = Depends(current_user)):
    items = await db.moods.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).to_list(60)
    return {"items": items}


# ============= Progress photos =============
class ProgressPhotoIn(BaseModel):
    image_base64: str
    weight_kg: Optional[float] = None
    note: Optional[str] = None
    date: Optional[str] = None


@router.post("/photos")
async def add_photo(payload: ProgressPhotoIn, user: dict = Depends(current_user)):
    # 1) sanitize image (magic bytes, size, EXIF strip, resize)
    clean_b64, size = sanitize_image_base64(payload.image_base64)
    # 2) quota check
    await check_user_quota(db, user["user_id"], extra_bytes=size)

    entry = {
        "id": new_id("ph"),
        "user_id": user["user_id"],
        "image_base64": clean_b64,
        "weight_kg": payload.weight_kg,
        "note": payload.note,
        "date": payload.date or today_iso(),
        "created_at": now_utc().isoformat(),
    }
    await db.photos.insert_one(entry)
    return {k: v for k, v in entry.items() if k != "_id"}


@router.get("/photos")
async def list_photos(user: dict = Depends(current_user)):
    items = await db.photos.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).to_list(30)
    return {"items": items}


@router.delete("/photos/{photo_id}")
async def delete_photo(photo_id: str, user: dict = Depends(current_user)):
    await db.photos.delete_one({"id": photo_id, "user_id": user["user_id"]})
    return {"ok": True}


# ============= Steps =============
class StepsIn(BaseModel):
    steps: int
    date: Optional[str] = None


@router.post("/steps")
async def add_steps(payload: StepsIn, user: dict = Depends(current_user)):
    date = payload.date or today_iso()
    await db.steps.update_one(
        {"user_id": user["user_id"], "date": date},
        {"$set": {"steps": payload.steps, "user_id": user["user_id"], "date": date, "updated_at": now_utc().isoformat()}},
        upsert=True,
    )
    return {"steps": payload.steps, "date": date}


# NOTE: GET /steps is in analytics.py (returns weekly aggregation)


# ============= Fasting =============
FastProtocol = Literal["16:8", "18:6", "20:4", "OMAD", "custom"]
_PROTOCOL_HOURS: dict[str, int] = {"16:8": 16, "18:6": 18, "20:4": 20, "OMAD": 23, "custom": 16}


class FastStartIn(BaseModel):
    protocol: FastProtocol = "16:8"
    target_hours: Optional[float] = None
    note: Optional[str] = None


@router.get("/fasting/current")
async def current_fast(user: dict = Depends(current_user)):
    active = await db.fasts.find_one(
        {"user_id": user["user_id"], "ended_at": None},
        {"_id": 0},
    )
    return {"active": active}


@router.post("/fasting/start")
async def start_fast(payload: FastStartIn, user: dict = Depends(current_user)):
    await db.fasts.update_many(
        {"user_id": user["user_id"], "ended_at": None},
        {"$set": {"ended_at": now_utc().isoformat(), "cancelled": True}},
    )
    target = payload.target_hours or float(_PROTOCOL_HOURS.get(payload.protocol, 16))
    entry = {
        "id": new_id("fast"),
        "user_id": user["user_id"],
        "protocol": payload.protocol,
        "target_hours": target,
        "started_at": now_utc().isoformat(),
        "ended_at": None,
        "note": payload.note,
    }
    await db.fasts.insert_one(entry)
    return {k: v for k, v in entry.items() if k != "_id"}


@router.post("/fasting/stop")
async def stop_fast(user: dict = Depends(current_user)):
    active = await db.fasts.find_one({"user_id": user["user_id"], "ended_at": None}, {"_id": 0})
    if not active:
        raise HTTPException(400, "Nenhum jejum em andamento")
    started = datetime.fromisoformat(active["started_at"])
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    ended = now_utc()
    hours = round((ended - started).total_seconds() / 3600.0, 2)
    await db.fasts.update_one(
        {"id": active["id"]},
        {"$set": {"ended_at": ended.isoformat(), "elapsed_hours": hours}},
    )
    return {"id": active["id"], "elapsed_hours": hours}


@router.get("/fasting")
async def list_fasts(user: dict = Depends(current_user), limit: int = 50):
    items = await db.fasts.find({"user_id": user["user_id"], "ended_at": {"$ne": None}}, {"_id": 0})\
        .sort("started_at", -1).to_list(limit)
    return {"items": items}


@router.delete("/fasting/{fast_id}")
async def delete_fast(fast_id: str, user: dict = Depends(current_user)):
    await db.fasts.delete_one({"id": fast_id, "user_id": user["user_id"]})
    return {"ok": True}
