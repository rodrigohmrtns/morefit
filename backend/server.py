"""VitaTracker Backend – Health, Weight & Wellness Platform.

FastAPI + MongoDB + Emergent (Google Auth & LLM/Gemini).
"""
from __future__ import annotations

import base64
import io
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal, Optional

import bcrypt
import httpx
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "vitatracker")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev_secret")
JWT_ALG = "HS256"
JWT_EXP_DAYS = 30
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="VitaTracker API", version="1.0.0")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
log = logging.getLogger("vitatracker")


# -------------------- Utils --------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def today_iso() -> str:
    return now_utc().date().isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_jwt(user_id: str) -> str:
    payload = {"sub": user_id, "iat": int(now_utc().timestamp()),
               "exp": int((now_utc() + timedelta(days=JWT_EXP_DAYS)).timestamp())}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_jwt(token: str) -> Optional[str]:
    try:
        p = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return p.get("sub")
    except Exception:
        return None


async def resolve_user(token: str) -> Optional[dict]:
    if not token:
        return None
    # 1) JWT (email/senha)
    uid = decode_jwt(token)
    if uid:
        user = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
        if user:
            return user
    # 2) Emergent session token
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if session:
        exp = session.get("expires_at")
        if isinstance(exp, datetime):
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp > now_utc():
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
                if user:
                    return user
    return None


async def current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth.split(" ", 1)[1].strip() if auth.lower().startswith("bearer ") else ""
    user = await resolve_user(token)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Não autenticado")
    return user


# -------------------- Models --------------------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_token: str


class ProfileIn(BaseModel):
    name: Optional[str] = None
    gender: Optional[Literal["male", "female", "other"]] = None
    birth_date: Optional[str] = None  # ISO YYYY-MM-DD
    height_cm: Optional[float] = None
    starting_weight_kg: Optional[float] = None
    goal_weight_kg: Optional[float] = None
    activity_level: Optional[Literal["sedentary", "light", "moderate", "active", "very_active"]] = None
    goal: Optional[Literal["lose", "maintain", "gain", "improve_health"]] = None
    daily_calorie_goal: Optional[int] = None
    daily_water_ml_goal: Optional[int] = None
    daily_steps_goal: Optional[int] = None
    daily_sleep_hours_goal: Optional[float] = None
    target_date: Optional[str] = None  # ISO YYYY-MM-DD
    photo_base64: Optional[str] = None


class WeightIn(BaseModel):
    weight_kg: float
    date: Optional[str] = None
    time: Optional[str] = None  # HH:MM
    note: Optional[str] = None
    source: Optional[Literal["manual", "bluetooth"]] = "manual"
    body_fat_pct: Optional[float] = None
    muscle_mass_kg: Optional[float] = None
    body_water_pct: Optional[float] = None
    # Body measurements (Module 7)
    waist_cm: Optional[float] = None
    hip_cm: Optional[float] = None
    arm_cm: Optional[float] = None
    chest_cm: Optional[float] = None
    abdomen_cm: Optional[float] = None
    thigh_cm: Optional[float] = None
    calf_cm: Optional[float] = None
    neck_cm: Optional[float] = None
    shoulders_cm: Optional[float] = None


class MealIn(BaseModel):
    name: str
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"]
    calories: float
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    portion: Optional[str] = None
    image_base64: Optional[str] = None
    date: Optional[str] = None


class MealAnalyzeIn(BaseModel):
    image_base64: str
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"] = "snack"


class WaterIn(BaseModel):
    amount_ml: int
    date: Optional[str] = None


class ExerciseIn(BaseModel):
    name: str
    duration_min: int
    calories_burned: float
    intensity: Optional[Literal["low", "moderate", "high"]] = "moderate"
    date: Optional[str] = None


class SleepIn(BaseModel):
    hours: float
    quality: Optional[Literal["poor", "ok", "good", "great"]] = "good"
    date: Optional[str] = None


class MoodIn(BaseModel):
    mood: Literal["awful", "bad", "ok", "good", "great"]
    note: Optional[str] = None
    date: Optional[str] = None


