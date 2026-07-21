"""VitaTracker Backend – Health, Weight & Wellness Platform.

FastAPI + MongoDB + Emergent (Google Auth & LLM/Gemini).

NOTE: Legacy monolith kept for existing endpoints. New modules follow a
router/service/repository split under `/app/backend/{routers,services,repositories,core,middleware}/`.
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
from fastapi import APIRouter, Body, Depends, FastAPI, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.cors import CORSMiddleware

# --- Shared core / new-module routers ---
from core.config import settings as core_settings  # noqa: F401 — ensures env loaded once
from middleware.security import (
    SecurityHeadersMiddleware,
    auth_rate_limit,
    billing_rate_limit,
    limiter,
    register_rate_limit,
)
from routers.lgpd import router as lgpd_router
from services.audit_service import audit_service

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "vitatracker")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev_secret")
JWT_ALG = "HS256"
JWT_EXP_DAYS = 30
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="VitaTracker API", version="1.4.0")
api = APIRouter(prefix="/api")

# Rate limiting + security headers
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SecurityHeadersMiddleware)

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
    time: Optional[str] = None
    note: Optional[str] = None
    source: Optional[Literal["manual", "bluetooth"]] = "manual"
    body_fat_pct: Optional[float] = None
    muscle_mass_kg: Optional[float] = None
    body_water_pct: Optional[float] = None
    # Composição corporal completa (Módulo 14)
    protein_pct: Optional[float] = None
    lean_mass_kg: Optional[float] = None
    bone_mass_kg: Optional[float] = None
    visceral_fat: Optional[float] = None
    bmr_kcal: Optional[int] = None
    metabolic_age: Optional[int] = None
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
    category: Optional[Literal["gym", "running", "bike", "walking", "swimming", "crossfit", "pilates", "yoga", "custom"]] = "custom"
    duration_min: int
    calories_burned: float
    intensity: Optional[Literal["low", "moderate", "high"]] = "moderate"
    note: Optional[str] = None
    date: Optional[str] = None


class SleepIn(BaseModel):
    hours: float
    quality: Optional[Literal["poor", "ok", "good", "great"]] = "good"
    rem_hours: Optional[float] = None
    deep_hours: Optional[float] = None
    light_hours: Optional[float] = None
    bedtime: Optional[str] = None  # HH:MM
    wake_time: Optional[str] = None
    note: Optional[str] = None
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
    # Módulo 21 — Empresas
    await db.companies.create_index("id", unique=True)
    await db.companies.create_index("code", unique=True)
    await db.company_members.create_index([("company_id", 1), ("user_id", 1)], unique=True)
    await db.company_members.create_index("user_id")
    await db.campaigns.create_index([("company_id", 1), ("start_date", -1)])
    await db.campaign_participations.create_index([("campaign_id", 1), ("user_id", 1)], unique=True)
    # Fase 3 — Segurança & LGPD
    await db.audit_logs.create_index([("user_id", 1), ("timestamp", -1)])
    await db.audit_logs.create_index("event_type")
    await db.audit_logs.create_index("timestamp")
    log.info("VitaTracker DB indexes ready")


@app.on_event("shutdown")
async def shutdown() -> None:
    client.close()


# -------------------- Auth Routes --------------------
def _is_premium(u: dict) -> bool:
    exp = u.get("premium_expires_at")
    if not exp:
        return False
    try:
        if isinstance(exp, str):
            exp_dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
        else:
            exp_dt = exp
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=timezone.utc)
        return exp_dt > now_utc()
    except Exception:
        return False


def _public_user(u: dict) -> dict:
    out = {k: v for k, v in u.items() if k not in ("password_hash", "_id")}
    out["is_premium"] = _is_premium(u)
    return out


async def require_premium(user: dict = Depends(current_user)) -> dict:
    """FastAPI dependency: reject non-premium users with HTTP 402."""
    if not _is_premium(user):
        raise HTTPException(402, "Recurso Premium — atualize seu plano para continuar")
    return user


@api.get("/")
async def root():
    return {"app": "VitaTracker", "status": "ok"}


@api.post("/auth/register")
async def register(payload: RegisterIn, request: Request, _rl: None = Depends(register_rate_limit)):
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
    await audit_service.log_event(event_type="auth.register", user=user, request=request)
    return {"token": make_jwt(user["user_id"]), "user": _public_user(user)}


@api.post("/auth/login")
async def login(payload: LoginIn, request: Request, _rl: None = Depends(auth_rate_limit)):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not user.get("password_hash") or not verify_password(payload.password, user["password_hash"]):
        await audit_service.log_event(
            event_type="auth.login_failed", request=request,
            metadata={"email": payload.email.lower()}, severity="warn",
        )
        raise HTTPException(401, "Credenciais inválidas")
    if user.get("deleted_at"):
        raise HTTPException(403, "Conta excluída")
    await audit_service.log_event(event_type="auth.login", user=user, request=request)
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
    return {"user": _public_user(user)}


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
async def compare_photos(payload: PhotoCompareIn, user: dict = Depends(require_premium)):
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
async def analyze_meal(payload: MealAnalyzeIn, user: dict = Depends(require_premium)):
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


# ==================== Módulo 16: Gamificação ====================
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
    """Consecutive days (up to today) with at least one log in weights/meals/waters/exercises."""
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
                continue  # today may be empty; count backward
            break
    return streak


@api.get("/gamification")
async def gamification(user: dict = Depends(current_user)):
    uid = user["user_id"]
    n_weights = await db.weights.count_documents({"user_id": uid})
    n_meals = await db.meals.count_documents({"user_id": uid})
    n_exercises = await db.exercises.count_documents({"user_id": uid})
    n_photos = await db.photos.count_documents({"user_id": uid})
    # water goal days
    all_waters = await db.waters.find({"user_id": uid}, {"_id": 0, "date": 1, "amount_ml": 1}).to_list(2000)
    by_date: dict[str, int] = {}
    for w in all_waters:
        by_date[w["date"]] = by_date.get(w["date"], 0) + w.get("amount_ml", 0)
    water_goal = user.get("daily_water_ml_goal") or 2000
    water_goal_days = sum(1 for v in by_date.values() if v >= water_goal)

    streak = await _compute_streak(uid)

    # Weight loss
    start_w = user.get("starting_weight_kg")
    latest = await db.weights.find({"user_id": uid}, {"_id": 0, "weight_kg": 1}).sort("date", -1).to_list(1)
    weight_loss = 0.0
    if start_w and latest:
        weight_loss = start_w - latest[0]["weight_kg"]

    unlocked: list[dict] = []
    for a in _ACHIEVEMENTS:
        cond = False
        aid = a["id"]
        if aid == "first_step": cond = True  # user exists
        elif aid == "first_weight": cond = n_weights >= 1
        elif aid == "first_meal": cond = n_meals >= 1
        elif aid == "first_exercise": cond = n_exercises >= 1
        elif aid == "first_photo": cond = n_photos >= 1
        elif aid == "streak_3": cond = streak >= 3
        elif aid == "streak_7": cond = streak >= 7
        elif aid == "streak_30": cond = streak >= 30
        elif aid == "meals_10": cond = n_meals >= 10
        elif aid == "exercises_10": cond = n_exercises >= 10
        elif aid == "water_goal_5": cond = water_goal_days >= 5
        elif aid == "weight_loss_5kg": cond = weight_loss >= 5
        unlocked.append({**a, "unlocked": cond})

    xp = sum(a["xp"] for a in unlocked if a["unlocked"])
    # Level curve: level = floor(sqrt(xp/50)) + 1, next req = 50 * level^2
    level = int((xp / 50) ** 0.5) + 1
    next_level_xp = 50 * level * level
    prev_level_xp = 50 * (level - 1) * (level - 1)
    lvl_progress = (xp - prev_level_xp) / max(1, next_level_xp - prev_level_xp)

    # Simple leaderboard: users with most achievements unlocked (self-scoped for demo — top 5)
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
    """Return (xp, level, streak) for a given user id — used for leaderboard."""
    n_w = await db.weights.count_documents({"user_id": uid})
    n_m = await db.meals.count_documents({"user_id": uid})
    n_e = await db.exercises.count_documents({"user_id": uid})
    n_p = await db.photos.count_documents({"user_id": uid})
    streak = await _compute_streak(uid)
    xp = 25  # first_step (registered)
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


@api.get("/gamification/leaderboard")
async def leaderboard(user: dict = Depends(current_user), limit: int = 20):
    """Global ranking by XP — computed on-the-fly (fine for demo scale)."""
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


# ==================== Módulo 17: Comunidade ====================
class PostIn(BaseModel):
    text: str
    kind: Optional[Literal["update", "recipe", "workout", "photo"]] = "update"
    image_base64: Optional[str] = None


class CommentIn(BaseModel):
    text: str


@api.post("/community/posts")
async def create_post(payload: PostIn, user: dict = Depends(current_user)):
    post = {
        "id": new_id("post"),
        "user_id": user["user_id"],
        "author_name": user.get("name") or "Anônimo",
        "author_avatar": user.get("photo_base64"),
        "text": payload.text.strip(),
        "kind": payload.kind or "update",
        "image_base64": payload.image_base64,
        "likes": [],
        "comments_count": 0,
        "created_at": now_utc().isoformat(),
    }
    if not post["text"] and not post["image_base64"]:
        raise HTTPException(400, "Post vazio")
    await db.posts.insert_one(post)
    return {k: v for k, v in post.items() if k != "_id"}


@api.get("/community/posts")
async def list_posts(kind: Optional[str] = None, limit: int = 30):
    q: dict = {}
    if kind and kind != "all":
        q["kind"] = kind
    items = await db.posts.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"items": items}


@api.post("/community/posts/{post_id}/like")
async def toggle_like(post_id: str, user: dict = Depends(current_user)):
    p = await db.posts.find_one({"id": post_id}, {"_id": 0, "likes": 1})
    if not p:
        raise HTTPException(404, "Post não encontrado")
    likes = p.get("likes") or []
    uid = user["user_id"]
    if uid in likes:
        await db.posts.update_one({"id": post_id}, {"$pull": {"likes": uid}})
        return {"liked": False, "count": len(likes) - 1}
    await db.posts.update_one({"id": post_id}, {"$addToSet": {"likes": uid}})
    return {"liked": True, "count": len(likes) + 1}


@api.post("/community/posts/{post_id}/comments")
async def add_comment(post_id: str, payload: CommentIn, user: dict = Depends(current_user)):
    txt = payload.text.strip()
    if not txt: raise HTTPException(400, "Comentário vazio")
    c = {
        "id": new_id("cmt"),
        "post_id": post_id,
        "user_id": user["user_id"],
        "author_name": user.get("name") or "Anônimo",
        "text": txt,
        "created_at": now_utc().isoformat(),
    }
    await db.comments.insert_one(c)
    await db.posts.update_one({"id": post_id}, {"$inc": {"comments_count": 1}})
    return {k: v for k, v in c.items() if k != "_id"}


@api.get("/community/posts/{post_id}/comments")
async def list_comments(post_id: str):
    items = await db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return {"items": items}


@api.delete("/community/posts/{post_id}")
async def delete_post(post_id: str, user: dict = Depends(current_user)):
    await db.posts.delete_one({"id": post_id, "user_id": user["user_id"]})
    await db.comments.delete_many({"post_id": post_id})
    return {"ok": True}


# ==================== Módulos 18-20: Profissionais & Compartilhamento ====================
class ShareIn(BaseModel):
    professional_type: Literal["nutritionist", "personal", "doctor"]
    professional_name: Optional[str] = None
    professional_email: Optional[str] = None


@api.post("/professionals/share")
async def create_share(payload: ShareIn, user: dict = Depends(require_premium)):
    token = uuid.uuid4().hex[:20]
    entry = {
        "id": new_id("share"),
        "token": token,
        "user_id": user["user_id"],
        "professional_type": payload.professional_type,
        "professional_name": payload.professional_name,
        "professional_email": payload.professional_email,
        "created_at": now_utc().isoformat(),
        "expires_at": (now_utc() + timedelta(days=30)).isoformat(),
    }
    await db.shares.insert_one(entry)
    # NOTE: share_url is served via /api/* (K8s ingress only forwards /api paths to backend)
    return {**{k: v for k, v in entry.items() if k != "_id"}, "share_url": f"/api/reports/public/{token}"}


@api.get("/professionals/shares")
async def list_shares(user: dict = Depends(current_user)):
    items = await db.shares.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"items": items}


@api.delete("/professionals/shares/{share_id}")
async def revoke_share(share_id: str, user: dict = Depends(current_user)):
    await db.shares.delete_one({"id": share_id, "user_id": user["user_id"]})
    return {"ok": True}


async def _build_report_data(uid: str) -> dict:
    user = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
    if not user:
        return {}
    weights = await db.weights.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(30)
    meals = await db.meals.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(50)
    exercises = await db.exercises.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(30)
    sleeps = await db.sleeps.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(14)
    return {"user": user, "weights": weights, "meals": meals, "exercises": exercises, "sleeps": sleeps}


@app.get("/report/{token}", include_in_schema=False)
async def public_report_legacy(token: str):
    """Legacy path kept for backward compat — delegates to /api/reports/public/{token}."""
    return await public_report(token)


@api.get("/reports/public/{token}", include_in_schema=False)
async def public_report(token: str):
    from fastapi.responses import HTMLResponse
    share = await db.shares.find_one({"token": token}, {"_id": 0})
    if not share:
        return HTMLResponse("<h1>Relatório não encontrado</h1>", status_code=404)
    data = await _build_report_data(share["user_id"])
    if not data:
        return HTMLResponse("<h1>Sem dados</h1>", status_code=404)
    u = data["user"]
    latest_w = data["weights"][0]["weight_kg"] if data["weights"] else "—"
    height = u.get("height_cm") or 0
    bmi = round(data["weights"][0]["weight_kg"] / ((height / 100) ** 2), 1) if data["weights"] and height else "—"
    ptype = share.get("professional_type") or "doctor"
    # Determine visible sections by professional profile:
    # nutritionist -> peso + refeições
    # personal     -> peso + medidas + exercícios
    # doctor       -> tudo (peso, medidas, refeições, exercícios, sono)
    show_weights = True
    show_meals = ptype in ("nutritionist", "doctor")
    show_exercises = ptype in ("personal", "doctor")
    show_sleep = ptype == "doctor"
    ptype_label = {"nutritionist": "Nutricionista", "personal": "Personal Trainer", "doctor": "Médico"}.get(ptype, ptype)

    def rows(items: list, tds: list[str]) -> str:
        out = []
        for it in items:
            cells = "".join(f"<td>{it.get(k, '') if it.get(k) is not None else ''}</td>" for k in tds)
            out.append(f"<tr>{cells}</tr>")
        return "\n".join(out)

    section_weights = f"""
  <h2>Evolução do peso (últimos 30 registros)</h2>
  <table><thead><tr><th>Data</th><th>Peso (kg)</th><th>Cintura</th><th>Quadril</th><th>Gordura %</th></tr></thead>
    <tbody>{rows(data['weights'], ['date','weight_kg','waist_cm','hip_cm','body_fat_pct'])}</tbody></table>""" if show_weights else ""
    section_meals = f"""
  <h2>Refeições recentes</h2>
  <table><thead><tr><th>Data</th><th>Refeição</th><th>Nome</th><th>Kcal</th><th>P</th><th>C</th><th>G</th></tr></thead>
    <tbody>{rows(data['meals'][:20], ['date','meal_type','name','calories','protein_g','carbs_g','fat_g'])}</tbody></table>""" if show_meals else ""
    section_exercises = f"""
  <h2>Exercícios</h2>
  <table><thead><tr><th>Data</th><th>Nome</th><th>Categoria</th><th>Min</th><th>Kcal</th></tr></thead>
    <tbody>{rows(data['exercises'][:20], ['date','name','category','duration_min','calories_burned'])}</tbody></table>""" if show_exercises else ""
    section_sleep = f"""
  <h2>Sono</h2>
  <table><thead><tr><th>Data</th><th>Horas</th><th>Qualidade</th></tr></thead>
    <tbody>{rows(data['sleeps'], ['date','hours','quality'])}</tbody></table>""" if show_sleep else ""

    html = f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório VitaTracker — {u.get('name', 'Usuário')}</title>
<style>
:root {{ color-scheme: light; }}
body {{ font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#0F1110; background:#F5F6F4; margin:0; padding:24px; }}
.wrap {{ max-width: 780px; margin: 0 auto; background:#fff; border-radius:16px; padding:32px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }}
h1 {{ margin:0 0 4px 0; font-size:26px; letter-spacing:-0.5px; }}
.sub {{ color:#83877F; font-size:13px; margin-bottom:24px; }}
.hero {{ background:#0E100F; color:#F5F6F4; border-radius:16px; padding:20px; margin-bottom:24px; display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }}
.hero div span {{ display:block; font-size:12px; opacity:.7; }}
.hero div strong {{ display:block; font-size:22px; font-weight:700; color:#C6F14B; margin-top:2px; }}
h2 {{ margin: 24px 0 12px; font-size:16px; color:#26301A; }}
table {{ width:100%; border-collapse:collapse; font-size:13px; }}
th, td {{ text-align:left; padding:8px 10px; border-bottom:1px solid #EDEFEB; }}
th {{ font-weight:600; color:#83877F; text-transform:uppercase; letter-spacing:.5px; font-size:11px; }}
.badge {{ display:inline-block; padding:4px 10px; border-radius:99px; background:#C6F14B; color:#26301A; font-weight:700; font-size:11px; margin-left:8px; }}
.foot {{ margin-top:24px; padding-top:16px; border-top:1px solid #EDEFEB; color:#83877F; font-size:12px; }}
@media print {{ body {{ background:#fff; padding:0; }} .wrap {{ box-shadow:none; }} }}
</style></head><body>
<div class="wrap">
  <h1>Relatório de Saúde <span class="badge">{ptype_label}</span></h1>
  <div class="sub">Paciente: <strong>{u.get('name','')}</strong> • {u.get('email','')} • Gerado em {now_utc().strftime('%d/%m/%Y')}</div>
  <div class="hero">
    <div><span>Peso atual</span><strong>{latest_w} kg</strong></div>
    <div><span>IMC</span><strong>{bmi}</strong></div>
    <div><span>Altura</span><strong>{u.get('height_cm','—')} cm</strong></div>
    <div><span>Objetivo</span><strong style="font-size:14px;">{u.get('goal','—')}</strong></div>
  </div>
  {section_weights}
  {section_meals}
  {section_exercises}
  {section_sleep}
  <div class="foot">Relatório gerado por VitaTracker — Este documento contém dados sensíveis. Compartilhamento válido por 30 dias.</div>
</div></body></html>"""
    return HTMLResponse(html)


