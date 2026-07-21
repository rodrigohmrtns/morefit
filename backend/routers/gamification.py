"""Gamification endpoints — XP, levels, achievements, leaderboard."""
from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends

from deps import current_user, db, now_utc, today_iso

router = APIRouter(tags=["gamification"])


_ACHIEVEMENTS = [
    {"id": "first_step", "name": "Primeiro passo", "desc": "Completou o cadastro", "icon": "flag", "xp": 25},
    {"id": "first_weight", "name": "Balança na mão", "desc": "Registrou primeiro peso", "icon": "scale", "xp": 20},
    {"id": "first_meal", "name": "Bom apetite", "desc": "Primeira refeição no diário", "icon": "restaurant", "xp": 15},
    {"id": "first_exercise", "name": "Suando a camisa", "desc": "Primeiro exercício registrado", "icon": "flame", "xp": 30},
    {"id": "first_photo", "name": "Documente!", "desc": "Primeira foto de progresso", "icon": "camera", "xp": 25},
    {"id": "streak_3", "name": "Ritmo iniciante", "desc": "3 dias consecutivos", "icon": "flash", "xp": 40},
    {"id": "streak_7", "name": "Uma semana!", "desc": "7 dias consecutivos", "icon": "trophy", "xp": 100},
    {"id": "streak_30", "name": "Um mês de foco", "desc": "30 dias consecutivos", "icon": "star", "xp": 300},
    {"id": "meals_10", "name": "Nutrição consciente", "desc": "10 refeições registradas", "icon": "nutrition", "xp": 50},
    {"id": "exercises_10", "name": "Atleta em treino", "desc": "10 exercícios registrados", "icon": "barbell", "xp": 60},
    {"id": "water_goal_5", "name": "Bem hidratado", "desc": "Meta de água em 5 dias", "icon": "water", "xp": 50},
    {"id": "weight_loss_5kg", "name": "-5 kg conquistados", "desc": "Perdeu 5 kg desde o início", "icon": "arrow-down", "xp": 200},
]


async def _compute_streak(uid: str) -> int:
    today = now_utc().date()
    streak = 0
    for i in range(0, 365):
        d = (today - timedelta(days=i)).isoformat()
        any_log = await db.weights.find_one({"user_id": uid, "date": d}, {"_id": 1}) \
            or await db.meals.find_one({"user_id": uid, "date": d}, {"_id": 1}) \
            or await db.waters.find_one({"user_id": uid, "date": d}, {"_id": 1}) \
            or await db.exercises.find_one({"user_id": uid, "date": d}, {"_id": 1})
        if any_log:
            streak += 1
        else:
            if i == 0:
                continue
            break
    return streak