# -------------------- Startup --------------------
@app.on_event("startup")
async def startup() -> None:
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    for coll in ("weights", "meals", "waters", "exercises", "sleeps", "moods"):
        await db[coll].create_index([("user_id", 1), ("date", -1)])
    log.info("VitaTracker DB indexes ready")


@app.on_event("shutdown")
async def shutdown() -> None:
    client.close()


# -------------------- Auth Routes --------------------
def _public_user(u: dict) -> dict:
    return {k: v for k, v in u.items() if k not in ("password_hash", "_id")}


@api.get("/")
async def root():
    return {"app": "VitaTracker", "status": "ok"}


@api.post("/auth/register")
async def register(payload: RegisterIn):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(400, "E-mail já cadastrado")
    user = {
        "user_id": new_id("user"),
        "email": payload.email.lower(),
        "name": payload.name,
        "password_hash": hash_password(payload.password),
        "avatar": None,
        "auth_provider": "email",
        "created_at": now_utc(),
        # profile defaults
        "gender": None, "birth_date": None, "height_cm": None,
        "starting_weight_kg": None, "goal_weight_kg": None,
        "activity_level": "moderate", "goal": "maintain",
        "daily_calorie_goal": 2000, "daily_water_ml_goal": 2000, "daily_steps_goal": 8000,
        "daily_sleep_hours_goal": 8.0,
        "target_date": None, "photo_base64": None,
        "onboarded": False,
    }
    await db.users.insert_one(user)
    return {"token": make_jwt(user["user_id"]), "user": _public_user(user)}


@api.post("/auth/login")
async def login(payload: LoginIn):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not user.get("password_hash") or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Credenciais inválidas")
    return {"token": make_jwt(user["user_id"]), "user": _public_user(user)}


@api.post("/auth/google-session")
async def google_session(payload: GoogleSessionIn):
    """Exchange Emergent session_token for a session, upserting the user."""
    async with httpx.AsyncClient(timeout=15) as http_client:
        r = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_token},
        )
    if r.status_code != 200:
        raise HTTPException(401, "Sessão Google inválida")
    data = r.json()
    email = data["email"].lower()
    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "user_id": new_id("user"),
            "email": email,
            "name": data.get("name") or email.split("@")[0],
            "password_hash": None,
            "avatar": data.get("picture"),
            "auth_provider": "google",
            "created_at": now_utc(),
            "gender": None, "birth_date": None, "height_cm": None,
            "starting_weight_kg": None, "goal_weight_kg": None,
            "activity_level": "moderate", "goal": "maintain",
            "daily_calorie_goal": 2000, "daily_water_ml_goal": 2000, "daily_steps_goal": 8000,
            "daily_sleep_hours_goal": 8.0,
            "target_date": None, "photo_base64": None,
            "onboarded": False,
        }
        await db.users.insert_one(user)
    # store session token so /auth/me works with the emergent token too
    await db.user_sessions.update_one(
        {"session_token": payload.session_token},
        {"$set": {
            "session_token": payload.session_token,
            "user_id": user["user_id"],
            "expires_at": now_utc() + timedelta(days=7),
            "created_at": now_utc(),
        }},
        upsert=True,
    )
    return {"token": payload.session_token, "user": _public_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return {"user": user}


@api.post("/auth/logout")
async def logout(request: Request, user: dict = Depends(current_user)):
    auth = request.headers.get("Authorization", "")
    token = auth.split(" ", 1)[1].strip() if auth.lower().startswith("bearer ") else ""
    await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# -------------------- Profile --------------------
@api.put("/profile")
async def update_profile(payload: ProfileIn, user: dict = Depends(current_user)):
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if updates:
        updates["onboarded"] = True
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"user": fresh}


# -------------------- Weight --------------------
@api.post("/weight")
async def add_weight(payload: WeightIn, user: dict = Depends(current_user)):
    d = payload.dict(exclude_none=False)
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


@api.get("/weight")
async def list_weight(user: dict = Depends(current_user), limit: int = 90):
    items = await db.weights.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).to_list(limit)
    return {"items": items}


@api.delete("/weight/{entry_id}")
async def delete_weight(entry_id: str, user: dict = Depends(current_user)):
    await db.weights.delete_one({"id": entry_id, "user_id": user["user_id"]})
    return {"ok": True}