@api.get("/report/pdf")
async def report_pdf(user: dict = Depends(require_premium), type: Optional[str] = "all"):
    """Generates a PDF summary of user data. `type` filters sections:
    all | nutritionist | personal | doctor. Returns application/pdf.
    """
    from fastapi.responses import Response
    from fpdf import FPDF

    data = await _build_report_data(user["user_id"])
    if not data:
        raise HTTPException(404, "Sem dados")
    u = data["user"]
    latest_w = data["weights"][0]["weight_kg"] if data["weights"] else None
    height = u.get("height_cm") or 0
    bmi = round(latest_w / ((height / 100) ** 2), 1) if latest_w and height else None

    ptype = (type or "all").lower()
    if ptype not in ("all", "nutritionist", "personal", "doctor"):
        ptype = "all"
    show_weights = True
    show_meals = ptype in ("all", "nutritionist", "doctor")
    show_exercises = ptype in ("all", "personal", "doctor")
    show_sleep = ptype in ("all", "doctor")
    ptype_label = {"all": "Completo", "nutritionist": "Nutricionista",
                   "personal": "Personal Trainer", "doctor": "Medico"}[ptype]

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(38, 48, 26)
    pdf.cell(0, 10, f"VitaTracker - Relatorio ({ptype_label})", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 6, f"Paciente: {u.get('name','')} - {u.get('email','')}", ln=True)
    pdf.cell(0, 6, f"Gerado em: {now_utc().strftime('%d/%m/%Y')}", ln=True)
    pdf.ln(6)

    # Hero stats
    pdf.set_fill_color(14, 16, 15)
    pdf.set_text_color(198, 241, 75)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 12, f"  Peso: {latest_w or '-'} kg  |  IMC: {bmi or '-'}  |  Altura: {u.get('height_cm','-')} cm  |  Objetivo: {u.get('goal','-')}",
             ln=True, fill=True)
    pdf.ln(6)

    def section(title: str, rows: list[list[str]], headers: list[str], widths: list[int]):
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(38, 48, 26)
        pdf.cell(0, 8, title, ln=True)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(120, 120, 120)
        for h, w in zip(headers, widths):
            pdf.cell(w, 6, h, border="B")
        pdf.ln(6)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(30, 30, 30)
        for r in rows:
            for cell, w in zip(r, widths):
                pdf.cell(w, 5, str(cell)[:22], border=0)
            pdf.ln(5)
        pdf.ln(4)

    if show_weights:
        section("Evolucao do peso",
                [[w.get("date", ""), w.get("weight_kg", ""), w.get("body_fat_pct") or "-"] for w in data["weights"][:15]],
                ["Data", "Peso (kg)", "Gordura %"], [40, 40, 40])
    if show_meals:
        section("Refeicoes recentes",
                [[m.get("date", ""), m.get("name", ""), m.get("calories", "")] for m in data["meals"][:15]],
                ["Data", "Refeicao", "Kcal"], [30, 90, 30])
    if show_exercises:
        section("Exercicios",
                [[e.get("date", ""), e.get("name", ""), e.get("duration_min", ""), e.get("calories_burned", "")]
                 for e in data["exercises"][:15]],
                ["Data", "Exercicio", "Min", "Kcal"], [30, 70, 25, 30])
    if show_sleep:
        section("Sono",
                [[s.get("date", ""), s.get("hours", ""), s.get("quality", "")] for s in data["sleeps"][:10]],
                ["Data", "Horas", "Qualidade"], [40, 30, 40])

    pdf_bytes = bytes(pdf.output())
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="vitatracker-{ptype}-{u.get("name","user").replace(" ", "_")}.pdf"'},
    )