@router.get("/gamification")
async def gamification(user: dict = Depends(current_user)):
    uid = user["user_id"]
    n_weights = await db.weights.count_documents({"user_id": uid})
    n_meals = await db.meals.count_documents({"user_id": uid})
    n_exercises = await db.exercises.count_documents({"user_id": uid})
    n_photos = await db.photos.count_documents({"user_id": uid})
    all_waters = await db.waters.find({"user_id": uid}, {"_id": 0, "date": 1, "amount_ml": 1}).to_list(2000)
    by_date: dict[str, int] = {}
    for w in all_waters:
        by_date[w["date"]] = by_date.get(w["date"], 0) + w.get("amount_ml", 0)
    water_goal = user.get("daily_water_ml_goal") or 2000
    water_goal_days = sum(1 for v in by_date.values() if v >= water_goal)

    streak = await _compute_streak(uid)

    start_w = user.get("starting_weight_kg")
    latest = await db.weights.find({"user_id": uid}, {"_id": 0, "weight_kg": 1}).sort("date", -1).to_list(1)
    weight_loss = 0.0
    if start_w and latest:
        weight_loss = start_w - latest[0]["weight_kg"]

    unlocked: list[dict] = []
    for a in _ACHIEVEMENTS:
        cond = False
        aid = a["id"]
        if aid == "first_step":
            cond = True
        elif aid == "first_weight":
            cond = n_weights >= 1
        elif aid == "first_meal":
            cond = n_meals >= 1
        elif aid == "first_exercise":
            cond = n_exercises >= 1
        elif aid == "first_photo":
            cond = n_photos >= 1
        elif aid == "streak_3":
            cond = streak >= 3
        elif aid == "streak_7":
            cond = streak >= 7
        elif aid == "streak_30":
            cond = streak >= 30
        elif aid == "meals_10":
            cond = n_meals >= 10
        elif aid == "exercises_10":
            cond = n_exercises >= 10
        elif aid == "water_goal_5":
            cond = water_goal_days >= 5
        elif aid == "weight_loss_5kg":
            cond = weight_loss >= 5
        unlocked.append({**a, "unlocked": cond})

    xp = sum(a["xp"] for a in unlocked if a["unlocked"])
    level = int((xp / 50) ** 0.5) + 1
    next_level_xp = 50 * level * level
    prev_level_xp = 50 * (level - 1) * (level - 1)
    lvl_progress = (xp - prev_level_xp) / max(1, next_level_xp - prev_level_xp)

    return {
        "xp": xp,
        "level": level,
        "next_level_xp": next_level_xp,
        "level_progress_pct": round(lvl_progress * 100, 1),
        "streak": streak,
        "achievements": unlocked,
        "stats": {
            "weights": n_weights, "meals": n_meals, "exercises": n_exercises,
            "photos": n_photos, "water_goal_days": water_goal_days, "weight_loss_kg": round(weight_loss, 1),
        },
        "challenges": [
            {"id": "c_water", "title": "Hidratação em dia", "desc": "Bata a meta de água hoje", "reward_xp": 20,
             "done": by_date.get(today_iso(), 0) >= water_goal},
            {"id": "c_meal", "title": "3 refeições", "desc": "Registre 3 refeições hoje", "reward_xp": 25,
             "done": await db.meals.count_documents({"user_id": uid, "date": today_iso()}) >= 3},
            {"id": "c_move", "title": "Se mexa!", "desc": "20 min de exercício hoje", "reward_xp": 30,
             "done": bool(await db.exercises.find_one({"user_id": uid, "date": today_iso(), "duration_min": {"$gte": 20}}))},
        ],
    }


async def _compute_user_xp(uid: str) -> tuple[int, int, int]:
    n_w = await db.weights.count_documents({"user_id": uid})
    n_m = await db.meals.count_documents({"user_id": uid})
    n_e = await db.exercises.count_documents({"user_id": uid})
    n_p = await db.photos.count_documents({"user_id": uid})
    streak = await _compute_streak(uid)
    xp = 25
    if n_w >= 1: xp += 20
    if n_m >= 1: xp += 15
    if n_e >= 1: xp += 30
    if n_p >= 1: xp += 25
    if streak >= 3: xp += 40
    if streak >= 7: xp += 100
    if streak >= 30: xp += 300
    if n_m >= 10: xp += 50
    if n_e >= 10: xp += 60
    level = int((xp / 50) ** 0.5) + 1
    return xp, level, streak


@router.get("/gamification/leaderboard")
async def leaderboard(user: dict = Depends(current_user), limit: int = 20):
    users = await db.users.find(
        {}, {"_id": 0, "user_id": 1, "name": 1, "photo_base64": 1}
    ).to_list(300)
    entries: list[dict] = []
    for u in users:
        uid = u.get("user_id")
        if not uid:
            continue
        xp, level, streak = await _compute_user_xp(uid)
        entries.append({
            "user_id": uid,
            "name": u.get("name") or "Anônimo",
            "avatar": u.get("photo_base64"),
            "xp": xp,
            "level": level,
            "streak": streak,
            "is_me": uid == user["user_id"],
        })
    entries.sort(key=lambda e: (-e["xp"], -e["streak"]))
    for i, e in enumerate(entries):
        e["rank"] = i + 1
    my_rank = next((e["rank"] for e in entries if e["is_me"]), None)
    return {"items": entries[:limit], "my_rank": my_rank, "total_users": len(entries)}