# -------------------- Analytics (Module 5) --------------------
_METRIC_FIELDS = {
    "weight": "weight_kg",
    "bmi": None,  # derived
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
    """Return (slope, intercept) for y = mx + b. xs and ys equal length."""
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


@api.get("/analytics/weight")
async def analytics_weight(
    metric: str = "weight",
    period: str = "week",
    user: dict = Depends(current_user),
):
    """Return series + stats for the given metric+period.

    Metrics: weight | bmi | body_fat | muscle | water_pct | waist | hip
    Period:  day | week | month | year (window length in days).
    """
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
        "diff": None,
        "avg": None,
        "min": None,
        "max": None,
        "trend_per_week": None,
        "predicted_30d": None,
    }
    if values:
        stats["diff"] = round(values[-1] - values[0], 2)
        stats["avg"] = round(sum(values) / len(values), 2)
        stats["min"] = min(values)
        stats["max"] = max(values)
        if len(values) >= 2:
            xs = list(range(len(values)))
            slope, intercept = _linear_regression(xs, values)
            n = len(values)
            # slope is per-sample; approx per-day using unique dates span
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


@api.get("/analytics/compare")
async def analytics_compare(user: dict = Depends(current_user), period: str = "month"):
    """Return one entry per available metric for comparison charts."""
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


# -------------------- Food DB (Module 9) --------------------
_FOOD_DB: list[dict] = [
    {"id": "f_001", "name": "Arroz branco cozido", "unit": "100g", "calories": 130, "protein_g": 2.7, "carbs_g": 28, "fat_g": 0.3},
    {"id": "f_002", "name": "Feijão preto cozido", "unit": "100g", "calories": 132, "protein_g": 8.9, "carbs_g": 24, "fat_g": 0.5},
    {"id": "f_003", "name": "Peito de frango grelhado", "unit": "100g", "calories": 165, "protein_g": 31, "carbs_g": 0, "fat_g": 3.6},
    {"id": "f_004", "name": "Ovo cozido", "unit": "1 un (50g)", "calories": 77, "protein_g": 6.3, "carbs_g": 0.6, "fat_g": 5.3},
    {"id": "f_005", "name": "Pão francês", "unit": "1 un (50g)", "calories": 135, "protein_g": 4, "carbs_g": 27, "fat_g": 1.2},
    {"id": "f_006", "name": "Banana prata", "unit": "1 un (100g)", "calories": 89, "protein_g": 1.1, "carbs_g": 23, "fat_g": 0.3},
    {"id": "f_007", "name": "Maçã", "unit": "1 un (150g)", "calories": 78, "protein_g": 0.4, "carbs_g": 21, "fat_g": 0.3},
    {"id": "f_008", "name": "Leite integral", "unit": "200ml", "calories": 122, "protein_g": 6.4, "carbs_g": 9.6, "fat_g": 6.4},
    {"id": "f_009", "name": "Iogurte natural", "unit": "170g", "calories": 100, "protein_g": 10, "carbs_g": 12, "fat_g": 2.5},
    {"id": "f_010", "name": "Aveia em flocos", "unit": "30g", "calories": 117, "protein_g": 4.3, "carbs_g": 20, "fat_g": 2.1},
    {"id": "f_011", "name": "Batata doce cozida", "unit": "100g", "calories": 86, "protein_g": 1.6, "carbs_g": 20, "fat_g": 0.1},
    {"id": "f_012", "name": "Salada verde", "unit": "100g", "calories": 20, "protein_g": 1.5, "carbs_g": 3, "fat_g": 0.2},
    {"id": "f_013", "name": "Salmão grelhado", "unit": "100g", "calories": 208, "protein_g": 22, "carbs_g": 0, "fat_g": 13},
    {"id": "f_014", "name": "Café preto", "unit": "200ml", "calories": 2, "protein_g": 0.3, "carbs_g": 0, "fat_g": 0},
    {"id": "f_015", "name": "Whey Protein", "unit": "1 scoop (30g)", "calories": 120, "protein_g": 24, "carbs_g": 3, "fat_g": 1.5},
    {"id": "f_016", "name": "Abacate", "unit": "100g", "calories": 160, "protein_g": 2, "carbs_g": 9, "fat_g": 15},
    {"id": "f_017", "name": "Amêndoas", "unit": "30g", "calories": 174, "protein_g": 6.4, "carbs_g": 6, "fat_g": 15},
    {"id": "f_018", "name": "Pizza mussarela", "unit": "1 fatia (100g)", "calories": 266, "protein_g": 11, "carbs_g": 33, "fat_g": 10},
    {"id": "f_019", "name": "Coxinha de frango", "unit": "1 un (80g)", "calories": 265, "protein_g": 9, "carbs_g": 25, "fat_g": 15},
    {"id": "f_020", "name": "Açaí na tigela", "unit": "300g", "calories": 350, "protein_g": 4, "carbs_g": 55, "fat_g": 12},
]