# -------------------- Steps history (Module 13) --------------------
@api.get("/steps")
async def list_steps(user: dict = Depends(current_user), days: int = 30):
    cutoff = (now_utc().date() - timedelta(days=days)).isoformat()
    items = await db.steps.find(
        {"user_id": user["user_id"], "date": {"$gte": cutoff}}, {"_id": 0},
    ).sort("date", -1).to_list(days)
    total = sum(x.get("steps", 0) for x in items)
    avg = round(total / max(1, len(items))) if items else 0
    return {"items": items, "total": total, "avg": avg, "goal": user.get("daily_steps_goal") or 8000}


# -------------------- IA Coach (Module 15) --------------------
class CoachMsgIn(BaseModel):
    message: str
    session_id: Optional[str] = None


async def _build_user_context(user: dict) -> str:
    """Build a compact context string for the coach LLM."""
    uid = user["user_id"]
    weights = await db.weights.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(7)
    meals = await db.meals.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(20)
    exercises = await db.exercises.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(10)
    sleeps = await db.sleeps.find({"user_id": uid}, {"_id": 0}).sort("date", -1).to_list(7)
    waters_today = await db.waters.find({"user_id": uid, "date": today_iso()}, {"_id": 0}).to_list(100)
    water_today_ml = sum(w.get("amount_ml", 0) for w in waters_today)

    lines: list[str] = []
    lines.append(f"Usuário: {user.get('name', 'Anônimo')} • objetivo: {user.get('goal', 'maintain')}")
    if user.get('height_cm'): lines.append(f"Altura: {user['height_cm']} cm")
    if user.get('goal_weight_kg'): lines.append(f"Peso meta: {user['goal_weight_kg']} kg")
    if weights:
        w0 = weights[0]
        lines.append(f"Peso atual: {w0.get('weight_kg')} kg em {w0.get('date')}")
        if len(weights) > 1:
            diff = round(weights[0].get('weight_kg', 0) - weights[-1].get('weight_kg', 0), 2)
            lines.append(f"Variação nos últimos {len(weights)} registros: {diff:+} kg")
    if sleeps:
        sh = [s.get('hours') for s in sleeps if s.get('hours')]
        if sh: lines.append(f"Sono médio (últimos {len(sh)}): {round(sum(sh)/len(sh), 1)}h")
    if exercises:
        mins = sum(e.get('duration_min', 0) for e in exercises)
        lines.append(f"Exercícios recentes: {len(exercises)} sessões, {mins} min totais")
    if meals:
        kcal = sum(m.get('calories', 0) for m in meals[:10])
        lines.append(f"Últimas 10 refeições somam {round(kcal)} kcal")
    lines.append(f"Meta calórica diária: {user.get('daily_calorie_goal', 2000)} kcal")
    lines.append(f"Água hoje: {water_today_ml} / {user.get('daily_water_ml_goal', 2000)} ml")
    return "\n".join(lines)


