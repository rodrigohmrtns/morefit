"""Analytics — weight/metrics timeseries, comparison, dashboard summary, motivation.

Also hosts GET /steps (weekly history) because it's an aggregation over the
steps collection populated by routers/tracking.py.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from deps import (
    current_user,
    db,
    now_utc,
    today_iso,
)

router = APIRouter(tags=["analytics"])


_METRIC_FIELDS = {
    "weight": "weight_kg",
    "bmi": None,
    "body_fat": "body_fat_pct",
    "muscle": "muscle_mass_kg",
    "water_pct": "body_water_pct",
    "waist": "waist_cm",
    "hip": "hip_cm",
    "arm": "arm_cm",
    "chest": "chest_cm",
    "abdomen": "abdomen_cm",
    "thigh": "thigh_cm",
    "calf": "calf_cm",
    "neck": "neck_cm",
    "shoulders": "shoulders_cm",
}


def _linear_regression(xs: list[float], ys: list[float]) -> tuple[float, float]:
    n = len(xs)
    if n < 2:
        return 0.0, ys[0] if ys else 0.0
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((xs[i] - mx) * (ys[i] - my) for i in range(n))
    den = sum((xs[i] - mx) ** 2 for i in range(n)) or 1e-9
    slope = num / den
    intercept = my - slope * mx
    return slope, intercept


def _period_days(period: str) -> int:
    return {"day": 7, "week": 30, "month": 180, "year": 730}.get(period, 30)


@router.get("/analytics/weight")
async def analytics_weight(
    metric: str = "weight",
    period: str = "week",
    user: dict = Depends(current_user),
):
    if metric not in _METRIC_FIELDS:
        raise HTTPException(400, "Métrica inválida")
    days = _period_days(period)
    cutoff = (now_utc().date() - timedelta(days=days)).isoformat()
    docs = await db.weights.find(
        {"user_id": user["user_id"], "date": {"$gte": cutoff}}, {"_id": 0},
    ).sort("date", 1).to_list(500)

    height_m = (user.get("height_cm") or 0) / 100.0
    series = []
    for d in docs:
        val = None
        if metric == "weight":
            val = d.get("weight_kg")
        elif metric == "bmi":
            w = d.get("weight_kg")
            if w and height_m > 0:
                val = round(w / (height_m * height_m), 2)
        else:
            field = _METRIC_FIELDS[metric]
            val = d.get(field)
        if val is not None:
            series.append({"date": d["date"], "value": float(val)})

    values = [p["value"] for p in series]
    stats: dict[str, Any] = {
        "current": values[-1] if values else None,
        "first": values[0] if values else None,
        "diff": None, "avg": None, "min": None, "max": None,
        "trend_per_week": None, "predicted_30d": None,
    }
    if values:
        stats["diff"] = round(values[-1] - values[0], 2)
        stats["avg"] = round(sum(values) / len(values), 2)
        stats["min"] = min(values)
        stats["max"] = max(values)
        if len(values) >= 2:
            xs = list(range(len(values)))
            slope, _intercept = _linear_regression(xs, values)
            try:
                first_d = datetime.fromisoformat(series[0]["date"]).date()
                last_d = datetime.fromisoformat(series[-1]["date"]).date()
                span_days = max(1, (last_d - first_d).days)
                per_day = (values[-1] - values[0]) / span_days
            except Exception:
                per_day = slope
            stats["trend_per_week"] = round(per_day * 7, 3)
            stats["predicted_30d"] = round(values[-1] + per_day * 30, 2)

    return {"metric": metric, "period": period, "series": series, "stats": stats}


@router.get("/analytics/compare")
async def analytics_compare(user: dict = Depends(current_user), period: str = "month"):
    days = _period_days(period)
    cutoff = (now_utc().date() - timedelta(days=days)).isoformat()
    docs = await db.weights.find(
        {"user_id": user["user_id"], "date": {"$gte": cutoff}}, {"_id": 0},
    ).sort("date", 1).to_list(500)

    def _series(getter):
        out = []
        for d in docs:
            v = getter(d)
            if v is not None:
                out.append({"date": d["date"], "value": float(v)})
        return out

    height_m = (user.get("height_cm") or 0) / 100.0

    def _bmi(d):
        w = d.get("weight_kg")
        return round(w / (height_m * height_m), 2) if w and height_m > 0 else None

    return {
        "period": period,
        "metrics": {
            "weight": _series(lambda d: d.get("weight_kg")),
            "bmi": _series(_bmi),
            "body_fat": _series(lambda d: d.get("body_fat_pct")),
            "muscle": _series(lambda d: d.get("muscle_mass_kg")),
            "water_pct": _series(lambda d: d.get("body_water_pct")),
            "waist": _series(lambda d: d.get("waist_cm")),
            "hip": _series(lambda d: d.get("hip_cm")),
            "arm": _series(lambda d: d.get("arm_cm")),
            "chest": _series(lambda d: d.get("chest_cm")),
            "abdomen": _series(lambda d: d.get("abdomen_cm")),
            "thigh": _series(lambda d: d.get("thigh_cm")),
            "calf": _series(lambda d: d.get("calf_cm")),
            "neck": _series(lambda d: d.get("neck_cm")),
            "shoulders": _series(lambda d: d.get("shoulders_cm")),
        },
    }


# ============= Motivation quotes =============
QUOTES_PT = [
    "Pequenos passos todos os dias criam grandes transformações.",
    "Você é mais forte do que imagina. Continue.",
    "O corpo alcança o que a mente acredita.",
    "Cuide de si — é a sua maior riqueza.",
    "A disciplina de hoje é o resultado de amanhã.",
    "Um dia de cada vez. Um passo de cada vez.",
    "Consistência supera intensidade.",
    "Você não precisa ser perfeito — precisa ser constante.",
    "Cada refeição é uma chance de recomeçar.",
    "Sua saúde é o projeto mais importante da sua vida.",
]


@router.get("/motivation")
async def motivation(user: dict = Depends(current_user)):
    idx = (hash(user["user_id"] + today_iso()) % len(QUOTES_PT))
    return {"quote": QUOTES_PT[abs(idx)]}


# ============= Steps weekly history =============
@router.get("/steps")
async def list_steps(user: dict = Depends(current_user), days: int = 30):
    cutoff = (now_utc().date() - timedelta(days=days)).isoformat()
    items = await db.steps.find(
        {"user_id": user["user_id"], "date": {"$gte": cutoff}}, {"_id": 0},
    ).sort("date", -1).to_list(days)
    total = sum(x.get("steps", 0) for x in items)
    avg = round(total / max(1, len(items))) if items else 0
    return {"items": items, "total": total, "avg": avg, "goal": user.get("daily_steps_goal") or 8000}


# ============= Dashboard summary =============
@router.get("/dashboard/summary")
async def dashboard(user: dict = Depends(current_user)):
    today = today_iso()
    uid = user["user_id"]
    meals = await db.meals.find({"user_id": uid, "date": today}, {"_id": 0}).to_list(200)
    waters = await db.waters.find({"user_id": uid, "date": today}, {"_id": 0}).to_list(200)
    exercises = await db.exercises.find({"user_id": uid, "date": today}, {"_id": 0}).to_list(200)
    latest_weight = await db.weights.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(1)
    latest_sleep = await db.sleeps.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(1)
    steps_doc = await db.steps.find_one({"user_id": uid, "date": today}, {"_id": 0})
    photos = await db.photos.find({"user_id": uid}, {"_id": 0, "image_base64": 0}).sort("date", -1).to_list(6)

    calories = sum(m.get("calories", 0) for m in meals)
    protein = sum(m.get("protein_g", 0) for m in meals)
    carbs = sum(m.get("carbs_g", 0) for m in meals)
    fat = sum(m.get("fat_g", 0) for m in meals)
    water_ml = sum(w.get("amount_ml", 0) for w in waters)
    burned = sum(e.get("calories_burned", 0) for e in exercises)
    exercise_min = sum(e.get("duration_min", 0) for e in exercises)

    height_cm = user.get("height_cm")
    current_weight = latest_weight[0]["weight_kg"] if latest_weight else user.get("starting_weight_kg")
    bmi = None
    if height_cm and current_weight:
        m = height_cm / 100.0
        bmi = round(current_weight / (m * m), 1) if m > 0 else None

    days_remaining = None
    td = user.get("target_date")
    if td:
        try:
            target = datetime.fromisoformat(td).date()
            delta = (target - now_utc().date()).days
            days_remaining = max(0, delta)
        except Exception:
            pass

    return {
        "date": today,
        "calories": {"consumed": calories, "goal": user.get("daily_calorie_goal") or 2000, "burned": burned},
        "macros": {"protein_g": protein, "carbs_g": carbs, "fat_g": fat},
        "water": {"total_ml": water_ml, "goal_ml": user.get("daily_water_ml_goal") or 2000},
        "weight": {
            "current_kg": current_weight,
            "starting_kg": user.get("starting_weight_kg"),
            "goal_kg": user.get("goal_weight_kg"),
        },
        "bmi": bmi,
        "days_remaining": days_remaining,
        "steps": {"count": steps_doc["steps"] if steps_doc else 0, "goal": user.get("daily_steps_goal") or 8000},
        "sleep": {
            "last_hours": latest_sleep[0]["hours"] if latest_sleep else None,
            "goal_hours": user.get("daily_sleep_hours_goal") or 8.0,
        },
        "exercises": {"count": len(exercises), "minutes": exercise_min, "burned": burned},
        "meals_count": len(meals),
        "photos": photos,
    }