@api.get("/foods/search")
async def food_search(q: str = "", limit: int = 20, user: dict = Depends(current_user)):
    ql = (q or "").strip().lower()
    if not ql:
        return {"items": _FOOD_DB[:limit]}
    matches = [f for f in _FOOD_DB if ql in f["name"].lower()]
    return {"items": matches[:limit]}


@api.get("/foods/barcode/{code}")
async def food_barcode(code: str, user: dict = Depends(current_user)):
    """Lookup food by barcode using OpenFoodFacts (public free API)."""
    async with httpx.AsyncClient(timeout=10) as http_client:
        try:
            r = await http_client.get(f"https://world.openfoodfacts.org/api/v2/product/{code}.json")
        except Exception as e:
            raise HTTPException(502, f"Falha na busca: {e}")
    if r.status_code != 200:
        raise HTTPException(404, "Produto não encontrado")
    data = r.json()
    if data.get("status") != 1 or not data.get("product"):
        raise HTTPException(404, "Produto não encontrado")
    p = data["product"]
    nutriments = p.get("nutriments", {}) or {}

    def n(key: str) -> float:
        try:
            return float(nutriments.get(key) or 0)
        except Exception:
            return 0.0

    name = p.get("product_name_pt") or p.get("product_name") or "Sem nome"
    brand = p.get("brands") or ""
    kcal = n("energy-kcal_100g") or (n("energy_100g") / 4.184)
    return {
        "id": f"barcode_{code}",
        "name": f"{name}{(' — ' + brand) if brand else ''}",
        "unit": "100g",
        "barcode": code,
        "calories": round(kcal),
        "protein_g": round(n("proteins_100g"), 1),
        "carbs_g": round(n("carbohydrates_100g"), 1),
        "fat_g": round(n("fat_100g"), 1),
        "image": p.get("image_small_url") or p.get("image_url"),
    }


class FoodFavIn(BaseModel):
    name: str
    unit: Optional[str] = None
    calories: float
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    source_id: Optional[str] = None


@api.post("/foods/favorites")
async def add_favorite(payload: FoodFavIn, user: dict = Depends(current_user)):
    entry = payload.dict()
    entry.update({
        "id": new_id("fav"), "user_id": user["user_id"],
        "created_at": now_utc().isoformat(),
    })
    await db.food_favorites.insert_one(entry)
    return {k: v for k, v in entry.items() if k != "_id"}


@api.get("/foods/favorites")
async def list_favorites(user: dict = Depends(current_user)):
    items = await db.food_favorites.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"items": items}


@api.delete("/foods/favorites/{fav_id}")
async def del_favorite(fav_id: str, user: dict = Depends(current_user)):
    await db.food_favorites.delete_one({"id": fav_id, "user_id": user["user_id"]})
    return {"ok": True}


# -------------------- Fasting (Module 10) --------------------
FastProtocol = Literal["16:8", "18:6", "20:4", "OMAD", "custom"]
_PROTOCOL_HOURS: dict[str, int] = {"16:8": 16, "18:6": 18, "20:4": 20, "OMAD": 23, "custom": 16}


class FastStartIn(BaseModel):
    protocol: FastProtocol = "16:8"
    target_hours: Optional[float] = None
    note: Optional[str] = None


@api.get("/fasting/current")
async def current_fast(user: dict = Depends(current_user)):
    active = await db.fasts.find_one(
        {"user_id": user["user_id"], "ended_at": None},
        {"_id": 0},
    )
    return {"active": active}