@api.post("/coach/chat")
async def coach_chat(payload: CoachMsgIn, user: dict = Depends(require_premium)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY não configurada")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        raise HTTPException(500, f"IA indisponível: {e}")

    session_id = payload.session_id or f"coach_{user['user_id']}_{uuid.uuid4().hex[:8]}"
    context = await _build_user_context(user)
    system = (
        "Você é o Coach Virtual do VitaTracker: nutricionista + personal trainer + psicólogo motivacional. "
        "Responda em português do Brasil, de forma acolhedora, prática e concisa (máximo 4-6 frases). "
        "Use os dados do usuário fornecidos abaixo para personalizar. Se detectar estagnação, oriente ajustes. "
        "Se for pergunta sobre suplementos/medicações, oriente consultar um profissional. "
        "Sempre termine com uma dica prática ou pergunta motivacional.\n\n"
        f"DADOS DO USUÁRIO:\n{context}"
    )
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system)\
        .with_model("gemini", "gemini-2.5-flash")
    # Save user message
    await db.coach_messages.insert_one({
        "user_id": user["user_id"], "session_id": session_id, "role": "user",
        "content": payload.message, "created_at": now_utc().isoformat(),
    })
    try:
        reply = await chat.send_message(UserMessage(text=payload.message))
    except Exception as e:
        log.error("Coach chat error: %s", e)
        raise HTTPException(502, f"Falha na IA: {e}")
    reply_text = reply or ""
    await db.coach_messages.insert_one({
        "user_id": user["user_id"], "session_id": session_id, "role": "assistant",
        "content": reply_text, "created_at": now_utc().isoformat(),
    })
    return {"session_id": session_id, "reply": reply_text}


@api.get("/coach/messages")
async def coach_messages(user: dict = Depends(current_user), session_id: Optional[str] = None, limit: int = 100):
    q: dict = {"user_id": user["user_id"]}
    if session_id:
        q["session_id"] = session_id
    items = await db.coach_messages.find(q, {"_id": 0}).sort("created_at", 1).to_list(limit)
    return {"items": items}


