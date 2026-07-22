"""Timeline endpoints — aggregate day-level data for calendar/timeline views."""
from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query

from deps import current_user, db

router = APIRouter(tags=["timeline"])


def _month_bounds(ym: str) -> tuple[str, str, int, int]:
    """Return (start_iso, end_iso, year, month) for a YYYY-MM string.
    end_iso is inclusive last-day-of-month."""
    year, month = (int(x) for x in ym.split("-"))
    last_day = monthrange(year, month)[1]
    start = date(year, month, 1).isoformat()
    end = date(year, month, last_day).isoformat()
    return start, end, year, month


@router.get("/timeline/month")
async def timeline_month(
    ym: str = Query(..., description="YYYY-MM"),
    user: dict = Depends(current_user),
):
    """Return per-day activity counts for a month. Used to paint calendar dots."""
    start, end, _year, _month = _month_bounds(ym)
    uid = user["user_id"]

    # Aggregate each collection by date, only counts (fast, single index scan).
    async def _counts(coll: str) -> dict[str, int]:
        rows = await db[coll].aggregate([
            {"$match": {"user_id": uid, "date": {"$gte": start, "$lte": end}}},
            {"$group": {"_id": "$date", "n": {"$sum": 1}}},
        ]).to_list(500)
        return {r["_id"]: r["n"] for r in rows}

    weights = await _counts("weights")
    meals = await _counts("meals")
    waters = await _counts("waters")
    exercises = await _counts("exercises")
    sleeps = await _counts("sleeps")
    photos = await _counts("photos")
    moods = await _counts("moods")
    fastings = await _counts("fastings")

    # Also aggregate water totals (ml) and exercise minutes per day (nice UX signal).
    water_totals = await db.waters.aggregate([
        {"$match": {"user_id": uid, "date": {"$gte": start, "$lte": end}}},
        {"$group": {"_id": "$date", "s": {"$sum": "$amount_ml"}}},
    ]).to_list(500)
    water_by_day = {r["_id"]: int(r["s"]) for r in water_totals}

    ex_totals = await db.exercises.aggregate([
        {"$match": {"user_id": uid, "date": {"$gte": start, "$lte": end}}},
        {"$group": {"_id": "$date", "m": {"$sum": "$duration_min"}, "kcal": {"$sum": "$calories_burned"}}},
    ]).to_list(500)
    ex_by_day = {r["_id"]: {"min": int(r["m"] or 0), "kcal": int(r["kcal"] or 0)} for r in ex_totals}

    kcal_totals = await db.meals.aggregate([
        {"$match": {"user_id": uid, "date": {"$gte": start, "$lte": end}}},
        {"$group": {"_id": "$date", "s": {"$sum": "$calories"}}},
    ]).to_list(500)
    kcal_by_day = {r["_id"]: int(r["s"] or 0) for r in kcal_totals}

    days = []
    year, month = int(ym[:4]), int(ym[5:7])
    last_day = monthrange(year, month)[1]
    for d in range(1, last_day + 1):
        dt = date(year, month, d).isoformat()
        days.append({
            "date": dt,
            "counts": {
                "weight": weights.get(dt, 0),
                "meal": meals.get(dt, 0),
                "water": waters.get(dt, 0),
                "exercise": exercises.get(dt, 0),
                "sleep": sleeps.get(dt, 0),
                "photo": photos.get(dt, 0),
                "mood": moods.get(dt, 0),
                "fasting": fastings.get(dt, 0),
            },
            "totals": {
                "water_ml": water_by_day.get(dt, 0),
                "exercise_min": ex_by_day.get(dt, {}).get("min", 0),
                "exercise_kcal": ex_by_day.get(dt, {}).get("kcal", 0),
                "calories": kcal_by_day.get(dt, 0),
            },
        })

    return {"ym": ym, "days": days}


@router.get("/timeline/day")
async def timeline_day(
    date: str = Query(..., description="YYYY-MM-DD"),
    user: dict = Depends(current_user),
):
    """Return every log for a given day — flat + sorted for a vertical timeline view."""
    uid = user["user_id"]

    async def _list(coll: str, sort_field: Optional[str] = None):
        cur = db[coll].find({"user_id": uid, "date": date}, {"_id": 0})
        if sort_field:
            cur = cur.sort(sort_field, 1)
        return await cur.to_list(200)

    weights = await _list("weights", "time")
    meals = await _list("meals", "time")
    waters = await _list("waters", "time")
    exercises = await _list("exercises", "time")
    sleeps = await _list("sleeps")
    photos = await _list("photos")
    moods = await _list("moods", "time")
    fastings = await db.fastings.find({"user_id": uid, "start_date": date}, {"_id": 0}).to_list(50)

    # Aggregate for header
    total_water_ml = sum(int(w.get("amount_ml") or 0) for w in waters)
    total_kcal = sum(int(m.get("calories") or 0) for m in meals)
    total_ex_min = sum(int(e.get("duration_min") or 0) for e in exercises)
    total_ex_kcal = sum(int(e.get("calories_burned") or 0) for e in exercises)

    # Build unified timeline events with a consistent shape
    def _time_key(t: Optional[str]) -> str:
        return t or "00:00"

    events: list[dict] = []
    for w in weights:
        events.append({
            "kind": "weight", "time": _time_key(w.get("time")),
            "title": f"Peso: {w.get('weight_kg')} kg",
            "detail": f"IMC {round((w.get('weight_kg') or 0) / (((user.get('height_cm') or 170)/100)**2), 1)}"
                      if w.get("weight_kg") else "",
            "raw": w,
        })
    for m in meals:
        events.append({
            "kind": "meal", "time": _time_key(m.get("time")),
            "title": m.get("name") or "Refeição",
            "detail": f"{int(m.get('calories') or 0)} kcal • {m.get('meal_type', '')}",
            "raw": m,
        })
    for w in waters:
        events.append({
            "kind": "water", "time": _time_key(w.get("time")),
            "title": f"Água +{int(w.get('amount_ml') or 0)} ml",
            "detail": "",
            "raw": w,
        })
    for e in exercises:
        events.append({
            "kind": "exercise", "time": _time_key(e.get("time")),
            "title": e.get("name") or "Exercício",
            "detail": f"{int(e.get('duration_min') or 0)} min • {int(e.get('calories_burned') or 0)} kcal",
            "raw": e,
        })
    for sl in sleeps:
        events.append({
            "kind": "sleep", "time": "22:00",
            "title": f"Sono: {sl.get('hours', '—')}h",
            "detail": f"Qualidade: {sl.get('quality', '—')}",
            "raw": sl,
        })
    for mo in moods:
        events.append({
            "kind": "mood", "time": _time_key(mo.get("time")),
            "title": f"Humor: {mo.get('mood', '—')}",
            "detail": mo.get("note") or "",
            "raw": mo,
        })
    for p in photos:
        events.append({
            "kind": "photo", "time": "12:00",
            "title": "Foto de progresso",
            "detail": f"{p.get('weight_kg', '')} kg" if p.get("weight_kg") else "",
            "raw": p,
        })
    for f in fastings:
        events.append({
            "kind": "fasting", "time": _time_key(f.get("start_time")),
            "title": f"Jejum {f.get('target_hours', '?')}h",
            "detail": f.get("status") or "",
            "raw": f,
        })

    events.sort(key=lambda x: x["time"])

    return {
        "date": date,
        "summary": {
            "water_ml": total_water_ml,
            "calories": total_kcal,
            "exercise_min": total_ex_min,
            "exercise_kcal": total_ex_kcal,
            "logs_count": len(events),
        },
        "events": events,
    }