@api.post("/fasting/start")
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


@api.post("/fasting/stop")
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


@api.get("/fasting")
async def list_fasts(user: dict = Depends(current_user), limit: int = 50):
    items = await db.fasts.find({"user_id": user["user_id"], "ended_at": {"$ne": None}}, {"_id": 0})\
        .sort("started_at", -1).to_list(limit)
    return {"items": items}


@api.delete("/fasting/{fast_id}")
async def delete_fast(fast_id: str, user: dict = Depends(current_user)):
    await db.fasts.delete_one({"id": fast_id, "user_id": user["user_id"]})
    return {"ok": True}


# -------------------- Photo comparison (Module 6) --------------------
class PhotoCompareIn(BaseModel):
    photo_id_before: str
    photo_id_after: str


@api.post("/photos/compare")
async def compare_photos(payload: PhotoCompareIn, user: dict = Depends(current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY não configurada")
    before = await db.photos.find_one({"id": payload.photo_id_before, "user_id": user["user_id"]}, {"_id": 0})
    after = await db.photos.find_one({"id": payload.photo_id_after, "user_id": user["user_id"]}, {"_id": 0})
    if not before or not after:
        raise HTTPException(404, "Fotos não encontradas")
    try:
        from emergentintegrations.llm.chat import ImageContent, LlmChat, UserMessage
    except Exception as e:
        raise HTTPException(500, f"IA indisponível: {e}")

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"compare_{user['user_id']}_{uuid.uuid4().hex[:8]}",
        system_message=(
            "Você é uma analista de composição corporal. Compare as duas fotos (a primeira é 'antes' e "
            "a segunda é 'depois') e responda APENAS um JSON no formato: "
            '{"progress_score": 0-100, "changes": ["lista de mudanças observadas"], '
            '"encouragement": "texto motivacional curto em pt-BR", '
            '"summary": "resumo em uma frase em pt-BR"}. '
            "Nunca inclua texto fora do JSON. Seja gentil e realista."
        ),
    ).with_model("gemini", "gemini-2.5-flash")

    msg = UserMessage(
        text="Compare a foto ANTES (primeira) com a foto DEPOIS (segunda). Retorne apenas o JSON.",
        file_contents=[
            ImageContent(image_base64=before["image_base64"]),
            ImageContent(image_base64=after["image_base64"]),
        ],
    )
    try:
        resp = await chat.send_message(msg)
    except Exception as e:
        log.error("Gemini compare error: %s", e)
        raise HTTPException(502, f"Falha ao comparar: {e}")
    data = _extract_json(resp or "")
    if not data:
        raise HTTPException(422, "Não foi possível interpretar a análise")
    return {
        "analysis": data,
        "before": {"id": before["id"], "date": before["date"]},
        "after": {"id": after["id"], "date": after["date"]},
    }



# -------------------- Meals --------------------
@api.post("/meals")
async def add_meal(payload: MealIn, user: dict = Depends(current_user)):
    entry = payload.dict()
    entry.update({
        "id": new_id("meal"),
        "user_id": user["user_id"],
        "date": payload.date or today_iso(),
        "created_at": now_utc().isoformat(),
    })
    await db.meals.insert_one(entry)
    return {k: v for k, v in entry.items() if k != "_id"}


@api.get("/meals")
async def list_meals(user: dict = Depends(current_user), date: Optional[str] = None):
    q = {"user_id": user["user_id"]}
    if date:
        q["date"] = date
    items = await db.meals.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"items": items}


@api.delete("/meals/{meal_id}")
async def delete_meal(meal_id: str, user: dict = Depends(current_user)):
    await db.meals.delete_one({"id": meal_id, "user_id": user["user_id"]})
    return {"ok": True}


def _extract_json(text: str) -> dict:
    """Best-effort JSON extraction from LLM text."""
    import json
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except Exception:
        return {}