@api.post("/coach/analyze")
async def coach_analyze(user: dict = Depends(require_premium)):
    """Gera um relatório automático da evolução do usuário."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY não configurada")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        raise HTTPException(500, f"IA indisponível: {e}")

    context = await _build_user_context(user)
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"analysis_{user['user_id']}_{uuid.uuid4().hex[:6]}",
        system_message=(
            "Você é um analista de saúde do VitaTracker. Com base nos dados do usuário, produza um relatório "
            "com JSON APENAS no formato: {\"summary\":\"resumo em 2 frases\","
            "\"strengths\":[\"até 3 pontos fortes\"],\"opportunities\":[\"até 3 oportunidades de melhoria\"],"
            "\"stagnation_alert\": true|false, \"next_actions\":[\"até 3 ações práticas curtas\"]}. "
            f"Nunca inclua texto fora do JSON.\n\nDADOS:\n{context}"
        ),
    ).with_model("gemini", "gemini-2.5-flash")
    try:
        resp = await chat.send_message(UserMessage(text="Analise minha evolução e retorne o JSON."))
    except Exception as e:
        raise HTTPException(502, f"Falha na análise: {e}")
    data = _extract_json(resp or "")
    if not data:
        raise HTTPException(422, "Não foi possível interpretar a análise")
    return {"analysis": data}




# ==================== Módulo 21: Empresas (Corporate Plan) ====================
class CompanyIn(BaseModel):
    name: str
    industry: Optional[str] = None
    logo_base64: Optional[str] = None
    plan: Literal["free", "starter", "business", "enterprise"] = "free"


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    logo_base64: Optional[str] = None
    plan: Optional[Literal["free", "starter", "business", "enterprise"]] = None


class CampaignIn(BaseModel):
    title: str
    description: Optional[str] = None
    metric: Literal["water_ml", "steps", "sleep_hours", "weight_loss_kg",
                    "exercise_min", "meals_count"] = "water_ml"
    target_value: float
    start_date: Optional[str] = None
    end_date: Optional[str] = None


def _gen_company_code() -> str:
    """Short human-friendly invite code (e.g., 'V-4K9F2')."""
    import random, string
    return "V-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=5))


async def _get_membership(company_id: str, user_id: str) -> Optional[dict]:
    return await db.company_members.find_one(
        {"company_id": company_id, "user_id": user_id, "active": True}, {"_id": 0}
    )


async def _require_admin(company_id: str, user_id: str) -> dict:
    mem = await _get_membership(company_id, user_id)
    if not mem or mem.get("role") != "admin":
        raise HTTPException(403, "Apenas administradores podem executar esta ação")
    return mem


@api.post("/companies")
async def create_company(payload: CompanyIn, user: dict = Depends(current_user)):
    # unique code (retry up to 5x on collision)
    code = None
    for _ in range(5):
        c = _gen_company_code()
        if not await db.companies.find_one({"code": c}, {"_id": 1}):
            code = c
            break
    if not code:
        raise HTTPException(500, "Falha ao gerar código de convite")
    company = {
        "id": new_id("co"),
        "name": payload.name.strip(),
        "industry": payload.industry,
        "logo_base64": payload.logo_base64,
        "plan": payload.plan,
        "code": code,
        "owner_id": user["user_id"],
        "created_at": now_utc().isoformat(),
    }
    if not company["name"]:
        raise HTTPException(400, "Nome da empresa é obrigatório")
    await db.companies.insert_one(company)
    await db.company_members.insert_one({
        "id": new_id("mem"),
        "company_id": company["id"],
        "user_id": user["user_id"],
        "role": "admin",
        "joined_at": now_utc().isoformat(),
        "active": True,
    })
    return {k: v for k, v in company.items() if k != "_id"}


@api.get("/companies/mine")
async def list_my_companies(user: dict = Depends(current_user)):
    memberships = await db.company_members.find(
        {"user_id": user["user_id"], "active": True}, {"_id": 0}
    ).to_list(50)
    if not memberships:
        return {"items": []}
    company_ids = [m["company_id"] for m in memberships]
    companies = await db.companies.find({"id": {"$in": company_ids}}, {"_id": 0}).to_list(50)
    by_id = {c["id"]: c for c in companies}
    items = []
    for m in memberships:
        c = by_id.get(m["company_id"])
        if not c:
            continue
        n_members = await db.company_members.count_documents(
            {"company_id": c["id"], "active": True}
        )
        items.append({
            **c, "role": m.get("role"), "member_count": n_members,
        })
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"items": items}


class JoinIn(BaseModel):
    code: str


@api.post("/companies/join")
async def join_company(payload: JoinIn, user: dict = Depends(current_user)):
    code = payload.code.strip().upper()
    if not code:
        raise HTTPException(400, "Código inválido")
    company = await db.companies.find_one({"code": code}, {"_id": 0})
    if not company:
        raise HTTPException(404, "Empresa não encontrada com esse código")
    exists = await db.company_members.find_one(
        {"company_id": company["id"], "user_id": user["user_id"]}, {"_id": 0}
    )
    if exists:
        if exists.get("active"):
            raise HTTPException(400, "Você já é membro dessa empresa")
        await db.company_members.update_one(
            {"id": exists["id"]}, {"$set": {"active": True, "joined_at": now_utc().isoformat()}}
        )
    else:
        await db.company_members.insert_one({
            "id": new_id("mem"),
            "company_id": company["id"],
            "user_id": user["user_id"],
            "role": "member",
            "joined_at": now_utc().isoformat(),
            "active": True,
        })
    return {"ok": True, "company": company}


@api.get("/companies/{company_id}")
async def get_company(company_id: str, user: dict = Depends(current_user)):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(404, "Empresa não encontrada")
    mem = await _get_membership(company_id, user["user_id"])
    if not mem:
        raise HTTPException(403, "Você não é membro desta empresa")
    n_members = await db.company_members.count_documents(
        {"company_id": company_id, "active": True}
    )
    return {**company, "role": mem["role"], "member_count": n_members}


@api.patch("/companies/{company_id}")
async def update_company(company_id: str, payload: CompanyUpdate, user: dict = Depends(current_user)):
    await _require_admin(company_id, user["user_id"])
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Sem alterações")
    await db.companies.update_one({"id": company_id}, {"$set": updates})
    return {"ok": True}


@api.delete("/companies/{company_id}")
async def delete_company(company_id: str, user: dict = Depends(current_user)):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(404, "Empresa não encontrada")
    if company["owner_id"] != user["user_id"]:
        raise HTTPException(403, "Apenas o dono pode excluir a empresa")
    await db.companies.delete_one({"id": company_id})
    await db.company_members.delete_many({"company_id": company_id})
    await db.campaigns.delete_many({"company_id": company_id})
    return {"ok": True}


@api.post("/companies/{company_id}/leave")
async def leave_company(company_id: str, user: dict = Depends(current_user)):
    mem = await _get_membership(company_id, user["user_id"])
    if not mem:
        raise HTTPException(404, "Você não é membro")
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if company and company["owner_id"] == user["user_id"]:
        raise HTTPException(400, "O dono não pode sair. Exclua a empresa ou transfira a propriedade.")
    await db.company_members.update_one({"id": mem["id"]}, {"$set": {"active": False}})
    return {"ok": True}


@api.get("/companies/{company_id}/members")
async def list_members(company_id: str, user: dict = Depends(current_user)):
    await _require_admin(company_id, user["user_id"])
    memberships = await db.company_members.find(
        {"company_id": company_id, "active": True}, {"_id": 0}
    ).to_list(500)
    user_ids = [m["user_id"] for m in memberships]
    users = await db.users.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "photo_base64": 1},
    ).to_list(500)
    by_id = {u["user_id"]: u for u in users}
    items = []
    for m in memberships:
        u = by_id.get(m["user_id"], {})
        items.append({
            "membership_id": m["id"], "user_id": m["user_id"],
            "name": u.get("name") or "Anônimo", "email": u.get("email"),
            "avatar": u.get("photo_base64"),
            "role": m.get("role"), "joined_at": m.get("joined_at"),
        })
    return {"items": items}


@api.delete("/companies/{company_id}/members/{member_user_id}")
async def remove_member(company_id: str, member_user_id: str, user: dict = Depends(current_user)):
    await _require_admin(company_id, user["user_id"])
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if company and company["owner_id"] == member_user_id:
        raise HTTPException(400, "Não é possível remover o dono da empresa")
    await db.company_members.update_one(
        {"company_id": company_id, "user_id": member_user_id},
        {"$set": {"active": False}},
    )
    return {"ok": True}


@api.get("/companies/{company_id}/dashboard")
async def company_dashboard(company_id: str, user: dict = Depends(current_user)):
    """Aggregated anonymized metrics for company admin."""
    await _require_admin(company_id, user["user_id"])
    memberships = await db.company_members.find(
        {"company_id": company_id, "active": True}, {"_id": 0, "user_id": 1}
    ).to_list(500)
    uids = [m["user_id"] for m in memberships]
    if not uids:
        return {"member_count": 0, "active_today": 0, "totals": {}, "avg": {}}
    today = today_iso()
    # Active users today = at least 1 log in weights/meals/exercises/waters today
    active_today = 0
    for uid in uids:
        has_log = await db.weights.find_one({"user_id": uid, "date": today}, {"_id": 1}) \
            or await db.meals.find_one({"user_id": uid, "date": today}, {"_id": 1}) \
            or await db.exercises.find_one({"user_id": uid, "date": today}, {"_id": 1}) \
            or await db.waters.find_one({"user_id": uid, "date": today}, {"_id": 1})
        if has_log:
            active_today += 1

    async def sum_col(col: str, field: str, days: int = 7) -> float:
        cutoff = (now_utc().date() - timedelta(days=days)).isoformat()
        pipeline = [
            {"$match": {"user_id": {"$in": uids}, "date": {"$gte": cutoff}}},
            {"$group": {"_id": None, "s": {"$sum": f"${field}"}}},
        ]
        r = await db[col].aggregate(pipeline).to_list(1)
        return float(r[0]["s"]) if r else 0.0

    total_water_ml = await sum_col("waters", "amount_ml", days=7)
    total_steps = await sum_col("steps", "steps", days=7)
    total_exercise_min = await sum_col("exercises", "duration_min", days=7)
    total_meals = await db.meals.count_documents(
        {"user_id": {"$in": uids}, "date": {"$gte": (now_utc().date() - timedelta(days=7)).isoformat()}}
    )
    # Average sleep hours over 7d per user
    sleep_docs = await db.sleeps.find(
        {"user_id": {"$in": uids}, "date": {"$gte": (now_utc().date() - timedelta(days=7)).isoformat()}},
        {"_id": 0, "hours": 1},
    ).to_list(2000)
    avg_sleep = round(sum(s.get("hours", 0) for s in sleep_docs) / len(sleep_docs), 1) if sleep_docs else 0

    return {
        "member_count": len(uids),
        "active_today": active_today,
        "engagement_pct": round((active_today / len(uids)) * 100, 1) if uids else 0,
        "period_days": 7,
        "totals": {
            "water_ml": int(total_water_ml),
            "steps": int(total_steps),
            "exercise_min": int(total_exercise_min),
            "meals": total_meals,
        },
        "averages": {
            "water_ml_per_user": int(total_water_ml / len(uids)),
            "steps_per_user": int(total_steps / len(uids)),
            "exercise_min_per_user": int(total_exercise_min / len(uids)),
            "sleep_hours": avg_sleep,
        },
    }


@api.get("/companies/{company_id}/leaderboard")
async def company_leaderboard(company_id: str, user: dict = Depends(current_user)):
    """Internal company XP ranking (reuses gamification XP calculation)."""
    mem = await _get_membership(company_id, user["user_id"])
    if not mem:
        raise HTTPException(403, "Você não é membro desta empresa")
    memberships = await db.company_members.find(
        {"company_id": company_id, "active": True}, {"_id": 0, "user_id": 1}
    ).to_list(500)
    uids = [m["user_id"] for m in memberships]
    users = await db.users.find(
        {"user_id": {"$in": uids}},
        {"_id": 0, "user_id": 1, "name": 1, "photo_base64": 1},
    ).to_list(500)
    by_id = {u["user_id"]: u for u in users}
    entries = []
    for uid in uids:
        xp, level, streak = await _compute_user_xp(uid)
        u = by_id.get(uid, {})
        entries.append({
            "user_id": uid, "name": u.get("name") or "Anônimo",
            "avatar": u.get("photo_base64"),
            "xp": xp, "level": level, "streak": streak,
            "is_me": uid == user["user_id"],
        })
    entries.sort(key=lambda e: (-e["xp"], -e["streak"]))
    for i, e in enumerate(entries):
        e["rank"] = i + 1
    my_rank = next((e["rank"] for e in entries if e["is_me"]), None)
    return {"items": entries, "my_rank": my_rank, "total": len(entries)}


# ---------- Campaigns / Desafios ----------
@api.post("/companies/{company_id}/campaigns")
async def create_campaign(company_id: str, payload: CampaignIn, user: dict = Depends(current_user)):
    await _require_admin(company_id, user["user_id"])
    if payload.target_value <= 0:
        raise HTTPException(400, "Meta inválida")
    camp = {
        "id": new_id("cmp"),
        "company_id": company_id,
        "title": payload.title.strip(),
        "description": payload.description,
        "metric": payload.metric,
        "target_value": payload.target_value,
        "start_date": payload.start_date or today_iso(),
        "end_date": payload.end_date or (now_utc().date() + timedelta(days=30)).isoformat(),
        "created_by": user["user_id"],
        "created_at": now_utc().isoformat(),
    }
    if not camp["title"]:
        raise HTTPException(400, "Título obrigatório")
    await db.campaigns.insert_one(camp)
    return {k: v for k, v in camp.items() if k != "_id"}


@api.get("/companies/{company_id}/campaigns")
async def list_campaigns(company_id: str, user: dict = Depends(current_user)):
    mem = await _get_membership(company_id, user["user_id"])
    if not mem:
        raise HTTPException(403, "Você não é membro")
    items = await db.campaigns.find(
        {"company_id": company_id}, {"_id": 0}
    ).sort("start_date", -1).to_list(50)
    # Enrich with participant count + my participation
    for c in items:
        c["participant_count"] = await db.campaign_participations.count_documents(
            {"campaign_id": c["id"]}
        )
        my = await db.campaign_participations.find_one(
            {"campaign_id": c["id"], "user_id": user["user_id"]}, {"_id": 0}
        )
        c["joined"] = bool(my)
    return {"items": items}


async def _compute_campaign_progress(campaign: dict, uid: str) -> float:
    """Return current progress value of `uid` for `campaign`."""
    metric = campaign["metric"]
    start = campaign["start_date"]
    end = campaign["end_date"]
    q = {"user_id": uid, "date": {"$gte": start, "$lte": end}}
    if metric == "water_ml":
        docs = await db.waters.find(q, {"_id": 0, "amount_ml": 1}).to_list(5000)
        return sum(d.get("amount_ml", 0) for d in docs)
    if metric == "steps":
        docs = await db.steps.find(q, {"_id": 0, "steps": 1}).to_list(5000)
        return sum(d.get("steps", 0) for d in docs)
    if metric == "sleep_hours":
        docs = await db.sleeps.find(q, {"_id": 0, "hours": 1}).to_list(5000)
        return round(sum(d.get("hours", 0) for d in docs), 1)
    if metric == "exercise_min":
        docs = await db.exercises.find(q, {"_id": 0, "duration_min": 1}).to_list(5000)
        return sum(d.get("duration_min", 0) for d in docs)
    if metric == "meals_count":
        return await db.meals.count_documents(q)
    if metric == "weight_loss_kg":
        # Weight loss between first and last measurement inside campaign window
        weights = await db.weights.find(q, {"_id": 0, "weight_kg": 1, "date": 1}).sort("date", 1).to_list(1000)
        if len(weights) < 2:
            return 0.0
        return round(weights[0]["weight_kg"] - weights[-1]["weight_kg"], 1)
    return 0.0


@api.post("/campaigns/{campaign_id}/join")
async def join_campaign(campaign_id: str, user: dict = Depends(current_user)):
    camp = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not camp:
        raise HTTPException(404, "Campanha não encontrada")
    mem = await _get_membership(camp["company_id"], user["user_id"])
    if not mem:
        raise HTTPException(403, "Você não é membro desta empresa")
    try:
        await db.campaign_participations.insert_one({
            "id": new_id("cp"),
            "campaign_id": campaign_id,
            "company_id": camp["company_id"],
            "user_id": user["user_id"],
            "joined_at": now_utc().isoformat(),
        })
    except Exception:
        # duplicate key ok
        pass
    return {"ok": True}


@api.post("/campaigns/{campaign_id}/leave")
async def leave_campaign(campaign_id: str, user: dict = Depends(current_user)):
    await db.campaign_participations.delete_one(
        {"campaign_id": campaign_id, "user_id": user["user_id"]}
    )
    return {"ok": True}


@api.get("/campaigns/{campaign_id}")
async def campaign_detail(campaign_id: str, user: dict = Depends(current_user)):
    camp = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not camp:
        raise HTTPException(404, "Campanha não encontrada")
    mem = await _get_membership(camp["company_id"], user["user_id"])
    if not mem:
        raise HTTPException(403, "Sem acesso")
    my_progress = await _compute_campaign_progress(camp, user["user_id"])
    my_participation = await db.campaign_participations.find_one(
        {"campaign_id": campaign_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return {
        **camp,
        "joined": bool(my_participation),
        "my_progress": my_progress,
        "progress_pct": min(100.0, round((my_progress / camp["target_value"]) * 100, 1)) if camp["target_value"] else 0,
    }


@api.get("/campaigns/{campaign_id}/ranking")
async def campaign_ranking(campaign_id: str, user: dict = Depends(current_user)):
    camp = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not camp:
        raise HTTPException(404, "Campanha não encontrada")
    mem = await _get_membership(camp["company_id"], user["user_id"])
    if not mem:
        raise HTTPException(403, "Sem acesso")
    participations = await db.campaign_participations.find(
        {"campaign_id": campaign_id}, {"_id": 0, "user_id": 1}
    ).to_list(500)
    uids = [p["user_id"] for p in participations]
    users = await db.users.find(
        {"user_id": {"$in": uids}},
        {"_id": 0, "user_id": 1, "name": 1, "photo_base64": 1},
    ).to_list(500)
    by_id = {u["user_id"]: u for u in users}
    entries = []
    for uid in uids:
        p = await _compute_campaign_progress(camp, uid)
        u = by_id.get(uid, {})
        entries.append({
            "user_id": uid, "name": u.get("name") or "Anônimo",
            "avatar": u.get("photo_base64"),
            "progress": p,
            "progress_pct": min(100.0, round((p / camp["target_value"]) * 100, 1)) if camp["target_value"] else 0,
            "is_me": uid == user["user_id"],
        })
    entries.sort(key=lambda e: -e["progress"])
    for i, e in enumerate(entries):
        e["rank"] = i + 1
    my_rank = next((e["rank"] for e in entries if e["is_me"]), None)
    return {"items": entries, "my_rank": my_rank, "target": camp["target_value"], "metric": camp["metric"]}


@api.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, user: dict = Depends(current_user)):
    camp = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not camp:
        raise HTTPException(404, "Campanha não encontrada")
    await _require_admin(camp["company_id"], user["user_id"])
    await db.campaigns.delete_one({"id": campaign_id})
    await db.campaign_participations.delete_many({"campaign_id": campaign_id})
    return {"ok": True}


@api.get("/companies/{company_id}/report/pdf")
async def company_report_pdf(company_id: str, user: dict = Depends(current_user)):
    """Aggregated corporate PDF (admin only, anonymized)."""
    await _require_admin(company_id, user["user_id"])
    from fastapi.responses import Response
    from fpdf import FPDF

    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(404, "Empresa não encontrada")

    # Reuse dashboard computation
    memberships = await db.company_members.find(
        {"company_id": company_id, "active": True}, {"_id": 0, "user_id": 1}
    ).to_list(500)
    uids = [m["user_id"] for m in memberships]
    campaigns = await db.campaigns.find({"company_id": company_id}, {"_id": 0}).to_list(50)

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(38, 48, 26)
    pdf.cell(0, 10, f"VitaTracker Corporate - {company['name']}", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 6, f"Setor: {company.get('industry') or '-'}  |  Plano: {company['plan'].capitalize()}", ln=True)
    pdf.cell(0, 6, f"Gerado em: {now_utc().strftime('%d/%m/%Y')}", ln=True)
    pdf.ln(6)

    pdf.set_fill_color(14, 16, 15)
    pdf.set_text_color(198, 241, 75)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 12, f"  Funcionarios: {len(uids)}  |  Campanhas: {len(campaigns)}", ln=True, fill=True)
    pdf.ln(6)

    if uids:
        cutoff = (now_utc().date() - timedelta(days=7)).isoformat()

        async def _sum(col: str, field: str) -> int:
            r = await db[col].aggregate([
                {"$match": {"user_id": {"$in": uids}, "date": {"$gte": cutoff}}},
                {"$group": {"_id": None, "s": {"$sum": f"${field}"}}},
            ]).to_list(1)
            return int(r[0]["s"]) if r else 0

        w = await _sum("waters", "amount_ml")
        st = await _sum("steps", "steps")
        ex = await _sum("exercises", "duration_min")

        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(38, 48, 26)
        pdf.cell(0, 8, "Ultimos 7 dias (agregado, anonimo)", ln=True)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 6, f"  Agua total: {w} ml  ({int(w/max(1,len(uids)))} ml/usuario)", ln=True)
        pdf.cell(0, 6, f"  Passos totais: {st}  ({int(st/max(1,len(uids)))} /usuario)", ln=True)
        pdf.cell(0, 6, f"  Exercicio total: {ex} min  ({int(ex/max(1,len(uids)))} min/usuario)", ln=True)
        pdf.ln(4)

    if campaigns:
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(38, 48, 26)
        pdf.cell(0, 8, "Campanhas ativas", ln=True)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(30, 30, 30)
        for c in campaigns[:15]:
            n_part = await db.campaign_participations.count_documents({"campaign_id": c["id"]})
            pdf.cell(0, 6, f"  - {c['title']} ({c['metric']} >= {c['target_value']}) - {n_part} participantes", ln=True)

    pdf_bytes = bytes(pdf.output())
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="vitatracker-corporate-{company["name"].replace(" ", "_")}.pdf"'},
    )


# ==================== Módulo Billing / Assinaturas Premium ====================
PLAN_CATALOG = {
    "monthly": {"amount": 19.90, "days": 30, "label": "Premium Mensal"},
    "annual": {"amount": 149.90, "days": 365, "label": "Premium Anual"},
}


class CheckoutIn(BaseModel):
    plan: Literal["monthly", "annual"]
    origin_url: Optional[str] = None  # Frontend origin for redirect URLs (set by client)


@api.post("/billing/checkout")
async def billing_checkout(payload: CheckoutIn, request: Request,
                           user: dict = Depends(current_user),
                           _rl: None = Depends(billing_rate_limit)):
    """Create a Stripe checkout session. Payment grants premium access for `days`."""
    if not STRIPE_API_KEY:
        raise HTTPException(500, "Stripe não configurado")
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    except Exception as e:
        raise HTTPException(500, f"Biblioteca de pagamento indisponível: {e}")

    plan_info = PLAN_CATALOG[payload.plan]
    # Build return URLs — use client-provided origin (mobile/web) or fall back to request host
    origin = (payload.origin_url or "").rstrip("/")
    if not origin:
        origin = str(request.base_url).rstrip("/")
    success_url = f"{origin}/billing-return?session_id={{CHECKOUT_SESSION_ID}}&status=success"
    cancel_url = f"{origin}/billing-return?status=cancel"

    checkout = StripeCheckout(
        api_key=STRIPE_API_KEY,
        webhook_url=f"{str(request.base_url).rstrip('/')}/api/webhook/stripe",
    )
    req = CheckoutSessionRequest(
        amount=plan_info["amount"],
        currency="brl",
        quantity=1,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["user_id"],
            "plan": payload.plan,
            "days": str(plan_info["days"]),
            "email": user.get("email") or "",
        },
    )
    try:
        session = await checkout.create_checkout_session(req)
    except Exception as e:
        log.error("Stripe session error: %s", e)
        raise HTTPException(502, f"Falha ao criar sessão de pagamento: {e}")

    # Persist tx record for auditing + polling
    await db.payment_transactions.insert_one({
        "id": new_id("tx"),
        "user_id": user["user_id"],
        "session_id": session.session_id,
        "url": session.url,
        "amount": plan_info["amount"],
        "currency": "brl",
        "plan": payload.plan,
        "days": plan_info["days"],
        "status": "created",           # created | paid | canceled | expired
        "payment_status": "unpaid",
        "created_at": now_utc().isoformat(),
        "metadata": req.metadata,
    })
    return {
        "session_id": session.session_id,
        "checkout_url": session.url,
        "plan": payload.plan,
        "amount": plan_info["amount"],
    }


async def _apply_paid_transaction(tx: dict) -> None:
    """Grant premium access based on the transaction's plan."""
    days = int(tx.get("days") or PLAN_CATALOG.get(tx.get("plan"), {}).get("days") or 30)
    user_id = tx["user_id"]
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "premium_expires_at": 1})
    now = now_utc()
    base = now
    if u and u.get("premium_expires_at"):
        try:
            cur = u["premium_expires_at"]
            cur_dt = datetime.fromisoformat(cur.replace("Z", "+00:00")) if isinstance(cur, str) else cur
            if cur_dt.tzinfo is None:
                cur_dt = cur_dt.replace(tzinfo=timezone.utc)
            if cur_dt > now:
                base = cur_dt
        except Exception:
            pass
    new_exp = base + timedelta(days=days)
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "subscription_tier": "premium",
            "premium_since": tx.get("paid_at") or now.isoformat(),
            "premium_expires_at": new_exp.isoformat(),
            "last_plan": tx.get("plan"),
        }},
    )


@api.get("/billing/status/{session_id}")
async def billing_status(session_id: str, user: dict = Depends(current_user)):
    """Poll a session and, if paid, grant premium (idempotent)."""
    if not STRIPE_API_KEY:
        raise HTTPException(500, "Stripe não configurado")
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx or tx["user_id"] != user["user_id"]:
        raise HTTPException(404, "Sessão não encontrada")

    # If already applied, short-circuit
    if tx.get("status") == "paid":
        u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
        return {"status": "paid", "premium_expires_at": u.get("premium_expires_at") if u else None,
                "amount": tx["amount"], "plan": tx["plan"]}

    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        checkout = StripeCheckout(api_key=STRIPE_API_KEY)
        st = await checkout.get_checkout_status(session_id)
    except Exception as e:
        raise HTTPException(502, f"Falha ao consultar pagamento: {e}")

    payment_status = st.payment_status
    session_status = st.status
    new_status = tx["status"]
    if payment_status == "paid" and session_status == "complete":
        new_status = "paid"
    elif session_status in ("expired",):
        new_status = "expired"

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"status": new_status, "payment_status": payment_status,
                  "last_checked": now_utc().isoformat(),
                  "paid_at": now_utc().isoformat() if new_status == "paid" and tx["status"] != "paid" else tx.get("paid_at")}},
    )
    if new_status == "paid" and tx["status"] != "paid":
        # Apply premium (idempotent per session)
        tx_after = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        await _apply_paid_transaction(tx_after or tx)

    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {
        "status": new_status,
        "payment_status": payment_status,
        "session_status": session_status,
        "amount": tx["amount"],
        "plan": tx["plan"],
        "premium_expires_at": u.get("premium_expires_at") if u else None,
    }