@api.post("/meals/analyze")
async def analyze_meal(payload: MealAnalyzeIn, user: dict = Depends(current_user)):
    """Analyze meal photo with Gemini and return macros."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY não configurada")
    try:
        from emergentintegrations.llm.chat import ImageContent, LlmChat, UserMessage
    except Exception as e:
        raise HTTPException(500, f"IA indisponível: {e}")

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"meal_{user['user_id']}_{uuid.uuid4().hex[:8]}",
        system_message=(
            "Você é uma nutricionista especialista. Analise fotos de refeição e retorne "
            "APENAS um JSON válido no formato: "
            '{"name":"nome curto do prato","portion":"porção estimada","calories":N,'
            '"protein_g":N,"carbs_g":N,"fat_g":N,"confidence":0-1,"tips":"dica curta em pt-BR"}. '
            "Nunca inclua texto fora do JSON."
        ),
    ).with_model("gemini", "gemini-2.5-flash")

    img = ImageContent(image_base64=payload.image_base64)
    msg = UserMessage(
        text="Analise a refeição na foto e retorne apenas o JSON solicitado.",
        file_contents=[img],
    )
    try:
        response = await chat.send_message(msg)
    except Exception as e:
        log.error("Gemini error: %s", e)
        raise HTTPException(502, f"Falha ao analisar imagem: {e}")

    data = _extract_json(response or "")
    if not data or "calories" not in data:
        raise HTTPException(422, "Não foi possível interpretar a refeição")
    return {"analysis": data}


# -------------------- Water --------------------
@api.post("/water")
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


@api.get("/water")
async def list_water(user: dict = Depends(current_user), date: Optional[str] = None):
    q = {"user_id": user["user_id"]}
    if date:
        q["date"] = date
    items = await db.waters.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    total = sum(i.get("amount_ml", 0) for i in items)
    return {"items": items, "total_ml": total}


# -------------------- Exercise --------------------
@api.post("/exercises")
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


@api.get("/exercises")
async def list_exercises(user: dict = Depends(current_user), date: Optional[str] = None):
    q = {"user_id": user["user_id"]}
    if date:
        q["date"] = date
    items = await db.exercises.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"items": items}


# -------------------- Sleep --------------------
@api.post("/sleep")
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


@api.get("/sleep")
async def list_sleep(user: dict = Depends(current_user)):
    items = await db.sleeps.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).to_list(60)
    return {"items": items}


# -------------------- Mood --------------------
@api.post("/mood")
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


@api.get("/mood")
async def list_mood(user: dict = Depends(current_user)):
    items = await db.moods.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).to_list(60)
    return {"items": items}


# -------------------- Dashboard --------------------
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


@api.get("/motivation")
async def motivation(user: dict = Depends(current_user)):
    # Deterministic per-day quote to feel consistent
    idx = (hash(user["user_id"] + today_iso()) % len(QUOTES_PT))
    return {"quote": QUOTES_PT[abs(idx)]}


class ProgressPhotoIn(BaseModel):
    image_base64: str
    weight_kg: Optional[float] = None
    note: Optional[str] = None
    date: Optional[str] = None


@api.post("/photos")
async def add_photo(payload: ProgressPhotoIn, user: dict = Depends(current_user)):
    entry = {
        "id": new_id("ph"),
        "user_id": user["user_id"],
        "image_base64": payload.image_base64,
        "weight_kg": payload.weight_kg,
        "note": payload.note,
        "date": payload.date or today_iso(),
        "created_at": now_utc().isoformat(),
    }
    await db.photos.insert_one(entry)
    return {k: v for k, v in entry.items() if k != "_id"}


@api.get("/photos")
async def list_photos(user: dict = Depends(current_user)):
    items = await db.photos.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).to_list(30)
    return {"items": items}


@api.delete("/photos/{photo_id}")
async def delete_photo(photo_id: str, user: dict = Depends(current_user)):
    await db.photos.delete_one({"id": photo_id, "user_id": user["user_id"]})
    return {"ok": True}


class StepsIn(BaseModel):
    steps: int
    date: Optional[str] = None


@api.post("/steps")
async def add_steps(payload: StepsIn, user: dict = Depends(current_user)):
    date = payload.date or today_iso()
    await db.steps.update_one(
        {"user_id": user["user_id"], "date": date},
        {"$set": {"steps": payload.steps, "user_id": user["user_id"], "date": date, "updated_at": now_utc().isoformat()}},
        upsert=True,
    )
    return {"steps": payload.steps, "date": date}


@api.get("/dashboard/summary")
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


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