@app.post("/api/webhook/stripe", include_in_schema=False)
async def stripe_webhook(request: Request):
    """Receive Stripe events and grant premium on successful payment."""
    if not STRIPE_API_KEY:
        raise HTTPException(500, "Stripe não configurado")
    body = await request.body()
    sig = request.headers.get("stripe-signature")
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        checkout = StripeCheckout(api_key=STRIPE_API_KEY)
        event = await checkout.handle_webhook(body, sig)
    except Exception as e:
        log.warning("Webhook parse error: %s", e)
        raise HTTPException(400, "Webhook inválido")

    # Log event
    await db.webhook_events.insert_one({
        "id": new_id("evt"),
        "event_id": event.event_id,
        "event_type": event.event_type,
        "session_id": event.session_id,
        "payment_status": event.payment_status,
        "metadata": event.metadata or {},
        "received_at": now_utc().isoformat(),
    })

    if event.payment_status == "paid" and event.session_id:
        tx = await db.payment_transactions.find_one({"session_id": event.session_id}, {"_id": 0})
        if tx and tx.get("status") != "paid":
            await db.payment_transactions.update_one(
                {"session_id": event.session_id},
                {"$set": {"status": "paid", "payment_status": "paid",
                          "paid_at": now_utc().isoformat()}},
            )
            tx_after = await db.payment_transactions.find_one({"session_id": event.session_id}, {"_id": 0})
            await _apply_paid_transaction(tx_after or tx)
    return {"ok": True}


@api.get("/billing/subscription")
async def my_subscription(user: dict = Depends(current_user)):
    """Return current premium status + last transactions."""
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}
    txs = await db.payment_transactions.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    return {
        "is_premium": _is_premium(u),
        "premium_expires_at": u.get("premium_expires_at"),
        "premium_since": u.get("premium_since"),
        "last_plan": u.get("last_plan"),
        "plans": PLAN_CATALOG,
        "transactions": txs,
    }


@api.get("/billing/plans")
async def billing_plans():
    """Public — list available plans."""
    return {"plans": [{"id": k, **v} for k, v in PLAN_CATALOG.items()]}


# LGPD router mounted under /api via composition (Clean Arch — new modules only)
api.include_router(lgpd_router)
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
